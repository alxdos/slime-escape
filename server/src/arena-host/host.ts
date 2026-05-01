import { performance } from 'node:perf_hooks';

import { buildSessionDefinition } from '../../../src/shared/content/buildSession.js';
import { BOSS_ARCHETYPES } from '../../../src/shared/content/bosses.js';
import { ENEMY_ARCHETYPE_LIST } from '../../../src/shared/content/enemies.generated.js';
import {
  PUBLIC_ARENA_HOST_BOSS_ARCHETYPE_ID,
  PUBLIC_ARENA_HOST_BOSS_WEAPON_ID,
  PUBLIC_ARENA_HOST_LOADOUT,
  PUBLIC_ARENA_HOST_PLAYER,
  PUBLIC_ARENA_HOST_SESSION_PRESET_ID,
  PUBLIC_ARENA_SPAWN_INVULNERABILITY_MS,
  worldBoundsFromArena
} from '../../../src/shared/content/publicArena.js';
import { PUBLIC_ARENA_PRESET } from '../../../src/shared/content/sessions.js';
import type { RuntimeEvent } from '../../../src/shared/events.js';
import type { InputCommand } from '../../../src/shared/input.js';
import type { Loadout, PlayerConfig, SessionDefinition, Vec2 } from '../../../src/shared/session.js';
import type { Snapshot } from '../../../src/shared/snapshot.js';
import { SIM_STEP_MS } from '../../../src/shared/timing.js';
import { PUBLIC_ARENA_BOSS_LEVEL } from '../../../src/shared/publicArenaProgression.js';
import {
  createSimulationCore,
  type SimulationCore,
  type SimulationCoreOptions
} from '../../../src/shared/sim/SimulationCore.js';
import type { PublicArenaCloseReason, PublicArenaWorldBounds } from '../../../src/shared/publicArenaProtocol.js';
import {
  type ArenaActorProgressionState,
  type ArenaCoreOp,
  type ArenaFormContent,
  type ArenaHostEvent,
  type ArenaHostLevelUpEvent,
  type ArenaProgressionContent,
  pvpKillToLevelOps
} from './policy.js';

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

export type ArenaHostJoinAccepted = Readonly<{
  kind: 'accepted';
  actorId: string;
  arena: PublicArenaWorldBounds;
  playerCap: number;
  population: number;
  tickHz: number;
  snapshotHz: number;
}>;

export type ArenaHostJoinRejected = Readonly<{
  kind: 'rejected';
  reason: 'arenaFull';
  message: string;
  playerCap: number;
  population: number;
}>;

export type ArenaHostJoinResult = ArenaHostJoinAccepted | ArenaHostJoinRejected;

export type ArenaHostOptions = Readonly<{
  playerCap: number;
  tickHz: number;
  snapshotHz: number;
  seed?: number;
  sink: ArenaHostSink;
  clock?: ArenaHostClock;
  coreFactory?: (options: SimulationCoreOptions) => SimulationCore;
}>;

export type ArenaHost = Readonly<{
  session(): SessionDefinition;
  start(): void;
  stop(): void;
  join(socketId: string): ArenaHostJoinResult;
  leave(socketId: string): void;
  submitInput(socketId: string, command: InputCommand, nowMs?: number): boolean;
  population(): number;
  actors(): ReadonlyArray<ArenaActorProgressionState>;
}>;

type ActorRecord = {
  socketId: string;
  actorId: string;
  entityId: number | null;
  level: number;
  inputRateLimit: ArenaHostInputRateLimitState;
};

export function createArenaHost(options: ArenaHostOptions): ArenaHost {
  const clock = options.clock ?? defaultArenaHostClock();
  const session = buildSessionDefinition(PUBLIC_ARENA_PRESET, {
    seed: options.seed ?? 1,
    id: `${PUBLIC_ARENA_HOST_SESSION_PRESET_ID}-host-session`
  });
  if (!session.dynamicRoster) {
    throw new Error('Public Arena host session must use dynamicRoster');
  }

  const core = (options.coreFactory ?? createSimulationCore)({
    onSnapshot: handleSnapshot,
    onEvent: handleRuntimeEvent
  });
  const actorsBySocketId = new Map<string, ActorRecord>();
  const actorsByActorId = new Map<string, ActorRecord>();
  const progressionForms = createProgressionForms();
  const basePlayer = createBasePlayerConfigFields();
  const arena = worldBoundsFromArena(session.arena);
  const spawnPoints = cornerSpawns(session.arena, basePlayer.radius);
  let nextSpawnIndex = 0;
  let currentSimTimeMs = 0;
  let timer: unknown = null;

  function handleSnapshot(snapshot: Snapshot): void {
    currentSimTimeMs = snapshot.simTimeMs;
    for (const actor of actorsByActorId.values()) {
      options.sink.emitSnapshot(actor.actorId, snapshot);
    }
  }

  function handleRuntimeEvent(event: RuntimeEvent): void {
    currentSimTimeMs = event.simTime;
    if (event.kind === 'playerSpawn') {
      const actor = actorsByActorId.get(event.playerId);
      if (actor !== undefined) {
        actor.entityId = event.entityId;
      }
    }

    emitArenaEvent(event);

    if (event.kind === 'death') {
      applyPolicyOps(event);
    }
  }

  function emitArenaEvent(event: ArenaHostEvent): void {
    for (const actorId of arenaHostEventRecipients(event, actorsByActorId)) {
      options.sink.emitEvent(actorId, event);
    }
  }

  function applyPolicyOps(death: Extract<RuntimeEvent, { kind: 'death' }>): void {
    const deadActor = actorByEntityId(actorsByActorId, death.entityId);
    const content = createProgressionContent(nextSpawn(), basePlayer, progressionForms);
    const ops = pvpKillToLevelOps(death, actorStateByActorId(actorsByActorId), content);
    if (deadActor !== null) {
      deadActor.level = 1;
      deadActor.entityId = null;
    }
    for (const op of ops) {
      applyCoreOp(op);
    }
  }

  function applyCoreOp(op: ArenaCoreOp): void {
    switch (op.kind) {
      case 'addPlayer':
        core.addPlayer(op.playerConfig, {
          invulnerableUntilSimMs: op.invulnerableUntilSimMs
        });
        return;
      case 'setPlayerForm': {
        const actor = actorsByActorId.get(op.actorId);
        if (actor !== undefined) actor.level = op.level;
        core.setPlayerForm(op.actorId, op.formUpdate, { refillHp: op.refillHp });
        return;
      }
      case 'emitHostEvent':
        emitArenaEvent(op.event);
        return;
      default:
        return assertNever(op);
    }
  }

  function nextSpawn(): Vec2 {
    const spawn = spawnPoints[nextSpawnIndex % spawnPoints.length];
    if (spawn === undefined) {
      throw new Error('arena host requires at least one spawn point');
    }
    nextSpawnIndex += 1;
    return spawn;
  }

  return {
    session() {
      return session;
    },
    start(): void {
      if (timer !== null) return;
      core.start(session);
      timer = clock.setInterval(() => {
        core.pump(clock.nowMs());
      }, SIM_STEP_MS);
    },
    stop(): void {
      if (timer !== null) {
        clock.clearInterval(timer);
        timer = null;
      }
      options.sink.emitCloseReason(ARENA_HOST_SERVER_SHUTDOWN_REASON);
      core.stop();
      actorsBySocketId.clear();
      actorsByActorId.clear();
    },
    join(socketId): ArenaHostJoinResult {
      const existing = actorsBySocketId.get(socketId);
      if (existing !== undefined) {
        return acceptedJoin(existing);
      }
      if (actorsBySocketId.size >= options.playerCap) {
        return {
          kind: 'rejected',
          reason: 'arenaFull',
          message: 'The online arena is full. Try again soon.',
          playerCap: options.playerCap,
          population: actorsBySocketId.size
        };
      }

      const actor: ActorRecord = {
        socketId,
        actorId: socketId,
        entityId: null,
        level: 1,
        inputRateLimit: createArenaHostInputRateLimitState(clock.nowMs())
      };
      actorsBySocketId.set(socketId, actor);
      actorsByActorId.set(actor.actorId, actor);
      const spawn = nextSpawn();
      core.addPlayer(
        {
          id: actor.actorId,
          position: spawn,
          ...basePlayer
        },
        {
          invulnerableUntilSimMs:
            currentSimTimeMs + PUBLIC_ARENA_SPAWN_INVULNERABILITY_MS
        }
      );
      applyLevelOneForm(actor.actorId);
      return acceptedJoin(actor);
    },
    leave(socketId): void {
      const actor = actorsBySocketId.get(socketId);
      if (actor === undefined) return;
      actorsBySocketId.delete(socketId);
      actorsByActorId.delete(actor.actorId);
      core.removePlayer(actor.actorId);
    },
    submitInput(socketId, command, nowMs = clock.nowMs()): boolean {
      const actor = actorsBySocketId.get(socketId);
      if (actor === undefined) return false;
      if (!acceptArenaHostInputIntent(actor.inputRateLimit, nowMs)) {
        return false;
      }
      core.submitInput(actor.actorId, command);
      return true;
    },
    population(): number {
      return actorsBySocketId.size;
    },
    actors(): ReadonlyArray<ArenaActorProgressionState> {
      return [...actorsByActorId.values()].map(actorState);
    }
  };

  function acceptedJoin(actor: ActorRecord): ArenaHostJoinAccepted {
    return {
      kind: 'accepted',
      actorId: actor.actorId,
      arena,
      playerCap: options.playerCap,
      population: actorsBySocketId.size,
      tickHz: options.tickHz,
      snapshotHz: options.snapshotHz
    };
  }

  function applyLevelOneForm(actorId: string): void {
    const form = progressionForms.get(1);
    if (form === undefined) {
      throw new Error('public arena missing level-one form content');
    }
    core.setPlayerForm(
      actorId,
      {
        formArchetypeId: form.formArchetypeId,
        radius: form.radius,
        contactBox: form.contactBox,
        maxSpeed: form.maxSpeed,
        maxHp: form.maxHp,
        loadout: form.loadout
      },
      { refillHp: true }
    );
  }
}

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

function createBasePlayerConfigFields(): Omit<PlayerConfig, 'id' | 'position'> {
  return {
    radius: PUBLIC_ARENA_HOST_PLAYER.radius,
    contactBox: PUBLIC_ARENA_HOST_PLAYER.contactBox,
    maxSpeed: PUBLIC_ARENA_HOST_PLAYER.maxSpeed,
    maxHp: PUBLIC_ARENA_HOST_PLAYER.maxHp,
    loadout: loadoutFromIds(PUBLIC_ARENA_HOST_LOADOUT.weapons, PUBLIC_ARENA_HOST_LOADOUT.selectedIndex)
  };
}

function createProgressionForms(): ReadonlyMap<number, ArenaFormContent> {
  const forms = new Map<number, ArenaFormContent>();
  ENEMY_ARCHETYPE_LIST.forEach((enemy, index) => {
    forms.set(index + 1, {
      formArchetypeId: enemy.id,
      radius: enemy.radius,
      contactBox: enemy.contactBox,
      maxSpeed: PUBLIC_ARENA_HOST_PLAYER.maxSpeed,
      maxHp: PUBLIC_ARENA_HOST_PLAYER.maxHp,
      loadout: loadoutFromIds(
        PUBLIC_ARENA_HOST_LOADOUT.weapons,
        PUBLIC_ARENA_HOST_LOADOUT.selectedIndex
      )
    });
  });

  const boss = BOSS_ARCHETYPES[PUBLIC_ARENA_HOST_BOSS_ARCHETYPE_ID];
  if (boss === undefined) {
    throw new Error(
      `public arena boss archetype "${PUBLIC_ARENA_HOST_BOSS_ARCHETYPE_ID}" is missing`
    );
  }
  forms.set(PUBLIC_ARENA_BOSS_LEVEL, {
    formArchetypeId: boss.id,
    radius: boss.radius,
    contactBox: boss.contactBox,
    maxSpeed: boss.maxSpeed,
    maxHp: boss.maxHp,
    loadout: { weapons: [PUBLIC_ARENA_HOST_BOSS_WEAPON_ID], selectedIndex: 0 }
  });
  return forms;
}

function createProgressionContent(
  respawnPosition: Vec2,
  basePlayer: Omit<PlayerConfig, 'id' | 'position'>,
  formsByLevel: ReadonlyMap<number, ArenaFormContent>
): ArenaProgressionContent {
  return {
    basePlayer,
    respawnPosition,
    spawnInvulnerabilityMs: PUBLIC_ARENA_SPAWN_INVULNERABILITY_MS,
    bossLevel: PUBLIC_ARENA_BOSS_LEVEL,
    formsByLevel
  };
}

function loadoutFromIds(weapons: ReadonlyArray<string>, selectedIndex: number | null): Loadout {
  return {
    weapons: [...weapons],
    selectedIndex
  };
}

function actorState(actor: ActorRecord): ArenaActorProgressionState {
  return {
    actorId: actor.actorId,
    entityId: actor.entityId,
    level: actor.level
  };
}

function actorStateByActorId(
  actorsByActorId: ReadonlyMap<string, ActorRecord>
): ReadonlyMap<string, ArenaActorProgressionState> {
  return new Map([...actorsByActorId].map(([actorId, actor]) => [actorId, actorState(actor)]));
}

function actorByEntityId(
  actorsByActorId: ReadonlyMap<string, ActorRecord>,
  entityId: number
): ActorRecord | null {
  for (const actor of actorsByActorId.values()) {
    if (actor.entityId === entityId) return actor;
  }
  return null;
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

function defaultArenaHostClock(): ArenaHostClock {
  return {
    nowMs: () => performance.now(),
    setInterval: (handler, intervalMs) => setInterval(handler, intervalMs),
    clearInterval: (handle) => clearInterval(handle as NodeJS.Timeout)
  };
}

function assertNever(value: never): never {
  throw new Error(`unhandled arena host value: ${String(value)}`);
}
