import { describe, expect, it, vi } from 'vitest';

import {
  PUBLIC_ARENA_EVENTS,
  PUBLIC_ARENA_FULL_MESSAGE,
  PUBLIC_ARENA_PROTOCOL_VERSION,
  type PublicArenaClientToServerEvents,
  type PublicArenaServerToClientEvents
} from '../../shared/publicArenaProtocol';
import { PUBLIC_ARENA_WORLD_BOUNDS } from '../../shared/content/publicArena';

import { createPublicArenaClient, type PublicArenaSocket } from './PublicArenaClient';

class FakePublicArenaSocket {
  readonly emitted: Array<Readonly<{ event: string; payload: unknown }>> = [];
  readonly listeners = new Map<string, Array<(payload?: unknown) => void>>();
  disconnectCalls = 0;

  asSocket(): PublicArenaSocket {
    const socket: PublicArenaSocket = {
      on: ((
        event: 'connect' | 'disconnect' | keyof PublicArenaServerToClientEvents,
        listener: (() => void) | PublicArenaServerToClientEvents[keyof PublicArenaServerToClientEvents]
      ) => {
        this.onAny(event, listener as (payload?: unknown) => void);
        return socket;
      }) as PublicArenaSocket['on'],
      emit: ((
        event: keyof PublicArenaClientToServerEvents,
        ...args: Parameters<PublicArenaClientToServerEvents[keyof PublicArenaClientToServerEvents]>
      ) => {
        this.emitAny(event, args[0]);
        return socket;
      }) as PublicArenaSocket['emit'],
      disconnect: () => {
        this.disconnectAny();
        return socket;
      }
    };
    return socket;
  }

  onAny(event: string, listener: (payload?: unknown) => void): void {
    const bucket = this.listeners.get(event) ?? [];
    bucket.push(listener);
    this.listeners.set(event, bucket);
  }

  emitAny(event: string, payload: unknown): void {
    this.emitted.push({ event, payload });
  }

  disconnectAny(): void {
    this.disconnectCalls += 1;
  }

  dispatch<EventName extends keyof PublicArenaServerToClientEvents>(
    event: EventName,
    payload: Parameters<PublicArenaServerToClientEvents[EventName]>[0]
  ): void;
  dispatch(event: 'connect' | 'disconnect'): void;
  dispatch(event: string, payload?: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(payload);
    }
  }
}

describe('PublicArenaClient', () => {
  it('sends the join request on socket connect', () => {
    const socket = new FakePublicArenaSocket();
    createPublicArenaClient(makeInit(socket));

    socket.dispatch('connect');

    expect(socket.emitted).toEqual([
      {
        event: PUBLIC_ARENA_EVENTS.join,
        payload: { protocolVersion: PUBLIC_ARENA_PROTOCOL_VERSION }
      }
    ]);
  });

  it('does not send input before join is accepted', () => {
    const socket = new FakePublicArenaSocket();
    const client = createPublicArenaClient(makeInit(socket));

    client.sendInput({ kind: 'fire', phase: 'start' });

    expect(socket.emitted).toEqual([]);
  });

  it('sends input after join is accepted', () => {
    const socket = new FakePublicArenaSocket();
    const client = createPublicArenaClient(makeInit(socket));

    socket.dispatch(PUBLIC_ARENA_EVENTS.joinAccepted, makeAccepted());
    client.sendInput({ kind: 'fire', phase: 'start' });

    expect(socket.emitted).toContainEqual({
      event: PUBLIC_ARENA_EVENTS.input,
      payload: { kind: 'fire', phase: 'start' }
    });
  });

  it('reports the accepted player identity and arena from the join handshake', () => {
    const socket = new FakePublicArenaSocket();
    const onAccepted = vi.fn();
    createPublicArenaClient(makeInit(socket, { onAccepted }));

    socket.dispatch(PUBLIC_ARENA_EVENTS.joinAccepted, makeAccepted());

    expect(onAccepted).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: 'player-a',
        arena: PUBLIC_ARENA_WORLD_BOUNDS
      })
    );
  });

  it('reports full arena rejection and disconnects', () => {
    const socket = new FakePublicArenaSocket();
    const onRejected = vi.fn();
    createPublicArenaClient(makeInit(socket, { onRejected }));

    socket.dispatch(PUBLIC_ARENA_EVENTS.joinRejected, {
      protocolVersion: PUBLIC_ARENA_PROTOCOL_VERSION,
      reason: 'arenaFull',
      message: PUBLIC_ARENA_FULL_MESSAGE,
      playerCap: 200,
      population: 200
    });

    expect(onRejected).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'arenaFull',
        message: PUBLIC_ARENA_FULL_MESSAGE
      })
    );
    expect(socket.disconnectCalls).toBe(1);
  });

  it('reports server close once when socket disconnect follows the close reason', () => {
    const socket = new FakePublicArenaSocket();
    const onClose = vi.fn();
    createPublicArenaClient(makeInit(socket, { onClose }));

    socket.dispatch(PUBLIC_ARENA_EVENTS.joinAccepted, makeAccepted());
    socket.dispatch(PUBLIC_ARENA_EVENTS.closeReason, {
      reason: 'serverShutdown',
      message: 'Arena server is restarting.'
    });
    socket.dispatch('disconnect');

    expect(onClose).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledWith({
      reason: 'serverShutdown',
      message: 'Arena server is restarting.'
    });
    expect(socket.disconnectCalls).toBe(1);
  });

  it('sends leave before client disconnect', () => {
    const socket = new FakePublicArenaSocket();
    const client = createPublicArenaClient(makeInit(socket));

    client.disconnect();

    expect(socket.emitted).toContainEqual({
      event: PUBLIC_ARENA_EVENTS.leave,
      payload: { reason: 'playerExit' }
    });
    expect(socket.disconnectCalls).toBe(1);
  });
});

function makeInit(
  socket: FakePublicArenaSocket,
  overrides: Partial<Parameters<typeof createPublicArenaClient>[0]> = {}
): Parameters<typeof createPublicArenaClient>[0] {
  return {
    serverUrl: 'https://arena.example.test',
    createSocket: () => socket.asSocket(),
    onAccepted() {},
    onRejected() {},
    onSnapshot() {},
    onPresentation() {},
    onClose() {},
    ...overrides
  };
}

function makeAccepted() {
  return {
    protocolVersion: PUBLIC_ARENA_PROTOCOL_VERSION,
    playerId: 'player-a',
    arena: PUBLIC_ARENA_WORLD_BOUNDS,
    playerCap: 200,
    population: 1,
    tickHz: 60,
    snapshotHz: 30
  } as const;
}
