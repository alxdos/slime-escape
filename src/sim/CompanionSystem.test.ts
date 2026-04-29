import { describe, expect, it } from 'vitest';

import type { RuntimeEvent } from '../shared/events';
import type { ArenaConfig, EncounterDefinition } from '../shared/session';
import { SIM_STEP_MS } from '../shared/timing';

import { createCompanionSystem } from './CompanionSystem';
import {
  createEntityStore,
  type CompanionSpawnSpec,
  type EnemySpawnSpec
} from './EntityStore';

const ARENA: ArenaConfig = { width: 32, height: 18 };
const SIM_STEP_SEC = SIM_STEP_MS / 1000;
const PLAYER_SPEC = {
  position: { x: 0, y: 0 },
  radius: 0.5,
  contactBox: { width: 1.2, height: 2 },
  maxSpeed: 6,
  maxHp: 3
};
const BASE_COMPANION: CompanionSpawnSpec = {
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

describe('CompanionSystem movement modes', () => {
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

describe('CompanionSystem ghost and rescue', () => {
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

    system.tick(ARENA, store, ACTIVE_WAVE, 0);
    expect(enemy.hp).toBe(enemy.maxHp);
    expect(enemy.knockback).toEqual({
      vx: 6,
      vy: 0,
      startSimMs: 0,
      endSimMs: 150
    });

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
