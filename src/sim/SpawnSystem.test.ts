import { describe, expect, it } from 'vitest';

import { SLIME_KING } from '../shared/content/bosses';
import {
  SLIME_FAST,
  SLIME_TANK,
  TRAINING_TARGET,
  type EnemyArchetype
} from '../shared/content/enemies';
import { createRng } from '../shared/rng';
import type { ArenaConfig, EncounterDefinition } from '../shared/session';
import { SIM_STEP_MS } from '../shared/timing';

import { createEntityStore } from './EntityStore';
import { createSpawnSystem } from './SpawnSystem';

const ARENA: ArenaConfig = { width: 32, height: 18 };

const REGISTRY: Readonly<Record<string, EnemyArchetype>> = {
  [TRAINING_TARGET.id]: TRAINING_TARGET,
  [SLIME_FAST.id]: SLIME_FAST,
  [SLIME_TANK.id]: SLIME_TANK
};

function makeEncounter(plan: EncounterDefinition['spawnPlan']): EncounterDefinition {
  return {
    id: 'test-encounter',
    type: 'sandbox',
    spawnPlan: plan,
    zoneBehavior: { kind: 'disabled' },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'never', next: 'sequential' },
    tuning: null
  };
}

describe('SpawnSystem static / empty', () => {
  it("'empty' plan spawns nothing", () => {
    const store = createEntityStore();
    const spawn = createSpawnSystem(REGISTRY);
    spawn.onEncounterStart(makeEncounter({ kind: 'empty' }), store, ARENA);

    expect(store.enemyCount()).toBe(0);
  });

  it("'static' plan resolves archetype by id and spawns enemies via the store", () => {
    const store = createEntityStore();
    const spawn = createSpawnSystem(REGISTRY);
    spawn.onEncounterStart(
      makeEncounter({
        kind: 'static',
        spawns: [
          { archetypeId: TRAINING_TARGET.id, position: { x: 5, y: 0 } },
          { archetypeId: TRAINING_TARGET.id, position: { x: -3, y: 2 } }
        ]
      }),
      store,
      ARENA
    );

    expect(store.enemyCount()).toBe(2);
    const positions = [...store.enemies()].map((e) => e.position);
    expect(positions).toEqual([
      { x: 5, y: 0 },
      { x: -3, y: 2 }
    ]);
    for (const enemy of store.enemies()) {
      expect(enemy.archetypeId).toBe(TRAINING_TARGET.id);
      expect(enemy.maxHp).toBe(TRAINING_TARGET.maxHp);
      expect(enemy.hp).toBe(TRAINING_TARGET.maxHp);
      expect(enemy.radius).toBe(TRAINING_TARGET.radius);
      expect(enemy.behavior).toBe(TRAINING_TARGET.behavior);
    }
  });

  it('throws on unknown archetypeId', () => {
    const store = createEntityStore();
    const spawn = createSpawnSystem(REGISTRY);

    expect(() =>
      spawn.onEncounterStart(
        makeEncounter({
          kind: 'static',
          spawns: [{ archetypeId: 'no-such-thing', position: { x: 0, y: 0 } }]
        }),
        store,
        ARENA
      )
    ).toThrow(/unknown enemy archetype/);
  });

  it('rejects unknown SpawnPlan.kind via assertNever', () => {
    const store = createEntityStore();
    const spawn = createSpawnSystem(REGISTRY);
    const bogus = { kind: 'unknown-kind' } as unknown as EncounterDefinition['spawnPlan'];

    expect(() => spawn.onEncounterStart(makeEncounter(bogus), store, ARENA)).toThrow(
      /unexpected value/
    );
  });
});

describe('SpawnSystem wave', () => {
  function setupWave(opts?: {
    spawns?: ReadonlyArray<{ archetypeId: string }>;
    spawnIntervalMs?: number;
    maxAlive?: number;
    edgeMargin?: number;
    seed?: number;
  }) {
    const store = createEntityStore();
    const spawn = createSpawnSystem(REGISTRY);
    spawn.setRng(createRng(opts?.seed ?? 1));
    const plan: EncounterDefinition['spawnPlan'] = {
      kind: 'wave',
      spawns: opts?.spawns ?? [
        { archetypeId: SLIME_FAST.id },
        { archetypeId: SLIME_FAST.id },
        { archetypeId: SLIME_TANK.id },
        { archetypeId: SLIME_FAST.id }
      ],
      spawnIntervalMs: opts?.spawnIntervalMs ?? 100,
      maxAlive: opts?.maxAlive ?? 10,
      edgeMargin: opts?.edgeMargin ?? 0
    };
    spawn.onEncounterStart(makeEncounter(plan), store, ARENA);
    return { store, spawn, plan };
  }

  it('spawns the first enemy on the very first tick (lastSpawnSimMs = -inf)', () => {
    const { store, spawn } = setupWave();
    spawn.onTick(0, store);
    expect(store.enemyCount()).toBe(1);
  });

  it('spawns at most one enemy per tick', () => {
    const { store, spawn } = setupWave({ spawnIntervalMs: 0 });
    spawn.onTick(0, store);
    expect(store.enemyCount()).toBe(1);
    spawn.onTick(SIM_STEP_MS, store);
    expect(store.enemyCount()).toBe(2);
  });

  it('honours spawnIntervalMs between consecutive spawns', () => {
    const { store, spawn } = setupWave({ spawnIntervalMs: 500 });
    spawn.onTick(0, store);
    expect(store.enemyCount()).toBe(1);
    spawn.onTick(100, store);
    expect(store.enemyCount()).toBe(1);
    spawn.onTick(499, store);
    expect(store.enemyCount()).toBe(1);
    spawn.onTick(500, store);
    expect(store.enemyCount()).toBe(2);
  });

  it('respects maxAlive: stops spawning when limit is reached, resumes on death', () => {
    const { store, spawn } = setupWave({ maxAlive: 2, spawnIntervalMs: 0 });
    spawn.onTick(0, store);
    spawn.onTick(SIM_STEP_MS, store);
    expect(store.enemyCount()).toBe(2);
    spawn.onTick(2 * SIM_STEP_MS, store);
    expect(store.enemyCount()).toBe(2);

    const first = [...store.enemies()][0]!;
    store.removeEnemy(first.id);
    spawn.onEnemyDeath(first.id);

    spawn.onTick(3 * SIM_STEP_MS, store);
    expect(store.enemyCount()).toBe(2);
  });

  it('stops dispatching once spawns budget is exhausted', () => {
    const { store, spawn } = setupWave({
      spawns: [{ archetypeId: SLIME_FAST.id }, { archetypeId: SLIME_TANK.id }],
      spawnIntervalMs: 0
    });
    spawn.onTick(0, store);
    spawn.onTick(SIM_STEP_MS, store);
    expect(store.enemyCount()).toBe(2);
    spawn.onTick(2 * SIM_STEP_MS, store);
    expect(store.enemyCount()).toBe(2);
    expect(spawn.waveProgress()).toEqual({ dispatched: 2, total: 2, alive: 2 });
  });

  it('waveProgress reflects dispatched/total/alive in real time', () => {
    const { store, spawn } = setupWave({
      spawns: [{ archetypeId: SLIME_FAST.id }, { archetypeId: SLIME_FAST.id }],
      spawnIntervalMs: 0
    });
    expect(spawn.waveProgress()).toEqual({ dispatched: 0, total: 2, alive: 0 });
    spawn.onTick(0, store);
    expect(spawn.waveProgress()).toEqual({ dispatched: 1, total: 2, alive: 1 });
    spawn.onTick(SIM_STEP_MS, store);
    expect(spawn.waveProgress()).toEqual({ dispatched: 2, total: 2, alive: 2 });

    const first = [...store.enemies()][0]!;
    spawn.onEnemyDeath(first.id);
    expect(spawn.waveProgress()).toEqual({ dispatched: 2, total: 2, alive: 1 });
  });

  it('places spawns inside the arena, deterministically per seed', () => {
    const halfW = ARENA.width / 2;
    const halfH = ARENA.height / 2;

    const a = setupWave({ seed: 12345, spawnIntervalMs: 0 });
    const b = setupWave({ seed: 12345, spawnIntervalMs: 0 });
    const positionsA: Array<{ x: number; y: number; id: string }> = [];
    const positionsB: Array<{ x: number; y: number; id: string }> = [];

    for (let t = 0; t < 4; t += 1) {
      a.spawn.onTick(t * SIM_STEP_MS, a.store);
      b.spawn.onTick(t * SIM_STEP_MS, b.store);
    }
    for (const e of a.store.enemies()) {
      positionsA.push({ x: e.position.x, y: e.position.y, id: e.archetypeId });
    }
    for (const e of b.store.enemies()) {
      positionsB.push({ x: e.position.x, y: e.position.y, id: e.archetypeId });
    }
    expect(positionsB).toEqual(positionsA);

    for (const p of positionsA) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(halfW);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(halfH);
    }
  });

  it('different seeds produce different first-spawn positions', () => {
    const a = setupWave({ seed: 1, spawnIntervalMs: 0 });
    const b = setupWave({ seed: 2, spawnIntervalMs: 0 });
    a.spawn.onTick(0, a.store);
    b.spawn.onTick(0, b.store);
    const first = (s: ReturnType<typeof setupWave>) => [...s.store.enemies()][0]!.position;
    expect(first(b)).not.toEqual(first(a));
  });

  it('throws on tick if RNG was not provided', () => {
    const store = createEntityStore();
    const spawn = createSpawnSystem(REGISTRY);
    spawn.onEncounterStart(
      makeEncounter({
        kind: 'wave',
        spawns: [{ archetypeId: SLIME_FAST.id }],
        spawnIntervalMs: 0,
        maxAlive: 1
      }),
      store,
      ARENA
    );
    expect(() => spawn.onTick(0, store)).toThrow(/Rng/);
  });

  it('onEncounterEnd clears wave state so onTick becomes a no-op', () => {
    const { store, spawn } = setupWave();
    spawn.onTick(0, store);
    expect(store.enemyCount()).toBe(1);

    spawn.onEncounterEnd(makeEncounter({ kind: 'empty' }));
    expect(spawn.waveProgress()).toBeNull();
    spawn.onTick(SIM_STEP_MS, store);
    expect(store.enemyCount()).toBe(1);
  });
});

describe('SpawnSystem boss', () => {
  it('boss plan spawns exactly one boss; waveProgress tracks alive until onBossDeath', () => {
    const store = createEntityStore();
    const spawn = createSpawnSystem(REGISTRY);
    spawn.onEncounterStart(
      makeEncounter({
        kind: 'boss',
        bossArchetypeId: SLIME_KING.id,
        position: { x: 2, y: -1 }
      }),
      store,
      ARENA
    );

    expect(store.bossCount()).toBe(1);
    expect(spawn.waveProgress()).toEqual({ dispatched: 1, total: 1, alive: 1 });
    const boss = [...store.bosses()][0]!;
    expect(boss.archetypeId).toBe(SLIME_KING.id);
    expect(boss.position).toEqual({ x: 2, y: -1 });

    spawn.onBossDeath(boss.id);
    expect(spawn.waveProgress()).toEqual({ dispatched: 1, total: 1, alive: 0 });

    spawn.onEncounterEnd(makeEncounter({ kind: 'empty' }));
    expect(spawn.waveProgress()).toBeNull();
  });

  it('throws on unknown boss archetype id', () => {
    const store = createEntityStore();
    const spawn = createSpawnSystem(REGISTRY);

    expect(() =>
      spawn.onEncounterStart(
        makeEncounter({
          kind: 'boss',
          bossArchetypeId: 'no-such-boss',
          position: { x: 0, y: 0 }
        }),
        store,
        ARENA
      )
    ).toThrow(/unknown boss archetype/);
  });
});
