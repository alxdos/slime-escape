import { LASER, PISTOL, SHOTGUN, SMG, SNIPER } from './weapons.generated';

export type WeaponArchetype = Readonly<{
  id: string;
  displayName: string;
  cooldownMs: number;
  projectileSpeed: number;
  projectileRadius: number;
  projectileTtlMs: number;
  damage: number;
  knockbackImpulse: number;
  color: number;
}>;

export { LASER, PISTOL, SHOTGUN, SMG, SNIPER };

export const WEAPON_ARCHETYPES: Readonly<Record<string, WeaponArchetype>> = {
  [PISTOL.id]: PISTOL,
  [SHOTGUN.id]: SHOTGUN,
  [SMG.id]: SMG,
  [SNIPER.id]: SNIPER,
  [LASER.id]: LASER
};
