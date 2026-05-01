import type { InputCommand } from './input.js';
import type { RuntimeEvent } from './events.js';
import type { Snapshot } from './snapshot.js';
import type { ModePresetId } from './content/sessions.js';

export const ARENA_HOST_PROTOCOL_VERSION = 7;
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

export type PublicArenaWorldBounds = Readonly<{
  width: number;
  height: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}>;

export type PublicArenaRoomState = 'open' | 'running';

export type PublicArenaJoinRequest = Readonly<{
  protocolVersion: typeof ARENA_HOST_PROTOCOL_VERSION;
  requestedSessionId?: ModePresetId;
  selectedPetId?: string | null;
}>;

export type PublicArenaJoinAccepted = Readonly<{
  protocolVersion: typeof ARENA_HOST_PROTOCOL_VERSION;
  roomId?: string;
  sessionConfigId?: ModePresetId;
  actorId: PublicArenaPlayerId;
  arena: PublicArenaWorldBounds;
  playerCap: number;
  population: number;
  maxPlayers?: number;
  lateJoinAllowed?: boolean;
  roomState?: PublicArenaRoomState;
  tickHz: number;
  snapshotHz: number;
}>;

export type PublicArenaJoinRejectedReason =
  | 'arenaFull'
  | 'roomFull'
  | 'sessionInProgress'
  | 'unknownSession'
  | 'protocolMismatch'
  | 'serverError';

export type PublicArenaJoinRejected = Readonly<{
  protocolVersion: typeof ARENA_HOST_PROTOCOL_VERSION;
  reason: PublicArenaJoinRejectedReason;
  message: string;
  playerCap: number | null;
  population: number | null;
}>;

export type PublicArenaLobbyControlIntent =
  | Readonly<{ kind: 'lobby:start' }>
  | Readonly<{ kind: 'lobby:transferHost'; targetActorId: string }>;

export type PublicArenaInputIntent = Extract<
  InputCommand,
  { kind: 'move' } | { kind: 'aim' } | { kind: 'fire' } | { kind: 'selectWeaponSlot' }
> | PublicArenaLobbyControlIntent;

export type PublicArenaLeaveRequest = Readonly<{
  reason: 'playerExit' | 'pageUnload';
}>;

export type PublicArenaCloseReason = Readonly<{
  reason: 'serverShutdown' | 'protocolError' | 'serverError';
  message: string;
}>;

export type ArenaHostLevelUpEvent = Readonly<{
  kind: 'host:levelUp';
  simTime: number;
  actorId: string;
  level: number;
  formArchetypeId: string;
}>;

export type ArenaHostLobbyJoinedActor = Readonly<{
  actorId: string;
  petArchetypeId: string | null;
}>;

export type ArenaHostLobbyStateEvent = Readonly<{
  kind: 'host:lobby:state';
  simTime: number;
  roomId: string;
  sessionConfigId: ModePresetId;
  state: PublicArenaRoomState;
  joined: ReadonlyArray<ArenaHostLobbyJoinedActor>;
  hostActorId: string;
  maxPlayers: number;
  lateJoinAllowed: boolean;
}>;

export type ArenaHostLobbyHostChangedEvent = Readonly<{
  kind: 'host:lobby:hostChanged';
  simTime: number;
  roomId: string;
  previousHostActorId: string | null;
  newHostActorId: string;
}>;

export type ArenaHostLobbyStartEvent = Readonly<{
  kind: 'host:lobby:start';
  simTime: number;
  roomId: string;
}>;

export type ArenaHostLobbyEvent =
  | ArenaHostLobbyStateEvent
  | ArenaHostLobbyHostChangedEvent
  | ArenaHostLobbyStartEvent;

export type ArenaHostEvent = RuntimeEvent | ArenaHostLevelUpEvent | ArenaHostLobbyEvent;

export type PublicArenaClientToServerEvents = {
  [PUBLIC_ARENA_EVENTS.join]: (request: PublicArenaJoinRequest) => void;
  [PUBLIC_ARENA_EVENTS.input]: (intent: PublicArenaInputIntent) => void;
  [PUBLIC_ARENA_EVENTS.leave]: (request: PublicArenaLeaveRequest) => void;
};

export type PublicArenaServerToClientEvents = {
  [PUBLIC_ARENA_EVENTS.joinAccepted]: (message: PublicArenaJoinAccepted) => void;
  [PUBLIC_ARENA_EVENTS.joinRejected]: (message: PublicArenaJoinRejected) => void;
  [PUBLIC_ARENA_EVENTS.snapshot]: (snapshot: Snapshot) => void;
  [PUBLIC_ARENA_EVENTS.presentation]: (event: ArenaHostEvent) => void;
  [PUBLIC_ARENA_EVENTS.closeReason]: (reason: PublicArenaCloseReason) => void;
};
