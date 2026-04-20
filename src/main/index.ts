import { buildSessionDefinition } from '../shared/content/buildSession';
import { CAMPAIGN_PRESET } from '../shared/content/presets';
import { log } from '../shared/log';
import type { SessionDefinition } from '../shared/session';

import { detectFeatures } from './featureDetection';
import { createInputController, type InputController } from './input/InputController';
import { createFpsOverlay } from './render/FpsOverlay';
import { createRenderer, type Renderer } from './render/Renderer';
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

const sim = createSimWorkerHost({
  onEvent(event) {
    if (event.kind === 'win' || event.kind === 'loss') {
      handleRunEnd(event.kind, event.simTime);
      return;
    }
    if (
      event.kind === 'dropSpawn' ||
      event.kind === 'dropPickup' ||
      event.kind === 'dropExpire'
    ) {
      log.info(`drop event: ${event.kind}`, {
        simTime: event.simTime,
        entityId: event.entityId,
        archetypeId: event.archetypeId
      });
    }
  }
});
const canvas = requireCanvas('#scene');
const fps = createFpsOverlay(document.body);

let activeSession: SessionDefinition | null = null;
let renderer: Renderer | null = null;
let input: InputController | null = null;

function startSession(): void {
  if (activeSession !== null) return;

  menu.setResult(null);
  const session = buildSessionDefinition(CAMPAIGN_PRESET, { seed: makeSeed() });
  activeSession = session;
  sim.startSession(session);

  renderer = createRenderer({
    canvas,
    pixelRatio: Math.min(window.devicePixelRatio, 2),
    arena: session.arena,
    player: session.player,
    getSnapshotPair: sim.snapshotPair,
    getAim: () => (input !== null && input.isActive() ? input.currentAim() : null)
  });

  input = createInputController({
    canvas,
    arena: session.arena,
    pixelsPerWorldUnit: () => canvas.clientHeight / session.arena.height,
    initialAim: session.player.position,
    onCommand: sim.sendInput
  });
  input.start();

  menu.hide();
  pause.hide();
}

function tearDownClientSession(): void {
  const previousInput = input;
  input = null;
  if (previousInput !== null) {
    previousInput.stop();
  }

  if (renderer !== null) {
    renderer.dispose();
    renderer = null;
  }

  activeSession = null;
  pause.hide();
  menu.show();
}

function exitToMenu(): void {
  if (activeSession === null) return;
  tearDownClientSession();
  sim.stopSession();
}

function handleRunEnd(kind: 'win' | 'loss', simTimeMs: number): void {
  if (activeSession === null) return;
  log.info(`run ended: ${kind}`, { simTimeMs });
  // Sim has already torn down its own state via win/loss path; do not call
  // sim.stopSession() to avoid the "no active session" warning.
  tearDownClientSession();
  menu.setResult(kind);
}

function pauseSession(): void {
  if (activeSession === null) return;
  if (pause.isVisible()) return;
  sim.pause();
  pause.show();
}

function resumeSession(): void {
  if (activeSession === null) return;
  if (!pause.isVisible()) return;
  if (input !== null) {
    input.requestLock();
  }
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
  if (renderer !== null) {
    renderer.fitToWindow();
  }
});

document.addEventListener('pointerlockchange', () => {
  // Browsers consume the Esc keydown that releases Pointer Lock and never
  // forward it to JS, so the only reliable trigger for the pause overlay
  // is the lock loss itself (design/input-commands.md).
  if (document.pointerLockElement !== null) return;
  if (activeSession === null) return;
  if (pause.isVisible()) return;
  pauseSession();
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape') {
    if (activeSession === null) return;
    if (pause.isVisible()) return;
    pauseSession();
    return;
  }
  if (event.code === 'Space' && !event.repeat) {
    if (activeSession === null || pause.isVisible()) return;
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
  if (renderer !== null) {
    renderer.render();
  }
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
