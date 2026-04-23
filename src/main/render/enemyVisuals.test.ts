import { describe, expect, it } from 'vitest';

import {
  ENEMY_ARCHETYPES,
  SLIME_BUG,
  type EnemyArchetype
} from '../../shared/content/enemies';

import { ENEMY_VISUALS, validateEnemyVisuals } from './enemyVisuals';

describe('validateEnemyVisuals', () => {
  it('accepts the committed enemy registry', () => {
    expect(() => validateEnemyVisuals(ENEMY_ARCHETYPES)).not.toThrow();
  });

  it('rejects enemy archetypes without a visual spec', () => {
    const ghostEnemy: EnemyArchetype = {
      ...SLIME_BUG,
      id: 'ghost-slime'
    };

    expect(() =>
      validateEnemyVisuals({
        ...ENEMY_ARCHETYPES,
        [ghostEnemy.id]: ghostEnemy
      })
    ).toThrow('enemy visual missing for archetype "ghost-slime"');
  });

  it('rejects orphan enemy visuals', () => {
    expect(() => validateEnemyVisuals({})).toThrow(
      'enemy visual references unknown archetype "slime-one-eye"'
    );
  });

  it('covers every committed enemy archetype id', () => {
    expect(Object.keys(ENEMY_VISUALS)).toHaveLength(30);
    expect(Object.keys(ENEMY_VISUALS).sort()).toEqual(Object.keys(ENEMY_ARCHETYPES).sort());
  });
});
