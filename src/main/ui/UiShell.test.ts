import { describe, expect, it, vi } from 'vitest';

import type { RuntimeEvent } from '../../shared/events';
import type { InputCommand } from '../../shared/input';
import type { SessionDefinition } from '../../shared/session';
import type { InputController, InputControllerInit } from '../input/InputController';
import type { Renderer, RendererInit } from '../render/Renderer';
import type { SimWorkerHost, SimWorkerHostOptions, SnapshotPair } from '../sim/SimWorkerHost';

import { createUiShell } from './UiShell';
import type { MenuOverlay, MenuOverlayInit, MenuResult } from './MenuOverlay';
import type { PauseOverlay, PauseOverlayInit } from './PauseOverlay';

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

function createMenuHarness() {
  let visible = true;
  let result: MenuResult = null;
  let onStart: (() => void) | null = null;

  const overlay: MenuOverlay = {
    show(): void {
      visible = true;
    },
    hide(): void {
      visible = false;
    },
    isVisible(): boolean {
      return visible;
    },
    setResult(next): void {
      result = next;
    },
    dispose(): void {}
  };

  return {
    factory(init: MenuOverlayInit): MenuOverlay {
      onStart = init.onStart;
      return overlay;
    },
    start(): void {
      onStart?.();
    },
    isVisible(): boolean {
      return visible;
    },
    result(): MenuResult {
      return result;
    }
  };
}

function createPauseHarness() {
  let visible = false;
  let onResume: (() => void) | null = null;
  let onExit: (() => void) | null = null;

  const overlay: PauseOverlay = {
    show(): void {
      visible = true;
    },
    hide(): void {
      visible = false;
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
      return overlay;
    },
    resume(): void {
      onResume?.();
    },
    exit(): void {
      onExit?.();
    },
    isVisible(): boolean {
      return visible;
    }
  };
}

function createRendererHarness() {
  const calls = {
    create: 0,
    render: 0,
    fitToWindow: 0,
    dispose: 0
  };

  return {
    factory(_init: RendererInit): Renderer {
      calls.create += 1;
      return {
        render(): void {
          calls.render += 1;
        },
        fitToWindow(): void {
          calls.fitToWindow += 1;
        },
        dispose(): void {
          calls.dispose += 1;
        }
      };
    },
    calls
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

describe('UiShell', () => {
  it('starts a session from the menu and hides overlays while running', () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    const buildSession = vi.fn(() => makeSession('running-session'));

    const shell = createUiShell({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      pixelRatio: 1,
      makeSeed: () => 123,
      buildSessionDefinition: buildSession,
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      windowTarget,
      documentTarget
    });

    menu.start();

    expect(buildSession).toHaveBeenCalledTimes(1);
    expect(sim.startSessions).toHaveLength(1);
    expect(renderer.calls.create).toBe(1);
    expect(input.calls.create).toBe(1);
    expect(input.calls.start).toBe(1);
    expect(menu.isVisible()).toBe(false);
    expect(pause.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'running' });
  });

  it('routes Escape into overlay pause and exit back to menu with stopSession', () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShell({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      pixelRatio: 1,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      windowTarget,
      documentTarget
    });

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
    expect(shell.phase()).toEqual({ kind: 'paused' });

    pause.exit();

    expect(sim.calls.stop).toBe(1);
    expect(input.calls.stop).toBe(1);
    expect(renderer.calls.dispose).toBe(1);
    expect(menu.isVisible()).toBe(true);
    expect(pause.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'menu' });
  });

  it('routes pointer lock loss into overlay pause while a run is active', () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const sim = createSimHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShell({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      pixelRatio: 1,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createRenderer: () => ({
        render() {},
        fitToWindow() {},
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
      windowTarget,
      documentTarget
    });

    menu.start();
    documentEvents.dispatch('pointerlockchange', new Event('pointerlockchange'));

    expect(sim.calls.pause).toBe(1);
    expect(pause.isVisible()).toBe(true);
    expect(shell.phase()).toEqual({ kind: 'paused' });
  });

  it('keeps Space as dev pause without showing the pause overlay', () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const sim = createSimHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    const preventDefault = vi.fn();

    const shell = createUiShell({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      pixelRatio: 1,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createRenderer: () => ({
        render() {},
        fitToWindow() {},
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
      windowTarget,
      documentTarget
    });

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
    expect(shell.phase()).toEqual({ kind: 'running' });
  });

  it.each([
    ['win', 'win'],
    ['loss', 'loss']
  ] as const)('transitions to result on %s without calling stopSession', (kind, outcome) => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShell({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      pixelRatio: 1,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      windowTarget,
      documentTarget
    });

    menu.start();
    sim.emit({ kind, simTime: 123 });

    expect(sim.calls.stop).toBe(0);
    expect(input.calls.stop).toBe(1);
    expect(renderer.calls.dispose).toBe(1);
    expect(menu.isVisible()).toBe(true);
    expect(menu.result()).toBe(outcome);
    expect(shell.phase()).toEqual({ kind: 'result', outcome });
  });
});
