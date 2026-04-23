import { describe, expect, it } from 'vitest';

import {
  BOSS_ARCHETYPES,
  BOSS_GARGOYLE,
  type BossArchetype
} from '../../shared/content/bosses';

import { BOSS_VISUALS, validateBossVisuals } from './bossVisuals';

describe('validateBossVisuals', () => {
  it('accepts the committed boss registry', () => {
    expect(() => validateBossVisuals(BOSS_ARCHETYPES)).not.toThrow();
  });

  it('rejects boss archetypes without a visual spec', () => {
    const ghostBoss: BossArchetype = {
      ...BOSS_GARGOYLE,
      id: 'ghost-boss'
    };

    expect(() =>
      validateBossVisuals({
        ...BOSS_ARCHETYPES,
        [ghostBoss.id]: ghostBoss
      })
    ).toThrow('boss visual missing for archetype "ghost-boss"');
  });

  it('rejects orphan boss visuals', () => {
    expect(() => validateBossVisuals({})).toThrow(
      'boss visual references unknown archetype "boss-gargoyle"'
    );
  });

  it('covers every committed boss archetype id', () => {
    expect(Object.keys(BOSS_VISUALS)).toHaveLength(5);
    expect(Object.keys(BOSS_VISUALS).sort()).toEqual(Object.keys(BOSS_ARCHETYPES).sort());
  });
});
