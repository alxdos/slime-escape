import type { PublicArenaWorldBounds } from './publicArenaProtocol.js';

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
  backgrounds: ReadonlyArray<PublicArenaBackgroundConfig>;
  activeBackgroundId: string;
}>;

export const PUBLIC_ARENA_ARENA = {
  width: 40,
  height: 40
} as const satisfies PublicArenaArenaConfig;

export const PUBLIC_ARENA_BACKGROUNDS = [
  {
    id: 'portal',
    imageUrl: '/images/bg/bg-01.jpg'
  }
] as const satisfies ReadonlyArray<PublicArenaBackgroundConfig>;

export const PUBLIC_ARENA_ACTIVE_BACKGROUND_ID = 'portal';

export const PUBLIC_ARENA_PRESENTATION_CONFIG = {
  arena: PUBLIC_ARENA_ARENA,
  backgrounds: PUBLIC_ARENA_BACKGROUNDS,
  activeBackgroundId: PUBLIC_ARENA_ACTIVE_BACKGROUND_ID
} as const satisfies PublicArenaPresentationConfig;

export const PUBLIC_ARENA_WORLD_BOUNDS = worldBoundsFromArena(PUBLIC_ARENA_ARENA);

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
