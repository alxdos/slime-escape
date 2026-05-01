import { createServer, type Server as HttpServer, type ServerResponse } from 'node:http';

import { Server as SocketIOServer } from 'socket.io';

import {
  ARENA_HOST_PROTOCOL_VERSION,
  PUBLIC_ARENA_EVENTS,
  type PublicArenaClientToServerEvents,
  type PublicArenaCloseReason,
  type PublicArenaJoinAccepted,
  type PublicArenaJoinRejected,
  type PublicArenaServerToClientEvents
} from '../../src/shared/arenaHostProtocol.js';
import type { Snapshot } from '../../src/shared/snapshot.js';
import {
  ARENA_HOST_SERVER_SHUTDOWN_REASON,
  type ArenaHostEvent
} from './arena-host/host.js';
import {
  createOnlineSessionHost,
  type OnlineSessionHostJoinAccepted,
  type OnlineSessionHostJoinRejected
} from './online-host/host.js';
import type { PublicArenaServerConfig } from './config.js';

const PUBLIC_ARENA_PROTOCOL_MISMATCH_MESSAGE =
  'The online arena connection is out of date. Please refresh.';

type ArenaHostSocket = Readonly<{
  emit(eventName: string, payload: unknown): void;
  volatile: Readonly<{
    emit(eventName: string, payload: unknown): void;
  }>;
}>;

type ArenaHostSocketIo = Readonly<{
  emit(eventName: string, payload: unknown): void;
  sockets: Readonly<{
    sockets: ReadonlyMap<string, ArenaHostSocket>;
  }>;
}>;

export type PublicArenaServer = Readonly<{
  httpServer: HttpServer;
  io: SocketIOServer<PublicArenaClientToServerEvents, PublicArenaServerToClientEvents>;
  start(): Promise<void>;
  close(): Promise<void>;
}>;

function writeJson(res: ServerResponse, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(200, {
    'content-type': 'application/json',
    'cache-control': 'no-store'
  });
  res.end(payload);
}

export function createPublicArenaServer(config: PublicArenaServerConfig): PublicArenaServer {
  const httpServer = createServer((req, res) => {
    if (req.url === '/healthz') {
      writeJson(res, {
        ok: true,
        playerCap: config.playerCap,
        tickHz: config.tickHz,
        snapshotHz: config.snapshotHz
      });
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  });

  const io = new SocketIOServer<PublicArenaClientToServerEvents, PublicArenaServerToClientEvents>(
    httpServer,
    {
      cors: {
        origin: config.corsOrigin
      }
    }
  );
  const joinBuffers = new Map<string, ArenaHostJoinBuffer>();
  const onlineHost = createOnlineSessionHost({
    playerCap: config.playerCap,
    tickHz: config.tickHz,
    snapshotHz: config.snapshotHz,
    sink: {
      emitSnapshot(actorId, snapshot) {
        const buffer = joinBuffers.get(actorId);
        if (buffer !== undefined) {
          buffer.snapshots.push(snapshot);
          return;
        }
        emitArenaHostSnapshot(io as unknown as ArenaHostSocketIo, actorId, snapshot);
      },
      emitEvent(actorId, event) {
        const buffer = joinBuffers.get(actorId);
        if (buffer !== undefined) {
          buffer.events.push(event);
          return;
        }
        emitArenaHostEvent(io as unknown as ArenaHostSocketIo, actorId, event);
      },
      emitCloseReason(reason) {
        emitArenaHostServerShutdownReason(io, reason);
      }
    }
  });
  onlineHost.start();

  io.on('connection', (socket) => {
    socket.on(PUBLIC_ARENA_EVENTS.join, (request) => {
      if (request.protocolVersion !== ARENA_HOST_PROTOCOL_VERSION) {
        socket.emit(
          PUBLIC_ARENA_EVENTS.joinRejected,
          protocolMismatchRejection(onlineHost.population(), config.playerCap)
        );
        return;
      }

      const joinBuffer = beginArenaHostJoinBuffer(joinBuffers, socket.id);
      const result = onlineHost.join(socket.id, {
        requestedSessionId: request.requestedSessionId,
        selectedPetId: request.selectedPetId ?? null
      });
      const buffered = endArenaHostJoinBuffer(joinBuffers, socket.id);
      if (result.kind === 'accepted') {
        socket.emit(PUBLIC_ARENA_EVENTS.joinAccepted, arenaHostJoinAcceptedMessage(result));
        flushArenaHostJoinBuffer(io as unknown as ArenaHostSocketIo, socket.id, buffered);
        return;
      }

      joinBuffer.events.length = 0;
      joinBuffer.snapshots.length = 0;
      socket.emit(PUBLIC_ARENA_EVENTS.joinRejected, arenaHostJoinRejectedMessage(result));
    });

    socket.on(PUBLIC_ARENA_EVENTS.leave, () => {
      onlineHost.leave(socket.id);
    });

    socket.on(PUBLIC_ARENA_EVENTS.input, (intent) => {
      onlineHost.submitInput(socket.id, intent);
    });

    socket.on('disconnect', () => {
      onlineHost.leave(socket.id);
    });
  });

  return {
    httpServer,
    io,
    start() {
      return new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(config.port, config.host, () => {
          httpServer.off('error', reject);
          resolve();
        });
      });
    },
    close() {
      onlineHost.stop();

      return new Promise((resolve, reject) => {
        io.close((ioError) => {
          if (ioError !== undefined) {
            reject(ioError);
            return;
          }

          if (!httpServer.listening) {
            resolve();
            return;
          }

          httpServer.close((httpError) => {
            if (httpError !== undefined) {
              reject(httpError);
              return;
            }
            resolve();
          });
        });
      });
    }
  };
}

type ArenaHostJoinBuffer = {
  snapshots: Snapshot[];
  events: ArenaHostEvent[];
};

function beginArenaHostJoinBuffer(
  buffers: Map<string, ArenaHostJoinBuffer>,
  actorId: string
): ArenaHostJoinBuffer {
  const buffer = { snapshots: [], events: [] };
  buffers.set(actorId, buffer);
  return buffer;
}

function endArenaHostJoinBuffer(
  buffers: Map<string, ArenaHostJoinBuffer>,
  actorId: string
): ArenaHostJoinBuffer {
  const buffer = buffers.get(actorId) ?? { snapshots: [], events: [] };
  buffers.delete(actorId);
  return buffer;
}

function flushArenaHostJoinBuffer(
  io: ArenaHostSocketIo,
  actorId: string,
  buffer: ArenaHostJoinBuffer
): void {
  for (const snapshot of buffer.snapshots) {
    emitArenaHostSnapshot(io, actorId, snapshot);
  }
  for (const event of buffer.events) {
    emitArenaHostEvent(io, actorId, event);
  }
}

export function arenaHostJoinAcceptedMessage(
  result: OnlineSessionHostJoinAccepted
): PublicArenaJoinAccepted {
  return {
    protocolVersion: ARENA_HOST_PROTOCOL_VERSION,
    roomId: result.roomId,
    sessionConfigId: result.sessionConfigId,
    actorId: result.actorId,
    arena: result.arena,
    playerCap: result.playerCap,
    population: result.population,
    maxPlayers: result.maxPlayers,
    lateJoinAllowed: result.lateJoinAllowed,
    roomState: result.roomState,
    tickHz: result.tickHz,
    snapshotHz: result.snapshotHz
  };
}

export function arenaHostJoinRejectedMessage(
  result: OnlineSessionHostJoinRejected
): PublicArenaJoinRejected {
  return {
    protocolVersion: ARENA_HOST_PROTOCOL_VERSION,
    reason: result.reason,
    message: result.message,
    playerCap: result.playerCap,
    population: result.population
  };
}

export function protocolMismatchRejection(
  population: number,
  playerCap: number
): PublicArenaJoinRejected {
  return {
    protocolVersion: ARENA_HOST_PROTOCOL_VERSION,
    reason: 'protocolMismatch',
    message: PUBLIC_ARENA_PROTOCOL_MISMATCH_MESSAGE,
    playerCap,
    population
  };
}

export function emitArenaHostSnapshot(
  io: ArenaHostSocketIo,
  actorId: string,
  snapshot: Snapshot
): void {
  io.sockets.sockets.get(actorId)?.volatile.emit(PUBLIC_ARENA_EVENTS.snapshot, snapshot);
}

export function emitArenaHostEvent(
  io: ArenaHostSocketIo,
  actorId: string,
  event: ArenaHostEvent
): void {
  io.sockets.sockets.get(actorId)?.emit(PUBLIC_ARENA_EVENTS.presentation, event);
}

export function emitArenaHostServerShutdownReason(
  io: Pick<SocketIOServer<PublicArenaClientToServerEvents, PublicArenaServerToClientEvents>, 'emit'>,
  reason: PublicArenaCloseReason = ARENA_HOST_SERVER_SHUTDOWN_REASON
): void {
  io.emit(PUBLIC_ARENA_EVENTS.closeReason, reason);
}
