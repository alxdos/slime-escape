import { describe, expect, it } from 'vitest';

import { SANDBOX_ARENA } from '../shared/content/arenas';
import { SLIME_KING } from '../shared/content/bosses';
import { TRAINING_PLAYER } from '../shared/content/players';
import { PISTOL } from '../shared/content/weapons';
import type { RuntimeEvent } from '../shared/events';
import type { EncounterDefinition, SessionDefinition } from '../shared/session';
import { SIM_STEP_MS } from '../shared/timing';

import { createBossPhaseSystem } from './BossPhaseSystem';
import { createCombatSystem } from './CombatSystem';
import { createEntityStore } from './EntityStore';
import { createHealthDeathSystem } from './HealthDeathSystem';
import { createMovementSystem } from './MovementSystem';
import { createSessionFlowSystem } from './SessionFlowSystem';
import { type SimulationClock } from './SimulationClock';
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

const BOSS_TOP_Y = SANDBOX_ARENA.height / 2 - 0.5 - SLIME_KING.radius;

const BOSS_ENCOUNTER: EncounterDefinition = {
  id: 'test-boss',
  type: 'boss',
  spawnPlan: {
    kind: 'boss',
    bossArchetypeId: SLIME_KING.id,
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
    player: TRAINING_PLAYER,
    loadout: { primaryWeaponArchetypeId: PISTOL.id },
    modifiers: [],
    rules: null,
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
  const clock = fakeClock();
  const events: RuntimeEvent[] = [];
  const emitEvent = (event: RuntimeEvent) => events.push(event);

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

  healthDeath.registerHook((ctx) => {
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
    bossPhase.tick(entities, session.arena, simTimeMs, emitEvent);
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
    const encCtx = sessionFlow.activeEncounter();
    exporter.onTick(simTimeMs, entities, {
      encounter: encCtx,
      zone: zone.zone(),
      waveProgress:
        encCtx !== null && encCtx.encounter.spawnPlan.kind === 'wave'
          ? spawn.waveProgress()
          : null
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

  return {
    entities,
    spawn,
    zone,
    sessionFlow,
    clock,
    events,
    tick,
    killBoss
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
    expect(world.events.filter((e) => e.kind === 'win')).toHaveLength(1);
    expect(world.events.filter((e) => e.kind === 'loss')).toHaveLength(0);
  });
});
