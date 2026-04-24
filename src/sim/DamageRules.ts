import type { DamageRules } from '../shared/session';

import type { Boss, Enemy, EntityId, Player } from './EntityStore';

export const DEFAULT_DAMAGE_RULES: DamageRules = { slimeFriendlyFire: false };

export type DamageOwnerKind = 'player' | 'enemy' | 'boss';
export type DamageableEntity = Player | Enemy | Boss;

export type DamageOwner = Readonly<{
  ownerId: EntityId | null;
  ownerKind: DamageOwnerKind | null;
}>;

export function canDamageTarget(
  owner: DamageOwner,
  target: DamageableEntity,
  damageRules: DamageRules
): boolean {
  if (owner.ownerId !== null && target.id === owner.ownerId) return false;
  if (owner.ownerKind === 'enemy' && target.kind === 'enemy' && !damageRules.slimeFriendlyFire) {
    return false;
  }
  return true;
}
