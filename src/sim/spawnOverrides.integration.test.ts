import { describe, expect, it } from 'vitest';

import { buildSessionDefinition } from '../shared/content/buildSession';
import { CAMPAIGN_PRESET } from '../shared/content/sessions';
import type { RuntimeEvent } from '../shared/events';
import type { SimulationClock } from '../shared/sim/SimulationClock';
import { SIM_STEP_MS } from '../shared/timing';

import { createCombatSystem } from './CombatSystem';
import { createDropSystem } from './DropSystem';
import { createEntityStore } from './EntityStore';
import { createHealthDeathSystem } from './HealthDeathSystem';
import { createMovementSystem } from './MovementSystem';
import { createRunSummaryTracker } from './RunSummaryTracker';
import { createSessionFlowSystem } from './SessionFlowSystem';
import { createSnapshotExportSystem } from './SnapshotExportSystem';
import { createSpatialIndex } from './SpatialIndex';
import { createSpawnSystem } from './SpawnSystem';
import { createZoneSystem } from './ZoneSystem';

type RecordedSpawnOverrideEvent =
  | Readonly<{
      kind: 'enemySpawn';
      simTime: number;
      archetypeId: string;
      x: number;
      y: number;
    }>
  | Readonly<{
      kind: 'fire';
      simTime: number;
      ownerKind: 'player' | 'companion' | 'enemy' | 'boss';
      weaponArchetypeId: string;
      x: number;
      y: number;
      dirX: number;
      dirY: number;
    }>
  | Readonly<{
      kind: 'hit';
      simTime: number;
      targetKind: 'enemy' | 'player' | 'companion' | 'boss';
      targetArchetypeId: string | null;
      weaponArchetypeId: string;
      damage: number;
      x: number;
      y: number;
    }>
  | Readonly<{
      kind: 'explosion';
      simTime: number;
      ownerKind: 'player' | 'companion' | 'enemy' | 'boss';
      weaponArchetypeId: string;
      damage: number;
      radius: number;
      x: number;
      y: number;
    }>
  | Readonly<{
      kind: 'death';
      simTime: number;
      entityKind: 'enemy' | 'player' | 'boss';
      archetypeId: string | null;
      x: number;
      y: number;
    }>
  | Readonly<{
      kind: 'dropSpawn' | 'dropPickup' | 'dropExpire';
      simTime: number;
      archetypeId: string;
      x: number;
      y: number;
    }>;

function fakeClock(): SimulationClock & {
  state: { running: boolean; paused: boolean; simTime: number };
} {
  const state = { running: false, paused: false, simTime: 0 };
  return {
    state,
    pump: () => {},
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

function setupCampaignRegressionWorld() {
  const entities = createEntityStore();
  const exporter = createSnapshotExportSystem();
  const movement = createMovementSystem();
  const combat = createCombatSystem();
  const spawn = createSpawnSystem({
    onEnemySpawned(enemyId, loadout, simTimeMs) {
      combat.setEnemyLoadout(enemyId, loadout, simTimeMs);
    }
  });
  const healthDeath = createHealthDeathSystem();
  const spatialIndex = createSpatialIndex();
  const zone = createZoneSystem();
  const runSummary = createRunSummaryTracker();
  const drops = createDropSystem(undefined, undefined, null, (fact) =>
    runSummary.onDropPickup(fact)
  );
  const clock = fakeClock();
  const seenEnemyIds = new Set<number>();
  const recorded: RecordedSpawnOverrideEvent[] = [];

  const emitEvent = (event: RuntimeEvent): void => {
    const normalized = normalizeRuntimeEvent(event);
    if (normalized !== null) recorded.push(normalized);
  };

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
      drops.setRng(rng);
      seenEnemyIds.clear();
      combat.setDamageRules(session.rules.damage);
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
      drops.setRng(null);
    },
    onEncounterStart(encounter) {
      const session = sessionFlow.activeSession();
      if (session === null) return;
      spawn.onEncounterStart(encounter, entities, session.arena, clock.simTimeMs());
      zone.onEncounterStart(encounter);
      recordNewEnemySpawns(clock.simTimeMs());
    },
    onEncounterEnd(encounter) {
      spawn.onEncounterEnd(encounter);
      zone.onEncounterEnd(encounter);
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

  function tick(): void {
    if (!clock.isRunning() || clock.isPaused()) return;
    clock.state.simTime += SIM_STEP_MS;
    const simTimeMs = clock.simTimeMs();
    const session = sessionFlow.activeSession();
    if (session === null) return;
    spawn.onTick(simTimeMs, entities);
    recordNewEnemySpawns(simTimeMs);
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
    drops.tick(simTimeMs, entities, emitEvent);
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

  function killAllEnemiesAndBosses(simTimeMs: number): void {
    const enemyIntents = [...entities.enemies()].map((enemy) => ({
      targetId: enemy.id,
      amount: enemy.hp + 999,
      source: { kind: 'environment' as const, tag: 'spawn-overrides-regression' },
      hitPosition: enemy.position
    }));
    const bossIntents = [...entities.bosses()].map((boss) => ({
      targetId: boss.id,
      amount: boss.hp + 999,
      source: { kind: 'environment' as const, tag: 'spawn-overrides-regression' },
      hitPosition: boss.position
    }));
    if (enemyIntents.length === 0 && bossIntents.length === 0) return;
    healthDeath.tick([...enemyIntents, ...bossIntents], entities, simTimeMs, emitEvent);
  }

  function movePlayerToFirstDrop(): void {
    const player = entities.player();
    const drop = [...entities.drops()][0];
    if (player === null || drop === undefined) return;
    player.position.x = drop.position.x;
    player.position.y = drop.position.y;
  }

  function recordNewEnemySpawns(simTimeMs: number): void {
    for (const enemy of entities.enemies()) {
      if (seenEnemyIds.has(enemy.id)) continue;
      seenEnemyIds.add(enemy.id);
      recorded.push({
        kind: 'enemySpawn',
        simTime: roundNumber(simTimeMs),
        archetypeId: enemy.archetypeId,
        x: roundNumber(enemy.position.x),
        y: roundNumber(enemy.position.y)
      });
    }
  }

  return {
    clock,
    recorded,
    sessionFlow,
    tick,
    killAllEnemiesAndBosses,
    movePlayerToFirstDrop
  };
}

function runCampaignRegression(seed: number): ReadonlyArray<RecordedSpawnOverrideEvent> {
  const session = buildSessionDefinition(CAMPAIGN_PRESET, { seed });
  const world = setupCampaignRegressionWorld();
  world.sessionFlow.start(session);

  let safety = 0;
  while (world.clock.isRunning() && safety < 20_000) {
    safety += 1;
    world.tick();
    world.killAllEnemiesAndBosses(world.clock.simTimeMs());
    world.movePlayerToFirstDrop();
  }

  expect(world.clock.isRunning()).toBe(false);
  return world.recorded;
}

function normalizeRuntimeEvent(event: RuntimeEvent): RecordedSpawnOverrideEvent | null {
  switch (event.kind) {
    case 'fire':
      return {
        kind: 'fire',
        simTime: roundNumber(event.simTime),
        ownerKind: event.ownerKind,
        weaponArchetypeId: event.weaponArchetypeId,
        x: roundNumber(event.originX),
        y: roundNumber(event.originY),
        dirX: roundNumber(event.dirX),
        dirY: roundNumber(event.dirY)
      };
    case 'hit':
      return {
        kind: 'hit',
        simTime: roundNumber(event.simTime),
        targetKind: event.targetKind,
        targetArchetypeId: event.targetArchetypeId,
        weaponArchetypeId: event.weaponArchetypeId,
        damage: roundNumber(event.damage),
        x: roundNumber(event.x),
        y: roundNumber(event.y)
      };
    case 'explosion':
      return {
        kind: 'explosion',
        simTime: roundNumber(event.simTime),
        ownerKind: event.ownerKind,
        weaponArchetypeId: event.weaponArchetypeId,
        damage: roundNumber(event.damage),
        radius: roundNumber(event.radius),
        x: roundNumber(event.x),
        y: roundNumber(event.y)
      };
    case 'death':
      return {
        kind: 'death',
        simTime: roundNumber(event.simTime),
        entityKind: event.entityKind,
        archetypeId: event.archetypeId,
        x: roundNumber(event.x),
        y: roundNumber(event.y)
      };
    case 'dropSpawn':
    case 'dropPickup':
    case 'dropExpire':
      return {
        kind: event.kind,
        simTime: roundNumber(event.simTime),
        archetypeId: event.archetypeId,
        x: roundNumber(event.x),
        y: roundNumber(event.y)
      };
    default:
      return null;
  }
}

function roundNumber(value: number): number {
  return Number(value.toFixed(4));
}

const REMOVED_FORK_ARCHETYPE_IDS = new Set([
  'campaign-set-1-carrier-slime',
  'campaign-set-2-carrier-slime',
  'campaign-set-3-carrier-slime',
  'campaign-set-4-carrier-slime',
  'campaign-set-5-carrier-slime',
  'demo-carrier-slime',
  'demo-retaliator-slime'
]);

describe('spawn override campaign-normal regression', () => {
  it('matches the post-migration campaign-normal event baseline for a fixed seed', () => {
    const events = runCampaignRegression(0x019);

    expect(events).toMatchSnapshot();
    expect(events.length).toBeGreaterThan(0);
    expect(
      events.some((event) => event.kind === 'dropSpawn' && event.archetypeId === 'size-up')
    ).toBe(true);
    expect(
      events.some((event) => event.kind === 'dropSpawn' && event.archetypeId === 'overdrive')
    ).toBe(true);
    expect(
      events.every(
        (event) =>
          !('archetypeId' in event) ||
          event.archetypeId === null ||
          !REMOVED_FORK_ARCHETYPE_IDS.has(event.archetypeId)
      )
    ).toBe(true);
  });
});
