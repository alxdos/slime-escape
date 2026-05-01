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
  createArenaHost,
  type ArenaHostEvent,
  type ArenaHostJoinAccepted,
  type ArenaHostJoinRejected
} from './arena-host/host.js';
import type { PublicArenaServerConfig } from './config.js';

const PUBLIC_ARENA_ROOM = 'public-arena';
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
  const arenaHost = createArenaHost({
    playerCap: config.playerCap,
    tickHz: config.tickHz,
    snapshotHz: config.snapshotHz,
    sink: {
      emitSnapshot(actorId, snapshot) {
        emitArenaHostSnapshot(io as unknown as ArenaHostSocketIo, actorId, snapshot);
      },
      emitEvent(actorId, event) {
        emitArenaHostEvent(io as unknown as ArenaHostSocketIo, actorId, event);
      },
      emitCloseReason(reason) {
        emitArenaHostServerShutdownReason(io, reason);
      }
    }
  });

  io.on('connection', (socket) => {
    socket.on(PUBLIC_ARENA_EVENTS.join, (request) => {
      if (request.protocolVersion !== ARENA_HOST_PROTOCOL_VERSION) {
        socket.emit(
          PUBLIC_ARENA_EVENTS.joinRejected,
          protocolMismatchRejection(arenaHost.population(), config.playerCap)
        );
        return;
      }

      const result = arenaHost.join(socket.id);
      if (result.kind === 'accepted') {
        void socket.join(PUBLIC_ARENA_ROOM);
        socket.emit(PUBLIC_ARENA_EVENTS.joinAccepted, arenaHostJoinAcceptedMessage(result));
        return;
      }

      socket.emit(PUBLIC_ARENA_EVENTS.joinRejected, arenaHostJoinRejectedMessage(result));
    });

    socket.on(PUBLIC_ARENA_EVENTS.leave, () => {
      arenaHost.leave(socket.id);
      void socket.leave(PUBLIC_ARENA_ROOM);
    });

    socket.on(PUBLIC_ARENA_EVENTS.input, (intent) => {
      arenaHost.submitInput(socket.id, intent);
    });

    socket.on('disconnect', () => {
      arenaHost.leave(socket.id);
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
          arenaHost.start();
          resolve();
        });
      });
    },
    close() {
      arenaHost.stop();

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

export function arenaHostJoinAcceptedMessage(
  result: ArenaHostJoinAccepted
): PublicArenaJoinAccepted {
  return {
    protocolVersion: ARENA_HOST_PROTOCOL_VERSION,
    actorId: result.actorId,
    arena: result.arena,
    playerCap: result.playerCap,
    population: result.population,
    tickHz: result.tickHz,
    snapshotHz: result.snapshotHz
  };
}

export function arenaHostJoinRejectedMessage(
  result: ArenaHostJoinRejected
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
