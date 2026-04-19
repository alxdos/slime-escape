import { buildSessionDefinition } from '../shared/content/buildSession';
import { SANDBOX_ARENA } from '../shared/content/arenas';
import { SANDBOX_PLAYER } from '../shared/content/players';
import { SANDBOX_PRESET } from '../shared/content/presets';

import { detectFeatures } from './featureDetection';
import { createInputController, type InputController } from './input/InputController';
import { createFpsOverlay } from './render/FpsOverlay';
import { createRenderer } from './render/Renderer';
import { createSimWorkerHost } from './sim/SimWorkerHost';
import { createMenuOverlay } from './ui/MenuOverlay';
import { createPauseOverlay } from './ui/PauseOverlay';

function requireCanvas(selector: string): HTMLCanvasElement {
  const el = document.querySelector<HTMLCanvasElement>(selector);
  if (!el) {
    throw new Error(`canvas not found by selector "${selector}"`);
  }
  return el;
}

function makeSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

detectFeatures();

const sim = createSimWorkerHost();
const canvas = requireCanvas('#scene');

let input: InputController | null = null;

const renderer = createRenderer({
  canvas,
  pixelRatio: Math.min(window.devicePixelRatio, 2),
  arena: SANDBOX_ARENA,
  player: SANDBOX_PLAYER,
  getSnapshotPair: sim.snapshotPair,
  getAim: () => (input !== null && input.isActive() ? input.currentAim() : null)
});

const fps = createFpsOverlay(document.body);

function pixelsPerWorldUnit(): number {
  return canvas.clientHeight / SANDBOX_ARENA.height;
}

function startSession(): void {
  if (input !== null) return;
  const session = buildSessionDefinition(SANDBOX_PRESET, { seed: makeSeed() });
  sim.startSession(session);
  input = createInputController({
    canvas,
    arena: session.arena,
    pixelsPerWorldUnit,
    initialAim: session.player.position,
    onCommand: sim.sendInput
  });
  input.start();
  menu.hide();
  pause.hide();
}

function exitToMenu(): void {
  const previous = input;
  input = null;
  if (previous !== null) {
    previous.stop();
  }
  sim.stopSession();
  pause.hide();
  menu.show();
}

function pauseSession(): void {
  if (input === null) return;
  if (pause.isVisible()) return;
  sim.pause();
  pause.show();
}

function resumeSession(): void {
  if (input === null) return;
  if (!pause.isVisible()) return;
  input.requestLock();
  sim.resume();
  pause.hide();
}

const menu = createMenuOverlay({
  parent: document.body,
  onStart: startSession
});

const pause = createPauseOverlay({
  parent: document.body,
  onResume: resumeSession,
  onExit: exitToMenu
});

window.addEventListener('resize', () => {
  renderer.fitToWindow();
});

document.addEventListener('pointerlockchange', () => {
  // Browsers consume the Esc keydown that releases Pointer Lock and never
  // forward it to JS, so the only reliable trigger for the pause overlay
  // is the lock loss itself (design/input-commands.md).
  if (document.pointerLockElement !== null) return;
  if (input === null) return;
  if (pause.isVisible()) return;
  pauseSession();
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape') {
    if (input === null) return;
    if (pause.isVisible()) return;
    pauseSession();
    return;
  }
  if (event.code === 'Space' && !event.repeat) {
    if (input === null || pause.isVisible()) return;
    event.preventDefault();
    if (sim.isPaused()) {
      sim.resume();
    } else {
      sim.pause();
    }
  }
});

function tick(nowMs: number): void {
  fps.onFrame(nowMs);
  renderer.render();
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
