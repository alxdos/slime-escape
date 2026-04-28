import { describe, expect, it } from 'vitest';

import type { EncounterDefinition, SessionDefinition } from '../shared/session';

import type { DamageSource } from './CombatSystem';
import { createEntityStore, type Boss, type Enemy, type EntityId } from './EntityStore';
import type { DeathContext } from './HealthDeathSystem';
import { createRunSummaryTracker } from './RunSummaryTracker';

describe('RunSummaryTracker', () => {
  it('aggregates kills by archetype, drop pickups and defeated boss state', () => {
    const tracker = createRunSummaryTracker();
    const store = createEntityStore();
    const slimeA = spawnEnemy(store, 'slime-a');
    const slimeB = spawnEnemy(store, 'slime-b');
    const boss = spawnBoss(store, 'boss-a');

    tracker.onDeath(deathOf(slimeA, 'enemy', 'slime-a'), store);
    tracker.onDeath(deathOf(slimeA, 'enemy', 'slime-a'), store);
    tracker.onDeath(deathOf(slimeB, 'enemy', 'slime-b'), store);
    boss.hp = 0;
    tracker.onDeath(deathOf(boss, 'boss', 'boss-a'), store);
    tracker.onDropPickup({
      entityId: 99 as EntityId,
      archetypeId: 'heal-orb',
      pickerId: 1 as EntityId,
      simTime: 250
    });

    const summary = tracker.buildSummary('win', 500, {
      session: makeSession([encounter('w1', 'wave')]),
      activeEncounter: {
        encounter: encounter('w1', 'wave'),
        index: 0,
        startSimMs: 0,
        waveOrdinal: 1
      },
      waveProgress: { dispatched: 1, total: 1, alive: 0 },
      store
    });

    expect(summary.outcome).toBe('win');
    expect(summary.durationMs).toBe(500);
    expect(summary.kills.total).toBe(4);
    expect(summary.kills.byArchetype).toEqual([
      { entityKind: 'enemy', archetypeId: 'slime-a', count: 2 },
      { entityKind: 'boss', archetypeId: 'boss-a', count: 1 },
      { entityKind: 'enemy', archetypeId: 'slime-b', count: 1 }
    ]);
    expect(summary.drops.pickedUpTotal).toBe(1);
    expect(summary.boss).toEqual({
      archetypeId: 'boss-a',
      encountered: true,
      defeated: true,
      hp: 0,
      maxHp: 100,
      hpPercent: 0
    });
  });

  it('calculates loss progress from completed objectives and active wave partial', () => {
    const tracker = createRunSummaryTracker();
    const store = createEntityStore();
    const encounters = [
      encounter('wave-1', 'wave'),
      encounter('break-1', 'break'),
      encounter('wave-2', 'wave'),
      encounter('boss', 'boss')
    ];

    const summary = tracker.buildSummary('loss', 300, {
      session: makeSession(encounters),
      activeEncounter: {
        encounter: encounters[2]!,
        index: 2,
        startSimMs: 100,
        waveOrdinal: 2
      },
      waveProgress: { dispatched: 5, total: 10, alive: 2 },
      store
    });

    expect(summary.progress).toEqual({
      percent: 43,
      completedObjectiveEncounters: 1,
      totalObjectiveEncounters: 3,
      completedWaves: 1,
      totalWaves: 2,
      activeEncounterId: 'wave-2',
      activeEncounterIndex: 2
    });
  });

  it('reports boss loss progress, boss hp and serialized defeat cause', () => {
    const tracker = createRunSummaryTracker();
    const store = createEntityStore();
    const boss = spawnBoss(store, 'boss-a');
    boss.hp = 28;
    const encounters = [encounter('wave-1', 'wave'), encounter('boss', 'boss')];
    const cause: DamageSource = { kind: 'boss', bossId: boss.id, attackId: 'slam' };
    tracker.onDeath(playerDeath(cause), store);

    const summary = tracker.buildSummary('loss', 600, {
      session: makeSession(encounters),
      activeEncounter: {
        encounter: encounters[1]!,
        index: 1,
        startSimMs: 400,
        waveOrdinal: null
      },
      waveProgress: { dispatched: 1, total: 1, alive: 1 },
      store
    });

    expect(summary.progress.percent).toBe(86);
    expect(summary.boss).toEqual({
      archetypeId: 'boss-a',
      encountered: true,
      defeated: false,
      hp: 28,
      maxHp: 100,
      hpPercent: 28
    });
    expect(summary.defeat).toEqual({
      cause: {
        kind: 'boss',
        bossId: boss.id,
        bossArchetypeId: 'boss-a',
        attackId: 'slam'
      }
    });
  });

  it('keeps sandbox/no-objective progress percent null', () => {
    const tracker = createRunSummaryTracker();
    const store = createEntityStore();
    const sandbox = encounter('sandbox', 'sandbox');

    const summary = tracker.buildSummary('loss', 100, {
      session: makeSession([sandbox], { win: { kind: 'none' }, loss: { kind: 'none' } }),
      activeEncounter: {
        encounter: sandbox,
        index: 0,
        startSimMs: 0,
        waveOrdinal: null
      },
      waveProgress: null,
      store
    });

    expect(summary.progress.percent).toBeNull();
    expect(summary.progress.totalObjectiveEncounters).toBe(0);
    expect(summary.kills.total).toBe(0);
  });
});

function encounter(id: string, type: EncounterDefinition['type']): EncounterDefinition {
  return {
    id,
    type,
    backgroundId: null,
    introDurationMs: 0,
    name: null,
    text: null,
    spawnPlan:
      type === 'boss'
        ? { kind: 'boss', bossArchetypeId: 'boss-a', position: { x: 0, y: 0 } }
        : { kind: 'empty' },
    zoneBehavior: { kind: 'disabled' },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'never', next: 'sequential' },
    tuning: null
  };
}

function makeSession(
  encounters: ReadonlyArray<EncounterDefinition>,
  options: Readonly<{
    win?: SessionDefinition['winCondition'];
    loss?: SessionDefinition['lossCondition'];
  }> = {}
): SessionDefinition {
  return {
    id: 'summary-test',
    seed: 1,
    arena: { width: 32, height: 18 },
    player: {
      position: { x: 0, y: 0 },
      radius: 0.5,
      contactBox: { width: 1, height: 1 },
      maxSpeed: 6,
      maxHp: 5
    },
    loadout: null,
    backgrounds: [],
    musicSampleId: null,
    modifiers: [],
    rules: {
      damage: { slimeFriendlyFire: false },
      aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 }
    },
    encounters,
    winCondition: options.win ?? { kind: 'allEncountersComplete' },
    lossCondition: options.loss ?? { kind: 'playerDeath' },
    uiMeta: null
  };
}

function spawnEnemy(store: ReturnType<typeof createEntityStore>, archetypeId: string): Enemy {
  return store.spawnEnemy({
    archetypeId,
    position: { x: 0, y: 0 },
    radius: 0.5,
    contactBox: { width: 1, height: 1 },
    behavior: 'stationary',
    maxHp: 3,
    maxSpeed: 0,
    contactDamage: 0,
    contactCooldownMs: 500,
    knockbackBaseImpulse: 0,
    knockbackVelocityScale: 0,
    knockbackDurationMs: 100,
    color: 0x00ff00
  });
}

function spawnBoss(store: ReturnType<typeof createEntityStore>, archetypeId: string): Boss {
  return store.spawnBoss({
    archetypeId,
    position: { x: 0, y: 0 },
    radius: 1,
    contactBox: { width: 2, height: 2 },
    maxHp: 100,
    maxSpeed: 0,
    color: 0xff0000,
    contactDamage: 1,
    contactCooldownMs: 500,
    knockbackBaseImpulse: 0,
    knockbackVelocityScale: 0,
    knockbackDurationMs: 100,
    phaseIndex: 0,
    phaseId: 'phase-1',
    activeAttackIds: ['slam'],
    attackIdsFromArchetype: ['slam']
  });
}

function deathOf(
  entity: Enemy | Boss,
  entityKind: 'enemy' | 'boss',
  archetypeId: string
): DeathContext {
  return {
    entityId: entity.id,
    entityKind,
    archetypeId,
    position: { x: entity.position.x, y: entity.position.y },
    cause: { kind: 'environment', tag: 'test' },
    simTime: 100
  };
}

function playerDeath(cause: DamageSource): DeathContext {
  return {
    entityId: 1 as EntityId,
    entityKind: 'player',
    archetypeId: null,
    position: { x: 0, y: 0 },
    cause,
    simTime: 600
  };
}
