import { buildSessionDefinition } from '../../shared/content/buildSession';
import {
  getPlayableModeCatalog,
  resolveModePreset,
  type ModePreset,
  type ModePresetId
} from '../../shared/content/sessions';
import type { RuntimeEvent } from '../../shared/events';
import { log } from '../../shared/log';
import { assertNever } from '../../shared/protocol';
import type { SessionDefinition } from '../../shared/session';
import { createAudio, type Audio } from '../audio/Audio';
import { createInputController, type InputController, type InputControllerInit } from '../input/InputController';
import { BOSS_VISUALS } from '../render/bossVisuals';
import { ENEMY_VISUALS } from '../render/enemyVisuals';
import { PLAYER_VISUALS } from '../render/playerVisuals';
import { createRenderer, type Renderer, type RendererInit } from '../render/Renderer';
import { preloadSprites, type TextureMap } from '../render/spritePreload';
import {
  createClientSettingsStore,
  type ClientSettingsStore
} from '../settings/ClientSettingsStore';
import {
  createSimWorkerHost,
  type SimWorkerHost,
  type SimWorkerHostOptions
} from '../sim/SimWorkerHost';

import {
  createMenuOverlay,
  type MenuOverlay,
  type MenuOverlayInit
} from './MenuOverlay';
import { createHud, type Hud, type HudInit } from './Hud';
import { createPauseOverlay, type PauseOverlay, type PauseOverlayInit } from './PauseOverlay';
import {
  createResultOverlay,
  type ResultOutcome,
  type ResultOverlay,
  type ResultOverlayInit
} from './ResultOverlay';
import {
  createSettingsOverlay,
  type SettingsOverlay,
  type SettingsOverlayInit
} from './SettingsOverlay';
import {
  createStartupErrorOverlay,
  type StartupErrorOverlay,
  type StartupErrorOverlayInit
} from './StartupErrorOverlay';
import {
  createStartupOverlay,
  type StartupOverlay,
  type StartupOverlayInit
} from './StartupOverlay';
import type { UiShellPhase } from './UiShellPhase';

export type SessionResult = ResultOutcome;
export type { UiShellPhase } from './UiShellPhase';

type WindowTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;
type DocumentTarget = Pick<Document, 'addEventListener' | 'removeEventListener'> & {
  pointerLockElement: Element | null;
};

type BuildSessionDefinitionFn = typeof buildSessionDefinition;
type CreateSimWorkerHostFn = (options?: SimWorkerHostOptions) => SimWorkerHost;
type CreateMenuOverlayFn = (init: MenuOverlayInit) => MenuOverlay;
type CreatePauseOverlayFn = (init: PauseOverlayInit) => PauseOverlay;
type CreateResultOverlayFn = (init: ResultOverlayInit) => ResultOverlay;
type CreateSettingsOverlayFn = (init: SettingsOverlayInit) => SettingsOverlay;
type CreateStartupOverlayFn = (init: StartupOverlayInit) => StartupOverlay;
type CreateStartupErrorOverlayFn = (init: StartupErrorOverlayInit) => StartupErrorOverlay;
type CreateRendererFn = (init: RendererInit) => Renderer;
type CreateInputControllerFn = (init: InputControllerInit) => InputController;
type CreateHudFn = (init: HudInit) => Hud;
type CreateAudioFn = () => Audio;
type CreateClientSettingsStoreFn = () => ClientSettingsStore;
type RunStartupPreloadFn = (
  onProgress: (loaded: number, total: number) => void
) => Promise<TextureMap>;
type ReloadPageFn = () => void;

export type UiShellInit = Readonly<{
  parent: HTMLElement;
  canvas: HTMLCanvasElement;
  buildSessionDefinition?: BuildSessionDefinitionFn;
  createSimWorkerHost?: CreateSimWorkerHostFn;
  createMenuOverlay?: CreateMenuOverlayFn;
  createPauseOverlay?: CreatePauseOverlayFn;
  createResultOverlay?: CreateResultOverlayFn;
  createSettingsOverlay?: CreateSettingsOverlayFn;
  createStartupOverlay?: CreateStartupOverlayFn;
  createStartupErrorOverlay?: CreateStartupErrorOverlayFn;
  createRenderer?: CreateRendererFn;
  createInputController?: CreateInputControllerFn;
  createHud?: CreateHudFn;
  createAudio?: CreateAudioFn;
  createClientSettingsStore?: CreateClientSettingsStoreFn;
  runStartupPreload?: RunStartupPreloadFn;
  reloadPage?: ReloadPageFn;
  makeSeed?: () => number;
  windowTarget?: WindowTarget;
  documentTarget?: DocumentTarget;
}>;

export type UiShell = Readonly<{
  onFrame(): void;
  phase(): UiShellPhase;
  dispose(): void;
}>;

const LOADING_PHASE: UiShellPhase = { kind: 'loading' };
const MENU_PHASE: UiShellPhase = { kind: 'menu' };
const RUNNING_PHASE: UiShellPhase = { kind: 'running' };
const PAUSED_PHASE: UiShellPhase = { kind: 'paused' };
const STARTUP_PRELOAD_MIN_DURATION_MS = 1500;
const STARTUP_PRELOAD_PROGRESS_TICK_MS = 50;
const STARTUP_SPRITE_SPECS = [
  ...Object.values(PLAYER_VISUALS),
  ...Object.values(ENEMY_VISUALS),
  ...Object.values(BOSS_VISUALS)
];

export function createUiShell(init: UiShellInit): UiShell {
  const builder = init.buildSessionDefinition ?? buildSessionDefinition;
  const makeSeed = init.makeSeed ?? defaultMakeSeed;
  const menuFactory = init.createMenuOverlay ?? createMenuOverlay;
  const pauseFactory = init.createPauseOverlay ?? createPauseOverlay;
  const resultFactory = init.createResultOverlay ?? createResultOverlay;
  const settingsOverlayFactory = init.createSettingsOverlay ?? createSettingsOverlay;
  const canMountStartupOverlays =
    typeof (init.parent as Partial<HTMLElement>).appendChild === 'function' &&
    typeof document !== 'undefined';
  const startupOverlayFactory =
    init.createStartupOverlay ??
    (canMountStartupOverlays ? createStartupOverlay : createNullStartupOverlay);
  const startupErrorOverlayFactory =
    init.createStartupErrorOverlay ??
    (canMountStartupOverlays ? createStartupErrorOverlay : createNullStartupErrorOverlay);
  const rendererFactory = init.createRenderer ?? createRenderer;
  const inputFactory = init.createInputController ?? createInputController;
  const hudFactory = init.createHud ?? createHud;
  const audioFactory = init.createAudio ?? createAudio;
  const clientSettingsStoreFactory =
    init.createClientSettingsStore ?? createClientSettingsStore;
  const runStartupPreload = init.runStartupPreload ?? defaultRunStartupPreload;
  const reloadPage = init.reloadPage ?? defaultReloadPage;
  const windowTarget = init.windowTarget ?? window;
  const documentTarget = init.documentTarget ?? document;

  let activeSession: SessionDefinition | null = null;
  let preloadedTextures: TextureMap | null = null;
  let renderer: Renderer | null = null;
  let input: InputController | null = null;
  let unsubscribeRendererSettings: (() => void) | null = null;
  let settingsVisible = false;
  let phase: UiShellPhase = LOADING_PHASE;
  let disposed = false;
  const hud = hudFactory({ parent: init.parent });
  const clientSettingsStore = clientSettingsStoreFactory();
  const audio = audioFactory();
  audio.setMasterGain(clientSettingsStore.get().masterVolume);
  const unsubscribeAudioSettings = clientSettingsStore.subscribe((settings) => {
    audio.setMasterGain(settings.masterVolume);
  });
  let unlockGestureArmed = true;

  const sim =
    (init.createSimWorkerHost ?? createSimWorkerHost)({
      onEvent(event) {
        handleSimEvent(event);
      }
    });

  const startupOverlay = startupOverlayFactory({
    parent: init.parent
  });
  const startupErrorOverlay = startupErrorOverlayFactory({
    parent: init.parent,
    onReload() {
      reloadPage();
    }
  });

  const menu = menuFactory({
    parent: init.parent,
    modes: getPlayableModeCatalog(),
    onStart(presetId) {
      if (phase.kind !== 'menu') {
        return;
      }
      audio.playUi('buttonClick');
      startPresetId(presetId);
    },
    onOpenSettings() {
      if (phase.kind !== 'menu') {
        return;
      }
      audio.playUi('buttonClick');
      openSettings();
    }
  });

  const pause = pauseFactory({
    parent: init.parent,
    onResume() {
      audio.playUi('buttonClick');
      resumeOverlayPause();
    },
    onExit() {
      audio.playUi('buttonClick');
      exitToMenu();
    },
    onOpenSettings() {
      audio.playUi('buttonClick');
      openSettings();
    }
  });

  const result = resultFactory({
    parent: init.parent,
    onBackToMenu() {
      audio.playUi('buttonClick');
      exitToMenu();
    }
  });

  const settingsOverlay = settingsOverlayFactory({
    parent: init.parent,
    store: clientSettingsStore,
    onClose() {
      closeSettings();
    },
    onButtonClick() {
      audio.playUi('buttonClick');
    }
  });

  function handleSimEvent(event: RuntimeEvent): void {
    audio.handleEvent(event);
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
      case 'loading':
        startupOverlay.show();
        startupErrorOverlay.hide();
        menu.hide();
        pause.hide();
        result.hide();
        syncSettingsVisibility();
        return;
      case 'menu':
        startupOverlay.hide();
        startupErrorOverlay.hide();
        menu.show();
        pause.hide();
        result.hide();
        syncSettingsVisibility();
        return;
      case 'running':
        startupOverlay.hide();
        startupErrorOverlay.hide();
        menu.hide();
        pause.hide();
        result.hide();
        syncSettingsVisibility();
        return;
      case 'paused':
        startupOverlay.hide();
        startupErrorOverlay.hide();
        menu.hide();
        pause.show();
        result.hide();
        syncSettingsVisibility();
        return;
      case 'result':
        startupOverlay.hide();
        startupErrorOverlay.hide();
        menu.hide();
        pause.hide();
        result.show(phase.outcome);
        syncSettingsVisibility();
        return;
      case 'error':
        startupOverlay.hide();
        menu.hide();
        pause.hide();
        result.hide();
        startupErrorOverlay.show(phase.message);
        syncSettingsVisibility();
        return;
      default:
        assertNever(phase);
    }
  }

  function syncSettingsVisibility(): void {
    if (settingsVisible && (phase.kind === 'menu' || phase.kind === 'paused')) {
      settingsOverlay.show();
      return;
    }
    settingsVisible = false;
    settingsOverlay.hide();
  }

  function openSettings(): void {
    if (phase.kind !== 'menu' && phase.kind !== 'paused') {
      return;
    }
    settingsVisible = true;
    syncSettingsVisibility();
  }

  function closeSettings(): void {
    settingsVisible = false;
    syncSettingsVisibility();
  }

  function setPhase(next: UiShellPhase): void {
    const previousPhase = phase;
    phase = next;
    applyPhaseVisibility();
    if (next.kind === 'paused' && previousPhase.kind !== 'paused') {
      audio.playUi('overlayShow');
    }
    if (next.kind === 'result' && previousPhase.kind !== 'result') {
      audio.playUi('overlayShow');
    }
  }

  function startPresetId(presetId: ModePresetId): void {
    if (phase.kind !== 'menu') return;
    const preset = resolveModePreset(presetId);
    startPreset(preset);
  }

  function startPreset(preset: ModePreset): void {
    if (phase.kind !== 'menu') return;
    if (activeSession !== null) return;

    const session = builder(preset, { seed: makeSeed() });
    const clientSettings = clientSettingsStore.get();
    const spriteTextures = preloadedTextures;
    if (spriteTextures === null) {
      throw new Error('Sprite textures must be preloaded before starting a session');
    }

    let nextRenderer: Renderer | null = null;
    let nextInput: InputController | null = null;
    let nextUnsubscribeRendererSettings: (() => void) | null = null;
    try {
      nextRenderer = rendererFactory({
        canvas: init.canvas,
        renderScalePreset: clientSettings.renderScalePreset,
        arena: session.arena,
        spriteTextures,
        getSnapshotPair: sim.snapshotPair,
        getAim: () => (input !== null && input.isActive() ? input.currentAim() : null)
      });
      const activeRenderer = nextRenderer;
      let lastRendererPreset = clientSettings.renderScalePreset;
      nextUnsubscribeRendererSettings = clientSettingsStore.subscribe((settings) => {
        if (settings.renderScalePreset === lastRendererPreset) {
          return;
        }
        lastRendererPreset = settings.renderScalePreset;
        activeRenderer.applyScalePolicy(settings.renderScalePreset);
      });

      nextInput = inputFactory({
        canvas: init.canvas,
        arena: session.arena,
        pixelsPerWorldUnit: () => init.canvas.clientHeight / session.arena.height,
        initialAim: session.player.position,
        onCommand: sim.sendInput
      });
    } catch (error: unknown) {
      nextUnsubscribeRendererSettings?.();
      nextRenderer?.dispose();
      throw error;
    }

    let audioAttached = false;
    let sessionStarted = false;
    let hudAttached = false;
    try {
      audio.attach(session);
      audioAttached = true;
      sim.startSession(session);
      sessionStarted = true;
      nextInput.start();
      hud.attach(session);
      hudAttached = true;
    } catch (error: unknown) {
      if (hudAttached) {
        hud.detach();
      }
      nextInput.stop();
      if (sessionStarted) {
        sim.stopSession();
      }
      if (audioAttached) {
        audio.detach();
      }
      nextUnsubscribeRendererSettings?.();
      nextRenderer.dispose();
      throw error;
    }

    renderer = nextRenderer;
    input = nextInput;
    activeSession = session;
    unsubscribeRendererSettings?.();
    unsubscribeRendererSettings = nextUnsubscribeRendererSettings;

    setPhase(RUNNING_PHASE);
  }

  function tearDownClientSession(): void {
    const previousInput = input;
    const previousRenderer = renderer;
    const previousUnsubscribeRendererSettings = unsubscribeRendererSettings;
    const hadClientSession =
      activeSession !== null || previousInput !== null || previousRenderer !== null;

    input = null;
    renderer = null;
    activeSession = null;
    settingsVisible = false;
    unsubscribeRendererSettings = null;

    previousInput?.stop();
    previousUnsubscribeRendererSettings?.();
    previousRenderer?.dispose();
    if (hadClientSession) {
      hud.detach();
      audio.detach();
    }
  }

  function exitToMenu(): void {
    const previousPhase = phase;
    if (previousPhase.kind === 'running' || previousPhase.kind === 'paused') {
      tearDownClientSession();
      sim.stopSession();
      setPhase(MENU_PHASE);
      return;
    }

    if (previousPhase.kind !== 'result') {
      return;
    }

    setPhase(MENU_PHASE);
  }

  function handleRunEnd(kind: SessionResult, simTimeMs: number): void {
    if (activeSession === null) return;
    log.info(`run ended: ${kind}`, { simTimeMs });
    tearDownClientSession();
    setPhase({ kind: 'result', outcome: kind });
  }

  function isRunningSessionActive(): boolean {
    return activeSession !== null && phase.kind === 'running';
  }

  function enterOverlayPause(): void {
    if (!isRunningSessionActive()) return;
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

  function unlockAudioFromGesture(): void {
    if (!unlockGestureArmed) {
      return;
    }
    if (phase.kind === 'loading' || phase.kind === 'error') {
      return;
    }
    unlockGestureArmed = false;
    windowTarget.removeEventListener('pointerdown', unlockAudioFromGesture as EventListener);
    windowTarget.removeEventListener('keydown', unlockAudioFromGesture as EventListener);
    audio.unlock();
  }

  function onPointerLockChange(): void {
    // Browsers consume the Escape keydown that releases Pointer Lock, so
    // lock loss is the reliable pause trigger for the player-facing overlay.
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
      if (!isRunningSessionActive()) return;
      event.preventDefault();
      if (sim.isPaused()) {
        sim.resume();
      } else {
        sim.pause();
      }
    }
  }

  function attach(): void {
    windowTarget.addEventListener('pointerdown', unlockAudioFromGesture as EventListener);
    windowTarget.addEventListener('keydown', unlockAudioFromGesture as EventListener);
    windowTarget.addEventListener('resize', onResize);
    windowTarget.addEventListener('keydown', onKeyDown as EventListener);
    documentTarget.addEventListener('pointerlockchange', onPointerLockChange);
  }

  function detach(): void {
    windowTarget.removeEventListener('pointerdown', unlockAudioFromGesture as EventListener);
    windowTarget.removeEventListener('keydown', unlockAudioFromGesture as EventListener);
    windowTarget.removeEventListener('resize', onResize);
    windowTarget.removeEventListener('keydown', onKeyDown as EventListener);
    documentTarget.removeEventListener('pointerlockchange', onPointerLockChange);
  }

  function fitToWindow(): void {
    renderer?.fitToWindow();
  }

  function onStartupPreloadProgress(loaded: number, total: number): void {
    startupOverlay.setProgress(loaded, total);
  }

  function releasePreloadedTextures(): void {
    if (preloadedTextures === null) {
      return;
    }
    for (const texture of new Set(Object.values(preloadedTextures))) {
      texture.dispose();
    }
    preloadedTextures = null;
  }

  async function startStartupPreload(): Promise<void> {
    startupOverlay.setProgress(0, 0);
    try {
      const textures = await runStartupPreload(onStartupPreloadProgress);
      if (disposed) {
        disposeTextureMap(textures);
        return;
      }
      preloadedTextures = textures;
      setPhase(MENU_PHASE);
    } catch (error: unknown) {
      if (disposed) {
        return;
      }
      setPhase({
        kind: 'error',
        reason: 'preload',
        message: formatStartupError(error)
      });
    }
  }

  attach();
  applyPhaseVisibility();
  void startStartupPreload();

  return {
    onFrame(): void {
      const snapshotPair = sim.snapshotPair();
      if (isRunningSessionActive()) {
        hud.update(snapshotPair);
      }
      audio.update(snapshotPair, phase, snapshotPair.curr?.encounter ?? null);
      renderer?.render();
    },
    phase(): UiShellPhase {
      return phase;
    },
    dispose(): void {
      disposed = true;
      detach();
      tearDownClientSession();
      releasePreloadedTextures();
      startupOverlay.dispose();
      startupErrorOverlay.dispose();
      menu.dispose();
      pause.dispose();
      result.dispose();
      settingsOverlay.dispose();
      hud.dispose();
      unsubscribeAudioSettings();
      clientSettingsStore.dispose();
      audio.dispose();
      sim.dispose();
    }
  };
}

async function defaultRunStartupPreload(
  onProgress: (loaded: number, total: number) => void
): Promise<TextureMap> {
  const startedAt = performance.now();
  let actualLoaded = 0;
  let total = 0;
  let textures: TextureMap | null = null;
  let failure: unknown = null;

  const preloadPromise = preloadSprites(STARTUP_SPRITE_SPECS, (loaded, nextTotal) => {
    actualLoaded = loaded;
    total = nextTotal;
  })
    .then((resolvedTextures) => {
      textures = resolvedTextures;
    })
    .catch((error: unknown) => {
      failure = error;
    });

  while (true) {
    const elapsedMs = performance.now() - startedAt;
    const timedFraction =
      total === 0 ? 1 : Math.min(1, elapsedMs / STARTUP_PRELOAD_MIN_DURATION_MS);
    const timedLoaded = total === 0 ? 0 : Math.floor(total * timedFraction);
    const displayedLoaded = Math.min(actualLoaded, timedLoaded);
    onProgress(displayedLoaded, total);

    if (failure !== null) {
      await preloadPromise;
      throw failure;
    }

    if (
      textures !== null &&
      elapsedMs >= STARTUP_PRELOAD_MIN_DURATION_MS &&
      displayedLoaded >= total
    ) {
      return textures;
    }

    await delayMs(STARTUP_PRELOAD_PROGRESS_TICK_MS);
  }
}

function defaultReloadPage(): void {
  location.reload();
}

function formatStartupError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown preload error';
}

function createNullStartupOverlay(_init: StartupOverlayInit): StartupOverlay {
  return {
    show(): void {},
    hide(): void {},
    isVisible(): boolean {
      return false;
    },
    setProgress(): void {},
    dispose(): void {}
  };
}

function createNullStartupErrorOverlay(
  _init: StartupErrorOverlayInit
): StartupErrorOverlay {
  return {
    show(): void {},
    hide(): void {},
    isVisible(): boolean {
      return false;
    },
    dispose(): void {}
  };
}

function disposeTextureMap(textures: TextureMap): void {
  for (const texture of new Set(Object.values(textures))) {
    texture.dispose();
  }
}

function delayMs(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, durationMs);
  });
}

function defaultMakeSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}
