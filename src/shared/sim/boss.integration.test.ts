import { describe, expect, it } from 'vitest';

import { SANDBOX_ARENA } from '../content/arenas';
import { BOSS_SCRAP_KING } from '../content/bosses';
import { TRAINING_PLAYER } from '../content/players';
import { PISTOL } from '../content/weapons';
import type { RuntimeEvent } from '../events';
import type { EncounterDefinition, SessionDefinition } from '../session';
import { type SimulationClock } from './SimulationClock';
import { SIM_STEP_MS } from '../timing';

import { createBossPhaseSystem } from './BossPhaseSystem';
import { createCombatSystem } from './CombatSystem';
import { createEntityStore } from './EntityStore';
import { createHealthDeathSystem } from './HealthDeathSystem';
import { createMovementSystem } from './MovementSystem';
import { createRunSummaryTracker } from './RunSummaryTracker';
import { createSessionFlowSystem } from './SessionFlowSystem';
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

const BOSS_TOP_Y = SANDBOX_ARENA.height / 2 - 0.5 - BOSS_SCRAP_KING.radius;

const BOSS_ENCOUNTER: EncounterDefinition = {
  id: 'test-boss',
  type: 'boss',
  backgroundId: null,
  introDurationMs: 0,
  name: null,
  text: null,
  spawnPlan: {
    kind: 'boss',
    bossArchetypeId: BOSS_SCRAP_KING.id,
    position: { x: 0, y: BOSS_TOP_Y }
  },
  zoneBehavior: { kind: 'disabled' },
  objectives: [],
  rewardRules: null,
  transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
  tuning: null
};

function bossOnlySession(seed: number): SessionDefinition {
  return {
    id: 'boss-session',
    seed,
    arena: SANDBOX_ARENA,
    dynamicRoster: false,
    players: [{ id: 'hero-training', ...TRAINING_PLAYER, loadout: { weapons: [PISTOL.id], selectedIndex: 0 } }],
    companion: null,
    backgrounds: [],
    musicSampleId: null,
    modifiers: [],
    rules: {
      damage: { slimeFriendlyFire: false },
      aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 }
    },
    encounters: [BOSS_ENCOUNTER],
    winCondition: { kind: 'bossDefeated' },
    lossCondition: { kind: 'playerDeath' },
    uiMeta: null
  };
}

function setupBossWorld() {
  const entities = createEntityStore();
  const exporter = createSnapshotExportSystem();
  const movement = createMovementSystem();
  const spawn = createSpawnSystem();
  const bossPhase = createBossPhaseSystem();
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
      const player = entities.spawnPlayer(session.players[0]);
      if (session.players[0].loadout !== null) {
        combat.setPlayerLoadout(player.id, session.players[0].loadout, clock.simTimeMs());
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
    if (ctx.entityKind === 'player') sessionFlow.onPlayerDeath(ctx.entityId);
  });

  function tick(): void {
    if (!clock.isRunning() || clock.isPaused()) return;
    clock.state.simTime += SIM_STEP_MS;
    const simTimeMs = clock.simTimeMs();
    const session = sessionFlow.activeSession();
    if (session === null) return;
    spawn.onTick(simTimeMs, entities);
    bossPhase.tick(entities, session.arena, simTimeMs, emitEvent);
    const inputState = sessionFlow.inputState();
    movement.tick(session.arena, entities, inputState, simTimeMs);
    const intents = combat.tick(
      inputState,
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
      weaponHudFor: () => null
    });
  }

  function killBoss(simTimeMs: number): void {
    const bosses = [...entities.bosses()];
    if (bosses.length === 0) return;
    const target = bosses[0]!;
    healthDeath.tick(
      [
        {
          targetId: target.id,
          amount: target.hp + 99,
          source: { kind: 'environment', tag: 'test-kill-boss' },
          hitPosition: target.position
        }
      ],
      entities,
      simTimeMs,
      emitEvent
    );
  }

  function killPlayerByBoss(simTimeMs: number): void {
    const player = entities.player();
    const boss = [...entities.bosses()][0];
    if (player === null || boss === undefined) return;
    healthDeath.tick(
      [
        {
          targetId: player.id,
          amount: player.hp + 99,
          source: { kind: 'boss', bossId: boss.id, attackId: 'slam' },
          hitPosition: player.position
        }
      ],
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
    killBoss,
    killPlayerByBoss
  };
}

describe('boss encounter integration', () => {
  it('keeps zone disabled during boss encounter', () => {
    const world = setupBossWorld();
    world.sessionFlow.start(bossOnlySession(7));
    expect(world.zone.zone()).toEqual({ mode: 'disabled', margin: 0 });
  });

  it('emits a single win after boss death when winCondition is bossDefeated', () => {
    const world = setupBossWorld();
    world.sessionFlow.start(bossOnlySession(11));

    expect(world.entities.bossCount()).toBe(1);

    world.killBoss(world.clock.simTimeMs());
    world.tick();

    expect(world.clock.isRunning()).toBe(false);
    const wins = world.events.filter((e) => e.kind === 'win');
    expect(wins).toHaveLength(1);
    expect(world.events.filter((e) => e.kind === 'loss')).toHaveLength(0);
    const win = terminalEvent(world.events, 'win');
    expect(win.summary.progress.percent).toBe(100);
    expect(win.summary.kills.byArchetype).toContainEqual({
      entityKind: 'boss',
      archetypeId: BOSS_SCRAP_KING.id,
      count: 1
    });
    expect(win.summary.boss?.defeated).toBe(true);
  });

  it('reports boss hp and boss defeat cause when the player dies during boss encounter', () => {
    const world = setupBossWorld();
    world.sessionFlow.start(bossOnlySession(12));
    const boss = [...world.entities.bosses()][0];
    if (boss === undefined) throw new Error('expected boss');
    boss.hp = Math.round(boss.maxHp * 0.28);

    world.killPlayerByBoss(world.clock.simTimeMs());

    const loss = terminalEvent(world.events, 'loss');
    const expectedBossHpPercent = Math.round((boss.hp / boss.maxHp) * 100);
    expect(loss.summary.progress.percent).toBe(Math.round((1 - boss.hp / boss.maxHp) * 100));
    expect(loss.summary.boss).toEqual({
      archetypeId: BOSS_SCRAP_KING.id,
      encountered: true,
      defeated: false,
      hp: boss.hp,
      maxHp: boss.maxHp,
      hpPercent: expectedBossHpPercent
    });
    expect(loss.summary.defeat).toEqual({
      cause: {
        kind: 'boss',
        bossId: boss.id,
        bossArchetypeId: BOSS_SCRAP_KING.id,
        attackId: 'slam'
      }
    });
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
