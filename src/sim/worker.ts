import type { RuntimeEvent } from '../shared/events';
import { log } from '../shared/log';
import { assertNever, type MainToSim, type SimToMain } from '../shared/protocol';

import { createBossPhaseSystem } from './BossPhaseSystem';
import { createCombatSystem } from './CombatSystem';
import { createDropSystem } from './DropSystem';
import { createEntityStore } from './EntityStore';
import { createFieldEffectSystem } from './FieldEffectSystem';
import { createHealthDeathSystem } from './HealthDeathSystem';
import { createMovementSystem } from './MovementSystem';
import { createSessionFlowSystem } from './SessionFlowSystem';
import { createSimulationClock } from './SimulationClock';
import { createSnapshotExportSystem } from './SnapshotExportSystem';
import { createSpatialIndex } from './SpatialIndex';
import { createSpawnSystem } from './SpawnSystem';
import { createStatusEffectSystem } from './StatusEffectSystem';
import { createRetaliationSystem } from './RetaliationSystem';
import { createZoneSystem } from './ZoneSystem';

const entities = createEntityStore();
const exporter = createSnapshotExportSystem();
const movement = createMovementSystem();
const bossPhase = createBossPhaseSystem();
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
let pendingFieldDamageIntents: ReturnType<typeof fieldEffects.tick>['damageIntents'] = [];
let pendingStatusDamageIntents: ReturnType<typeof statusEffects.tick> = [];
const drops = createDropSystem(undefined, undefined, {
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
});

function postToMain(msg: SimToMain): void {
  self.postMessage(msg);
}

function emitEvent(event: RuntimeEvent): void {
  postToMain({ kind: 'event', event });
}

const clock = createSimulationClock((_dtMs, simTimeMs) => {
  const session = sessionFlow.activeSession();
  if (session === null) return;
  spawn.onTick(simTimeMs, entities);
  const bossIntents = bossPhase.tick(entities, session.arena, simTimeMs, emitEvent);
  movement.tick(session.arena, entities, sessionFlow.inputState(), simTimeMs);
  const combatIntents = combat.tick(
    sessionFlow.inputState(),
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
    weaponHud: combat.weaponHudFor(entities.player()?.id ?? null)
  });
  if (snapshot !== null) {
    postToMain({ kind: 'snapshot', snapshot });
  }
});

const sessionFlow = createSessionFlowSystem({
  clock,
  emitEvent,
  waveProgress: () => spawn.waveProgress(),
  onSessionStart(session, rng) {
    entities.clear();
    exporter.reset();
    combat.clear();
    fieldEffects.clear();
    statusEffects.clear();
    drops.clear();
    zone.reset();
    pendingFieldDamageIntents = [];
    pendingStatusDamageIntents = [];
    spawn.setRng(rng);
    drops.setRng(rng);
    combat.setDamageRules(session.rules.damage);
    fieldEffects.setDamageRules(session.rules.damage);
    const player = entities.spawnPlayer(session.player);
    if (session.loadout !== null) {
      combat.setPlayerLoadout(player.id, session.loadout, clock.simTimeMs());
    }
  },
  onSessionStop() {
    entities.clear();
    exporter.reset();
    combat.clear();
    fieldEffects.clear();
    statusEffects.clear();
    drops.clear();
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
  }
});

healthDeath.registerHook((ctx) => {
  if (ctx.entityKind === 'enemy') spawn.onEnemyDeath(ctx.entityId);
  if (ctx.entityKind === 'enemy') combat.removeShooter(ctx.entityId);
  if (ctx.entityKind === 'boss') spawn.onBossDeath(ctx.entityId);
  if (ctx.entityKind === 'boss') sessionFlow.onBossDeath(ctx.entityId);
  if (ctx.entityKind === 'enemy') drops.onDeathHook(ctx, entities, emitEvent);
  if (ctx.entityKind === 'player') sessionFlow.onPlayerDeath();
});

healthDeath.registerDamageHook((ctx) => retaliation.onDamage(ctx, entities));

self.addEventListener('message', (event: MessageEvent<MainToSim>) => {
  const msg = event.data;
  switch (msg.kind) {
    case 'startSession':
      sessionFlow.start(msg.session);
      return;
    case 'stopSession':
      sessionFlow.stop();
      return;
    case 'pause':
      sessionFlow.pause();
      return;
    case 'resume':
      sessionFlow.resume();
      return;
    case 'input':
      sessionFlow.handleInput(msg.command);
      return;
    case 'debug':
      log.warn('debug command received but not implemented', { command: msg.command });
      return;
    default:
      assertNever(msg);
  }
});

clock.start();
