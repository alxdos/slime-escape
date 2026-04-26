import { BOSS_VISUALS } from '../render/bossVisuals';
import { DROP_VISUALS } from '../render/dropVisuals';
import { ENEMY_VISUALS } from '../render/enemyVisuals';
import { PLAYER_VISUALS } from '../render/playerVisuals';
import { PROJECTILE_VISUALS } from '../render/projectileVisuals';

export const STARTUP_SPRITE_SPECS = Object.freeze([
  ...Object.values(PLAYER_VISUALS),
  ...Object.values(ENEMY_VISUALS),
  ...Object.values(BOSS_VISUALS),
  ...Object.values(PROJECTILE_VISUALS),
  ...Object.values(DROP_VISUALS)
]);

export const STARTUP_UI_IMAGE_URLS = Object.freeze([
  '/images/slime-escape.jpg',
  '/images/title-800.png',
  '/images/bg/bg-main.jpg',
  '/images/menu/menu-main-settings.png',
  '/images/menu/menu-main-soon.png',
  '/images/menu/menu-main-fullscreen.png',
  '/images/menu/menu-main-mode-easy.png',
  '/images/menu/menu-main-mode-normal.png',
  '/images/menu/menu-main-mode-hard.png',
  '/images/menu/menu-main-play.png',
  '/images/menu/menu-main-training.png',
  '/images/menu/menu-main-pets.png',
  '/images/menu/menu-main-dungeon.png',
  '/images/menu/menu-main-lab.png'
]);
