import { describe, expect, it } from 'vitest';

import { TRAINING_TARGET, type EnemyArchetype } from '../shared/content/enemies';
import type { EncounterDefinition } from '../shared/session';

import { createEntityStore } from './EntityStore';
import { createSpawnSystem } from './SpawnSystem';

const REGISTRY: Readonly<Record<string, EnemyArchetype>> = {
  [TRAINING_TARGET.id]: TRAINING_TARGET
};

function makeEncounter(plan: EncounterDefinition['spawnPlan']): EncounterDefinition {
  return {
    id: 'test-encounter',
    type: 'sandbox',
    spawnPlan: plan,
    zoneBehavior: { kind: 'disabled' },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'never' },
    tuning: null
  };
}

describe('SpawnSystem', () => {
  it("'empty' plan spawns nothing", () => {
    const store = createEntityStore();
    const spawn = createSpawnSystem(REGISTRY);
    spawn.onEncounterStart(makeEncounter({ kind: 'empty' }), store);

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
      store
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
        store
      )
    ).toThrow(/unknown enemy archetype/);
  });

  it('rejects unknown SpawnPlan.kind via assertNever', () => {
    const store = createEntityStore();
    const spawn = createSpawnSystem(REGISTRY);
    const bogus = { kind: 'wave' } as unknown as EncounterDefinition['spawnPlan'];

    expect(() => spawn.onEncounterStart(makeEncounter(bogus), store)).toThrow(
      /unexpected value/
    );
  });
});
