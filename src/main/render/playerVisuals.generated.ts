// AUTO-GENERATED from content/players.md by `npm run content:build`.
// Do not edit by hand.
import type { SpriteVisualSpec } from './SpriteVisualSpec';

export const HERO_SANDBOX_VISUAL: SpriteVisualSpec = {
  archetypeId: 'hero-sandbox',
  image: '/assets/hero.png',
  sourceSizePx: { width: 294, height: 550 },
  worldSize: { width: 1.47, height: 2.75 },
  anchor: { x: 0.5, y: 0.5 }
};

export const HERO_TRAINING_VISUAL: SpriteVisualSpec = {
  archetypeId: 'hero-training',
  image: '/assets/hero.png',
  sourceSizePx: { width: 294, height: 550 },
  worldSize: { width: 1.47, height: 2.75 },
  anchor: { x: 0.5, y: 0.5 }
};

export const PLAYER_VISUAL_SPECS = [HERO_SANDBOX_VISUAL, HERO_TRAINING_VISUAL] as const satisfies ReadonlyArray<SpriteVisualSpec>;
