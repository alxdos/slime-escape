import { describe, expect, it } from 'vitest';

import type { BossArchetype } from '../content/bosses';
import type { EnemyArchetype } from '../content/enemies';
import { createRng } from '../rng';
import type { ArenaConfig, EncounterDefinition, Loadout, WaveSpawn } from '../session';
import { SIM_STEP_MS } from '../timing';

import { createEntityStore } from './EntityStore';
import { createSpawnSystem } from './SpawnSystem';

const ARENA: ArenaConfig = { width: 32, height: 18 };
function squareContactBox(radius: number) {
  return { width: radius * 2, height: radius * 2 };
}

const STATIONARY_TEST_ENEMY: EnemyArchetype = {
  id: 'test-stationary-enemy',
  displayName: 'Test Stationary Enemy',
  radius: 0.6,
  contactBox: squareContactBox(0.6),
  maxHp: 3,
  behavior: 'stationary',
  maxSpeed: 0,
  contactDamage: 0,
  contactCooldownMs: 1,
  knockbackBaseImpulse: 0,
  knockbackVelocityScale: 0,
  knockbackDurationMs: 1,
  color: 0xff7766,
  dropTable: [],
  retaliation: { enabled: false, durationMs: 0 }
};
const FAST_TEST_ENEMY: EnemyArchetype = {
  ...STATIONARY_TEST_ENEMY,
  id: 'test-fast-enemy',
  displayName: 'Test Fast Enemy',
  radius: 0.4,
  contactBox: squareContactBox(0.4),
  maxHp: 1,
  behavior: 'chase',
  maxSpeed: 4,
  contactDamage: 1,
  contactCooldownMs: 800,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350
};
const TANK_TEST_ENEMY: EnemyArchetype = {
  ...STATIONARY_TEST_ENEMY,
  id: 'test-tank-enemy',
  displayName: 'Test Tank Enemy',
  radius: 0.65,
  contactBox: squareContactBox(0.65),
  maxHp: 5,
  behavior: 'chase',
  maxSpeed: 1.7,
  contactDamage: 2,
  contactCooldownMs: 1000,
  knockbackBaseImpulse: 3,
  knockbackVelocityScale: 0.5,
  knockbackDurationMs: 220
};
const TEST_BOSS: BossArchetype = {
  id: 'test-boss',
  displayName: 'Test Boss',
  radius: 1.35,
  contactBox: squareContactBox(1.35),
  maxHp: 40,
  maxSpeed: 3,
  color: 0xaa44ff,
  contactDamage: 2,
  contactCooldownMs: 800,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 0.4,
  knockbackDurationMs: 220,
  phases: [
    {
      id: 'crown-intact',
      allowedAttackIds: ['coneBurst', 'spawnAdds'],
      exitWhenHpFractionAtOrBelow: 0.55
    },
    {
      id: 'desperation',
      allowedAttackIds: ['coneBurst', 'dashSlam'],
      exitWhenHpFractionAtOrBelow: 0
    }
  ],
  attacks: {
    coneBurst: { pattern: 'coneBurst', cooldownMs: 1400, damage: 2 },
    spawnAdds: { pattern: 'spawnAdds', cooldownMs: 3500, damage: 0 },
    dashSlam: { pattern: 'dashSlam', cooldownMs: 1800, damage: 4 }
  }
};

const ENEMY_REGISTRY: Readonly<Record<string, EnemyArchetype>> = {
  [STATIONARY_TEST_ENEMY.id]: STATIONARY_TEST_ENEMY,
  [FAST_TEST_ENEMY.id]: FAST_TEST_ENEMY,
  [TANK_TEST_ENEMY.id]: TANK_TEST_ENEMY
};
const BOSS_REGISTRY: Readonly<Record<string, BossArchetype>> = {
  [TEST_BOSS.id]: TEST_BOSS
};
const TEST_LOADOUT: Loadout = { weapons: ['pistol'], selectedIndex: 0 };

function makeEncounter(
  plan: EncounterDefinition['spawnPlan'],
  overrides: Readonly<{
    introDurationMs?: number;
  }> = {}
): EncounterDefinition {
  return {
    id: 'test-encounter',
    type: 'sandbox',
    backgroundId: null,
    introDurationMs: overrides.introDurationMs ?? 0,
    name: null,
    text: null,
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
    const spawn = createSpawnSystem({ enemyRegistry: ENEMY_REGISTRY, bossRegistry: BOSS_REGISTRY });
    spawn.onEncounterStart(makeEncounter({ kind: 'empty' }), store, ARENA, 0);

    expect(store.enemyCount()).toBe(0);
  });

  it("'static' plan resolves archetype by id and spawns enemies via the store", () => {
    const store = createEntityStore();
    const spawn = createSpawnSystem({ enemyRegistry: ENEMY_REGISTRY, bossRegistry: BOSS_REGISTRY });
    spawn.onEncounterStart(
      makeEncounter({
        kind: 'static',
        spawns: [
          { archetypeId: STATIONARY_TEST_ENEMY.id, position: { x: 5, y: 0 } },
          { archetypeId: STATIONARY_TEST_ENEMY.id, position: { x: -3, y: 2 } }
        ]
      }),
      store,
      ARENA,
      0
    );

    expect(store.enemyCount()).toBe(2);
    const positions = [...store.enemies()].map((e) => e.position);
    expect(positions).toEqual([
      { x: 5, y: 0 },
      { x: -3, y: 2 }
    ]);
    for (const enemy of store.enemies()) {
      expect(enemy.archetypeId).toBe(STATIONARY_TEST_ENEMY.id);
      expect(enemy.maxHp).toBe(STATIONARY_TEST_ENEMY.maxHp);
      expect(enemy.hp).toBe(STATIONARY_TEST_ENEMY.maxHp);
      expect(enemy.radius).toBe(STATIONARY_TEST_ENEMY.radius);
      expect(enemy.behavior).toBe(STATIONARY_TEST_ENEMY.behavior);
    }
  });

  it("'static' plan waits until encounter intro has finished before spawning once", () => {
    const store = createEntityStore();
    const spawn = createSpawnSystem({ enemyRegistry: ENEMY_REGISTRY, bossRegistry: BOSS_REGISTRY });
    const plan: EncounterDefinition['spawnPlan'] = {
      kind: 'static',
      spawns: [{ archetypeId: STATIONARY_TEST_ENEMY.id, position: { x: 5, y: 0 } }]
    };
    spawn.onEncounterStart(makeEncounter(plan, { introDurationMs: 100 }), store, ARENA, 1000);

    expect(store.enemyCount()).toBe(0);
    spawn.onTick(1099, store);
    expect(store.enemyCount()).toBe(0);
    spawn.onTick(1100, store);
    expect(store.enemyCount()).toBe(1);
    spawn.onTick(1200, store);
    expect(store.enemyCount()).toBe(1);
  });

  it('throws on unknown archetypeId', () => {
    const store = createEntityStore();
    const spawn = createSpawnSystem({ enemyRegistry: ENEMY_REGISTRY, bossRegistry: BOSS_REGISTRY });

    expect(() =>
      spawn.onEncounterStart(
        makeEncounter({
          kind: 'static',
          spawns: [{ archetypeId: 'no-such-thing', position: { x: 0, y: 0 } }]
        }),
        store,
        ARENA,
        0
      )
    ).toThrow(/unknown enemy archetype/);
  });

  it('applies static spawn override as runtime enemy fields', () => {
    const store = createEntityStore();
    const spawn = createSpawnSystem({ enemyRegistry: ENEMY_REGISTRY, bossRegistry: BOSS_REGISTRY });
    spawn.onEncounterStart(
      makeEncounter({
        kind: 'static',
        spawns: [
          {
            archetypeId: STATIONARY_TEST_ENEMY.id,
            position: { x: 0, y: 0 },
            override: {
              guaranteedDrops: ['magnet'],
              dropTable: [{ archetypeId: 'heal-orb', chance: 0.25 }],
              retaliation: { enabled: true, durationMs: 2500 }
            }
          }
        ]
      }),
      store,
      ARENA,
      0
    );

    const enemy = [...store.enemies()][0]!;
    expect(enemy.guaranteedDrops).toEqual(['magnet']);
    expect(enemy.dropTable).toEqual([{ archetypeId: 'heal-orb', chance: 0.25 }]);
    expect(enemy.retaliation).toEqual({ enabled: true, durationMs: 2500 });
    expect(enemy.carrierDropMarker).toBe('reward');
  });

  it('notifies static spawn override loadout with enemy id and encounter start time', () => {
    const store = createEntityStore();
    const observed: Array<{ enemyId: number; loadout: Loadout; simTimeMs: number }> = [];
    const spawn = createSpawnSystem({
      enemyRegistry: ENEMY_REGISTRY,
      bossRegistry: BOSS_REGISTRY,
      onEnemySpawned(enemyId, loadout, simTimeMs) {
        observed.push({ enemyId, loadout, simTimeMs });
      }
    });
    spawn.onEncounterStart(
      makeEncounter({
        kind: 'static',
        spawns: [
          {
            archetypeId: STATIONARY_TEST_ENEMY.id,
            position: { x: 0, y: 0 },
            override: { loadout: TEST_LOADOUT }
          }
        ]
      }),
      store,
      ARENA,
      1234
    );

    const enemy = [...store.enemies()][0]!;
    expect(observed).toEqual([{ enemyId: enemy.id, loadout: TEST_LOADOUT, simTimeMs: 1234 }]);
  });

  it('rejects unknown SpawnPlan.kind via assertNever', () => {
    const store = createEntityStore();
    const spawn = createSpawnSystem({ enemyRegistry: ENEMY_REGISTRY, bossRegistry: BOSS_REGISTRY });
    const bogus = { kind: 'unknown-kind' } as unknown as EncounterDefinition['spawnPlan'];

    expect(() => spawn.onEncounterStart(makeEncounter(bogus), store, ARENA, 0)).toThrow(
      /unexpected value/
    );
  });
});

describe('SpawnSystem wave', () => {
  function setupWave(opts?: {
    spawns?: ReadonlyArray<WaveSpawn>;
    spawnIntervalMs?: number;
    maxAlive?: number;
    edgeMargin?: number;
    seed?: number;
    introDurationMs?: number;
    startSimMs?: number;
  }) {
    const store = createEntityStore();
    const spawn = createSpawnSystem({ enemyRegistry: ENEMY_REGISTRY, bossRegistry: BOSS_REGISTRY });
    spawn.setRng(createRng(opts?.seed ?? 1));
    const plan: EncounterDefinition['spawnPlan'] = {
      kind: 'wave',
      spawns: opts?.spawns ?? [
        { archetypeId: FAST_TEST_ENEMY.id },
        { archetypeId: FAST_TEST_ENEMY.id },
        { archetypeId: TANK_TEST_ENEMY.id },
        { archetypeId: FAST_TEST_ENEMY.id }
      ],
      spawnIntervalMs: opts?.spawnIntervalMs ?? 100,
      maxAlive: opts?.maxAlive ?? 10,
      edgeMargin: opts?.edgeMargin ?? 0
    };
    spawn.onEncounterStart(
      makeEncounter(plan, { introDurationMs: opts?.introDurationMs }),
      store,
      ARENA,
      opts?.startSimMs ?? 0
    );
    return { store, spawn, plan };
  }

  it('spawns the first enemy on the very first tick (lastSpawnSimMs = -inf)', () => {
    const { store, spawn } = setupWave();
    spawn.onTick(0, store);
    expect(store.enemyCount()).toBe(1);
  });

  it('does not advance wave state until encounter intro has finished', () => {
    const { store, spawn } = setupWave({
      introDurationMs: 100,
      spawnIntervalMs: 100,
      startSimMs: 1000
    });

    spawn.onTick(1099, store);
    expect(store.enemyCount()).toBe(0);
    expect(spawn.waveProgress()).toEqual({ dispatched: 0, total: 4, alive: 0 });

    spawn.onTick(1100, store);
    expect(store.enemyCount()).toBe(1);
    expect(spawn.waveProgress()).toEqual({ dispatched: 1, total: 4, alive: 1 });

    spawn.onTick(1199, store);
    expect(store.enemyCount()).toBe(1);
    spawn.onTick(1200, store);
    expect(store.enemyCount()).toBe(2);
  });

  it('applies wave spawn override to the dispatched enemy', () => {
    const { store, spawn } = setupWave({
      spawns: [
        {
          archetypeId: FAST_TEST_ENEMY.id,
          override: {
            guaranteedDrops: ['size-up'],
            dropTable: [],
            retaliation: { enabled: true, durationMs: 900 }
          }
        }
      ]
    });
    spawn.onTick(0, store);

    const enemy = [...store.enemies()][0]!;
    expect(enemy.guaranteedDrops).toEqual(['size-up']);
    expect(enemy.dropTable).toEqual([]);
    expect(enemy.retaliation).toEqual({ enabled: true, durationMs: 900 });
    expect(enemy.carrierDropMarker).toBe('reward');
  });

  it('notifies wave spawn override loadout with enemy id and tick time', () => {
    const store = createEntityStore();
    const observed: Array<{ enemyId: number; loadout: Loadout; simTimeMs: number }> = [];
    const spawn = createSpawnSystem({
      enemyRegistry: ENEMY_REGISTRY,
      bossRegistry: BOSS_REGISTRY,
      onEnemySpawned(enemyId, loadout, simTimeMs) {
        observed.push({ enemyId, loadout, simTimeMs });
      }
    });
    spawn.setRng(createRng(1));
    spawn.onEncounterStart(
      makeEncounter({
        kind: 'wave',
        spawns: [
          {
            archetypeId: FAST_TEST_ENEMY.id,
            override: { loadout: TEST_LOADOUT }
          }
        ],
        spawnIntervalMs: 0,
        maxAlive: 1
      }),
      store,
      ARENA,
      0
    );

    spawn.onTick(4567, store);

    const enemy = [...store.enemies()][0]!;
    expect(observed).toEqual([{ enemyId: enemy.id, loadout: TEST_LOADOUT, simTimeMs: 4567 }]);
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
      spawns: [{ archetypeId: FAST_TEST_ENEMY.id }, { archetypeId: TANK_TEST_ENEMY.id }],
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
      spawns: [{ archetypeId: FAST_TEST_ENEMY.id }, { archetypeId: FAST_TEST_ENEMY.id }],
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
    const spawn = createSpawnSystem({ enemyRegistry: ENEMY_REGISTRY, bossRegistry: BOSS_REGISTRY });
    spawn.onEncounterStart(
      makeEncounter({
        kind: 'wave',
        spawns: [{ archetypeId: FAST_TEST_ENEMY.id }],
        spawnIntervalMs: 0,
        maxAlive: 1
      }),
      store,
      ARENA,
      0
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
    const spawn = createSpawnSystem({ enemyRegistry: ENEMY_REGISTRY, bossRegistry: BOSS_REGISTRY });
    spawn.onEncounterStart(
      makeEncounter({
        kind: 'boss',
        bossArchetypeId: TEST_BOSS.id,
        position: { x: 2, y: -1 }
      }),
      store,
      ARENA,
      0
    );

    expect(store.bossCount()).toBe(1);
    expect(spawn.waveProgress()).toEqual({ dispatched: 1, total: 1, alive: 1 });
    const boss = [...store.bosses()][0]!;
    expect(boss.archetypeId).toBe(TEST_BOSS.id);
    expect(boss.position).toEqual({ x: 2, y: -1 });

    spawn.onBossDeath(boss.id);
    expect(spawn.waveProgress()).toEqual({ dispatched: 1, total: 1, alive: 0 });

    spawn.onEncounterEnd(makeEncounter({ kind: 'empty' }));
    expect(spawn.waveProgress()).toBeNull();
  });

  it('throws on unknown boss archetype id', () => {
    const store = createEntityStore();
    const spawn = createSpawnSystem({ enemyRegistry: ENEMY_REGISTRY, bossRegistry: BOSS_REGISTRY });

    expect(() =>
      spawn.onEncounterStart(
        makeEncounter({
          kind: 'boss',
          bossArchetypeId: 'no-such-boss',
          position: { x: 0, y: 0 }
        }),
        store,
        ARENA,
        0
      )
    ).toThrow(/unknown boss archetype/);
  });
});
