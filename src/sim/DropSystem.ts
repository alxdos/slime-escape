import { DROP_ARCHETYPES, type DropArchetype, type DropEffect } from '../shared/content/drops';
import { ENEMY_ARCHETYPES, type EnemyArchetype } from '../shared/content/enemies';
import type { WeaponModifier } from '../shared/content/weapons';
import type { RuntimeEvent } from '../shared/events';
import { log } from '../shared/log';
import { assertNever } from '../shared/protocol';
import type { Rng } from '../shared/rng';

import type { EntityId, EntityStore } from './EntityStore';
import type { DeathContext } from './HealthDeathSystem';

export type DropSystem = Readonly<{
  setRng(rng: Rng | null): void;
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

export function createDropSystem(
  enemyRegistry: Readonly<Record<string, EnemyArchetype>> = ENEMY_ARCHETYPES,
  dropRegistry: Readonly<Record<string, DropArchetype>> = DROP_ARCHETYPES,
  weaponEffects: WeaponDropEffectSink | null = null
): DropSystem {
  let rng: Rng | null = null;

  return {
    setRng(next): void {
      rng = next;
    },
    onDeathHook(ctx, store, emit): void {
      if (ctx.entityKind !== 'enemy') return;
      if (ctx.archetypeId === null) return;

      const enemyArchetype = enemyRegistry[ctx.archetypeId];
      if (enemyArchetype === undefined) {
        log.error('drop hook: unknown enemy archetype on death', {
          enemyArchetypeId: ctx.archetypeId,
          entityId: ctx.entityId
        });
        return;
      }

      if (enemyArchetype.dropTable.length === 0) return;

      if (rng === null) {
        throw new Error('drop hook fired without a session Rng (see design/rng.md)');
      }

      const roll = rng.nextFloat();
      const picked = pickDropFromTable(enemyArchetype.dropTable, roll, dropRegistry);
      if (picked === null) return;

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
        for (const drop of store.drops()) {
          if (expired.has(drop.id)) continue;
          const dx = drop.position.x - player.position.x;
          const dy = drop.position.y - player.position.y;
          const reach = drop.radius + player.radius;
          if (dx * dx + dy * dy > reach * reach) continue;

          applyDropEffect(drop.effect, store, simTimeMs, weaponEffects);
          pickedUp.add(drop.id);
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

function applyDropEffect(
  effect: DropEffect,
  store: EntityStore,
  simTimeMs: number,
  weaponEffects: WeaponDropEffectSink | null
): void {
  switch (effect.kind) {
    case 'heal': {
      const player = store.player();
      if (player === null) return;
      player.hp = Math.min(player.maxHp, player.hp + effect.amount);
      return;
    }
    case 'addWeaponModifier': {
      const player = store.player();
      if (player === null) return;
      weaponEffects?.addModifierToSelectedWeapon(player.id, effect.modifier);
      return;
    }
    case 'temporaryOverdrive': {
      const player = store.player();
      if (player === null) return;
      weaponEffects?.applyTemporaryOverdriveToSelectedWeapon(
        player.id,
        effect.cooldownMultiplier,
        effect.durationMs,
        simTimeMs
      );
      return;
    }
    case 'pickupModifier':
      return;
    default:
      assertNever(effect);
  }
}
