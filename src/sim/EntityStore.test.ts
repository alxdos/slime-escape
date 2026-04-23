import { describe, expect, it } from 'vitest';

import type { DropEffect } from '../shared/content/drops';

import {
  createEntityStore,
  type DropSpawnSpec,
  type EnemySpawnSpec,
  type ProjectileSpawnSpec
} from './EntityStore';

const SPEC = {
  position: { x: 1, y: 2 },
  radius: 0.5,
  maxSpeed: 6,
  maxHp: 1
};

const ENEMY_SPEC: EnemySpawnSpec = {
  archetypeId: 'test-stationary-enemy',
  position: { x: 3, y: 4 },
  radius: 0.6,
  behavior: 'stationary',
  maxHp: 3,
  maxSpeed: 0,
  contactDamage: 0,
  contactCooldownMs: 1,
  knockbackBaseImpulse: 0,
  knockbackVelocityScale: 0,
  knockbackDurationMs: 1,
  color: 0xff7766
};

const PROJECTILE_SPEC: ProjectileSpawnSpec = {
  weaponArchetypeId: 'pistol',
  ownerKind: 'player',
  position: { x: 0, y: 0 },
  velocity: { vx: 10, vy: 0 },
  radius: 0.1,
  damage: 1,
  expireAtSimMs: 2000
};

describe('EntityStore', () => {
  it('starts empty', () => {
    const store = createEntityStore();
    expect(store.player()).toBeNull();
  });

  it('spawns a player matching the spawn spec', () => {
    const store = createEntityStore();
    const player = store.spawnPlayer(SPEC);

    expect(player.position).toEqual(SPEC.position);
    expect(player.radius).toBe(SPEC.radius);
    expect(player.maxSpeed).toBe(SPEC.maxSpeed);
    expect(store.player()).toBe(player);
  });

  it('makes the spawned position independent from the spec object', () => {
    const store = createEntityStore();
    const spec = { position: { x: 0, y: 0 }, radius: 0.5, maxSpeed: 6, maxHp: 1 };
    const player = store.spawnPlayer(spec);

    spec.position.x = 999;

    expect(player.position.x).toBe(0);
  });

  it('rejects double spawn until cleared', () => {
    const store = createEntityStore();
    store.spawnPlayer(SPEC);
    expect(() => store.spawnPlayer(SPEC)).toThrow();

    store.clear();
    expect(store.player()).toBeNull();
    expect(() => store.spawnPlayer(SPEC)).not.toThrow();
  });

  it('spawns an enemy with hp initialised from maxHp', () => {
    const store = createEntityStore();
    const enemy = store.spawnEnemy(ENEMY_SPEC);

    expect(enemy.kind).toBe('enemy');
    expect(enemy.hp).toBe(ENEMY_SPEC.maxHp);
    expect(enemy.maxHp).toBe(ENEMY_SPEC.maxHp);
    expect(enemy.position).toEqual(ENEMY_SPEC.position);
    expect(store.enemyById(enemy.id)).toBe(enemy);
    expect(store.enemyCount()).toBe(1);
  });

  it('isolates enemy position from the spec object', () => {
    const store = createEntityStore();
    const livePosition = { x: 1, y: 1 };
    const spec: EnemySpawnSpec = { ...ENEMY_SPEC, position: livePosition };
    const enemy = store.spawnEnemy(spec);

    livePosition.x = 999;

    expect(enemy.position.x).toBe(1);
  });

  it('spawns a projectile copying velocity and radius from the spec', () => {
    const store = createEntityStore();
    const projectile = store.spawnProjectile(PROJECTILE_SPEC);

    expect(projectile.kind).toBe('projectile');
    expect(projectile.velocity).toEqual(PROJECTILE_SPEC.velocity);
    expect(projectile.radius).toBe(PROJECTILE_SPEC.radius);
    expect(projectile.damage).toBe(PROJECTILE_SPEC.damage);
    expect(projectile.expireAtSimMs).toBe(PROJECTILE_SPEC.expireAtSimMs);
    expect(store.projectileById(projectile.id)).toBe(projectile);
    expect(store.projectileCount()).toBe(1);
  });

  it('isolates projectile velocity from the spec object', () => {
    const store = createEntityStore();
    const liveVelocity = { vx: 5, vy: 0 };
    const spec: ProjectileSpawnSpec = { ...PROJECTILE_SPEC, velocity: liveVelocity };
    const projectile = store.spawnProjectile(spec);

    liveVelocity.vx = 999;

    expect(projectile.velocity.vx).toBe(5);
  });

  it('isolates drop effect from later mutations of the source archetype object', () => {
    // design/drops.md: radius/effect/color are copied at spawn so a live drop
    // is independent from later mutations of the archetype it came from.
    const store = createEntityStore();
    const archetypeEffect: DropEffect = { kind: 'heal', amount: 1 };
    const spec: DropSpawnSpec = {
      archetypeId: 'heal-orb',
      position: { x: 0, y: 0 },
      radius: 0.35,
      effect: archetypeEffect,
      color: 0xff7aa8,
      expireAtSimMs: 1000
    };
    const drop = store.spawnDrop(spec);

    archetypeEffect.amount = 999;

    expect(drop.effect.kind).toBe('heal');
    if (drop.effect.kind !== 'heal') throw new Error('expected heal');
    expect(drop.effect.amount).toBe(1);
  });

  it('hands out unique ids across kinds', () => {
    const store = createEntityStore();
    const player = store.spawnPlayer(SPEC);
    const enemy = store.spawnEnemy(ENEMY_SPEC);
    const projectile = store.spawnProjectile(PROJECTILE_SPEC);

    const ids = new Set([player.id, enemy.id, projectile.id]);
    expect(ids.size).toBe(3);
  });

  it('removeEnemy reports presence and clears the entry', () => {
    const store = createEntityStore();
    const enemy = store.spawnEnemy(ENEMY_SPEC);

    expect(store.removeEnemy(enemy.id)).toBe(true);
    expect(store.removeEnemy(enemy.id)).toBe(false);
    expect(store.enemyById(enemy.id)).toBeNull();
    expect(store.enemyCount()).toBe(0);
  });

  it('removeProjectile reports presence and clears the entry', () => {
    const store = createEntityStore();
    const projectile = store.spawnProjectile(PROJECTILE_SPEC);

    expect(store.removeProjectile(projectile.id)).toBe(true);
    expect(store.removeProjectile(projectile.id)).toBe(false);
    expect(store.projectileById(projectile.id)).toBeNull();
    expect(store.projectileCount()).toBe(0);
  });

  it('clear() drops all kinds and resets id counter', () => {
    const store = createEntityStore();
    store.spawnPlayer(SPEC);
    store.spawnEnemy(ENEMY_SPEC);
    store.spawnProjectile(PROJECTILE_SPEC);

    store.clear();

    expect(store.player()).toBeNull();
    expect(store.enemyCount()).toBe(0);
    expect(store.projectileCount()).toBe(0);
    const playerAfter = store.spawnPlayer(SPEC);
    expect(playerAfter.id).toBe(1);
  });
});
