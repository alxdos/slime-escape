import type { InputCommand } from './input.js';

export const PUBLIC_ARENA_PROTOCOL_VERSION = 2;
export const PUBLIC_ARENA_FULL_MESSAGE = 'The online arena is full. Try again soon.';

export const PUBLIC_ARENA_EVENTS = {
  join: 'publicArena:join',
  leave: 'publicArena:leave',
  input: 'publicArena:input',
  joinAccepted: 'publicArena:joinAccepted',
  joinRejected: 'publicArena:joinRejected',
  snapshot: 'publicArena:snapshot',
  presentation: 'publicArena:presentation',
  closeReason: 'publicArena:closeReason'
} as const;

export type PublicArenaPlayerId = string;
export type PublicArenaProjectileId = string;

export type PublicArenaWorldBounds = Readonly<{
  width: number;
  height: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}>;

export type PublicArenaJoinRequest = Readonly<{
  protocolVersion: typeof PUBLIC_ARENA_PROTOCOL_VERSION;
}>;

export type PublicArenaJoinAccepted = Readonly<{
  protocolVersion: typeof PUBLIC_ARENA_PROTOCOL_VERSION;
  playerId: PublicArenaPlayerId;
  arena: PublicArenaWorldBounds;
  playerCap: number;
  population: number;
  tickHz: number;
  snapshotHz: number;
}>;

export type PublicArenaJoinRejectedReason =
  | 'arenaFull'
  | 'protocolMismatch'
  | 'serverError';

export type PublicArenaJoinRejected = Readonly<{
  protocolVersion: typeof PUBLIC_ARENA_PROTOCOL_VERSION;
  reason: PublicArenaJoinRejectedReason;
  message: string;
  playerCap: number | null;
  population: number | null;
}>;

export type PublicArenaInputIntent = Extract<
  InputCommand,
  { kind: 'move' } | { kind: 'aim' } | { kind: 'fire' }
>;

export type PublicArenaLeaveRequest = Readonly<{
  reason: 'playerExit' | 'pageUnload';
}>;

export type PublicArenaPlayerFormSnapshot =
  | Readonly<{
      kind: 'slime';
      archetypeId: string;
    }>
  | Readonly<{
      kind: 'boss';
      archetypeId: string;
    }>;

export type PublicArenaPlayerSnapshot = Readonly<{
  id: PublicArenaPlayerId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  level: number;
  form: PublicArenaPlayerFormSnapshot;
}>;

export type PublicArenaProjectileSnapshot = Readonly<{
  id: PublicArenaProjectileId;
  ownerId: PublicArenaPlayerId;
  ownerKind: 'player' | 'boss';
  weaponArchetypeId: string;
  originX: number;
  originY: number;
  x: number;
  y: number;
  size: Readonly<{ width: number; height: number }>;
  state: 'flying' | 'grounded';
  visualState: Readonly<{
    angleRadians: number;
    spinRadians: number;
    pulsePhase: number;
  }>;
  explosionRadius: number | null;
  detonateAtSimMs: number | null;
  arcEnd: Readonly<{ x: number; y: number }> | null;
  angleRadians: number;
}>;

export type PublicArenaSnapshot = Readonly<{
  simTimeMs: number;
  selfId: PublicArenaPlayerId;
  arena: PublicArenaWorldBounds;
  population: number;
  players: ReadonlyArray<PublicArenaPlayerSnapshot>;
  projectiles: ReadonlyArray<PublicArenaProjectileSnapshot>;
}>;

export type PublicArenaPresentationEvent =
  | Readonly<{
      kind: 'fire';
      simTimeMs: number;
      shooterId: PublicArenaPlayerId;
      ownerKind: 'player' | 'boss';
      weaponArchetypeId: string;
      originX: number;
      originY: number;
      dirX: number;
      dirY: number;
    }>
  | Readonly<{
      kind: 'hit';
      simTimeMs: number;
      projectileId: PublicArenaProjectileId;
      targetId: PublicArenaPlayerId;
      weaponArchetypeId: string;
      damage: number;
      x: number;
      y: number;
      impactDirX: number;
      impactDirY: number;
    }>
  | Readonly<{
      kind: 'explosion';
      simTimeMs: number;
      projectileId: PublicArenaProjectileId;
      ownerId: PublicArenaPlayerId;
      ownerKind: 'player' | 'boss';
      weaponArchetypeId: string;
      damage: number;
      radius: number;
      x: number;
      y: number;
    }>
  | Readonly<{
      kind: 'death';
      simTimeMs: number;
      playerId: PublicArenaPlayerId;
      killerId: PublicArenaPlayerId | null;
      weaponArchetypeId: string | null;
      x: number;
      y: number;
    }>
  | Readonly<{
      kind: 'levelUp';
      simTimeMs: number;
      playerId: PublicArenaPlayerId;
      level: number;
      form: PublicArenaPlayerFormSnapshot;
    }>
  | Readonly<{
      kind: 'spawn';
      simTimeMs: number;
      playerId: PublicArenaPlayerId;
      x: number;
      y: number;
      level: number;
      form: PublicArenaPlayerFormSnapshot;
    }>;

export type PublicArenaCloseReason = Readonly<{
  reason: 'serverShutdown' | 'protocolError' | 'serverError';
  message: string;
}>;

export type PublicArenaClientToServerEvents = {
  [PUBLIC_ARENA_EVENTS.join]: (request: PublicArenaJoinRequest) => void;
  [PUBLIC_ARENA_EVENTS.input]: (intent: PublicArenaInputIntent) => void;
  [PUBLIC_ARENA_EVENTS.leave]: (request: PublicArenaLeaveRequest) => void;
};

export type PublicArenaServerToClientEvents = {
  [PUBLIC_ARENA_EVENTS.joinAccepted]: (message: PublicArenaJoinAccepted) => void;
  [PUBLIC_ARENA_EVENTS.joinRejected]: (message: PublicArenaJoinRejected) => void;
  [PUBLIC_ARENA_EVENTS.snapshot]: (snapshot: PublicArenaSnapshot) => void;
  [PUBLIC_ARENA_EVENTS.presentation]: (event: PublicArenaPresentationEvent) => void;
  [PUBLIC_ARENA_EVENTS.closeReason]: (reason: PublicArenaCloseReason) => void;
};
