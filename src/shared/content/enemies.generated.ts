// AUTO-GENERATED from content/enemies.md by `npm run content:build`.
// Do not edit by hand.
import type { EnemyArchetype } from './enemies';

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
  color: 0xff7766,
  dropTable: []
};

export const SLIME_FAST: EnemyArchetype = {
  id: 'slime-fast',
  displayName: 'Fast Slime',
  radius: 0.4,
  maxHp: 1,
  behavior: 'chase',
  maxSpeed: 4,
  contactDamage: 1,
  contactCooldownMs: 800,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.25 }]
};

export const SLIME_TANK: EnemyArchetype = {
  id: 'slime-tank',
  displayName: 'Tank Slime',
  radius: 0.7,
  maxHp: 5,
  behavior: 'chase',
  maxSpeed: 1.8,
  contactDamage: 2,
  contactCooldownMs: 1000,
  knockbackBaseImpulse: 3,
  knockbackVelocityScale: 0.5,
  knockbackDurationMs: 200,
  color: 0x4488dd,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.6 }]
};
