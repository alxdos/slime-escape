import { describe, expect, it } from 'vitest';

import { buildSessionDefinition } from '../shared/content/buildSession';
import { TRAINING_PRESET } from '../shared/content/sessions';
import type { RuntimeEvent } from '../shared/events';
import { SIM_STEP_MS } from '../shared/timing';

import { createCombatSystem } from './CombatSystem';
import { createEntityStore } from './EntityStore';
import { createHealthDeathSystem } from './HealthDeathSystem';
import { createMovementSystem } from './MovementSystem';
import { createRunSummaryTracker } from './RunSummaryTracker';
import { createSessionFlowSystem } from './SessionFlowSystem';
import { createSimulationClock, type SimulationClock } from './SimulationClock';
import { createSnapshotExportSystem } from './SnapshotExportSystem';
import { createSpatialIndex } from './SpatialIndex';
import { createSpawnSystem } from './SpawnSystem';
import { createZoneSystem } from './ZoneSystem';

function fakeClock(): SimulationClock & {
  state: { running: boolean; paused: boolean; simTime: number };
} {
  const state = { running: false, paused: false, simTime: 0 };
  return {
    state,
    start: () => {},
    stop: () => {},
    pause: () => {
      state.paused = true;
    },
    resume: () => {
      state.paused = false;
    },
    toRunning: () => {
      state.running = true;
      state.paused = false;
      state.simTime = 0;
    },
    toIdle: () => {
      state.running = false;
      state.paused = false;
      state.simTime = 0;
    },
    isPaused: () => state.paused,
    isRunning: () => state.running,
    simTimeMs: () => state.simTime
  };
}

function setupWorld() {
  const entities = createEntityStore();
  const exporter = createSnapshotExportSystem();
  const movement = createMovementSystem();
  const spawn = createSpawnSystem();
  const combat = createCombatSystem();
  const healthDeath = createHealthDeathSystem();
  const spatialIndex = createSpatialIndex();
  const zone = createZoneSystem();
  const runSummary = createRunSummaryTracker();
  const clock = fakeClock();
  const events: RuntimeEvent[] = [];
  const emitEvent = (event: RuntimeEvent) => events.push(event);

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
      runSummary.reset();
      zone.reset();
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
      runSummary.reset();
      zone.reset();
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
    runSummary.onDeath(ctx, entities);
    if (ctx.entityKind === 'enemy') spawn.onEnemyDeath(ctx.entityId);
    if (ctx.entityKind === 'boss') spawn.onBossDeath(ctx.entityId);
    if (ctx.entityKind === 'boss') sessionFlow.onBossDeath(ctx.entityId);
    if (ctx.entityKind === 'player') sessionFlow.onPlayerDeath();
  });

  function tick(): void {
    if (!clock.isRunning() || clock.isPaused()) return;
    clock.state.simTime += SIM_STEP_MS;
    const simTimeMs = clock.simTimeMs();
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
    const zoneEncCtx = sessionFlow.activeEncounter();
    zone.onTick(zoneEncCtx === null ? undefined : simTimeMs - zoneEncCtx.startSimMs);
    const encCtx = sessionFlow.activeEncounter();
    exporter.onTick(simTimeMs, entities, {
      encounter: encCtx,
      zone: zone.zone(),
      waveProgress:
        encCtx !== null && encCtx.encounter.spawnPlan.kind === 'wave'
          ? spawn.waveProgress()
          : null,
      weaponHud: null
    });
  }

  function killAllEnemies(simTimeMs: number): void {
    const ids = [...entities.enemies()].map((e) => e.id);
    if (ids.length === 0) return;
    healthDeath.tick(
      ids.map((id) => ({
        targetId: id,
        amount: 9999,
        source: { kind: 'enemyContact', enemyId: id },
        hitPosition: { x: 0, y: 0 }
      })),
      entities,
      simTimeMs,
      emitEvent
    );
  }

  return {
    entities,
    spawn,
    zone,
    sessionFlow,
    clock,
    events,
    healthDeath,
    tick,
    killAllEnemies
  };
}

describe('training run integration', () => {
  it('emits sessionStart, all lesson encounter cycles and a single win on full clear', () => {
    const session = buildSessionDefinition(TRAINING_PRESET, { seed: 42 });
    const world = setupWorld();
    world.sessionFlow.start(session);

    let safety = 0;
    while (world.clock.isRunning() && safety < 12_000) {
      safety += 1;
      world.tick();
      world.killAllEnemies(world.clock.simTimeMs());
    }

    expect(world.clock.isRunning()).toBe(false);
    const kinds = world.events.map((e) => e.kind);
    expect(kinds.filter((k) => k === 'win')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'loss')).toHaveLength(0);
    expect(kinds.filter((k) => k === 'encounterStart')).toHaveLength(session.encounters.length);
    expect(kinds.filter((k) => k === 'encounterEnd')).toHaveLength(session.encounters.length);
    const win = terminalEvent(world.events, 'win');
    expect(win.summary.progress.percent).toBe(100);
    expect(win.summary.progress.completedWaves).toBe(5);
    expect(win.summary.progress.totalWaves).toBe(5);
    expect(win.summary.kills.total).toBeGreaterThan(0);
  });

  it('publishes a single loss when player dies mid-run and stops further ticks', () => {
    const session = buildSessionDefinition(TRAINING_PRESET, { seed: 42 });
    const world = setupWorld();
    world.sessionFlow.start(session);
    world.tick();

    const player = world.entities.player();
    if (player === null) throw new Error('expected player');
    world.healthDeath.tick(
      [
        {
          targetId: player.id,
          amount: 999,
          source: { kind: 'enemyContact', enemyId: player.id },
          hitPosition: { x: 0, y: 0 }
        }
      ],
      world.entities,
      world.clock.simTimeMs(),
      (e) => world.events.push(e)
    );

    const losses = world.events.filter((e) => e.kind === 'loss');
    expect(losses).toHaveLength(1);
    const loss = terminalEvent(world.events, 'loss');
    expect(loss.summary.outcome).toBe('loss');
    expect(loss.summary.durationMs).toBeGreaterThan(0);
    expect(loss.summary.progress.percent).not.toBe(100);
    expect(loss.summary.defeat?.cause.kind).toBe('enemyContact');
    expect(world.clock.isRunning()).toBe(false);
    expect(world.entities.player()).toBeNull();

    world.tick();
    expect(world.events.filter((e) => e.kind === 'loss')).toHaveLength(1);
  });

  it('two runs with the same seed produce identical (archetypeId, position) spawn lists', () => {
    function spawnsForSeed(seed: number): Array<{ id: string; x: number; y: number }> {
      const session = buildSessionDefinition(TRAINING_PRESET, { seed });
      const world = setupWorld();
      world.sessionFlow.start(session);
      const collected: Array<{ id: string; x: number; y: number }> = [];
      const seen = new Set<number>();
      let safety = 0;
      while (world.clock.isRunning() && safety < 5_000) {
        safety += 1;
        world.tick();
        for (const enemy of world.entities.enemies()) {
          if (seen.has(enemy.id)) continue;
          seen.add(enemy.id);
          collected.push({ id: enemy.archetypeId, x: enemy.position.x, y: enemy.position.y });
        }
        world.killAllEnemies(world.clock.simTimeMs());
      }
      return collected;
    }

    const a = spawnsForSeed(98765);
    const b = spawnsForSeed(98765);
    expect(b).toEqual(a);
    expect(a.length).toBeGreaterThan(0);
  });
});

function terminalEvent<TKind extends 'win' | 'loss'>(
  events: ReadonlyArray<RuntimeEvent>,
  kind: TKind
): Extract<RuntimeEvent, { kind: TKind }> {
  const event = events.find((candidate): candidate is Extract<RuntimeEvent, { kind: TKind }> => {
    return candidate.kind === kind;
  });
  if (event === undefined) {
    throw new Error(`missing terminal event: ${kind}`);
  }
  return event;
}
