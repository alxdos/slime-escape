import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SIM_STEP_MS } from '../shared/timing';

import { createSimulationClockHost, type SimulationPumpTarget } from './SimulationClockHost';

describe('SimulationClockHost', () => {
  let nowMs = 0;

  beforeEach(() => {
    nowMs = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function fakePumpTarget(): SimulationPumpTarget {
    return {
      pump: vi.fn()
    };
  }

  it('pumps the core clock from a host timer and wall-clock source', () => {
    const target = fakePumpTarget();
    const host = createSimulationClockHost(target, { now: () => nowMs });

    host.start();
    expect(target.pump).toHaveBeenCalledWith(0);

    nowMs = SIM_STEP_MS;
    vi.advanceTimersByTime(SIM_STEP_MS);

    expect(target.pump).toHaveBeenLastCalledWith(SIM_STEP_MS);
    expect(target.pump).toHaveBeenCalledTimes(2);
    host.stop();
  });

  it('is idempotent across duplicate start and stop calls', () => {
    const target = fakePumpTarget();
    const host = createSimulationClockHost(target, { now: () => nowMs });

    host.start();
    host.start();
    nowMs = SIM_STEP_MS;
    vi.advanceTimersByTime(SIM_STEP_MS);
    host.stop();
    host.stop();
    nowMs = SIM_STEP_MS * 2;
    vi.advanceTimersByTime(SIM_STEP_MS);

    expect(target.pump).toHaveBeenCalledTimes(2);
  });
});
