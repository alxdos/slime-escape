import { PUBLIC_ARENA_LOADOUT, PUBLIC_ARENA_PLAYER } from './content/publicArena.js';
import { ENEMY_ARCHETYPE_LIST } from './content/enemies.generated.js';

export type PublicArenaRegularFormStats = Readonly<{
  archetypeId: string;
  radius: number;
  maxHp: number;
  maxSpeed: number;
}>;

export const PUBLIC_ARENA_REGULAR_WEAPON_ID = requireSelectedPublicArenaWeaponId();
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

function requireSelectedPublicArenaWeaponId(): string {
  const selectedIndex = PUBLIC_ARENA_LOADOUT.selectedIndex;
  if (selectedIndex === null) {
    throw new Error('Public Arena portal loadout must select a weapon.');
  }
  const weaponId = PUBLIC_ARENA_LOADOUT.weapons[selectedIndex];
  if (weaponId === undefined) {
    throw new Error(`Public Arena portal loadout has invalid selected index ${selectedIndex}.`);
  }
  return weaponId;
}
