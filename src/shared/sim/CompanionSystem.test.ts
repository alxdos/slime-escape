import { describe, expect, it } from 'vitest';

import type { RuntimeEvent } from '../events';
import { HEAL_ORB } from '../content/drops';
import type { ArenaConfig, EncounterDefinition } from '../session';
import { SIM_STEP_MS } from '../timing';

import { createCompanionSystem } from './CompanionSystem';
import {
  createEntityStore,
  type CompanionSpawnSpec,
  type DropSpawnSpec,
  type EnemySpawnSpec
} from './EntityStore';

const ARENA: ArenaConfig = { width: 32, height: 18 };
const SIM_STEP_SEC = SIM_STEP_MS / 1000;
const PLAYER_SPEC = {
  id: 'player',
  position: { x: 0, y: 0 },
  radius: 0.5,
  contactBox: { width: 1.2, height: 2 },
  maxSpeed: 6,
  maxHp: 3
};
const BASE_COMPANION: CompanionSpawnSpec = {
  ownerPlayerId: 'player',
  petArchetypeId: 'debug-buddy',
  position: { x: 0, y: 0 },
  contactBox: { width: 0.8, height: 0.8 },
  maxHp: 6,
  movement: { maxSpeed: 8, acceleration: 12, orbitRadius: 2 },
  threat: { acquireRadius: 5, releaseRadius: 7 },
  weaponLoadout: { weapons: ['pistol'], selectedIndex: 0 },
  boop: { radius: 0.25, impulse: 4, durationMs: 120, cooldownMs: 500 },
  rescue: { radius: 1, durationMs: SIM_STEP_MS * 3, reviveHpFraction: 0.5 }
};
const BASE_ENEMY: Omit<EnemySpawnSpec, 'position'> = {
  archetypeId: 'test-slime',
  radius: 0.5,
  contactBox: { width: 1, height: 1 },
  behavior: 'stationary',
  maxHp: 4,
  maxSpeed: 0,
  contactDamage: 1,
  contactCooldownMs: 500,
  knockbackBaseImpulse: 4,
  knockbackVelocityScale: 2,
  knockbackDurationMs: 200,
  color: 0x77ff99
};
const ACTIVE_WAVE: EncounterDefinition = {
  id: 'wave-1',
  type: 'wave',
  backgroundId: null,
  introDurationMs: 0,
  name: null,
  text: null,
  spawnPlan: { kind: 'empty' },
  zoneBehavior: { kind: 'disabled' },
  objectives: [],
  rewardRules: null,
  transitionRules: { kind: 'never', next: 'sequential' },
  tuning: null
};

function setup(companionSpec: CompanionSpawnSpec = BASE_COMPANION) {
  const store = createEntityStore();
  const player = store.spawnPlayer(PLAYER_SPEC);
  const companion = store.spawnCompanion(companionSpec);
  const system = createCompanionSystem();
  return { store, player, companion, system };
}

function enemyAt(x: number, y: number, overrides: Partial<EnemySpawnSpec> = {}) {
  return {
    ...BASE_ENEMY,
    ...overrides,
    position: { x, y }
  };
}

function healDropAt(x: number, y: number, overrides: Partial<DropSpawnSpec> = {}) {
  return {
    archetypeId: HEAL_ORB.id,
    position: { x, y },
    radius: HEAL_ORB.radius,
    effect: HEAL_ORB.effect,
    color: HEAL_ORB.color,
    expireAtSimMs: 10_000,
    ...overrides
  };
}

describe('CompanionSystem movement modes', () => {
  it('ticks multiple companions independently while keeping each pinned to its owner', () => {
    const store = createEntityStore();
    store.spawnPlayer({
      ...PLAYER_SPEC,
      id: 'alpha',
      position: { x: -4, y: 0 }
    });
    store.spawnPlayer({
      ...PLAYER_SPEC,
      id: 'bravo',
      position: { x: 4, y: 0 }
    });
    const alphaCompanion = store.spawnCompanion({
      ...BASE_COMPANION,
      ownerPlayerId: 'alpha',
      position: { x: -4, y: 0 }
    });
    const bravoCompanion = store.spawnCompanion({
      ...BASE_COMPANION,
      ownerPlayerId: 'bravo',
      position: { x: 4, y: 0 }
    });
    const leftEnemy = store.spawnEnemy(enemyAt(-3, 0));
    const rightEnemy = store.spawnEnemy(enemyAt(3, 0));
    const system = createCompanionSystem();

    system.tick(ARENA, store, ACTIVE_WAVE, 0);

    expect(Array.from(store.companions(), (companion) => companion.id)).toEqual([
      alphaCompanion.id,
      bravoCompanion.id
    ]);
    expect(alphaCompanion.targetId).toBe(leftEnemy.id);
    expect(bravoCompanion.targetId).toBe(rightEnemy.id);
  });

  it('rests outside active combat pressure and moves with acceleration limits', () => {
    const { companion, system, store } = setup({
      ...BASE_COMPANION,
      position: { x: 5, y: 0 },
      movement: { ...BASE_COMPANION.movement, acceleration: 6 }
    });

    system.tick(ARENA, store, null, 0);

    expect(companion.mode).toBe('rest');
    expect(Math.hypot(companion.velocity.vx, companion.velocity.vy)).toBeLessThanOrEqual(
      6 * SIM_STEP_SEC + 1e-10
    );
  });

  it('does not instantly reverse velocity when the desired direction flips', () => {
    const { companion, player, system, store } = setup({
      ...BASE_COMPANION,
      position: { x: 3, y: 0 },
      movement: { maxSpeed: 10, acceleration: 4, orbitRadius: 1 }
    });
    companion.velocity.vx = 5;
    player.velocity.vx = 10;

    system.tick(ARENA, store, null, 0);

    expect(companion.velocity.vx).toBeGreaterThan(0);
    expect(companion.velocity.vx).toBeCloseTo(5 - 4 * SIM_STEP_SEC);
  });

  it('guards during combat when no threat is inside acquire radius', () => {
    const { companion, system, store } = setup();

    system.tick(ARENA, store, ACTIVE_WAVE, 0);

    expect(companion.mode).toBe('guard');
    expect(companion.targetId).toBeNull();
    expect(Math.hypot(companion.velocity.vx, companion.velocity.vy)).toBeGreaterThan(0);
  });

  it('acquires the nearest threat deterministically and enters engage after alert', () => {
    const { companion, system, store } = setup();
    const first = store.spawnEnemy(enemyAt(2, 0));
    store.spawnEnemy(enemyAt(-2, 0));

    system.tick(ARENA, store, ACTIVE_WAVE, 0);
    expect(companion.targetId).toBe(first.id);
    expect(companion.mode).toBe('alert');

    system.tick(ARENA, store, ACTIVE_WAVE, 300);
    expect(companion.targetId).toBe(first.id);
    expect(companion.mode).toBe('engage');
  });

  it('keeps the current threat inside release radius to avoid flicker', () => {
    const { companion, system, store } = setup({
      ...BASE_COMPANION,
      threat: { acquireRadius: 2, releaseRadius: 6 }
    });
    const current = store.spawnEnemy(enemyAt(1.5, 0));

    system.tick(ARENA, store, ACTIVE_WAVE, 0);
    current.position.x = 4;
    store.spawnEnemy(enemyAt(0.5, 0));
    system.tick(ARENA, store, ACTIVE_WAVE, SIM_STEP_MS);

    expect(companion.targetId).toBe(current.id);
  });
});

describe('CompanionSystem heal drop seeking', () => {
  it('prioritizes a nearby heal drop while damaged and clears hostile target', () => {
    const { companion, system, store } = setup({
      ...BASE_COMPANION,
      movement: { maxSpeed: 8, acceleration: 24, orbitRadius: 2 }
    });
    companion.hp = companion.maxHp - 1;
    store.spawnEnemy(enemyAt(-1, 0));
    store.spawnDrop(healDropAt(2, 0));

    system.tick(ARENA, store, ACTIVE_WAVE, 0);

    expect(companion.targetId).toBeNull();
    expect(companion.mode).toBe('guard');
    expect(companion.velocity.vx).toBeGreaterThan(0);
    expect(Math.abs(companion.velocity.vy)).toBeLessThan(1e-10);
  });

  it('ignores heal drops while already at full hp and can acquire a threat', () => {
    const { companion, system, store } = setup();
    const enemy = store.spawnEnemy(enemyAt(1, 0));
    store.spawnDrop(healDropAt(-1, 0));

    system.tick(ARENA, store, ACTIVE_WAVE, 0);

    expect(companion.targetId).toBe(enemy.id);
    expect(companion.mode).toBe('alert');
  });

  it('ignores heal drops outside the threat acquisition radius', () => {
    const { companion, system, store } = setup({
      ...BASE_COMPANION,
      threat: { acquireRadius: 1, releaseRadius: 2 }
    });
    companion.hp = companion.maxHp - 1;
    const enemy = store.spawnEnemy(enemyAt(0.5, 0));
    store.spawnDrop(healDropAt(2, 0));

    system.tick(ARENA, store, ACTIVE_WAVE, 0);

    expect(companion.targetId).toBe(enemy.id);
    expect(companion.mode).toBe('alert');
  });
});

describe('CompanionSystem ghost and rescue', () => {
  it('lets any living player rescue a ghost companion while the owner remains a ghost', () => {
    const store = createEntityStore();
    const owner = store.spawnPlayer({
      ...PLAYER_SPEC,
      id: 'owner',
      position: { x: 10, y: 0 }
    });
    store.spawnPlayer({
      ...PLAYER_SPEC,
      id: 'rescuer',
      position: { x: 0, y: 0 }
    });
    owner.state = 'ghost';
    owner.hp = 0;
    const companion = store.spawnCompanion({
      ...BASE_COMPANION,
      ownerPlayerId: 'owner',
      position: { x: 0.5, y: 0 },
      rescue: { ...BASE_COMPANION.rescue, durationMs: SIM_STEP_MS * 2 }
    });
    companion.state = 'ghost';
    companion.hp = 0;
    const system = createCompanionSystem();
    const events: RuntimeEvent[] = [];

    system.tick(ARENA, store, ACTIVE_WAVE, 0);
    expect(companion.mode).toBe('rescue');
    expect(companion.rescueProgressMs).toBe(SIM_STEP_MS);

    system.tick(ARENA, store, ACTIVE_WAVE, SIM_STEP_MS, (event) => events.push(event));

    expect(owner.state).toBe('ghost');
    expect(companion.state).toBe('alive');
    expect(companion.hp).toBe(3);
    expect(events.some((event) => event.kind === 'companionRescued')).toBe(true);
  });

  it('resets rescue progress when the player leaves the radius', () => {
    const { companion, player, system, store } = setup();
    companion.state = 'ghost';
    companion.hp = 0;

    system.tick(ARENA, store, ACTIVE_WAVE, 0);
    expect(companion.mode).toBe('rescue');
    expect(companion.rescueProgressMs).toBe(SIM_STEP_MS);

    player.position.x = 10;
    system.tick(ARENA, store, ACTIVE_WAVE, SIM_STEP_MS);
    expect(companion.mode).toBe('ghost');
    expect(companion.rescueProgressMs).toBe(0);
  });

  it('revives a ghost companion with the configured partial hp after channel completion', () => {
    const { companion, system, store } = setup();
    const events: RuntimeEvent[] = [];
    companion.state = 'ghost';
    companion.hp = 0;

    system.tick(ARENA, store, ACTIVE_WAVE, 0);
    system.tick(ARENA, store, ACTIVE_WAVE, SIM_STEP_MS);
    system.tick(ARENA, store, ACTIVE_WAVE, SIM_STEP_MS * 2, (event) => events.push(event));

    expect(companion.state).toBe('alive');
    expect(companion.hp).toBe(3);
    expect(companion.mode).toBe('rest');
    expect(companion.rescueProgressMs).toBe(0);
    const rescued = events.find((event) => event.kind === 'companionRescued');
    if (rescued?.kind !== 'companionRescued') throw new Error('expected companionRescued');
    expect(rescued.companionId).toBe(companion.id);
    expect(rescued.petArchetypeId).toBe(companion.petArchetypeId);
    expect(rescued.hp).toBe(3);
    expect(rescued.maxHp).toBe(companion.maxHp);
  });

  it('caps ghost movement at half of configured companion speed', () => {
    const { companion, player, system, store } = setup({
      ...BASE_COMPANION,
      position: { x: 8, y: 0 },
      movement: { maxSpeed: 8, acceleration: 1000, orbitRadius: 4 }
    });
    companion.state = 'ghost';
    companion.hp = 0;
    player.position.x = 0;
    player.position.y = 0;

    system.tick(ARENA, store, ACTIVE_WAVE, 0);

    expect(Math.hypot(companion.velocity.vx, companion.velocity.vy)).toBeCloseTo(4, 10);
  });

  it('keeps the ghost follow point inside rescue radius during long channeling', () => {
    const { companion, system, store } = setup({
      ...BASE_COMPANION,
      position: { x: 1.3, y: 0 },
      movement: { maxSpeed: 20, acceleration: 1000, orbitRadius: 3.2 },
      rescue: { radius: 1.4, durationMs: 5000, reviveHpFraction: 0.5 }
    });
    companion.state = 'ghost';
    companion.hp = 0;

    for (let step = 0; companion.state === 'ghost' && step < 360; step += 1) {
      system.tick(ARENA, store, ACTIVE_WAVE, step * SIM_STEP_MS);
    }

    expect(companion.state).toBe('alive');
    expect(companion.rescueProgressMs).toBe(0);
  });
});

describe('CompanionSystem boop', () => {
  it('applies protective knockback without damage and respects cooldown', () => {
    const { companion, system, store } = setup({
      ...BASE_COMPANION,
      position: { x: 0, y: 0 },
      movement: { maxSpeed: 0, acceleration: 0, orbitRadius: 1 },
      boop: { radius: 2, impulse: 3, durationMs: 150, cooldownMs: 500 }
    });
    const enemy = store.spawnEnemy(enemyAt(1, 0));
    const events: RuntimeEvent[] = [];

    system.tick(ARENA, store, ACTIVE_WAVE, 0, (event) => events.push(event));
    expect(enemy.hp).toBe(enemy.maxHp);
    expect(enemy.knockback).toEqual({
      vx: 6,
      vy: 0,
      startSimMs: 0,
      endSimMs: 150
    });
    const boop = events.find((event) => event.kind === 'companionBoop');
    if (boop?.kind !== 'companionBoop') throw new Error('expected companionBoop');
    expect(boop.companionId).toBe(companion.id);
    expect(boop.targetId).toBe(enemy.id);
    expect(boop.targetKind).toBe('enemy');
    expect(boop.impulseDirX).toBe(1);
    expect(boop.impulseDirY).toBe(0);

    enemy.knockback = null;
    system.tick(ARENA, store, ACTIVE_WAVE, SIM_STEP_MS);
    expect(enemy.knockback).toBeNull();

    system.tick(ARENA, store, ACTIVE_WAVE, 500);
    const refreshedKnockback = store.enemyById(enemy.id)?.knockback;
    expect(refreshedKnockback?.vx).toBe(6);
    expect(companion.boopReadyAtSimMs).toBe(1000);
  });

  it('can boop while in ghost state', () => {
    const { companion, system, store } = setup({
      ...BASE_COMPANION,
      position: { x: 0, y: 0 },
      movement: { maxSpeed: 0, acceleration: 0, orbitRadius: 1 },
      boop: { radius: 2, impulse: 2, durationMs: 100, cooldownMs: 500 }
    });
    const enemy = store.spawnEnemy(enemyAt(1, 0));
    companion.state = 'ghost';
    companion.hp = 0;

    system.tick(ARENA, store, ACTIVE_WAVE, 0);

    expect(companion.mode).toBe('rescue');
    expect(enemy.knockback?.vx).toBe(4);
    expect(enemy.hp).toBe(enemy.maxHp);
  });
});
