import { describe, expect, it } from 'vitest';

import { buildSessionDefinition } from '../shared/content/buildSession';
import { HEAL_ORB } from '../shared/content/drops';
import { TRAINING_PRESET } from '../shared/content/sessions';
import type { RuntimeEvent } from '../shared/events';
import { SIM_STEP_MS } from '../shared/timing';

import { createCombatSystem } from './CombatSystem';
import { createDropSystem } from './DropSystem';
import { createEntityStore } from './EntityStore';
import { createHealthDeathSystem } from './HealthDeathSystem';
import { createMovementSystem } from './MovementSystem';
import { createSessionFlowSystem } from './SessionFlowSystem';
import type { SimulationClock } from './SimulationClock';
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
  const drops = createDropSystem();
  const clock = fakeClock();
  const events: RuntimeEvent[] = [];
  const emitEvent = (event: RuntimeEvent): void => {
    events.push(event);
  };

  const sessionFlow = createSessionFlowSystem({
    clock,
    emitEvent,
    waveProgress: () => spawn.waveProgress(),
    onSessionStart(session, rng) {
      entities.clear();
      exporter.reset();
      combat.clear();
      zone.reset();
      spawn.setRng(rng);
      drops.setRng(rng);
      const player = entities.spawnPlayer(session.player);
      if (session.loadout !== null) {
        combat.setPlayerLoadout(player.id, session.loadout, clock.simTimeMs());
      }
    },
    onSessionStop() {
      entities.clear();
      exporter.reset();
      combat.clear();
      zone.reset();
      spawn.setRng(null);
      drops.setRng(null);
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
    zone.onTick();
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
        source: { kind: 'enemyContact' as const, enemyId: id },
        hitPosition: { x: 0, y: 0 }
      })),
      entities,
      simTimeMs,
      emitEvent
    );
  }

  return { entities, sessionFlow, clock, events, tick, killAllEnemies };
}

describe('drops integration (training preset)', () => {
  it('produces an identical drop event sequence for the same seed', () => {
    function dropEventsForSeed(seed: number): Array<Pick<RuntimeEvent, 'kind'> & {
      archetypeId: string;
      x: number;
      y: number;
    }> {
      const session = buildSessionDefinition(TRAINING_PRESET, { seed });
      const world = setupWorld();
      world.sessionFlow.start(session);

      let safety = 0;
      while (world.clock.isRunning() && safety < 5_000) {
        safety += 1;
        world.tick();
        world.killAllEnemies(world.clock.simTimeMs());
      }

      return world.events
        .filter(
          (
            e
          ): e is Extract<
            RuntimeEvent,
            { kind: 'dropSpawn' | 'dropPickup' | 'dropExpire' }
          > => e.kind === 'dropSpawn' || e.kind === 'dropPickup' || e.kind === 'dropExpire'
        )
        .map((e) => ({ kind: e.kind, archetypeId: e.archetypeId, x: e.x, y: e.y }));
    }

    const a = dropEventsForSeed(0xc0ffee);
    const b = dropEventsForSeed(0xc0ffee);
    expect(b).toEqual(a);
  });

  it('clamps cumulative heal at player.maxHp and never exceeds it', () => {
    const world = setupWorld();
    const session = buildSessionDefinition(TRAINING_PRESET, { seed: 12345 });
    world.sessionFlow.start(session);

    const player = world.entities.player();
    if (player === null) throw new Error('expected spawned player');
    const maxHp = player.maxHp;

    // Drain hp to 1 so picked-up heals make a difference but still cap at maxHp.
    player.hp = 1;

    let safety = 0;
    while (world.clock.isRunning() && safety < 5_000) {
      safety += 1;
      world.tick();
      // Teleport the player onto the first live drop so pickup fires. This
      // does not invoke any system besides the next DropSystem.tick, which
      // uses the current player position as design/drops.md prescribes.
      const firstDrop = [...world.entities.drops()][0];
      if (firstDrop !== undefined) {
        player.position.x = firstDrop.position.x;
        player.position.y = firstDrop.position.y;
      }
      world.killAllEnemies(world.clock.simTimeMs());
      // hp must always stay within [0, maxHp] regardless of how many drops
      // are picked up across ticks.
      expect(player.hp).toBeGreaterThanOrEqual(0);
      expect(player.hp).toBeLessThanOrEqual(maxHp);
    }

    expect(world.clock.isRunning()).toBe(false);
    // We should have observed at least one heal pickup over a full training run.
    const pickups = world.events.filter((e) => e.kind === 'dropPickup');
    expect(pickups.length).toBeGreaterThan(0);
    for (const event of pickups) {
      if (event.kind !== 'dropPickup') continue;
      expect(event.archetypeId).toBe(HEAL_ORB.id);
    }
  });

  it('drops never leak after the session ends (win or stop)', () => {
    const world = setupWorld();
    const session = buildSessionDefinition(TRAINING_PRESET, { seed: 7 });
    world.sessionFlow.start(session);

    let safety = 0;
    while (world.clock.isRunning() && safety < 5_000) {
      safety += 1;
      world.tick();
      world.killAllEnemies(world.clock.simTimeMs());
      expect(world.entities.dropCount()).toBeGreaterThanOrEqual(0);
    }

    expect(world.clock.isRunning()).toBe(false);
    expect(world.entities.dropCount()).toBe(0);
  });

  it('an explicit stopSession also clears live drops', () => {
    const world = setupWorld();
    const session = buildSessionDefinition(TRAINING_PRESET, { seed: 11 });
    world.sessionFlow.start(session);

    // Run a few ticks and force enough enemy deaths to give RNG a chance
    // to spawn at least one drop.
    for (let i = 0; i < 50; i += 1) {
      world.tick();
      world.killAllEnemies(world.clock.simTimeMs());
    }

    world.sessionFlow.stop();
    expect(world.entities.dropCount()).toBe(0);
    expect(world.clock.isRunning()).toBe(false);
  });
});
