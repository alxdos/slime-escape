import type { SessionDefinition, Vec2 } from '../../../src/shared/session.js';
import type { Snapshot } from '../../../src/shared/snapshot.js';
import type { PublicArenaCloseReason } from '../../../src/shared/arenaHostProtocol.js';
import {
  type ArenaActorProgressionState,
  type ArenaHostEvent
} from './policy.js';

export type { ArenaHostEvent, ArenaHostLevelUpEvent } from './policy.js';

export const ARENA_HOST_INPUT_RATE_LIMIT_MAX = 240;
export const ARENA_HOST_INPUT_RATE_LIMIT_WINDOW_MS = 1000;
export const ARENA_HOST_SPAWN_INSET_WU = 4;
export const ARENA_HOST_SERVER_SHUTDOWN_REASON: PublicArenaCloseReason = {
  reason: 'serverShutdown',
  message: 'Arena server is restarting.'
};

export type ArenaHostInputRateLimitState = {
  windowStartedAtMs: number;
  acceptedInWindow: number;
};

export type ArenaHostClock = Readonly<{
  nowMs(): number;
  setInterval(handler: () => void, intervalMs: number): unknown;
  clearInterval(handle: unknown): void;
}>;

export type ArenaHostSink = Readonly<{
  emitSnapshot(actorId: string, snapshot: Snapshot): void;
  emitEvent(actorId: string, event: ArenaHostEvent): void;
  emitCloseReason(reason: PublicArenaCloseReason): void;
}>;

export function createArenaHostInputRateLimitState(
  nowMs: number
): ArenaHostInputRateLimitState {
  return {
    windowStartedAtMs: nowMs,
    acceptedInWindow: 0
  };
}

export function acceptArenaHostInputIntent(
  state: ArenaHostInputRateLimitState,
  nowMs: number
): boolean {
  if (
    nowMs < state.windowStartedAtMs ||
    nowMs - state.windowStartedAtMs >= ARENA_HOST_INPUT_RATE_LIMIT_WINDOW_MS
  ) {
    state.windowStartedAtMs = nowMs;
    state.acceptedInWindow = 0;
  }
  if (state.acceptedInWindow >= ARENA_HOST_INPUT_RATE_LIMIT_MAX) return false;
  state.acceptedInWindow += 1;
  return true;
}

export function arenaHostEventRecipients(
  event: ArenaHostEvent,
  actorsByActorId: ReadonlyMap<string, ArenaActorProgressionState>
): ReadonlyArray<string> {
  switch (event.kind) {
    case 'fire':
      return actorIdForEntity(actorsByActorId, event.shooterId);
    case 'hit':
      return uniqueActorIds([
        ...(event.ownerKind === 'player'
          ? actorIdForEntity(actorsByActorId, event.ownerId)
          : []),
        ...(event.targetKind === 'player'
          ? actorIdForEntity(actorsByActorId, event.targetId)
          : [])
      ]);
    case 'explosion':
      return event.ownerKind === 'player'
        ? actorIdForEntity(actorsByActorId, event.ownerId)
        : [];
    case 'playerSpawn':
      return actorsByActorId.has(event.playerId) ? [event.playerId] : [];
    case 'host:levelUp':
      return actorsByActorId.has(event.actorId) ? [event.actorId] : [];
    case 'host:lobby:hostChanged':
    case 'host:lobby:start':
    case 'host:lobby:state':
      return [...actorsByActorId.keys()];
    case 'death':
    case 'bossPhaseChange':
    case 'companionBoop':
    case 'companionDowned':
    case 'companionRescued':
    case 'dropExpire':
    case 'dropPickup':
    case 'dropSpawn':
    case 'encounterEnd':
    case 'encounterStart':
    case 'loss':
    case 'pause':
    case 'playerDowned':
    case 'playerRevived':
    case 'resume':
    case 'sessionStart':
    case 'sessionStop':
    case 'win':
      return [...actorsByActorId.keys()];
    default:
      return assertNever(event);
  }
}

export function cornerSpawns(
  arena: SessionDefinition['arena'],
  actorRadius: number,
  insetWu = ARENA_HOST_SPAWN_INSET_WU
): ReadonlyArray<Vec2> {
  const halfWidth = arena.width / 2;
  const halfHeight = arena.height / 2;
  const x = spawnOffsetForAxis(halfWidth, actorRadius, insetWu);
  const y = spawnOffsetForAxis(halfHeight, actorRadius, insetWu);
  return [
    { x: -x, y: -y },
    { x, y: -y },
    { x, y },
    { x: -x, y }
  ];
}

function spawnOffsetForAxis(halfSize: number, actorRadius: number, insetWu: number): number {
  const insetOffset = Math.max(0, halfSize - Math.max(insetWu, actorRadius));
  const radiusSafeOffset = Math.max(0, halfSize - actorRadius);
  return Math.min(insetOffset, radiusSafeOffset);
}

function actorIdForEntity(
  actorsByActorId: ReadonlyMap<string, ArenaActorProgressionState>,
  entityId: number
): ReadonlyArray<string> {
  for (const actor of actorsByActorId.values()) {
    if (actor.entityId === entityId) return [actor.actorId];
  }
  return [];
}

function uniqueActorIds(actorIds: ReadonlyArray<string>): ReadonlyArray<string> {
  return Array.from(new Set(actorIds));
}

function assertNever(value: never): never {
  throw new Error(`unhandled arena host value: ${String(value)}`);
}
