import { createServer, type Server as HttpServer, type ServerResponse } from 'node:http';

import { Server as SocketIOServer } from 'socket.io';

import type {
  PublicArenaClientToServerEvents,
  PublicArenaServerToClientEvents
} from '../../src/shared/publicArenaProtocol.js';
import {
  PUBLIC_ARENA_EVENTS,
  PUBLIC_ARENA_PROTOCOL_VERSION,
  type PublicArenaCloseReason,
  type PublicArenaJoinRejected,
  type PublicArenaPresentationEvent,
  type PublicArenaPlayerId
} from '../../src/shared/publicArenaProtocol.js';
import { SIM_STEP_MS, SNAPSHOT_INTERVAL_MS } from '../../src/shared/timing.js';
import { createPublicArenaState, type PublicArenaMember } from './arenaState.js';
import { createPublicArenaSimulation } from './arenaSimulation.js';
import type { PublicArenaServerConfig } from './config.js';

const PUBLIC_ARENA_ROOM = 'public-arena';
const PUBLIC_ARENA_PROTOCOL_MISMATCH_MESSAGE = 'The online arena connection is out of date. Please refresh.';
export const PUBLIC_ARENA_INPUT_RATE_LIMIT_MAX = 240;
export const PUBLIC_ARENA_INPUT_RATE_LIMIT_WINDOW_MS = 1000;
export const PUBLIC_ARENA_SERVER_SHUTDOWN_REASON: PublicArenaCloseReason = {
  reason: 'serverShutdown',
  message: 'Arena server is restarting.'
};

export type PublicArenaInputRateLimitState = {
  windowStartedAtMs: number;
  acceptedInWindow: number;
};

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
  let snapshotTimer: NodeJS.Timeout | null = null;

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
    const inputRateLimit = createPublicArenaInputRateLimitState(Date.now());

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
      if (!acceptPublicArenaInputIntent(inputRateLimit, Date.now())) {
        return;
      }
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
          if (snapshotTimer === null) {
            snapshotTimer = setInterval(() => {
              publishPresentationEvents(io, arena.members(), simulation.drainEvents());
              publishSnapshots(io, arena.members(), simulation);
            }, SNAPSHOT_INTERVAL_MS);
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
      if (snapshotTimer !== null) {
        clearInterval(snapshotTimer);
        snapshotTimer = null;
      }

      emitPublicArenaServerShutdownReason(io);

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

export function createPublicArenaInputRateLimitState(
  nowMs: number
): PublicArenaInputRateLimitState {
  return {
    windowStartedAtMs: nowMs,
    acceptedInWindow: 0
  };
}

export function acceptPublicArenaInputIntent(
  state: PublicArenaInputRateLimitState,
  nowMs: number
): boolean {
  if (
    nowMs < state.windowStartedAtMs ||
    nowMs - state.windowStartedAtMs >= PUBLIC_ARENA_INPUT_RATE_LIMIT_WINDOW_MS
  ) {
    state.windowStartedAtMs = nowMs;
    state.acceptedInWindow = 0;
  }

  if (state.acceptedInWindow >= PUBLIC_ARENA_INPUT_RATE_LIMIT_MAX) {
    return false;
  }

  state.acceptedInWindow += 1;
  return true;
}

export function emitPublicArenaServerShutdownReason(
  io: Pick<
    SocketIOServer<PublicArenaClientToServerEvents, PublicArenaServerToClientEvents>,
    'emit'
  >
): void {
  io.emit(PUBLIC_ARENA_EVENTS.closeReason, PUBLIC_ARENA_SERVER_SHUTDOWN_REASON);
}

function publishSnapshots(
  io: SocketIOServer<PublicArenaClientToServerEvents, PublicArenaServerToClientEvents>,
  members: ReadonlyArray<PublicArenaMember>,
  simulation: ReturnType<typeof createPublicArenaSimulation>
): void {
  for (const member of members) {
    const socket = io.sockets.sockets.get(member.socketId);
    if (socket === undefined) {
      continue;
    }
    const snapshot = simulation.snapshotFor(member.playerId);
    if (snapshot === null) {
      continue;
    }
    socket.volatile.emit(PUBLIC_ARENA_EVENTS.snapshot, snapshot);
  }
}

export function publishPresentationEvents(
  io: SocketIOServer<PublicArenaClientToServerEvents, PublicArenaServerToClientEvents>,
  members: ReadonlyArray<PublicArenaMember>,
  events: ReadonlyArray<PublicArenaPresentationEvent>
): void {
  const socketsByPlayerId = new Map<PublicArenaPlayerId, PublicArenaMember>();
  for (const member of members) {
    socketsByPlayerId.set(member.playerId, member);
  }

  for (const event of events) {
    for (const playerId of publicArenaPresentationRecipients(event, members)) {
      const member = socketsByPlayerId.get(playerId);
      if (member === undefined) {
        continue;
      }
      const socket = io.sockets.sockets.get(member.socketId);
      socket?.emit(PUBLIC_ARENA_EVENTS.presentation, event);
    }
  }
}

function publicArenaPresentationRecipients(
  event: PublicArenaPresentationEvent,
  members: ReadonlyArray<PublicArenaMember>
): ReadonlyArray<PublicArenaPlayerId> {
  switch (event.kind) {
    case 'fire':
      return [event.shooterId];
    case 'hit':
      return uniquePlayerIds([event.ownerId, event.targetId]);
    case 'explosion':
      return [event.ownerId];
    case 'death':
      return members.map((member) => member.playerId);
    case 'levelUp':
    case 'spawn':
      return [event.playerId];
    default:
      return event satisfies never;
  }
}

function uniquePlayerIds(
  playerIds: ReadonlyArray<PublicArenaPlayerId>
): ReadonlyArray<PublicArenaPlayerId> {
  return Array.from(new Set(playerIds));
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
