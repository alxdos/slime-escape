import { describe, expect, it } from 'vitest';

import {
  PUBLIC_ARENA_HOST_BOSS_ARCHETYPE_ID,
  PUBLIC_ARENA_HOST_BOSS_WEAPON_ID,
  PUBLIC_ARENA_HOST_LOADOUT,
  PUBLIC_ARENA_HOST_PLAYER
} from './content/publicArena';
import { ENEMY_ARCHETYPE_LIST } from './content/enemies';
import {
  PUBLIC_ARENA_BOSS_ARCHETYPE_ID,
  PUBLIC_ARENA_BOSS_LEVEL,
  PUBLIC_ARENA_BOSS_WEAPON_ID,
  PUBLIC_ARENA_REGULAR_FORM_STATS,
  PUBLIC_ARENA_REGULAR_SELECTED_WEAPON_INDEX,
  PUBLIC_ARENA_REGULAR_WEAPON_ID,
  PUBLIC_ARENA_REGULAR_WEAPON_IDS,
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
      maxHp: PUBLIC_ARENA_HOST_PLAYER.maxHp,
      maxSpeed: PUBLIC_ARENA_HOST_PLAYER.maxSpeed
    });
    expect(PUBLIC_ARENA_BOSS_LEVEL).toBe(ENEMY_ARCHETYPE_LIST.length + 1);
  });

  it('derives regular and boss weapons from public arena host content', () => {
    expect(PUBLIC_ARENA_HOST_LOADOUT.selectedIndex).toBe(0);
    expect(PUBLIC_ARENA_REGULAR_WEAPON_IDS).toEqual(PUBLIC_ARENA_HOST_LOADOUT.weapons);
    expect(PUBLIC_ARENA_REGULAR_SELECTED_WEAPON_INDEX).toBe(0);
    expect(PUBLIC_ARENA_REGULAR_WEAPON_ID).toBe(PUBLIC_ARENA_HOST_LOADOUT.weapons[0]);
    expect(PUBLIC_ARENA_BOSS_WEAPON_ID).toBe(PUBLIC_ARENA_HOST_BOSS_WEAPON_ID);
    expect(PUBLIC_ARENA_BOSS_ARCHETYPE_ID).toBe(PUBLIC_ARENA_HOST_BOSS_ARCHETYPE_ID);
  });
});
