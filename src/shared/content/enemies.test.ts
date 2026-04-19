import { describe, expect, it } from 'vitest';

import { DROP_ARCHETYPES, HEAL_ORB, type DropArchetype } from './drops';
import { SLIME_FAST, validateEnemyRegistry, type EnemyArchetype } from './enemies';

const PLAYER_RADIUS = 0.5;

const VALID_ENEMY: EnemyArchetype = {
  ...SLIME_FAST,
  id: 'enemies-test-valid',
  dropTable: [{ archetypeId: HEAL_ORB.id, chance: 0.25 }]
};

describe('validateEnemyRegistry: drop table archetype resolution', () => {
  it('throws when an enemy drop table references an unknown drop archetype', () => {
    const broken: EnemyArchetype = {
      ...SLIME_FAST,
      id: 'enemies-test-broken',
      dropTable: [{ archetypeId: 'no-such-drop', chance: 0.5 }]
    };
    const registry: Readonly<Record<string, EnemyArchetype>> = { [broken.id]: broken };

    expect(() => validateEnemyRegistry(registry, PLAYER_RADIUS)).toThrow(
      /unknown drop archetype/
    );
  });

  it('does not throw when every drop archetype id resolves', () => {
    const registry: Readonly<Record<string, EnemyArchetype>> = {
      [VALID_ENEMY.id]: VALID_ENEMY
    };
    expect(() => validateEnemyRegistry(registry, PLAYER_RADIUS)).not.toThrow();
  });

  it('does not throw on warning-only invariants (chance bounds, sum > 1)', () => {
    const noisyButResolvable: EnemyArchetype = {
      ...SLIME_FAST,
      id: 'enemies-test-noisy',
      dropTable: [
        { archetypeId: HEAL_ORB.id, chance: 0.7 },
        { archetypeId: HEAL_ORB.id, chance: 0.6 }
      ]
    };
    const registry: Readonly<Record<string, EnemyArchetype>> = {
      [noisyButResolvable.id]: noisyButResolvable
    };
    // Sum is 1.3 (>1) -> warning per design/drops.md, but archetype resolves
    // so validation must not throw.
    expect(() => validateEnemyRegistry(registry, PLAYER_RADIUS)).not.toThrow();
  });

  it('uses an injected drop registry when one is passed in', () => {
    const customDrop: DropArchetype = { ...HEAL_ORB, id: 'custom-orb' };
    const customRegistry: Readonly<Record<string, DropArchetype>> = {
      [customDrop.id]: customDrop
    };
    const enemy: EnemyArchetype = {
      ...SLIME_FAST,
      id: 'enemies-test-custom',
      dropTable: [{ archetypeId: customDrop.id, chance: 0.5 }]
    };
    expect(() =>
      validateEnemyRegistry({ [enemy.id]: enemy }, PLAYER_RADIUS, customRegistry)
    ).not.toThrow();

    // The default registry does not know about 'custom-orb', so validation
    // against the default must throw.
    expect(() =>
      validateEnemyRegistry({ [enemy.id]: enemy }, PLAYER_RADIUS, DROP_ARCHETYPES)
    ).toThrow(/unknown drop archetype/);
  });
});
