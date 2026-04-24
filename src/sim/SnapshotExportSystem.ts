import type {
  BossHudSnapshot,
  EncounterSnapshot,
  EntitySnapshot,
  Snapshot,
  WeaponHudSnapshot,
  WaveProgressSnapshot,
  ZoneSnapshot
} from '../shared/snapshot';
import { WEAPON_ARCHETYPES } from '../shared/content/weapons';
import { SIM_STEP_MS, SNAPSHOT_INTERVAL_MS } from '../shared/timing';

import type { EntityStore } from './EntityStore';
import type { EncounterContext } from './SessionFlowSystem';

const TICKS_PER_SNAPSHOT = Math.round(SNAPSHOT_INTERVAL_MS / SIM_STEP_MS);

export type SnapshotSources = Readonly<{
  encounter: EncounterContext | null;
  zone: ZoneSnapshot;
  waveProgress: WaveProgressSnapshot | null;
  weaponHud: WeaponHudSnapshot | null;
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
          maxHp: player.maxHp,
          statusEffects: player.statusEffects.map((effect) => ({
            kind: effect.kind,
            expiresAtSimMs: effect.expireAtSimMs
          }))
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
          maxHp: enemy.maxHp,
          statusEffects: enemy.statusEffects.map((effect) => ({
            kind: effect.kind,
            expiresAtSimMs: effect.expireAtSimMs
          }))
        });
      }
      for (const projectile of store.projectiles()) {
        entities.push({
          id: projectile.id,
          kind: 'projectile',
          weaponArchetypeId: projectile.weaponArchetypeId,
          ownerKind: projectile.ownerKind,
          x: projectile.position.x,
          y: projectile.position.y,
          state: projectile.state,
          visualState: projectileVisualState(projectile, simTimeMs),
          explosionRadius: projectile.explosion?.radius ?? null,
          detonateAtSimMs: projectile.detonateAtSimMs
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
      for (const fieldEffect of store.fieldEffects()) {
        entities.push({
          id: fieldEffect.id,
          kind: 'fieldEffect',
          archetypeId: fieldEffect.archetypeId,
          x: fieldEffect.position.x,
          y: fieldEffect.position.y,
          radius: fieldEffect.radius,
          expiresAtSimMs: fieldEffect.expireAtSimMs
        });
      }
      let bossHud: BossHudSnapshot | null = null;
      for (const boss of store.bosses()) {
        entities.push({
          id: boss.id,
          kind: 'boss',
          archetypeId: boss.archetypeId,
          x: boss.position.x,
          y: boss.position.y,
          hp: boss.hp,
          maxHp: boss.maxHp,
          phaseIndex: boss.phaseIndex,
          phaseId: boss.phaseId,
          activeAttackIds: boss.activeAttackIds,
          statusEffects: boss.statusEffects.map((effect) => ({
            kind: effect.kind,
            expiresAtSimMs: effect.expireAtSimMs
          }))
        });
        if (bossHud === null) {
          bossHud = {
            entityId: boss.id,
            phaseIndex: boss.phaseIndex,
            phaseId: boss.phaseId,
            hp: boss.hp,
            maxHp: boss.maxHp,
            activeAttackIds: boss.activeAttackIds
          };
        }
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
        bossHud,
        weaponHud:
          sources.weaponHud === null
            ? null
            : {
                selectedIndex: sources.weaponHud.selectedIndex,
                weapons: sources.weaponHud.weapons.map((weapon) => ({
                  index: weapon.index,
                  weaponArchetypeId: weapon.weaponArchetypeId,
                  cooldownReadyAtSimMs: weapon.cooldownReadyAtSimMs,
                  overdriveUntilSimMs: weapon.overdriveUntilSimMs
                }))
              }
      };
    },
    reset(): void {
      tickCount = 0;
    }
  };
}

function projectileVisualState(
  projectile: { weaponArchetypeId: string; velocity: { vx: number; vy: number } },
  simTimeMs: number
): { angleRadians: number; spinRadians: number; pulsePhase: number } {
  const archetype = WEAPON_ARCHETYPES[projectile.weaponArchetypeId];
  const visual = archetype?.projectile.visual;
  const speed = Math.hypot(projectile.velocity.vx, projectile.velocity.vy);
  const angleRadians = speed === 0 ? 0 : Math.atan2(projectile.velocity.vy, projectile.velocity.vx);
  const spinRadians = ((visual?.spinRadiansPerSec ?? 0) * simTimeMs) / 1000;
  const pulsePhase = (((simTimeMs % 1000) + 1000) % 1000) / 1000;
  return { angleRadians, spinRadians, pulsePhase };
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
