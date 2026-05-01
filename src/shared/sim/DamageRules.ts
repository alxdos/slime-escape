import type { DamageRules } from '../session.js';

import type { Boss, CombatOwnerKind, Companion, Enemy, EntityId, Player } from './EntityStore.js';

export const DEFAULT_DAMAGE_RULES: DamageRules = {
  slimeFriendlyFire: false,
  playerVsPlayerDamage: false
};

export type DamageOwnerKind = CombatOwnerKind;
export type DamageableEntity = Player | Companion | Enemy | Boss;

export type DamageOwner = Readonly<{
  ownerId: EntityId | null;
  ownerKind: DamageOwnerKind | null;
  ownerTeamPlayerId?: string | null;
}>;

export function canDamageTarget(
  owner: DamageOwner,
  target: DamageableEntity,
  damageRules: DamageRules
): boolean {
  if (target.kind === 'player' && target.state !== 'alive') return false;
  if (target.kind === 'companion' && target.state !== 'alive') return false;
  if (owner.ownerId !== null && target.id === owner.ownerId) return false;
  const ownerTeamPlayerId = owner.ownerTeamPlayerId ?? null;
  const targetTeamPlayerId = teamPlayerIdForTarget(target);
  if (ownerTeamPlayerId !== null && targetTeamPlayerId !== null) {
    if (ownerTeamPlayerId === targetTeamPlayerId) return false;
    return damageRules.playerVsPlayerDamage;
  }
  if (owner.ownerKind === 'player' && target.kind === 'companion') return false;
  if (
    owner.ownerKind === 'companion' &&
    (target.kind === 'player' || target.kind === 'companion')
  ) {
    return false;
  }
  if (owner.ownerKind === 'enemy' && target.kind === 'enemy' && !damageRules.slimeFriendlyFire) {
    return false;
  }
  return true;
}

function teamPlayerIdForTarget(target: DamageableEntity): string | null {
  if (target.kind === 'player') return target.playerId;
  if (target.kind === 'companion') return target.ownerPlayerId;
  return null;
}
