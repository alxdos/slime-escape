import { detectFeatures } from './featureDetection';
import { createSimWorkerHost } from './sim/SimWorkerHost';
import { createRenderer } from './render/Renderer';
import { createFpsOverlay } from './render/FpsOverlay';

function requireCanvas(selector: string): HTMLCanvasElement {
  const el = document.querySelector<HTMLCanvasElement>(selector);
  if (!el) {
    throw new Error(`canvas not found by selector "${selector}"`);
  }
  return el;
}

detectFeatures();

const sim = createSimWorkerHost();

const canvas = requireCanvas('#scene');

const renderer = createRenderer({
  canvas,
  pixelRatio: Math.min(window.devicePixelRatio, 2),
  width: canvas.clientWidth,
  height: canvas.clientHeight,
  getSnapshotPair: sim.snapshotPair
});

const fps = createFpsOverlay(document.body);

window.addEventListener('resize', () => {
  renderer.resize(canvas.clientWidth, canvas.clientHeight);
});

let paused = false;

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || event.repeat) {
    return;
  }
  event.preventDefault();
  if (paused) {
    sim.resume();
    paused = false;
  } else {
    sim.pause();
    paused = true;
  }
});

function tick(nowMs: number): void {
  fps.onFrame(nowMs);
  renderer.render();
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
