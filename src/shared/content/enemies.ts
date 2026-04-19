export type EnemyBehavior = 'stationary' | 'chase';

export type EnemyArchetype = Readonly<{
  id: string;
  displayName: string;
  radius: number;
  maxHp: number;
  behavior: EnemyBehavior;
  maxSpeed: number;
  contactDamage: number;
  contactCooldownMs: number;
  knockbackBaseImpulse: number;
  knockbackVelocityScale: number;
  knockbackDurationMs: number;
  color: number;
}>;

export const TRAINING_TARGET: EnemyArchetype = {
  id: 'training-target',
  displayName: 'Training Target',
  radius: 0.6,
  maxHp: 3,
  behavior: 'stationary',
  maxSpeed: 0,
  contactDamage: 0,
  contactCooldownMs: 1,
  knockbackBaseImpulse: 0,
  knockbackVelocityScale: 0,
  knockbackDurationMs: 1,
  color: 0xff7766
};

export const ENEMY_ARCHETYPES: Readonly<Record<string, EnemyArchetype>> = {
  [TRAINING_TARGET.id]: TRAINING_TARGET
};
