import type {
  BossHudSnapshot,
  EncounterSnapshot,
  EntitySnapshot,
  PlayerStatusEffectSnapshot,
  Snapshot,
  WeaponHudSnapshot,
  WeaponTimedEffectHudSnapshot,
  WaveProgressSnapshot,
  ZoneSnapshot
} from '../snapshot.js';
import { WEAPON_ARCHETYPES, type WeaponModifier } from '../content/weapons.js';
import { assertNever } from '../protocol.js';
import { SIM_STEP_MS, SNAPSHOT_INTERVAL_MS } from '../timing.js';

import type { EntityId, EntityStore } from './EntityStore.js';
import type { ActorStatusEffect } from './EntityStore.js';
import type { EncounterContext } from './SessionFlowSystem.js';

const TICKS_PER_SNAPSHOT = Math.round(SNAPSHOT_INTERVAL_MS / SIM_STEP_MS);

export type SnapshotSources = Readonly<{
  encounter: EncounterContext | null;
  zone: ZoneSnapshot;
  waveProgress: WaveProgressSnapshot | null;
  weaponHudFor(playerId: EntityId): WeaponHudSnapshot | null;
  lastInputSequence?: Readonly<Record<string, number>>;
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
      for (const player of store.players()) {
        entities.push({
          id: player.id,
          kind: 'player',
          playerId: player.playerId,
          x: player.position.x,
          y: player.position.y,
          hp: player.hp,
          maxHp: player.maxHp,
          state: player.state,
          formArchetypeId: player.formArchetypeId,
          weaponHud:
            player.state === 'alive' ? copyWeaponHud(sources.weaponHudFor(player.id)) : null,
          statusEffects: copyPlayerStatusEffects(player.statusEffects, simTimeMs)
        });
      }
      for (const companion of store.companions()) {
        entities.push({
          id: companion.id,
          kind: 'companion',
          ownerPlayerId: companion.ownerPlayerId,
          petArchetypeId: companion.petArchetypeId,
          x: companion.position.x,
          y: companion.position.y,
          hp: companion.hp,
          maxHp: companion.maxHp,
          state: companion.state,
          mode: companion.mode,
          rescueProgress:
            companion.mode === 'rescue'
              ? clampRatio(companion.rescueProgressMs / companion.rescue.durationMs)
              : null,
          targetId: companion.targetId
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
          carrierDropMarker: enemy.carrierDropMarker,
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
          ownerId: projectile.ownerId,
          originX: projectile.origin.x,
          originY: projectile.origin.y,
          x: projectile.position.x,
          y: projectile.position.y,
          size: { width: projectile.size.width, height: projectile.size.height },
          state: projectile.state,
          visualState: projectileVisualState(projectile, simTimeMs),
          explosionRadius: projectile.explosion?.radius ?? null,
          detonateAtSimMs: projectile.detonateAtSimMs,
          arcEnd: projectile.state === 'flying' ? projectile.arcEnd : null,
          spawnInputSequence: projectile.spawnInputSequence
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
        lastInputSequence: { ...(sources.lastInputSequence ?? {}) }
      };
    },
    reset(): void {
      tickCount = 0;
    }
  };
}

function copyWeaponModifier(modifier: WeaponModifier): WeaponModifier {
  switch (modifier.kind) {
    case 'projectileSizeMultiplier':
      return { kind: modifier.kind, multiplier: modifier.multiplier };
    case 'projectileSpeedMultiplier':
      return { kind: modifier.kind, multiplier: modifier.multiplier };
    case 'symmetricProjectileMultiplier':
      return { kind: modifier.kind, multiplier: modifier.multiplier };
    case 'pierceBonus':
      return { kind: modifier.kind, amount: modifier.amount };
    case 'fragmentExplosion':
      return {
        kind: modifier.kind,
        fragmentWeaponArchetypeId: modifier.fragmentWeaponArchetypeId,
        count: modifier.count,
        spreadRadians: modifier.spreadRadians
      };
    default:
      return assertNever(modifier);
  }
}

function copyWeaponHud(source: WeaponHudSnapshot | null): WeaponHudSnapshot | null {
  if (source === null) return null;
  return {
    selectedIndex: source.selectedIndex,
    weapons: source.weapons.map((weapon) => ({
      index: weapon.index,
      weaponArchetypeId: weapon.weaponArchetypeId,
      cooldownStartedAtSimMs: weapon.cooldownStartedAtSimMs,
      cooldownReadyAtSimMs: weapon.cooldownReadyAtSimMs,
      modifiers: weapon.modifiers.map(copyWeaponModifier),
      timedEffects: weapon.timedEffects.map(copyTimedWeaponEffect)
    }))
  };
}

function copyTimedWeaponEffect(
  effect: WeaponTimedEffectHudSnapshot
): WeaponTimedEffectHudSnapshot {
  return {
    kind: effect.kind,
    cooldownMultiplier: effect.cooldownMultiplier,
    startedAtSimMs: effect.startedAtSimMs,
    expiresAtSimMs: effect.expiresAtSimMs
  };
}

function copyPlayerStatusEffects(
  effects: ReadonlyArray<ActorStatusEffect>,
  simTimeMs: number
): ReadonlyArray<PlayerStatusEffectSnapshot> {
  const active: PlayerStatusEffectSnapshot[] = [];
  for (const effect of effects) {
    if (effect.expireAtSimMs <= simTimeMs) continue;
    switch (effect.kind) {
      case 'slow':
        active.push({
          kind: 'slow',
          speedMultiplier: effect.speedMultiplier,
          expireAtSimMs: effect.expireAtSimMs
        });
        break;
      case 'burn':
      case 'poison':
        active.push({ kind: effect.kind, expireAtSimMs: effect.expireAtSimMs });
        break;
      default:
        assertNever(effect);
    }
  }
  return active;
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

function clampRatio(value: number): number {
  return Math.max(0, Math.min(1, value));
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
    elapsedMs: Math.max(0, Math.round(simTimeMs - context.startSimMs)),
    waveOrdinal: context.waveOrdinal
  };
}
