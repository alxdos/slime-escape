import { describe, expect, it } from 'vitest';

import { HERO, PLAYER_ARCHETYPES, type PlayerArchetype } from '../../shared/content/players';

import { PLAYER_VISUALS, validatePlayerVisuals } from './playerVisuals';

describe('validatePlayerVisuals', () => {
  it('accepts the committed player registry', () => {
    expect(() => validatePlayerVisuals(PLAYER_ARCHETYPES)).not.toThrow();
  });

  it('rejects player archetypes without a visual spec', () => {
    const ghostHero: PlayerArchetype = {
      ...HERO,
      id: 'ghost-hero'
    };

    expect(() =>
      validatePlayerVisuals({
        ...PLAYER_ARCHETYPES,
        [ghostHero.id]: ghostHero
      })
    ).toThrow('player visual missing for archetype "ghost-hero"');
  });

  it('rejects orphan player visuals', () => {
    expect(() => validatePlayerVisuals({})).toThrow(
      'player visual references unknown archetype "hero"'
    );
  });

  it('matches the committed player ids', () => {
    expect(Object.keys(PLAYER_VISUALS).sort()).toEqual(Object.keys(PLAYER_ARCHETYPES).sort());
  });
});
