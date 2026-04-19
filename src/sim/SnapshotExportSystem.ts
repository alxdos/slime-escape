import type { EntitySnapshot, Snapshot } from '../shared/snapshot';
import { SIM_STEP_MS, SNAPSHOT_INTERVAL_MS } from '../shared/timing';

import type { EntityStore } from './EntityStore';

const TICKS_PER_SNAPSHOT = Math.round(SNAPSHOT_INTERVAL_MS / SIM_STEP_MS);

export type SnapshotExportSystem = Readonly<{
  onTick(simTimeMs: number, store: EntityStore): Snapshot | null;
  reset(): void;
}>;

export function createSnapshotExportSystem(): SnapshotExportSystem {
  let tickCount = 0;
  return {
    onTick(simTimeMs, store): Snapshot | null {
      const shouldEmit = tickCount % TICKS_PER_SNAPSHOT === 0;
      tickCount += 1;
      if (!shouldEmit) return null;
      const entities: EntitySnapshot[] = [];
      const player = store.player();
      if (player !== null) {
        entities.push({
          id: player.id,
          kind: 'player',
          x: player.position.x,
          y: player.position.y
        });
      }
      for (const enemy of store.enemies()) {
        entities.push({
          id: enemy.id,
          kind: 'enemy',
          archetypeId: enemy.archetypeId,
          x: enemy.position.x,
          y: enemy.position.y,
          hp: enemy.hp,
          maxHp: enemy.maxHp
        });
      }
      for (const projectile of store.projectiles()) {
        entities.push({
          id: projectile.id,
          kind: 'projectile',
          weaponArchetypeId: projectile.weaponArchetypeId,
          ownerKind: projectile.ownerKind,
          x: projectile.position.x,
          y: projectile.position.y
        });
      }
      return { simTimeMs, entities };
    },
    reset(): void {
      tickCount = 0;
    }
  };
}
