import { describe, expect, it } from 'vitest';

import { SLIME_FAST, TRAINING_TARGET } from '../shared/content/enemies';
import type { ArenaConfig, PlayerSpawn } from '../shared/session';
import { SIM_STEP_MS } from '../shared/timing';

import { createEntityStore, type EnemySpawnSpec } from './EntityStore';
import { createMovementSystem } from './MovementSystem';
import { createRuntimeInputState } from './RuntimeInputState';

const ARENA: ArenaConfig = { width: 32, height: 18 };
const PLAYER: PlayerSpawn = { position: { x: 0, y: 0 }, radius: 0.5, maxSpeed: 6, maxHp: 1 };
const SIM_STEP_SEC = SIM_STEP_MS / 1000;

function setup(spec: PlayerSpawn = PLAYER) {
  const store = createEntityStore();
  store.spawnPlayer(spec);
  const movement = createMovementSystem();
  const input = createRuntimeInputState();
  return { store, movement, input };
}

function trainingTargetAt(x: number, y: number): EnemySpawnSpec {
  return {
    archetypeId: TRAINING_TARGET.id,
    position: { x, y },
    radius: TRAINING_TARGET.radius,
    behavior: TRAINING_TARGET.behavior,
    maxHp: TRAINING_TARGET.maxHp,
    maxSpeed: TRAINING_TARGET.maxSpeed,
    contactDamage: TRAINING_TARGET.contactDamage,
    contactCooldownMs: TRAINING_TARGET.contactCooldownMs,
    knockbackBaseImpulse: TRAINING_TARGET.knockbackBaseImpulse,
    knockbackVelocityScale: TRAINING_TARGET.knockbackVelocityScale,
    knockbackDurationMs: TRAINING_TARGET.knockbackDurationMs,
    color: TRAINING_TARGET.color
  };
}

function slimeFastAt(x: number, y: number): EnemySpawnSpec {
  return {
    archetypeId: SLIME_FAST.id,
    position: { x, y },
    radius: SLIME_FAST.radius,
    behavior: SLIME_FAST.behavior,
    maxHp: SLIME_FAST.maxHp,
    maxSpeed: SLIME_FAST.maxSpeed,
    contactDamage: SLIME_FAST.contactDamage,
    contactCooldownMs: SLIME_FAST.contactCooldownMs,
    knockbackBaseImpulse: SLIME_FAST.knockbackBaseImpulse,
    knockbackVelocityScale: SLIME_FAST.knockbackVelocityScale,
    knockbackDurationMs: SLIME_FAST.knockbackDurationMs,
    color: SLIME_FAST.color
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
    input.moveDir.dx = 1;
    input.moveDir.dy = 1;
    for (let i = 0; i < 10000; i += 1) {
      movement.tick(ARENA, store, input, i * SIM_STEP_MS);
    }
    const p = store.player();
    expect(p).not.toBeNull();
    if (p === null) throw new Error('unreachable');
    expect(p.position.x).toBeLessThanOrEqual(halfW - PLAYER.radius);
    expect(p.position.y).toBeLessThanOrEqual(halfH - PLAYER.radius);

    input.moveDir.dx = -1;
    input.moveDir.dy = -1;
    for (let i = 0; i < 10000; i += 1) {
      movement.tick(ARENA, store, input, i * SIM_STEP_MS);
    }
    expect(p.position.x).toBeGreaterThanOrEqual(-halfW + PLAYER.radius);
    expect(p.position.y).toBeGreaterThanOrEqual(-halfH + PLAYER.radius);
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
      ownerKind: 'player',
      position: { x: 1, y: 0 },
      velocity: { vx: 24, vy: 0 },
      radius: 0.1,
      damage: 1,
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
    expect(before - after).toBeCloseTo(SLIME_FAST.maxSpeed * SIM_STEP_SEC, 10);
    expect(enemy.velocity.vx).toBeCloseTo(-SLIME_FAST.maxSpeed, 10);
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
