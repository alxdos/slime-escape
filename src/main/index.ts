import { detectFeatures } from './featureDetection';
import { createSimWorkerHost } from './sim/SimWorkerHost';
import { createRenderer } from './render/Renderer';

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

window.addEventListener('resize', () => {
  renderer.resize(canvas.clientWidth, canvas.clientHeight);
});

function tick(): void {
  renderer.render();
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
