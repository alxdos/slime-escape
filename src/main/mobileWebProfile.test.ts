import { describe, expect, it } from 'vitest';

import {
  createGameSurfaceController,
  detectMobileWebProfile,
  resolveEffectiveGameViewport
} from './mobileWebProfile';

describe('detectMobileWebProfile', () => {
  it('marks touch devices with portrait physical screens as mobile', () => {
    const profile = detectMobileWebProfile({
      maxTouchPoints: 5,
      screenWidth: 390,
      screenHeight: 844
    });

    expect(profile.isMobile).toBe(true);
  });

  it('keeps tall non-touch desktop windows on the desktop path', () => {
    const profile = detectMobileWebProfile({
      maxTouchPoints: 0,
      screenWidth: 900,
      screenHeight: 1600
    });

    expect(profile.isMobile).toBe(false);
  });

  it('does not enter mobile mode when a touch screen starts in landscape', () => {
    const profile = detectMobileWebProfile({
      maxTouchPoints: 5,
      screenWidth: 844,
      screenHeight: 390
    });

    expect(profile.isMobile).toBe(false);
  });
});

describe('resolveEffectiveGameViewport', () => {
  it('uses the raw viewport on desktop even when it is portrait-shaped', () => {
    const viewport = resolveEffectiveGameViewport(
      { isMobile: false },
      { width: 500, height: 900 }
    );

    expect(viewport).toEqual({
      width: 500,
      height: 900,
      isPortraitViewport: true
    });
  });

  it('uses a stable landscape effective viewport on mobile portrait', () => {
    const viewport = resolveEffectiveGameViewport(
      { isMobile: true },
      { width: 390, height: 844 }
    );

    expect(viewport).toEqual({
      width: 844,
      height: 390,
      isPortraitViewport: true
    });
  });

  it('keeps mobile landscape unrotated while preserving the same effective shape', () => {
    const viewport = resolveEffectiveGameViewport(
      { isMobile: true },
      { width: 844, height: 390 }
    );

    expect(viewport).toEqual({
      width: 844,
      height: 390,
      isPortraitViewport: false
    });
  });
});

describe('createGameSurfaceController', () => {
  it('keeps matchMedia bound to the browser window target', () => {
    let matchMediaReceiver: unknown = null;
    const windowTarget = {
      innerWidth: 390,
      innerHeight: 844,
      devicePixelRatio: 2,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      matchMedia(this: unknown, query: string): MediaQueryList {
        matchMediaReceiver = this;
        return { matches: query === '(test-query)' } as MediaQueryList;
      }
    };

    const controller = createGameSurfaceController({
      root: createFakeRoot(),
      profile: { isMobile: true },
      windowTarget
    });

    expect(controller.matchMedia?.('(test-query)').matches).toBe(true);
    expect(matchMediaReceiver).toBe(windowTarget);
  });
});

function createFakeRoot(): HTMLElement {
  const style = {
    setProperty: () => undefined
  };

  return { style } as unknown as HTMLElement;
}
