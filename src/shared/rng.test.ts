import { describe, expect, it } from 'vitest';

import { createRng } from './rng';

describe('createRng (mulberry32)', () => {
  it('produces identical sequences for the same seed', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    const sequenceA = Array.from({ length: 16 }, () => a.nextUint32());
    const sequenceB = Array.from({ length: 16 }, () => b.nextUint32());
    expect(sequenceB).toEqual(sequenceA);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    const sequenceA = Array.from({ length: 8 }, () => a.nextUint32());
    const sequenceB = Array.from({ length: 8 }, () => b.nextUint32());
    expect(sequenceB).not.toEqual(sequenceA);
  });

  it('nextFloat stays inside [0, 1)', () => {
    const rng = createRng(42);
    for (let i = 0; i < 1000; i += 1) {
      const v = rng.nextFloat();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt stays inside [0, maxExclusive)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i += 1) {
      const v = rng.nextInt(10);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });

  it('nextRange stays inside [min, maxExclusive)', () => {
    const rng = createRng(99);
    for (let i = 0; i < 1000; i += 1) {
      const v = rng.nextRange(-5, 5);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThan(5);
    }
  });

  it('nextInt rejects non-positive or non-integer bounds', () => {
    const rng = createRng(1);
    expect(() => rng.nextInt(0)).toThrow();
    expect(() => rng.nextInt(-1)).toThrow();
    expect(() => rng.nextInt(1.5)).toThrow();
  });

  it('nextRange rejects empty or inverted ranges', () => {
    const rng = createRng(1);
    expect(() => rng.nextRange(5, 5)).toThrow();
    expect(() => rng.nextRange(5, 1)).toThrow();
  });

  it('two Rng instances do not share state', () => {
    const a = createRng(123);
    const b = createRng(456);
    a.nextUint32();
    a.nextUint32();
    a.nextUint32();
    const bFirst = b.nextUint32();
    const expected = createRng(456).nextUint32();
    expect(bFirst).toBe(expected);
  });
});
