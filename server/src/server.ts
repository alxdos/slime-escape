import { createServer, type Server as HttpServer, type ServerResponse } from 'node:http';

import { Server as SocketIOServer } from 'socket.io';

import type {
  PublicArenaClientToServerEvents,
  PublicArenaServerToClientEvents
} from '../../src/shared/publicArenaProtocol.js';
import {
  PUBLIC_ARENA_EVENTS,
  PUBLIC_ARENA_PROTOCOL_VERSION,
  type PublicArenaJoinRejected
} from '../../src/shared/publicArenaProtocol.js';
import { SIM_STEP_MS } from '../../src/shared/timing.js';
import { createPublicArenaState } from './arenaState.js';
import { createPublicArenaSimulation } from './arenaSimulation.js';
import type { PublicArenaServerConfig } from './config.js';

const PUBLIC_ARENA_ROOM = 'public-arena';
const PUBLIC_ARENA_PROTOCOL_MISMATCH_MESSAGE = 'The online arena connection is out of date. Please refresh.';

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
  const arena = createPublicArenaState({
    playerCap: config.playerCap,
    tickHz: config.tickHz,
    snapshotHz: config.snapshotHz
  });
  const simulation = createPublicArenaSimulation();
  let tickTimer: NodeJS.Timeout | null = null;

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

  io.on('connection', (socket) => {
    socket.on(PUBLIC_ARENA_EVENTS.join, (request) => {
      if (request.protocolVersion !== PUBLIC_ARENA_PROTOCOL_VERSION) {
        socket.emit(
          PUBLIC_ARENA_EVENTS.joinRejected,
          protocolMismatchRejection(arena.population(), config.playerCap)
        );
        return;
      }

      const result = arena.join(socket.id);
      if (result.kind === 'accepted') {
        simulation.addPlayer(result.member);
        void socket.join(PUBLIC_ARENA_ROOM);
        socket.emit(PUBLIC_ARENA_EVENTS.joinAccepted, result.message);
        return;
      }

      socket.emit(PUBLIC_ARENA_EVENTS.joinRejected, result.message);
    });

    socket.on(PUBLIC_ARENA_EVENTS.leave, () => {
      arena.leave(socket.id);
      simulation.removePlayer(socket.id);
      void socket.leave(PUBLIC_ARENA_ROOM);
    });

    socket.on(PUBLIC_ARENA_EVENTS.input, (intent) => {
      simulation.applyInput(socket.id, intent);
    });

    socket.on('disconnect', () => {
      arena.leave(socket.id);
      simulation.removePlayer(socket.id);
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
          if (tickTimer === null) {
            tickTimer = setInterval(() => {
              simulation.tick();
            }, SIM_STEP_MS);
          }
          resolve();
        });
      });
    },
    close() {
      if (tickTimer !== null) {
        clearInterval(tickTimer);
        tickTimer = null;
      }

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

function protocolMismatchRejection(population: number, playerCap: number): PublicArenaJoinRejected {
  return {
    protocolVersion: PUBLIC_ARENA_PROTOCOL_VERSION,
    reason: 'protocolMismatch',
    message: PUBLIC_ARENA_PROTOCOL_MISMATCH_MESSAGE,
    playerCap,
    population
  };
}
