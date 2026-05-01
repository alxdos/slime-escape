import { describe, expect, it } from 'vitest';

import type { RuntimeEvent } from '../../../src/shared/events.js';
import type { ArenaProgressionContent } from './policy.js';
import { pvpKillToLevelOps } from './policy.js';

const BASE_PLAYER = {
  radius: 0.5,
  contactBox: { width: 1, height: 1 },
  maxSpeed: 6,
  maxHp: 5,
  loadout: { weapons: ['rock-thrower'], selectedIndex: 0 }
} as const;

const CONTENT: ArenaProgressionContent = {
  basePlayer: BASE_PLAYER,
  respawnPosition: { x: -10, y: -10 },
  spawnInvulnerabilityMs: 900,
  bossLevel: 3,
  formsByLevel: new Map([
    [
      1,
      {
        formArchetypeId: 'slime-one-eye',
        radius: 0.5,
        contactBox: { width: 1, height: 1 },
        maxSpeed: 6,
        maxHp: 5,
        loadout: BASE_PLAYER.loadout
      }
    ],
    [
      2,
      {
        formArchetypeId: 'slime-hornling',
        radius: 0.7,
        contactBox: { width: 1.1, height: 1.1 },
        maxSpeed: 6,
        maxHp: 5,
        loadout: BASE_PLAYER.loadout
      }
    ],
    [
      3,
      {
        formArchetypeId: 'boss-tower-sentinel',
        radius: 1.2,
        contactBox: { width: 2, height: 2 },
        maxSpeed: 2,
        maxHp: 30,
        loadout: { weapons: ['fireball-staff'], selectedIndex: 0 }
      }
    ]
  ])
};

describe('pvpKillToLevelOps', () => {
  it('respawns the dead actor at level one with spawn invulnerability', () => {
    const ops = pvpKillToLevelOps(
      death({ entityId: 10, killerId: null }),
      new Map([['victim', { actorId: 'victim', entityId: 10, level: 2 }]]),
      CONTENT
    );

    expect(ops).toEqual([
      {
        kind: 'addPlayer',
        playerConfig: {
          id: 'victim',
          position: { x: -10, y: -10 },
          ...BASE_PLAYER
        },
        invulnerableUntilSimMs: 1_900
      },
      {
        kind: 'setPlayerForm',
        actorId: 'victim',
        level: 1,
        formUpdate: {
          formArchetypeId: 'slime-one-eye',
          radius: 0.5,
          contactBox: { width: 1, height: 1 },
          maxSpeed: 6,
          maxHp: 5,
          loadout: BASE_PLAYER.loadout
        },
        refillHp: true
      }
    ]);
  });

  it('levels an attributable killer and emits a host level-up event', () => {
    const ops = pvpKillToLevelOps(
      death({ entityId: 10, killerId: 20 }),
      new Map([
        ['victim', { actorId: 'victim', entityId: 10, level: 1 }],
        ['killer', { actorId: 'killer', entityId: 20, level: 1 }]
      ]),
      CONTENT
    );

    expect(ops.at(2)).toMatchObject({
      kind: 'setPlayerForm',
      actorId: 'killer',
      level: 2,
      formUpdate: {
        formArchetypeId: 'slime-hornling'
      },
      refillHp: true
    });
    expect(ops.at(3)).toEqual({
      kind: 'emitHostEvent',
      event: {
        kind: 'host:levelUp',
        simTime: 1000,
        actorId: 'killer',
        level: 2,
        formArchetypeId: 'slime-hornling'
      }
    });
  });

  it('does not award a level for self-kill or missing killer attribution', () => {
    for (const killerId of [10, null]) {
      const ops = pvpKillToLevelOps(
        death({ entityId: 10, killerId }),
        new Map([['victim', { actorId: 'victim', entityId: 10, level: 1 }]]),
        CONTENT
      );

      expect(ops.map((op) => op.kind)).toEqual(['addPlayer', 'setPlayerForm']);
    }
  });

  it('keeps boss-level killers capped while still emitting the host event', () => {
    const ops = pvpKillToLevelOps(
      death({ entityId: 10, killerId: 20 }),
      new Map([
        ['victim', { actorId: 'victim', entityId: 10, level: 1 }],
        ['killer', { actorId: 'killer', entityId: 20, level: 3 }]
      ]),
      CONTENT
    );

    expect(ops.map((op) => op.kind)).toEqual([
      'addPlayer',
      'setPlayerForm',
      'emitHostEvent'
    ]);
    expect(ops.at(2)).toEqual({
      kind: 'emitHostEvent',
      event: {
        kind: 'host:levelUp',
        simTime: 1000,
        actorId: 'killer',
        level: 3,
        formArchetypeId: 'boss-tower-sentinel'
      }
    });
  });
});

function death(
  overrides: Pick<Extract<RuntimeEvent, { kind: 'death' }>, 'entityId' | 'killerId'>
): Extract<RuntimeEvent, { kind: 'death' }> {
  return {
    kind: 'death',
    simTime: 1000,
    entityKind: 'player',
    archetypeId: null,
    weaponArchetypeId: 'rock-thrower',
    impactDirX: 1,
    impactDirY: 0,
    x: 0,
    y: 0,
    ...overrides
  };
}
