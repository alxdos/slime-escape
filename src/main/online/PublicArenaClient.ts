import { io } from 'socket.io-client';

import {
  PUBLIC_ARENA_EVENTS,
  ARENA_HOST_PROTOCOL_VERSION,
  type ArenaHostEvent,
  type PublicArenaClientToServerEvents,
  type PublicArenaCloseReason,
  type PublicArenaInputIntent,
  type PublicArenaJoinAccepted,
  type PublicArenaJoinRejected,
  type PublicArenaServerToClientEvents
} from '../../shared/publicArenaProtocol';
import type { Snapshot } from '../../shared/snapshot';

export type PublicArenaSocket = Readonly<{
  on(event: 'connect' | 'disconnect', listener: () => void): PublicArenaSocket;
  on<EventName extends keyof PublicArenaServerToClientEvents>(
    event: EventName,
    listener: PublicArenaServerToClientEvents[EventName]
  ): PublicArenaSocket;
  emit<EventName extends keyof PublicArenaClientToServerEvents>(
    event: EventName,
    ...args: Parameters<PublicArenaClientToServerEvents[EventName]>
  ): PublicArenaSocket;
  disconnect(): PublicArenaSocket;
}>;

export type PublicArenaClientInit = Readonly<{
  serverUrl: string;
  createSocket?: (serverUrl: string) => PublicArenaSocket;
  onAccepted(message: PublicArenaJoinAccepted): void;
  onRejected(message: PublicArenaJoinRejected): void;
  onSnapshot(snapshot: Snapshot): void;
  onPresentation(event: ArenaHostEvent): void;
  onClose(reason: PublicArenaCloseReason): void;
}>;

export type PublicArenaClient = Readonly<{
  sendInput(intent: PublicArenaInputIntent): void;
  disconnect(): void;
}>;

const CLIENT_CLOSE_MESSAGE = 'Disconnected from the online arena.';

export function createPublicArenaClient(init: PublicArenaClientInit): PublicArenaClient {
  const socket = init.createSocket?.(init.serverUrl) ?? (io(init.serverUrl) as PublicArenaSocket);
  let closed = false;
  let accepted: PublicArenaJoinAccepted | null = null;

  function reportClose(reason: PublicArenaCloseReason): void {
    if (closed) {
      return;
    }
    closed = true;
    init.onClose(reason);
  }

  socket.on('connect', () => {
    if (closed) {
      return;
    }
    socket.emit(PUBLIC_ARENA_EVENTS.join, {
      protocolVersion: ARENA_HOST_PROTOCOL_VERSION
    });
  });

  socket.on(PUBLIC_ARENA_EVENTS.joinAccepted, (message) => {
    accepted = message;
    init.onAccepted(message);
  });

  socket.on(PUBLIC_ARENA_EVENTS.joinRejected, (message) => {
    if (closed) {
      return;
    }
    closed = true;
    init.onRejected(message);
    socket.disconnect();
  });

  socket.on(PUBLIC_ARENA_EVENTS.snapshot, (snapshot) => {
    init.onSnapshot(snapshot);
  });

  socket.on(PUBLIC_ARENA_EVENTS.presentation, (event) => {
    init.onPresentation(event);
  });

  socket.on(PUBLIC_ARENA_EVENTS.closeReason, (reason) => {
    reportClose(reason);
    socket.disconnect();
  });

  socket.on('disconnect', () => {
    if (closed || accepted === null) {
      return;
    }
    reportClose({
      reason: 'serverError',
      message: CLIENT_CLOSE_MESSAGE
    });
  });

  return {
    sendInput(intent): void {
      if (closed || accepted === null) {
        return;
      }
      socket.emit(PUBLIC_ARENA_EVENTS.input, intent);
    },
    disconnect(): void {
      if (closed) {
        return;
      }
      closed = true;
      socket.emit(PUBLIC_ARENA_EVENTS.leave, { reason: 'playerExit' });
      socket.disconnect();
    }
  };
}
