// AUTO-GENERATED from content/bosses.md by `npm run content:build`.
// Do not edit by hand.
import type { SpriteVisualSpec } from './SpriteVisualSpec';

export const BOSS_GARGOYLE_VISUAL: SpriteVisualSpec = {
  archetypeId: 'boss-gargoyle',
  image: '/assets/boss-01.png',
  sourceSizePx: { width: 699, height: 570 },
  worldSize: { width: 2.9125, height: 2.375 },
  anchor: { x: 0.5, y: 0.5 }
};

export const BOSS_SAW_CYCLOPS_VISUAL: SpriteVisualSpec = {
  archetypeId: 'boss-saw-cyclops',
  image: '/assets/boss-02.png',
  sourceSizePx: { width: 453, height: 530 },
  worldSize: { width: 1.8875, height: 2.2083333333333335 },
  anchor: { x: 0.5, y: 0.5 }
};

export const BOSS_SCRAP_KING_VISUAL: SpriteVisualSpec = {
  archetypeId: 'boss-scrap-king',
  image: '/assets/boss-03.png',
  sourceSizePx: { width: 682, height: 787 },
  worldSize: { width: 2.841666666666667, height: 3.279166666666667 },
  anchor: { x: 0.5, y: 0.5 }
};

export const BOSS_TOWER_SENTINEL_VISUAL: SpriteVisualSpec = {
  archetypeId: 'boss-tower-sentinel',
  image: '/assets/boss-04.png',
  sourceSizePx: { width: 435, height: 708 },
  worldSize: { width: 1.8125, height: 2.95 },
  anchor: { x: 0.5, y: 0.5 }
};

export const BOSS_BUBBLE_HOG_VISUAL: SpriteVisualSpec = {
  archetypeId: 'boss-bubble-hog',
  image: '/assets/boss-05.png',
  sourceSizePx: { width: 533, height: 574 },
  worldSize: { width: 2.220833333333333, height: 2.3916666666666666 },
  anchor: { x: 0.5, y: 0.5 }
};

export const BOSS_VISUAL_SPECS = [BOSS_GARGOYLE_VISUAL, BOSS_SAW_CYCLOPS_VISUAL, BOSS_SCRAP_KING_VISUAL, BOSS_TOWER_SENTINEL_VISUAL, BOSS_BUBBLE_HOG_VISUAL] as const satisfies ReadonlyArray<SpriteVisualSpec>;
