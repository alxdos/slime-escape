import { describe, expect, it } from 'vitest';

import { SLIME_FAST, TRAINING_TARGET } from '../shared/content/enemies';
import { PISTOL } from '../shared/content/weapons';
import type { RuntimeEvent } from '../shared/events';
import type { ArenaConfig } from '../shared/session';
import { SIM_STEP_MS } from '../shared/timing';

import { createCombatSystem } from './CombatSystem';
import { createEntityStore, type EntityId } from './EntityStore';
import { createRuntimeInputState, type RuntimeInputState } from './RuntimeInputState';
import { createSpatialIndex } from './SpatialIndex';

const ARENA: ArenaConfig = { width: 32, height: 18 };
const PLAYER_SPEC = { position: { x: 0, y: 0 }, radius: 0.5, maxSpeed: 6, maxHp: 1 };

function trainingTargetSpec(position: { x: number; y: number }) {
  return {
    archetypeId: TRAINING_TARGET.id,
    position,
    radius: TRAINING_TARGET.radius,
    behavior: TRAINING_TARGET.behavior,
    maxHp: TRAINING_TARGET.maxHp,
    maxSpeed: TRAINING_TARGET.maxSpeed,
    contactDamage: TRAINING_TARGET.contactDamage,
    contactCooldownMs: TRAINING_TARGET.contactCooldownMs,
    knockbackBaseImpulse: TRAINING_TARGET.knockbackBaseImpulse,
    knockbackVelocityScale: TRAINING_TARGET.knockbackVelocityScale,
    knockbackDurationMs: TRAINING_TARGET.knockbackDurationMs,
    color: TRAINING_TARGET.color
  };
}

function setupCombat() {
  const store = createEntityStore();
  const index = createSpatialIndex();
  const combat = createCombatSystem();
  const player = store.spawnPlayer(PLAYER_SPEC);
  combat.setPlayerLoadout(player.id, { primaryWeaponArchetypeId: PISTOL.id }, 0);
  return { store, index, combat, player };
}

function makeInput(overrides: Partial<RuntimeInputState> = {}): RuntimeInputState {
  const state = createRuntimeInputState();
  if (overrides.moveDir) state.moveDir = overrides.moveDir;
  if (overrides.aimWorld) state.aimWorld = overrides.aimWorld;
  if (overrides.firing !== undefined) state.firing = overrides.firing;
  return state;
}

describe('CombatSystem', () => {
  it('spawns a projectile and emits fire event when firing with valid aim', () => {
    const { store, index, combat } = setupCombat();
    const input = makeInput({ aimWorld: { x: 5, y: 0 }, firing: true });
    const events: RuntimeEvent[] = [];

    combat.tick(input, store, index, 0, ARENA, (e) => events.push(e));

    expect(store.projectileCount()).toBe(1);
    const fireEvents = events.filter((e) => e.kind === 'fire');
    expect(fireEvents).toHaveLength(1);
    const ev = fireEvents[0]!;
    if (ev.kind !== 'fire') throw new Error('expected fire event');
    expect(ev.weaponArchetypeId).toBe(PISTOL.id);
    expect(ev.dirX).toBeCloseTo(1);
    expect(ev.dirY).toBeCloseTo(0);
  });

  it('skips firing when aim equals shooter position (zero direction)', () => {
    const { store, index, combat } = setupCombat();
    const input = makeInput({ aimWorld: { x: 0, y: 0 }, firing: true });
    const events: RuntimeEvent[] = [];

    combat.tick(input, store, index, 0, ARENA, (e) => events.push(e));

    expect(store.projectileCount()).toBe(0);
    expect(events.filter((e) => e.kind === 'fire')).toHaveLength(0);
  });

  it('respects per-shooter cooldown between consecutive shots', () => {
    const { store, index, combat } = setupCombat();
    const input = makeInput({ aimWorld: { x: 5, y: 0 }, firing: true });
    const events: RuntimeEvent[] = [];

    combat.tick(input, store, index, 0, ARENA, (e) => events.push(e));
    combat.tick(input, store, index, SIM_STEP_MS, ARENA, (e) => events.push(e));
    combat.tick(input, store, index, PISTOL.cooldownMs - 1, ARENA, (e) => events.push(e));

    expect(events.filter((e) => e.kind === 'fire')).toHaveLength(1);

    combat.tick(input, store, index, PISTOL.cooldownMs, ARENA, (e) => events.push(e));
    expect(events.filter((e) => e.kind === 'fire')).toHaveLength(2);
  });

  it('produces a damage intent and hit event when projectile reaches an enemy', () => {
    const { store, index, combat } = setupCombat();
    const enemy = store.spawnEnemy(trainingTargetSpec({ x: 1, y: 0 }));
    const input = makeInput({ aimWorld: { x: 5, y: 0 }, firing: true });
    const events: RuntimeEvent[] = [];

    const intents = combat.tick(input, store, index, 0, ARENA, (e) => events.push(e));

    expect(intents).toHaveLength(1);
    expect(intents[0]?.targetId).toBe(enemy.id);
    expect(intents[0]?.amount).toBe(PISTOL.damage);
    expect(intents[0]?.source.kind).toBe('projectile');
    const hitEvents = events.filter((e) => e.kind === 'hit');
    expect(hitEvents).toHaveLength(1);
    expect(store.projectileCount()).toBe(0);
  });

  it('removes projectiles that exceed projectileTtlMs without producing a damage intent', () => {
    const { store, index, combat } = setupCombat();
    const input = makeInput({ aimWorld: { x: 1, y: 0 }, firing: true });
    let simTime = 0;

    combat.tick(input, store, index, simTime, ARENA, () => {});
    expect(store.projectileCount()).toBe(1);

    simTime = PISTOL.projectileTtlMs;
    const intents = combat.tick(makeInput(), store, index, simTime, ARENA, () => {});

    expect(store.projectileCount()).toBe(0);
    expect(intents).toHaveLength(0);
  });

  it('removes projectiles that leave the arena and never produces a damage intent', () => {
    const { store, index, combat } = setupCombat();
    const input = makeInput({ aimWorld: { x: 1000, y: 0 }, firing: true });

    combat.tick(input, store, index, 0, ARENA, () => {});
    expect(store.projectileCount()).toBe(1);

    let simTime = SIM_STEP_MS;
    let intents: ReadonlyArray<unknown> = [];
    while (store.projectileCount() > 0 && simTime < PISTOL.projectileTtlMs) {
      intents = combat.tick(makeInput(), store, index, simTime, ARENA, () => {});
      simTime += SIM_STEP_MS;
    }

    expect(store.projectileCount()).toBe(0);
    expect(intents).toHaveLength(0);
    expect(simTime).toBeLessThan(PISTOL.projectileTtlMs);
  });

  it('honours friendly-fire: enemy projectile does not target enemy', () => {
    const { store, index, combat } = setupCombat();
    store.spawnEnemy(trainingTargetSpec({ x: 0.5, y: 0 }));
    store.spawnProjectile({
      weaponArchetypeId: PISTOL.id,
      ownerKind: 'enemy',
      position: { x: 0, y: 0 },
      velocity: { vx: 0, vy: 0 },
      radius: PISTOL.projectileRadius,
      damage: PISTOL.damage,
      expireAtSimMs: 10_000
    });

    const intents = combat.tick(makeInput(), store, index, SIM_STEP_MS, ARENA, () => {});

    const targetsEnemy = intents.some((i) => {
      const enemy = store.enemyById(i.targetId as EntityId);
      return enemy !== null;
    });
    expect(targetsEnemy).toBe(false);
  });

  it('clear() drops registered loadout so player no longer fires', () => {
    const { store, index, combat } = setupCombat();
    const input = makeInput({ aimWorld: { x: 5, y: 0 }, firing: true });

    combat.clear();
    combat.tick(input, store, index, 0, ARENA, () => {});

    expect(store.projectileCount()).toBe(0);
  });

  it('setPlayerLoadout throws on unknown weapon archetypeId at session start', () => {
    const store = createEntityStore();
    const combat = createCombatSystem();
    const player = store.spawnPlayer(PLAYER_SPEC);

    expect(() =>
      combat.setPlayerLoadout(player.id, { primaryWeaponArchetypeId: 'no-such-weapon' }, 0)
    ).toThrow(/unknown weapon archetype/);
  });
});

describe('CombatSystem contact intents', () => {
  function slimeFastSpec(position: { x: number; y: number }) {
    return {
      archetypeId: SLIME_FAST.id,
      position,
      radius: SLIME_FAST.radius,
      behavior: SLIME_FAST.behavior,
      maxHp: SLIME_FAST.maxHp,
      maxSpeed: SLIME_FAST.maxSpeed,
      contactDamage: SLIME_FAST.contactDamage,
      contactCooldownMs: SLIME_FAST.contactCooldownMs,
      knockbackBaseImpulse: SLIME_FAST.knockbackBaseImpulse,
      knockbackVelocityScale: SLIME_FAST.knockbackVelocityScale,
      knockbackDurationMs: SLIME_FAST.knockbackDurationMs,
      color: SLIME_FAST.color
    };
  }

  function setupContact() {
    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem();
    store.spawnPlayer(PLAYER_SPEC);
    return { store, index, combat };
  }

  it('forms enemyContact DamageIntent for an overlapping enemy with contactDamage > 0', () => {
    const { store, index, combat } = setupContact();
    const enemy = store.spawnEnemy(slimeFastSpec({ x: 0.5, y: 0 }));

    const intents = combat.tick(makeInput(), store, index, 0, ARENA, () => {});

    expect(intents).toHaveLength(1);
    const intent = intents[0]!;
    expect(intent.targetId).toBe(store.player()!.id);
    expect(intent.amount).toBe(SLIME_FAST.contactDamage);
    if (intent.source.kind !== 'enemyContact') throw new Error('expected enemyContact source');
    expect(intent.source.enemyId).toBe(enemy.id);
  });

  it('does not emit a runtime event for the contact', () => {
    const { store, index, combat } = setupContact();
    store.spawnEnemy(slimeFastSpec({ x: 0.5, y: 0 }));
    const events: RuntimeEvent[] = [];

    combat.tick(makeInput(), store, index, 0, ARENA, (e) => events.push(e));

    expect(events).toHaveLength(0);
  });

  it('skips contact if cooldown not elapsed and re-fires once it does', () => {
    const { store, index, combat } = setupContact();
    store.spawnEnemy(slimeFastSpec({ x: 0.5, y: 0 }));

    const first = combat.tick(makeInput(), store, index, 0, ARENA, () => {});
    expect(first).toHaveLength(1);

    const mid = combat.tick(
      makeInput(),
      store,
      index,
      SLIME_FAST.contactCooldownMs - 1,
      ARENA,
      () => {}
    );
    expect(mid).toHaveLength(0);

    const after = combat.tick(
      makeInput(),
      store,
      index,
      SLIME_FAST.contactCooldownMs,
      ARENA,
      () => {}
    );
    expect(after).toHaveLength(1);
  });

  it('skips enemies with contactDamage === 0', () => {
    const { store, index, combat } = setupContact();
    store.spawnEnemy({
      archetypeId: TRAINING_TARGET.id,
      position: { x: 0.5, y: 0 },
      radius: TRAINING_TARGET.radius,
      behavior: TRAINING_TARGET.behavior,
      maxHp: TRAINING_TARGET.maxHp,
      maxSpeed: TRAINING_TARGET.maxSpeed,
      contactDamage: 0,
      contactCooldownMs: TRAINING_TARGET.contactCooldownMs,
      knockbackBaseImpulse: TRAINING_TARGET.knockbackBaseImpulse,
      knockbackVelocityScale: TRAINING_TARGET.knockbackVelocityScale,
      knockbackDurationMs: TRAINING_TARGET.knockbackDurationMs,
      color: TRAINING_TARGET.color
    });

    const intents = combat.tick(makeInput(), store, index, 0, ARENA, () => {});
    expect(intents).toHaveLength(0);
  });

  it('is a no-op when no player is spawned', () => {
    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem();
    store.spawnEnemy(slimeFastSpec({ x: 0, y: 0 }));

    expect(() => combat.tick(makeInput(), store, index, 0, ARENA, () => {})).not.toThrow();
  });

  it('knocks the enemy back along (enemy - player) and writes a positive duration', () => {
    const { store, index, combat } = setupContact();
    const enemy = store.spawnEnemy(slimeFastSpec({ x: 0.5, y: 0 }));

    combat.tick(makeInput(), store, index, 0, ARENA, () => {});

    expect(enemy.knockback).not.toBeNull();
    if (enemy.knockback === null) throw new Error('unreachable');
    expect(enemy.knockback.vx).toBeGreaterThan(0);
    expect(enemy.knockback.vy).toBe(0);
    expect(enemy.knockback.endSimMs - enemy.knockback.startSimMs).toBe(
      SLIME_FAST.knockbackDurationMs
    );
  });

  it('with zero approach speed the knockback magnitude equals knockbackBaseImpulse', () => {
    const { store, index, combat } = setupContact();
    const enemy = store.spawnEnemy(slimeFastSpec({ x: 0.5, y: 0 }));
    store.player()!.velocity.vx = 0;
    store.player()!.velocity.vy = 0;
    enemy.velocity.vx = 0;
    enemy.velocity.vy = 0;

    combat.tick(makeInput(), store, index, 0, ARENA, () => {});

    if (enemy.knockback === null) throw new Error('expected knockback');
    const speed = Math.hypot(enemy.knockback.vx, enemy.knockback.vy);
    expect(speed).toBeCloseTo(SLIME_FAST.knockbackBaseImpulse, 10);
  });

  it('approach speed adds knockbackVelocityScale * approach to base impulse', () => {
    const { store, index, combat } = setupContact();
    const enemy = store.spawnEnemy(slimeFastSpec({ x: 0.5, y: 0 }));
    store.player()!.velocity.vx = 3;
    enemy.velocity.vx = -2;

    combat.tick(makeInput(), store, index, 0, ARENA, () => {});

    if (enemy.knockback === null) throw new Error('expected knockback');
    const speed = Math.hypot(enemy.knockback.vx, enemy.knockback.vy);
    const expected = SLIME_FAST.knockbackBaseImpulse + SLIME_FAST.knockbackVelocityScale * 5;
    expect(speed).toBeCloseTo(expected, 10);
  });

  it('repeated contact (after cooldown) overwrites knockback rather than summing', () => {
    const { store, index, combat } = setupContact();
    const enemy = store.spawnEnemy(slimeFastSpec({ x: 0.5, y: 0 }));

    combat.tick(makeInput(), store, index, 0, ARENA, () => {});
    if (enemy.knockback === null) throw new Error('expected knockback');
    const firstSpeed = Math.hypot(enemy.knockback.vx, enemy.knockback.vy);

    combat.tick(makeInput(), store, index, SLIME_FAST.contactCooldownMs, ARENA, () => {});
    if (enemy.knockback === null) throw new Error('expected knockback');
    const secondSpeed = Math.hypot(enemy.knockback.vx, enemy.knockback.vy);
    expect(secondSpeed).toBeCloseTo(firstSpeed, 10);
    expect(enemy.knockback.startSimMs).toBe(SLIME_FAST.contactCooldownMs);
  });
});
