import {
  DROP_ARCHETYPES,
  type DropArchetype,
  type DropEffect,
  type PickupModifier
} from '../content/drops';
import { ENEMY_ARCHETYPES, type EnemyArchetype } from '../content/enemies';
import type { WeaponModifier } from '../content/weapons';
import type { RuntimeEvent } from '../events';
import { log } from '../log';
import { assertNever } from '../protocol';
import type { Rng } from '../rng';
import { SIM_STEP_MS } from '../timing';

import type { Companion, EntityId, EntityStore } from './EntityStore';
import type { DeathContext } from './HealthDeathSystem';

export type DropSystem = Readonly<{
  setRng(rng: Rng | null): void;
  clear(): void;
  onDeathHook(ctx: DeathContext, store: EntityStore, emit: (event: RuntimeEvent) => void): void;
  tick(simTimeMs: number, store: EntityStore, emit: (event: RuntimeEvent) => void): void;
}>;

export type WeaponDropEffectSink = Readonly<{
  addModifierToSelectedWeapon(ownerId: EntityId, modifier: WeaponModifier): void;
  applyTemporaryOverdriveToSelectedWeapon(
    ownerId: EntityId,
    cooldownMultiplier: number,
    durationMs: number,
    simTimeMs: number
  ): void;
}>;

export type DropPickupFact = Readonly<{
  entityId: EntityId;
  archetypeId: string;
  pickerId: EntityId;
  simTime: number;
}>;

export type DropPickupObserver = (fact: DropPickupFact) => void;

export function createDropSystem(
  enemyRegistry: Readonly<Record<string, EnemyArchetype>> = ENEMY_ARCHETYPES,
  dropRegistry: Readonly<Record<string, DropArchetype>> = DROP_ARCHETYPES,
  weaponEffects: WeaponDropEffectSink | null = null,
  onPickup: DropPickupObserver | null = null
): DropSystem {
  let rng: Rng | null = null;
  const pickupModifiers = new Map<EntityId, PickupModifier>();

  return {
    setRng(next): void {
      rng = next;
    },
    clear(): void {
      rng = null;
      pickupModifiers.clear();
    },
    onDeathHook(ctx, store, emit): void {
      if (ctx.entityKind !== 'enemy') return;
      if (ctx.archetypeId !== null && enemyRegistry[ctx.archetypeId] === undefined) {
        log.error('drop hook: unknown enemy archetype on death', {
          enemyArchetypeId: ctx.archetypeId,
          entityId: ctx.entityId
        });
      }

      const enemy = store.enemyById(ctx.entityId);
      if (enemy === null) {
        log.error('drop hook: missing runtime enemy on death', {
          entityId: ctx.entityId,
          enemyArchetypeId: ctx.archetypeId
        });
        return;
      }

      spawnGuaranteedDrops(enemy.guaranteedDrops, ctx, store, emit, dropRegistry);

      if (enemy.dropTable.length === 0) return;
      if (rng === null) throw new Error('drop hook fired without a session Rng (see design/rng.md)');

      const roll = rng.nextFloat();
      const picked = pickDropFromTable(enemy.dropTable, roll, dropRegistry);
      if (picked === null) return;

      spawnDropAtDeath(picked, ctx, store, emit);
    },
    tick(simTimeMs, store, emit): void {
      const expired = new Set<EntityId>();
      const pickedUp = new Set<EntityId>();

      for (const drop of store.drops()) {
        if (simTimeMs >= drop.expireAtSimMs) {
          expired.add(drop.id);
          emit({
            kind: 'dropExpire',
            simTime: simTimeMs,
            entityId: drop.id,
            archetypeId: drop.archetypeId,
            x: drop.position.x,
            y: drop.position.y
          });
        }
      }

      const player = store.player();
      if (player !== null) {
        attractDropsToPlayer(store, player.id, player.position, player.radius, pickupModifiers);
        const activeModifier = pickupModifiers.get(player.id) ?? null;
        for (const drop of store.drops()) {
          if (expired.has(drop.id)) continue;
          const dx = drop.position.x - player.position.x;
          const dy = drop.position.y - player.position.y;
          const reach = pickupReach(drop.radius + player.radius, activeModifier);
          if (dx * dx + dy * dy > reach * reach) continue;

          applyDropEffect(
            drop.effect,
            player.id,
            store,
            simTimeMs,
            weaponEffects,
            pickupModifiers
          );
          pickedUp.add(drop.id);
          onPickup?.({
            entityId: drop.id,
            archetypeId: drop.archetypeId,
            pickerId: player.id,
            simTime: simTimeMs
          });
          emit({
            kind: 'dropPickup',
            simTime: simTimeMs,
            entityId: drop.id,
            archetypeId: drop.archetypeId,
            pickerId: player.id,
            x: drop.position.x,
            y: drop.position.y
          });
        }
      }

      const companion = store.companion();
      if (isCompanionHealPickupEligible(companion)) {
        const companionRadius = bodyRadius(companion.contactBox);
        for (const drop of store.drops()) {
          if (expired.has(drop.id) || pickedUp.has(drop.id)) continue;
          if (drop.effect.kind !== 'heal') continue;
          const dx = drop.position.x - companion.position.x;
          const dy = drop.position.y - companion.position.y;
          const reach = companionRadius + drop.radius;
          if (dx * dx + dy * dy > reach * reach) continue;

          applyDropEffect(
            drop.effect,
            companion.id,
            store,
            simTimeMs,
            weaponEffects,
            pickupModifiers
          );
          pickedUp.add(drop.id);
          onPickup?.({
            entityId: drop.id,
            archetypeId: drop.archetypeId,
            pickerId: companion.id,
            simTime: simTimeMs
          });
          emit({
            kind: 'dropPickup',
            simTime: simTimeMs,
            entityId: drop.id,
            archetypeId: drop.archetypeId,
            pickerId: companion.id,
            x: drop.position.x,
            y: drop.position.y
          });
          if (companion.hp >= companion.maxHp) break;
        }
      }

      for (const id of expired) store.removeDrop(id);
      for (const id of pickedUp) store.removeDrop(id);
    }
  };
}

function pickDropFromTable(
  table: ReadonlyArray<{ archetypeId: string; chance: number }>,
  roll: number,
  dropRegistry: Readonly<Record<string, DropArchetype>>
): DropArchetype | null {
  let accumulated = 0;
  for (const entry of table) {
    accumulated += entry.chance;
    if (roll < accumulated) {
      const archetype = dropRegistry[entry.archetypeId];
      if (archetype === undefined) {
        // design/drops.md and design/content-archetypes.md require unknown
        // archetype ids to fail at session build, never at runtime; reaching
        // here means the builder-side assert was bypassed.
        throw new Error(
          `drop table references unknown drop archetype at runtime: "${entry.archetypeId}" ` +
            `(see design/drops.md and design/content-archetypes.md)`
        );
      }
      return archetype;
    }
  }
  return null;
}

function spawnGuaranteedDrops(
  guaranteedDrops: ReadonlyArray<string>,
  ctx: DeathContext,
  store: EntityStore,
  emit: (event: RuntimeEvent) => void,
  dropRegistry: Readonly<Record<string, DropArchetype>>
): void {
  for (const archetypeId of guaranteedDrops) {
    const drop = dropRegistry[archetypeId];
    if (drop === undefined) {
      log.error('guaranteed drop references unknown drop archetype at runtime', {
        dropArchetypeId: archetypeId,
        entityId: ctx.entityId
      });
      continue;
    }
    spawnDropAtDeath(drop, ctx, store, emit);
  }
}

function spawnDropAtDeath(
  picked: DropArchetype,
  ctx: DeathContext,
  store: EntityStore,
  emit: (event: RuntimeEvent) => void
): void {
  const drop = store.spawnDrop({
    archetypeId: picked.id,
    position: { x: ctx.position.x, y: ctx.position.y },
    radius: picked.radius,
    effect: picked.effect,
    color: picked.color,
    expireAtSimMs: ctx.simTime + picked.ttlMs
  });

  emit({
    kind: 'dropSpawn',
    simTime: ctx.simTime,
    entityId: drop.id,
    archetypeId: drop.archetypeId,
    x: drop.position.x,
    y: drop.position.y
  });
}

function attractDropsToPlayer(
  store: EntityStore,
  playerId: EntityId,
  playerPosition: Readonly<{ x: number; y: number }>,
  playerRadius: number,
  pickupModifiers: ReadonlyMap<EntityId, PickupModifier>
): void {
  const modifier = pickupModifiers.get(playerId);
  if (modifier === undefined) return;
  const stepDistance = modifier.attractSpeed * (SIM_STEP_MS / 1000);
  if (stepDistance <= 0) return;
  for (const drop of store.drops()) {
    const dx = playerPosition.x - drop.position.x;
    const dy = playerPosition.y - drop.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0) continue;
    const baseReach = drop.radius + playerRadius;
    const attractionReach = pickupReach(baseReach, modifier) + stepDistance * 2;
    if (distance > attractionReach) continue;
    const move = Math.min(stepDistance, Math.max(0, distance - baseReach));
    drop.position.x += (dx / distance) * move;
    drop.position.y += (dy / distance) * move;
  }
}

function pickupReach(baseReach: number, modifier: PickupModifier | null): number {
  return modifier === null ? baseReach : baseReach * modifier.pickupRadiusMultiplier;
}

function isCompanionHealPickupEligible(companion: Companion | null): companion is Companion {
  return companion !== null && companion.state === 'alive' && companion.hp < companion.maxHp;
}

function bodyRadius(contactBox: Readonly<{ width: number; height: number }>): number {
  return Math.max(contactBox.width, contactBox.height) / 2;
}

function applyDropEffect(
  effect: DropEffect,
  pickerId: EntityId,
  store: EntityStore,
  simTimeMs: number,
  weaponEffects: WeaponDropEffectSink | null,
  pickupModifiers: Map<EntityId, PickupModifier>
): void {
  switch (effect.kind) {
    case 'heal': {
      const player = store.player();
      if (player !== null && player.id === pickerId) {
        player.hp = Math.min(player.maxHp, player.hp + effect.amount);
        return;
      }
      const companion = store.companionById(pickerId);
      if (companion === null || companion.state !== 'alive' || companion.hp >= companion.maxHp) {
        return;
      }
      companion.hp = Math.min(companion.maxHp, companion.hp + effect.amount);
      return;
    }
    case 'addWeaponModifier': {
      const player = store.player();
      if (player === null || player.id !== pickerId) return;
      weaponEffects?.addModifierToSelectedWeapon(player.id, effect.modifier);
      return;
    }
    case 'temporaryOverdrive': {
      const player = store.player();
      if (player === null || player.id !== pickerId) return;
      weaponEffects?.applyTemporaryOverdriveToSelectedWeapon(
        player.id,
        effect.cooldownMultiplier,
        effect.durationMs,
        simTimeMs
      );
      return;
    }
    case 'pickupModifier': {
      const player = store.player();
      if (player === null || player.id !== pickerId) return;
      pickupModifiers.set(
        player.id,
        mergePickupModifier(pickupModifiers.get(player.id), effect.modifier)
      );
      return;
    }
    default:
      assertNever(effect);
  }
}

function mergePickupModifier(
  current: PickupModifier | undefined,
  next: PickupModifier
): PickupModifier {
  if (current === undefined) return next;
  switch (next.kind) {
    case 'dropMagnet':
      return {
        kind: 'dropMagnet',
        pickupRadiusMultiplier: Math.max(
          current.pickupRadiusMultiplier,
          next.pickupRadiusMultiplier
        ),
        attractSpeed: Math.max(current.attractSpeed, next.attractSpeed)
      };
  }
}
