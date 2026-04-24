// AUTO-GENERATED from content/weapons.md by `npm run content:build`.
// Do not edit by hand.
import type { WeaponArchetype } from './weapons';

export const PISTOL: WeaponArchetype = {
  id: 'pistol',
  displayName: 'Pistol',
  cooldownMs: 250,
  firePattern: { kind: 'single', spreadRadians: 0, count: 1 },
  projectile: {
    motion: { kind: 'linear', speed: 12 },
    size: { width: 0.2708333333333333, height: 0.17083333333333334 },
    hitRadius: 0.1,
    impactDamage: 1,
    knockbackImpulse: 5,
    pierceCount: 0,
    ttlMs: 2000,
    groundOnImpact: false,
    groundedLifetimeMs: null,
    detonationTrigger: null,
    explosion: null,
    visual: { spinRadiansPerSec: 0, rotateWhileFlying: true, pulseWhenGrounded: false, explosionRadiusIndicator: false }
  }
};

export const SHOTGUN: WeaponArchetype = {
  id: 'shotgun',
  displayName: 'Shotgun',
  cooldownMs: 900,
  firePattern: { kind: 'single', spreadRadians: 0.55, count: 5 },
  projectile: {
    motion: { kind: 'linear', speed: 14 },
    size: { width: 0.26666666666666666, height: 0.2375 },
    hitRadius: 0.18,
    impactDamage: 2,
    knockbackImpulse: 12,
    pierceCount: 0,
    ttlMs: 500,
    groundOnImpact: false,
    groundedLifetimeMs: null,
    detonationTrigger: null,
    explosion: null,
    visual: { spinRadiansPerSec: 0, rotateWhileFlying: true, pulseWhenGrounded: false, explosionRadiusIndicator: false }
  }
};

export const SMG: WeaponArchetype = {
  id: 'smg',
  displayName: 'SMG',
  cooldownMs: 90,
  firePattern: { kind: 'single', spreadRadians: 0, count: 1 },
  projectile: {
    motion: { kind: 'linear', speed: 22 },
    size: { width: 0.3416666666666667, height: 0.16666666666666666 },
    hitRadius: 0.08,
    impactDamage: 1,
    knockbackImpulse: 3,
    pierceCount: 0,
    ttlMs: 1600,
    groundOnImpact: false,
    groundedLifetimeMs: null,
    detonationTrigger: null,
    explosion: null,
    visual: { spinRadiansPerSec: 0, rotateWhileFlying: true, pulseWhenGrounded: false, explosionRadiusIndicator: false }
  }
};

export const SNIPER: WeaponArchetype = {
  id: 'sniper',
  displayName: 'Sniper',
  cooldownMs: 1200,
  firePattern: { kind: 'single', spreadRadians: 0, count: 1 },
  projectile: {
    motion: { kind: 'linear', speed: 28 },
    size: { width: 0.9708333333333333, height: 0.19166666666666668 },
    hitRadius: 0.08,
    impactDamage: 6,
    knockbackImpulse: 9,
    pierceCount: 1,
    ttlMs: 2400,
    groundOnImpact: false,
    groundedLifetimeMs: null,
    detonationTrigger: null,
    explosion: null,
    visual: { spinRadiansPerSec: 0, rotateWhileFlying: true, pulseWhenGrounded: false, explosionRadiusIndicator: false }
  }
};

export const LASER: WeaponArchetype = {
  id: 'laser',
  displayName: 'Laser',
  cooldownMs: 140,
  firePattern: { kind: 'single', spreadRadians: 0, count: 1 },
  projectile: {
    motion: { kind: 'linear', speed: 27 },
    size: { width: 2.5, height: 0.12916666666666668 },
    hitRadius: 0.05,
    impactDamage: 1,
    knockbackImpulse: 2,
    pierceCount: 3,
    ttlMs: 900,
    groundOnImpact: false,
    groundedLifetimeMs: null,
    detonationTrigger: null,
    explosion: null,
    visual: { spinRadiansPerSec: 0, rotateWhileFlying: true, pulseWhenGrounded: false, explosionRadiusIndicator: false }
  }
};

export const ROCK_THROWER: WeaponArchetype = {
  id: 'rock-thrower',
  displayName: 'Rock Thrower',
  cooldownMs: 700,
  firePattern: { kind: 'single', spreadRadians: 0, count: 1 },
  projectile: {
    motion: { kind: 'arc', speed: 8, range: 5, flightMs: 550 },
    size: { width: 0.5416666666666666, height: 0.49166666666666664 },
    hitRadius: 0.18,
    impactDamage: 3,
    knockbackImpulse: 12,
    pierceCount: 0,
    ttlMs: 1300,
    groundOnImpact: true,
    groundedLifetimeMs: 350,
    detonationTrigger: null,
    explosion: null,
    visual: { spinRadiansPerSec: 8, rotateWhileFlying: true, pulseWhenGrounded: false, explosionRadiusIndicator: false }
  }
};

export const GRENADE_LAUNCHER: WeaponArchetype = {
  id: 'grenade-launcher',
  displayName: 'Grenade Launcher',
  cooldownMs: 1100,
  firePattern: { kind: 'single', spreadRadians: 0, count: 1 },
  projectile: {
    motion: { kind: 'arc', speed: 7, range: 6, flightMs: 700 },
    size: { width: 0.3333333333333333, height: 0.3875 },
    hitRadius: 0.22,
    impactDamage: 1,
    knockbackImpulse: 6,
    pierceCount: 0,
    ttlMs: 2200,
    groundOnImpact: true,
    groundedLifetimeMs: 1200,
    detonationTrigger: { kind: 'timer' },
    explosion: {
      delayMs: 1000,
      radius: 1.8,
      damage: 4,
      knockbackImpulse: 16,
      fragments: null,
      fieldEffect: null,
      effects: []
    },
    visual: { spinRadiansPerSec: 6, rotateWhileFlying: true, pulseWhenGrounded: true, explosionRadiusIndicator: true }
  }
};

export const BOMB_PLACER: WeaponArchetype = {
  id: 'bomb-placer',
  displayName: 'Bomb Placer',
  cooldownMs: 1600,
  firePattern: { kind: 'place' },
  projectile: {
    motion: { kind: 'placed' },
    size: { width: 0.7666666666666667, height: 0.7291666666666666 },
    hitRadius: 0.25,
    impactDamage: 0,
    knockbackImpulse: 0,
    pierceCount: 0,
    ttlMs: 2200,
    groundOnImpact: true,
    groundedLifetimeMs: 1800,
    detonationTrigger: { kind: 'timer' },
    explosion: {
      delayMs: 1800,
      radius: 2.2,
      damage: 5,
      knockbackImpulse: 20,
      fragments: null,
      fieldEffect: null,
      effects: []
    },
    visual: { spinRadiansPerSec: 0, rotateWhileFlying: false, pulseWhenGrounded: true, explosionRadiusIndicator: true }
  }
};

export const FIREBALL_STAFF: WeaponArchetype = {
  id: 'fireball-staff',
  displayName: 'Fireball Staff',
  cooldownMs: 850,
  firePattern: { kind: 'multiDirection', directions: [0, 1.5707963268, 3.1415926536, 4.7123889804] },
  projectile: {
    motion: { kind: 'linear', speed: 9 },
    size: { width: 0.7375, height: 0.7625 },
    hitRadius: 0.2,
    impactDamage: 2,
    knockbackImpulse: 5,
    pierceCount: 0,
    ttlMs: 1400,
    groundOnImpact: false,
    groundedLifetimeMs: null,
    detonationTrigger: null,
    explosion: null,
    visual: { spinRadiansPerSec: 4, rotateWhileFlying: true, pulseWhenGrounded: false, explosionRadiusIndicator: false }
  }
};
