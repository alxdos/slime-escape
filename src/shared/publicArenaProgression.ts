import { ENEMY_ARCHETYPE_LIST } from './content/enemies.generated.js';

export type PublicArenaRegularFormStats = Readonly<{
  archetypeId: string;
  radius: number;
  maxHp: number;
  maxSpeed: number;
}>;

export const PUBLIC_ARENA_REGULAR_WEAPON_ID = 'rock-thrower';
export const PUBLIC_ARENA_BOSS_WEAPON_ID = 'fireball-staff';
export const PUBLIC_ARENA_BOSS_ARCHETYPE_ID = 'boss-tower-sentinel';
export const PUBLIC_ARENA_REGULAR_FORM_STATS: ReadonlyArray<PublicArenaRegularFormStats> =
  ENEMY_ARCHETYPE_LIST.map((enemy) => ({
    archetypeId: enemy.id,
    radius: enemy.radius,
    maxHp: enemy.maxHp,
    maxSpeed: enemy.maxSpeed
  }));
export const PUBLIC_ARENA_SLIME_FORM_CHAIN = PUBLIC_ARENA_REGULAR_FORM_STATS.map(
  (form) => form.archetypeId
);
export const PUBLIC_ARENA_BOSS_LEVEL = PUBLIC_ARENA_SLIME_FORM_CHAIN.length + 1;
