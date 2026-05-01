import { describe, expect, it } from 'vitest';

import type { RuntimeEvent } from '../../../src/shared/events.js';
import {
  ARENA_HOST_INPUT_RATE_LIMIT_MAX,
  acceptArenaHostInputIntent,
  arenaHostEventRecipients,
  cornerSpawns,
  createArenaHostInputRateLimitState
} from './host.js';

describe('ArenaHost policy utilities', () => {
  it('rate-limits accepted socket input windows', () => {
    const state = createArenaHostInputRateLimitState(1000);
    for (let i = 0; i < ARENA_HOST_INPUT_RATE_LIMIT_MAX; i += 1) {
      expect(acceptArenaHostInputIntent(state, 1200)).toBe(true);
    }

    expect(acceptArenaHostInputIntent(state, 1500)).toBe(false);
    expect(acceptArenaHostInputIntent(state, 2000)).toBe(true);
  });

  it('derives deterministic spawn corners from session arena dimensions', () => {
    expect(cornerSpawns({ width: 35, height: 35 }, 0.5)).toEqual([
      { x: -13.5, y: -13.5 },
      { x: 13.5, y: -13.5 },
      { x: 13.5, y: 13.5 },
      { x: -13.5, y: 13.5 }
    ]);
    expect(cornerSpawns({ width: 20, height: 28 }, 1)).toEqual([
      { x: -6, y: -10 },
      { x: 6, y: -10 },
      { x: 6, y: 10 },
      { x: -6, y: 10 }
    ]);
  });

  it('computes recipients from shared runtime events and host events', () => {
    const actors = new Map([
      ['a', { actorId: 'a', entityId: 1, level: 1 }],
      ['b', { actorId: 'b', entityId: 2, level: 1 }],
      ['c', { actorId: 'c', entityId: 3, level: 1 }]
    ]);

    expect(
      arenaHostEventRecipients(
        {
          kind: 'hit',
          simTime: 1,
          projectileId: 5,
          ownerId: 1,
          ownerKind: 'player',
          targetId: 2,
          targetKind: 'player',
          targetArchetypeId: null,
          weaponArchetypeId: 'pistol',
          damage: 1,
          impactDirX: 1,
          impactDirY: 0,
          x: 0,
          y: 0
        },
        actors
      )
    ).toEqual(['a', 'b']);
    expect(
      arenaHostEventRecipients(
        {
          kind: 'explosion',
          simTime: 1,
          projectileId: 5,
          ownerId: 1,
          ownerKind: 'player',
          weaponArchetypeId: 'bomb-placer',
          damage: 3,
          radius: 2,
          x: 0,
          y: 0
        },
        actors
      )
    ).toEqual(['a']);
    expect(arenaHostEventRecipients(deathEvent(2, 1), actors)).toEqual(['a', 'b', 'c']);
    expect(
      arenaHostEventRecipients(
        {
          kind: 'host:levelUp',
          simTime: 1,
          actorId: 'a',
          level: 2,
          formArchetypeId: 'slime-hornling'
        },
        actors
      )
    ).toEqual(['a']);
  });
});

function deathEvent(
  entityId: number,
  killerId: number | null
): Extract<RuntimeEvent, { kind: 'death' }> {
  return {
    kind: 'death',
    simTime: 1000,
    entityId,
    entityKind: 'player',
    archetypeId: null,
    weaponArchetypeId: 'rock-thrower',
    impactDirX: 1,
    impactDirY: 0,
    killerId,
    x: 0,
    y: 0
  };
}
