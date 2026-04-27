// AUTO-GENERATED from content/bosses.md by `npm run content:build`.
// Do not edit by hand.
import type { BossArchetype } from './bosses';

export const BOSS_GARGOYLE: BossArchetype = {
  id: 'boss-gargoyle',
  displayName: 'Gargoyle Slime',
  radius: 1.15,
  contactBox: { width: 2.9125, height: 2.375 },
  maxHp: 90,
  maxSpeed: 2,
  color: 0x7bef63,
  contactDamage: 2,
  contactCooldownMs: 800,
  knockbackBaseImpulse: 2.5,
  knockbackVelocityScale: 0.1,
  knockbackDurationMs: 120,
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
  maxHp: 110,
  maxSpeed: 1.6,
  color: 0xb8e86c,
  contactDamage: 3,
  contactCooldownMs: 900,
  knockbackBaseImpulse: 2.5,
  knockbackVelocityScale: 0.1,
  knockbackDurationMs: 120,
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
  maxHp: 105,
  maxSpeed: 1.9,
  color: 0xe9d13d,
  contactDamage: 2,
  contactCooldownMs: 800,
  knockbackBaseImpulse: 2.5,
  knockbackVelocityScale: 0.1,
  knockbackDurationMs: 120,
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
  maxHp: 130,
  maxSpeed: 1.2,
  color: 0xbdb8b2,
  contactDamage: 3,
  contactCooldownMs: 1000,
  knockbackBaseImpulse: 2.5,
  knockbackVelocityScale: 0.1,
  knockbackDurationMs: 120,
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
  maxHp: 105,
  maxSpeed: 1.7,
  color: 0xf06c9a,
  contactDamage: 2,
  contactCooldownMs: 850,
  knockbackBaseImpulse: 2.5,
  knockbackVelocityScale: 0.1,
  knockbackDurationMs: 120,
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
