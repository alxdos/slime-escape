import { describe, expect, it } from 'vitest';

import { TRAINING_TARGET } from '../shared/content/enemies';
import { PISTOL } from '../shared/content/weapons';
import type { ZoneSnapshot } from '../shared/snapshot';
import { SIM_STEP_MS, SNAPSHOT_INTERVAL_MS } from '../shared/timing';

import { createEntityStore } from './EntityStore';
import type { EncounterContext } from './SessionFlowSystem';
import { createSnapshotExportSystem, type SnapshotSources } from './SnapshotExportSystem';

const TICKS_PER_SNAPSHOT = Math.round(SNAPSHOT_INTERVAL_MS / SIM_STEP_MS);
const IDLE_ZONE: ZoneSnapshot = { mode: 'disabled', margin: 0 };
const NO_SOURCES: SnapshotSources = {
  encounter: null,
  zone: IDLE_ZONE,
  waveProgress: null
};

describe('SnapshotExportSystem', () => {
  it('emits the player entity with kind "player"', () => {
    const store = createEntityStore();
    store.spawnPlayer({ position: { x: 3, y: -2 }, radius: 0.5, maxSpeed: 6, maxHp: 1 });
    const exporter = createSnapshotExportSystem();

    const snapshot = exporter.onTick(0, store, NO_SOURCES);

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

    const snapshot = exporter.onTick(0, store, NO_SOURCES);

    expect(snapshot?.entities).toHaveLength(0);
  });

  it('emits exactly once per TICKS_PER_SNAPSHOT', () => {
    const store = createEntityStore();
    store.spawnPlayer({ position: { x: 0, y: 0 }, radius: 0.5, maxSpeed: 6, maxHp: 1 });
    const exporter = createSnapshotExportSystem();

    let emitted = 0;
    for (let tick = 0; tick < TICKS_PER_SNAPSHOT * 3; tick += 1) {
      const snapshot = exporter.onTick(tick * SIM_STEP_MS, store, NO_SOURCES);
      if (snapshot !== null) emitted += 1;
    }

    expect(emitted).toBe(3);
  });

  it('reset() restores the cadence so the next call emits', () => {
    const store = createEntityStore();
    store.spawnPlayer({ position: { x: 0, y: 0 }, radius: 0.5, maxSpeed: 6, maxHp: 1 });
    const exporter = createSnapshotExportSystem();

    exporter.onTick(0, store, NO_SOURCES);
    expect(exporter.onTick(SIM_STEP_MS, store, NO_SOURCES)).toBeNull();

    exporter.reset();
    expect(exporter.onTick(SIM_STEP_MS, store, NO_SOURCES)).not.toBeNull();
  });

  it('emits enemy with archetypeId/hp/maxHp and projectile with weaponArchetypeId/ownerKind', () => {
    const store = createEntityStore();
    store.spawnEnemy({
      archetypeId: TRAINING_TARGET.id,
      position: { x: 5, y: 0 },
      radius: TRAINING_TARGET.radius,
      behavior: 'stationary',
      maxHp: TRAINING_TARGET.maxHp,
      maxSpeed: TRAINING_TARGET.maxSpeed,
      contactDamage: TRAINING_TARGET.contactDamage,
      contactCooldownMs: TRAINING_TARGET.contactCooldownMs,
      knockbackBaseImpulse: TRAINING_TARGET.knockbackBaseImpulse,
      knockbackVelocityScale: TRAINING_TARGET.knockbackVelocityScale,
      knockbackDurationMs: TRAINING_TARGET.knockbackDurationMs,
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
    const snapshot = exporter.onTick(0, store, NO_SOURCES);

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
      maxSpeed: TRAINING_TARGET.maxSpeed,
      contactDamage: TRAINING_TARGET.contactDamage,
      contactCooldownMs: TRAINING_TARGET.contactCooldownMs,
      knockbackBaseImpulse: TRAINING_TARGET.knockbackBaseImpulse,
      knockbackVelocityScale: TRAINING_TARGET.knockbackVelocityScale,
      knockbackDurationMs: TRAINING_TARGET.knockbackDurationMs,
      color: TRAINING_TARGET.color
    });
    const exporter = createSnapshotExportSystem();

    expect(exporter.onTick(0, store, NO_SOURCES)?.entities).toHaveLength(1);

    store.removeEnemy(enemy.id);
    exporter.reset();

    const after = exporter.onTick(0, store, NO_SOURCES);
    expect(after?.entities).toHaveLength(0);
  });
});

describe('SnapshotExportSystem top-level fields', () => {
  function spawnPlayerAt(store: ReturnType<typeof createEntityStore>) {
    return store.spawnPlayer({
      position: { x: 0, y: 0 },
      radius: 0.5,
      maxSpeed: 6,
      maxHp: 5
    });
  }

  it('emits PlayerSnapshot.hp/maxHp from EntityStore', () => {
    const store = createEntityStore();
    const player = spawnPlayerAt(store);
    player.hp = 3;
    const exporter = createSnapshotExportSystem();
    const snap = exporter.onTick(0, store, NO_SOURCES);
    const playerSnap = snap?.entities.find((e) => e.kind === 'player');
    if (playerSnap?.kind !== 'player') throw new Error('expected player snapshot');
    expect(playerSnap.hp).toBe(3);
    expect(playerSnap.maxHp).toBe(5);
  });

  it('encounter is null without a session and reflects context.elapsedMs otherwise', () => {
    const store = createEntityStore();
    spawnPlayerAt(store);
    const exporter = createSnapshotExportSystem();

    expect(exporter.onTick(0, store, NO_SOURCES)?.encounter).toBeNull();

    const ctx: EncounterContext = {
      encounter: {
        id: 'wave-1',
        type: 'wave',
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'never', next: 'sequential' },
        tuning: null
      },
      index: 2,
      startSimMs: 1000
    };
    exporter.reset();
    const snap = exporter.onTick(1500, store, {
      encounter: ctx,
      zone: IDLE_ZONE,
      waveProgress: null
    });
    expect(snap?.encounter).toEqual({
      id: 'wave-1',
      type: 'wave',
      index: 2,
      elapsedMs: 500
    });
  });

  it('zone is copied verbatim into the snapshot', () => {
    const store = createEntityStore();
    spawnPlayerAt(store);
    const exporter = createSnapshotExportSystem();
    const snap = exporter.onTick(0, store, {
      encounter: null,
      zone: { mode: 'shrink', margin: 2.5 },
      waveProgress: null
    });
    expect(snap?.zone).toEqual({ mode: 'shrink', margin: 2.5 });
  });

  it('waveProgress passes through and is null when source is null', () => {
    const store = createEntityStore();
    spawnPlayerAt(store);
    const exporter = createSnapshotExportSystem();

    const snapWithoutWave = exporter.onTick(0, store, NO_SOURCES);
    expect(snapWithoutWave?.waveProgress).toBeNull();

    exporter.reset();
    const snapWithWave = exporter.onTick(0, store, {
      encounter: null,
      zone: IDLE_ZONE,
      waveProgress: { dispatched: 3, total: 5, alive: 2 }
    });
    expect(snapWithWave?.waveProgress).toEqual({ dispatched: 3, total: 5, alive: 2 });
  });
});
