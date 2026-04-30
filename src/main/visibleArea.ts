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

export type VisibleAreaCamera = Readonly<{
  visibleArea(): VisibleArea;
  resize(effectiveViewport: ViewportSize): void;
  follow(playerPosition: Vec2, nowMs: number): void;
}>;

const DESKTOP_VISIBLE_SHORT_SIDE_WU = 18;
const MOBILE_VISIBLE_SHORT_SIDE_WU = 12;
const DESKTOP_VISIBLE_ASPECT = 16 / 9;
const CAMERA_FREE_ZONE_FRACTION_X = 0.32;
const CAMERA_FREE_ZONE_FRACTION_Y = 0.32;
const CAMERA_SMOOTHING_MS = 140;

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

export function createVisibleAreaCamera(input: InitialVisibleAreaInput): VisibleAreaCamera {
  let effectiveViewport = input.effectiveViewport;
  let visibleArea = resolveInitialVisibleArea(input);
  let lastFollowNowMs: number | null = null;

  function resize(nextEffectiveViewport: ViewportSize): void {
    effectiveViewport = nextEffectiveViewport;
    const size = resolveVisibleAreaSize({
      arena: input.arena,
      profile: input.profile,
      effectiveViewport
    });
    visibleArea = {
      ...size,
      center: clampVisibleAreaCenter(input.arena, size, visibleArea.center)
    };
  }

  function follow(playerPosition: Vec2, nowMs: number): void {
    const targetCenter = clampVisibleAreaCenter(input.arena, visibleArea, {
      x: targetAxisCenter(
        visibleArea.center.x,
        playerPosition.x,
        visibleArea.width,
        CAMERA_FREE_ZONE_FRACTION_X
      ),
      y: targetAxisCenter(
        visibleArea.center.y,
        playerPosition.y,
        visibleArea.height,
        CAMERA_FREE_ZONE_FRACTION_Y
      )
    });
    const elapsedMs =
      lastFollowNowMs === null ? 0 : Math.max(0, nowMs - lastFollowNowMs);
    lastFollowNowMs = nowMs;
    const followAmount =
      elapsedMs <= 0 ? 0 : 1 - Math.exp(-elapsedMs / CAMERA_SMOOTHING_MS);
    visibleArea = {
      ...visibleArea,
      center: clampVisibleAreaCenter(input.arena, visibleArea, {
        x: lerp(visibleArea.center.x, targetCenter.x, followAmount),
        y: lerp(visibleArea.center.y, targetCenter.y, followAmount)
      })
    };
  }

  return {
    visibleArea(): VisibleArea {
      return visibleArea;
    },
    resize,
    follow
  };
}

function targetAxisCenter(
  cameraCenter: number,
  playerPosition: number,
  visibleSide: number,
  freeZoneFraction: number
): number {
  const freeHalf = (visibleSide * freeZoneFraction) / 2;
  const min = cameraCenter - freeHalf;
  const max = cameraCenter + freeHalf;
  if (playerPosition < min) {
    return cameraCenter - (min - playerPosition);
  }
  if (playerPosition > max) {
    return cameraCenter + (playerPosition - max);
  }
  return cameraCenter;
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * Math.min(1, Math.max(0, amount));
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
