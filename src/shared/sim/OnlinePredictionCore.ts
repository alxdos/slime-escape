import { BOSS_ARCHETYPES } from '../content/bosses.js';
import { ENEMY_ARCHETYPES } from '../content/enemies.js';
import {
  PUBLIC_ARENA_HOST_BOSS_WEAPON_ID,
  PUBLIC_ARENA_HOST_LOADOUT,
  PUBLIC_ARENA_HOST_PLAYER
} from '../content/publicArena.js';
import type { InputCommand } from '../input.js';
import { log } from '../log.js';
import { assertNever } from '../protocol.js';
import type { Loadout, PlayerConfig, SessionDefinition, Vec2 } from '../session.js';
import type {
  PlayerSnapshot,
  PlayerStatusEffectSnapshot,
  Snapshot,
  WeaponHudSnapshot
} from '../snapshot.js';
import { SIM_STEP_MS } from '../timing.js';

import { createCombatSystem } from './CombatSystem.js';
import {
  createEntityStore,
  type ActorStatusEffect,
  type EntityId,
  type Player
} from './EntityStore.js';
import { createMovementSystem } from './MovementSystem.js';
import {
  addRuntimeInputPlayer,
  createRuntimeInputState,
  runtimeInputForPlayer
} from './RuntimeInputState.js';
import { createSnapshotExportSystem } from './SnapshotExportSystem.js';
import { createSpatialIndex } from './SpatialIndex.js';

const STEP_EPSILON_MS = 1e-9;
const SNAPSHOT_STATUS_EFFECT_SOURCE = {
  kind: 'fieldEffect',
  fieldEffectId: 0 as EntityId,
  archetypeId: 'authoritative-snapshot'
} as const;

type BufferedInput = Readonly<{
  command: InputCommand;
  inputSequence: number;
}>;

type PersistentInputState = {
  moveDir: { dx: number; dy: number };
  aimWorld: Vec2 | null;
  firing: boolean;
  firingInputSequence: number | null;
};

export type OnlinePredictionCoreOptions = Readonly<{
  onPredictedSnapshot(snapshot: Snapshot): void;
}>;

export type OnlinePredictionCore = Readonly<{
  start(session: SessionDefinition, selfPlayerId: string): void;
  stop(): void;
  pause(): void;
  resume(): void;
  submitInput(command: InputCommand, inputSequence: number): void;
  receiveAuthoritativeSnapshot(snapshot: Snapshot): void;
  pump(nowMs: number): void;
}>;

export function createOnlinePredictionCore(
  options: OnlinePredictionCoreOptions
): OnlinePredictionCore {
  const store = createEntityStore();
  const input = createRuntimeInputState();
  const movement = createMovementSystem();
  const combat = createCombatSystem();
  const spatialIndex = createSpatialIndex();
  const exporter = createSnapshotExportSystem();

  let session: SessionDefinition | null = null;
  let selfPlayerId: string | null = null;
  let latestAuthoritativeSnapshot: Snapshot | null = null;
  let inputBuffer: BufferedInput[] = [];
  let acknowledgedInput = createPersistentInputState();
  let running = false;
  let paused = false;
  let simTimeMs = 0;
  let lastWallMs: number | null = null;
  let lagMs = 0;

  function resetRuntime(): void {
    store.clear();
    input.players.clear();
    combat.clear();
    exporter.reset();
    spatialIndex.rebuild(store);
  }

  function resetSessionState(): void {
    resetRuntime();
    latestAuthoritativeSnapshot = null;
    inputBuffer = [];
    acknowledgedInput = createPersistentInputState();
    simTimeMs = 0;
    lastWallMs = null;
    lagMs = 0;
  }

  function activeSelfPlayerId(): string | null {
    return running ? selfPlayerId : null;
  }

  function playerByStableId(playerId: string): Player | null {
    for (const player of store.players()) {
      if (player.playerId === playerId) return player;
    }
    return null;
  }

  function trimAcknowledgedInputs(snapshot: Snapshot): void {
    const playerId = activeSelfPlayerId();
    if (playerId === null) return;
    const lastAcknowledged = snapshot.lastInputSequence[playerId] ?? 0;
    const remaining: BufferedInput[] = [];
    for (const entry of inputBuffer) {
      if (entry.inputSequence <= lastAcknowledged) {
        applyCommandToPersistentInput(acknowledgedInput, entry.command, entry.inputSequence);
      } else {
        remaining.push(entry);
      }
    }
    inputBuffer = remaining;
  }

  function syncFromAuthoritativeSnapshot(snapshot: Snapshot): boolean {
    const playerId = activeSelfPlayerId();
    const activeSession = session;
    if (playerId === null || activeSession === null) return false;
    const selfSnapshot = findSelfPlayerSnapshot(snapshot, playerId);
    if (selfSnapshot === null) {
      resetRuntime();
      return false;
    }
    const playerConfig = playerConfigFromSnapshot(activeSession, selfSnapshot);
    if (playerConfig === null) {
      resetRuntime();
      log.warn('online predictor ignored snapshot without a self player config', { playerId });
      return false;
    }
    const player = syncSelfPlayer(playerConfig, selfSnapshot);
    syncRuntimeInputFromSnapshot(playerConfig, selfSnapshot.weaponHud);
    syncOwnProjectiles(snapshot, selfSnapshot, player.id);
    return true;
  }

  function syncSelfPlayer(playerConfig: PlayerConfig, snapshot: PlayerSnapshot): Player {
    let player = playerByStableId(snapshot.playerId);
    if (player === null) {
      player = store.spawnPlayer(playerConfig);
    }
    player.radius = playerConfig.radius;
    player.contactBox = {
      width: playerConfig.contactBox.width,
      height: playerConfig.contactBox.height
    };
    player.maxSpeed = playerConfig.maxSpeed;
    player.maxHp = snapshot.maxHp;
    player.hp = snapshot.hp;
    player.state = snapshot.state;
    player.formArchetypeId = snapshot.formArchetypeId;
    player.position.x = snapshot.x;
    player.position.y = snapshot.y;
    player.velocity.vx = 0;
    player.velocity.vy = 0;
    player.statusEffects = statusEffectsFromSnapshot(snapshot.statusEffects);
    combat.setPlayerWeaponHud(player.id, snapshot.weaponHud);
    return player;
  }

  function syncRuntimeInputFromSnapshot(
    playerConfig: PlayerConfig,
    weaponHud: WeaponHudSnapshot | null
  ): void {
    input.players.clear();
    addRuntimeInputPlayer(input, {
      ...playerConfig,
      loadout: runtimeLoadoutFromWeaponHud(weaponHud) ?? playerConfig.loadout
    });
    applyPersistentInputToRuntime(acknowledgedInput);
  }

  function syncOwnProjectiles(
    snapshot: Snapshot,
    selfSnapshot: PlayerSnapshot,
    localSelfEntityId: EntityId
  ): void {
    const acknowledged = snapshot.lastInputSequence[selfSnapshot.playerId] ?? 0;
    const authoritativeSequences = new Set<number>();
    for (const entity of snapshot.entities) {
      if (entity.kind !== 'projectile') continue;
      if (entity.ownerKind !== 'player' || entity.ownerId !== selfSnapshot.id) continue;
      if (entity.spawnInputSequence === null) continue;
      authoritativeSequences.add(entity.spawnInputSequence);
    }

    const removals: EntityId[] = [];
    for (const projectile of store.projectiles()) {
      if (projectile.ownerId !== localSelfEntityId) continue;
      const sequence = projectile.spawnInputSequence;
      if (sequence !== null && authoritativeSequences.has(sequence)) continue;
      if (sequence !== null && sequence > acknowledged) continue;
      removals.push(projectile.id);
    }
    for (const projectileId of removals) {
      store.removeProjectile(projectileId);
    }
  }

  function replayBufferedInputs(): void {
    for (const entry of inputBuffer) {
      applyInputCommand(entry.command, entry.inputSequence);
      simTimeMs += SIM_STEP_MS;
      tickSystems();
    }
  }

  function tickSystems(): void {
    const activeSession = session;
    if (activeSession === null) return;
    movement.tick(activeSession.arena, store, input, simTimeMs);
    combat.tick(input, store, spatialIndex, simTimeMs, activeSession.arena, () => undefined);
    combat.drainActorEffectIntents();
  }

  function applyPersistentInputToRuntime(state: PersistentInputState): void {
    const playerId = activeSelfPlayerId();
    if (playerId === null) return;
    const playerInput = runtimeInputForPlayer(input, playerId);
    if (playerInput === null) return;
    playerInput.moveDir.dx = state.moveDir.dx;
    playerInput.moveDir.dy = state.moveDir.dy;
    if (state.aimWorld !== null) {
      playerInput.aimWorld.x = state.aimWorld.x;
      playerInput.aimWorld.y = state.aimWorld.y;
    }
    playerInput.firing = state.firing;
    playerInput.firingInputSequence = state.firingInputSequence;
  }

  function applyInputCommand(command: InputCommand, inputSequence: number): void {
    const playerId = activeSelfPlayerId();
    if (playerId === null) return;
    const playerInput = runtimeInputForPlayer(input, playerId);
    if (playerInput === null) return;
    switch (command.kind) {
      case 'move':
        playerInput.moveDir.dx = command.dx;
        playerInput.moveDir.dy = command.dy;
        return;
      case 'aim':
        playerInput.aimWorld.x = command.x;
        playerInput.aimWorld.y = command.y;
        return;
      case 'fire':
        playerInput.firing = command.phase === 'start';
        playerInput.firingInputSequence = command.phase === 'start' ? inputSequence : null;
        return;
      case 'selectWeaponSlot':
        selectWeaponSlot(input, playerId, command.slotIndex);
        return;
      case 'holsterWeapon':
        holsterWeapon(input, playerId);
        return;
      default:
        assertNever(command);
    }
  }

  function emitPredictedSnapshot(): void {
    const activeSession = session;
    if (activeSession === null || playerByStableId(activeSelfPlayerId() ?? '') === null) {
      return;
    }
    exporter.reset();
    const exported = exporter.onTick(simTimeMs, store, {
      encounter: null,
      zone: latestAuthoritativeSnapshot?.zone ?? { mode: 'disabled', margin: 0 },
      waveProgress: null,
      weaponHudFor: (playerId) => combat.weaponHudFor(playerId, simTimeMs),
      lastInputSequence: latestAuthoritativeSnapshot?.lastInputSequence ?? {}
    });
    if (exported === null) return;
    options.onPredictedSnapshot({
      ...exported,
      encounter: latestAuthoritativeSnapshot?.encounter ?? null,
      zone: latestAuthoritativeSnapshot?.zone ?? { mode: 'disabled', margin: 0 },
      waveProgress: latestAuthoritativeSnapshot?.waveProgress ?? null,
      bossHud: latestAuthoritativeSnapshot?.bossHud ?? null
    });
  }

  function pumpRunning(nowMs: number): void {
    if (!running || paused) {
      lastWallMs = nowMs;
      lagMs = 0;
      return;
    }
    if (lastWallMs === null) {
      lastWallMs = nowMs;
      return;
    }
    lagMs += nowMs - lastWallMs;
    lastWallMs = nowMs;
    while (lagMs + STEP_EPSILON_MS >= SIM_STEP_MS) {
      simTimeMs += SIM_STEP_MS;
      tickSystems();
      emitPredictedSnapshot();
      lagMs -= SIM_STEP_MS;
      if (Math.abs(lagMs) < STEP_EPSILON_MS) lagMs = 0;
    }
  }

  return {
    start(nextSession, nextSelfPlayerId): void {
      resetSessionState();
      session = nextSession;
      selfPlayerId = nextSelfPlayerId;
      combat.setDamageRules(nextSession.rules.damage);
      running = true;
      paused = false;
    },
    stop(): void {
      resetSessionState();
      session = null;
      selfPlayerId = null;
      running = false;
      paused = false;
    },
    pause(): void {
      if (!running) return;
      paused = true;
      lastWallMs = null;
      lagMs = 0;
    },
    resume(): void {
      if (!running || !paused) return;
      paused = false;
      lastWallMs = null;
      lagMs = 0;
    },
    submitInput(command, inputSequence): void {
      if (!running) return;
      inputBuffer.push({ command, inputSequence });
      applyInputCommand(command, inputSequence);
    },
    receiveAuthoritativeSnapshot(snapshot): void {
      if (!running) return;
      latestAuthoritativeSnapshot = snapshot;
      simTimeMs = snapshot.simTimeMs;
      lastWallMs = null;
      lagMs = 0;
      trimAcknowledgedInputs(snapshot);
      if (!syncFromAuthoritativeSnapshot(snapshot)) return;
      replayBufferedInputs();
      emitPredictedSnapshot();
    },
    pump(nowMs): void {
      pumpRunning(nowMs);
    }
  };
}

function createPersistentInputState(): PersistentInputState {
  return {
    moveDir: { dx: 0, dy: 0 },
    aimWorld: null,
    firing: false,
    firingInputSequence: null
  };
}

function applyCommandToPersistentInput(
  state: PersistentInputState,
  command: InputCommand,
  inputSequence: number
): void {
  switch (command.kind) {
    case 'move':
      state.moveDir = { dx: command.dx, dy: command.dy };
      return;
    case 'aim':
      state.aimWorld = { x: command.x, y: command.y };
      return;
    case 'fire':
      state.firing = command.phase === 'start';
      state.firingInputSequence = command.phase === 'start' ? inputSequence : null;
      return;
    case 'selectWeaponSlot':
    case 'holsterWeapon':
      return;
    default:
      assertNever(command);
  }
}

function statusEffectsFromSnapshot(
  effects: ReadonlyArray<PlayerStatusEffectSnapshot>
): ActorStatusEffect[] {
  return effects.map((effect) => {
    switch (effect.kind) {
      case 'slow':
        return {
          kind: 'slow',
          speedMultiplier: effect.speedMultiplier,
          expireAtSimMs: effect.expireAtSimMs,
          source: SNAPSHOT_STATUS_EFFECT_SOURCE
        };
      case 'burn':
        return {
          kind: 'burn',
          damagePerTick: 0,
          tickEveryMs: Number.MAX_SAFE_INTEGER,
          nextTickSimMs: effect.expireAtSimMs,
          expireAtSimMs: effect.expireAtSimMs,
          source: SNAPSHOT_STATUS_EFFECT_SOURCE
        };
      case 'poison':
        return {
          kind: 'poison',
          damagePerTick: 0,
          tickEveryMs: Number.MAX_SAFE_INTEGER,
          nextTickSimMs: effect.expireAtSimMs,
          expireAtSimMs: effect.expireAtSimMs,
          source: SNAPSHOT_STATUS_EFFECT_SOURCE
        };
      default:
        return assertNever(effect);
    }
  });
}

function findSelfPlayerSnapshot(snapshot: Snapshot, playerId: string): PlayerSnapshot | null {
  for (const entity of snapshot.entities) {
    if (entity.kind === 'player' && entity.playerId === playerId) return entity;
  }
  return null;
}

function playerConfigFromSnapshot(
  session: SessionDefinition,
  snapshot: PlayerSnapshot
): PlayerConfig | null {
  const baseConfig =
    session.players.find((player) => player.id === snapshot.playerId) ?? session.players[0];
  if (baseConfig === undefined) {
    log.warn('online predictor cannot resolve self PlayerConfig; will retry on next snapshot', {
      playerId: snapshot.playerId
    });
    return null;
  }
  const formConfig = formPlayerConfigFields(snapshot.formArchetypeId, baseConfig);
  return {
    id: snapshot.playerId,
    position: { x: snapshot.x, y: snapshot.y },
    companion: null,
    ...formConfig
  };
}

function formPlayerConfigFields(
  formArchetypeId: string | null,
  baseConfig: PlayerConfig
): Omit<PlayerConfig, 'id' | 'position' | 'companion'> {
  if (formArchetypeId === null) {
    return {
      radius: baseConfig.radius,
      contactBox: baseConfig.contactBox,
      maxSpeed: baseConfig.maxSpeed,
      maxHp: baseConfig.maxHp,
      loadout: copyLoadout(baseConfig.loadout)
    };
  }
  const enemy = ENEMY_ARCHETYPES[formArchetypeId];
  if (enemy !== undefined) {
    return {
      radius: enemy.radius,
      contactBox: enemy.contactBox,
      maxSpeed: PUBLIC_ARENA_HOST_PLAYER.maxSpeed,
      maxHp: enemy.maxHp,
      loadout: copyLoadout(PUBLIC_ARENA_HOST_LOADOUT)
    };
  }
  const boss = BOSS_ARCHETYPES[formArchetypeId];
  if (boss !== undefined) {
    return {
      radius: boss.radius,
      contactBox: boss.contactBox,
      maxSpeed: boss.maxSpeed,
      maxHp: boss.maxHp,
      loadout: {
        weapons: [PUBLIC_ARENA_HOST_BOSS_WEAPON_ID],
        selectedIndex: 0
      }
    };
  }
  return {
    radius: baseConfig.radius,
    contactBox: baseConfig.contactBox,
    maxSpeed: baseConfig.maxSpeed,
    maxHp: baseConfig.maxHp,
    loadout: copyLoadout(baseConfig.loadout)
  };
}

function copyLoadout(loadout: Loadout | null): Loadout | null {
  return loadout === null
    ? null
    : {
        weapons: [...loadout.weapons],
        selectedIndex: loadout.selectedIndex
      };
}

function runtimeLoadoutFromWeaponHud(weaponHud: WeaponHudSnapshot | null): Loadout | null {
  if (weaponHud === null) return null;
  return {
    weapons: weaponHud.weapons.map((weapon) => weapon.weaponArchetypeId),
    selectedIndex: weaponHud.selectedIndex
  };
}

function selectWeaponSlot(
  input: ReturnType<typeof createRuntimeInputState>,
  playerId: string,
  slotIndex: number
): void {
  const playerInput = runtimeInputForPlayer(input, playerId);
  if (playerInput === null || playerInput.loadout === null) {
    log.warn('selectWeaponSlot ignored: no active player loadout', { slotIndex });
    return;
  }
  if (
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= playerInput.loadout.weapons.length
  ) {
    log.warn('selectWeaponSlot ignored: slot index outside player loadout', {
      slotIndex,
      weaponCount: playerInput.loadout.weapons.length
    });
    return;
  }
  playerInput.loadout.selectedIndex = slotIndex;
}

function holsterWeapon(input: ReturnType<typeof createRuntimeInputState>, playerId: string): void {
  const playerInput = runtimeInputForPlayer(input, playerId);
  if (playerInput?.loadout === null || playerInput?.loadout === undefined) return;
  playerInput.loadout.selectedIndex = null;
}
