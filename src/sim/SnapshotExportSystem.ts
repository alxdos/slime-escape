import { SIM_STEP_MS, SNAPSHOT_INTERVAL_MS } from '../shared/timing';
import type { World } from './world';
import type { Snapshot } from '../shared/snapshot';

const TICKS_PER_SNAPSHOT = Math.round(SNAPSHOT_INTERVAL_MS / SIM_STEP_MS);

export type SnapshotExportSystem = Readonly<{
  onTick(simTimeMs: number, world: World): Snapshot | null;
  reset(): void;
}>;

export function createSnapshotExportSystem(): SnapshotExportSystem {
  let tickCount = 0;
  return {
    onTick(simTimeMs, world): Snapshot | null {
      const shouldEmit = tickCount % TICKS_PER_SNAPSHOT === 0;
      tickCount++;
      if (!shouldEmit) return null;
      return {
        simTimeMs,
        entities: [
          {
            id: world.testEntity.id,
            kind: 'player',
            x: world.testEntity.x,
            y: world.testEntity.y
          }
        ]
      };
    },
    reset(): void {
      tickCount = 0;
    }
  };
}
