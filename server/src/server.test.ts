import { describe, expect, it, vi } from 'vitest';

import { PUBLIC_ARENA_EVENTS } from '../../src/shared/publicArenaProtocol.js';

import {
  PUBLIC_ARENA_INPUT_RATE_LIMIT_MAX,
  PUBLIC_ARENA_INPUT_RATE_LIMIT_WINDOW_MS,
  PUBLIC_ARENA_SERVER_SHUTDOWN_REASON,
  acceptPublicArenaInputIntent,
  createPublicArenaInputRateLimitState,
  emitPublicArenaServerShutdownReason,
  publishPresentationEvents
} from './server.js';

function createPresentationIo() {
  const socketA = { emit: vi.fn() };
  const socketB = { emit: vi.fn() };
  const socketC = { emit: vi.fn() };
  return {
    io: {
      sockets: {
        sockets: new Map([
          ['socket-a', socketA],
          ['socket-b', socketB],
          ['socket-c', socketC]
        ])
      }
    } as Parameters<typeof publishPresentationEvents>[0],
    socketA,
    socketB,
    socketC
  };
}

describe('PublicArenaServer hardening', () => {
  it('drops per-socket input intents after the configured window limit', () => {
    const windowStartMs = 5_000;
    const state = createPublicArenaInputRateLimitState(windowStartMs);

    for (let i = 0; i < PUBLIC_ARENA_INPUT_RATE_LIMIT_MAX; i += 1) {
      expect(acceptPublicArenaInputIntent(state, windowStartMs + 200)).toBe(true);
    }

    expect(acceptPublicArenaInputIntent(state, windowStartMs + 999)).toBe(false);
    expect(
      acceptPublicArenaInputIntent(
        state,
        windowStartMs + PUBLIC_ARENA_INPUT_RATE_LIMIT_WINDOW_MS
      )
    ).toBe(true);
  });

  it('emits a serverShutdown close reason before intentional shutdown', () => {
    const io = {
      emit: vi.fn()
    };

    emitPublicArenaServerShutdownReason(io);

    expect(io.emit).toHaveBeenCalledWith(
      PUBLIC_ARENA_EVENTS.closeReason,
      PUBLIC_ARENA_SERVER_SHUTDOWN_REASON
    );
  });

  it('routes presentation events only to the event recipients', () => {
    const { io, socketA, socketB, socketC } = createPresentationIo();
    const members = [
      { socketId: 'socket-a', playerId: 'player-a', spawn: { x: 0, y: 0 }, level: 1 },
      { socketId: 'socket-b', playerId: 'player-b', spawn: { x: 0, y: 0 }, level: 1 },
      { socketId: 'socket-c', playerId: 'player-c', spawn: { x: 0, y: 0 }, level: 1 }
    ];
    const fireEvent = {
      kind: 'fire' as const,
      simTimeMs: 12,
      shooterId: 'player-a',
      ownerKind: 'player' as const,
      weaponArchetypeId: 'rock-thrower',
      originX: 0,
      originY: 0,
      dirX: 1,
      dirY: 0
    };
    const deathEvent = {
      kind: 'death' as const,
      simTimeMs: 16,
      playerId: 'player-b',
      killerId: 'player-a',
      form: { kind: 'slime' as const, archetypeId: 'slime-one-eye' },
      weaponArchetypeId: 'rock-thrower',
      x: 1,
      y: 0
    };
    const hitEvent = {
      kind: 'hit' as const,
      simTimeMs: 18,
      projectileId: 'projectile-a',
      ownerId: 'player-a',
      ownerKind: 'player' as const,
      targetId: 'player-b',
      targetForm: { kind: 'slime' as const, archetypeId: 'slime-one-eye' },
      weaponArchetypeId: 'rock-thrower',
      damage: 3,
      x: 1,
      y: 0,
      impactDirX: 1,
      impactDirY: 0
    };

    publishPresentationEvents(io, members, [fireEvent, deathEvent, hitEvent]);

    expect(socketA.emit).toHaveBeenCalledWith(PUBLIC_ARENA_EVENTS.presentation, fireEvent);
    expect(socketA.emit).toHaveBeenCalledWith(PUBLIC_ARENA_EVENTS.presentation, hitEvent);
    expect(socketA.emit).toHaveBeenCalledWith(PUBLIC_ARENA_EVENTS.presentation, deathEvent);
    expect(socketB.emit).toHaveBeenCalledWith(PUBLIC_ARENA_EVENTS.presentation, hitEvent);
    expect(socketB.emit).toHaveBeenCalledWith(PUBLIC_ARENA_EVENTS.presentation, deathEvent);
    expect(socketC.emit).toHaveBeenCalledWith(PUBLIC_ARENA_EVENTS.presentation, deathEvent);
    expect(socketC.emit).not.toHaveBeenCalledWith(PUBLIC_ARENA_EVENTS.presentation, hitEvent);
  });
});
