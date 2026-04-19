import { ENEMY_ARCHETYPES, type EnemyArchetype } from '../shared/content/enemies';
import { assertNever } from '../shared/protocol';
import type { EncounterDefinition, SpawnPlan, StaticSpawnPlan } from '../shared/session';

import type { EntityStore } from './EntityStore';

export type SpawnSystem = Readonly<{
  onEncounterStart(encounter: EncounterDefinition, store: EntityStore): void;
  onEncounterEnd(encounter: EncounterDefinition): void;
}>;

export function createSpawnSystem(
  enemyRegistry: Readonly<Record<string, EnemyArchetype>> = ENEMY_ARCHETYPES
): SpawnSystem {
  return {
    onEncounterStart(encounter, store): void {
      executePlan(encounter.spawnPlan, store, enemyRegistry);
    },
    onEncounterEnd(_encounter): void {
      // No internal state to reset for 'empty'/'static'.
      // Wave-aware kinds (004) will reset their accumulators here.
    }
  };
}

function executePlan(
  plan: SpawnPlan,
  store: EntityStore,
  enemyRegistry: Readonly<Record<string, EnemyArchetype>>
): void {
  switch (plan.kind) {
    case 'empty':
      return;
    case 'static':
      executeStatic(plan, store, enemyRegistry);
      return;
    default:
      assertNever(plan);
  }
}

function executeStatic(
  plan: StaticSpawnPlan,
  store: EntityStore,
  enemyRegistry: Readonly<Record<string, EnemyArchetype>>
): void {
  for (const spec of plan.spawns) {
    const archetype = enemyRegistry[spec.archetypeId];
    if (archetype === undefined) {
      throw new Error(`unknown enemy archetype: ${spec.archetypeId}`);
    }
    store.spawnEnemy({
      archetypeId: archetype.id,
      position: spec.position,
      radius: archetype.radius,
      behavior: archetype.behavior,
      maxHp: archetype.maxHp,
      color: archetype.color
    });
  }
}
