// AUTO-GENERATED from content/bosses.md by `npm run content:build`.
// Do not edit by hand.
import type { BossArchetype } from './bosses';

export const BOSS_GARGOYLE: BossArchetype = {
  id: 'boss-gargoyle',
  displayName: 'Gargoyle Slime',
  radius: 1.15,
  contactBox: { width: 2.9125, height: 2.375 },
  maxHp: 35,
  maxSpeed: 3.2,
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

export const BOSS_SAW_CYCLOPS: BossArchetype = {
  id: 'boss-saw-cyclops',
  displayName: 'Saw Cyclops',
  radius: 1.25,
  contactBox: { width: 1.8875, height: 2.2083333333333335 },
  maxHp: 45,
  maxSpeed: 2.4,
  color: 0xaa44ff,
  contactDamage: 3,
  contactCooldownMs: 900,
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

export const BOSS_SCRAP_KING: BossArchetype = {
  id: 'boss-scrap-king',
  displayName: 'Scrap King',
  radius: 1.35,
  contactBox: { width: 2.841666666666667, height: 3.279166666666667 },
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

export const BOSS_TOWER_SENTINEL: BossArchetype = {
  id: 'boss-tower-sentinel',
  displayName: 'Tower Sentinel',
  radius: 1.3,
  contactBox: { width: 1.8125, height: 2.95 },
  maxHp: 50,
  maxSpeed: 1.8,
  color: 0xaa44ff,
  contactDamage: 3,
  contactCooldownMs: 1000,
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

export const BOSS_BUBBLE_HOG: BossArchetype = {
  id: 'boss-bubble-hog',
  displayName: 'Bubble Hog',
  radius: 1.2,
  contactBox: { width: 2.220833333333333, height: 2.3916666666666666 },
  maxHp: 42,
  maxSpeed: 2.6,
  color: 0xaa44ff,
  contactDamage: 2,
  contactCooldownMs: 850,
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
