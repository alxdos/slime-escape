// AUTO-GENERATED from content/bosses.md by `npm run content:build`.
// Do not edit by hand.
import type { BossArchetype } from './bosses';

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
