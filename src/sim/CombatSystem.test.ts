import { describe, expect, it } from 'vitest';

import { TRAINING_TARGET } from '../shared/content/enemies';
import { PISTOL } from '../shared/content/weapons';
import type { RuntimeEvent } from '../shared/events';
import type { ArenaConfig } from '../shared/session';
import { SIM_STEP_MS } from '../shared/timing';

import { createCombatSystem } from './CombatSystem';
import { createEntityStore, type EntityId } from './EntityStore';
import { createRuntimeInputState, type RuntimeInputState } from './RuntimeInputState';
import { createSpatialIndex } from './SpatialIndex';

const ARENA: ArenaConfig = { width: 32, height: 18 };
const PLAYER_SPEC = { position: { x: 0, y: 0 }, radius: 0.5, maxSpeed: 6 };

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
    const enemy = store.spawnEnemy({
      archetypeId: TRAINING_TARGET.id,
      position: { x: 1, y: 0 },
      radius: TRAINING_TARGET.radius,
      behavior: 'stationary',
      maxHp: TRAINING_TARGET.maxHp,
      color: TRAINING_TARGET.color
    });
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
    store.spawnEnemy({
      archetypeId: TRAINING_TARGET.id,
      position: { x: 0.5, y: 0 },
      radius: TRAINING_TARGET.radius,
      behavior: 'stationary',
      maxHp: TRAINING_TARGET.maxHp,
      color: TRAINING_TARGET.color
    });
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
