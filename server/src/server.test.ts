import { describe, expect, it, vi } from 'vitest';

import {
  ARENA_HOST_PROTOCOL_VERSION,
  PUBLIC_ARENA_EVENTS,
  PUBLIC_ARENA_FULL_MESSAGE
} from '../../src/shared/arenaHostProtocol.js';
import type { Snapshot } from '../../src/shared/snapshot.js';
import { ARENA_HOST_SERVER_SHUTDOWN_REASON } from './arena-host/host.js';

import {
  arenaHostJoinAcceptedMessage,
  arenaHostJoinRejectedMessage,
  emitArenaHostEvent,
  emitArenaHostServerShutdownReason,
  emitArenaHostSnapshot,
  protocolMismatchRejection
} from './server.js';

describe('PublicArenaServer host adapter', () => {
  it('maps host join results to versioned protocol messages', () => {
    expect(
      arenaHostJoinAcceptedMessage({
        kind: 'accepted',
        roomId: 'room-1',
        sessionConfigId: 'public-arena',
        actorId: 'socket-a',
        arena: { width: 32, height: 32, minX: -16, maxX: 16, minY: -16, maxY: 16 },
        playerCap: 200,
        population: 1,
        maxPlayers: 200,
        lateJoinAllowed: true,
        roomState: 'running',
        tickHz: 60,
        snapshotHz: 30
      })
    ).toEqual({
      protocolVersion: ARENA_HOST_PROTOCOL_VERSION,
      roomId: 'room-1',
      sessionConfigId: 'public-arena',
      actorId: 'socket-a',
      arena: { width: 32, height: 32, minX: -16, maxX: 16, minY: -16, maxY: 16 },
      playerCap: 200,
      population: 1,
      maxPlayers: 200,
      lateJoinAllowed: true,
      roomState: 'running',
      tickHz: 60,
      snapshotHz: 30
    });

    expect(
      arenaHostJoinRejectedMessage({
        kind: 'rejected',
        reason: 'arenaFull',
        message: PUBLIC_ARENA_FULL_MESSAGE,
        playerCap: 2,
        population: 2
      })
    ).toEqual({
      protocolVersion: ARENA_HOST_PROTOCOL_VERSION,
      reason: 'arenaFull',
      message: PUBLIC_ARENA_FULL_MESSAGE,
      playerCap: 2,
      population: 2
    });
  });

  it('keeps protocol mismatch rejection versioned and population-aware', () => {
    expect(protocolMismatchRejection(3, 4)).toEqual({
      protocolVersion: ARENA_HOST_PROTOCOL_VERSION,
      reason: 'protocolMismatch',
      message: 'The online arena connection is out of date. Please refresh.',
      playerCap: 4,
      population: 3
    });
  });

  it('emits shared snapshots and host events only to the target actor socket', () => {
    const { io, socketA, socketB } = createArenaHostIo();
    const snapshot = makeSnapshot();
    const event = {
      kind: 'host:levelUp' as const,
      simTime: 100,
      actorId: 'socket-a',
      level: 2,
      formArchetypeId: 'slime-hornling'
    };

    emitArenaHostSnapshot(io, 'socket-a', snapshot);
    emitArenaHostEvent(io, 'socket-a', event);

    expect(socketA.volatile.emit).toHaveBeenCalledWith(PUBLIC_ARENA_EVENTS.snapshot, snapshot);
    expect(socketA.emit).toHaveBeenCalledWith(PUBLIC_ARENA_EVENTS.presentation, event);
    expect(socketB.volatile.emit).not.toHaveBeenCalled();
    expect(socketB.emit).not.toHaveBeenCalled();
  });

  it('emits a serverShutdown close reason before intentional shutdown', () => {
    const io = {
      emit: vi.fn()
    };

    emitArenaHostServerShutdownReason(io);

    expect(io.emit).toHaveBeenCalledWith(
      PUBLIC_ARENA_EVENTS.closeReason,
      ARENA_HOST_SERVER_SHUTDOWN_REASON
    );
  });
});

function createArenaHostIo(): {
  io: Parameters<typeof emitArenaHostSnapshot>[0];
  socketA: ReturnType<typeof createSocket>;
  socketB: ReturnType<typeof createSocket>;
} {
  const socketA = createSocket();
  const socketB = createSocket();
  return {
    io: {
      emit: vi.fn(),
      sockets: {
        sockets: new Map([
          ['socket-a', socketA],
          ['socket-b', socketB]
        ])
      }
    },
    socketA,
    socketB
  };
}

function createSocket(): {
  emit: ReturnType<typeof vi.fn>;
  volatile: { emit: ReturnType<typeof vi.fn> };
} {
  return {
    emit: vi.fn(),
    volatile: { emit: vi.fn() }
  };
}

function makeSnapshot(): Snapshot {
  return {
    simTimeMs: 100,
    entities: [],
    encounter: null,
    zone: { mode: 'disabled', margin: 0 },
    waveProgress: null,
    bossHud: null
  };
}
