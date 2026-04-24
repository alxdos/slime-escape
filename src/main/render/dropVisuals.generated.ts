// AUTO-GENERATED from content/drops.md by `npm run content:build`.
// Do not edit by hand.
import type { SpriteVisualSpec } from './SpriteVisualSpec';

export const HEAL_ORB_DROP_VISUAL: SpriteVisualSpec = {
  archetypeId: 'heal-orb',
  image: '/assets/drops/heal-orb.png',
  sourceSizePx: { width: 128, height: 140 },
  worldSize: { width: 0.5333333333333333, height: 0.5833333333333334 },
  anchor: { x: 0.5, y: 0.5 }
};

export const SIZE_UP_DROP_VISUAL: SpriteVisualSpec = {
  archetypeId: 'size-up',
  image: '/assets/drops/size-up.png',
  sourceSizePx: { width: 197, height: 176 },
  worldSize: { width: 0.8208333333333333, height: 0.7333333333333333 },
  anchor: { x: 0.5, y: 0.5 }
};

export const SPEED_UP_DROP_VISUAL: SpriteVisualSpec = {
  archetypeId: 'speed-up',
  image: '/assets/drops/speed-up.png',
  sourceSizePx: { width: 125, height: 171 },
  worldSize: { width: 0.5208333333333334, height: 0.7125 },
  anchor: { x: 0.5, y: 0.5 }
};

export const MULTI_SHOT_DROP_VISUAL: SpriteVisualSpec = {
  archetypeId: 'multi-shot',
  image: '/assets/drops/multi-shot.png',
  sourceSizePx: { width: 221, height: 188 },
  worldSize: { width: 0.9208333333333333, height: 0.7833333333333333 },
  anchor: { x: 0.5, y: 0.5 }
};

export const PIERCE_DROP_VISUAL: SpriteVisualSpec = {
  archetypeId: 'pierce',
  image: '/assets/drops/pierce.png',
  sourceSizePx: { width: 214, height: 182 },
  worldSize: { width: 0.8916666666666667, height: 0.7583333333333333 },
  anchor: { x: 0.5, y: 0.5 }
};

export const FRAGMENT_DROP_VISUAL: SpriteVisualSpec = {
  archetypeId: 'fragment',
  image: '/assets/drops/fragment.png',
  sourceSizePx: { width: 210, height: 196 },
  worldSize: { width: 0.875, height: 0.8166666666666667 },
  anchor: { x: 0.5, y: 0.5 }
};

export const OVERDRIVE_DROP_VISUAL: SpriteVisualSpec = {
  archetypeId: 'overdrive',
  image: '/assets/drops/overdrive.png',
  sourceSizePx: { width: 88, height: 117 },
  worldSize: { width: 0.36666666666666664, height: 0.4875 },
  anchor: { x: 0.5, y: 0.5 }
};

export const DROP_VISUAL_SPECS = [HEAL_ORB_DROP_VISUAL, SIZE_UP_DROP_VISUAL, SPEED_UP_DROP_VISUAL, MULTI_SHOT_DROP_VISUAL, PIERCE_DROP_VISUAL, FRAGMENT_DROP_VISUAL, OVERDRIVE_DROP_VISUAL] as const satisfies ReadonlyArray<SpriteVisualSpec>;
