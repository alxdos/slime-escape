export type RenderScalePreset = 'low' | 'medium' | 'high';

export type ResolveRenderScaleInput = Readonly<{
  preset: RenderScalePreset;
  cssWidthPx: number;
  cssHeightPx: number;
  devicePixelRatio: number;
}>;

export type RenderScaleResolution = Readonly<{
  cssWidthPx: number;
  cssHeightPx: number;
  backingWidthPx: number;
  backingHeightPx: number;
  pixelRatio: number;
  imageRendering: 'auto' | 'pixelated';
}>;

const LOW_SCALE_DIVISOR = 4;
const MAX_DEVICE_PIXEL_RATIO = 2;
const MIN_BACKING_PX = 1;

export function resolveRenderScale(input: ResolveRenderScaleInput): RenderScaleResolution {
  const { cssWidthPx, cssHeightPx, preset } = input;

  switch (preset) {
    case 'low':
      return {
        cssWidthPx,
        cssHeightPx,
        backingWidthPx: toBackingPixels(cssWidthPx / LOW_SCALE_DIVISOR),
        backingHeightPx: toBackingPixels(cssHeightPx / LOW_SCALE_DIVISOR),
        pixelRatio: 1,
        imageRendering: 'pixelated'
      };
    case 'medium':
      return {
        cssWidthPx,
        cssHeightPx,
        backingWidthPx: toBackingPixels(cssWidthPx),
        backingHeightPx: toBackingPixels(cssHeightPx),
        pixelRatio: 1,
        imageRendering: 'auto'
      };
    case 'high':
      return {
        cssWidthPx,
        cssHeightPx,
        backingWidthPx: toBackingPixels(cssWidthPx),
        backingHeightPx: toBackingPixels(cssHeightPx),
        pixelRatio: clampDevicePixelRatio(input.devicePixelRatio),
        imageRendering: 'auto'
      };
    default:
      return assertNever(preset);
  }
}

function toBackingPixels(value: number): number {
  return Math.max(MIN_BACKING_PX, Math.round(value));
}

function clampDevicePixelRatio(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return Math.min(MAX_DEVICE_PIXEL_RATIO, value);
}

function assertNever(value: never): never {
  throw new Error(`Unexpected render scale preset: ${String(value)}`);
}
