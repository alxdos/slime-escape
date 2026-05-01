import type { RuntimeEvent } from '../events.js';
import type { InputCommand } from '../input.js';
import { log } from '../log.js';
import type { ContactBox, Loadout, PlayerConfig, SessionDefinition } from '../session.js';
import type { Snapshot } from '../snapshot.js';

import { createBossPhaseSystem } from './BossPhaseSystem.js';
import { createCompanionSystem } from './CompanionSystem.js';
import { createCombatSystem } from './CombatSystem.js';
import { createDropSystem } from './DropSystem.js';
import { createEntityStore, type EntityId, type Player } from './EntityStore.js';
import { createFieldEffectSystem } from './FieldEffectSystem.js';
import { createHealthDeathSystem } from './HealthDeathSystem.js';
import { createMovementSystem } from './MovementSystem.js';
import { createRetaliationSystem } from './RetaliationSystem.js';
import {
  addRuntimeInputPlayer,
  removeRuntimeInputPlayer,
  runtimeInputForPlayer,
  setRuntimeInputPlayerLoadout
} from './RuntimeInputState.js';
import { createRunSummaryTracker } from './RunSummaryTracker.js';
import { createSessionFlowSystem } from './SessionFlowSystem.js';
import { createSimulationClock } from './SimulationClock.js';
import { createSnapshotExportSystem } from './SnapshotExportSystem.js';
import { createSpatialIndex } from './SpatialIndex.js';
import { createSpawnSystem } from './SpawnSystem.js';
import { createStatusEffectSystem } from './StatusEffectSystem.js';
import { createZoneSystem } from './ZoneSystem.js';

export type SimulationCoreOptions = Readonly<{
  onSnapshot(snapshot: Snapshot): void;
  onEvent(event: RuntimeEvent): void;
}>;

export type PlayerFormUpdate = Readonly<{
  radius?: number;
  contactBox?: ContactBox;
  maxSpeed?: number;
  maxHp?: number;
  loadout?: Loadout | null;
  formArchetypeId?: string | null;
}>;

export type SimulationCore = Readonly<{
  start(session: SessionDefinition): void;
  stop(): void;
  pause(): void;
  resume(): void;
  submitInput(playerId: string, command: InputCommand, inputSequence?: number): void;
  addPlayer(playerConfig: PlayerConfig, opts?: { invulnerableUntilSimMs?: number }): void;
  removePlayer(playerId: string): void;
  setPlayerForm(
    playerId: string,
    formUpdate: PlayerFormUpdate,
    opts?: { refillHp?: boolean }
  ): void;
  pump(nowMs: number): void;
}>;

type PendingDynamicRosterOp =
  | Readonly<{
      kind: 'addPlayer';
      playerConfig: PlayerConfig;
      invulnerableUntilSimMs: number | null;
    }>
  | Readonly<{ kind: 'removePlayer'; playerId: string }>
  | Readonly<{
      kind: 'setPlayerForm';
      playerId: string;
      formUpdate: PlayerFormUpdate;
      refillHp: boolean;
    }>;

export function createSimulationCore(options: SimulationCoreOptions): SimulationCore {
  const entities = createEntityStore();
  const exporter = createSnapshotExportSystem();
  const movement = createMovementSystem();
  const bossPhase = createBossPhaseSystem();
  const companion = createCompanionSystem();
  const combat = createCombatSystem();
  const spawn = createSpawnSystem({
    onEnemySpawned(enemyId, loadout, simTimeMs) {
      combat.setEnemyLoadout(enemyId, loadout, simTimeMs);
    }
  });
  const fieldEffects = createFieldEffectSystem();
  const healthDeath = createHealthDeathSystem();
  const statusEffects = createStatusEffectSystem();
  const retaliation = createRetaliationSystem();
  const spatialIndex = createSpatialIndex();
  const zone = createZoneSystem();
  const runSummary = createRunSummaryTracker();
  let pendingFieldDamageIntents: ReturnType<typeof fieldEffects.tick>['damageIntents'] = [];
  let pendingStatusDamageIntents: ReturnType<typeof statusEffects.tick> = [];
  let pendingDynamicRosterOps: PendingDynamicRosterOp[] = [];
  const drops = createDropSystem(
    undefined,
    undefined,
    {
      addModifierToSelectedWeapon(ownerId, modifier) {
        combat.addModifierToSelectedWeapon(ownerId, modifier);
      },
      applyTemporaryOverdriveToSelectedWeapon(ownerId, cooldownMultiplier, durationMs, simTimeMs) {
        combat.applyTemporaryOverdriveToSelectedWeapon(
          ownerId,
          cooldownMultiplier,
          durationMs,
          simTimeMs
        );
      }
    },
    (fact) => runSummary.onDropPickup(fact)
  );

  const emitEvent = (event: RuntimeEvent): void => {
    options.onEvent(event);
  };

  const clock = createSimulationClock((_dtMs, simTimeMs) => {
    const session = sessionFlow.activeSession();
    if (session === null) return;
    applyPendingDynamicRosterOps(simTimeMs);
    const inputState = sessionFlow.inputState();
    spawn.onTick(simTimeMs, entities);
    const bossIntents = bossPhase.tick(entities, session.arena, simTimeMs, emitEvent);
    movement.tick(session.arena, entities, inputState, simTimeMs);
    companion.tick(
      session.arena,
      entities,
      sessionFlow.activeEncounter()?.encounter ?? null,
      simTimeMs,
      emitEvent,
      session.playerCoopRevive
    );
    const combatIntents = combat.tick(
      inputState,
      entities,
      spatialIndex,
      simTimeMs,
      session.arena,
      emitEvent
    );
    const combatActorEffectIntents = combat.drainActorEffectIntents();
    const intents = [
      ...pendingFieldDamageIntents,
      ...pendingStatusDamageIntents,
      ...bossIntents,
      ...combatIntents
    ];
    pendingFieldDamageIntents = [];
    pendingStatusDamageIntents = [];
    healthDeath.tick(intents, entities, simTimeMs, emitEvent);
    spatialIndex.rebuild(entities);
    statusEffects.apply(combatActorEffectIntents, simTimeMs, entities);
    const fieldEffectResult = fieldEffects.tick(simTimeMs, entities, spatialIndex);
    statusEffects.apply(fieldEffectResult.actorEffectIntents, simTimeMs, entities);
    pendingStatusDamageIntents = statusEffects.tick(simTimeMs, entities);
    pendingFieldDamageIntents = fieldEffectResult.damageIntents;
    drops.tick(simTimeMs, entities, emitEvent);
    sessionFlow.checkTransitions(simTimeMs);
    const zoneEncounterCtx = sessionFlow.activeEncounter();
    zone.onTick(
      zoneEncounterCtx === null ? undefined : simTimeMs - zoneEncounterCtx.startSimMs
    );
    const encounterCtx = sessionFlow.activeEncounter();
    const waveSnap =
      encounterCtx !== null && encounterCtx.encounter.spawnPlan.kind === 'wave'
        ? spawn.waveProgress()
        : null;
    const snapshot = exporter.onTick(simTimeMs, entities, {
      encounter: encounterCtx,
      zone: zone.zone(),
      waveProgress: waveSnap,
      weaponHudFor: (playerId) => combat.weaponHudFor(playerId, simTimeMs)
    });
    if (snapshot !== null) {
      options.onSnapshot(snapshot);
    }
  });

  const sessionFlow = createSessionFlowSystem({
    clock,
    emitEvent,
    buildResultSummary: (outcome, simTimeMs) =>
      runSummary.buildSummary(outcome, simTimeMs, {
        session: sessionFlow.activeSession(),
        activeEncounter: sessionFlow.activeEncounter(),
        waveProgress: spawn.waveProgress(),
        store: entities
      }),
    waveProgress: () => spawn.waveProgress(),
    livePlayerCount: () => livePlayerCount(entities),
    onSessionStart(session, rng) {
      entities.clear();
      exporter.reset();
      combat.clear();
      healthDeath.clear();
      companion.clear();
      fieldEffects.clear();
      statusEffects.clear();
      drops.clear();
      runSummary.reset();
      zone.reset();
      pendingFieldDamageIntents = [];
      pendingStatusDamageIntents = [];
      pendingDynamicRosterOps = [];
      spawn.setRng(rng);
      drops.setRng(rng);
      combat.setDamageRules(session.rules.damage);
      healthDeath.setPlayerDeathMode(
        session.lossCondition.kind === 'allPlayersDead' ? 'ghost' : 'remove'
      );
      fieldEffects.setDamageRules(session.rules.damage);
      for (const playerConfig of session.players) {
        const player = entities.spawnPlayer(playerConfig, {
          simTimeMs: clock.simTimeMs(),
          emit: emitEvent
        });
        if (playerConfig.loadout !== null) {
          combat.setPlayerLoadout(player.id, playerConfig.loadout, clock.simTimeMs());
        }
        if (playerConfig.companion !== null) {
          const offset = playerConfig.companion.movement.orbitRadius * 0.75;
          const spawnedCompanion = entities.spawnCompanion({
            ...playerConfig.companion,
            ownerPlayerId: playerConfig.id,
            position: {
              x: player.position.x - offset,
              y: player.position.y - offset
            }
          });
          if (playerConfig.companion.weaponLoadout !== null) {
            combat.setCompanionLoadout(
              spawnedCompanion.id,
              playerConfig.companion.weaponLoadout,
              clock.simTimeMs()
            );
          }
        }
      }
    },
    onSessionStop() {
      entities.clear();
      exporter.reset();
      combat.clear();
      healthDeath.clear();
      companion.clear();
      fieldEffects.clear();
      statusEffects.clear();
      drops.clear();
      runSummary.reset();
      zone.reset();
      pendingFieldDamageIntents = [];
      pendingStatusDamageIntents = [];
      pendingDynamicRosterOps = [];
      spawn.setRng(null);
    },
    onEncounterStart(encounter) {
      const session = sessionFlow.activeSession();
      if (session === null) return;
      spawn.onEncounterStart(encounter, entities, session.arena, clock.simTimeMs());
      zone.onEncounterStart(encounter);
    },
    onEncounterEnd(encounter) {
      spawn.onEncounterEnd(encounter);
      zone.onEncounterEnd(encounter);
    },
    onEncounterComplete(encounter) {
      runSummary.onEncounterComplete(sessionFlow.activeSession(), encounter);
    }
  });

  healthDeath.registerHook((ctx) => {
    runSummary.onDeath(ctx, entities);
    if (ctx.entityKind === 'enemy') spawn.onEnemyDeath(ctx.entityId);
    if (ctx.entityKind === 'enemy') combat.removeShooter(ctx.entityId);
    if (ctx.entityKind === 'boss') spawn.onBossDeath(ctx.entityId);
    if (ctx.entityKind === 'boss') sessionFlow.onBossDeath(ctx.entityId);
    if (ctx.entityKind === 'enemy') drops.onDeathHook(ctx, entities, emitEvent);
    if (ctx.entityKind === 'player') {
      const player = entities.playerById(ctx.entityId);
      if (player !== null && player.state === 'ghost') {
        const playerInput = runtimeInputForPlayer(sessionFlow.inputState(), player.playerId);
        if (playerInput !== null) playerInput.firing = false;
      } else if (player !== null) {
        removeRuntimeInputPlayer(sessionFlow.inputState(), player.playerId);
        combat.removeShooter(ctx.entityId);
      }
      sessionFlow.onPlayerDeath(ctx.entityId);
    }
  });

  healthDeath.registerDamageHook((ctx) => retaliation.onDamage(ctx, entities));

  function applyPendingDynamicRosterOps(simTimeMs: number): void {
    if (pendingDynamicRosterOps.length === 0) return;
    const ops = pendingDynamicRosterOps;
    pendingDynamicRosterOps = [];
    for (const op of ops) {
      switch (op.kind) {
        case 'addPlayer':
          applyAddPlayer(op.playerConfig, op.invulnerableUntilSimMs, simTimeMs);
          break;
        case 'removePlayer':
          applyRemovePlayer(op.playerId);
          break;
        case 'setPlayerForm':
          applySetPlayerForm(op.playerId, op.formUpdate, op.refillHp, simTimeMs);
          break;
        default:
          assertNeverDynamicRosterOp(op);
      }
    }
  }

  function applyAddPlayer(
    playerConfig: PlayerConfig,
    invulnerableUntilSimMs: number | null,
    simTimeMs: number
  ): void {
    if (!canApplyDynamicRosterOp('addPlayer')) return;
    if (runtimeInputForPlayer(sessionFlow.inputState(), playerConfig.id) !== null) {
      log.warn('addPlayer ignored: playerId already exists', { playerId: playerConfig.id });
      return;
    }
    const player = entities.spawnPlayer(
      {
        ...playerConfig,
        invulnerableUntilSimMs
      },
      { simTimeMs, emit: emitEvent }
    );
    addRuntimeInputPlayer(sessionFlow.inputState(), playerConfig);
    if (playerConfig.loadout !== null) {
      combat.setPlayerLoadout(player.id, playerConfig.loadout, simTimeMs);
    }
    if (playerConfig.companion !== null) {
      const offset = playerConfig.companion.movement.orbitRadius * 0.75;
      const spawnedCompanion = entities.spawnCompanion({
        ...playerConfig.companion,
        ownerPlayerId: playerConfig.id,
        position: {
          x: player.position.x - offset,
          y: player.position.y - offset
        }
      });
      if (playerConfig.companion.weaponLoadout !== null) {
        combat.setCompanionLoadout(
          spawnedCompanion.id,
          playerConfig.companion.weaponLoadout,
          simTimeMs
        );
      }
    }
  }

  function applyRemovePlayer(playerId: string): void {
    if (!canApplyDynamicRosterOp('removePlayer')) return;
    const player = playerByStableId(playerId);
    if (player === null) {
      log.warn('removePlayer ignored: unknown playerId', { playerId });
      return;
    }
    removeRuntimeInputPlayer(sessionFlow.inputState(), playerId);
    combat.removeShooter(player.id);
    removeProjectilesOwnedBy(player.id);
    removeCompanionForPlayer(playerId);
    entities.removePlayer(player.id);
  }

  function applySetPlayerForm(
    playerId: string,
    formUpdate: PlayerFormUpdate,
    refillHp: boolean,
    simTimeMs: number
  ): void {
    if (!canApplyDynamicRosterOp('setPlayerForm')) return;
    const player = playerByStableId(playerId);
    if (player === null) {
      log.warn('setPlayerForm ignored: unknown playerId', { playerId });
      return;
    }
    if (formUpdate.radius !== undefined) player.radius = formUpdate.radius;
    if (formUpdate.contactBox !== undefined) {
      player.contactBox = {
        width: formUpdate.contactBox.width,
        height: formUpdate.contactBox.height
      };
    }
    if (formUpdate.maxSpeed !== undefined) player.maxSpeed = formUpdate.maxSpeed;
    if (formUpdate.maxHp !== undefined) player.maxHp = formUpdate.maxHp;
    if ('formArchetypeId' in formUpdate) {
      player.formArchetypeId = formUpdate.formArchetypeId ?? null;
    }
    if ('loadout' in formUpdate) {
      const loadout = formUpdate.loadout ?? null;
      setRuntimeInputPlayerLoadout(sessionFlow.inputState(), playerId, loadout);
      if (loadout === null) {
        combat.removeShooter(player.id);
      } else {
        combat.setPlayerLoadout(player.id, loadout, simTimeMs);
      }
    }
    player.hp = refillHp ? player.maxHp : Math.min(player.hp, player.maxHp);
  }

  function canApplyDynamicRosterOp(opName: string): boolean {
    const session = sessionFlow.activeSession();
    if (session === null) {
      log.warn(`${opName} ignored: no active session`);
      return false;
    }
    if (!session.dynamicRoster) {
      log.warn(`${opName} ignored: active session has fixed roster`, {
        sessionId: session.id
      });
      return false;
    }
    return true;
  }

  function playerByStableId(playerId: string): Player | null {
    for (const player of entities.players()) {
      if (player.playerId === playerId) return player;
    }
    return null;
  }

  function livePlayerCount(store: typeof entities): number {
    let count = 0;
    for (const player of store.players()) {
      if (player.state === 'alive' && player.hp > 0) count += 1;
    }
    return count;
  }

  function removeProjectilesOwnedBy(ownerId: EntityId): void {
    const removals: EntityId[] = [];
    for (const projectile of entities.projectiles()) {
      if (projectile.ownerId === ownerId) removals.push(projectile.id);
    }
    for (const projectileId of removals) {
      entities.removeProjectile(projectileId);
    }
  }

  function canSubmitInputForPlayerState(
    playerId: string,
    commandKind: InputCommand['kind']
  ): boolean {
    const player = playerByStableId(playerId);
    if (player === null) return true;
    if (player.state === 'alive') return true;
    if (commandKind === 'move') return true;
    log.warn('input command ignored: ghost player accepts only movement', {
      playerId,
      commandKind
    });
    return false;
  }

  function removeCompanionForPlayer(playerId: string): void {
    const companion = entities.companionByOwnerPlayerId(playerId);
    if (companion === null) return;
    combat.removeShooter(companion.id);
    removeProjectilesOwnedBy(companion.id);
    entities.removeCompanion(companion.id);
  }

  function enqueueDynamicRosterOp(op: PendingDynamicRosterOp): void {
    const session = sessionFlow.activeSession();
    if (session === null) {
      log.warn(`${op.kind} ignored: no active session`);
      return;
    }
    if (!session.dynamicRoster) {
      log.warn(`${op.kind} ignored: active session has fixed roster`, {
        sessionId: session.id
      });
      return;
    }
    pendingDynamicRosterOps.push(op);
  }

  return {
    start(session): void {
      sessionFlow.start(session);
    },
    stop(): void {
      sessionFlow.stop();
    },
    pause(): void {
      sessionFlow.pause();
    },
    resume(): void {
      sessionFlow.resume();
    },
    submitInput(playerId, command, inputSequence): void {
      if (!canSubmitInputForPlayerState(playerId, command.kind)) return;
      sessionFlow.handleInput(playerId, command, inputSequence);
    },
    addPlayer(playerConfig, opts): void {
      enqueueDynamicRosterOp({
        kind: 'addPlayer',
        playerConfig,
        invulnerableUntilSimMs: opts?.invulnerableUntilSimMs ?? null
      });
    },
    removePlayer(playerId): void {
      enqueueDynamicRosterOp({ kind: 'removePlayer', playerId });
    },
    setPlayerForm(playerId, formUpdate, opts): void {
      enqueueDynamicRosterOp({
        kind: 'setPlayerForm',
        playerId,
        formUpdate,
        refillHp: opts?.refillHp ?? false
      });
    },
    pump(nowMs): void {
      clock.pump(nowMs);
    }
  };
}

function assertNeverDynamicRosterOp(value: never): never {
  throw new Error(`unhandled dynamic roster op: ${String(value)}`);
}
