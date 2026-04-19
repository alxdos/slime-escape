import { describe, expect, it } from 'vitest';

import { TRAINING_TARGET } from '../shared/content/enemies';
import { PISTOL } from '../shared/content/weapons';
import { SIM_STEP_MS, SNAPSHOT_INTERVAL_MS } from '../shared/timing';

import { createEntityStore } from './EntityStore';
import { createSnapshotExportSystem } from './SnapshotExportSystem';

const TICKS_PER_SNAPSHOT = Math.round(SNAPSHOT_INTERVAL_MS / SIM_STEP_MS);

describe('SnapshotExportSystem', () => {
  it('emits the player entity with kind "player"', () => {
    const store = createEntityStore();
    store.spawnPlayer({ position: { x: 3, y: -2 }, radius: 0.5, maxSpeed: 6 });
    const exporter = createSnapshotExportSystem();

    const snapshot = exporter.onTick(0, store);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.entities).toHaveLength(1);
    const entity = snapshot?.entities[0];
    expect(entity?.kind).toBe('player');
    expect(entity?.x).toBe(3);
    expect(entity?.y).toBe(-2);
    expect(snapshot?.simTimeMs).toBe(0);
  });

  it('emits empty entity list when no player is spawned', () => {
    const store = createEntityStore();
    const exporter = createSnapshotExportSystem();

    const snapshot = exporter.onTick(0, store);

    expect(snapshot?.entities).toHaveLength(0);
  });

  it('emits exactly once per TICKS_PER_SNAPSHOT', () => {
    const store = createEntityStore();
    store.spawnPlayer({ position: { x: 0, y: 0 }, radius: 0.5, maxSpeed: 6 });
    const exporter = createSnapshotExportSystem();

    let emitted = 0;
    for (let tick = 0; tick < TICKS_PER_SNAPSHOT * 3; tick += 1) {
      const snapshot = exporter.onTick(tick * SIM_STEP_MS, store);
      if (snapshot !== null) emitted += 1;
    }

    expect(emitted).toBe(3);
  });

  it('reset() restores the cadence so the next call emits', () => {
    const store = createEntityStore();
    store.spawnPlayer({ position: { x: 0, y: 0 }, radius: 0.5, maxSpeed: 6 });
    const exporter = createSnapshotExportSystem();

    exporter.onTick(0, store);
    expect(exporter.onTick(SIM_STEP_MS, store)).toBeNull();

    exporter.reset();
    expect(exporter.onTick(SIM_STEP_MS, store)).not.toBeNull();
  });

  it('emits enemy with archetypeId/hp/maxHp and projectile with weaponArchetypeId/ownerKind', () => {
    const store = createEntityStore();
    store.spawnEnemy({
      archetypeId: TRAINING_TARGET.id,
      position: { x: 5, y: 0 },
      radius: TRAINING_TARGET.radius,
      behavior: 'stationary',
      maxHp: TRAINING_TARGET.maxHp,
      color: TRAINING_TARGET.color
    });
    store.spawnProjectile({
      weaponArchetypeId: PISTOL.id,
      ownerKind: 'player',
      position: { x: 1, y: 0 },
      velocity: { vx: 24, vy: 0 },
      radius: PISTOL.projectileRadius,
      damage: PISTOL.damage,
      expireAtSimMs: 1000
    });

    const exporter = createSnapshotExportSystem();
    const snapshot = exporter.onTick(0, store);

    const enemy = snapshot?.entities.find((e) => e.kind === 'enemy');
    expect(enemy).toBeDefined();
    if (enemy?.kind !== 'enemy') throw new Error('expected enemy snapshot');
    expect(enemy.archetypeId).toBe(TRAINING_TARGET.id);
    expect(enemy.hp).toBe(TRAINING_TARGET.maxHp);
    expect(enemy.maxHp).toBe(TRAINING_TARGET.maxHp);

    const projectile = snapshot?.entities.find((e) => e.kind === 'projectile');
    expect(projectile).toBeDefined();
    if (projectile?.kind !== 'projectile') throw new Error('expected projectile snapshot');
    expect(projectile.weaponArchetypeId).toBe(PISTOL.id);
    expect(projectile.ownerKind).toBe('player');
  });

  it('omits removed entities (no tombstones in entities)', () => {
    const store = createEntityStore();
    const enemy = store.spawnEnemy({
      archetypeId: TRAINING_TARGET.id,
      position: { x: 0, y: 0 },
      radius: TRAINING_TARGET.radius,
      behavior: 'stationary',
      maxHp: 1,
      color: TRAINING_TARGET.color
    });
    const exporter = createSnapshotExportSystem();

    expect(exporter.onTick(0, store)?.entities).toHaveLength(1);

    store.removeEnemy(enemy.id);
    exporter.reset();

    const after = exporter.onTick(0, store);
    expect(after?.entities).toHaveLength(0);
  });
});
