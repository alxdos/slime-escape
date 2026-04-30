import { describe, expect, it } from 'vitest';

import type { InputCommand } from '../../shared/input';
import { SIM_STEP_MS } from '../../shared/timing';

import { createMobileInputController } from './MobileInputController';

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

  dispatchEvent(event: Event): boolean {
    this.dispatch(event.type, event);
    return true;
  }
}

class FakeElement extends FakeEventTarget {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = {};
  readonly capturedPointers: number[] = [];
  readonly releasedPointers: number[] = [];
  private readonly activeCaptures = new Set<number>();

  constructor(
    readonly clientWidth: number,
    readonly clientHeight: number,
    private readonly rect = makeRect(0, 0, clientWidth, clientHeight)
  ) {
    super();
  }

  appendChild(child: FakeElement): void {
    this.children.push(child);
  }

  contains(node: Node | null): boolean {
    return node === (this as unknown as EventTarget) || this.children.some((child) => child.contains(node));
  }

  getBoundingClientRect(): DOMRect {
    return this.rect;
  }

  setPointerCapture(pointerId: number): void {
    this.capturedPointers.push(pointerId);
    this.activeCaptures.add(pointerId);
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.activeCaptures.has(pointerId);
  }

  releasePointerCapture(pointerId: number): void {
    if (!this.activeCaptures.delete(pointerId)) {
      throw createNotFoundError();
    }
    this.releasedPointers.push(pointerId);
  }

  losePointerCapture(pointerId: number): void {
    this.activeCaptures.delete(pointerId);
  }
}

describe('MobileInputController', () => {
  it('maps lower-left drags to normalized movement and clears movement on release', () => {
    const surface = new FakeElement(800, 400);
    const windowTarget = new FakeEventTarget();
    const commands: InputCommand[] = [];
    const controller = createMobileInputController({
      surface,
      arena: { width: 32, height: 18 },
      pixelsPerWorldUnit: () => 10,
      initialAim: { x: 0, y: 0 },
      onCommand: (command) => commands.push(command),
      onPause: () => {},
      windowTarget
    });

    controller.start();
    surface.dispatch('pointerdown', pointerEvent('pointerdown', surface, { pointerId: 1, x: 100, y: 300 }));
    windowTarget.dispatch('pointermove', pointerEvent('pointermove', surface, { pointerId: 1, x: 172, y: 228 }));
    windowTarget.dispatch('pointerup', pointerEvent('pointerup', surface, { pointerId: 1, x: 172, y: 228 }));

    expect(commands).toHaveLength(2);
    expect(commands[0]).toMatchObject({ kind: 'move' });
    if (commands[0]?.kind !== 'move') throw new Error('expected move command');
    expect(commands[0].dx).toBeCloseTo(Math.SQRT1_2, 6);
    expect(commands[0].dy).toBeCloseTo(Math.SQRT1_2, 6);
    expect(commands[1]).toEqual({ kind: 'move', dx: 0, dy: 0 });
  });

  it('classifies child-target pointer starts in game-surface coordinates instead of target offsets', () => {
    const surface = new FakeElement(800, 400, makeRect(50, 100, 800, 400));
    const childTarget = new FakeElement(200, 120, makeRect(80, 340, 200, 120));
    surface.appendChild(childTarget);
    const windowTarget = new FakeEventTarget();
    const commands: InputCommand[] = [];
    const controller = createMobileInputController({
      surface,
      arena: { width: 32, height: 18 },
      pixelsPerWorldUnit: () => 10,
      initialAim: { x: 0, y: 0 },
      onCommand: (command) => commands.push(command),
      onPause: () => {},
      windowTarget
    });

    controller.start();
    surface.dispatch(
      'pointerdown',
      pointerEvent('pointerdown', surface, {
        pointerId: 25,
        x: 150,
        y: 380,
        offsetX: 10,
        offsetY: 10,
        target: childTarget
      })
    );
    windowTarget.dispatch(
      'pointermove',
      pointerEvent('pointermove', surface, {
        pointerId: 25,
        x: 222,
        y: 308,
        offsetX: 82,
        offsetY: -62,
        target: childTarget
      })
    );

    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ kind: 'move' });
    if (commands[0]?.kind !== 'move') throw new Error('expected move command');
    expect(commands[0].dx).toBeCloseTo(Math.SQRT1_2, 6);
    expect(commands[0].dy).toBeCloseTo(Math.SQRT1_2, 6);
    expect(surface.capturedPointers).toEqual([25]);
  });

  it('maps portrait-rotated surface touches into landscape control zones and drag deltas', () => {
    const surface = new FakeElement(844, 390, makeRect(0, 0, 390, 844));
    const windowTarget = new FakeEventTarget();
    const commands: InputCommand[] = [];
    const controller = createMobileInputController({
      surface,
      arena: { width: 32, height: 18 },
      pixelsPerWorldUnit: () => 10,
      initialAim: { x: 0, y: 0 },
      onCommand: (command) => commands.push(command),
      onPause: () => {},
      windowTarget
    });

    controller.start();
    surface.dispatch('pointerdown', pointerEvent('pointerdown', surface, { pointerId: 26, x: 88, y: 100 }));
    windowTarget.dispatch('pointermove', pointerEvent('pointermove', surface, { pointerId: 26, x: 88, y: 172 }));

    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ kind: 'move' });
    if (commands[0]?.kind !== 'move') throw new Error('expected move command');
    expect(commands[0].dx).toBeCloseTo(1, 6);
    expect(commands[0].dy).toBeCloseTo(0, 6);
    expect(surface.capturedPointers).toEqual([26]);
  });

  it('maps lower-right relative drags to clamped aim world coordinates', () => {
    const surface = new FakeElement(800, 400);
    const windowTarget = new FakeEventTarget();
    const commands: InputCommand[] = [];
    const controller = createMobileInputController({
      surface,
      arena: { width: 10, height: 6 },
      pixelsPerWorldUnit: () => 10,
      initialAim: { x: 0, y: 0 },
      onCommand: (command) => commands.push(command),
      onPause: () => {},
      windowTarget
    });

    controller.start();
    surface.dispatch('pointerdown', pointerEvent('pointerdown', surface, { pointerId: 2, x: 700, y: 300 }));
    windowTarget.dispatch('pointermove', pointerEvent('pointermove', surface, { pointerId: 2, x: 720, y: 280 }));
    windowTarget.dispatch('pointermove', pointerEvent('pointermove', surface, { pointerId: 2, x: 2000, y: -2000 }));

    expect(commands).toEqual([
      { kind: 'aim', x: 2, y: 2 },
      { kind: 'aim', x: 5, y: 3 }
    ]);
    expect(controller.currentAim()).toEqual({ x: 5, y: 3 });
  });

  it('keeps tap fire active for at least one simulation step and supports multiple fire touches', () => {
    const surface = new FakeElement(800, 400);
    const windowTarget = new FakeEventTarget();
    const timers = createTimerHarness();
    const commands: InputCommand[] = [];
    const controller = createMobileInputController({
      surface,
      arena: { width: 32, height: 18 },
      pixelsPerWorldUnit: () => 10,
      initialAim: { x: 0, y: 0 },
      onCommand: (command) => commands.push(command),
      onPause: () => {},
      windowTarget,
      nowMs: () => timers.now,
      setTimeoutFn: timers.setTimeout,
      clearTimeoutFn: timers.clearTimeout
    });

    controller.start();
    surface.dispatch('pointerdown', pointerEvent('pointerdown', surface, { pointerId: 3, x: 100, y: 80 }));
    surface.dispatch('pointerdown', pointerEvent('pointerdown', surface, { pointerId: 4, x: 700, y: 80 }));
    timers.now = 5;
    windowTarget.dispatch('pointerup', pointerEvent('pointerup', surface, { pointerId: 3, x: 100, y: 80 }));
    windowTarget.dispatch('pointerup', pointerEvent('pointerup', surface, { pointerId: 4, x: 700, y: 80 }));

    expect(commands).toEqual([{ kind: 'fire', phase: 'start' }]);
    expect(timers.pendingDelays()).toEqual([SIM_STEP_MS - 5]);

    timers.runNext();

    expect(commands).toEqual([
      { kind: 'fire', phase: 'start' },
      { kind: 'fire', phase: 'stop' }
    ]);
  });

  it('lets movement, aim, and fire run from separate touches at the same time', () => {
    const surface = new FakeElement(800, 400);
    const windowTarget = new FakeEventTarget();
    const commands: InputCommand[] = [];
    const controller = createMobileInputController({
      surface,
      arena: { width: 32, height: 18 },
      pixelsPerWorldUnit: () => 10,
      initialAim: { x: 0, y: 0 },
      onCommand: (command) => commands.push(command),
      onPause: () => {},
      windowTarget
    });

    controller.start();
    surface.dispatch('pointerdown', pointerEvent('pointerdown', surface, { pointerId: 5, x: 100, y: 300 }));
    surface.dispatch('pointerdown', pointerEvent('pointerdown', surface, { pointerId: 6, x: 700, y: 300 }));
    surface.dispatch('pointerdown', pointerEvent('pointerdown', surface, { pointerId: 7, x: 400, y: 80 }));
    windowTarget.dispatch('pointermove', pointerEvent('pointermove', surface, { pointerId: 5, x: 136, y: 300 }));
    windowTarget.dispatch('pointermove', pointerEvent('pointermove', surface, { pointerId: 6, x: 720, y: 300 }));

    expect(commands).toEqual([
      { kind: 'fire', phase: 'start' },
      { kind: 'move', dx: 0.5, dy: -0 },
      { kind: 'aim', x: 2, y: 0 }
    ]);
  });

  it('does not capture duplicate movement or aim pointer starts', () => {
    const surface = new FakeElement(800, 400);
    const windowTarget = new FakeEventTarget();
    const commands: InputCommand[] = [];
    const controller = createMobileInputController({
      surface,
      arena: { width: 32, height: 18 },
      pixelsPerWorldUnit: () => 10,
      initialAim: { x: 0, y: 0 },
      onCommand: (command) => commands.push(command),
      onPause: () => {},
      windowTarget
    });

    controller.start();
    surface.dispatch('pointerdown', pointerEvent('pointerdown', surface, { pointerId: 20, x: 100, y: 300 }));
    surface.dispatch('pointerdown', pointerEvent('pointerdown', surface, { pointerId: 21, x: 120, y: 320 }));
    surface.dispatch('pointerdown', pointerEvent('pointerdown', surface, { pointerId: 22, x: 700, y: 300 }));
    surface.dispatch('pointerdown', pointerEvent('pointerdown', surface, { pointerId: 23, x: 720, y: 320 }));

    expect(surface.capturedPointers).toEqual([20, 22]);
  });

  it('maps taps inside weapon slot bounds to existing slot-select commands', () => {
    const surface = new FakeElement(800, 400);
    const weaponSlot = new FakeElement(80, 80, makeRect(360, 300, 80, 80));
    weaponSlot.dataset['weaponSlot'] = '1';
    const windowTarget = new FakeEventTarget();
    const commands: InputCommand[] = [];
    const controller = createMobileInputController({
      surface,
      arena: { width: 32, height: 18 },
      pixelsPerWorldUnit: () => 10,
      initialAim: { x: 0, y: 0 },
      onCommand: (command) => commands.push(command),
      onPause: () => {},
      weaponSlotElements: () => [weaponSlot],
      windowTarget
    });

    controller.start();
    surface.dispatch('pointerdown', pointerEvent('pointerdown', surface, { pointerId: 24, x: 400, y: 340 }));

    expect(commands).toEqual([{ kind: 'selectWeaponSlot', slotIndex: 1 }]);
    expect(surface.capturedPointers).toEqual([]);
  });

  it('gives pause button pointer starts priority over fire without pausing dragged fire touches', () => {
    const surface = new FakeElement(800, 400);
    const pauseButton = new FakeElement(90, 42, makeRect(355, 12, 90, 42));
    surface.appendChild(pauseButton);
    const windowTarget = new FakeEventTarget();
    const commands: InputCommand[] = [];
    let pauseCalls = 0;
    const controller = createMobileInputController({
      surface,
      arena: { width: 32, height: 18 },
      pixelsPerWorldUnit: () => 10,
      initialAim: { x: 0, y: 0 },
      onCommand: (command) => commands.push(command),
      onPause: () => {
        pauseCalls += 1;
      },
      pauseElement: () => pauseButton,
      windowTarget
    });

    controller.start();
    surface.dispatch(
      'pointerdown',
      pointerEvent('pointerdown', surface, {
        pointerId: 8,
        x: 400,
        y: 30,
        target: pauseButton
      })
    );
    surface.dispatch('pointerdown', pointerEvent('pointerdown', surface, { pointerId: 9, x: 120, y: 80 }));
    windowTarget.dispatch(
      'pointermove',
      pointerEvent('pointermove', surface, {
        pointerId: 9,
        x: 400,
        y: 30,
        target: pauseButton
      })
    );

    expect(pauseCalls).toBe(1);
    expect(commands).toEqual([{ kind: 'fire', phase: 'start' }]);
  });

  it('sends neutral movement and fire stop on controller stop', () => {
    const surface = new FakeElement(800, 400);
    const windowTarget = new FakeEventTarget();
    const commands: InputCommand[] = [];
    const controller = createMobileInputController({
      surface,
      arena: { width: 32, height: 18 },
      pixelsPerWorldUnit: () => 10,
      initialAim: { x: 0, y: 0 },
      onCommand: (command) => commands.push(command),
      onPause: () => {},
      windowTarget
    });

    controller.start();
    surface.dispatch('pointerdown', pointerEvent('pointerdown', surface, { pointerId: 10, x: 100, y: 300 }));
    windowTarget.dispatch('pointermove', pointerEvent('pointermove', surface, { pointerId: 10, x: 136, y: 300 }));
    surface.dispatch('pointerdown', pointerEvent('pointerdown', surface, { pointerId: 11, x: 500, y: 80 }));
    controller.stop();

    expect(commands).toEqual([
      { kind: 'move', dx: 0.5, dy: -0 },
      { kind: 'fire', phase: 'start' },
      { kind: 'move', dx: 0, dy: 0 },
      { kind: 'fire', phase: 'stop' }
    ]);
    expect(surface.releasedPointers).toEqual([10, 11]);
  });

  it('ignores browser-lost pointer capture when pause stops active controls', () => {
    const surface = new FakeElement(800, 400);
    const pauseButton = new FakeElement(90, 42, makeRect(355, 12, 90, 42));
    surface.appendChild(pauseButton);
    const windowTarget = new FakeEventTarget();
    const commands: InputCommand[] = [];
    let pauseCalls = 0;
    const controller = createMobileInputController({
      surface,
      arena: { width: 32, height: 18 },
      pixelsPerWorldUnit: () => 10,
      initialAim: { x: 0, y: 0 },
      onCommand: (command) => commands.push(command),
      onPause: () => {
        pauseCalls += 1;
        controller.stop();
      },
      pauseElement: () => pauseButton,
      windowTarget
    });

    controller.start();
    surface.dispatch('pointerdown', pointerEvent('pointerdown', surface, { pointerId: 12, x: 100, y: 80 }));
    surface.losePointerCapture(12);

    expect(() => {
      surface.dispatch(
        'pointerdown',
        pointerEvent('pointerdown', surface, {
          pointerId: 13,
          x: 400,
          y: 30,
          target: pauseButton
        })
      );
    }).not.toThrow();

    expect(pauseCalls).toBe(1);
    expect(commands).toEqual([
      { kind: 'fire', phase: 'start' },
      { kind: 'fire', phase: 'stop' }
    ]);
    expect(surface.releasedPointers).toEqual([]);
  });
});

function pointerEvent(
  type: string,
  defaultTarget: EventTarget,
  init: Readonly<{
    pointerId: number;
    x: number;
    y: number;
    offsetX?: number;
    offsetY?: number;
    target?: EventTarget;
  }>
): PointerEvent {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: init.pointerId },
    offsetX: { value: init.offsetX ?? init.x },
    offsetY: { value: init.offsetY ?? init.y },
    clientX: { value: init.x },
    clientY: { value: init.y },
    target: { value: init.target ?? defaultTarget }
  });
  return event as PointerEvent;
}

function makeRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({})
  } as DOMRect;
}

function createNotFoundError(): Error {
  const error = new Error('No active pointer with the given id is found.');
  error.name = 'NotFoundError';
  return error;
}

function createTimerHarness() {
  let nextId = 1;
  const timers = new Map<number, Readonly<{ callback: () => void; delayMs: number }>>();
  return {
    now: 0,
    setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout> {
      const id = nextId;
      nextId += 1;
      timers.set(id, { callback, delayMs });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout(timerId: ReturnType<typeof setTimeout>): void {
      timers.delete(timerId as unknown as number);
    },
    pendingDelays(): number[] {
      return [...timers.values()].map((timer) => timer.delayMs);
    },
    runNext(): void {
      const next = timers.entries().next().value as
        | [number, Readonly<{ callback: () => void; delayMs: number }>]
        | undefined;
      if (next === undefined) {
        throw new Error('expected pending timer');
      }
      const [id, timer] = next;
      this.now += timer.delayMs;
      timers.delete(id);
      timer.callback();
    }
  };
}
