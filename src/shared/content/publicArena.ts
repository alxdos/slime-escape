import {
  PUBLIC_ARENA_HOST_CONTENT,
  PUBLIC_ARENA_PRESENTATION_CONTENT
} from './publicArena.generated.js';
import type { PublicArenaWorldBounds } from '../arenaHostProtocol.js';

type PublicArenaPlayerSpawn = Readonly<{
  position: Readonly<{ x: number; y: number }>;
  radius: number;
  contactBox: Readonly<{ width: number; height: number }>;
  maxSpeed: number;
  maxHp: number;
}>;

type PublicArenaLoadout = Readonly<{
  weapons: ReadonlyArray<string>;
  selectedIndex: number | null;
}>;

export type PublicArenaArenaConfig = Readonly<{
  width: number;
  height: number;
}>;

export type PublicArenaBackgroundConfig = Readonly<{
  id: string;
  imageUrl: string;
}>;

export type PublicArenaPresentationConfig = Readonly<{
  arena: PublicArenaArenaConfig;
  player: PublicArenaPlayerSpawn;
  loadout: PublicArenaLoadout;
  backgrounds: ReadonlyArray<PublicArenaBackgroundConfig>;
  activeBackgroundId: string;
}>;

export type PublicArenaHostContent = Readonly<{
  sessionPresetId: string;
  player: PublicArenaPlayerSpawn;
  loadout: PublicArenaLoadout;
  bossWeaponId: string;
  bossArchetypeId: string;
  spawnInvulnerabilityMs: number;
}>;

export const PUBLIC_ARENA_PRESENTATION_CONFIG =
  PUBLIC_ARENA_PRESENTATION_CONTENT satisfies PublicArenaPresentationConfig;
export const PUBLIC_ARENA_HOST_CONFIG =
  PUBLIC_ARENA_HOST_CONTENT satisfies PublicArenaHostContent;

export const PUBLIC_ARENA_ARENA = PUBLIC_ARENA_PRESENTATION_CONFIG.arena;
export const PUBLIC_ARENA_PLAYER = PUBLIC_ARENA_PRESENTATION_CONFIG.player;
export const PUBLIC_ARENA_LOADOUT = PUBLIC_ARENA_PRESENTATION_CONFIG.loadout;
export const PUBLIC_ARENA_BACKGROUNDS = PUBLIC_ARENA_PRESENTATION_CONFIG.backgrounds;
export const PUBLIC_ARENA_ACTIVE_BACKGROUND_ID =
  PUBLIC_ARENA_PRESENTATION_CONFIG.activeBackgroundId;
export const PUBLIC_ARENA_WORLD_BOUNDS = worldBoundsFromArena(PUBLIC_ARENA_ARENA);
export const PUBLIC_ARENA_HOST_SESSION_PRESET_ID =
  PUBLIC_ARENA_HOST_CONFIG.sessionPresetId;
export const PUBLIC_ARENA_HOST_PLAYER = PUBLIC_ARENA_HOST_CONFIG.player;
export const PUBLIC_ARENA_HOST_LOADOUT = PUBLIC_ARENA_HOST_CONFIG.loadout;
export const PUBLIC_ARENA_HOST_BOSS_WEAPON_ID =
  PUBLIC_ARENA_HOST_CONFIG.bossWeaponId;
export const PUBLIC_ARENA_HOST_BOSS_ARCHETYPE_ID =
  PUBLIC_ARENA_HOST_CONFIG.bossArchetypeId;
export const PUBLIC_ARENA_SPAWN_INVULNERABILITY_MS =
  PUBLIC_ARENA_HOST_CONFIG.spawnInvulnerabilityMs;

export function worldBoundsFromArena(arena: PublicArenaArenaConfig): PublicArenaWorldBounds {
  return {
    width: arena.width,
    height: arena.height,
    minX: -arena.width / 2,
    maxX: arena.width / 2,
    minY: -arena.height / 2,
    maxY: arena.height / 2
  };
}
