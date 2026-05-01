import type { ActorEffectApplication } from '../content/weapons.js';
import type { DamageRules } from '../session.js';

import type { DamageIntent } from './CombatSystem.js';
import { canDamageTarget, DEFAULT_DAMAGE_RULES, type DamageableEntity } from './DamageRules.js';
import type { EntityId, EntityStore, FieldEffect } from './EntityStore.js';
import type { IndexedEntity, SpatialIndex } from './SpatialIndex.js';

export type ActorEffectIntent = Readonly<{
  targetId: EntityId;
  source: ActorEffectSource;
  application: ActorEffectApplication;
}>;

export type ActorEffectSource =
  | Readonly<{
      kind: 'fieldEffect';
      fieldEffectId: EntityId;
      archetypeId: string;
    }>
  | Readonly<{
      kind: 'explosion';
      projectileId: EntityId;
      weaponArchetypeId: string;
    }>;

export type FieldEffectTickResult = Readonly<{
  damageIntents: ReadonlyArray<DamageIntent>;
  actorEffectIntents: ReadonlyArray<ActorEffectIntent>;
}>;

export type FieldEffectSystem = Readonly<{
  setDamageRules(rules: DamageRules): void;
  tick(simTimeMs: number, store: EntityStore, index: SpatialIndex): FieldEffectTickResult;
  clear(): void;
}>;

export function createFieldEffectSystem(): FieldEffectSystem {
  let damageRules: DamageRules = DEFAULT_DAMAGE_RULES;
  return {
    setDamageRules(rules): void {
      damageRules = { slimeFriendlyFire: rules.slimeFriendlyFire };
    },
    tick(simTimeMs, store, index): FieldEffectTickResult {
      const removals = new Set<EntityId>();
      const damageIntents: DamageIntent[] = [];
      const actorEffectIntents: ActorEffectIntent[] = [];
      const maxTargetBoundsRadius = computeMaxTargetBoundsRadius(store);
      for (const fieldEffect of store.fieldEffects()) {
        if (simTimeMs >= fieldEffect.expireAtSimMs) {
          removals.add(fieldEffect.id);
          continue;
        }
        if (simTimeMs < fieldEffect.nextApplySimMs) continue;
        applyFieldEffect(
          fieldEffect,
          index,
          maxTargetBoundsRadius,
          damageRules,
          damageIntents,
          actorEffectIntents
        );
        fieldEffect.nextApplySimMs += fieldEffect.applyEveryMs;
      }
      for (const id of removals) store.removeFieldEffect(id);
      return { damageIntents, actorEffectIntents };
    },
    clear(): void {
      damageRules = DEFAULT_DAMAGE_RULES;
    }
  };
}

function applyFieldEffect(
  fieldEffect: FieldEffect,
  index: SpatialIndex,
  maxTargetBoundsRadius: number,
  damageRules: DamageRules,
  damageIntents: DamageIntent[],
  actorEffectIntents: ActorEffectIntent[]
): void {
  const candidates = index.queryRadius(
    fieldEffect.position.x,
    fieldEffect.position.y,
    fieldEffect.radius + maxTargetBoundsRadius
  );
  for (const candidate of candidates) {
    const target = asFieldEffectTarget(candidate, fieldEffect, damageRules);
    if (target === null) continue;
    if (!circleOverlapsBox(fieldEffect, target)) continue;
    for (const effect of fieldEffect.effects) {
      applyActorEffect(fieldEffect, target, effect, damageIntents, actorEffectIntents);
    }
  }
}

function computeMaxTargetBoundsRadius(store: EntityStore): number {
  let max = 0;
  for (const player of store.players()) max = Math.max(max, contactBoundsRadius(player));
  for (const enemy of store.enemies()) max = Math.max(max, contactBoundsRadius(enemy));
  for (const boss of store.bosses()) max = Math.max(max, contactBoundsRadius(boss));
  return max;
}

function contactBoundsRadius(entity: { contactBox: { width: number; height: number } }): number {
  return Math.hypot(entity.contactBox.width / 2, entity.contactBox.height / 2);
}

function asFieldEffectTarget(
  entity: IndexedEntity,
  fieldEffect: FieldEffect,
  damageRules: DamageRules
): DamageableEntity | null {
  if (entity.kind !== 'player' && entity.kind !== 'enemy' && entity.kind !== 'boss') return null;
  if (
    !canDamageTarget(
      { ownerId: fieldEffect.ownerId, ownerKind: fieldEffect.ownerKind },
      entity,
      damageRules
    )
  ) {
    return null;
  }
  return entity;
}

function applyActorEffect(
  fieldEffect: FieldEffect,
  target: DamageableEntity,
  effect: ActorEffectApplication,
  damageIntents: DamageIntent[],
  actorEffectIntents: ActorEffectIntent[]
): void {
  switch (effect.kind) {
    case 'damage':
      if (effect.amount <= 0) return;
      damageIntents.push({
        targetId: target.id,
        amount: effect.amount,
        source: {
          kind: 'fieldEffect',
          fieldEffectId: fieldEffect.id,
          archetypeId: fieldEffect.archetypeId
        },
        hitPosition: { x: target.position.x, y: target.position.y }
      });
      return;
    case 'status':
      actorEffectIntents.push({
        targetId: target.id,
        source: {
          kind: 'fieldEffect',
          fieldEffectId: fieldEffect.id,
          archetypeId: fieldEffect.archetypeId
        },
        application: effect
      });
      return;
    default:
      assertNever(effect);
  }
}

function circleOverlapsBox(
  circle: { position: { x: number; y: number }; radius: number },
  box: { position: { x: number; y: number }; contactBox: { width: number; height: number } }
): boolean {
  const halfWidth = box.contactBox.width / 2;
  const halfHeight = box.contactBox.height / 2;
  const closestX = clamp(
    circle.position.x,
    box.position.x - halfWidth,
    box.position.x + halfWidth
  );
  const closestY = clamp(
    circle.position.y,
    box.position.y - halfHeight,
    box.position.y + halfHeight
  );
  const dx = circle.position.x - closestX;
  const dy = circle.position.y - closestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function assertNever(value: never): never {
  throw new Error(`unhandled field effect value: ${String(value)}`);
}
