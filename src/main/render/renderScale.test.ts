import { describe, expect, it } from 'vitest';

import { resolveRenderScale, type RenderScalePreset } from './renderScale';

describe('resolveRenderScale', () => {
  it('resolves the low preset to quarter-resolution backing pixels and pixelated output', () => {
    expect(
      resolveRenderScale({
        preset: 'low',
        cssWidthPx: 800,
        cssHeightPx: 600,
        devicePixelRatio: 2
      })
    ).toEqual({
      cssWidthPx: 800,
      cssHeightPx: 600,
      backingWidthPx: 200,
      backingHeightPx: 150,
      pixelRatio: 1,
      imageRendering: 'pixelated'
    });
  });

  it('resolves the medium preset to CSS-sized backing pixels without DPR scaling', () => {
    expect(
      resolveRenderScale({
        preset: 'medium',
        cssWidthPx: 800,
        cssHeightPx: 600,
        devicePixelRatio: 2
      })
    ).toEqual({
      cssWidthPx: 800,
      cssHeightPx: 600,
      backingWidthPx: 800,
      backingHeightPx: 600,
      pixelRatio: 1,
      imageRendering: 'auto'
    });
  });

  it('resolves the high preset to CSS-sized backing pixels with DPR capped at two', () => {
    expect(
      resolveRenderScale({
        preset: 'high',
        cssWidthPx: 800,
        cssHeightPx: 600,
        devicePixelRatio: 4
      })
    ).toEqual({
      cssWidthPx: 800,
      cssHeightPx: 600,
      backingWidthPx: 800,
      backingHeightPx: 600,
      pixelRatio: 2,
      imageRendering: 'auto'
    });
  });

  it('keeps backing pixels at least 1x1 for degenerate CSS sizes in every preset', () => {
    for (const preset of ['low', 'medium', 'high'] as const satisfies ReadonlyArray<RenderScalePreset>) {
      const resolution = resolveRenderScale({
        preset,
        cssWidthPx: 0,
        cssHeightPx: -12,
        devicePixelRatio: 2
      });

      expect(resolution.backingWidthPx).toBe(1);
      expect(resolution.backingHeightPx).toBe(1);
    }
  });
});
