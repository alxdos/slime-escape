import { describe, expect, it } from 'vitest';

import {
  clampVisibleAreaCenter,
  resolveInitialVisibleArea,
  resolveVisibleAreaSize
} from './visibleArea';

const ARENA = { width: 32, height: 18 };

describe('resolveVisibleAreaSize', () => {
  it('keeps the current desktop arena fully visible with the desktop anchor', () => {
    expect(
      resolveVisibleAreaSize({
        arena: ARENA,
        profile: 'desktop',
        effectiveViewport: { width: 800, height: 1200 }
      })
    ).toEqual({ width: 32, height: 18 });
  });

  it('uses the mobile short-side anchor and effective landscape viewport aspect', () => {
    const size = resolveVisibleAreaSize({
      arena: ARENA,
      profile: 'mobile',
      effectiveViewport: { width: 844, height: 390 }
    });

    expect(size.height).toBe(12);
    expect(size.width).toBeCloseTo(12 * (844 / 390), 6);
    expect(size.width).toBeLessThan(ARENA.width);
  });

  it('fits the resolved visible area inside the arena when the requested aspect is too wide', () => {
    const size = resolveVisibleAreaSize({
      arena: ARENA,
      profile: 'mobile',
      effectiveViewport: { width: 3000, height: 1000 }
    });

    expect(size.width).toBe(32);
    expect(size.height).toBeCloseTo(32 / 3, 6);
  });
});

describe('resolveInitialVisibleArea', () => {
  it('starts centered on the player while the visible area can still fit', () => {
    const visibleArea = resolveInitialVisibleArea({
      arena: ARENA,
      profile: 'mobile',
      effectiveViewport: { width: 844, height: 390 },
      playerPosition: { x: 3, y: 2 }
    });

    expect(visibleArea.center).toEqual({ x: 3, y: 2 });
  });

  it('clamps the initial center so the visible area stays inside the arena', () => {
    const visibleArea = resolveInitialVisibleArea({
      arena: ARENA,
      profile: 'mobile',
      effectiveViewport: { width: 844, height: 390 },
      playerPosition: { x: 20, y: 20 }
    });

    expect(visibleArea.center.x).toBeCloseTo((ARENA.width - visibleArea.width) / 2, 6);
    expect(visibleArea.center.y).toBeCloseTo((ARENA.height - visibleArea.height) / 2, 6);
  });
});

describe('clampVisibleAreaCenter', () => {
  it('uses arena center on axes where the visible area equals the arena', () => {
    expect(
      clampVisibleAreaCenter(
        ARENA,
        { width: ARENA.width, height: 12 },
        { x: 5, y: -2 }
      )
    ).toEqual({ x: 0, y: -2 });
  });
});
