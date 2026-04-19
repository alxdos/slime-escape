export type FeatureSupport = Readonly<{
  worker: boolean;
  offscreenCanvas: boolean;
  transferControlToOffscreen: boolean;
}>;

export function detectFeatures(): FeatureSupport {
  const worker = typeof Worker !== 'undefined';
  const offscreenCanvas = typeof OffscreenCanvas !== 'undefined';
  const transferControlToOffscreen =
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.transferControlToOffscreen === 'function';

  return { worker, offscreenCanvas, transferControlToOffscreen };
}
