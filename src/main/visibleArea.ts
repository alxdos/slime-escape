import type { ArenaConfig, Vec2 } from '../shared/session';
import type { ViewportSize } from './mobileWebProfile';

export type VisibleArea = Readonly<{
  width: number;
  height: number;
  center: Vec2;
}>;

export type VisibleAreaProfile = 'desktop' | 'mobile';

export type VisibleAreaSizeInput = Readonly<{
  arena: ArenaConfig;
  profile: VisibleAreaProfile;
  effectiveViewport: ViewportSize;
}>;

export type InitialVisibleAreaInput = VisibleAreaSizeInput &
  Readonly<{
    playerPosition: Vec2;
  }>;

const DESKTOP_VISIBLE_SHORT_SIDE_WU = 18;
const MOBILE_VISIBLE_SHORT_SIDE_WU = 12;
const DESKTOP_VISIBLE_ASPECT = 16 / 9;

export function resolveVisibleAreaSize(input: VisibleAreaSizeInput): Omit<VisibleArea, 'center'> {
  assertPositiveArena(input.arena);
  const visibleAspect =
    input.profile === 'mobile'
      ? safeAspect(input.effectiveViewport.width, input.effectiveViewport.height)
      : DESKTOP_VISIBLE_ASPECT;
  const platformAnchor =
    input.profile === 'mobile'
      ? MOBILE_VISIBLE_SHORT_SIDE_WU
      : DESKTOP_VISIBLE_SHORT_SIDE_WU;

  const shortSide = Math.min(platformAnchor, input.arena.width, input.arena.height);
  let height = shortSide;
  let width = height * visibleAspect;

  if (width > input.arena.width) {
    width = input.arena.width;
    height = width / visibleAspect;
  }
  if (height > input.arena.height) {
    height = input.arena.height;
    width = height * visibleAspect;
  }

  return { width, height };
}

export function resolveInitialVisibleArea(input: InitialVisibleAreaInput): VisibleArea {
  const size = resolveVisibleAreaSize(input);
  return {
    ...size,
    center: clampVisibleAreaCenter(input.arena, size, input.playerPosition)
  };
}

export function clampVisibleAreaCenter(
  arena: ArenaConfig,
  size: Readonly<{ width: number; height: number }>,
  center: Vec2
): Vec2 {
  assertPositiveArena(arena);
  if (size.width <= 0 || size.height <= 0) {
    throw new Error('visible area size must be positive');
  }
  if (size.width > arena.width || size.height > arena.height) {
    throw new Error('visible area size must fit inside arena');
  }

  return {
    x: clampAxisCenter(center.x, arena.width, size.width),
    y: clampAxisCenter(center.y, arena.height, size.height)
  };
}

function clampAxisCenter(value: number, arenaSide: number, visibleSide: number): number {
  const maxOffset = Math.max(0, (arenaSide - visibleSide) / 2);
  if (maxOffset === 0) {
    return 0;
  }
  return Math.min(maxOffset, Math.max(-maxOffset, value));
}

function safeAspect(width: number, height: number): number {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1;
  return Math.max(safeWidth, safeHeight) / Math.min(safeWidth, safeHeight);
}

function assertPositiveArena(arena: ArenaConfig): void {
  if (arena.width <= 0 || arena.height <= 0) {
    throw new Error('arena dimensions must be positive');
  }
}
