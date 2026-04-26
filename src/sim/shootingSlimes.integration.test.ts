import { describe, expect, it } from 'vitest';

import { buildSessionDefinition } from '../shared/content/buildSession';
import { HEAL_ORB } from '../shared/content/drops';
import {
  SLIME_DOOR,
  SLIME_FORTRESS,
  SLIME_KINGLING,
  SLIME_SHELL
} from '../shared/content/enemies';
import { resolveModePreset } from '../shared/content/sessions';
import { ROCK_THROWER } from '../shared/content/weapons';
import type { RuntimeEvent } from '../shared/events';
import type { SessionDefinition } from '../shared/session';
import type { ProjectileSnapshot } from '../shared/snapshot';
import { SIM_STEP_MS } from '../shared/timing';

import { createCombatSystem, type DamageIntent, type DamageSource } from './CombatSystem';
import { createDropSystem } from './DropSystem';
import { createEntityStore, type EntityId, type Projectile } from './EntityStore';
import { createHealthDeathSystem } from './HealthDeathSystem';
import { createMovementSystem } from './MovementSystem';
import { createSessionFlowSystem } from './SessionFlowSystem';
import type { SimulationClock } from './SimulationClock';
import { createSnapshotExportSystem } from './SnapshotExportSystem';
import { createSpatialIndex } from './SpatialIndex';
import { createSpawnSystem } from './SpawnSystem';
import { createZoneSystem } from './ZoneSystem';

const HARD_HEAL_CARRIER_IDS = new Set([
  SLIME_FORTRESS.id,
  SLIME_DOOR.id,
  SLIME_KINGLING.id,
  SLIME_SHELL.id
]);

type DropDeathSource = Readonly<{
  archetypeId: string;
}>;

describe('shooting slime difficulty acceptance', () => {
  it('campaign-easy produces no player projectile hits during the first 30 seconds', () => {
    const world = setupSimWorld(
      buildSessionDefinition(resolveModePreset('campaign-easy'), { seed: 0x020 })
    );

    world.start();
    world.runFor(30_000);

    expect(
      world.events.filter((event) => event.kind === 'hit' && event.targetKind === 'player')
    ).toHaveLength(0);
  });

  it('campaign-hard kills a stationary player from enemy projectiles before contact damage', () => {
    const world = setupSimWorld(
      buildSessionDefinition(resolveModePreset('campaign-hard'), { seed: 0x020 })
    );

    world.start();
    world.runFor(30_000);

    expect(world.playerDeathCause).not.toBeNull();
    if (world.playerDeathCause === null) throw new Error('expected player death cause');
    expect(world.playerDeathCause.kind).toBe('projectile');
    if (world.playerDeathCause.kind !== 'projectile') {
      throw new Error('expected projectile death cause');
    }
    expect(world.playerDeathCause.ownerKind).toBe('enemy');
    expect(world.playerDamageSources.some((source) => source.kind === 'enemyContact')).toBe(false);
  });

  it('campaign-easy spawns at least one heal orb for every second wave', () => {
    const session = buildSessionDefinition(resolveModePreset('campaign-easy'), { seed: 0x020 });
    const world = setupSimWorld(session);
    const waveCount = session.encounters.filter((encounter) => encounter.spawnPlan.kind === 'wave')
      .length;

    world.start();
    world.runUntilStoppedWithAutokill();

    expect(
      world.events.filter(
        (event) => event.kind === 'dropSpawn' && event.archetypeId === HEAL_ORB.id
      ).length
    ).toBeGreaterThanOrEqual(Math.floor(waveCount / 2));
  });

  it('campaign-hard emits no heal drops from ordinary spawns', () => {
    const session = buildSessionDefinition(resolveModePreset('campaign-hard'), { seed: 0x020 });
    const world = setupSimWorld(session);

    world.start();
    world.runUntilStoppedWithAutokill();

    expect(world.ordinaryHealDropSpawns).toHaveLength(0);
  });
});

describe('shooting slime landing telegraph snapshots', () => {
  it('keeps enemy arcEnd in flying snapshots and clears it after grounding', () => {
    const world = setupSimWorld(
      buildSessionDefinition(resolveModePreset('campaign-hard'), { seed: 0x020 })
    );

    world.start();

    const projectile = world.spawnEnemyArcProjectile();
    expect(projectile.arcEnd).not.toBeNull();
    const flying = world.snapshotProjectile(projectile.id, ROCK_THROWER.cooldownMs);
    expect(flying?.state).toBe('flying');
    expect(flying?.arcEnd).toEqual(projectile.arcEnd);

    world.tickAt(projectile.arcEndSimMs ?? ROCK_THROWER.cooldownMs + 1);

    const grounded = world.snapshotProjectile(projectile.id, projectile.arcEndSimMs ?? 0);
    expect(grounded?.state).toBe('grounded');
    expect(grounded?.arcEnd).toBeNull();
  });
});

function setupSimWorld(session: SessionDefinition) {
  const clock = fakeClock();
  const entities = createEntityStore();
  const movement = createMovementSystem();
  const combat = createCombatSystem();
  const spawn = createSpawnSystem({
    onEnemySpawned(enemyId, loadout, simTimeMs) {
      combat.setEnemyLoadout(enemyId, loadout, simTimeMs);
    }
  });
  const drops = createDropSystem();
  const healthDeath = createHealthDeathSystem();
  const spatialIndex = createSpatialIndex();
  const zone = createZoneSystem();
  const exporter = createSnapshotExportSystem();
  const events: RuntimeEvent[] = [];
  const playerDamageSources: DamageSource[] = [];
  const ordinaryHealDropSpawns: RuntimeEvent[] = [];
  let currentDropDeathSource: DropDeathSource | null = null;
  let playerDeathCause: DamageSource | null = null;

  const emitEvent = (event: RuntimeEvent): void => {
    if (
      event.kind === 'dropSpawn' &&
      event.archetypeId === HEAL_ORB.id &&
      currentDropDeathSource !== null &&
      !HARD_HEAL_CARRIER_IDS.has(currentDropDeathSource.archetypeId)
    ) {
      ordinaryHealDropSpawns.push(event);
    }
    events.push(event);
  };

  const sessionFlow = createSessionFlowSystem({
    clock,
    emitEvent,
    waveProgress: () => spawn.waveProgress(),
    onSessionStart(startedSession, rng) {
      entities.clear();
      exporter.reset();
      combat.clear();
      drops.clear();
      zone.reset();
      spawn.setRng(rng);
      drops.setRng(rng);
      combat.setDamageRules(startedSession.rules.damage);
      const player = entities.spawnPlayer(startedSession.player);
      if (startedSession.loadout !== null) {
        combat.setPlayerLoadout(player.id, startedSession.loadout, clock.simTimeMs());
      }
    },
    onSessionStop() {
      entities.clear();
      exporter.reset();
      combat.clear();
      drops.clear();
      zone.reset();
      spawn.setRng(null);
      drops.setRng(null);
    },
    onEncounterStart(encounter) {
      spawn.onEncounterStart(encounter, entities, session.arena, clock.simTimeMs());
      zone.onEncounterStart(encounter);
    },
    onEncounterEnd(encounter) {
      spawn.onEncounterEnd(encounter);
      zone.onEncounterEnd(encounter);
    }
  });

  healthDeath.registerHook((ctx) => {
    if (ctx.entityKind === 'enemy') {
      const enemy = entities.enemyById(ctx.entityId);
      spawn.onEnemyDeath(ctx.entityId);
      combat.removeShooter(ctx.entityId);
      currentDropDeathSource = enemy === null ? null : { archetypeId: enemy.archetypeId };
      try {
        drops.onDeathHook(ctx, entities, emitEvent);
      } finally {
        currentDropDeathSource = null;
      }
    }
    if (ctx.entityKind === 'boss') spawn.onBossDeath(ctx.entityId);
    if (ctx.entityKind === 'boss') sessionFlow.onBossDeath(ctx.entityId);
    if (ctx.entityKind === 'player') {
      playerDeathCause = ctx.cause;
      sessionFlow.onPlayerDeath();
    }
  });

  healthDeath.registerDamageHook((ctx) => {
    if (ctx.targetKind === 'player') {
      playerDamageSources.push(ctx.source);
    }
  });

  function start(): void {
    sessionFlow.start(session);
  }

  function tickAt(simTimeMs: number): void {
    if (!clock.isRunning() || clock.isPaused()) return;
    clock.state.simTime = simTimeMs;
    tickSystems(simTimeMs, []);
  }

  function tick(): void {
    if (!clock.isRunning() || clock.isPaused()) return;
    clock.state.simTime += SIM_STEP_MS;
    tickSystems(clock.simTimeMs(), []);
  }

  function tickSystems(simTimeMs: number, extraIntents: ReadonlyArray<DamageIntent>): void {
    spawn.onTick(simTimeMs, entities);
    movement.tick(session.arena, entities, sessionFlow.inputState(), simTimeMs);
    const combatIntents = combat.tick(
      sessionFlow.inputState(),
      entities,
      spatialIndex,
      simTimeMs,
      session.arena,
      emitEvent
    );
    healthDeath.tick([...extraIntents, ...combatIntents], entities, simTimeMs, emitEvent);
    drops.tick(simTimeMs, entities, emitEvent);
    sessionFlow.checkTransitions(simTimeMs);
    zone.onTick();
  }

  function runFor(durationMs: number): void {
    const endSimMs = clock.simTimeMs() + durationMs;
    while (clock.isRunning() && clock.simTimeMs() < endSimMs) {
      tick();
    }
  }

  function runUntilStoppedWithAutokill(): void {
    let safety = 0;
    while (clock.isRunning() && safety < 30_000) {
      safety += 1;
      tick();
      killAllEnemiesAndBosses();
    }
    expect(clock.isRunning()).toBe(false);
  }

  function killAllEnemiesAndBosses(): void {
    const simTimeMs = clock.simTimeMs();
    const intents: DamageIntent[] = [];
    for (const enemy of entities.enemies()) {
      intents.push(environmentKillIntent(enemy.id, enemy.hp, enemy.position));
    }
    for (const boss of entities.bosses()) {
      intents.push(environmentKillIntent(boss.id, boss.hp, boss.position));
    }
    if (intents.length === 0) return;
    healthDeath.tick(intents, entities, simTimeMs, emitEvent);
  }

  function spawnEnemyArcProjectile(): Projectile {
    const enemy = entities.spawnEnemy({
      archetypeId: 'test-arc-shooter',
      position: { x: -4, y: 0 },
      radius: 0.6,
      contactBox: { width: 1.2, height: 1.2 },
      behavior: 'stationary',
      guaranteedDrops: [],
      dropTable: [],
      retaliation: { enabled: false, durationMs: 0 },
      maxHp: 3,
      maxSpeed: 0,
      contactDamage: 0,
      contactCooldownMs: 1,
      knockbackBaseImpulse: 0,
      knockbackVelocityScale: 0,
      knockbackDurationMs: 1,
      color: 0xff7766
    });
    combat.setEnemyLoadout(enemy.id, { weapons: [ROCK_THROWER.id], selectedIndex: 0 }, 0);
    tickAt(ROCK_THROWER.cooldownMs);
    const projectile = [...entities.projectiles()].find(
      (candidate) =>
        candidate.ownerId === enemy.id && candidate.weaponArchetypeId === ROCK_THROWER.id
    );
    if (projectile === undefined) throw new Error('expected enemy arc projectile');
    return projectile;
  }

  function snapshotProjectile(
    projectileId: EntityId,
    simTimeMs: number
  ): ProjectileSnapshot | undefined {
    exporter.reset();
    const snapshot = exporter.onTick(simTimeMs, entities, {
      encounter: sessionFlow.activeEncounter(),
      zone: zone.zone(),
      waveProgress: spawn.waveProgress(),
      weaponHud: null
    });
    return snapshot?.entities.find(
      (entity): entity is ProjectileSnapshot =>
        entity.kind === 'projectile' && entity.id === projectileId
    );
  }

  return {
    clock,
    events,
    playerDamageSources,
    ordinaryHealDropSpawns,
    get playerDeathCause() {
      return playerDeathCause;
    },
    start,
    tickAt,
    runFor,
    runUntilStoppedWithAutokill,
    spawnEnemyArcProjectile,
    snapshotProjectile
  };
}

function environmentKillIntent(
  targetId: EntityId,
  hp: number,
  position: Readonly<{ x: number; y: number }>
): DamageIntent {
  return {
    targetId,
    amount: hp + 999,
    source: { kind: 'environment', tag: 'shooting-slimes-test' },
    hitPosition: position
  };
}

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
