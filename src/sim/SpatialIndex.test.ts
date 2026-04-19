import { describe, expect, it } from 'vitest';

import {
  createEntityStore,
  type EnemySpawnSpec,
  type ProjectileSpawnSpec
} from './EntityStore';
import { createSpatialIndex } from './SpatialIndex';

const PLAYER_SPEC = { position: { x: 0, y: 0 }, radius: 0.5, maxSpeed: 6, maxHp: 1 };

function enemyAt(x: number, y: number, archetypeId = 'training-target'): EnemySpawnSpec {
  return {
    archetypeId,
    position: { x, y },
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
}

function projectileAt(x: number, y: number): ProjectileSpawnSpec {
  return {
    weaponArchetypeId: 'pistol',
    ownerKind: 'player',
    position: { x, y },
    velocity: { vx: 0, vy: 0 },
    radius: 0.1,
    damage: 1,
    expireAtSimMs: 1000
  };
}

describe('SpatialIndex', () => {
  it('starts empty', () => {
    const index = createSpatialIndex();
    expect(index.size()).toBe(0);
    expect(index.queryRadius(0, 0, 100)).toEqual([]);
  });

  it('rebuild collects player, enemies and projectiles', () => {
    const store = createEntityStore();
    store.spawnPlayer(PLAYER_SPEC);
    store.spawnEnemy(enemyAt(5, 0));
    store.spawnProjectile(projectileAt(1, 0));

    const index = createSpatialIndex();
    index.rebuild(store);

    expect(index.size()).toBe(3);
  });

  it('queryRadius uses center-to-point distance', () => {
    const store = createEntityStore();
    store.spawnEnemy(enemyAt(5, 0));
    store.spawnEnemy(enemyAt(0, 5));
    store.spawnEnemy(enemyAt(0, 0));

    const index = createSpatialIndex();
    index.rebuild(store);

    const hits = index.queryRadius(0, 0, 4);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.position).toEqual({ x: 0, y: 0 });

    const widerHits = index.queryRadius(0, 0, 5);
    expect(widerHits).toHaveLength(3);
  });

  it('queryAabb returns entities whose center sits inside the box', () => {
    const store = createEntityStore();
    store.spawnEnemy(enemyAt(2, 2));
    store.spawnEnemy(enemyAt(-2, -2));

    const index = createSpatialIndex();
    index.rebuild(store);

    const inside = index.queryAabb(0, 0, 5, 5);
    expect(inside).toHaveLength(1);
    expect(inside[0]?.position).toEqual({ x: 2, y: 2 });
  });

  it('rebuild replaces previous snapshot', () => {
    const store = createEntityStore();
    const enemy = store.spawnEnemy(enemyAt(0, 0));

    const index = createSpatialIndex();
    index.rebuild(store);
    expect(index.size()).toBe(1);

    store.removeEnemy(enemy.id);
    index.rebuild(store);

    expect(index.size()).toBe(0);
    expect(index.queryRadius(0, 0, 100)).toEqual([]);
  });

  it('does not mutate underlying entities', () => {
    const store = createEntityStore();
    const enemy = store.spawnEnemy(enemyAt(3, 4));
    const positionBefore = { ...enemy.position };

    const index = createSpatialIndex();
    index.rebuild(store);
    index.queryRadius(0, 0, 100);
    index.queryAabb(-100, -100, 100, 100);

    expect(enemy.position).toEqual(positionBefore);
  });
});
