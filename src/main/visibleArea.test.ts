import { describe, expect, it } from 'vitest';

import {
  clampVisibleAreaCenter,
  createVisibleAreaCamera,
  resolveInitialVisibleArea,
  resolveVisibleAreaSize
} from './visibleArea';

const ARENA = { width: 32, height: 18 };
const PUBLIC_ARENA = { width: 35, height: 35 };

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

describe('createVisibleAreaCamera', () => {
  it('keeps the camera still while the player stays inside the free-movement zone', () => {
    const camera = createVisibleAreaCamera({
      arena: ARENA,
      profile: 'mobile',
      effectiveViewport: { width: 844, height: 390 },
      playerPosition: { x: 0, y: 0 }
    });
    const before = camera.visibleArea().center;

    camera.follow({ x: 1, y: 1 }, 100);
    camera.follow({ x: 1, y: 1 }, 240);

    expect(camera.visibleArea().center).toEqual(before);
  });

  it('starts following earlier in larger desktop arenas', () => {
    const camera = createVisibleAreaCamera({
      arena: PUBLIC_ARENA,
      profile: 'desktop',
      effectiveViewport: { width: 1920, height: 1080 },
      playerPosition: { x: 0, y: 0 }
    });

    expect(camera.visibleArea()).toMatchObject({
      width: 32,
      height: 18,
      center: { x: 0, y: 0 }
    });

    camera.follow({ x: 6, y: 3.25 }, 0);
    camera.follow({ x: 6, y: 3.25 }, 140);

    expect(camera.visibleArea().center.x).toBeGreaterThan(0);
    expect(camera.visibleArea().center.y).toBeGreaterThan(0);
  });

  it('smoothly follows when the player leaves the free-movement zone', () => {
    const camera = createVisibleAreaCamera({
      arena: ARENA,
      profile: 'mobile',
      effectiveViewport: { width: 844, height: 390 },
      playerPosition: { x: 0, y: 0 }
    });

    camera.follow({ x: 9, y: 0 }, 0);
    camera.follow({ x: 9, y: 0 }, 140);

    expect(camera.visibleArea().center.x).toBeGreaterThan(0);
    expect(camera.visibleArea().center.x).toBeLessThan(9);
    expect(camera.visibleArea().center.y).toBe(0);
  });

  it('clamps following at the arena edge', () => {
    const camera = createVisibleAreaCamera({
      arena: ARENA,
      profile: 'mobile',
      effectiveViewport: { width: 844, height: 390 },
      playerPosition: { x: 0, y: 0 }
    });

    camera.follow({ x: 100, y: 100 }, 0);
    camera.follow({ x: 100, y: 100 }, 10_000);

    const visibleArea = camera.visibleArea();
    expect(visibleArea.center.x).toBeCloseTo((ARENA.width - visibleArea.width) / 2, 6);
    expect(visibleArea.center.y).toBeCloseTo((ARENA.height - visibleArea.height) / 2, 6);
  });

  it('keeps the current center clamped when the visible area is resized', () => {
    const camera = createVisibleAreaCamera({
      arena: ARENA,
      profile: 'mobile',
      effectiveViewport: { width: 844, height: 390 },
      playerPosition: { x: 4, y: 2 }
    });

    camera.resize({ width: 3000, height: 1000 });

    const visibleArea = camera.visibleArea();
    expect(visibleArea.width).toBe(32);
    expect(visibleArea.center.x).toBe(0);
    expect(visibleArea.center.y).toBe(2);
  });
});
