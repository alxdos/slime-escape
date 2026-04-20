import { buildSessionDefinition } from '../../shared/content/buildSession';
import { CAMPAIGN_PRESET, type ModePreset } from '../../shared/content/presets';
import type { RuntimeEvent } from '../../shared/events';
import { log } from '../../shared/log';
import { assertNever } from '../../shared/protocol';
import type { SessionDefinition } from '../../shared/session';
import { createInputController, type InputController, type InputControllerInit } from '../input/InputController';
import { createRenderer, type Renderer, type RendererInit } from '../render/Renderer';
import {
  createSimWorkerHost,
  type SimWorkerHost,
  type SimWorkerHostOptions
} from '../sim/SimWorkerHost';

import {
  createMenuOverlay,
  type MenuOverlay,
  type MenuOverlayInit,
  type MenuResult
} from './MenuOverlay';
import { createPauseOverlay, type PauseOverlay, type PauseOverlayInit } from './PauseOverlay';

export type SessionResult = Exclude<MenuResult, null>;

export type UiShellPhase =
  | Readonly<{ kind: 'menu' }>
  | Readonly<{ kind: 'running' }>
  | Readonly<{ kind: 'paused' }>
  | Readonly<{ kind: 'result'; outcome: SessionResult }>;

type WindowTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;
type DocumentTarget = Pick<Document, 'addEventListener' | 'removeEventListener'> & {
  pointerLockElement: Element | null;
};

type BuildSessionDefinitionFn = typeof buildSessionDefinition;
type CreateSimWorkerHostFn = (options?: SimWorkerHostOptions) => SimWorkerHost;
type CreateMenuOverlayFn = (init: MenuOverlayInit) => MenuOverlay;
type CreatePauseOverlayFn = (init: PauseOverlayInit) => PauseOverlay;
type CreateRendererFn = (init: RendererInit) => Renderer;
type CreateInputControllerFn = (init: InputControllerInit) => InputController;

export type UiShellInit = Readonly<{
  parent: HTMLElement;
  canvas: HTMLCanvasElement;
  pixelRatio: number;
  defaultPreset?: ModePreset;
  buildSessionDefinition?: BuildSessionDefinitionFn;
  createSimWorkerHost?: CreateSimWorkerHostFn;
  createMenuOverlay?: CreateMenuOverlayFn;
  createPauseOverlay?: CreatePauseOverlayFn;
  createRenderer?: CreateRendererFn;
  createInputController?: CreateInputControllerFn;
  makeSeed?: () => number;
  windowTarget?: WindowTarget;
  documentTarget?: DocumentTarget;
}>;

export type UiShell = Readonly<{
  onFrame(): void;
  fitToWindow(): void;
  phase(): UiShellPhase;
  dispose(): void;
}>;

const MENU_PHASE: UiShellPhase = { kind: 'menu' };
const RUNNING_PHASE: UiShellPhase = { kind: 'running' };
const PAUSED_PHASE: UiShellPhase = { kind: 'paused' };

export function createUiShell(init: UiShellInit): UiShell {
  const builder = init.buildSessionDefinition ?? buildSessionDefinition;
  const makeSeed = init.makeSeed ?? defaultMakeSeed;
  const menuFactory = init.createMenuOverlay ?? createMenuOverlay;
  const pauseFactory = init.createPauseOverlay ?? createPauseOverlay;
  const rendererFactory = init.createRenderer ?? createRenderer;
  const inputFactory = init.createInputController ?? createInputController;
  const windowTarget = init.windowTarget ?? window;
  const documentTarget = init.documentTarget ?? document;
  const defaultPreset = init.defaultPreset ?? CAMPAIGN_PRESET;

  let activeSession: SessionDefinition | null = null;
  let renderer: Renderer | null = null;
  let input: InputController | null = null;
  let phase: UiShellPhase = MENU_PHASE;

  const sim =
    (init.createSimWorkerHost ?? createSimWorkerHost)({
      onEvent(event) {
        handleSimEvent(event);
      }
    });

  const menu = menuFactory({
    parent: init.parent,
    onStart() {
      startPreset(defaultPreset);
    }
  });

  const pause = pauseFactory({
    parent: init.parent,
    onResume() {
      resumeOverlayPause();
    },
    onExit() {
      exitToMenu();
    }
  });

  function handleSimEvent(event: RuntimeEvent): void {
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

  function applyPhaseVisibility(): void {
    switch (phase.kind) {
      case 'menu':
        menu.setResult(null);
        menu.show();
        pause.hide();
        return;
      case 'running':
        menu.setResult(null);
        menu.hide();
        pause.hide();
        return;
      case 'paused':
        menu.setResult(null);
        menu.hide();
        pause.show();
        return;
      case 'result':
        menu.setResult(phase.outcome);
        menu.show();
        pause.hide();
        return;
      default:
        assertNever(phase);
    }
  }

  function setPhase(next: UiShellPhase): void {
    phase = next;
    applyPhaseVisibility();
  }

  function startPreset(preset: ModePreset): void {
    if (activeSession !== null) return;

    const session = builder(preset, { seed: makeSeed() });
    activeSession = session;
    sim.startSession(session);

    renderer = rendererFactory({
      canvas: init.canvas,
      pixelRatio: init.pixelRatio,
      arena: session.arena,
      player: session.player,
      getSnapshotPair: sim.snapshotPair,
      getAim: () => (input !== null && input.isActive() ? input.currentAim() : null)
    });

    input = inputFactory({
      canvas: init.canvas,
      arena: session.arena,
      pixelsPerWorldUnit: () => init.canvas.clientHeight / session.arena.height,
      initialAim: session.player.position,
      onCommand: sim.sendInput
    });
    input.start();

    setPhase(RUNNING_PHASE);
  }

  function tearDownClientSession(): void {
    const previousInput = input;
    const previousRenderer = renderer;

    input = null;
    renderer = null;
    activeSession = null;

    previousInput?.stop();
    previousRenderer?.dispose();
  }

  function exitToMenu(): void {
    const previousPhase = phase;
    if (
      previousPhase.kind !== 'running' &&
      previousPhase.kind !== 'paused' &&
      previousPhase.kind !== 'result'
    ) {
      return;
    }

    tearDownClientSession();
    if (previousPhase.kind === 'running' || previousPhase.kind === 'paused') {
      sim.stopSession();
    }
    setPhase(MENU_PHASE);
  }

  function handleRunEnd(kind: SessionResult, simTimeMs: number): void {
    if (activeSession === null) return;
    log.info(`run ended: ${kind}`, { simTimeMs });
    tearDownClientSession();
    setPhase({ kind: 'result', outcome: kind });
  }

  function enterOverlayPause(): void {
    if (activeSession === null) return;
    if (phase.kind !== 'running') return;
    if (!sim.isPaused()) {
      sim.pause();
    }
    setPhase(PAUSED_PHASE);
  }

  function resumeOverlayPause(): void {
    if (activeSession === null) return;
    if (phase.kind !== 'paused') return;
    input?.requestLock();
    if (sim.isPaused()) {
      sim.resume();
    }
    setPhase(RUNNING_PHASE);
  }

  function onResize(): void {
    fitToWindow();
  }

  function onPointerLockChange(): void {
    if (documentTarget.pointerLockElement !== null) return;
    if (activeSession === null) return;
    enterOverlayPause();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Escape') {
      enterOverlayPause();
      return;
    }

    if (event.code === 'Space' && !event.repeat) {
      if (activeSession === null) return;
      if (phase.kind !== 'running') return;
      event.preventDefault();
      if (sim.isPaused()) {
        sim.resume();
      } else {
        sim.pause();
      }
    }
  }

  function attach(): void {
    windowTarget.addEventListener('resize', onResize);
    windowTarget.addEventListener('keydown', onKeyDown as EventListener);
    documentTarget.addEventListener('pointerlockchange', onPointerLockChange);
  }

  function detach(): void {
    windowTarget.removeEventListener('resize', onResize);
    windowTarget.removeEventListener('keydown', onKeyDown as EventListener);
    documentTarget.removeEventListener('pointerlockchange', onPointerLockChange);
  }

  function fitToWindow(): void {
    renderer?.fitToWindow();
  }

  attach();
  applyPhaseVisibility();

  return {
    onFrame(): void {
      renderer?.render();
    },
    fitToWindow,
    phase(): UiShellPhase {
      return phase;
    },
    dispose(): void {
      detach();
      tearDownClientSession();
      menu.dispose();
      pause.dispose();
      sim.dispose();
    }
  };
}

function defaultMakeSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}
