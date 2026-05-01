import type { DamageSource } from './CombatSystem.js';
import type { CombatOwnerKind, EntityId, EntityStore } from './EntityStore.js';
import type { DamageContext } from './HealthDeathSystem.js';

export type RetaliationSystem = Readonly<{
  onDamage(ctx: DamageContext, store: EntityStore): void;
}>;

export function createRetaliationSystem(): RetaliationSystem {
  return {
    onDamage(ctx, store): void {
      if (ctx.targetKind !== 'enemy') return;
      const target = store.enemyById(ctx.targetId);
      if (target === null) return;
      if (!target.retaliation.enabled) return;
      const owner = damageOwner(ctx.source);
      if (owner === null) return;
      if (owner.ownerKind !== 'enemy' && owner.ownerKind !== 'boss') return;
      if (owner.ownerId === target.id) return;
      target.aggroMemory = {
        targetId: owner.ownerId,
        reason: 'friendlyFire',
        expireAtSimMs: ctx.simTime + target.retaliation.durationMs
      };
    }
  };
}

function damageOwner(
  source: DamageSource
): { ownerId: EntityId; ownerKind: CombatOwnerKind } | null {
  if (source.kind !== 'projectile' && source.kind !== 'explosion') return null;
  if (source.ownerId === undefined) return null;
  return { ownerId: source.ownerId, ownerKind: source.ownerKind };
}
