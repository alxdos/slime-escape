import { describe, expect, it } from 'vitest';

import {
  PUBLIC_ARENA_PRESENTATION_CONFIG,
  worldBoundsFromArena
} from '../../src/shared/content/publicArena.js';
import { PUBLIC_ARENA_FULL_MESSAGE } from '../../src/shared/publicArenaProtocol.js';
import {
  PUBLIC_ARENA_ARENA,
  PUBLIC_ARENA_CORNER_SPAWNS,
  PUBLIC_ARENA_WORLD_BOUNDS,
  PUBLIC_ARENA_WORLD_SIZE_WU,
  createPublicArenaState
} from './arenaState.js';

function createTestArena(playerCap = 200) {
  return createPublicArenaState({
    playerCap,
    tickHz: 60,
    snapshotHz: 30
  });
}

describe('PublicArenaState membership', () => {
  it('uses the generated portal arena world bounds', () => {
    expect(PUBLIC_ARENA_ARENA).toBe(PUBLIC_ARENA_PRESENTATION_CONFIG.arena);
    expect(PUBLIC_ARENA_WORLD_SIZE_WU).toBe(PUBLIC_ARENA_PRESENTATION_CONFIG.arena.width);
    expect(PUBLIC_ARENA_WORLD_BOUNDS).toEqual(
      worldBoundsFromArena(PUBLIC_ARENA_PRESENTATION_CONFIG.arena)
    );
  });

  it('accepts a socket-local player at level 1 and reports population', () => {
    const arena = createTestArena();
    const result = arena.join('socket-a');

    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted') {
      throw new Error('join should be accepted');
    }

    expect(result.member).toMatchObject({
      socketId: 'socket-a',
      playerId: 'socket-a',
      level: 1
    });
    expect(result.message.population).toBe(1);
    expect(arena.population()).toBe(1);
  });

  it('rotates through simple corner spawn points', () => {
    const arena = createTestArena();
    const accepted = ['a', 'b', 'c', 'd', 'e'].map((socketId) => arena.join(socketId));

    expect(
      accepted.map((result) => {
        if (result.kind !== 'accepted') {
          throw new Error('join should be accepted');
        }
        return result.member.spawn;
      })
    ).toEqual([
      PUBLIC_ARENA_CORNER_SPAWNS[0],
      PUBLIC_ARENA_CORNER_SPAWNS[1],
      PUBLIC_ARENA_CORNER_SPAWNS[2],
      PUBLIC_ARENA_CORNER_SPAWNS[3],
      PUBLIC_ARENA_CORNER_SPAWNS[0]
    ]);
  });

  it('rejects new sockets when the arena is full without adding them', () => {
    const arena = createTestArena(1);

    expect(arena.join('socket-a').kind).toBe('accepted');
    const rejected = arena.join('socket-b');

    expect(rejected.kind).toBe('rejected');
    if (rejected.kind !== 'rejected') {
      throw new Error('join should be rejected');
    }
    expect(rejected.message).toMatchObject({
      reason: 'arenaFull',
      message: PUBLIC_ARENA_FULL_MESSAGE,
      playerCap: 1,
      population: 1
    });
    expect(arena.memberForSocket('socket-b')).toBeNull();
    expect(arena.population()).toBe(1);
  });

  it('removes disconnected sockets and frees capacity', () => {
    const arena = createTestArena(1);

    expect(arena.join('socket-a').kind).toBe('accepted');
    expect(arena.leave('socket-a')?.playerId).toBe('socket-a');
    expect(arena.population()).toBe(0);

    expect(arena.join('socket-b').kind).toBe('accepted');
    expect(arena.memberForSocket('socket-b')?.playerId).toBe('socket-b');
  });

  it('resets membership when a new in-memory arena state is created', () => {
    const arenaBeforeRestart = createTestArena();
    expect(arenaBeforeRestart.join('socket-a').kind).toBe('accepted');
    expect(arenaBeforeRestart.population()).toBe(1);

    const arenaAfterRestart = createTestArena();
    expect(arenaAfterRestart.population()).toBe(0);
    expect(arenaAfterRestart.memberForSocket('socket-a')).toBeNull();
  });
});
