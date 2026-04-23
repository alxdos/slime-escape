import { PISTOL } from './weapons.generated';

export type WeaponArchetype = Readonly<{
  id: string;
  displayName: string;
  cooldownMs: number;
  projectileSpeed: number;
  projectileRadius: number;
  projectileTtlMs: number;
  damage: number;
  color: number;
}>;

export { PISTOL };

export const WEAPON_ARCHETYPES: Readonly<Record<string, WeaponArchetype>> = {
  [PISTOL.id]: PISTOL
};
