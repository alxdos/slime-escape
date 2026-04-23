import { SLIME_KING } from './bosses.generated';

export type BossPhaseSpec = Readonly<{
  id: string;
  allowedAttackIds: ReadonlyArray<string>;
  exitWhenHpFractionAtOrBelow: number;
}>;

export type BossAttackSpec = Readonly<{
  pattern: string;
  cooldownMs: number;
  damage: number;
}>;

export type BossArchetype = Readonly<{
  id: string;
  displayName: string;
  radius: number;
  maxHp: number;
  maxSpeed: number;
  color: number;
  contactDamage: number;
  contactCooldownMs: number;
  knockbackBaseImpulse: number;
  knockbackVelocityScale: number;
  knockbackDurationMs: number;
  phases: ReadonlyArray<BossPhaseSpec>;
  attacks: Readonly<Record<string, BossAttackSpec>>;
}>;

export { SLIME_KING };

export const BOSS_ARCHETYPES: Readonly<Record<string, BossArchetype>> = {
  [SLIME_KING.id]: SLIME_KING
};
