import { describe, expect, it } from 'vitest';

import { PISTOL } from '../shared/content/weapons';
import type { RuntimeEvent } from '../shared/events';
import type { ArenaConfig } from '../shared/session';
import { SIM_STEP_MS } from '../shared/timing';

import { createCombatSystem } from './CombatSystem';
import { createEntityStore, type EnemySpawnSpec, type EntityId } from './EntityStore';
import { createRuntimeInputState, type RuntimeInputState } from './RuntimeInputState';
import { createSpatialIndex } from './SpatialIndex';

const ARENA: ArenaConfig = { width: 32, height: 18 };
const PLAYER_SPEC = {
  position: { x: 0, y: 0 },
  radius: 0.5,
  contactBox: { width: 1.2, height: 2 },
  maxSpeed: 6,
  maxHp: 1
};
const STATIONARY_TEST_ENEMY = {
  archetypeId: 'test-stationary-enemy',
  radius: 0.6,
  contactBox: { width: 1.2, height: 1.2 },
  behavior: 'stationary',
  maxHp: 3,
  maxSpeed: 0,
  contactDamage: 0,
  contactCooldownMs: 1,
  knockbackBaseImpulse: 0,
  knockbackVelocityScale: 0,
  knockbackDurationMs: 1,
  color: 0xff7766
} as const;
const CONTACT_TEST_ENEMY = {
  archetypeId: 'test-contact-enemy',
  radius: 0.4,
  contactBox: { width: 1.4, height: 0.4 },
  behavior: 'chase',
  maxHp: 1,
  maxSpeed: 4,
  contactDamage: 1,
  contactCooldownMs: 800,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  color: 0x77ff99
} as const;

function stationaryEnemySpec(position: { x: number; y: number }): EnemySpawnSpec {
  return {
    archetypeId: STATIONARY_TEST_ENEMY.archetypeId,
    position,
    radius: STATIONARY_TEST_ENEMY.radius,
    contactBox: STATIONARY_TEST_ENEMY.contactBox,
    behavior: STATIONARY_TEST_ENEMY.behavior,
    maxHp: STATIONARY_TEST_ENEMY.maxHp,
    maxSpeed: STATIONARY_TEST_ENEMY.maxSpeed,
    contactDamage: STATIONARY_TEST_ENEMY.contactDamage,
    contactCooldownMs: STATIONARY_TEST_ENEMY.contactCooldownMs,
    knockbackBaseImpulse: STATIONARY_TEST_ENEMY.knockbackBaseImpulse,
    knockbackVelocityScale: STATIONARY_TEST_ENEMY.knockbackVelocityScale,
    knockbackDurationMs: STATIONARY_TEST_ENEMY.knockbackDurationMs,
    color: STATIONARY_TEST_ENEMY.color
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
    const enemy = store.spawnEnemy(stationaryEnemySpec({ x: 0.75, y: 0 }));
    const input = makeInput({ aimWorld: { x: 5, y: 0 }, firing: true });
    const events: RuntimeEvent[] = [];

    const intents = combat.tick(input, store, index, 0, ARENA, (e) => events.push(e));

    expect(intents).toHaveLength(1);
    expect(intents[0]?.targetId).toBe(enemy.id);
    expect(intents[0]?.amount).toBe(PISTOL.damage);
    expect(intents[0]?.source.kind).toBe('projectile');
    if (intents[0]?.source.kind !== 'projectile') throw new Error('expected projectile source');
    expect(intents[0].source.impactDirX).toBeCloseTo(1);
    expect(intents[0].source.impactDirY).toBeCloseTo(0);
    const hitEvents = events.filter((e) => e.kind === 'hit');
    expect(hitEvents).toHaveLength(1);
    const hit = hitEvents[0]!;
    if (hit.kind !== 'hit') throw new Error('expected hit event');
    expect(hit.targetArchetypeId).toBe(STATIONARY_TEST_ENEMY.archetypeId);
    expect(hit.impactDirX).toBeCloseTo(1);
    expect(hit.impactDirY).toBeCloseTo(0);
    expect(store.projectileCount()).toBe(0);
  });

  it('hits an enemy by contactBox even when the legacy radius would miss', () => {
    const { store, index, combat } = setupCombat();
    const enemy = store.spawnEnemy({
      ...stationaryEnemySpec({ x: 0.85, y: 0 }),
      radius: 0.3,
      contactBox: { width: 1.4, height: 0.4 }
    });
    const input = makeInput({ aimWorld: { x: 5, y: 0 }, firing: true });

    const intents = combat.tick(input, store, index, 0, ARENA, () => {});

    expect(intents).toHaveLength(1);
    expect(intents[0]?.targetId).toBe(enemy.id);
    expect(intents[0]?.source.kind).toBe('projectile');
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
    store.spawnEnemy(stationaryEnemySpec({ x: 0.5, y: 0 }));
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

  it('hits the player by contactBox for enemy projectiles even outside the player radius', () => {
    const { store, index, combat, player } = setupCombat();
    const events: RuntimeEvent[] = [];
    store.spawnProjectile({
      weaponArchetypeId: PISTOL.id,
      ownerKind: 'enemy',
      position: {
        x: player.position.x + player.contactBox.width / 2 - 0.01,
        y: player.position.y + player.contactBox.height / 2 - 0.08
      },
      velocity: { vx: 0, vy: 0 },
      radius: PISTOL.projectileRadius,
      damage: PISTOL.damage,
      expireAtSimMs: 10_000
    });

    const intents = combat.tick(makeInput(), store, index, SIM_STEP_MS, ARENA, (e) =>
      events.push(e)
    );

    expect(intents).toHaveLength(1);
    expect(intents[0]?.targetId).toBe(player.id);
    expect(intents[0]?.source.kind).toBe('projectile');
    if (intents[0]?.source.kind !== 'projectile') throw new Error('expected projectile source');
    expect(intents[0].source.impactDirX).toBeCloseTo(1);
    expect(intents[0].source.impactDirY).toBeCloseTo(0);
    const hit = events.find((e) => e.kind === 'hit');
    if (hit?.kind !== 'hit') throw new Error('expected hit event');
    expect(hit.targetArchetypeId).toBeNull();
    expect(store.projectileCount()).toBe(0);
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
  function contactEnemySpec(position: { x: number; y: number }): EnemySpawnSpec {
    return {
      archetypeId: CONTACT_TEST_ENEMY.archetypeId,
      position,
      radius: CONTACT_TEST_ENEMY.radius,
      contactBox: CONTACT_TEST_ENEMY.contactBox,
      behavior: CONTACT_TEST_ENEMY.behavior,
      maxHp: CONTACT_TEST_ENEMY.maxHp,
      maxSpeed: CONTACT_TEST_ENEMY.maxSpeed,
      contactDamage: CONTACT_TEST_ENEMY.contactDamage,
      contactCooldownMs: CONTACT_TEST_ENEMY.contactCooldownMs,
      knockbackBaseImpulse: CONTACT_TEST_ENEMY.knockbackBaseImpulse,
      knockbackVelocityScale: CONTACT_TEST_ENEMY.knockbackVelocityScale,
      knockbackDurationMs: CONTACT_TEST_ENEMY.knockbackDurationMs,
      color: CONTACT_TEST_ENEMY.color
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
    const enemy = store.spawnEnemy(contactEnemySpec({ x: 1.2, y: 0.9 }));

    const intents = combat.tick(makeInput(), store, index, 0, ARENA, () => {});

    expect(intents).toHaveLength(1);
    const intent = intents[0]!;
    expect(intent.targetId).toBe(store.player()!.id);
    expect(intent.amount).toBe(CONTACT_TEST_ENEMY.contactDamage);
    if (intent.source.kind !== 'enemyContact') throw new Error('expected enemyContact source');
    expect(intent.source.enemyId).toBe(enemy.id);
  });

  it('does not emit a runtime event for the contact', () => {
    const { store, index, combat } = setupContact();
    store.spawnEnemy(contactEnemySpec({ x: 1.2, y: 0.9 }));
    const events: RuntimeEvent[] = [];

    combat.tick(makeInput(), store, index, 0, ARENA, (e) => events.push(e));

    expect(events).toHaveLength(0);
  });

  it('skips contact if cooldown not elapsed and re-fires once it does', () => {
    const { store, index, combat } = setupContact();
    store.spawnEnemy(contactEnemySpec({ x: 1.2, y: 0.9 }));

    const first = combat.tick(makeInput(), store, index, 0, ARENA, () => {});
    expect(first).toHaveLength(1);

    const mid = combat.tick(
      makeInput(),
      store,
      index,
      CONTACT_TEST_ENEMY.contactCooldownMs - 1,
      ARENA,
      () => {}
    );
    expect(mid).toHaveLength(0);

    const after = combat.tick(
      makeInput(),
      store,
      index,
      CONTACT_TEST_ENEMY.contactCooldownMs,
      ARENA,
      () => {}
    );
    expect(after).toHaveLength(1);
  });

  it('skips enemies with contactDamage === 0', () => {
    const { store, index, combat } = setupContact();
    store.spawnEnemy({
      archetypeId: STATIONARY_TEST_ENEMY.archetypeId,
      position: { x: 0.5, y: 0 },
      radius: STATIONARY_TEST_ENEMY.radius,
      contactBox: STATIONARY_TEST_ENEMY.contactBox,
      behavior: STATIONARY_TEST_ENEMY.behavior,
      maxHp: STATIONARY_TEST_ENEMY.maxHp,
      maxSpeed: STATIONARY_TEST_ENEMY.maxSpeed,
      contactDamage: 0,
      contactCooldownMs: STATIONARY_TEST_ENEMY.contactCooldownMs,
      knockbackBaseImpulse: STATIONARY_TEST_ENEMY.knockbackBaseImpulse,
      knockbackVelocityScale: STATIONARY_TEST_ENEMY.knockbackVelocityScale,
      knockbackDurationMs: STATIONARY_TEST_ENEMY.knockbackDurationMs,
      color: STATIONARY_TEST_ENEMY.color
    });

    const intents = combat.tick(makeInput(), store, index, 0, ARENA, () => {});
    expect(intents).toHaveLength(0);
  });

  it('is a no-op when no player is spawned', () => {
    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem();
    store.spawnEnemy(contactEnemySpec({ x: 0, y: 0 }));

    expect(() => combat.tick(makeInput(), store, index, 0, ARENA, () => {})).not.toThrow();
  });

  it('knocks the enemy back along (enemy - player) and writes a positive duration', () => {
    const { store, index, combat } = setupContact();
    const enemy = store.spawnEnemy(contactEnemySpec({ x: 1.2, y: 0.9 }));

    combat.tick(makeInput(), store, index, 0, ARENA, () => {});

    expect(enemy.knockback).not.toBeNull();
    if (enemy.knockback === null) throw new Error('unreachable');
    expect(enemy.knockback.vx).toBeGreaterThan(0);
    expect(enemy.knockback.vy).toBeGreaterThan(0);
    expect(enemy.knockback.endSimMs - enemy.knockback.startSimMs).toBe(
      CONTACT_TEST_ENEMY.knockbackDurationMs
    );
  });

  it('with zero approach speed the knockback magnitude equals knockbackBaseImpulse', () => {
    const { store, index, combat } = setupContact();
    const enemy = store.spawnEnemy(contactEnemySpec({ x: 1.2, y: 0.9 }));
    store.player()!.velocity.vx = 0;
    store.player()!.velocity.vy = 0;
    enemy.velocity.vx = 0;
    enemy.velocity.vy = 0;

    combat.tick(makeInput(), store, index, 0, ARENA, () => {});

    if (enemy.knockback === null) throw new Error('expected knockback');
    const speed = Math.hypot(enemy.knockback.vx, enemy.knockback.vy);
    expect(speed).toBeCloseTo(CONTACT_TEST_ENEMY.knockbackBaseImpulse, 10);
  });

  it('approach speed adds knockbackVelocityScale * approach to base impulse', () => {
    const { store, index, combat } = setupContact();
    const enemy = store.spawnEnemy(contactEnemySpec({ x: 1.2, y: 0.9 }));
    store.player()!.velocity.vx = 3;
    enemy.velocity.vx = -2;

    combat.tick(makeInput(), store, index, 0, ARENA, () => {});

    if (enemy.knockback === null) throw new Error('expected knockback');
    const speed = Math.hypot(enemy.knockback.vx, enemy.knockback.vy);
    const expected =
      CONTACT_TEST_ENEMY.knockbackBaseImpulse + CONTACT_TEST_ENEMY.knockbackVelocityScale * 4;
    expect(speed).toBeCloseTo(expected, 10);
  });

  it('repeated contact (after cooldown) overwrites knockback rather than summing', () => {
    const { store, index, combat } = setupContact();
    const enemy = store.spawnEnemy(contactEnemySpec({ x: 1.2, y: 0.9 }));

    combat.tick(makeInput(), store, index, 0, ARENA, () => {});
    if (enemy.knockback === null) throw new Error('expected knockback');
    const firstSpeed = Math.hypot(enemy.knockback.vx, enemy.knockback.vy);

    combat.tick(makeInput(), store, index, CONTACT_TEST_ENEMY.contactCooldownMs, ARENA, () => {});
    if (enemy.knockback === null) throw new Error('expected knockback');
    const secondSpeed = Math.hypot(enemy.knockback.vx, enemy.knockback.vy);
    expect(secondSpeed).toBeCloseTo(firstSpeed, 10);
    expect(enemy.knockback.startSimMs).toBe(CONTACT_TEST_ENEMY.contactCooldownMs);
  });
});
