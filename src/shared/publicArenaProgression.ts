import { PUBLIC_ARENA_LOADOUT, PUBLIC_ARENA_PLAYER } from './content/publicArena.js';
import { ENEMY_ARCHETYPE_LIST } from './content/enemies.generated.js';

export type PublicArenaRegularFormStats = Readonly<{
  archetypeId: string;
  radius: number;
  maxHp: number;
  maxSpeed: number;
}>;

export const PUBLIC_ARENA_REGULAR_WEAPON_IDS = requirePublicArenaRegularWeaponIds();
export const PUBLIC_ARENA_REGULAR_SELECTED_WEAPON_INDEX =
  requireSelectedPublicArenaWeaponIndex(PUBLIC_ARENA_REGULAR_WEAPON_IDS);
export const PUBLIC_ARENA_REGULAR_WEAPON_ID = weaponIdAtIndex(
  PUBLIC_ARENA_REGULAR_WEAPON_IDS,
  PUBLIC_ARENA_REGULAR_SELECTED_WEAPON_INDEX
);
export const PUBLIC_ARENA_BOSS_WEAPON_ID = 'fireball-staff';
export const PUBLIC_ARENA_BOSS_ARCHETYPE_ID = 'boss-tower-sentinel';
export const PUBLIC_ARENA_REGULAR_FORM_STATS: ReadonlyArray<PublicArenaRegularFormStats> =
  ENEMY_ARCHETYPE_LIST.map((enemy) => ({
    archetypeId: enemy.id,
    radius: enemy.radius,
    maxHp: PUBLIC_ARENA_PLAYER.maxHp,
    maxSpeed: PUBLIC_ARENA_PLAYER.maxSpeed
  }));
export const PUBLIC_ARENA_SLIME_FORM_CHAIN = PUBLIC_ARENA_REGULAR_FORM_STATS.map(
  (form) => form.archetypeId
);
export const PUBLIC_ARENA_BOSS_LEVEL = PUBLIC_ARENA_SLIME_FORM_CHAIN.length + 1;

function requirePublicArenaRegularWeaponIds(): ReadonlyArray<string> {
  const weaponIds: ReadonlyArray<string> = PUBLIC_ARENA_LOADOUT.weapons;
  if (weaponIds.length === 0) {
    throw new Error('Public Arena portal loadout must include at least one weapon.');
  }
  return [...weaponIds];
}

function requireSelectedPublicArenaWeaponIndex(weaponIds: ReadonlyArray<string>): number {
  const selectedIndex = PUBLIC_ARENA_LOADOUT.selectedIndex;
  if (selectedIndex === null) {
    throw new Error('Public Arena portal loadout must select a weapon.');
  }
  if (weaponIds[selectedIndex] === undefined) {
    throw new Error(`Public Arena portal loadout has invalid selected index ${selectedIndex}.`);
  }
  return selectedIndex;
}

function weaponIdAtIndex(weaponIds: ReadonlyArray<string>, selectedIndex: number): string {
  const weaponId = weaponIds[selectedIndex];
  if (weaponId === undefined) {
    throw new Error(`Public Arena portal loadout has invalid selected index ${selectedIndex}.`);
  }
  return weaponId;
}
