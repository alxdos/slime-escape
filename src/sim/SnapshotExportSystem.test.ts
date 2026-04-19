import { describe, expect, it } from 'vitest';

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
});
