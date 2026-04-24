// AUTO-GENERATED from content/drops.md by `npm run content:build`.
// Do not edit by hand.
import type { DropArchetype } from './drops';

export const HEAL_ORB: DropArchetype = {
  id: 'heal-orb',
  displayName: 'Heal Orb',
  radius: 0.26666666666666666,
  ttlMs: 8000,
  effect: { kind: 'heal', amount: 1 },
  color: 0xff7aa8
};

export const SIZE_UP: DropArchetype = {
  id: 'size-up',
  displayName: 'Size Up',
  radius: 0.36666666666666664,
  ttlMs: 10000,
  effect: { kind: 'addWeaponModifier', modifier: { kind: 'projectileSizeMultiplier', multiplier: 1.25 }, target: 'selectedWeapon' },
  color: 0xffcf5a
};

export const SPEED_UP: DropArchetype = {
  id: 'speed-up',
  displayName: 'Speed Up',
  radius: 0.2604166666666667,
  ttlMs: 10000,
  effect: { kind: 'addWeaponModifier', modifier: { kind: 'projectileSpeedMultiplier', multiplier: 1.3 }, target: 'selectedWeapon' },
  color: 0x5ee6ff
};

export const MULTI_SHOT: DropArchetype = {
  id: 'multi-shot',
  displayName: 'Multi Shot',
  radius: 0.39166666666666666,
  ttlMs: 10000,
  effect: { kind: 'addWeaponModifier', modifier: { kind: 'symmetricProjectileMultiplier', multiplier: 2 }, target: 'selectedWeapon' },
  color: 0xb985ff
};

export const PIERCE: DropArchetype = {
  id: 'pierce',
  displayName: 'Pierce',
  radius: 0.37916666666666665,
  ttlMs: 10000,
  effect: { kind: 'addWeaponModifier', modifier: { kind: 'pierceBonus', amount: 1 }, target: 'selectedWeapon' },
  color: 0xe6f5ff
};

export const FRAGMENT: DropArchetype = {
  id: 'fragment',
  displayName: 'Fragment',
  radius: 0.4083333333333333,
  ttlMs: 10000,
  effect: { kind: 'addWeaponModifier', modifier: { kind: 'fragmentExplosion', fragmentWeaponArchetypeId: 'pistol', count: 6, spreadRadians: 6.2831853072 }, target: 'selectedWeapon' },
  color: 0xff8d5e
};

export const OVERDRIVE: DropArchetype = {
  id: 'overdrive',
  displayName: 'Overdrive',
  radius: 0.18333333333333332,
  ttlMs: 8000,
  effect: { kind: 'temporaryOverdrive', cooldownMultiplier: 0.5, durationMs: 5000, target: 'selectedWeapon' },
  color: 0x77ff95
};

export const MAGNET: DropArchetype = {
  id: 'magnet',
  displayName: 'Magnet',
  radius: 0.2604166666666667,
  ttlMs: 10000,
  effect: { kind: 'pickupModifier', modifier: { kind: 'dropMagnet', pickupRadiusMultiplier: 1.8, attractSpeed: 8 } },
  color: 0x5ee6ff
};
