// AUTO-GENERATED from content/enemies.md by `npm run content:build`.
// Do not edit by hand.

type GeneratedEnemyArchetype = Readonly<{
  id: string;
  displayName: string;
  radius: number;
  contactBox: Readonly<{ width: number; height: number }>;
  maxHp: number;
  behavior: 'stationary' | 'chase';
  maxSpeed: number;
  contactDamage: number;
  contactCooldownMs: number;
  knockbackBaseImpulse: number;
  knockbackVelocityScale: number;
  knockbackDurationMs: number;
  color: number;
  dropTable: ReadonlyArray<Readonly<{ archetypeId: string; chance: number }>>;
  retaliation: Readonly<{ enabled: boolean; durationMs: number }>;
}>;
export const SLIME_ONE_EYE: GeneratedEnemyArchetype = {
  id: 'slime-one-eye',
  displayName: 'One-Eye Slime',
  radius: 0.4,
  contactBox: { width: 0.8041666666666667, height: 0.8208333333333333 },
  maxHp: 2,
  behavior: 'chase',
  maxSpeed: 2.6,
  contactDamage: 1,
  contactCooldownMs: 800,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  color: 0x7cf36a,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.18 }, { archetypeId: 'speed-up', chance: 0.05 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_HORNLING: GeneratedEnemyArchetype = {
  id: 'slime-hornling',
  displayName: 'Hornling Slime',
  radius: 0.5,
  contactBox: { width: 1.2041666666666666, height: 1.4 },
  maxHp: 3,
  behavior: 'chase',
  maxSpeed: 2.5,
  contactDamage: 1,
  contactCooldownMs: 850,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0xf06a24,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.2 }, { archetypeId: 'size-up', chance: 0.099 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_MANY_EYE: GeneratedEnemyArchetype = {
  id: 'slime-many-eye',
  displayName: 'Many-Eye Slime',
  radius: 0.6,
  contactBox: { width: 1.2375, height: 1.1875 },
  maxHp: 4,
  behavior: 'chase',
  maxSpeed: 2.2,
  contactDamage: 2,
  contactCooldownMs: 950,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0x9b67d8,
  dropTable: [{ archetypeId: 'multi-shot', chance: 0.127 }, { archetypeId: 'pierce', chance: 0.057 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_STONEHEAD: GeneratedEnemyArchetype = {
  id: 'slime-stonehead',
  displayName: 'Stonehead Slime',
  radius: 0.72,
  contactBox: { width: 1.2083333333333333, height: 2.0125 },
  maxHp: 7,
  behavior: 'chase',
  maxSpeed: 1.5,
  contactDamage: 2,
  contactCooldownMs: 1000,
  knockbackBaseImpulse: 3,
  knockbackVelocityScale: 0.5,
  knockbackDurationMs: 220,
  color: 0x8e8f95,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.3 }, { archetypeId: 'size-up', chance: 0.127 }, { archetypeId: 'fragment', chance: 0.057 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_SLEEPER: GeneratedEnemyArchetype = {
  id: 'slime-sleeper',
  displayName: 'Sleeper Slime',
  radius: 0.45,
  contactBox: { width: 1.6166666666666667, height: 0.6 },
  maxHp: 3,
  behavior: 'chase',
  maxSpeed: 1,
  contactDamage: 1,
  contactCooldownMs: 1000,
  knockbackBaseImpulse: 3,
  knockbackVelocityScale: 0.5,
  knockbackDurationMs: 220,
  color: 0x9e7fd8,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.16 }, { archetypeId: 'magnet', chance: 0.071 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_SPARK: GeneratedEnemyArchetype = {
  id: 'slime-spark',
  displayName: 'Spark Slime',
  radius: 0.35,
  contactBox: { width: 1.1958333333333333, height: 1.1875 },
  maxHp: 2,
  behavior: 'chase',
  maxSpeed: 2.8,
  contactDamage: 1,
  contactCooldownMs: 700,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  color: 0xf2e84a,
  dropTable: [{ archetypeId: 'speed-up', chance: 0.155 }, { archetypeId: 'magnet', chance: 0.085 }, { archetypeId: 'overdrive', chance: 0.057 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_WRAITH: GeneratedEnemyArchetype = {
  id: 'slime-wraith',
  displayName: 'Wraith Slime',
  radius: 0.48,
  contactBox: { width: 0.825, height: 1.0333333333333334 },
  maxHp: 3,
  behavior: 'chase',
  maxSpeed: 2.6,
  contactDamage: 1,
  contactCooldownMs: 800,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0xd9dce1,
  dropTable: [{ archetypeId: 'speed-up', chance: 0.127 }, { archetypeId: 'pierce', chance: 0.113 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_SHELL: GeneratedEnemyArchetype = {
  id: 'slime-shell',
  displayName: 'Shell Slime',
  radius: 0.65,
  contactBox: { width: 0.9041666666666667, height: 1.1 },
  maxHp: 6,
  behavior: 'chase',
  maxSpeed: 1.7,
  contactDamage: 2,
  contactCooldownMs: 1000,
  knockbackBaseImpulse: 3,
  knockbackVelocityScale: 0.5,
  knockbackDurationMs: 220,
  color: 0xa6e34a,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.32 }, { archetypeId: 'pierce', chance: 0.141 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_FLAME: GeneratedEnemyArchetype = {
  id: 'slime-flame',
  displayName: 'Flame Slime',
  radius: 0.44,
  contactBox: { width: 0.9375, height: 1.6583333333333334 },
  maxHp: 3,
  behavior: 'chase',
  maxSpeed: 2.6,
  contactDamage: 2,
  contactCooldownMs: 900,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0xf6c06d,
  dropTable: [{ archetypeId: 'overdrive', chance: 0.141 }, { archetypeId: 'fragment', chance: 0.113 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_MECH_CRAB: GeneratedEnemyArchetype = {
  id: 'slime-mech-crab',
  displayName: 'Mech Crab Slime',
  radius: 0.62,
  contactBox: { width: 1.0875, height: 1.3666666666666667 },
  maxHp: 5,
  behavior: 'chase',
  maxSpeed: 2,
  contactDamage: 2,
  contactCooldownMs: 950,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0xe85245,
  dropTable: [{ archetypeId: 'fragment', chance: 0.169 }, { archetypeId: 'pierce', chance: 0.141 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_STACK: GeneratedEnemyArchetype = {
  id: 'slime-stack',
  displayName: 'Stack Slime',
  radius: 0.58,
  contactBox: { width: 1.0166666666666666, height: 1.1083333333333334 },
  maxHp: 4,
  behavior: 'chase',
  maxSpeed: 2.2,
  contactDamage: 1,
  contactCooldownMs: 900,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0xcdeb84,
  dropTable: [{ archetypeId: 'multi-shot', chance: 0.183 }, { archetypeId: 'heal-orb', chance: 0.14 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_TRICKSTER: GeneratedEnemyArchetype = {
  id: 'slime-trickster',
  displayName: 'Trickster Slime',
  radius: 0.52,
  contactBox: { width: 1.7541666666666667, height: 1.8083333333333333 },
  maxHp: 4,
  behavior: 'chase',
  maxSpeed: 2.5,
  contactDamage: 1,
  contactCooldownMs: 850,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0xbdb4f4,
  dropTable: [{ archetypeId: 'multi-shot', chance: 0.141 }, { archetypeId: 'speed-up', chance: 0.113 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_BUG: GeneratedEnemyArchetype = {
  id: 'slime-bug',
  displayName: 'Bug Slime',
  radius: 0.48,
  contactBox: { width: 0.8125, height: 1.0583333333333333 },
  maxHp: 3,
  behavior: 'chase',
  maxSpeed: 2.6,
  contactDamage: 1,
  contactCooldownMs: 800,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0x8ee03a,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.18 }, { archetypeId: 'magnet', chance: 0.099 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_LIFTER: GeneratedEnemyArchetype = {
  id: 'slime-lifter',
  displayName: 'Lifter Slime',
  radius: 0.7,
  contactBox: { width: 1.4625, height: 1.4458333333333333 },
  maxHp: 7,
  behavior: 'chase',
  maxSpeed: 1.6,
  contactDamage: 3,
  contactCooldownMs: 1100,
  knockbackBaseImpulse: 3,
  knockbackVelocityScale: 0.5,
  knockbackDurationMs: 220,
  color: 0xe6e8ea,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.34 }, { archetypeId: 'magnet', chance: 0.141 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_SAW: GeneratedEnemyArchetype = {
  id: 'slime-saw',
  displayName: 'Saw Slime',
  radius: 0.55,
  contactBox: { width: 1.1583333333333334, height: 1.2541666666666667 },
  maxHp: 4,
  behavior: 'chase',
  maxSpeed: 2.5,
  contactDamage: 2,
  contactCooldownMs: 900,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0xf0523e,
  dropTable: [{ archetypeId: 'fragment', chance: 0.169 }, { archetypeId: 'speed-up', chance: 0.113 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_DRONE: GeneratedEnemyArchetype = {
  id: 'slime-drone',
  displayName: 'Drone Slime',
  radius: 0.42,
  contactBox: { width: 2.0166666666666666, height: 1.8166666666666667 },
  maxHp: 2,
  behavior: 'chase',
  maxSpeed: 2.8,
  contactDamage: 1,
  contactCooldownMs: 750,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  color: 0xafc4ea,
  dropTable: [{ archetypeId: 'speed-up', chance: 0.183 }, { archetypeId: 'pierce', chance: 0.099 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_STAR: GeneratedEnemyArchetype = {
  id: 'slime-star',
  displayName: 'Star Slime',
  radius: 0.38,
  contactBox: { width: 1.4, height: 1.6125 },
  maxHp: 2,
  behavior: 'chase',
  maxSpeed: 2.8,
  contactDamage: 1,
  contactCooldownMs: 700,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  color: 0xe8a8bc,
  dropTable: [{ archetypeId: 'speed-up', chance: 0.155 }, { archetypeId: 'multi-shot', chance: 0.113 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_ECHO: GeneratedEnemyArchetype = {
  id: 'slime-echo',
  displayName: 'Echo Slime',
  radius: 0.36,
  contactBox: { width: 0.75, height: 1.0583333333333333 },
  maxHp: 2,
  behavior: 'chase',
  maxSpeed: 2.6,
  contactDamage: 1,
  contactCooldownMs: 750,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  color: 0x4b5365,
  dropTable: [{ archetypeId: 'magnet', chance: 0.127 }, { archetypeId: 'speed-up', chance: 0.099 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_SPLITTER: GeneratedEnemyArchetype = {
  id: 'slime-splitter',
  displayName: 'Splitter Slime',
  radius: 0.56,
  contactBox: { width: 1.0208333333333333, height: 1.0625 },
  maxHp: 4,
  behavior: 'chase',
  maxSpeed: 2.4,
  contactDamage: 1,
  contactCooldownMs: 900,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0x7bd1ae,
  dropTable: [{ archetypeId: 'multi-shot', chance: 0.183 }, { archetypeId: 'fragment', chance: 0.113 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_PRINCE: GeneratedEnemyArchetype = {
  id: 'slime-prince',
  displayName: 'Prince Slime',
  radius: 0.66,
  contactBox: { width: 1.05, height: 1.1958333333333333 },
  maxHp: 5,
  behavior: 'chase',
  maxSpeed: 2.2,
  contactDamage: 2,
  contactCooldownMs: 950,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0xf1b294,
  dropTable: [{ archetypeId: 'overdrive', chance: 0.155 }, { archetypeId: 'multi-shot', chance: 0.127 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_KINGLING: GeneratedEnemyArchetype = {
  id: 'slime-kingling',
  displayName: 'Kingling Slime',
  radius: 0.74,
  contactBox: { width: 1.5291666666666666, height: 1.8583333333333334 },
  maxHp: 8,
  behavior: 'chase',
  maxSpeed: 1.7,
  contactDamage: 3,
  contactCooldownMs: 1100,
  knockbackBaseImpulse: 3,
  knockbackVelocityScale: 0.5,
  knockbackDurationMs: 220,
  color: 0xb7f3a6,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.32 }, { archetypeId: 'overdrive', chance: 0.155 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_FORTRESS: GeneratedEnemyArchetype = {
  id: 'slime-fortress',
  displayName: 'Fortress Slime',
  radius: 0.8,
  contactBox: { width: 1.5708333333333333, height: 1.375 },
  maxHp: 9,
  behavior: 'chase',
  maxSpeed: 1.2,
  contactDamage: 3,
  contactCooldownMs: 1200,
  knockbackBaseImpulse: 3,
  knockbackVelocityScale: 0.5,
  knockbackDurationMs: 220,
  color: 0x8f836e,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.4 }, { archetypeId: 'size-up', chance: 0.141 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_DASHER: GeneratedEnemyArchetype = {
  id: 'slime-dasher',
  displayName: 'Dasher Slime',
  radius: 0.46,
  contactBox: { width: 1.1375, height: 1.7875 },
  maxHp: 3,
  behavior: 'chase',
  maxSpeed: 2.8,
  contactDamage: 2,
  contactCooldownMs: 850,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  color: 0xef6a38,
  dropTable: [{ archetypeId: 'speed-up', chance: 0.155 }, { archetypeId: 'overdrive', chance: 0.113 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_TADPOLE: GeneratedEnemyArchetype = {
  id: 'slime-tadpole',
  displayName: 'Tadpole Slime',
  radius: 0.34,
  contactBox: { width: 1.4125, height: 1.7416666666666667 },
  maxHp: 2,
  behavior: 'chase',
  maxSpeed: 2.7,
  contactDamage: 1,
  contactCooldownMs: 750,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  color: 0xd9dde2,
  dropTable: [{ archetypeId: 'speed-up', chance: 0.127 }, { archetypeId: 'magnet', chance: 0.099 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_DOOR: GeneratedEnemyArchetype = {
  id: 'slime-door',
  displayName: 'Door Slime',
  radius: 0.76,
  contactBox: { width: 0.9708333333333333, height: 1.2041666666666666 },
  maxHp: 8,
  behavior: 'chase',
  maxSpeed: 1.1,
  contactDamage: 2,
  contactCooldownMs: 1100,
  knockbackBaseImpulse: 3,
  knockbackVelocityScale: 0.5,
  knockbackDurationMs: 220,
  color: 0xa7e5d2,
  dropTable: [{ archetypeId: 'heal-orb', chance: 0.34 }, { archetypeId: 'pierce', chance: 0.127 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_MECH: GeneratedEnemyArchetype = {
  id: 'slime-mech',
  displayName: 'Mech Slime',
  radius: 0.7,
  contactBox: { width: 1.4541666666666666, height: 1.2208333333333334 },
  maxHp: 7,
  behavior: 'chase',
  maxSpeed: 1.8,
  contactDamage: 3,
  contactCooldownMs: 1050,
  knockbackBaseImpulse: 3,
  knockbackVelocityScale: 0.5,
  knockbackDurationMs: 220,
  color: 0xef7168,
  dropTable: [{ archetypeId: 'fragment', chance: 0.197 }, { archetypeId: 'pierce', chance: 0.141 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_CLAMPER: GeneratedEnemyArchetype = {
  id: 'slime-clamper',
  displayName: 'Clamper Slime',
  radius: 0.52,
  contactBox: { width: 1.0125, height: 0.7166666666666667 },
  maxHp: 4,
  behavior: 'chase',
  maxSpeed: 2.5,
  contactDamage: 2,
  contactCooldownMs: 900,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0xf2c0a6,
  dropTable: [{ archetypeId: 'pierce', chance: 0.155 }, { archetypeId: 'magnet', chance: 0.113 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_CANDLE: GeneratedEnemyArchetype = {
  id: 'slime-candle',
  displayName: 'Candle Slime',
  radius: 0.46,
  contactBox: { width: 0.8541666666666666, height: 1.3583333333333334 },
  maxHp: 3,
  behavior: 'chase',
  maxSpeed: 2.5,
  contactDamage: 1,
  contactCooldownMs: 850,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0xa62922,
  dropTable: [{ archetypeId: 'overdrive', chance: 0.155 }, { archetypeId: 'speed-up', chance: 0.099 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_OBELISK: GeneratedEnemyArchetype = {
  id: 'slime-obelisk',
  displayName: 'Obelisk Slime',
  radius: 0.5,
  contactBox: { width: 0.6875, height: 2.0833333333333335 },
  maxHp: 5,
  behavior: 'chase',
  maxSpeed: 2,
  contactDamage: 2,
  contactCooldownMs: 1000,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 280,
  color: 0x5522a7,
  dropTable: [{ archetypeId: 'fragment', chance: 0.183 }, { archetypeId: 'overdrive', chance: 0.127 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_IDOL: GeneratedEnemyArchetype = {
  id: 'slime-idol',
  displayName: 'Idol Slime',
  radius: 0.5,
  contactBox: { width: 0.6875, height: 2.0833333333333335 },
  maxHp: 6,
  behavior: 'stationary',
  maxSpeed: 0,
  contactDamage: 0,
  contactCooldownMs: 1000,
  knockbackBaseImpulse: 0,
  knockbackVelocityScale: 0,
  knockbackDurationMs: 100,
  color: 0x6f78a8,
  dropTable: [],
  retaliation: { enabled: false, durationMs: 0 }
};

export const SLIME_NINJA: GeneratedEnemyArchetype = {
  id: 'slime-ninja',
  displayName: 'Ninja Slime',
  radius: 0.54,
  contactBox: { width: 1.4166666666666667, height: 1.375 },
  maxHp: 5,
  behavior: 'chase',
  maxSpeed: 2.6,
  contactDamage: 3,
  contactCooldownMs: 950,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  color: 0xa4e982,
  dropTable: [{ archetypeId: 'overdrive', chance: 0.155 }, { archetypeId: 'pierce', chance: 0.127 }],
  retaliation: { enabled: false, durationMs: 0 }
};

export const ENEMY_ARCHETYPE_LIST = [SLIME_ONE_EYE, SLIME_HORNLING, SLIME_MANY_EYE, SLIME_STONEHEAD, SLIME_SLEEPER, SLIME_SPARK, SLIME_WRAITH, SLIME_SHELL, SLIME_FLAME, SLIME_MECH_CRAB, SLIME_STACK, SLIME_TRICKSTER, SLIME_BUG, SLIME_LIFTER, SLIME_SAW, SLIME_DRONE, SLIME_STAR, SLIME_ECHO, SLIME_SPLITTER, SLIME_PRINCE, SLIME_KINGLING, SLIME_FORTRESS, SLIME_DASHER, SLIME_TADPOLE, SLIME_DOOR, SLIME_MECH, SLIME_CLAMPER, SLIME_CANDLE, SLIME_OBELISK, SLIME_IDOL, SLIME_NINJA] as const satisfies ReadonlyArray<GeneratedEnemyArchetype>;
