// AUTO-GENERATED from content/weapons.md by `npm run content:build`.
// Do not edit by hand.
import type { SpriteVisualSpec } from './SpriteVisualSpec';

export const PISTOL_PROJECTILE_VISUAL: SpriteVisualSpec = {
  archetypeId: 'pistol',
  image: '/assets/projectiles/pistol.png',
  sourceSizePx: { width: 65, height: 41 },
  worldSize: { width: 0.2708333333333333, height: 0.17083333333333334 },
  anchor: { x: 0.5, y: 0.5 }
};

export const SHOTGUN_PROJECTILE_VISUAL: SpriteVisualSpec = {
  archetypeId: 'shotgun',
  image: '/assets/projectiles/shotgun.png',
  sourceSizePx: { width: 64, height: 57 },
  worldSize: { width: 0.26666666666666666, height: 0.2375 },
  anchor: { x: 0.5, y: 0.5 }
};

export const SMG_PROJECTILE_VISUAL: SpriteVisualSpec = {
  archetypeId: 'smg',
  image: '/assets/projectiles/smg.png',
  sourceSizePx: { width: 82, height: 40 },
  worldSize: { width: 0.3416666666666667, height: 0.16666666666666666 },
  anchor: { x: 0.5, y: 0.5 }
};

export const SNIPER_PROJECTILE_VISUAL: SpriteVisualSpec = {
  archetypeId: 'sniper',
  image: '/assets/projectiles/sniper.png',
  sourceSizePx: { width: 233, height: 46 },
  worldSize: { width: 0.9708333333333333, height: 0.19166666666666668 },
  anchor: { x: 0.5, y: 0.5 }
};

export const LASER_PROJECTILE_VISUAL: SpriteVisualSpec = {
  archetypeId: 'laser',
  image: '/assets/projectiles/laser.png',
  sourceSizePx: { width: 600, height: 31 },
  worldSize: { width: 2.5, height: 0.12916666666666668 },
  anchor: { x: 0.5, y: 0.5 }
};

export const ROCK_THROWER_PROJECTILE_VISUAL: SpriteVisualSpec = {
  archetypeId: 'rock-thrower',
  image: '/assets/projectiles/rock-thrower.png',
  sourceSizePx: { width: 130, height: 118 },
  worldSize: { width: 0.5416666666666666, height: 0.49166666666666664 },
  anchor: { x: 0.5, y: 0.5 }
};

export const GRENADE_LAUNCHER_PROJECTILE_VISUAL: SpriteVisualSpec = {
  archetypeId: 'grenade-launcher',
  image: '/assets/projectiles/grenade-launcher.png',
  sourceSizePx: { width: 80, height: 93 },
  worldSize: { width: 0.3333333333333333, height: 0.3875 },
  anchor: { x: 0.5, y: 0.5 }
};

export const BOMB_PLACER_PROJECTILE_VISUAL: SpriteVisualSpec = {
  archetypeId: 'bomb-placer',
  image: '/assets/projectiles/bomb-placer.png',
  sourceSizePx: { width: 184, height: 175 },
  worldSize: { width: 0.7666666666666667, height: 0.7291666666666666 },
  anchor: { x: 0.5, y: 0.5 }
};

export const FIREBALL_STAFF_PROJECTILE_VISUAL: SpriteVisualSpec = {
  archetypeId: 'fireball-staff',
  image: '/assets/projectiles/fireball-staff.png',
  sourceSizePx: { width: 177, height: 183 },
  worldSize: { width: 0.7375, height: 0.7625 },
  anchor: { x: 0.5, y: 0.5 }
};

export const DEMO_HAZARD_GRENADE_PROJECTILE_VISUAL: SpriteVisualSpec = {
  archetypeId: 'demo-hazard-grenade',
  image: '/assets/projectiles/grenade-launcher.png',
  sourceSizePx: { width: 80, height: 93 },
  worldSize: { width: 0.3333333333333333, height: 0.3875 },
  anchor: { x: 0.5, y: 0.5 }
};

export const DEMO_PROXIMITY_MINE_PROJECTILE_VISUAL: SpriteVisualSpec = {
  archetypeId: 'demo-proximity-mine',
  image: '/assets/projectiles/bomb-placer.png',
  sourceSizePx: { width: 184, height: 175 },
  worldSize: { width: 0.7666666666666667, height: 0.7291666666666666 },
  anchor: { x: 0.5, y: 0.5 }
};

export const PROJECTILE_VISUAL_SPECS = [PISTOL_PROJECTILE_VISUAL, SHOTGUN_PROJECTILE_VISUAL, SMG_PROJECTILE_VISUAL, SNIPER_PROJECTILE_VISUAL, LASER_PROJECTILE_VISUAL, ROCK_THROWER_PROJECTILE_VISUAL, GRENADE_LAUNCHER_PROJECTILE_VISUAL, BOMB_PLACER_PROJECTILE_VISUAL, FIREBALL_STAFF_PROJECTILE_VISUAL, DEMO_HAZARD_GRENADE_PROJECTILE_VISUAL, DEMO_PROXIMITY_MINE_PROJECTILE_VISUAL] as const satisfies ReadonlyArray<SpriteVisualSpec>;
