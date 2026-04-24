import { describe, expect, it } from 'vitest';

import type { ArenaConfig, PlayerSpawn } from '../shared/session';
import { SIM_STEP_MS } from '../shared/timing';

import { createEntityStore, type EnemySpawnSpec, type EntityId } from './EntityStore';
import { createMovementSystem } from './MovementSystem';
import { createRuntimeInputState } from './RuntimeInputState';

const ARENA: ArenaConfig = { width: 32, height: 18 };
const PLAYER: PlayerSpawn = {
  position: { x: 0, y: 0 },
  radius: 0.5,
  contactBox: { width: 1.2, height: 2 },
  maxSpeed: 6,
  maxHp: 1
};
const SIM_STEP_SEC = SIM_STEP_MS / 1000;
const STATIONARY_TEST_ENEMY = {
  archetypeId: 'test-stationary-enemy',
  radius: 0.6,
  contactBox: { width: 1.2, height: 1.2 },
  behavior: 'stationary',
  maxHp: 3,
  maxSpeed: 0,
  contactDamage: 0,
  contactCooldownMs: 1,
  knockbackBaseImpulse: 0,
  knockbackVelocityScale: 0,
  knockbackDurationMs: 1,
  color: 0xff7766
} as const;
const CHASE_TEST_ENEMY = {
  archetypeId: 'test-chase-enemy',
  radius: 0.4,
  contactBox: { width: 0.8, height: 0.8 },
  behavior: 'chase',
  maxHp: 1,
  maxSpeed: 4,
  contactDamage: 1,
  contactCooldownMs: 800,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  color: 0x77ff99
} as const;

function setup(spec: PlayerSpawn = PLAYER) {
  const store = createEntityStore();
  store.spawnPlayer(spec);
  const movement = createMovementSystem();
  const input = createRuntimeInputState();
  return { store, movement, input };
}

function trainingTargetAt(x: number, y: number): EnemySpawnSpec {
  return {
    archetypeId: STATIONARY_TEST_ENEMY.archetypeId,
    position: { x, y },
    radius: STATIONARY_TEST_ENEMY.radius,
    contactBox: STATIONARY_TEST_ENEMY.contactBox,
    behavior: STATIONARY_TEST_ENEMY.behavior,
    maxHp: STATIONARY_TEST_ENEMY.maxHp,
    maxSpeed: STATIONARY_TEST_ENEMY.maxSpeed,
    contactDamage: STATIONARY_TEST_ENEMY.contactDamage,
    contactCooldownMs: STATIONARY_TEST_ENEMY.contactCooldownMs,
    knockbackBaseImpulse: STATIONARY_TEST_ENEMY.knockbackBaseImpulse,
    knockbackVelocityScale: STATIONARY_TEST_ENEMY.knockbackVelocityScale,
    knockbackDurationMs: STATIONARY_TEST_ENEMY.knockbackDurationMs,
    color: STATIONARY_TEST_ENEMY.color
  };
}

function slimeFastAt(x: number, y: number): EnemySpawnSpec {
  return {
    archetypeId: CHASE_TEST_ENEMY.archetypeId,
    position: { x, y },
    radius: CHASE_TEST_ENEMY.radius,
    contactBox: CHASE_TEST_ENEMY.contactBox,
    behavior: CHASE_TEST_ENEMY.behavior,
    maxHp: CHASE_TEST_ENEMY.maxHp,
    maxSpeed: CHASE_TEST_ENEMY.maxSpeed,
    contactDamage: CHASE_TEST_ENEMY.contactDamage,
    contactCooldownMs: CHASE_TEST_ENEMY.contactCooldownMs,
    knockbackBaseImpulse: CHASE_TEST_ENEMY.knockbackBaseImpulse,
    knockbackVelocityScale: CHASE_TEST_ENEMY.knockbackVelocityScale,
    knockbackDurationMs: CHASE_TEST_ENEMY.knockbackDurationMs,
    color: CHASE_TEST_ENEMY.color
  };
}

describe('MovementSystem player', () => {
  it('does not move the player when moveDir is zero', () => {
    const { store, movement, input } = setup();
    for (let i = 0; i < 10; i += 1) {
      movement.tick(ARENA, store, input, i * SIM_STEP_MS);
    }
    expect(store.player()?.position).toEqual({ x: 0, y: 0 });
  });

  it('integrates moveDir at maxSpeed * SIM_STEP_SEC per tick', () => {
    const { store, movement, input } = setup();
    input.moveDir.dx = 1;
    movement.tick(ARENA, store, input, 0);
    expect(store.player()?.position.x).toBeCloseTo(PLAYER.maxSpeed * SIM_STEP_SEC, 10);
    expect(store.player()?.position.y).toBe(0);
  });

  it('writes velocity = moveDir * maxSpeed onto the player', () => {
    const { store, movement, input } = setup();
    input.moveDir.dx = 1;
    input.moveDir.dy = 0;
    movement.tick(ARENA, store, input, 0);
    expect(store.player()?.velocity).toEqual({ vx: PLAYER.maxSpeed, vy: 0 });
    input.moveDir.dx = 0;
    movement.tick(ARENA, store, input, SIM_STEP_MS);
    expect(store.player()?.velocity).toEqual({ vx: 0, vy: 0 });
  });

  it('treats normalised diagonal as full speed (not sqrt(2)*speed)', () => {
    const { store, movement, input } = setup();
    const inv = Math.SQRT1_2;
    input.moveDir.dx = inv;
    input.moveDir.dy = inv;
    movement.tick(ARENA, store, input, 0);
    const p = store.player();
    expect(p).not.toBeNull();
    if (p === null) throw new Error('unreachable');
    const traveled = Math.hypot(p.position.x, p.position.y);
    expect(traveled).toBeCloseTo(PLAYER.maxSpeed * SIM_STEP_SEC, 10);
  });

  it('keeps the player inside the arena no matter how long it pushes outward (design/arena-and-coordinates.md)', () => {
    const { store, movement, input } = setup();
    const halfW = ARENA.width / 2;
    const halfH = ARENA.height / 2;
    const halfContactWidth = PLAYER.contactBox.width / 2;
    const halfContactHeight = PLAYER.contactBox.height / 2;
    input.moveDir.dx = 1;
    input.moveDir.dy = 1;
    for (let i = 0; i < 10000; i += 1) {
      movement.tick(ARENA, store, input, i * SIM_STEP_MS);
    }
    const p = store.player();
    expect(p).not.toBeNull();
    if (p === null) throw new Error('unreachable');
    expect(p.position.x).toBeLessThanOrEqual(halfW - halfContactWidth);
    expect(p.position.y).toBeLessThanOrEqual(halfH - halfContactHeight);

    input.moveDir.dx = -1;
    input.moveDir.dy = -1;
    for (let i = 0; i < 10000; i += 1) {
      movement.tick(ARENA, store, input, i * SIM_STEP_MS);
    }
    expect(p.position.x).toBeGreaterThanOrEqual(-halfW + halfContactWidth);
    expect(p.position.y).toBeGreaterThanOrEqual(-halfH + halfContactHeight);
  });

  it('is a no-op when no player is spawned', () => {
    const store = createEntityStore();
    const movement = createMovementSystem();
    const input = createRuntimeInputState();
    input.moveDir.dx = 1;
    expect(() => movement.tick(ARENA, store, input, 0)).not.toThrow();
    expect(store.player()).toBeNull();
  });
});

describe('MovementSystem enemies', () => {
  it('does not move stationary enemies or projectiles', () => {
    const { store, movement, input } = setup();
    const enemy = store.spawnEnemy(trainingTargetAt(5, 0));
    const projectile = store.spawnProjectile({
      weaponArchetypeId: 'pistol',
      ownerId: 1 as EntityId,
      ownerKind: 'player',
      motionKind: 'linear',
      position: { x: 1, y: 0 },
      velocity: { vx: 24, vy: 0 },
      size: { width: 0.25, height: 0.25 },
      hitRadius: 0.1,
      impactDamage: 1,
      knockbackImpulse: 5,
      pierceRemaining: 0,
      groundOnImpact: false,
      groundedLifetimeMs: null,
      explosion: null,
      groundAtSimMs: null,
      expireAtSimMs: 10_000
    });
    const enemyPosBefore = { ...enemy.position };
    const projectilePosBefore = { ...projectile.position };

    input.moveDir.dx = 1;
    for (let i = 0; i < 10; i += 1) {
      movement.tick(ARENA, store, input, i * SIM_STEP_MS);
    }

    expect(enemy.position).toEqual(enemyPosBefore);
    expect(projectile.position).toEqual(projectilePosBefore);
  });

  it('moves a chase enemy toward the player at maxSpeed', () => {
    const { store, movement, input } = setup();
    const enemy = store.spawnEnemy(slimeFastAt(5, 0));
    const before = enemy.position.x;
    movement.tick(ARENA, store, input, 0);
    const after = enemy.position.x;
    expect(after).toBeLessThan(before);
    expect(before - after).toBeCloseTo(CHASE_TEST_ENEMY.maxSpeed * SIM_STEP_SEC, 10);
    expect(enemy.velocity.vx).toBeCloseTo(-CHASE_TEST_ENEMY.maxSpeed, 10);
    expect(enemy.velocity.vy).toBeCloseTo(0, 10);
  });

  it('a chase enemy without a player keeps still and zeroes velocity', () => {
    const store = createEntityStore();
    const enemy = store.spawnEnemy(slimeFastAt(3, 0));
    const movement = createMovementSystem();
    const input = createRuntimeInputState();
    movement.tick(ARENA, store, input, 0);
    expect(enemy.position).toEqual({ x: 3, y: 0 });
    expect(enemy.velocity).toEqual({ vx: 0, vy: 0 });
  });

  it('knockback overrides chase, decays toward zero and is not arena-clamped', () => {
    const { store, movement, input } = setup();
    const enemy = store.spawnEnemy(slimeFastAt(15.5, 0));
    enemy.knockback = { vx: 100, vy: 0, startSimMs: 0, endSimMs: 200 };

    const halfW = ARENA.width / 2;
    let simTime = 0;
    movement.tick(ARENA, store, input, simTime);
    expect(enemy.velocity.vx).toBeCloseTo(100, 10);
    const xAfterFirstTick = enemy.position.x;
    expect(xAfterFirstTick).toBeGreaterThan(halfW);

    simTime += SIM_STEP_MS;
    movement.tick(ARENA, store, input, simTime);
    expect(Math.abs(enemy.velocity.vx)).toBeLessThan(100);
    expect(Math.abs(enemy.velocity.vx)).toBeGreaterThan(0);

    while (simTime < 200) {
      simTime += SIM_STEP_MS;
      movement.tick(ARENA, store, input, simTime);
    }
    expect(enemy.knockback).toBeNull();
  });

  it('after knockback expires the chase resumes', () => {
    const { store, movement, input } = setup();
    const enemy = store.spawnEnemy(slimeFastAt(5, 0));
    enemy.knockback = { vx: 0, vy: 0, startSimMs: 0, endSimMs: SIM_STEP_MS };

    movement.tick(ARENA, store, input, 0);
    const xDuring = enemy.position.x;
    expect(xDuring).toBe(5);

    movement.tick(ARENA, store, input, SIM_STEP_MS);
    expect(enemy.position.x).toBeLessThan(5);
    expect(enemy.knockback).toBeNull();
  });
});
