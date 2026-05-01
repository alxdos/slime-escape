import {
  PUBLIC_ARENA_FULL_MESSAGE,
  ARENA_HOST_PROTOCOL_VERSION,
  type PublicArenaJoinAccepted,
  type PublicArenaJoinRejected,
  type PublicArenaPlayerId,
  type PublicArenaWorldBounds
} from '../../src/shared/publicArenaProtocol.js';
import {
  PUBLIC_ARENA_ARENA as SHARED_PUBLIC_ARENA_ARENA,
  PUBLIC_ARENA_WORLD_BOUNDS as SHARED_PUBLIC_ARENA_WORLD_BOUNDS
} from '../../src/shared/content/publicArena.js';
import { PUBLIC_ARENA_REGULAR_FORM_STATS } from '../../src/shared/publicArenaProgression.js';

export const PUBLIC_ARENA_SPAWN_INSET_WU = 4;

export const PUBLIC_ARENA_ARENA = SHARED_PUBLIC_ARENA_ARENA;
export const PUBLIC_ARENA_WORLD_BOUNDS: PublicArenaWorldBounds =
  SHARED_PUBLIC_ARENA_WORLD_BOUNDS;
export const PUBLIC_ARENA_WORLD_SIZE_WU = PUBLIC_ARENA_ARENA.width;

const PUBLIC_ARENA_LEVEL_ONE_RADIUS_WU = requireLevelOneRadius();
const SPAWN_OFFSET_X = spawnOffsetForAxis(
  PUBLIC_ARENA_WORLD_BOUNDS.minX,
  PUBLIC_ARENA_WORLD_BOUNDS.maxX
);
const SPAWN_OFFSET_Y = spawnOffsetForAxis(
  PUBLIC_ARENA_WORLD_BOUNDS.minY,
  PUBLIC_ARENA_WORLD_BOUNDS.maxY
);

export const PUBLIC_ARENA_CORNER_SPAWNS: ReadonlyArray<PublicArenaSpawnPoint> = [
  { x: -SPAWN_OFFSET_X, y: -SPAWN_OFFSET_Y },
  { x: SPAWN_OFFSET_X, y: -SPAWN_OFFSET_Y },
  { x: SPAWN_OFFSET_X, y: SPAWN_OFFSET_Y },
  { x: -SPAWN_OFFSET_X, y: SPAWN_OFFSET_Y }
];

export type PublicArenaSpawnPoint = Readonly<{
  x: number;
  y: number;
}>;

export type PublicArenaMember = Readonly<{
  socketId: string;
  playerId: PublicArenaPlayerId;
  spawn: PublicArenaSpawnPoint;
  level: 1;
}>;

export type PublicArenaStateOptions = Readonly<{
  playerCap: number;
  tickHz: number;
  snapshotHz: number;
}>;

export type PublicArenaJoinResult =
  | Readonly<{
      kind: 'accepted';
      member: PublicArenaMember;
      message: PublicArenaJoinAccepted;
    }>
  | Readonly<{
      kind: 'rejected';
      message: PublicArenaJoinRejected;
    }>;

export type PublicArenaState = Readonly<{
  population(): number;
  memberForSocket(socketId: string): PublicArenaMember | null;
  members(): ReadonlyArray<PublicArenaMember>;
  join(socketId: string): PublicArenaJoinResult;
  leave(socketId: string): PublicArenaMember | null;
}>;

export function createPublicArenaState(options: PublicArenaStateOptions): PublicArenaState {
  const membersBySocket = new Map<string, PublicArenaMember>();
  let nextSpawnIndex = 0;

  function acceptedMessage(member: PublicArenaMember): PublicArenaJoinAccepted {
    return {
      protocolVersion: ARENA_HOST_PROTOCOL_VERSION,
      actorId: member.playerId,
      arena: PUBLIC_ARENA_WORLD_BOUNDS,
      playerCap: options.playerCap,
      population: membersBySocket.size,
      tickHz: options.tickHz,
      snapshotHz: options.snapshotHz
    };
  }

  function rejectedFullMessage(): PublicArenaJoinRejected {
    return {
      protocolVersion: ARENA_HOST_PROTOCOL_VERSION,
      reason: 'arenaFull',
      message: PUBLIC_ARENA_FULL_MESSAGE,
      playerCap: options.playerCap,
      population: membersBySocket.size
    };
  }

  function nextSpawn(): PublicArenaSpawnPoint {
    const spawn = PUBLIC_ARENA_CORNER_SPAWNS[nextSpawnIndex % PUBLIC_ARENA_CORNER_SPAWNS.length];
    if (spawn === undefined) {
      throw new Error('public arena must have at least one spawn point');
    }
    nextSpawnIndex += 1;
    return spawn;
  }

  return {
    population() {
      return membersBySocket.size;
    },
    memberForSocket(socketId) {
      return membersBySocket.get(socketId) ?? null;
    },
    members() {
      return [...membersBySocket.values()];
    },
    join(socketId) {
      const existingMember = membersBySocket.get(socketId);
      if (existingMember !== undefined) {
        return {
          kind: 'accepted',
          member: existingMember,
          message: acceptedMessage(existingMember)
        };
      }

      if (membersBySocket.size >= options.playerCap) {
        return {
          kind: 'rejected',
          message: rejectedFullMessage()
        };
      }

      const member: PublicArenaMember = {
        socketId,
        playerId: socketId,
        spawn: nextSpawn(),
        level: 1
      };
      membersBySocket.set(socketId, member);

      return {
        kind: 'accepted',
        member,
        message: acceptedMessage(member)
      };
    },
    leave(socketId) {
      const member = membersBySocket.get(socketId);
      if (member === undefined) {
        return null;
      }
      membersBySocket.delete(socketId);
      return member;
    }
  };
}

function spawnOffsetForAxis(min: number, max: number): number {
  const halfSize = (max - min) / 2;
  const inset = Math.max(PUBLIC_ARENA_SPAWN_INSET_WU, PUBLIC_ARENA_LEVEL_ONE_RADIUS_WU);
  const insetOffset = Math.max(0, halfSize - inset);
  const radiusSafeOffset = Math.max(0, halfSize - PUBLIC_ARENA_LEVEL_ONE_RADIUS_WU);
  return Math.min(insetOffset, radiusSafeOffset);
}

function requireLevelOneRadius(): number {
  const levelOne = PUBLIC_ARENA_REGULAR_FORM_STATS[0];
  if (levelOne === undefined) {
    throw new Error('public arena requires at least one regular form for spawn placement');
  }
  return levelOne.radius;
}
