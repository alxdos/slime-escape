import type { RuntimeEvent } from '../events';
import type { InputCommand } from '../input';
import type { SessionDefinition } from '../session';
import type { Snapshot } from '../snapshot';

import { createBossPhaseSystem } from './BossPhaseSystem';
import { createCompanionSystem } from './CompanionSystem';
import { createCombatSystem } from './CombatSystem';
import { createDropSystem } from './DropSystem';
import { createEntityStore } from './EntityStore';
import { createFieldEffectSystem } from './FieldEffectSystem';
import { createHealthDeathSystem } from './HealthDeathSystem';
import { createMovementSystem } from './MovementSystem';
import { createRetaliationSystem } from './RetaliationSystem';
import { createRunSummaryTracker } from './RunSummaryTracker';
import { firstRuntimeInput } from './RuntimeInputState';
import { createSessionFlowSystem } from './SessionFlowSystem';
import { createSimulationClock } from './SimulationClock';
import { createSnapshotExportSystem } from './SnapshotExportSystem';
import { createSpatialIndex } from './SpatialIndex';
import { createSpawnSystem } from './SpawnSystem';
import { createStatusEffectSystem } from './StatusEffectSystem';
import { createZoneSystem } from './ZoneSystem';

export type SimulationCoreOptions = Readonly<{
  onSnapshot(snapshot: Snapshot): void;
  onEvent(event: RuntimeEvent): void;
}>;

export type SimulationCore = Readonly<{
  start(session: SessionDefinition): void;
  stop(): void;
  pause(): void;
  resume(): void;
  submitInput(playerId: string, command: InputCommand): void;
  pump(nowMs: number): void;
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
    const primaryInput = firstRuntimeInput(sessionFlow.inputState());
    spawn.onTick(simTimeMs, entities);
    const bossIntents = bossPhase.tick(entities, session.arena, simTimeMs, emitEvent);
    movement.tick(session.arena, entities, primaryInput, simTimeMs);
    companion.tick(
      session.arena,
      entities,
      sessionFlow.activeEncounter()?.encounter ?? null,
      simTimeMs,
      emitEvent
    );
    const combatIntents = combat.tick(
      primaryInput,
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
      weaponHud: combat.weaponHudFor(entities.player()?.id ?? null, simTimeMs)
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
    onSessionStart(session, rng) {
      entities.clear();
      exporter.reset();
      combat.clear();
      fieldEffects.clear();
      statusEffects.clear();
      drops.clear();
      runSummary.reset();
      zone.reset();
      pendingFieldDamageIntents = [];
      pendingStatusDamageIntents = [];
      spawn.setRng(rng);
      drops.setRng(rng);
      combat.setDamageRules(session.rules.damage);
      fieldEffects.setDamageRules(session.rules.damage);
      const primaryPlayer = session.players[0];
      const player = entities.spawnPlayer(primaryPlayer);
      if (session.companion !== null) {
        const offset = session.companion.movement.orbitRadius * 0.75;
        const spawnedCompanion = entities.spawnCompanion({
          ...session.companion,
          position: {
            x: player.position.x - offset,
            y: player.position.y - offset
          }
        });
        if (session.companion.weaponLoadout !== null) {
          combat.setCompanionLoadout(
            spawnedCompanion.id,
            session.companion.weaponLoadout,
            clock.simTimeMs()
          );
        }
      }
      if (primaryPlayer.loadout !== null) {
        combat.setPlayerLoadout(player.id, primaryPlayer.loadout, clock.simTimeMs());
      }
    },
    onSessionStop() {
      entities.clear();
      exporter.reset();
      combat.clear();
      fieldEffects.clear();
      statusEffects.clear();
      drops.clear();
      runSummary.reset();
      zone.reset();
      pendingFieldDamageIntents = [];
      pendingStatusDamageIntents = [];
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
    if (ctx.entityKind === 'player') sessionFlow.onPlayerDeath();
  });

  healthDeath.registerDamageHook((ctx) => retaliation.onDamage(ctx, entities));

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
    submitInput(playerId, command): void {
      sessionFlow.handleInput(playerId, command);
    },
    pump(nowMs): void {
      clock.pump(nowMs);
    }
  };
}
