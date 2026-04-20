import type {
  EncounterSnapshot,
  EntitySnapshot,
  Snapshot,
  WaveProgressSnapshot,
  ZoneSnapshot
} from '../shared/snapshot';
import { SIM_STEP_MS, SNAPSHOT_INTERVAL_MS } from '../shared/timing';

import type { EntityStore } from './EntityStore';
import type { EncounterContext } from './SessionFlowSystem';

const TICKS_PER_SNAPSHOT = Math.round(SNAPSHOT_INTERVAL_MS / SIM_STEP_MS);

export type SnapshotSources = Readonly<{
  encounter: EncounterContext | null;
  zone: ZoneSnapshot;
  waveProgress: WaveProgressSnapshot | null;
}>;

export type SnapshotExportSystem = Readonly<{
  onTick(simTimeMs: number, store: EntityStore, sources: SnapshotSources): Snapshot | null;
  reset(): void;
}>;

export function createSnapshotExportSystem(): SnapshotExportSystem {
  let tickCount = 0;
  return {
    onTick(simTimeMs, store, sources): Snapshot | null {
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
          y: player.position.y,
          hp: player.hp,
          maxHp: player.maxHp
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
      for (const drop of store.drops()) {
        entities.push({
          id: drop.id,
          kind: 'drop',
          archetypeId: drop.archetypeId,
          x: drop.position.x,
          y: drop.position.y
        });
      }
      return {
        simTimeMs,
        entities,
        encounter: makeEncounterSnapshot(sources.encounter, simTimeMs),
        zone: { mode: sources.zone.mode, margin: sources.zone.margin },
        waveProgress:
          sources.waveProgress === null
            ? null
            : {
                dispatched: sources.waveProgress.dispatched,
                total: sources.waveProgress.total,
                alive: sources.waveProgress.alive
              },
        bossHud: null
      };
    },
    reset(): void {
      tickCount = 0;
    }
  };
}

function makeEncounterSnapshot(
  context: EncounterContext | null,
  simTimeMs: number
): EncounterSnapshot | null {
  if (context === null) return null;
  return {
    id: context.encounter.id,
    type: context.encounter.type,
    index: context.index,
    elapsedMs: Math.max(0, Math.round(simTimeMs - context.startSimMs))
  };
}
