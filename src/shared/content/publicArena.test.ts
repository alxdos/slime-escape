import { describe, expect, it } from 'vitest';

import { SESSION_PRESET_TEMPLATES } from './sessions.generated';
import { TRAINING_PLAYER } from './players.generated';
import {
  PUBLIC_ARENA_ACTIVE_BACKGROUND_ID,
  PUBLIC_ARENA_ARENA,
  PUBLIC_ARENA_BACKGROUNDS,
  PUBLIC_ARENA_HOST_BOSS_ARCHETYPE_ID,
  PUBLIC_ARENA_HOST_BOSS_WEAPON_ID,
  PUBLIC_ARENA_HOST_CONFIG,
  PUBLIC_ARENA_HOST_LOADOUT,
  PUBLIC_ARENA_HOST_PLAYER,
  PUBLIC_ARENA_HOST_SESSION_PRESET_ID,
  PUBLIC_ARENA_LOADOUT,
  PUBLIC_ARENA_PRESENTATION_CONFIG,
  PUBLIC_ARENA_PLAYER,
  PUBLIC_ARENA_SPAWN_INVULNERABILITY_MS,
  PUBLIC_ARENA_WORLD_BOUNDS,
  worldBoundsFromArena
} from './publicArena';

describe('Public Arena content projection', () => {
  it('derives presentation config from the generated portal session content', () => {
    const portal = SESSION_PRESET_TEMPLATES.portal;
    const activeBackgroundId = portal.encounters.find(
      (encounter) => encounter.backgroundId !== null
    )?.backgroundId;
    if (activeBackgroundId === undefined) {
      throw new Error('expected portal content to select an active background');
    }
    const portalPlayer = portal.players[0];

    expect(Object.keys(PUBLIC_ARENA_PRESENTATION_CONFIG)).toEqual([
      'arena',
      'player',
      'loadout',
      'backgrounds',
      'activeBackgroundId'
    ]);
    expect(PUBLIC_ARENA_ARENA).toEqual(portal.arena);
    expect(PUBLIC_ARENA_PLAYER).toEqual({
      position: portalPlayer.position,
      radius: portalPlayer.radius,
      contactBox: portalPlayer.contactBox,
      maxSpeed: portalPlayer.maxSpeed,
      maxHp: portalPlayer.maxHp
    });
    expect(PUBLIC_ARENA_LOADOUT).toEqual(portalPlayer.loadout);
    expect(PUBLIC_ARENA_BACKGROUNDS).toEqual(portal.backgrounds);
    expect(PUBLIC_ARENA_ACTIVE_BACKGROUND_ID).toBe(activeBackgroundId);
    expect(PUBLIC_ARENA_PRESENTATION_CONFIG).toEqual({
      arena: portal.arena,
      player: PUBLIC_ARENA_PLAYER,
      loadout: portalPlayer.loadout,
      backgrounds: portal.backgrounds,
      activeBackgroundId
    });
  });

  it('derives centered world bounds from the public arena dimensions', () => {
    expect(PUBLIC_ARENA_WORLD_BOUNDS).toEqual(worldBoundsFromArena(PUBLIC_ARENA_ARENA));
    expect(PUBLIC_ARENA_WORLD_BOUNDS.minX).toBe(-PUBLIC_ARENA_ARENA.width / 2);
    expect(PUBLIC_ARENA_WORLD_BOUNDS.maxX).toBe(PUBLIC_ARENA_ARENA.width / 2);
    expect(PUBLIC_ARENA_WORLD_BOUNDS.minY).toBe(-PUBLIC_ARENA_ARENA.height / 2);
    expect(PUBLIC_ARENA_WORLD_BOUNDS.maxY).toBe(PUBLIC_ARENA_ARENA.height / 2);
  });

  it('derives host config from the generated public-arena session content', () => {
    const session = SESSION_PRESET_TEMPLATES['public-arena'];

    expect(session.dynamicRoster).toBe(true);
    expect(session.players).toEqual([]);
    expect(session.lossCondition).toEqual({ kind: 'respawnOnDeath' });
    expect(PUBLIC_ARENA_HOST_SESSION_PRESET_ID).toBe('public-arena');
    expect(PUBLIC_ARENA_HOST_PLAYER).toEqual(TRAINING_PLAYER);
    expect(PUBLIC_ARENA_HOST_LOADOUT).toEqual({
      weapons: ['rock-thrower', 'shotgun'],
      selectedIndex: 0
    });
    expect(PUBLIC_ARENA_HOST_BOSS_WEAPON_ID).toBe('fireball-staff');
    expect(PUBLIC_ARENA_HOST_BOSS_ARCHETYPE_ID).toBe('boss-tower-sentinel');
    expect(PUBLIC_ARENA_SPAWN_INVULNERABILITY_MS).toBe(900);
    expect(PUBLIC_ARENA_HOST_CONFIG).toEqual({
      sessionPresetId: 'public-arena',
      player: PUBLIC_ARENA_HOST_PLAYER,
      loadout: PUBLIC_ARENA_HOST_LOADOUT,
      bossWeaponId: PUBLIC_ARENA_HOST_BOSS_WEAPON_ID,
      bossArchetypeId: PUBLIC_ARENA_HOST_BOSS_ARCHETYPE_ID,
      spawnInvulnerabilityMs: PUBLIC_ARENA_SPAWN_INVULNERABILITY_MS
    });
  });
});
