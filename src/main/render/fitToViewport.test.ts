import { describe, expect, it } from 'vitest';

import { fitCanvasToViewport } from './fitToViewport';

describe('fitCanvasToViewport', () => {
  it('uses pillarbox (height-bound) when viewport is wider than arena aspect', () => {
    const fit = fitCanvasToViewport({ viewportWidth: 2400, viewportHeight: 1080, arenaAspect: 32 / 18 });
    expect(fit.height).toBe(1080);
    expect(fit.width).toBeCloseTo((1080 * 32) / 18, 6);
    expect(fit.width).toBeLessThanOrEqual(2400);
  });

  it('uses letterbox (width-bound) when viewport is narrower than arena aspect', () => {
    const fit = fitCanvasToViewport({ viewportWidth: 800, viewportHeight: 1200, arenaAspect: 32 / 18 });
    expect(fit.width).toBe(800);
    expect(fit.height).toBeCloseTo(800 / (32 / 18), 6);
    expect(fit.height).toBeLessThanOrEqual(1200);
  });

  it('returns the viewport itself when aspect ratios match exactly', () => {
    const fit = fitCanvasToViewport({ viewportWidth: 1600, viewportHeight: 900, arenaAspect: 16 / 9 });
    expect(fit.width).toBeCloseTo(1600, 6);
    expect(fit.height).toBeCloseTo(900, 6);
  });

  it('preserves arena aspect (gameplay surface independent of screen)', () => {
    for (const sample of [
      { viewportWidth: 800, viewportHeight: 600, arenaAspect: 32 / 18 },
      { viewportWidth: 5120, viewportHeight: 1440, arenaAspect: 32 / 18 },
      { viewportWidth: 411, viewportHeight: 731, arenaAspect: 32 / 18 }
    ]) {
      const fit = fitCanvasToViewport(sample);
      expect(fit.width / fit.height).toBeCloseTo(sample.arenaAspect, 6);
    }
  });

  it('returns zero size for non-positive inputs', () => {
    expect(fitCanvasToViewport({ viewportWidth: 0, viewportHeight: 1080, arenaAspect: 16 / 9 })).toEqual({
      width: 0,
      height: 0
    });
    expect(fitCanvasToViewport({ viewportWidth: 1920, viewportHeight: 0, arenaAspect: 16 / 9 })).toEqual({
      width: 0,
      height: 0
    });
    expect(fitCanvasToViewport({ viewportWidth: 1920, viewportHeight: 1080, arenaAspect: 0 })).toEqual({
      width: 0,
      height: 0
    });
  });
});
