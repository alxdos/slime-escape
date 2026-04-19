export type EnemyBehavior = 'stationary';

export type EnemyArchetype = Readonly<{
  id: string;
  displayName: string;
  radius: number;
  maxHp: number;
  behavior: EnemyBehavior;
  color: number;
}>;

export const TRAINING_TARGET: EnemyArchetype = {
  id: 'training-target',
  displayName: 'Training Target',
  radius: 0.6,
  maxHp: 3,
  behavior: 'stationary',
  color: 0xff7766
};

export const ENEMY_ARCHETYPES: Readonly<Record<string, EnemyArchetype>> = {
  [TRAINING_TARGET.id]: TRAINING_TARGET
};
