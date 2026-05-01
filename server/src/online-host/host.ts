import { performance } from 'node:perf_hooks';

import { buildSessionDefinition } from '../../../src/shared/content/buildSession.js';
import { BOSS_ARCHETYPES } from '../../../src/shared/content/bosses.js';
import { ENEMY_ARCHETYPE_LIST } from '../../../src/shared/content/enemies.generated.js';
import { PET_ARCHETYPES } from '../../../src/shared/content/pets.js';
import {
  PUBLIC_ARENA_HOST_BOSS_ARCHETYPE_ID,
  PUBLIC_ARENA_HOST_BOSS_WEAPON_ID,
  PUBLIC_ARENA_HOST_LOADOUT,
  PUBLIC_ARENA_HOST_PLAYER,
  PUBLIC_ARENA_HOST_SESSION_PRESET_ID,
  PUBLIC_ARENA_SPAWN_INVULNERABILITY_MS,
  worldBoundsFromArena
} from '../../../src/shared/content/publicArena.js';
import {
  resolveModePreset,
  SESSION_PRESET_TEMPLATES,
  type ModePresetId,
  type SessionPresetCompanionTemplate,
  type SessionPresetTemplate
} from '../../../src/shared/content/sessions.js';
import type { RuntimeEvent } from '../../../src/shared/events.js';
import { log } from '../../../src/shared/log.js';
import { PUBLIC_ARENA_BOSS_LEVEL } from '../../../src/shared/publicArenaProgression.js';
import type {
  CompanionSessionConfig,
  Loadout,
  PlayerConfig,
  SessionDefinition,
  Vec2
} from '../../../src/shared/session.js';
import {
  createSimulationCore,
  type SimulationCore,
  type SimulationCoreOptions
} from '../../../src/shared/sim/SimulationCore.js';
import type { Snapshot } from '../../../src/shared/snapshot.js';
import { SIM_STEP_MS } from '../../../src/shared/timing.js';
import {
  PUBLIC_ARENA_FULL_MESSAGE,
  type ArenaHostEvent,
  type PublicArenaInputIntent,
  type PublicArenaRoomState,
  type PublicArenaWorldBounds
} from '../../../src/shared/arenaHostProtocol.js';
import {
  acceptArenaHostInputIntent,
  ARENA_HOST_SERVER_SHUTDOWN_REASON,
  arenaHostEventRecipients,
  cornerSpawns,
  createArenaHostInputRateLimitState,
  type ArenaHostClock,
  type ArenaHostInputRateLimitState,
  type ArenaHostSink
} from '../arena-host/host.js';
import {
  type ArenaActorProgressionState,
  type ArenaCoreOp,
  type ArenaFormContent,
  type ArenaProgressionContent,
  pvpKillToLevelOps
} from '../arena-host/policy.js';

export type { ArenaHostClock, ArenaHostEvent, ArenaHostSink };

export type OnlineSessionHostJoinRequest = Readonly<{
  requestedSessionId?: string;
  selectedPetId?: string | null;
}>;

export type OnlineSessionHostJoinAccepted = Readonly<{
  kind: 'accepted';
  actorId: string;
  roomId: string;
  sessionConfigId: ModePresetId;
  arena: PublicArenaWorldBounds;
  playerCap: number;
  population: number;
  maxPlayers: number;
  lateJoinAllowed: boolean;
  roomState: PublicArenaRoomState;
  tickHz: number;
  snapshotHz: number;
}>;

export type OnlineSessionHostJoinRejected = Readonly<{
  kind: 'rejected';
  reason: 'serverFull' | 'roomFull' | 'sessionInProgress' | 'unknownSession';
  message: string;
  playerCap: number;
  population: number;
}>;

export type OnlineSessionHostJoinResult =
  | OnlineSessionHostJoinAccepted
  | OnlineSessionHostJoinRejected;

export type OnlineSessionHostOptions = Readonly<{
  playerCap: number;
  tickHz: number;
  snapshotHz: number;
  seed?: number;
  sink: ArenaHostSink;
  clock?: ArenaHostClock;
  coreFactory?: (options: SimulationCoreOptions) => SimulationCore;
  roomIdFactory?: (index: number) => string;
}>;

export type OnlineSessionHost = Readonly<{
  start(): void;
  stop(): void;
  join(socketId: string, request?: OnlineSessionHostJoinRequest): OnlineSessionHostJoinResult;
  leave(socketId: string): void;
  submitInput(socketId: string, intent: PublicArenaInputIntent, nowMs?: number): boolean;
  population(): number;
  rooms(): ReadonlyArray<OnlineSessionRoomSnapshot>;
}>;

export type OnlineSessionRoomSnapshot = Readonly<{
  roomId: string;
  sessionConfigId: ModePresetId;
  state: PublicArenaRoomState;
  population: number;
  hostActorId: string | null;
}>;

type ActorRecord = {
  socketId: string;
  actorId: string;
  selectedPetId: string | null;
  joinedAtMs: number;
  entityId: number | null;
  level: number;
  inputRateLimit: ArenaHostInputRateLimitState;
};

type RoomRecord = {
  roomId: string;
  sessionConfigId: ModePresetId;
  template: SessionPresetTemplate;
  session: SessionDefinition;
  arena: PublicArenaWorldBounds;
  state: PublicArenaRoomState;
  hostActorId: string | null;
  createdAtMs: number;
  currentSimTimeMs: number;
  nextSpawnIndex: number;
  playerCap: number;
  tickHz: number;
  snapshotHz: number;
  timer: unknown;
  core: SimulationCore | null;
  actorsBySocketId: Map<string, ActorRecord>;
  actorsByActorId: Map<string, ActorRecord>;
  lastInputSequence: Map<string, number>;
  progressionForms: ReadonlyMap<number, ArenaFormContent> | null;
};

export function shouldAcceptOnlineInputSequence(
  lastApplied: number | undefined,
  inputSequence: number
): boolean {
  return (
    Number.isSafeInteger(inputSequence) &&
    inputSequence > 0 &&
    inputSequence > (lastApplied ?? 0)
  );
}

export function projectOnlineInputSequences(
  lastInputSequence: ReadonlyMap<string, number>
): Readonly<Record<string, number>> {
  return Object.fromEntries(lastInputSequence);
}

export function createOnlineSessionHost(options: OnlineSessionHostOptions): OnlineSessionHost {
  const clock = options.clock ?? defaultOnlineHostClock();
  const coreFactory = options.coreFactory ?? createSimulationCore;
  const roomsByRoomId = new Map<string, RoomRecord>();
  const roomIdBySocketId = new Map<string, string>();
  let nextRoomIndex = 1;
  let stopped = false;

  return {
    start(): void {
      stopped = false;
    },
    stop(): void {
      stopped = true;
      options.sink.emitCloseReason(ARENA_HOST_SERVER_SHUTDOWN_REASON);
      for (const room of [...roomsByRoomId.values()]) {
        destroyRoom(room, { stopCore: true });
      }
    },
    join(socketId, request = {}): OnlineSessionHostJoinResult {
      if (stopped) {
        return rejectJoin('serverFull', options.playerCap, population());
      }
      const existingRoom = roomForSocket(socketId);
      if (existingRoom !== null) {
        const existing = existingRoom.actorsBySocketId.get(socketId);
        if (existing !== undefined) return acceptedJoin(existingRoom, existing);
      }
      if (population() >= options.playerCap) {
        return rejectJoin('serverFull', options.playerCap, population());
      }

      const sessionConfigId = resolveRequestedSessionId(request.requestedSessionId);
      if (sessionConfigId === null) {
        return rejectJoin('unknownSession', options.playerCap, population());
      }
      const template = SESSION_PRESET_TEMPLATES[sessionConfigId];
      if (!template.online.enabled) {
        return rejectJoin('unknownSession', options.playerCap, population());
      }

      const room = findJoinableRoom(sessionConfigId) ?? createRoom(sessionConfigId, template);
      const selectedPetId = resolveSelectedPetId(request.selectedPetId ?? null);
      const actor = createActor(socketId, selectedPetId, clock.nowMs());
      room.actorsBySocketId.set(socketId, actor);
      room.actorsByActorId.set(actor.actorId, actor);
      roomIdBySocketId.set(socketId, room.roomId);
      if (room.hostActorId === null) {
        room.hostActorId = actor.actorId;
      }

      if (room.state === 'running') {
        addActorToRunningRoom(room, actor);
      } else if (room.template.online.lobbyKind === 'none') {
        startRoom(room);
      } else {
        emitLobbyState(room);
      }

      return acceptedJoin(room, actor);
    },
    leave(socketId): void {
      const room = roomForSocket(socketId);
      if (room === null) return;
      const actor = room.actorsBySocketId.get(socketId);
      if (actor === undefined) return;
      const previousHostActorId = room.hostActorId;
      room.actorsBySocketId.delete(socketId);
      room.actorsByActorId.delete(actor.actorId);
      roomIdBySocketId.delete(socketId);
      if (room.state === 'running') {
        removePlayerFromRoomCore(room, actor.actorId);
      }
      if (room.actorsBySocketId.size === 0) {
        destroyRoom(room, { stopCore: true });
        return;
      }
      if (previousHostActorId === actor.actorId) {
        room.hostActorId = electHostActorId(room);
        emitHostChanged(room, previousHostActorId, room.hostActorId);
      }
      emitLobbyState(room);
    },
    submitInput(socketId, intent, nowMs = clock.nowMs()): boolean {
      const room = roomForSocket(socketId);
      if (room === null) return false;
      const actor = room.actorsBySocketId.get(socketId);
      if (actor === undefined) return false;
      if (intent.kind === 'lobby:start') {
        return startLobbyFromActor(room, actor);
      }
      if (intent.kind === 'lobby:transferHost') {
        return transferHostFromActor(room, actor, intent.targetActorId);
      }
      if (room.state !== 'running' || room.core === null) return false;
      if (!acceptArenaHostInputIntent(actor.inputRateLimit, nowMs)) return false;
      const lastAppliedInputSequence = room.lastInputSequence.get(actor.actorId);
      if (!shouldAcceptOnlineInputSequence(lastAppliedInputSequence, intent.inputSequence)) {
        log.warn('online input ignored: non-increasing inputSequence', {
          roomId: room.roomId,
          actorId: actor.actorId,
          inputSequence: intent.inputSequence,
          lastInputSequence: lastAppliedInputSequence ?? 0
        });
        return false;
      }
      room.lastInputSequence.set(actor.actorId, intent.inputSequence);
      const { inputSequence: _inputSequence, ...command } = intent;
      room.core.submitInput(actor.actorId, command, intent.inputSequence);
      return true;
    },
    population,
    rooms(): ReadonlyArray<OnlineSessionRoomSnapshot> {
      return [...roomsByRoomId.values()].map((room) => ({
        roomId: room.roomId,
        sessionConfigId: room.sessionConfigId,
        state: room.state,
        population: room.actorsBySocketId.size,
        hostActorId: room.hostActorId
      }));
    }
  };

  function population(): number {
    let count = 0;
    for (const room of roomsByRoomId.values()) count += room.actorsBySocketId.size;
    return count;
  }

  function roomForSocket(socketId: string): RoomRecord | null {
    const roomId = roomIdBySocketId.get(socketId);
    if (roomId === undefined) return null;
    return roomsByRoomId.get(roomId) ?? null;
  }

  function createRoom(sessionConfigId: ModePresetId, template: SessionPresetTemplate): RoomRecord {
    const roomIndex = nextRoomIndex;
    const roomId = options.roomIdFactory?.(roomIndex) ?? `room-${roomIndex}`;
    nextRoomIndex += 1;
    const session = buildSessionDefinition(resolveModePreset(sessionConfigId), {
      seed: (options.seed ?? 1) + roomIndex,
      id: `${sessionConfigId}-${roomId}`
    });
    const room: RoomRecord = {
      roomId,
      sessionConfigId,
      template,
      session,
      arena: worldBoundsFromArena(session.arena),
      state: 'open',
      hostActorId: null,
      createdAtMs: clock.nowMs(),
      currentSimTimeMs: 0,
      nextSpawnIndex: 0,
      playerCap: options.playerCap,
      tickHz: options.tickHz,
      snapshotHz: options.snapshotHz,
      timer: null,
      core: null,
      actorsBySocketId: new Map(),
      actorsByActorId: new Map(),
      lastInputSequence: new Map(),
      progressionForms:
        sessionConfigId === PUBLIC_ARENA_HOST_SESSION_PRESET_ID
          ? createProgressionForms()
          : null
    };
    roomsByRoomId.set(roomId, room);
    return room;
  }

  function findJoinableRoom(sessionConfigId: ModePresetId): RoomRecord | null {
    const candidates = [...roomsByRoomId.values()]
      .filter((room) => room.sessionConfigId === sessionConfigId)
      .sort((left, right) => left.createdAtMs - right.createdAtMs);
    for (const room of candidates) {
      if (room.actorsBySocketId.size >= roomMaxPlayers(room)) continue;
      if (room.state === 'open') return room;
      if (
        room.state === 'running' &&
        room.template.online.lateJoinAllowed &&
        room.session.dynamicRoster
      ) {
        return room;
      }
    }
    return null;
  }

  function startLobbyFromActor(room: RoomRecord, actor: ActorRecord): boolean {
    if (room.state === 'running') {
      log.warn('lobby:start ignored: room already running', { roomId: room.roomId });
      return false;
    }
    if (room.hostActorId !== actor.actorId) {
      log.warn('lobby:start ignored: actor is not lobby host', {
        roomId: room.roomId,
        actorId: actor.actorId
      });
      return false;
    }
    startRoom(room);
    emitRoomEvent(room, {
      kind: 'host:lobby:start',
      simTime: room.currentSimTimeMs,
      roomId: room.roomId
    });
    emitLobbyState(room);
    return true;
  }

  function transferHostFromActor(
    room: RoomRecord,
    actor: ActorRecord,
    targetActorId: string
  ): boolean {
    if (room.hostActorId !== actor.actorId) {
      log.warn('lobby:transferHost ignored: actor is not lobby host', {
        roomId: room.roomId,
        actorId: actor.actorId
      });
      return false;
    }
    if (!room.actorsByActorId.has(targetActorId)) {
      log.warn('lobby:transferHost ignored: unknown target actor', {
        roomId: room.roomId,
        targetActorId
      });
      return false;
    }
    if (room.hostActorId === targetActorId) return false;
    const previous = room.hostActorId;
    room.hostActorId = targetActorId;
    emitHostChanged(room, previous, targetActorId);
    emitLobbyState(room);
    return true;
  }

  function startRoom(room: RoomRecord): void {
    if (room.core !== null && room.timer !== null) return;
    room.state = 'running';
    const core = coreFactory({
      onSnapshot: (snapshot) => handleSnapshot(room, snapshot),
      onEvent: (event) => handleRuntimeEvent(room, event)
    });
    room.core = core;
    const startSession: SessionDefinition = room.session.dynamicRoster
      ? room.session
      : {
          ...room.session,
          dynamicRoster: false,
          players: staticPlayersForRoom(room)
        };
    core.start(startSession);
    if (room.session.dynamicRoster) {
      for (const actor of actorsInJoinOrder(room)) {
        addActorToRunningRoom(room, actor);
      }
    }
    room.timer = clock.setInterval(() => {
      core.pump(clock.nowMs());
    }, SIM_STEP_MS);
  }

  function addActorToRunningRoom(room: RoomRecord, actor: ActorRecord): void {
    if (room.core === null) return;
    const playerConfig = playerConfigForActor(room, actor);
    const invulnerableUntilSimMs =
      room.sessionConfigId === PUBLIC_ARENA_HOST_SESSION_PRESET_ID
        ? room.currentSimTimeMs + PUBLIC_ARENA_SPAWN_INVULNERABILITY_MS
        : null;
    room.core.addPlayer(
      playerConfig,
      invulnerableUntilSimMs === null
        ? undefined
        : { invulnerableUntilSimMs }
    );
    if (room.sessionConfigId === PUBLIC_ARENA_HOST_SESSION_PRESET_ID) {
      applyLevelOneForm(room, actor.actorId);
    }
  }

  function handleSnapshot(room: RoomRecord, snapshot: Snapshot): void {
    room.currentSimTimeMs = snapshot.simTimeMs;
    const sequencedSnapshot: Snapshot = {
      ...snapshot,
      lastInputSequence: projectOnlineInputSequences(room.lastInputSequence)
    };
    for (const actor of room.actorsByActorId.values()) {
      options.sink.emitSnapshot(actor.actorId, sequencedSnapshot);
    }
  }

  function handleRuntimeEvent(room: RoomRecord, event: RuntimeEvent): void {
    room.currentSimTimeMs = event.simTime;
    if (event.kind === 'playerSpawn') {
      const actor = room.actorsByActorId.get(event.playerId);
      if (actor !== undefined) actor.entityId = event.entityId;
    }
    emitArenaEvent(room, event);
    if (event.kind === 'death' && room.sessionConfigId === PUBLIC_ARENA_HOST_SESSION_PRESET_ID) {
      applyPolicyOps(room, event);
    }
  }

  function emitArenaEvent(room: RoomRecord, event: ArenaHostEvent): void {
    for (const actorId of arenaHostEventRecipients(event, room.actorsByActorId)) {
      options.sink.emitEvent(actorId, event);
    }
  }

  function emitRoomEvent(room: RoomRecord, event: ArenaHostEvent): void {
    for (const actor of room.actorsByActorId.values()) {
      options.sink.emitEvent(actor.actorId, event);
    }
  }

  function emitLobbyState(room: RoomRecord): void {
    if (room.template.online.lobbyKind !== 'hostControlled') return;
    const hostActorId = room.hostActorId;
    if (hostActorId === null) return;
    emitRoomEvent(room, {
      kind: 'host:lobby:state',
      simTime: room.currentSimTimeMs,
      roomId: room.roomId,
      sessionConfigId: room.sessionConfigId,
      state: room.state,
      joined: actorsInJoinOrder(room).map((actor) => ({
        actorId: actor.actorId,
        petArchetypeId: actor.selectedPetId
      })),
      hostActorId,
      maxPlayers: roomMaxPlayers(room),
      lateJoinAllowed: room.template.online.lateJoinAllowed
    });
  }

  function emitHostChanged(
    room: RoomRecord,
    previousHostActorId: string | null,
    newHostActorId: string | null
  ): void {
    if (room.template.online.lobbyKind !== 'hostControlled' || newHostActorId === null) return;
    emitRoomEvent(room, {
      kind: 'host:lobby:hostChanged',
      simTime: room.currentSimTimeMs,
      roomId: room.roomId,
      previousHostActorId,
      newHostActorId
    });
  }

  function applyPolicyOps(room: RoomRecord, death: Extract<RuntimeEvent, { kind: 'death' }>): void {
    const core = room.core;
    const progressionForms = room.progressionForms;
    if (core === null || progressionForms === null) return;
    const deadActor = actorByEntityId(room.actorsByActorId, death.entityId);
    const content = createProgressionContent(nextSpawn(room), createBasePlayerConfigFields(), progressionForms);
    const ops = pvpKillToLevelOps(death, actorStateByActorId(room.actorsByActorId), content);
    if (deadActor !== null) {
      deadActor.level = 1;
      deadActor.entityId = null;
    }
    for (const op of ops) {
      applyCoreOp(room, op);
    }
  }

  function applyCoreOp(room: RoomRecord, op: ArenaCoreOp): void {
    const core = room.core;
    if (core === null) return;
    switch (op.kind) {
      case 'addPlayer':
        core.addPlayer(op.playerConfig, {
          invulnerableUntilSimMs: op.invulnerableUntilSimMs
        });
        return;
      case 'setPlayerForm': {
        const actor = room.actorsByActorId.get(op.actorId);
        if (actor !== undefined) actor.level = op.level;
        core.setPlayerForm(op.actorId, op.formUpdate, { refillHp: op.refillHp });
        return;
      }
      case 'emitHostEvent':
        emitArenaEvent(room, op.event);
        return;
      default:
        return assertNever(op);
    }
  }

  function applyLevelOneForm(room: RoomRecord, actorId: string): void {
    const core = room.core;
    const progressionForms = room.progressionForms;
    if (core === null || progressionForms === null) return;
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

  function removePlayerFromRoomCore(room: RoomRecord, actorId: string): void {
    room.lastInputSequence.delete(actorId);
    room.core?.removePlayer(actorId);
  }

  function playerConfigForActor(room: RoomRecord, actor: ActorRecord): PlayerConfig {
    return {
      id: actor.actorId,
      position: nextSpawn(room),
      radius: room.template.playerTemplate.radius,
      contactBox: room.template.playerTemplate.contactBox,
      maxSpeed: room.template.playerTemplate.maxSpeed,
      maxHp: room.template.playerTemplate.maxHp,
      loadout: copyLoadout(room.template.playerTemplate.loadout),
      companion: companionConfigForActor(room.template.companion, actor.selectedPetId)
    };
  }

  function staticPlayersForRoom(room: RoomRecord): readonly [PlayerConfig, ...PlayerConfig[]] {
    const [firstActor, ...restActors] = actorsInJoinOrder(room);
    if (firstActor === undefined) {
      throw new Error(`room "${room.roomId}" cannot start a fixed roster without actors`);
    }
    return [
      playerConfigForActor(room, firstActor),
      ...restActors.map((actor) => playerConfigForActor(room, actor))
    ];
  }

  function companionConfigForActor(
    template: SessionPresetCompanionTemplate | null,
    selectedPetId: string | null
  ): CompanionSessionConfig | null {
    if (template === null || selectedPetId === null) return null;
    return {
      ...template,
      weaponLoadout: copyLoadout(template.weaponLoadout),
      petArchetypeId: selectedPetId
    };
  }

  function nextSpawn(room: RoomRecord): Vec2 {
    const spawnPoints = cornerSpawns(room.session.arena, room.template.playerTemplate.radius);
    const spawn = spawnPoints[room.nextSpawnIndex % spawnPoints.length];
    if (spawn === undefined) {
      throw new Error('online session host requires at least one spawn point');
    }
    room.nextSpawnIndex += 1;
    return spawn;
  }

  function destroyRoom(room: RoomRecord, opts: { stopCore: boolean }): void {
    if (room.timer !== null) {
      clock.clearInterval(room.timer);
      room.timer = null;
    }
    if (opts.stopCore && room.core !== null) {
      room.core.stop();
    }
    for (const actor of room.actorsBySocketId.values()) {
      roomIdBySocketId.delete(actor.socketId);
    }
    room.actorsBySocketId.clear();
    room.actorsByActorId.clear();
    room.lastInputSequence.clear();
    roomsByRoomId.delete(room.roomId);
  }
}

function resolveRequestedSessionId(raw: string | undefined): ModePresetId | null {
  const requested = raw ?? PUBLIC_ARENA_HOST_SESSION_PRESET_ID;
  if (requested in SESSION_PRESET_TEMPLATES) return requested as ModePresetId;
  return null;
}

function resolveSelectedPetId(raw: string | null): string | null {
  if (raw === null) return null;
  if (PET_ARCHETYPES[raw] !== undefined) return raw;
  log.warn('online session join ignored unknown selectedPetId', { selectedPetId: raw });
  return null;
}

function createActor(socketId: string, selectedPetId: string | null, nowMs: number): ActorRecord {
  return {
    socketId,
    actorId: socketId,
    selectedPetId,
    joinedAtMs: nowMs,
    entityId: null,
    level: 1,
    inputRateLimit: createArenaHostInputRateLimitState(nowMs)
  };
}

function acceptedJoin(room: RoomRecord, actor: ActorRecord): OnlineSessionHostJoinAccepted {
  return {
    kind: 'accepted',
    actorId: actor.actorId,
    roomId: room.roomId,
    sessionConfigId: room.sessionConfigId,
    arena: room.arena,
    playerCap: room.playerCap,
    population: room.actorsBySocketId.size,
    maxPlayers: roomMaxPlayers(room),
    lateJoinAllowed: room.template.online.lateJoinAllowed,
    roomState: room.state,
    tickHz: room.tickHz,
    snapshotHz: room.snapshotHz
  };
}

function rejectJoin(
  reason: OnlineSessionHostJoinRejected['reason'],
  playerCap: number,
  population: number
): OnlineSessionHostJoinRejected {
  return {
    kind: 'rejected',
    reason,
    message: joinRejectedMessage(reason),
    playerCap,
    population
  };
}

function joinRejectedMessage(reason: OnlineSessionHostJoinRejected['reason']): string {
  switch (reason) {
    case 'serverFull':
    case 'roomFull':
      return PUBLIC_ARENA_FULL_MESSAGE;
    case 'sessionInProgress':
      return 'This online session is already in progress.';
    case 'unknownSession':
      return 'Unknown online session.';
    default:
      return assertNever(reason);
  }
}

function roomMaxPlayers(room: RoomRecord): number {
  return room.template.online.maxPlayers ?? Number.MAX_SAFE_INTEGER;
}

function actorsInJoinOrder(room: RoomRecord): ReadonlyArray<ActorRecord> {
  return [...room.actorsByActorId.values()].sort(compareActorsByJoinOrder);
}

function compareActorsByJoinOrder(left: ActorRecord, right: ActorRecord): number {
  if (left.joinedAtMs !== right.joinedAtMs) return left.joinedAtMs - right.joinedAtMs;
  return left.actorId.localeCompare(right.actorId);
}

function electHostActorId(room: RoomRecord): string | null {
  return actorsInJoinOrder(room)[0]?.actorId ?? null;
}

function copyLoadout(loadout: Loadout | null): Loadout | null {
  if (loadout === null) return null;
  return {
    weapons: [...loadout.weapons],
    selectedIndex: loadout.selectedIndex
  };
}

function createBasePlayerConfigFields(): Omit<PlayerConfig, 'id' | 'position'> {
  return {
    radius: PUBLIC_ARENA_HOST_PLAYER.radius,
    contactBox: PUBLIC_ARENA_HOST_PLAYER.contactBox,
    maxSpeed: PUBLIC_ARENA_HOST_PLAYER.maxSpeed,
    maxHp: PUBLIC_ARENA_HOST_PLAYER.maxHp,
    loadout: copyLoadout(PUBLIC_ARENA_HOST_LOADOUT),
    companion: null
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
      loadout: copyLoadout(PUBLIC_ARENA_HOST_LOADOUT)
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

function defaultOnlineHostClock(): ArenaHostClock {
  return {
    nowMs: () => performance.now(),
    setInterval: (handler, intervalMs) => setInterval(handler, intervalMs),
    clearInterval: (handle) => clearInterval(handle as NodeJS.Timeout)
  };
}

function assertNever(value: never): never {
  throw new Error(`unhandled online session host value: ${String(value)}`);
}
