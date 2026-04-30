import { describe, expect, it } from 'vitest';

import {
  applyMouseDeltaToViewportAim,
  moveVectorFromKeys,
  viewportAimFromWorldAim,
  weaponHotkeyCommandFromCode,
  worldAimFromViewportAim
} from './inputMath';

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

describe('viewport-relative aim', () => {
  const visibleArea = { width: 12, height: 8, center: { x: 5, y: -2 } } as const;

  it('converts between world aim and visible-area offset', () => {
    const viewportAim = viewportAimFromWorldAim({ x: 7, y: 1 }, visibleArea);

    expect(viewportAim).toEqual({ x: 2, y: 3 });
    expect(worldAimFromViewportAim(viewportAim, visibleArea)).toEqual({ x: 7, y: 1 });
  });

  it('keeps the same viewport offset when the visible-area center moves', () => {
    const viewportAim = { x: 2, y: 3 };

    expect(worldAimFromViewportAim(viewportAim, visibleArea)).toEqual({ x: 7, y: 1 });
    expect(
      worldAimFromViewportAim(viewportAim, {
        ...visibleArea,
        center: { x: 8, y: 4 }
      })
    ).toEqual({ x: 10, y: 7 });
  });

  it('maps relative pointer deltas in visible-area coordinates and clamps to the viewport', () => {
    const next = applyMouseDeltaToViewportAim({ x: 5.5, y: 3.5 }, 30, -30, 10, visibleArea);

    expect(next).toEqual({ x: 6, y: 4 });
  });
});

describe('weaponHotkeyCommandFromCode', () => {
  it('maps physical digit codes 1..9 to zero-based weapon slots', () => {
    expect(weaponHotkeyCommandFromCode('Digit1')).toEqual({ kind: 'selectWeaponSlot', slotIndex: 0 });
    expect(weaponHotkeyCommandFromCode('Digit5')).toEqual({ kind: 'selectWeaponSlot', slotIndex: 4 });
    expect(weaponHotkeyCommandFromCode('Digit9')).toEqual({ kind: 'selectWeaponSlot', slotIndex: 8 });
  });

  it('maps Digit0 to holster', () => {
    expect(weaponHotkeyCommandFromCode('Digit0')).toEqual({ kind: 'holsterWeapon' });
  });

  it('ignores non-top-row digit and non-weapon codes', () => {
    expect(weaponHotkeyCommandFromCode('Numpad1')).toBeNull();
    expect(weaponHotkeyCommandFromCode('KeyQ')).toBeNull();
  });
});
