import { describe, expect, it } from 'vitest';

import {
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
    expect(profile.screenLandscapeAspect).toBeCloseTo(844 / 390, 6);
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
      { isMobile: false, screenLandscapeAspect: 16 / 9 },
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
      { isMobile: true, screenLandscapeAspect: 844 / 390 },
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
      { isMobile: true, screenLandscapeAspect: 844 / 390 },
      { width: 844, height: 390 }
    );

    expect(viewport).toEqual({
      width: 844,
      height: 390,
      isPortraitViewport: false
    });
  });
});
