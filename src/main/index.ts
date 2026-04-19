import { SANDBOX_ARENA } from '../shared/content/arenas';
import { SANDBOX_PLAYER } from '../shared/content/players';

import { detectFeatures } from './featureDetection';
import { createFpsOverlay } from './render/FpsOverlay';
import { createRenderer } from './render/Renderer';
import { createSimWorkerHost } from './sim/SimWorkerHost';

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
  arena: SANDBOX_ARENA,
  player: SANDBOX_PLAYER,
  getSnapshotPair: sim.snapshotPair
});

const fps = createFpsOverlay(document.body);

window.addEventListener('resize', () => {
  renderer.fitToWindow();
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
