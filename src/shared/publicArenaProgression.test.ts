import { describe, expect, it } from 'vitest';

import { PUBLIC_ARENA_LOADOUT, PUBLIC_ARENA_PLAYER } from './content/publicArena';
import { ENEMY_ARCHETYPE_LIST } from './content/enemies';
import {
  PUBLIC_ARENA_BOSS_LEVEL,
  PUBLIC_ARENA_REGULAR_FORM_STATS,
  PUBLIC_ARENA_REGULAR_WEAPON_ID,
  PUBLIC_ARENA_SLIME_FORM_CHAIN
} from './publicArenaProgression';

describe('public arena progression', () => {
  it('uses every authored enemy slime in generated content order', () => {
    expect(PUBLIC_ARENA_SLIME_FORM_CHAIN).toEqual(
      ENEMY_ARCHETYPE_LIST.map((enemy) => enemy.id)
    );
    expect(PUBLIC_ARENA_SLIME_FORM_CHAIN[0]).toBe('slime-one-eye');
    expect(PUBLIC_ARENA_SLIME_FORM_CHAIN.at(-1)).toBe('slime-ninja');
  });

  it('derives regular form stats and boss level from the authored slime chain', () => {
    expect(PUBLIC_ARENA_REGULAR_FORM_STATS).toHaveLength(ENEMY_ARCHETYPE_LIST.length);
    expect(PUBLIC_ARENA_REGULAR_FORM_STATS[0]).toEqual({
      archetypeId: ENEMY_ARCHETYPE_LIST[0]?.id,
      radius: ENEMY_ARCHETYPE_LIST[0]?.radius,
      maxHp: PUBLIC_ARENA_PLAYER.maxHp,
      maxSpeed: PUBLIC_ARENA_PLAYER.maxSpeed
    });
    expect(PUBLIC_ARENA_BOSS_LEVEL).toBe(ENEMY_ARCHETYPE_LIST.length + 1);
  });

  it('derives the regular weapon from the selected portal loadout slot', () => {
    expect(PUBLIC_ARENA_LOADOUT.selectedIndex).toBe(0);
    expect(PUBLIC_ARENA_REGULAR_WEAPON_ID).toBe(PUBLIC_ARENA_LOADOUT.weapons[0]);
  });
});
