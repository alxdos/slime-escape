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

/** MVP boss for campaign / tests (design/content-archetypes.md). */
export const SLIME_KING: BossArchetype = {
  id: 'slime-king',
  displayName: 'Slime King',
  radius: 1.1,
  maxHp: 40,
  maxSpeed: 3,
  color: 0xaa44ff,
  contactDamage: 2,
  contactCooldownMs: 800,
  knockbackBaseImpulse: 5,
  knockbackVelocityScale: 0.4,
  knockbackDurationMs: 220,
  phases: [
    {
      id: 'crown-intact',
      allowedAttackIds: ['coneBurst', 'spawnAdds'],
      exitWhenHpFractionAtOrBelow: 0.55
    },
    {
      id: 'desperation',
      allowedAttackIds: ['coneBurst', 'dashSlam'],
      exitWhenHpFractionAtOrBelow: 0
    }
  ],
  attacks: {
    coneBurst: { pattern: 'coneBurst', cooldownMs: 1400, damage: 2 },
    spawnAdds: { pattern: 'spawnAdds', cooldownMs: 3500, damage: 0 },
    dashSlam: { pattern: 'dashSlam', cooldownMs: 1800, damage: 4 }
  }
};

export const BOSS_ARCHETYPES: Readonly<Record<string, BossArchetype>> = {
  [SLIME_KING.id]: SLIME_KING
};
