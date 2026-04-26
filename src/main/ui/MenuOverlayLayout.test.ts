import { describe, expect, it } from 'vitest';

import { MAIN_MENU_CONTROLS, MAIN_MENU_STAGE } from './MenuOverlayLayout';

describe('MenuOverlayLayout', () => {
  it('uses the mockup reference stage and bg-main background', () => {
    expect(MAIN_MENU_STAGE).toEqual({
      width: 1000,
      height: 707,
      background: '/images/bg/bg-main.jpg'
    });
  });

  it('contains every sliced main menu asset exactly once', () => {
    expect(MAIN_MENU_CONTROLS.map((control) => control.src)).toEqual([
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

  it('keeps controls inside stable stage bounds', () => {
    for (const control of MAIN_MENU_CONTROLS) {
      expect(control.leftPercent).toBeGreaterThanOrEqual(0);
      expect(control.topPercent).toBeGreaterThanOrEqual(0);
      expect(control.widthPercent).toBeGreaterThan(0);
      expect(control.leftPercent + control.widthPercent).toBeLessThanOrEqual(100);
      expect(control.aspectRatio).toBeGreaterThan(0);
      const heightPercent =
        (control.widthPercent / control.aspectRatio) *
        (MAIN_MENU_STAGE.width / MAIN_MENU_STAGE.height);
      expect(control.topPercent + heightPercent).toBeLessThanOrEqual(100);
    }
  });
});
