import { BOSS_ARCHETYPES, type BossArchetype } from '../shared/content/bosses';
import { ENEMY_ARCHETYPES, type EnemyArchetype } from '../shared/content/enemies';
import { assertNever } from '../shared/protocol';
import type { Rng } from '../shared/rng';
import type {
  ArenaConfig,
  BossSpawnPlan,
  EncounterDefinition,
  StaticSpawnPlan,
  Vec2,
  WaveSpawnPlan
} from '../shared/session';
import type { WaveProgressSnapshot } from '../shared/snapshot';

import type { BossSpawnSpec, EnemySpawnSpec, EntityId, EntityStore } from './EntityStore';

export type SpawnSystem = Readonly<{
  setRng(rng: Rng | null): void;
  onEncounterStart(
    encounter: EncounterDefinition,
    store: EntityStore,
    arena: ArenaConfig
  ): void;
  onEncounterEnd(encounter: EncounterDefinition): void;
  onTick(simTimeMs: number, store: EntityStore): void;
  onEnemyDeath(entityId: EntityId): void;
  onBossDeath(entityId: EntityId): void;
  waveProgress(): WaveProgressSnapshot | null;
}>;

type WaveState = {
  plan: WaveSpawnPlan;
  arena: ArenaConfig;
  dispatched: number;
  lastSpawnSimMs: number;
  alive: Set<EntityId>;
};

type BossSpawnState = {
  plan: BossSpawnPlan;
  alive: Set<EntityId>;
};

export function createSpawnSystem(
  enemyRegistry: Readonly<Record<string, EnemyArchetype>> = ENEMY_ARCHETYPES,
  bossRegistry: Readonly<Record<string, BossArchetype>> = BOSS_ARCHETYPES
): SpawnSystem {
  let rng: Rng | null = null;
  let waveState: WaveState | null = null;
  let bossState: BossSpawnState | null = null;

  return {
    setRng(next): void {
      rng = next;
    },
    onEncounterStart(encounter, store, arena): void {
      waveState = null;
      bossState = null;
      const plan = encounter.spawnPlan;
      switch (plan.kind) {
        case 'empty':
          return;
        case 'static':
          executeStatic(plan, store, enemyRegistry);
          return;
        case 'wave':
          waveState = {
            plan,
            arena,
            dispatched: 0,
            lastSpawnSimMs: Number.NEGATIVE_INFINITY,
            alive: new Set()
          };
          return;
        case 'boss': {
          const archetype = resolveBossArchetype(plan.bossArchetypeId, bossRegistry);
          const boss = store.spawnBoss(makeBossSpawnSpec(archetype, plan.position));
          bossState = { plan, alive: new Set([boss.id]) };
          return;
        }
        default:
          assertNever(plan);
      }
    },
    onEncounterEnd(_encounter): void {
      waveState = null;
      bossState = null;
    },
    onTick(simTimeMs, store): void {
      const state = waveState;
      if (state === null) return;
      if (state.dispatched >= state.plan.spawns.length) return;
      if (state.alive.size >= state.plan.maxAlive) return;
      if (simTimeMs - state.lastSpawnSimMs < state.plan.spawnIntervalMs) return;
      spawnNextWaveEnemy(state, simTimeMs, store, enemyRegistry, rng);
    },
    onEnemyDeath(entityId): void {
      if (waveState === null) return;
      waveState.alive.delete(entityId);
    },
    onBossDeath(entityId): void {
      if (bossState === null) return;
      bossState.alive.delete(entityId);
    },
    waveProgress(): WaveProgressSnapshot | null {
      if (waveState !== null) {
        return {
          dispatched: waveState.dispatched,
          total: waveState.plan.spawns.length,
          alive: waveState.alive.size
        };
      }
      if (bossState !== null) {
        return {
          dispatched: 1,
          total: 1,
          alive: bossState.alive.size
        };
      }
      return null;
    }
  };
}

function resolveBossArchetype(
  id: string,
  bossRegistry: Readonly<Record<string, BossArchetype>>
): BossArchetype {
  const archetype = bossRegistry[id];
  if (archetype === undefined) {
    throw new Error(`unknown boss archetype: ${id}`);
  }
  return archetype;
}

function makeBossSpawnSpec(archetype: BossArchetype, position: Vec2): BossSpawnSpec {
  const phase0 = archetype.phases[0];
  if (phase0 === undefined) {
    throw new Error(`boss archetype ${archetype.id} has no phases`);
  }
  const attackIdsFromArchetype = Object.keys(archetype.attacks);
  return {
    archetypeId: archetype.id,
    position,
    radius: archetype.radius,
    maxHp: archetype.maxHp,
    maxSpeed: archetype.maxSpeed,
    color: archetype.color,
    contactDamage: archetype.contactDamage,
    contactCooldownMs: archetype.contactCooldownMs,
    knockbackBaseImpulse: archetype.knockbackBaseImpulse,
    knockbackVelocityScale: archetype.knockbackVelocityScale,
    knockbackDurationMs: archetype.knockbackDurationMs,
    phaseIndex: 0,
    phaseId: phase0.id,
    activeAttackIds: [...phase0.allowedAttackIds],
    attackIdsFromArchetype
  };
}

function executeStatic(
  plan: StaticSpawnPlan,
  store: EntityStore,
  enemyRegistry: Readonly<Record<string, EnemyArchetype>>
): void {
  for (const spec of plan.spawns) {
    const archetype = resolveArchetype(spec.archetypeId, enemyRegistry);
    store.spawnEnemy(makeEnemySpawnSpec(archetype, spec.position));
  }
}

function spawnNextWaveEnemy(
  state: WaveState,
  simTimeMs: number,
  store: EntityStore,
  enemyRegistry: Readonly<Record<string, EnemyArchetype>>,
  rng: Rng | null
): void {
  if (rng === null) {
    throw new Error("wave spawn plan requires a session Rng (see design/rng.md)");
  }
  const spec = state.plan.spawns[state.dispatched];
  if (spec === undefined) return;
  const archetype = resolveArchetype(spec.archetypeId, enemyRegistry);
  const position = pickEdgePosition(
    state.arena,
    state.plan.edgeMargin ?? 0,
    archetype.radius,
    rng
  );
  const enemy = store.spawnEnemy(makeEnemySpawnSpec(archetype, position));
  state.alive.add(enemy.id);
  state.dispatched += 1;
  state.lastSpawnSimMs = simTimeMs;
}

function resolveArchetype(
  id: string,
  enemyRegistry: Readonly<Record<string, EnemyArchetype>>
): EnemyArchetype {
  const archetype = enemyRegistry[id];
  if (archetype === undefined) {
    throw new Error(`unknown enemy archetype: ${id}`);
  }
  return archetype;
}

function makeEnemySpawnSpec(archetype: EnemyArchetype, position: Vec2): EnemySpawnSpec {
  return {
    archetypeId: archetype.id,
    position,
    radius: archetype.radius,
    behavior: archetype.behavior,
    maxHp: archetype.maxHp,
    maxSpeed: archetype.maxSpeed,
    contactDamage: archetype.contactDamage,
    contactCooldownMs: archetype.contactCooldownMs,
    knockbackBaseImpulse: archetype.knockbackBaseImpulse,
    knockbackVelocityScale: archetype.knockbackVelocityScale,
    knockbackDurationMs: archetype.knockbackDurationMs,
    color: archetype.color
  };
}

function pickEdgePosition(
  arena: ArenaConfig,
  edgeMargin: number,
  enemyRadius: number,
  rng: Rng
): Vec2 {
  const inset = edgeMargin + enemyRadius;
  const innerHalfW = arena.width / 2 - inset;
  const innerHalfH = arena.height / 2 - inset;
  if (innerHalfW <= 0 || innerHalfH <= 0) {
    throw new Error(
      `arena ${arena.width}x${arena.height} too small for edge spawn with inset ${inset}`
    );
  }
  const sideW = innerHalfW * 2;
  const sideH = innerHalfH * 2;
  const perimeter = 2 * (sideW + sideH);
  let t = rng.nextFloat() * perimeter;
  if (t < sideW) {
    return { x: -innerHalfW + t, y: innerHalfH };
  }
  t -= sideW;
  if (t < sideH) {
    return { x: innerHalfW, y: innerHalfH - t };
  }
  t -= sideH;
  if (t < sideW) {
    return { x: innerHalfW - t, y: -innerHalfH };
  }
  t -= sideW;
  return { x: -innerHalfW, y: -innerHalfH + t };
}
