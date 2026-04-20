import { detectFeatures } from './featureDetection';
import { createFpsOverlay } from './render/FpsOverlay';
import { createUiShell } from './ui/UiShell';

function requireCanvas(selector: string): HTMLCanvasElement {
  const el = document.querySelector<HTMLCanvasElement>(selector);
  if (!el) {
    throw new Error(`canvas not found by selector "${selector}"`);
  }
  return el;
}

detectFeatures();
const canvas = requireCanvas('#scene');
const fps = createFpsOverlay(document.body);
const uiShell = createUiShell({
  parent: document.body,
  canvas,
  pixelRatio: Math.min(window.devicePixelRatio, 2)
});

function tick(nowMs: number): void {
  fps.onFrame(nowMs);
  uiShell.onFrame();
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
