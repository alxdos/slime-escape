import { describe, expect, it } from 'vitest';

import { STARTUP_UI_IMAGE_URLS } from './startupAssets';

describe('startup assets', () => {
  it('declares every required first-screen UI image', () => {
    expect(STARTUP_UI_IMAGE_URLS).toEqual([
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
  });
});
