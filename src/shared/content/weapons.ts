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

export const PISTOL: WeaponArchetype = {
  id: 'pistol',
  displayName: 'Pistol',
  cooldownMs: 250,
  projectileSpeed: 24,
  projectileRadius: 0.1,
  projectileTtlMs: 2000,
  damage: 1,
  color: 0xffd76b
};

export const WEAPON_ARCHETYPES: Readonly<Record<string, WeaponArchetype>> = {
  [PISTOL.id]: PISTOL
};
