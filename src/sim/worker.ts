import type { RuntimeEvent } from '../shared/events';
import { log } from '../shared/log';
import { assertNever, type MainToSim, type SimToMain } from '../shared/protocol';

import { createCombatSystem } from './CombatSystem';
import { createEntityStore } from './EntityStore';
import { createHealthDeathSystem } from './HealthDeathSystem';
import { createMovementSystem } from './MovementSystem';
import { createSessionFlowSystem } from './SessionFlowSystem';
import { createSimulationClock } from './SimulationClock';
import { createSnapshotExportSystem } from './SnapshotExportSystem';
import { createSpatialIndex } from './SpatialIndex';
import { createSpawnSystem } from './SpawnSystem';
import { createZoneSystem } from './ZoneSystem';

const entities = createEntityStore();
const exporter = createSnapshotExportSystem();
const movement = createMovementSystem();
const spawn = createSpawnSystem();
const combat = createCombatSystem();
const healthDeath = createHealthDeathSystem();
const spatialIndex = createSpatialIndex();
const zone = createZoneSystem();

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
  movement.tick(session.arena, entities, sessionFlow.inputState(), simTimeMs);
  const intents = combat.tick(
    sessionFlow.inputState(),
    entities,
    spatialIndex,
    simTimeMs,
    session.arena,
    emitEvent
  );
  healthDeath.tick(intents, entities, simTimeMs, emitEvent);
  sessionFlow.checkTransitions(simTimeMs);
  zone.onTick();
  const snapshot = exporter.onTick(simTimeMs, entities, {
    encounter: sessionFlow.activeEncounter(),
    zone: zone.zone(),
    waveProgress: spawn.waveProgress()
  });
  if (snapshot !== null) {
    postToMain({ kind: 'snapshot', snapshot });
  }
});

healthDeath.registerHook((ctx) => {
  if (ctx.entityKind === 'enemy') spawn.onEnemyDeath(ctx.entityId);
  if (ctx.entityKind === 'player') sessionFlow.onPlayerDeath();
});

const sessionFlow = createSessionFlowSystem({
  clock,
  emitEvent,
  waveProgress: () => spawn.waveProgress(),
  onSessionStart(session, rng) {
    entities.clear();
    exporter.reset();
    combat.clear();
    spawn.setRng(rng);
    const player = entities.spawnPlayer(session.player);
    if (session.loadout !== null) {
      combat.setPlayerLoadout(player.id, session.loadout, clock.simTimeMs());
    }
  },
  onSessionStop() {
    entities.clear();
    exporter.reset();
    combat.clear();
    spawn.setRng(null);
  },
  onEncounterStart(encounter) {
    const session = sessionFlow.activeSession();
    if (session === null) return;
    spawn.onEncounterStart(encounter, entities, session.arena);
    zone.onEncounterStart(encounter);
  },
  onEncounterEnd(encounter) {
    spawn.onEncounterEnd(encounter);
    zone.onEncounterEnd(encounter);
  }
});

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
