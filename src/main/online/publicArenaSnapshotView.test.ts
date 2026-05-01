import { describe, expect, it } from 'vitest';

import {
  PUBLIC_ARENA_BOSS_ARCHETYPE_ID,
  PUBLIC_ARENA_BOSS_LEVEL
} from '../../shared/publicArenaProgression';
import type { Snapshot } from '../../shared/snapshot';
import { publicArenaLevelForForm, publicArenaSnapshotView } from './publicArenaSnapshotView';

describe('publicArenaSnapshotView', () => {
  it('maps shared snapshots to online player and projectile views', () => {
    const view = publicArenaSnapshotView(makeSharedSnapshot());

    expect(view?.population).toBe(3);
    expect(view?.players.map((player) => [player.id, player.form.kind, player.level])).toEqual([
      ['hero', 'player', 1],
      ['slime', 'slime', 1],
      ['boss', 'boss', PUBLIC_ARENA_BOSS_LEVEL]
    ]);
    expect(view?.players[1]?.selectedWeaponIndex).toBe(0);
    expect(view?.players[1]?.weaponHud?.weapons[0]?.weaponArchetypeId).toBe('rock-thrower');
    expect(view?.projectiles).toEqual([
      expect.objectContaining({
        id: '99',
        kind: 'projectile',
        weaponArchetypeId: 'rock-thrower'
      })
    ]);
  });

  it('derives boss and regular levels from public arena form content', () => {
    expect(publicArenaLevelForForm(null)).toBe(1);
    expect(publicArenaLevelForForm('slime-one-eye')).toBe(1);
    expect(publicArenaLevelForForm(PUBLIC_ARENA_BOSS_ARCHETYPE_ID)).toBe(
      PUBLIC_ARENA_BOSS_LEVEL
    );
  });
});

function makeSharedSnapshot(): Snapshot {
  return {
    simTimeMs: 1000,
    entities: [
      {
        id: 1,
        kind: 'player',
        playerId: 'hero',
        x: 0,
        y: 0,
        hp: 5,
        maxHp: 5,
        formArchetypeId: null,
        weaponHud: null
      },
      {
        id: 2,
        kind: 'player',
        playerId: 'slime',
        x: 1,
        y: 0,
        hp: 5,
        maxHp: 5,
        formArchetypeId: 'slime-one-eye',
        weaponHud: {
          selectedIndex: 0,
          weapons: [
            {
              index: 0,
              weaponArchetypeId: 'rock-thrower',
              cooldownStartedAtSimMs: 900,
              cooldownReadyAtSimMs: 1000,
              modifiers: [],
              timedEffects: []
            }
          ]
        }
      },
      {
        id: 3,
        kind: 'player',
        playerId: 'boss',
        x: 2,
        y: 0,
        hp: 30,
        maxHp: 30,
        formArchetypeId: PUBLIC_ARENA_BOSS_ARCHETYPE_ID,
        weaponHud: null
      },
      {
        id: 99,
        kind: 'projectile',
        weaponArchetypeId: 'rock-thrower',
        ownerKind: 'player',
        originX: 0,
        originY: 0,
        x: 1,
        y: 1,
        size: { width: 0.4, height: 0.4 },
        state: 'flying',
        visualState: { angleRadians: 0, spinRadians: 0, pulsePhase: 0 },
        explosionRadius: null,
        detonateAtSimMs: null,
        arcEnd: null
      }
    ],
    encounter: null,
    zone: { mode: 'disabled', margin: 0 },
    waveProgress: null,
    bossHud: null
  };
}
