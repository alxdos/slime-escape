import type { ArenaConfig } from '../../shared/session';

export type KeyState = Readonly<{
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}>;

export type Vec2 = Readonly<{ x: number; y: number }>;

export type MoveVector = Readonly<{ dx: number; dy: number }>;

export function moveVectorFromKeys(keys: KeyState): MoveVector {
  const dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const dy = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
  if (dx === 0 && dy === 0) {
    return { dx: 0, dy: 0 };
  }
  const len = Math.hypot(dx, dy);
  return len > 1 ? { dx: dx / len, dy: dy / len } : { dx, dy };
}

export function clampAimToArena(aim: Vec2, arena: ArenaConfig): Vec2 {
  const halfW = arena.width / 2;
  const halfH = arena.height / 2;
  return {
    x: clamp(aim.x, -halfW, halfW),
    y: clamp(aim.y, -halfH, halfH)
  };
}

export function applyMouseDeltaToAim(
  aim: Vec2,
  movementX: number,
  movementY: number,
  pixelsPerWorldUnit: number,
  arena: ArenaConfig
): Vec2 {
  if (pixelsPerWorldUnit <= 0) {
    return aim;
  }
  const next = {
    x: aim.x + movementX / pixelsPerWorldUnit,
    y: aim.y - movementY / pixelsPerWorldUnit
  };
  return clampAimToArena(next, arena);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
