import type { InputCommand } from '../../shared/input';
import { log } from '../../shared/log';
import type { ArenaConfig } from '../../shared/session';

import {
  applyMouseDeltaToAim,
  moveVectorFromKeys,
  weaponHotkeyCommandFromCode,
  type MoveVector,
  type Vec2
} from './inputMath';

const MOVEMENT_CODES = [
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight'
] as const;

type MovementCode = (typeof MOVEMENT_CODES)[number];

function isMovementCode(code: string): code is MovementCode {
  return (MOVEMENT_CODES as readonly string[]).includes(code);
}

export type InputControllerInit = Readonly<{
  canvas: HTMLCanvasElement;
  arena: ArenaConfig;
  pixelsPerWorldUnit(): number;
  initialAim: Vec2;
  onCommand(command: InputCommand): void;
}>;

export type InputController = Readonly<{
  start(): void;
  stop(): void;
  isActive(): boolean;
  currentAim(): Vec2;
  requestLock(): void;
}>;

export function createInputController(init: InputControllerInit): InputController {
  const { canvas, arena, pixelsPerWorldUnit, onCommand } = init;

  let active = false;
  const keys = { up: false, down: false, left: false, right: false };
  let aim: Vec2 = init.initialAim;
  let lastSentMove: MoveVector = { dx: 0, dy: 0 };
  let pendingAim = false;
  let aimRaf = 0;
  let fireActive = false;

  function setKey(code: MovementCode, down: boolean): void {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        keys.up = down;
        return;
      case 'KeyS':
      case 'ArrowDown':
        keys.down = down;
        return;
      case 'KeyA':
      case 'ArrowLeft':
        keys.left = down;
        return;
      case 'KeyD':
      case 'ArrowRight':
        keys.right = down;
        return;
    }
  }

  function sendMoveIfChanged(): void {
    const next = moveVectorFromKeys(keys);
    if (next.dx === lastSentMove.dx && next.dy === lastSentMove.dy) return;
    lastSentMove = next;
    onCommand({ kind: 'move', dx: next.dx, dy: next.dy });
  }

  function flushAim(): void {
    aimRaf = 0;
    if (!pendingAim) return;
    pendingAim = false;
    onCommand({ kind: 'aim', x: aim.x, y: aim.y });
  }

  function scheduleAim(): void {
    pendingAim = true;
    if (aimRaf !== 0) return;
    aimRaf = requestAnimationFrame(flushAim);
  }

  function isLocked(): boolean {
    return document.pointerLockElement === canvas;
  }

  function requestPointerLockIfAvailable(): boolean {
    if (isLocked()) return true;
    const requestPointerLock = canvas.requestPointerLock;
    if (typeof requestPointerLock !== 'function') return false;

    try {
      void Promise.resolve(requestPointerLock.call(canvas)).catch((error: unknown) => {
        log.warn('pointer lock request failed', { error });
        syncCursorVisibility();
      });
      return true;
    } catch (error) {
      log.warn('pointer lock request failed', { error });
      return false;
    }
  }

  function syncCursorVisibility(): void {
    const style = (canvas as Partial<Pick<HTMLCanvasElement, 'style'>>).style;
    if (style === undefined) return;
    style.cursor = isLocked() ? 'none' : '';
  }

  function onKeyDown(event: KeyboardEvent): void {
    const weaponCommand = weaponHotkeyCommandFromCode(event.code);
    if (weaponCommand !== null) {
      event.preventDefault();
      if (event.repeat) return;
      onCommand(weaponCommand);
      return;
    }
    if (!isMovementCode(event.code)) return;
    event.preventDefault();
    if (event.repeat) return;
    setKey(event.code, true);
    sendMoveIfChanged();
  }

  function onKeyUp(event: KeyboardEvent): void {
    if (!isMovementCode(event.code)) return;
    event.preventDefault();
    setKey(event.code, false);
    sendMoveIfChanged();
  }

  function onMouseMove(event: MouseEvent): void {
    if (!isLocked()) return;
    aim = applyMouseDeltaToAim(aim, event.movementX, event.movementY, pixelsPerWorldUnit(), arena);
    scheduleAim();
  }

  function onMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    if (!isLocked()) {
      if (requestPointerLockIfAvailable()) return;
    }
    if (fireActive) return;
    fireActive = true;
    onCommand({ kind: 'fire', phase: 'start' });
  }

  function onMouseUp(event: MouseEvent): void {
    if (event.button !== 0) return;
    if (!fireActive) return;
    fireActive = false;
    onCommand({ kind: 'fire', phase: 'stop' });
  }

  function onPointerLockError(): void {
    log.warn('pointer lock request failed');
  }

  function attach(): void {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', syncCursorVisibility);
    document.addEventListener('pointerlockerror', onPointerLockError);
    syncCursorVisibility();
  }

  function detach(): void {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('pointerlockchange', syncCursorVisibility);
    document.removeEventListener('pointerlockerror', onPointerLockError);
    if (aimRaf !== 0) {
      cancelAnimationFrame(aimRaf);
      aimRaf = 0;
    }
    pendingAim = false;
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock?.();
    }
    syncCursorVisibility();
  }

  function resetState(): void {
    keys.up = false;
    keys.down = false;
    keys.left = false;
    keys.right = false;
    lastSentMove = { dx: 0, dy: 0 };
    aim = init.initialAim;
    fireActive = false;
  }

  return {
    start(): void {
      if (active) return;
      active = true;
      resetState();
      attach();
      requestPointerLockIfAvailable();
    },
    stop(): void {
      if (!active) return;
      active = false;
      detach();
    },
    isActive(): boolean {
      return active;
    },
    currentAim(): Vec2 {
      return { x: aim.x, y: aim.y };
    },
    requestLock(): void {
      requestPointerLockIfAvailable();
    }
  };
}
