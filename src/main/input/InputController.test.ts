import { afterEach, describe, expect, it } from 'vitest';

import type { InputCommand } from '../../shared/input';

import { createInputController } from './InputController';

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

type FakeKeyboardEvent = Event &
  Readonly<{
    code: string;
    repeat: boolean;
    defaultPrevented: boolean;
  }>;

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

afterEach(() => {
  restoreGlobal('window', originalWindow);
  restoreGlobal('document', originalDocument);
});

describe('InputController weapon hotkeys', () => {
  it('sends slot and holster commands from top-row digit codes', () => {
    const windowTarget = new FakeEventTarget();
    const documentTarget = Object.assign(new FakeEventTarget(), {
      pointerLockElement: null,
      exitPointerLock: () => {}
    });
    installInputGlobals(windowTarget, documentTarget);

    const commands: InputCommand[] = [];
    const canvas = Object.assign(new FakeEventTarget(), {
      requestPointerLock: () => {}
    }) as unknown as HTMLCanvasElement;
    const controller = createInputController({
      canvas,
      pixelsPerWorldUnit: () => 10,
      visibleArea: () => ({ width: 32, height: 18, center: { x: 0, y: 0 } }),
      initialAim: { x: 0, y: 0 },
      onCommand: (command) => commands.push(command)
    });

    controller.start();
    const slot = keyboardEvent('Digit3');
    const holster = keyboardEvent('Digit0');
    const repeat = keyboardEvent('Digit4', true);

    windowTarget.dispatch('keydown', slot);
    windowTarget.dispatch('keydown', holster);
    windowTarget.dispatch('keydown', repeat);

    expect(commands).toEqual([
      { kind: 'selectWeaponSlot', slotIndex: 2 },
      { kind: 'holsterWeapon' }
    ]);
    expect(slot.defaultPrevented).toBe(true);
    expect(holster.defaultPrevented).toBe(true);
    expect(repeat.defaultPrevented).toBe(true);
  });
});

describe('InputController cursor visibility', () => {
  it('hides the canvas cursor only while pointer lock is actually active', () => {
    const windowTarget = new FakeEventTarget();
    const documentTarget = Object.assign(new FakeEventTarget(), {
      pointerLockElement: null as Element | null,
      exitPointerLock: () => {
        documentTarget.pointerLockElement = null;
      }
    });
    installInputGlobals(windowTarget, documentTarget);

    const canvas = Object.assign(new FakeEventTarget(), {
      style: { cursor: '' },
      requestPointerLock: () => {}
    }) as unknown as HTMLCanvasElement;
    const controller = createInputController({
      canvas,
      pixelsPerWorldUnit: () => 10,
      visibleArea: () => ({ width: 32, height: 18, center: { x: 0, y: 0 } }),
      initialAim: { x: 0, y: 0 },
      onCommand: () => {}
    });

    controller.start();
    expect(canvas.style.cursor).toBe('');

    documentTarget.pointerLockElement = canvas;
    documentTarget.dispatch('pointerlockchange', new Event('pointerlockchange'));
    expect(canvas.style.cursor).toBe('none');

    documentTarget.pointerLockElement = null;
    documentTarget.dispatch('pointerlockchange', new Event('pointerlockchange'));
    expect(canvas.style.cursor).toBe('');

    documentTarget.pointerLockElement = canvas;
    documentTarget.dispatch('pointerlockchange', new Event('pointerlockchange'));
    controller.stop();
    expect(canvas.style.cursor).toBe('');
  });
});

describe('InputController pointer lock compatibility', () => {
  it('resyncs world aim when the visible-area center moves under a stable viewport cursor', () => {
    const windowTarget = new FakeEventTarget();
    const documentTarget = Object.assign(new FakeEventTarget(), {
      pointerLockElement: null as Element | null,
      exitPointerLock: () => {}
    });
    installInputGlobals(windowTarget, documentTarget);

    const commands: InputCommand[] = [];
    let center = { x: 0, y: 0 };
    const canvas = Object.assign(new FakeEventTarget(), {
      requestPointerLock: () => {}
    }) as unknown as HTMLCanvasElement;
    const controller = createInputController({
      canvas,
      pixelsPerWorldUnit: () => 10,
      visibleArea: () => ({ width: 12, height: 8, center }),
      initialAim: { x: 0, y: 0 },
      onCommand: (command) => commands.push(command)
    });

    controller.start();
    center = { x: 3, y: 2 };
    expect(controller.currentAim()).toEqual({ x: 3, y: 2 });

    controller.syncAim();

    expect(commands).toEqual([{ kind: 'aim', x: 3, y: 2 }]);
  });

  it('keeps the desktop first click dedicated to requesting Pointer Lock', () => {
    const windowTarget = new FakeEventTarget();
    const documentTarget = Object.assign(new FakeEventTarget(), {
      pointerLockElement: null as Element | null,
      exitPointerLock: () => {
        documentTarget.pointerLockElement = null;
      }
    });
    installInputGlobals(windowTarget, documentTarget);

    const commands: InputCommand[] = [];
    let requestLockCalls = 0;
    const canvasTarget = Object.assign(new FakeEventTarget(), {
      style: { cursor: '' },
      requestPointerLock: () => {
        requestLockCalls += 1;
      }
    });
    const canvas = canvasTarget as unknown as HTMLCanvasElement;
    const controller = createInputController({
      canvas,
      pixelsPerWorldUnit: () => 10,
      visibleArea: () => ({ width: 32, height: 18, center: { x: 0, y: 0 } }),
      initialAim: { x: 0, y: 0 },
      onCommand: (command) => commands.push(command)
    });

    controller.start();
    expect(requestLockCalls).toBe(1);

    canvasTarget.dispatch('mousedown', mouseEvent(0));
    windowTarget.dispatch('mouseup', mouseEvent(0));

    expect(requestLockCalls).toBe(2);
    expect(commands).toEqual([]);

    documentTarget.pointerLockElement = canvas;
    documentTarget.dispatch('pointerlockchange', new Event('pointerlockchange'));
    canvasTarget.dispatch('mousedown', mouseEvent(0));
    windowTarget.dispatch('mouseup', mouseEvent(0));

    expect(commands).toEqual([
      { kind: 'fire', phase: 'start' },
      { kind: 'fire', phase: 'stop' }
    ]);
  });

  it('starts without Pointer Lock support and falls back to click fire commands', () => {
    const windowTarget = new FakeEventTarget();
    const documentTarget = Object.assign(new FakeEventTarget(), {
      pointerLockElement: null as Element | null
    });
    installInputGlobals(windowTarget, documentTarget);

    const commands: InputCommand[] = [];
    const canvasTarget = Object.assign(new FakeEventTarget(), {
      style: { cursor: '' }
    });
    const canvas = canvasTarget as unknown as HTMLCanvasElement;
    const controller = createInputController({
      canvas,
      pixelsPerWorldUnit: () => 10,
      visibleArea: () => ({ width: 32, height: 18, center: { x: 0, y: 0 } }),
      initialAim: { x: 0, y: 0 },
      onCommand: (command) => commands.push(command)
    });

    expect(() => controller.start()).not.toThrow();
    expect(() => controller.requestLock()).not.toThrow();

    canvasTarget.dispatch('mousedown', mouseEvent(0));
    windowTarget.dispatch('mouseup', mouseEvent(0));

    expect(commands).toEqual([
      { kind: 'fire', phase: 'start' },
      { kind: 'fire', phase: 'stop' }
    ]);
    expect(canvas.style.cursor).toBe('');
    expect(() => controller.stop()).not.toThrow();
  });
});

function keyboardEvent(code: string, repeat = false): FakeKeyboardEvent {
  let defaultPrevented = false;
  const event = new Event('keydown');
  Object.defineProperties(event, {
    code: { value: code },
    repeat: { value: repeat },
    defaultPrevented: { get: () => defaultPrevented },
    preventDefault: {
      value: () => {
        defaultPrevented = true;
      }
    }
  });
  return event as FakeKeyboardEvent;
}

function mouseEvent(button: number): MouseEvent {
  const event = new Event('mouse');
  Object.defineProperty(event, 'button', { value: button });
  return event as MouseEvent;
}

function installInputGlobals(
  windowTarget: FakeEventTarget,
  documentTarget: FakeEventTarget & { pointerLockElement: Element | null; exitPointerLock?: () => void }
): void {
  Object.defineProperty(globalThis, 'window', {
    value: windowTarget,
    configurable: true
  });
  Object.defineProperty(globalThis, 'document', {
    value: documentTarget,
    configurable: true
  });
}

function restoreGlobal<K extends 'window' | 'document'>(
  key: K,
  value: (typeof globalThis)[K]
): void {
  if (value === undefined) {
    delete (globalThis as Partial<typeof globalThis>)[key];
    return;
  }
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true
  });
}
