import { describe, expect, it, vi } from 'vitest';

import { PLAYABLE_MODE_CATALOG } from '../../shared/content/playableModes';
import type { RuntimeEvent } from '../../shared/events';
import type { InputCommand } from '../../shared/input';
import type { SessionDefinition } from '../../shared/session';
import type { ModePresetId } from '../../shared/content/presets';
import type { Audio, AudioUiEventId } from '../audio/Audio';
import type { InputController, InputControllerInit } from '../input/InputController';
import type { Renderer, RendererInit } from '../render/Renderer';
import type { TextureMap } from '../render/spritePreload';
import {
  DEFAULT_CLIENT_SETTINGS,
  type ClientSettings,
  type ClientSettingsStore,
  type RenderScalePreset
} from '../settings/ClientSettingsStore';
import type { SimWorkerHost, SimWorkerHostOptions, SnapshotPair } from '../sim/SimWorkerHost';

import type { Hud, HudInit } from './Hud';
import { createUiShell, type UiShellInit } from './UiShell';
import type { MenuOverlay, MenuOverlayInit } from './MenuOverlay';
import type { PauseOverlay, PauseOverlayInit } from './PauseOverlay';
import type { ResultOutcome, ResultOverlay, ResultOverlayInit } from './ResultOverlay';
import type { SettingsOverlay, SettingsOverlayInit } from './SettingsOverlay';
import type { StartupErrorOverlay, StartupErrorOverlayInit } from './StartupErrorOverlay';
import type { StartupOverlay, StartupOverlayInit } from './StartupOverlay';

class FakeEventTarget {
  private readonly listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener): void {
    const bucket = this.listeners.get(type) ?? new Set<EventListener>();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

class FakeDomElement {
  readonly children: FakeDomElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = {};
  parent: FakeDomElement | null = null;

  appendChild(child: FakeDomElement): void {
    child.parent = this;
    this.children.push(child);
  }

  remove(): void {
    if (this.parent === null) {
      return;
    }
    this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
}

function appendHarnessRoot(parent: HTMLElement, root: FakeDomElement): void {
  const maybeParent = parent as unknown as Partial<FakeDomElement>;
  maybeParent.appendChild?.(root);
}

function findHarnessRoot(parent: FakeDomElement, role: string): FakeDomElement | null {
  for (const child of parent.children) {
    if (child.dataset['role'] === role) {
      return child;
    }
  }
  return null;
}

function makeSession(id = 'test-session'): SessionDefinition {
  return {
    id,
    seed: 7,
    arena: { width: 16, height: 9 },
    player: {
      position: { x: 0, y: 0 },
      radius: 0.5,
      maxSpeed: 5,
      maxHp: 5
    },
    loadout: { primaryWeaponArchetypeId: 'pistol' },
    modifiers: [],
    rules: null,
    encounters: [],
    winCondition: { kind: 'allEncountersComplete' },
    lossCondition: { kind: 'playerDeath' },
    uiMeta: null
  };
}

const EMPTY_TEXTURE_MAP = Object.freeze({}) satisfies TextureMap;

async function flushUiShellStartup(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function createDeferredPreload() {
  let resolvePromise: ((value: TextureMap) => void) | null = null;
  let rejectPromise: ((error: unknown) => void) | null = null;
  const promise = new Promise<TextureMap>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolve(): void {
      resolvePromise?.(EMPTY_TEXTURE_MAP);
    },
    reject(error: unknown): void {
      rejectPromise?.(error);
    }
  };
}

function createUiShellForTest(init: UiShellInit) {
  return createUiShell({
    runStartupPreload: () => Promise.resolve(EMPTY_TEXTURE_MAP),
    ...init
  });
}

function createMenuHarness() {
  let visible = true;
  let onStart: ((presetId: ModePresetId) => void) | null = null;
  let onOpenSettings: (() => void) | null = null;
  let modes: ReadonlyArray<{ presetId: ModePresetId }> = [];
  let root: FakeDomElement | null = null;

  const overlay: MenuOverlay = {
    show(): void {
      visible = true;
      if (root !== null) {
        root.style.display = 'flex';
      }
    },
    hide(): void {
      visible = false;
      if (root !== null) {
        root.style.display = 'none';
      }
    },
    isVisible(): boolean {
      return visible;
    },
    dispose(): void {}
  };

  return {
    factory(init: MenuOverlayInit): MenuOverlay {
      modes = init.modes;
      onStart = init.onStart;
      onOpenSettings = init.onOpenSettings;
      root = new FakeDomElement();
      root.dataset['role'] = 'menu-overlay';
      root.style.zIndex = '100';
      root.style.display = visible ? 'flex' : 'none';
      appendHarnessRoot(init.parent, root);
      return overlay;
    },
    start(presetId: ModePresetId = 'campaign'): void {
      onStart?.(presetId);
    },
    isVisible(): boolean {
      return visible;
    },
    modes(): ReadonlyArray<{ presetId: ModePresetId }> {
      return modes;
    },
    openSettings(): void {
      if (!visible) {
        return;
      }
      onOpenSettings?.();
    },
    root(): FakeDomElement | null {
      return root;
    }
  };
}

function createResultHarness() {
  let visible = false;
  let outcome: ResultOutcome | null = null;
  let onBackToMenu: (() => void) | null = null;
  let root: FakeDomElement | null = null;

  const overlay: ResultOverlay = {
    show(next): void {
      visible = true;
      outcome = next;
      if (root !== null) {
        root.style.display = 'flex';
      }
    },
    hide(): void {
      visible = false;
      outcome = null;
      if (root !== null) {
        root.style.display = 'none';
      }
    },
    isVisible(): boolean {
      return visible;
    },
    dispose(): void {}
  };

  return {
    factory(init: ResultOverlayInit): ResultOverlay {
      onBackToMenu = init.onBackToMenu;
      root = new FakeDomElement();
      root.dataset['role'] = 'result-overlay';
      root.style.zIndex = '110';
      root.style.display = 'none';
      appendHarnessRoot(init.parent, root);
      return overlay;
    },
    backToMenu(): void {
      onBackToMenu?.();
    },
    isVisible(): boolean {
      return visible;
    },
    outcome(): ResultOutcome | null {
      return outcome;
    },
    root(): FakeDomElement | null {
      return root;
    }
  };
}

function createPauseHarness() {
  let visible = false;
  let onResume: (() => void) | null = null;
  let onExit: (() => void) | null = null;
  let onOpenSettings: (() => void) | null = null;
  let root: FakeDomElement | null = null;

  const overlay: PauseOverlay = {
    show(): void {
      visible = true;
      if (root !== null) {
        root.style.display = 'flex';
      }
    },
    hide(): void {
      visible = false;
      if (root !== null) {
        root.style.display = 'none';
      }
    },
    isVisible(): boolean {
      return visible;
    },
    dispose(): void {}
  };

  return {
    factory(init: PauseOverlayInit): PauseOverlay {
      onResume = init.onResume;
      onExit = init.onExit;
      onOpenSettings = init.onOpenSettings;
      root = new FakeDomElement();
      root.dataset['role'] = 'pause-overlay';
      root.style.zIndex = '90';
      root.style.display = 'none';
      appendHarnessRoot(init.parent, root);
      return overlay;
    },
    resume(): void {
      onResume?.();
    },
    exit(): void {
      onExit?.();
    },
    openSettings(): void {
      if (!visible) {
        return;
      }
      onOpenSettings?.();
    },
    isVisible(): boolean {
      return visible;
    },
    root(): FakeDomElement | null {
      return root;
    }
  };
}

function createSettingsOverlayHarness() {
  let visible = false;
  let onClose: (() => void) | null = null;
  let onButtonClick: (() => void) | null = null;
  let root: FakeDomElement | null = null;

  const overlay: SettingsOverlay = {
    show(): void {
      visible = true;
      if (root !== null) {
        root.style.display = 'flex';
      }
    },
    hide(): void {
      visible = false;
      if (root !== null) {
        root.style.display = 'none';
      }
    },
    isVisible(): boolean {
      return visible;
    },
    dispose(): void {
      root?.remove();
      root = null;
    }
  };

  return {
    factory(init: SettingsOverlayInit): SettingsOverlay {
      onClose = init.onClose;
      onButtonClick = init.onButtonClick ?? null;
      root = new FakeDomElement();
      root.dataset['role'] = 'settings-overlay';
      root.style.zIndex = '105';
      root.style.display = 'none';
      appendHarnessRoot(init.parent, root);
      return overlay;
    },
    close(): void {
      onButtonClick?.();
      onClose?.();
    },
    pressButton(): void {
      onButtonClick?.();
    },
    isVisible(): boolean {
      return visible;
    },
    root(): FakeDomElement | null {
      return root;
    }
  };
}

function createStartupOverlayHarness() {
  let visible = true;
  let progress = { loaded: 0, total: 0 };
  let root: FakeDomElement | null = null;

  const overlay: StartupOverlay = {
    show(): void {
      visible = true;
      if (root !== null) {
        root.style.display = 'flex';
      }
    },
    hide(): void {
      visible = false;
      if (root !== null) {
        root.style.display = 'none';
      }
    },
    isVisible(): boolean {
      return visible;
    },
    setProgress(loaded: number, total: number): void {
      progress = { loaded, total };
    },
    dispose(): void {
      root?.remove();
      root = null;
    }
  };

  return {
    factory(init: StartupOverlayInit): StartupOverlay {
      root = new FakeDomElement();
      root.dataset['role'] = 'startup-overlay';
      root.style.zIndex = '120';
      root.style.display = visible ? 'flex' : 'none';
      appendHarnessRoot(init.parent, root);
      return overlay;
    },
    isVisible(): boolean {
      return visible;
    },
    progress(): Readonly<{ loaded: number; total: number }> {
      return progress;
    },
    root(): FakeDomElement | null {
      return root;
    }
  };
}

function createStartupErrorOverlayHarness() {
  let visible = false;
  let message = '';
  let onReload: (() => void) | null = null;
  let root: FakeDomElement | null = null;

  const overlay: StartupErrorOverlay = {
    show(nextMessage: string): void {
      visible = true;
      message = nextMessage;
      if (root !== null) {
        root.style.display = 'flex';
      }
    },
    hide(): void {
      visible = false;
      message = '';
      if (root !== null) {
        root.style.display = 'none';
      }
    },
    isVisible(): boolean {
      return visible;
    },
    dispose(): void {
      root?.remove();
      root = null;
    }
  };

  return {
    factory(init: StartupErrorOverlayInit): StartupErrorOverlay {
      onReload = init.onReload;
      root = new FakeDomElement();
      root.dataset['role'] = 'startup-error-overlay';
      root.style.zIndex = '130';
      root.style.display = 'none';
      appendHarnessRoot(init.parent, root);
      return overlay;
    },
    isVisible(): boolean {
      return visible;
    },
    message(): string {
      return message;
    },
    reload(): void {
      onReload?.();
    },
    root(): FakeDomElement | null {
      return root;
    }
  };
}

function createRendererHarness() {
  const calls = {
    create: 0,
    render: 0,
    fitToWindow: 0,
    applyScalePolicy: 0,
    dispose: 0
  };
  let lastInit: RendererInit | null = null;
  const appliedPresets: RenderScalePreset[] = [];

  return {
    factory(init: RendererInit): Renderer {
      calls.create += 1;
      lastInit = init;
      return {
        render(): void {
          calls.render += 1;
        },
        fitToWindow(): void {
          calls.fitToWindow += 1;
        },
        applyScalePolicy(preset: RenderScalePreset): void {
          calls.applyScalePolicy += 1;
          appliedPresets.push(preset);
        },
        dispose(): void {
          calls.dispose += 1;
        }
      };
    },
    calls,
    appliedPresets,
    lastInit(): RendererInit | null {
      return lastInit;
    }
  };
}

function createInputHarness() {
  const calls = {
    create: 0,
    start: 0,
    stop: 0,
    requestLock: 0
  };

  return {
    factory(_init: InputControllerInit): InputController {
      calls.create += 1;
      return {
        start(): void {
          calls.start += 1;
        },
        stop(): void {
          calls.stop += 1;
        },
        isActive(): boolean {
          return true;
        },
        currentAim() {
          return { x: 0, y: 0 };
        },
        requestLock(): void {
          calls.requestLock += 1;
        }
      };
    },
    calls
  };
}

function createSimHarness() {
  const emptyPair: SnapshotPair = {
    prev: null,
    curr: null,
    currReceivedAtMs: 0,
    nowMs: 0
  };

  let paused = false;
  let onEvent: ((event: RuntimeEvent) => void) | undefined;
  const startSessions: SessionDefinition[] = [];
  const sentInputs: InputCommand[] = [];
  const calls = {
    stop: 0,
    pause: 0,
    resume: 0,
    dispose: 0
  };

  return {
    factory(options: SimWorkerHostOptions = {}): SimWorkerHost {
      onEvent = options.onEvent;
      return {
        startSession(session): void {
          startSessions.push(session);
          paused = false;
        },
        stopSession(): void {
          calls.stop += 1;
          paused = false;
        },
        pause(): void {
          calls.pause += 1;
          paused = true;
        },
        resume(): void {
          calls.resume += 1;
          paused = false;
        },
        sendInput(command): void {
          sentInputs.push(command);
        },
        snapshotPair(): SnapshotPair {
          return emptyPair;
        },
        isPaused(): boolean {
          return paused;
        },
        dispose(): void {
          calls.dispose += 1;
        }
      };
    },
    emit(event: RuntimeEvent): void {
      onEvent?.(event);
    },
    calls,
    startSessions,
    sentInputs,
    setPaused(next: boolean): void {
      paused = next;
    }
  };
}

function createHudHarness() {
  const calls = {
    attach: 0,
    update: 0,
    detach: 0,
    dispose: 0
  };

  return {
    factory(_init: HudInit): Hud {
      return {
        attach(): void {
          calls.attach += 1;
        },
        update(): void {
          calls.update += 1;
        },
        detach(): void {
          calls.detach += 1;
        },
        dispose(): void {
          calls.dispose += 1;
        }
      };
    },
    calls
  };
}

function createAudioHarness() {
  const events: RuntimeEvent[] = [];
  const uiEvents: AudioUiEventId[] = [];
  const attachedSessions: SessionDefinition[] = [];
  const masterGainValues: number[] = [];
  const calls = {
    unlock: 0,
    update: 0,
    detach: 0,
    dispose: 0
  };

  return {
    factory(): Audio {
      return {
        unlock(): void {
          calls.unlock += 1;
        },
        handleEvent(event: RuntimeEvent): void {
          events.push(event);
        },
        update(): void {
          calls.update += 1;
        },
        attach(session: SessionDefinition): void {
          attachedSessions.push(session);
        },
        detach(): void {
          calls.detach += 1;
        },
        playUi(eventId: AudioUiEventId): void {
          uiEvents.push(eventId);
        },
        setMasterGain(value: number): void {
          masterGainValues.push(value);
        },
        dispose(): void {
          calls.dispose += 1;
        }
      };
    },
    events,
    uiEvents,
    attachedSessions,
    masterGainValues,
    calls
  };
}

function createClientSettingsStoreHarness(
  initial: Partial<ClientSettings> = {}
) {
  let settings: ClientSettings = {
    ...DEFAULT_CLIENT_SETTINGS,
    ...initial
  };
  let listeners: Array<(settings: ClientSettings) => void> = [];
  const calls = {
    dispose: 0,
    subscribe: 0
  };

  function notify(): void {
    for (const listener of listeners) {
      listener(settings);
    }
  }

  return {
    factory(): ClientSettingsStore {
      return {
        get(): ClientSettings {
          return settings;
        },
        setMasterVolume(value: number): void {
          settings = {
            ...settings,
            masterVolume: value
          };
          notify();
        },
        setRenderScalePreset(preset: RenderScalePreset): void {
          settings = {
            ...settings,
            renderScalePreset: preset
          };
          notify();
        },
        subscribe(listener): () => void {
          calls.subscribe += 1;
          listeners.push(listener);
          return () => {
            listeners = listeners.filter((entry) => entry !== listener);
          };
        },
        dispose(): void {
          calls.dispose += 1;
          listeners = [];
        }
      };
    },
    get(): ClientSettings {
      return settings;
    },
    setMasterVolume(value: number): void {
      settings = {
        ...settings,
        masterVolume: value
      };
      notify();
    },
    setRenderScalePreset(preset: RenderScalePreset): void {
      settings = {
        ...settings,
        renderScalePreset: preset
      };
      notify();
    },
    calls
  };
}

describe('UiShell', () => {
  it('shows startup loading before the menu and delays session client creation until preload finishes', async () => {
    const parent = new FakeDomElement();
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const startupOverlay = createStartupOverlayHarness();
    const startupErrorOverlay = createStartupErrorOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const deferredPreload = createDeferredPreload();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: parent as unknown as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createStartupOverlay: startupOverlay.factory,
      createStartupErrorOverlay: startupErrorOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      runStartupPreload(onProgress) {
        onProgress(1, 4);
        return deferredPreload.promise;
      },
      windowTarget,
      documentTarget
    });

    expect(shell.phase()).toEqual({ kind: 'loading' });
    expect(startupOverlay.isVisible()).toBe(true);
    expect(startupOverlay.progress()).toEqual({ loaded: 1, total: 4 });
    expect(startupErrorOverlay.isVisible()).toBe(false);
    expect(menu.isVisible()).toBe(false);
    expect(settingsOverlay.isVisible()).toBe(false);
    expect(renderer.calls.create).toBe(0);
    expect(input.calls.create).toBe(0);
    expect(Number(findHarnessRoot(parent, 'startup-overlay')?.style.zIndex ?? '0')).toBeGreaterThan(
      Number(findHarnessRoot(parent, 'menu-overlay')?.style.zIndex ?? '0')
    );

    windowTarget.dispatch('pointerdown', new Event('pointerdown'));
    expect(audio.calls.unlock).toBe(0);

    deferredPreload.resolve();
    await flushUiShellStartup();

    expect(shell.phase()).toEqual({ kind: 'menu' });
    expect(startupOverlay.isVisible()).toBe(false);
    expect(startupErrorOverlay.isVisible()).toBe(false);
    expect(menu.isVisible()).toBe(true);

    windowTarget.dispatch('pointerdown', new Event('pointerdown'));
    expect(audio.calls.unlock).toBe(1);
  });

  it('transitions loading into preload error and exposes only reload', async () => {
    const parent = new FakeDomElement();
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const startupOverlay = createStartupOverlayHarness();
    const startupErrorOverlay = createStartupErrorOverlayHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    let reloadCalls = 0;

    const shell = createUiShellForTest({
      parent: parent as unknown as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: createSimHarness().factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createStartupOverlay: startupOverlay.factory,
      createStartupErrorOverlay: startupErrorOverlay.factory,
      createRenderer: createRendererHarness().factory,
      createInputController: createInputHarness().factory,
      createHud: createHudHarness().factory,
      createAudio: audio.factory,
      runStartupPreload() {
        return Promise.reject(new Error('failed to decode /assets/hero.png'));
      },
      reloadPage() {
        reloadCalls += 1;
      },
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    expect(shell.phase()).toEqual({
      kind: 'error',
      reason: 'preload',
      message: 'failed to decode /assets/hero.png'
    });
    expect(startupOverlay.isVisible()).toBe(false);
    expect(startupErrorOverlay.isVisible()).toBe(true);
    expect(startupErrorOverlay.message()).toBe('failed to decode /assets/hero.png');
    expect(menu.isVisible()).toBe(false);
    expect(pause.isVisible()).toBe(false);
    expect(result.isVisible()).toBe(false);
    expect(settingsOverlay.isVisible()).toBe(false);
    expect(Number(findHarnessRoot(parent, 'startup-error-overlay')?.style.zIndex ?? '0')).toBeGreaterThan(
      Number(findHarnessRoot(parent, 'startup-overlay')?.style.zIndex ?? '0')
    );

    windowTarget.dispatch('pointerdown', new Event('pointerdown'));
    expect(audio.calls.unlock).toBe(0);

    startupErrorOverlay.reload();
    expect(reloadCalls).toBe(1);
  });

  it('starts a session from the menu and hides overlays while running', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    let builtPresetId: ModePresetId | null = null;
    const buildSession = vi.fn((preset, _options) => {
      builtPresetId = preset.id;
      return makeSession('running-session');
    });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 123,
      buildSessionDefinition: buildSession,
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    expect(menu.modes().map((mode) => mode.presetId)).toEqual(
      PLAYABLE_MODE_CATALOG.map((mode) => mode.presetId)
    );
    expect(audio.calls.unlock).toBe(0);

    windowTarget.dispatch('pointerdown', new Event('pointerdown'));
    windowTarget.dispatch('keydown', new Event('keydown'));

    expect(audio.calls.unlock).toBe(1);

    menu.start('training');

    expect(buildSession).toHaveBeenCalledTimes(1);
    expect(builtPresetId).toBe('training');
    expect(renderer.lastInit()?.renderScalePreset).toBe('medium');
    expect(sim.startSessions).toHaveLength(1);
    expect(audio.attachedSessions).toHaveLength(1);
    expect(audio.uiEvents).toContain('buttonClick');
    expect(renderer.calls.create).toBe(1);
    expect(input.calls.create).toBe(1);
    expect(input.calls.start).toBe(1);
    expect(hud.calls.attach).toBe(1);
    expect(menu.isVisible()).toBe(false);
    expect(pause.isVisible()).toBe(false);
    expect(result.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'running' });

    shell.onFrame();
    expect(hud.calls.update).toBe(1);
    expect(audio.calls.update).toBe(1);
  });

  it('routes Escape into overlay pause and exit back to menu with stopSession', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();
    windowTarget.dispatch(
      'keydown',
      {
        code: 'Escape',
        preventDefault() {},
        repeat: false
      } as unknown as Event
    );

    expect(sim.calls.pause).toBe(1);
    expect(pause.isVisible()).toBe(true);
    expect(audio.uiEvents).toContain('overlayShow');
    expect(shell.phase()).toEqual({ kind: 'paused' });

    pause.exit();

    expect(sim.calls.stop).toBe(1);
    expect(input.calls.stop).toBe(1);
    expect(renderer.calls.dispose).toBe(1);
    expect(hud.calls.detach).toBe(1);
    expect(audio.calls.detach).toBe(1);
    expect(menu.isVisible()).toBe(true);
    expect(pause.isVisible()).toBe(false);
    expect(result.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'menu' });
  });

  it('routes pointer lock loss into overlay pause while a run is active', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: () => ({
        render() {},
        fitToWindow() {},
        applyScalePolicy() {},
        dispose() {}
      }),
      createInputController: () => ({
        start() {},
        stop() {},
        isActive() {
          return true;
        },
        currentAim() {
          return { x: 0, y: 0 };
        },
        requestLock() {}
      }),
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();
    documentEvents.dispatch('pointerlockchange', new Event('pointerlockchange'));

    expect(sim.calls.pause).toBe(1);
    expect(pause.isVisible()).toBe(true);
    expect(result.isVisible()).toBe(false);
    expect(audio.uiEvents).toContain('overlayShow');
    expect(shell.phase()).toEqual({ kind: 'paused' });
  });

  it('ignores pointer lock loss outside the running phase', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: () => ({
        render() {},
        fitToWindow() {},
        applyScalePolicy() {},
        dispose() {}
      }),
      createInputController: () => ({
        start() {},
        stop() {},
        isActive() {
          return true;
        },
        currentAim() {
          return { x: 0, y: 0 };
        },
        requestLock() {}
      }),
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    documentEvents.dispatch('pointerlockchange', new Event('pointerlockchange'));

    expect(sim.calls.pause).toBe(0);
    expect(pause.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'menu' });

    menu.start();
    sim.emit({ kind: 'win', simTime: 123 });
    documentEvents.dispatch('pointerlockchange', new Event('pointerlockchange'));

    expect(sim.calls.pause).toBe(0);
    expect(pause.isVisible()).toBe(false);
    expect(result.isVisible()).toBe(true);
    expect(shell.phase()).toEqual({ kind: 'result', outcome: 'win' });
  });

  it('keeps Space as dev pause without showing the pause overlay', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    const preventDefault = vi.fn();

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: () => ({
        render() {},
        fitToWindow() {},
        applyScalePolicy() {},
        dispose() {}
      }),
      createInputController: () => ({
        start() {},
        stop() {},
        isActive() {
          return true;
        },
        currentAim() {
          return { x: 0, y: 0 };
        },
        requestLock() {}
      }),
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();
    windowTarget.dispatch(
      'keydown',
      {
        code: 'Space',
        preventDefault,
        repeat: false
      } as unknown as Event
    );

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(sim.calls.pause).toBe(1);
    expect(pause.isVisible()).toBe(false);
    expect(result.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'running' });

    windowTarget.dispatch(
      'keydown',
      {
        code: 'Space',
        preventDefault,
        repeat: false
      } as unknown as Event
    );

    expect(sim.calls.resume).toBe(1);
    expect(pause.isVisible()).toBe(false);
    expect(result.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'running' });
  });

  it('applies the initial master volume from client settings and keeps audio subscribed', () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const settings = createClientSettingsStoreHarness({ masterVolume: 0.25 });
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: createRendererHarness().factory,
      createInputController: createInputHarness().factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      createClientSettingsStore: settings.factory,
      windowTarget,
      documentTarget
    });

    expect(audio.masterGainValues).toEqual([0.25]);

    settings.setMasterVolume(0.6);

    expect(audio.masterGainValues).toEqual([0.25, 0.6]);

    shell.dispose();
    expect(settings.calls.dispose).toBe(1);
  });

  it('uses the current render scale preset for renderer creation and unsubscribes it on teardown', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const settings = createClientSettingsStoreHarness({ renderScalePreset: 'high' });
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      createClientSettingsStore: settings.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();

    expect(renderer.lastInit()?.renderScalePreset).toBe('high');

    settings.setMasterVolume(0.5);
    expect(renderer.appliedPresets).toEqual([]);

    settings.setRenderScalePreset('low');
    expect(renderer.appliedPresets).toEqual(['low']);

    sim.emit({ kind: 'win', simTime: 123 });
    settings.setRenderScalePreset('medium');

    expect(renderer.appliedPresets).toEqual(['low']);
  });

  it('opens settings from the menu and closes them without changing the phase', async () => {
    const parent = new FakeDomElement();
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settings = createSettingsOverlayHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: parent as unknown as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settings.factory,
      createRenderer: createRendererHarness().factory,
      createInputController: createInputHarness().factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.openSettings();

    expect(settings.isVisible()).toBe(true);
    expect(menu.isVisible()).toBe(true);
    expect(shell.phase()).toEqual({ kind: 'menu' });
    expect(audio.uiEvents).toEqual(['buttonClick']);
    expect(Number(findHarnessRoot(parent, 'settings-overlay')?.style.zIndex ?? '0')).toBeGreaterThan(
      Number(findHarnessRoot(parent, 'menu-overlay')?.style.zIndex ?? '0')
    );

    settings.close();

    expect(settings.isVisible()).toBe(false);
    expect(menu.isVisible()).toBe(true);
    expect(shell.phase()).toEqual({ kind: 'menu' });
    expect(audio.uiEvents).toEqual(['buttonClick', 'buttonClick']);

    shell.dispose();
  });

  it('opens settings over pause, keeps the paused phase, and keeps the pause overlay underneath', async () => {
    const parent = new FakeDomElement();
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settings = createSettingsOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: parent as unknown as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settings.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();
    windowTarget.dispatch(
      'keydown',
      {
        code: 'Escape',
        preventDefault() {},
        repeat: false
      } as unknown as Event
    );

    pause.openSettings();

    expect(settings.isVisible()).toBe(true);
    expect(pause.isVisible()).toBe(true);
    expect(shell.phase()).toEqual({ kind: 'paused' });
    expect(sim.calls.pause).toBe(1);
    expect(sim.calls.resume).toBe(0);
    expect(audio.uiEvents.at(-1)).toBe('buttonClick');
    expect(Number(findHarnessRoot(parent, 'settings-overlay')?.style.zIndex ?? '0')).toBeGreaterThan(
      Number(findHarnessRoot(parent, 'pause-overlay')?.style.zIndex ?? '0')
    );

    settings.pressButton();
    expect(audio.uiEvents.at(-1)).toBe('buttonClick');
    expect(shell.phase()).toEqual({ kind: 'paused' });

    settings.close();

    expect(settings.isVisible()).toBe(false);
    expect(pause.isVisible()).toBe(true);
    expect(shell.phase()).toEqual({ kind: 'paused' });
  });

  it('does not expose settings in running or result because the entry overlays are hidden', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settings = createSettingsOverlayHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: new FakeDomElement() as unknown as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settings.factory,
      createRenderer: createRendererHarness().factory,
      createInputController: createInputHarness().factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();
    menu.openSettings();
    expect(settings.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'running' });

    sim.emit({ kind: 'win', simTime: 123 });
    pause.openSettings();
    expect(settings.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'result', outcome: 'win' });
  });

  it('freezes HUD updates while paused but keeps renderer rendering', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();
    shell.onFrame();
    expect(hud.calls.update).toBe(1);
    expect(renderer.calls.render).toBe(1);
    expect(audio.calls.update).toBe(1);

    windowTarget.dispatch(
      'keydown',
      {
        code: 'Escape',
        preventDefault() {},
        repeat: false
      } as unknown as Event
    );

    shell.onFrame();
    expect(hud.calls.update).toBe(1);
    expect(renderer.calls.render).toBe(2);
    expect(audio.calls.update).toBe(2);
    expect(pause.isVisible()).toBe(true);
    expect(result.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'paused' });
  });

  it('ignores Space while overlay pause is active', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    const preventDefault = vi.fn();

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: () => ({
        render() {},
        fitToWindow() {},
        applyScalePolicy() {},
        dispose() {}
      }),
      createInputController: () => ({
        start() {},
        stop() {},
        isActive() {
          return true;
        },
        currentAim() {
          return { x: 0, y: 0 };
        },
        requestLock() {}
      }),
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();
    windowTarget.dispatch(
      'keydown',
      {
        code: 'Escape',
        preventDefault() {},
        repeat: false
      } as unknown as Event
    );
    windowTarget.dispatch(
      'keydown',
      {
        code: 'Space',
        preventDefault,
        repeat: false
      } as unknown as Event
    );

    expect(sim.calls.pause).toBe(1);
    expect(sim.calls.resume).toBe(0);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(pause.isVisible()).toBe(true);
    expect(result.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'paused' });
  });

  it('ignores pause hotkeys in menu and result phases', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    const preventDefault = vi.fn();

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: () => ({
        render() {},
        fitToWindow() {},
        applyScalePolicy() {},
        dispose() {}
      }),
      createInputController: () => ({
        start() {},
        stop() {},
        isActive() {
          return true;
        },
        currentAim() {
          return { x: 0, y: 0 };
        },
        requestLock() {}
      }),
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    windowTarget.dispatch(
      'keydown',
      {
        code: 'Escape',
        preventDefault() {},
        repeat: false
      } as unknown as Event
    );
    windowTarget.dispatch(
      'keydown',
      {
        code: 'Space',
        preventDefault,
        repeat: false
      } as unknown as Event
    );

    expect(sim.calls.pause).toBe(0);
    expect(sim.calls.resume).toBe(0);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(pause.isVisible()).toBe(false);
    expect(result.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'menu' });

    menu.start();
    sim.emit({ kind: 'loss', simTime: 123 });

    windowTarget.dispatch(
      'keydown',
      {
        code: 'Escape',
        preventDefault() {},
        repeat: false
      } as unknown as Event
    );
    windowTarget.dispatch(
      'keydown',
      {
        code: 'Space',
        preventDefault,
        repeat: false
      } as unknown as Event
    );

    expect(sim.calls.pause).toBe(0);
    expect(sim.calls.resume).toBe(0);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(pause.isVisible()).toBe(false);
    expect(result.isVisible()).toBe(true);
    expect(result.outcome()).toBe('loss');
    expect(shell.phase()).toEqual({ kind: 'result', outcome: 'loss' });
  });

  it.each([
    ['win', 'win'],
    ['loss', 'loss']
  ] as const)('transitions to result on %s without calling stopSession', async (kind, outcome) => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();
    sim.emit({ kind, simTime: 123 });

    expect(sim.calls.stop).toBe(0);
    expect(input.calls.stop).toBe(1);
    expect(renderer.calls.dispose).toBe(1);
    expect(hud.calls.detach).toBe(1);
    expect(audio.events).toEqual([{ kind, simTime: 123 }]);
    expect(audio.calls.detach).toBe(1);
    expect(menu.isVisible()).toBe(false);
    expect(result.isVisible()).toBe(true);
    expect(result.outcome()).toBe(outcome);
    expect(audio.uiEvents).toContain('overlayShow');
    expect(shell.phase()).toEqual({ kind: 'result', outcome });
  });

  it('returns from result overlay to menu without calling stopSession again', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();
    sim.emit({ kind: 'win', simTime: 123 });

    expect(sim.calls.stop).toBe(0);
    expect(result.isVisible()).toBe(true);
    expect(shell.phase()).toEqual({ kind: 'result', outcome: 'win' });

    result.backToMenu();

    expect(sim.calls.stop).toBe(0);
    expect(input.calls.stop).toBe(1);
    expect(renderer.calls.dispose).toBe(1);
    expect(hud.calls.detach).toBe(1);
    expect(audio.calls.detach).toBe(1);
    expect(menu.isVisible()).toBe(true);
    expect(result.isVisible()).toBe(false);
    expect(audio.uiEvents.filter((eventId) => eventId === 'buttonClick')).toHaveLength(2);
    expect(shell.phase()).toEqual({ kind: 'menu' });
  });
});
