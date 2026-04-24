// AUTO-GENERATED from content/weapons.md by `npm run content:build`.
// Do not edit by hand.
import type { WeaponArchetype } from './weapons';

export const PISTOL: WeaponArchetype = {
  id: 'pistol',
  displayName: 'Pistol',
  cooldownMs: 250,
  projectileSpeed: 12,
  projectileRadius: 0.1,
  projectileTtlMs: 2000,
  damage: 1,
  knockbackImpulse: 5,
  color: 0xffd76b
};

export const SHOTGUN: WeaponArchetype = {
  id: 'shotgun',
  displayName: 'Shotgun',
  cooldownMs: 900,
  projectileSpeed: 14,
  projectileRadius: 0.18,
  projectileTtlMs: 500,
  damage: 4,
  knockbackImpulse: 12,
  color: 0xff9b5e
};

export const SMG: WeaponArchetype = {
  id: 'smg',
  displayName: 'SMG',
  cooldownMs: 90,
  projectileSpeed: 22,
  projectileRadius: 0.08,
  projectileTtlMs: 1600,
  damage: 1,
  knockbackImpulse: 3,
  color: 0x9cff70
};

export const SNIPER: WeaponArchetype = {
  id: 'sniper',
  displayName: 'Sniper',
  cooldownMs: 1200,
  projectileSpeed: 28,
  projectileRadius: 0.08,
  projectileTtlMs: 2400,
  damage: 6,
  knockbackImpulse: 9,
  color: 0xb8e8ff
};

export const LASER: WeaponArchetype = {
  id: 'laser',
  displayName: 'Laser',
  cooldownMs: 140,
  projectileSpeed: 27,
  projectileRadius: 0.05,
  projectileTtlMs: 900,
  damage: 1,
  knockbackImpulse: 2,
  color: 0x66fff0
};
