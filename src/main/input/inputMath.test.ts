import { describe, expect, it } from 'vitest';

import { applyMouseDeltaToAim, clampAimToArena, moveVectorFromKeys } from './inputMath';

const ARENA = { width: 32, height: 18 } as const;
const ALL_OFF = { up: false, down: false, left: false, right: false } as const;

describe('moveVectorFromKeys', () => {
  it('returns zero vector when no keys are pressed', () => {
    expect(moveVectorFromKeys(ALL_OFF)).toEqual({ dx: 0, dy: 0 });
  });

  it.each([
    [{ ...ALL_OFF, up: true }, { dx: 0, dy: 1 }],
    [{ ...ALL_OFF, down: true }, { dx: 0, dy: -1 }],
    [{ ...ALL_OFF, left: true }, { dx: -1, dy: 0 }],
    [{ ...ALL_OFF, right: true }, { dx: 1, dy: 0 }]
  ])('produces an axis-aligned unit vector for one key (%j)', (keys, expected) => {
    expect(moveVectorFromKeys(keys)).toEqual(expected);
  });

  it('cancels opposing axis keys to zero', () => {
    expect(moveVectorFromKeys({ ...ALL_OFF, up: true, down: true })).toEqual({ dx: 0, dy: 0 });
    expect(moveVectorFromKeys({ ...ALL_OFF, left: true, right: true })).toEqual({ dx: 0, dy: 0 });
  });

  it('normalises diagonals to length 1', () => {
    const v = moveVectorFromKeys({ ...ALL_OFF, up: true, right: true });
    const len = Math.hypot(v.dx, v.dy);
    expect(len).toBeCloseTo(1, 10);
    expect(v.dx).toBeCloseTo(Math.SQRT1_2, 10);
    expect(v.dy).toBeCloseTo(Math.SQRT1_2, 10);
  });
});

describe('clampAimToArena', () => {
  it('leaves an aim inside the arena unchanged', () => {
    expect(clampAimToArena({ x: 1, y: -2 }, ARENA)).toEqual({ x: 1, y: -2 });
  });

  it('clamps each axis independently to the half-width/height', () => {
    expect(clampAimToArena({ x: 100, y: 100 }, ARENA)).toEqual({ x: 16, y: 9 });
    expect(clampAimToArena({ x: -100, y: -100 }, ARENA)).toEqual({ x: -16, y: -9 });
  });
});

describe('applyMouseDeltaToAim', () => {
  it('maps positive movementX to +x and positive movementY to -y (Y up in world)', () => {
    const next = applyMouseDeltaToAim({ x: 0, y: 0 }, 30, 60, 30, ARENA);
    expect(next).toEqual({ x: 1, y: -2 });
  });

  it('returns the input aim when pixelsPerWorldUnit is non-positive', () => {
    const aim = { x: 3, y: -1 };
    expect(applyMouseDeltaToAim(aim, 100, 100, 0, ARENA)).toEqual(aim);
    expect(applyMouseDeltaToAim(aim, 100, 100, -1, ARENA)).toEqual(aim);
  });

  it('clamps the resulting aim to the arena bounds', () => {
    const next = applyMouseDeltaToAim({ x: 15, y: 8 }, 1000, -1000, 30, ARENA);
    expect(next).toEqual({ x: 16, y: 9 });
  });
});
