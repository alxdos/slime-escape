import { describe, expect, it } from 'vitest';

import { DROP_ARCHETYPES, HEAL_ORB, type DropArchetype } from './drops';
import { validateEnemyRegistry, type EnemyArchetype } from './enemies';

const PLAYER_CONTACT_BOX = { width: 1, height: 1 };
const BASE_TEST_ENEMY: EnemyArchetype = {
  id: 'enemies-test-base',
  displayName: 'Enemies Test Base',
  radius: 0.4,
  contactBox: { width: 0.8, height: 0.8 },
  maxHp: 1,
  behavior: 'chase',
  maxSpeed: 4,
  contactDamage: 1,
  contactCooldownMs: 800,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  color: 0x77ff99,
  dropTable: []
};

const VALID_ENEMY: EnemyArchetype = {
  ...BASE_TEST_ENEMY,
  id: 'enemies-test-valid',
  dropTable: [{ archetypeId: HEAL_ORB.id, chance: 0.25 }]
};

describe('validateEnemyRegistry: drop table archetype resolution', () => {
  it('throws when an enemy drop table references an unknown drop archetype', () => {
    const broken: EnemyArchetype = {
      ...BASE_TEST_ENEMY,
      id: 'enemies-test-broken',
      dropTable: [{ archetypeId: 'no-such-drop', chance: 0.5 }]
    };
    const registry: Readonly<Record<string, EnemyArchetype>> = { [broken.id]: broken };

    expect(() => validateEnemyRegistry(registry, PLAYER_CONTACT_BOX)).toThrow(
      /unknown drop archetype/
    );
  });

  it('does not throw when every drop archetype id resolves', () => {
    const registry: Readonly<Record<string, EnemyArchetype>> = {
      [VALID_ENEMY.id]: VALID_ENEMY
    };
    expect(() => validateEnemyRegistry(registry, PLAYER_CONTACT_BOX)).not.toThrow();
  });

  it('does not throw on warning-only invariants (chance bounds, sum > 1)', () => {
    const noisyButResolvable: EnemyArchetype = {
      ...BASE_TEST_ENEMY,
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
    expect(() => validateEnemyRegistry(registry, PLAYER_CONTACT_BOX)).not.toThrow();
  });

  it('uses an injected drop registry when one is passed in', () => {
    const customDrop: DropArchetype = { ...HEAL_ORB, id: 'custom-orb' };
    const customRegistry: Readonly<Record<string, DropArchetype>> = {
      [customDrop.id]: customDrop
    };
    const enemy: EnemyArchetype = {
      ...BASE_TEST_ENEMY,
      id: 'enemies-test-custom',
      dropTable: [{ archetypeId: customDrop.id, chance: 0.5 }]
    };
    expect(() =>
      validateEnemyRegistry({ [enemy.id]: enemy }, PLAYER_CONTACT_BOX, customRegistry)
    ).not.toThrow();

    // The default registry does not know about 'custom-orb', so validation
    // against the default must throw.
    expect(() =>
      validateEnemyRegistry({ [enemy.id]: enemy }, PLAYER_CONTACT_BOX, DROP_ARCHETYPES)
    ).toThrow(/unknown drop archetype/);
  });
});
