export type Rng = Readonly<{
  nextUint32(): number;
  nextFloat(): number;
  nextInt(maxExclusive: number): number;
  nextRange(min: number, maxExclusive: number): number;
}>;

const UINT32_RANGE = 0x100000000;

export function createRng(seed: number): Rng {
  let state = (seed >>> 0) >>> 0;

  function nextUint32(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  function nextFloat(): number {
    return nextUint32() / UINT32_RANGE;
  }

  function nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error(
        `Rng.nextInt: maxExclusive must be a positive integer, got ${maxExclusive}`
      );
    }
    return Math.floor(nextFloat() * maxExclusive);
  }

  function nextRange(min: number, maxExclusive: number): number {
    if (!(maxExclusive > min)) {
      throw new Error(
        `Rng.nextRange: maxExclusive (${maxExclusive}) must be > min (${min})`
      );
    }
    return min + nextFloat() * (maxExclusive - min);
  }

  return { nextUint32, nextFloat, nextInt, nextRange };
}
