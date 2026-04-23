// AUTO-GENERATED from content/enemies.md by `npm run content:build`.
// Do not edit by hand.
import type { EnemyArchetype } from './enemies';

export const SLIME_ONE_EYE: EnemyArchetype = {
  id: 'slime-one-eye',
  displayName: 'One-Eye Slime',
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

export const SLIME_HORNLING: EnemyArchetype = {
  id: 'slime-hornling',
  displayName: 'Hornling Slime',
  radius: 0.5,
  maxHp: 2,
  behavior: 'chase',
  maxSpeed: 3.3,
  contactDamage: 1,
  contactCooldownMs: 850,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.3 }]
};

export const SLIME_MANY_EYE: EnemyArchetype = {
  id: 'slime-many-eye',
  displayName: 'Many-Eye Slime',
  radius: 0.6,
  maxHp: 3,
  behavior: 'chase',
  maxSpeed: 2.2,
  contactDamage: 2,
  contactCooldownMs: 950,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.35 }]
};

export const SLIME_STONEHEAD: EnemyArchetype = {
  id: 'slime-stonehead',
  displayName: 'Stonehead Slime',
  radius: 0.72,
  maxHp: 6,
  behavior: 'chase',
  maxSpeed: 1.5,
  contactDamage: 2,
  contactCooldownMs: 1000,
  knockbackBaseImpulse: 3,
  knockbackVelocityScale: 0.5,
  knockbackDurationMs: 220,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.6 }]
};

export const SLIME_SLEEPER: EnemyArchetype = {
  id: 'slime-sleeper',
  displayName: 'Sleeper Slime',
  radius: 0.45,
  maxHp: 2,
  behavior: 'chase',
  maxSpeed: 1,
  contactDamage: 1,
  contactCooldownMs: 1000,
  knockbackBaseImpulse: 3,
  knockbackVelocityScale: 0.5,
  knockbackDurationMs: 220,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.2 }]
};

export const SLIME_SPARK: EnemyArchetype = {
  id: 'slime-spark',
  displayName: 'Spark Slime',
  radius: 0.35,
  maxHp: 1,
  behavior: 'chase',
  maxSpeed: 5.2,
  contactDamage: 1,
  contactCooldownMs: 700,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.18 }]
};

export const SLIME_WRAITH: EnemyArchetype = {
  id: 'slime-wraith',
  displayName: 'Wraith Slime',
  radius: 0.48,
  maxHp: 2,
  behavior: 'chase',
  maxSpeed: 3.5,
  contactDamage: 1,
  contactCooldownMs: 800,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.25 }]
};

export const SLIME_SHELL: EnemyArchetype = {
  id: 'slime-shell',
  displayName: 'Shell Slime',
  radius: 0.65,
  maxHp: 5,
  behavior: 'chase',
  maxSpeed: 1.7,
  contactDamage: 2,
  contactCooldownMs: 1000,
  knockbackBaseImpulse: 3,
  knockbackVelocityScale: 0.5,
  knockbackDurationMs: 220,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.55 }]
};

export const SLIME_FLAME: EnemyArchetype = {
  id: 'slime-flame',
  displayName: 'Flame Slime',
  radius: 0.44,
  maxHp: 2,
  behavior: 'chase',
  maxSpeed: 3.8,
  contactDamage: 2,
  contactCooldownMs: 900,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.3 }]
};

export const SLIME_MECH_CRAB: EnemyArchetype = {
  id: 'slime-mech-crab',
  displayName: 'Mech Crab Slime',
  radius: 0.62,
  maxHp: 4,
  behavior: 'chase',
  maxSpeed: 2,
  contactDamage: 2,
  contactCooldownMs: 950,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.45 }]
};

export const SLIME_STACK: EnemyArchetype = {
  id: 'slime-stack',
  displayName: 'Stack Slime',
  radius: 0.58,
  maxHp: 3,
  behavior: 'chase',
  maxSpeed: 2.4,
  contactDamage: 1,
  contactCooldownMs: 900,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.35 }]
};

export const SLIME_TRICKSTER: EnemyArchetype = {
  id: 'slime-trickster',
  displayName: 'Trickster Slime',
  radius: 0.52,
  maxHp: 3,
  behavior: 'chase',
  maxSpeed: 3.2,
  contactDamage: 1,
  contactCooldownMs: 850,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.3 }]
};

export const SLIME_BUG: EnemyArchetype = {
  id: 'slime-bug',
  displayName: 'Bug Slime',
  radius: 0.48,
  maxHp: 2,
  behavior: 'chase',
  maxSpeed: 3.6,
  contactDamage: 1,
  contactCooldownMs: 800,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.25 }]
};

export const SLIME_LIFTER: EnemyArchetype = {
  id: 'slime-lifter',
  displayName: 'Lifter Slime',
  radius: 0.7,
  maxHp: 6,
  behavior: 'chase',
  maxSpeed: 1.6,
  contactDamage: 3,
  contactCooldownMs: 1100,
  knockbackBaseImpulse: 3,
  knockbackVelocityScale: 0.5,
  knockbackDurationMs: 220,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.6 }]
};

export const SLIME_SAW: EnemyArchetype = {
  id: 'slime-saw',
  displayName: 'Saw Slime',
  radius: 0.55,
  maxHp: 3,
  behavior: 'chase',
  maxSpeed: 3,
  contactDamage: 2,
  contactCooldownMs: 900,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.4 }]
};

export const SLIME_DRONE: EnemyArchetype = {
  id: 'slime-drone',
  displayName: 'Drone Slime',
  radius: 0.42,
  maxHp: 1,
  behavior: 'chase',
  maxSpeed: 4.8,
  contactDamage: 1,
  contactCooldownMs: 750,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.2 }]
};

export const SLIME_STAR: EnemyArchetype = {
  id: 'slime-star',
  displayName: 'Star Slime',
  radius: 0.38,
  maxHp: 1,
  behavior: 'chase',
  maxSpeed: 5,
  contactDamage: 1,
  contactCooldownMs: 700,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.18 }]
};

export const SLIME_ECHO: EnemyArchetype = {
  id: 'slime-echo',
  displayName: 'Echo Slime',
  radius: 0.36,
  maxHp: 1,
  behavior: 'chase',
  maxSpeed: 4.4,
  contactDamage: 1,
  contactCooldownMs: 750,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.15 }]
};

export const SLIME_SPLITTER: EnemyArchetype = {
  id: 'slime-splitter',
  displayName: 'Splitter Slime',
  radius: 0.56,
  maxHp: 3,
  behavior: 'chase',
  maxSpeed: 2.8,
  contactDamage: 1,
  contactCooldownMs: 900,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.35 }]
};

export const SLIME_PRINCE: EnemyArchetype = {
  id: 'slime-prince',
  displayName: 'Prince Slime',
  radius: 0.66,
  maxHp: 4,
  behavior: 'chase',
  maxSpeed: 2.2,
  contactDamage: 2,
  contactCooldownMs: 950,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.45 }]
};

export const SLIME_KINGLING: EnemyArchetype = {
  id: 'slime-kingling',
  displayName: 'Kingling Slime',
  radius: 0.74,
  maxHp: 7,
  behavior: 'chase',
  maxSpeed: 1.7,
  contactDamage: 3,
  contactCooldownMs: 1100,
  knockbackBaseImpulse: 3,
  knockbackVelocityScale: 0.5,
  knockbackDurationMs: 220,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.65 }]
};

export const SLIME_FORTRESS: EnemyArchetype = {
  id: 'slime-fortress',
  displayName: 'Fortress Slime',
  radius: 0.8,
  maxHp: 8,
  behavior: 'chase',
  maxSpeed: 1.2,
  contactDamage: 3,
  contactCooldownMs: 1200,
  knockbackBaseImpulse: 3,
  knockbackVelocityScale: 0.5,
  knockbackDurationMs: 220,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.7 }]
};

export const SLIME_DASHER: EnemyArchetype = {
  id: 'slime-dasher',
  displayName: 'Dasher Slime',
  radius: 0.46,
  maxHp: 2,
  behavior: 'chase',
  maxSpeed: 4.6,
  contactDamage: 2,
  contactCooldownMs: 850,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.25 }]
};

export const SLIME_TADPOLE: EnemyArchetype = {
  id: 'slime-tadpole',
  displayName: 'Tadpole Slime',
  radius: 0.34,
  maxHp: 1,
  behavior: 'chase',
  maxSpeed: 4.2,
  contactDamage: 1,
  contactCooldownMs: 750,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.15 }]
};

export const SLIME_DOOR: EnemyArchetype = {
  id: 'slime-door',
  displayName: 'Door Slime',
  radius: 0.76,
  maxHp: 7,
  behavior: 'chase',
  maxSpeed: 1.1,
  contactDamage: 2,
  contactCooldownMs: 1100,
  knockbackBaseImpulse: 3,
  knockbackVelocityScale: 0.5,
  knockbackDurationMs: 220,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.65 }]
};

export const SLIME_MECH: EnemyArchetype = {
  id: 'slime-mech',
  displayName: 'Mech Slime',
  radius: 0.7,
  maxHp: 6,
  behavior: 'chase',
  maxSpeed: 1.8,
  contactDamage: 3,
  contactCooldownMs: 1050,
  knockbackBaseImpulse: 3,
  knockbackVelocityScale: 0.5,
  knockbackDurationMs: 220,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.55 }]
};

export const SLIME_CLAMPER: EnemyArchetype = {
  id: 'slime-clamper',
  displayName: 'Clamper Slime',
  radius: 0.52,
  maxHp: 3,
  behavior: 'chase',
  maxSpeed: 3,
  contactDamage: 2,
  contactCooldownMs: 900,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.35 }]
};

export const SLIME_CANDLE: EnemyArchetype = {
  id: 'slime-candle',
  displayName: 'Candle Slime',
  radius: 0.46,
  maxHp: 2,
  behavior: 'chase',
  maxSpeed: 3.4,
  contactDamage: 1,
  contactCooldownMs: 850,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.25 }]
};

export const SLIME_OBELISK: EnemyArchetype = {
  id: 'slime-obelisk',
  displayName: 'Obelisk Slime',
  radius: 0.5,
  maxHp: 4,
  behavior: 'chase',
  maxSpeed: 2,
  contactDamage: 2,
  contactCooldownMs: 1000,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.4 }]
};

export const SLIME_NINJA: EnemyArchetype = {
  id: 'slime-ninja',
  displayName: 'Ninja Slime',
  radius: 0.54,
  maxHp: 4,
  behavior: 'chase',
  maxSpeed: 4,
  contactDamage: 3,
  contactCooldownMs: 950,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  color: 0x77ff99,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.35 }]
};
