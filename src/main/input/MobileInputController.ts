import type { InputCommand } from '../../shared/input';
import type { ArenaConfig } from '../../shared/session';
import { SIM_STEP_MS } from '../../shared/timing';

import { applyMouseDeltaToAim, clampAimToArena, type MoveVector, type Vec2 } from './inputMath';
import type { InputController } from './InputController';

type EventTargetLike = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

type MobileSurface = EventTargetLike &
  Pick<HTMLElement, 'clientWidth' | 'clientHeight' | 'getBoundingClientRect'> &
  Partial<Pick<HTMLElement, 'setPointerCapture' | 'releasePointerCapture'>>;

type PauseElement = Readonly<{
  contains(node: Node | null): boolean;
  getBoundingClientRect(): DOMRect;
}>;

type TimerId = ReturnType<typeof setTimeout>;

export type MobileInputControllerInit = Readonly<{
  surface: MobileSurface;
  arena: ArenaConfig;
  pixelsPerWorldUnit(): number;
  initialAim: Vec2;
  onCommand(command: InputCommand): void;
  onPause(): void;
  pauseElement?: () => PauseElement | null;
  windowTarget?: EventTargetLike;
  nowMs?: () => number;
  setTimeoutFn?: (callback: () => void, delayMs: number) => TimerId;
  clearTimeoutFn?: (timerId: TimerId) => void;
}>;

type SurfacePoint = Readonly<{
  x: number;
  y: number;
}>;

type SurfaceSize = Readonly<{
  width: number;
  height: number;
}>;

type MovementPointer = Readonly<{
  pointerId: number;
  origin: SurfacePoint;
}>;

type AimPointer = Readonly<{
  pointerId: number;
  last: SurfacePoint;
}>;

type PointerZone = 'pause' | 'fire' | 'move' | 'aim' | 'ignored';

const MOVE_STICK_RADIUS_PX = 72;
const PAUSE_HIT_PADDING_PX = 12;

export function createMobileInputController(init: MobileInputControllerInit): InputController {
  const windowTarget = init.windowTarget ?? window;
  const nowMs = init.nowMs ?? defaultNowMs;
  const setTimeoutFn: (callback: () => void, delayMs: number) => TimerId =
    init.setTimeoutFn ?? ((callback, delayMs) => setTimeout(callback, delayMs));
  const clearTimeoutFn: (timerId: TimerId) => void =
    init.clearTimeoutFn ?? ((timerId) => clearTimeout(timerId));

  let active = false;
  let aim = clampAimToArena(init.initialAim, init.arena);
  let movementPointer: MovementPointer | null = null;
  let aimPointer: AimPointer | null = null;
  let lastSentMove: MoveVector = { dx: 0, dy: 0 };
  const firePointers = new Set<number>();
  let fireActive = false;
  let fireStartedAtMs = 0;
  let fireStopTimer: TimerId | null = null;

  function onPointerDown(event: PointerEvent): void {
    if (!active) return;
    const point = surfacePointFromEvent(event, init.surface);
    const zone = classifyPointerStart(event, point);
    if (zone === 'ignored') return;
    event.preventDefault();

    if (zone === 'pause') {
      init.onPause();
      return;
    }

    init.surface.setPointerCapture?.(event.pointerId);
    switch (zone) {
      case 'move':
        if (movementPointer !== null) return;
        movementPointer = { pointerId: event.pointerId, origin: point };
        sendMoveIfChanged({ dx: 0, dy: 0 });
        return;
      case 'aim':
        if (aimPointer !== null) return;
        aimPointer = { pointerId: event.pointerId, last: point };
        return;
      case 'fire':
        startFirePointer(event.pointerId);
        return;
    }
  }

  function onPointerMove(event: PointerEvent): void {
    if (!active) return;
    const point = surfacePointFromEvent(event, init.surface);
    if (movementPointer?.pointerId === event.pointerId) {
      event.preventDefault();
      sendMoveIfChanged(moveFromDrag(movementPointer.origin, point));
      return;
    }
    if (aimPointer?.pointerId === event.pointerId) {
      event.preventDefault();
      const dx = point.x - aimPointer.last.x;
      const dy = point.y - aimPointer.last.y;
      aimPointer = { pointerId: event.pointerId, last: point };
      aim = applyMouseDeltaToAim(aim, dx, dy, init.pixelsPerWorldUnit(), init.arena);
      init.onCommand({ kind: 'aim', x: aim.x, y: aim.y });
    }
  }

  function onPointerUp(event: PointerEvent): void {
    if (!active) return;
    endPointer(event.pointerId);
  }

  function endPointer(pointerId: number): void {
    if (movementPointer?.pointerId === pointerId) {
      movementPointer = null;
      sendMoveIfChanged({ dx: 0, dy: 0 });
      init.surface.releasePointerCapture?.(pointerId);
      return;
    }
    if (aimPointer?.pointerId === pointerId) {
      aimPointer = null;
      init.surface.releasePointerCapture?.(pointerId);
      return;
    }
    if (firePointers.delete(pointerId)) {
      init.surface.releasePointerCapture?.(pointerId);
      stopFireWhenReady();
    }
  }

  function classifyPointerStart(event: PointerEvent, point: SurfacePoint): PointerZone {
    if (isPausePointerStart(event, point)) {
      return 'pause';
    }
    const size = surfaceSize(init.surface);
    if (point.y < size.height / 2) {
      return 'fire';
    }
    if (point.x < size.width / 2) {
      return 'move';
    }
    return 'aim';
  }

  function isPausePointerStart(event: PointerEvent, point: SurfacePoint): boolean {
    const pauseElement = init.pauseElement?.() ?? null;
    if (pauseElement === null) {
      return false;
    }
    if (pauseElement.contains(event.target as Node | null)) {
      return true;
    }
    const surfaceRect = init.surface.getBoundingClientRect();
    const pauseRect = pauseElement.getBoundingClientRect();
    const left = pauseRect.left - surfaceRect.left - PAUSE_HIT_PADDING_PX;
    const right = pauseRect.right - surfaceRect.left + PAUSE_HIT_PADDING_PX;
    const top = pauseRect.top - surfaceRect.top - PAUSE_HIT_PADDING_PX;
    const bottom = pauseRect.bottom - surfaceRect.top + PAUSE_HIT_PADDING_PX;
    return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
  }

  function startFirePointer(pointerId: number): void {
    firePointers.add(pointerId);
    if (fireStopTimer !== null) {
      clearTimeoutFn(fireStopTimer);
      fireStopTimer = null;
    }
    if (fireActive) {
      return;
    }
    fireActive = true;
    fireStartedAtMs = nowMs();
    init.onCommand({ kind: 'fire', phase: 'start' });
  }

  function stopFireWhenReady(): void {
    if (firePointers.size > 0 || !fireActive) {
      return;
    }
    const elapsedMs = nowMs() - fireStartedAtMs;
    const delayMs = Math.max(0, SIM_STEP_MS - elapsedMs);
    if (delayMs <= 0) {
      stopFireNow();
      return;
    }
    if (fireStopTimer !== null) {
      return;
    }
    fireStopTimer = setTimeoutFn(() => {
      fireStopTimer = null;
      if (firePointers.size === 0) {
        stopFireNow();
      }
    }, delayMs);
  }

  function stopFireNow(): void {
    if (!fireActive) {
      return;
    }
    fireActive = false;
    init.onCommand({ kind: 'fire', phase: 'stop' });
  }

  function sendMoveIfChanged(next: MoveVector): void {
    if (next.dx === lastSentMove.dx && next.dy === lastSentMove.dy) {
      return;
    }
    lastSentMove = next;
    init.onCommand({ kind: 'move', dx: next.dx, dy: next.dy });
  }

  function resetTransientState(): void {
    movementPointer = null;
    aimPointer = null;
    firePointers.clear();
    lastSentMove = { dx: 0, dy: 0 };
    fireActive = false;
    fireStartedAtMs = 0;
    if (fireStopTimer !== null) {
      clearTimeoutFn(fireStopTimer);
      fireStopTimer = null;
    }
  }

  function cleanupForStop(): void {
    const capturedPointerIds = [
      movementPointer?.pointerId,
      aimPointer?.pointerId,
      ...firePointers
    ].filter((pointerId): pointerId is number => pointerId !== undefined);
    for (const pointerId of capturedPointerIds) {
      init.surface.releasePointerCapture?.(pointerId);
    }
    movementPointer = null;
    aimPointer = null;
    firePointers.clear();
    if (lastSentMove.dx !== 0 || lastSentMove.dy !== 0) {
      lastSentMove = { dx: 0, dy: 0 };
      init.onCommand({ kind: 'move', dx: 0, dy: 0 });
    }
    if (fireStopTimer !== null) {
      clearTimeoutFn(fireStopTimer);
      fireStopTimer = null;
    }
    stopFireNow();
  }

  function attach(): void {
    init.surface.addEventListener('pointerdown', onPointerDown as EventListener);
    windowTarget.addEventListener('pointermove', onPointerMove as EventListener);
    windowTarget.addEventListener('pointerup', onPointerUp as EventListener);
    windowTarget.addEventListener('pointercancel', onPointerUp as EventListener);
  }

  function detach(): void {
    init.surface.removeEventListener('pointerdown', onPointerDown as EventListener);
    windowTarget.removeEventListener('pointermove', onPointerMove as EventListener);
    windowTarget.removeEventListener('pointerup', onPointerUp as EventListener);
    windowTarget.removeEventListener('pointercancel', onPointerUp as EventListener);
  }

  return {
    start(): void {
      if (active) return;
      active = true;
      resetTransientState();
      attach();
    },
    stop(): void {
      if (!active) return;
      active = false;
      cleanupForStop();
      detach();
    },
    isActive(): boolean {
      return active;
    },
    currentAim(): Vec2 {
      return { x: aim.x, y: aim.y };
    },
    requestLock(): void {}
  };
}

function moveFromDrag(origin: SurfacePoint, point: SurfacePoint): MoveVector {
  const rawDx = (point.x - origin.x) / MOVE_STICK_RADIUS_PX;
  const rawDy = -(point.y - origin.y) / MOVE_STICK_RADIUS_PX;
  if (rawDx === 0 && rawDy === 0) {
    return { dx: 0, dy: 0 };
  }
  const length = Math.hypot(rawDx, rawDy);
  if (length <= 1) {
    return { dx: rawDx, dy: rawDy };
  }
  return { dx: rawDx / length, dy: rawDy / length };
}

function surfacePointFromEvent(event: PointerEvent, surface: MobileSurface): SurfacePoint {
  const offset = event as PointerEvent & Readonly<{ offsetX?: number; offsetY?: number }>;
  if (Number.isFinite(offset.offsetX) && Number.isFinite(offset.offsetY)) {
    return { x: offset.offsetX, y: offset.offsetY };
  }
  const rect = surface.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function surfaceSize(surface: MobileSurface): SurfaceSize {
  const rect = surface.getBoundingClientRect();
  return {
    width: surface.clientWidth > 0 ? surface.clientWidth : rect.width,
    height: surface.clientHeight > 0 ? surface.clientHeight : rect.height
  };
}

function defaultNowMs(): number {
  return performance.now();
}
