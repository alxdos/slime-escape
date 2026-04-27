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
      arena: { width: 32, height: 18 },
      pixelsPerWorldUnit: () => 10,
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
      arena: { width: 32, height: 18 },
      pixelsPerWorldUnit: () => 10,
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

function installInputGlobals(
  windowTarget: FakeEventTarget,
  documentTarget: FakeEventTarget & { pointerLockElement: Element | null; exitPointerLock(): void }
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
