import {
  BOMB_PLACER,
  FIREBALL_STAFF,
  GRENADE_LAUNCHER,
  LASER,
  PISTOL,
  ROCK_THROWER,
  SHOTGUN,
  SMG,
  SNIPER
} from './weapons.generated';

export type ProjectileMotion =
  | Readonly<{ kind: 'linear'; speed: number }>
  | Readonly<{ kind: 'arc'; speed: number; range: number; flightMs: number }>
  | Readonly<{ kind: 'placed' }>;

export type FirePattern =
  | Readonly<{ kind: 'single'; spreadRadians: number; count: number }>
  | Readonly<{ kind: 'multiDirection'; directions: ReadonlyArray<number> }>
  | Readonly<{ kind: 'place' }>;

export type FragmentSpec = Readonly<{
  weaponArchetypeId: string;
  count: number;
  spreadRadians: number;
}>;

export type ExplosionSpec = Readonly<{
  delayMs: number;
  radius: number;
  damage: number;
  knockbackImpulse: number;
  fragments: FragmentSpec | null;
}>;

export type ProjectileVisualSpec = Readonly<{
  spinRadiansPerSec: number;
  rotateWhileFlying: boolean;
  pulseWhenGrounded: boolean;
  explosionRadiusIndicator: boolean;
}>;

export type ProjectileArchetype = Readonly<{
  motion: ProjectileMotion;
  size: Readonly<{ width: number; height: number }>;
  hitRadius: number;
  impactDamage: number;
  knockbackImpulse: number;
  pierceCount: number;
  ttlMs: number;
  groundOnImpact: boolean;
  groundedLifetimeMs: number | null;
  explosion: ExplosionSpec | null;
  visual: ProjectileVisualSpec;
}>;

export type WeaponModifier =
  | Readonly<{ kind: 'projectileSizeMultiplier'; multiplier: number }>
  | Readonly<{ kind: 'projectileSpeedMultiplier'; multiplier: number }>
  | Readonly<{ kind: 'symmetricProjectileMultiplier'; multiplier: number }>
  | Readonly<{ kind: 'pierceBonus'; amount: number }>
  | Readonly<{
      kind: 'fragmentExplosion';
      fragmentWeaponArchetypeId: string;
      count: number;
      spreadRadians: number;
    }>;

export type WeaponArchetype = Readonly<{
  id: string;
  displayName: string;
  cooldownMs: number;
  firePattern: FirePattern;
  projectile: ProjectileArchetype;
}>;

export {
  BOMB_PLACER,
  FIREBALL_STAFF,
  GRENADE_LAUNCHER,
  LASER,
  PISTOL,
  ROCK_THROWER,
  SHOTGUN,
  SMG,
  SNIPER
};

export const WEAPON_ARCHETYPES: Readonly<Record<string, WeaponArchetype>> = {
  [PISTOL.id]: PISTOL,
  [SHOTGUN.id]: SHOTGUN,
  [SMG.id]: SMG,
  [SNIPER.id]: SNIPER,
  [LASER.id]: LASER,
  [ROCK_THROWER.id]: ROCK_THROWER,
  [GRENADE_LAUNCHER.id]: GRENADE_LAUNCHER,
  [BOMB_PLACER.id]: BOMB_PLACER,
  [FIREBALL_STAFF.id]: FIREBALL_STAFF
};
