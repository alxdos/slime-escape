import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SimulationClock } from '../shared/sim/SimulationClock';
import { SIM_STEP_MS } from '../shared/timing';

import { createSimulationClockHost } from './SimulationClockHost';

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

  function fakeClock(): SimulationClock {
    return {
      pump: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      toRunning: vi.fn(),
      toIdle: vi.fn(),
      isPaused: () => false,
      isRunning: () => false,
      simTimeMs: () => 0
    };
  }

  it('pumps the core clock from a host timer and wall-clock source', () => {
    const clock = fakeClock();
    const host = createSimulationClockHost(clock, { now: () => nowMs });

    host.start();
    expect(clock.pump).toHaveBeenCalledWith(0);

    nowMs = SIM_STEP_MS;
    vi.advanceTimersByTime(SIM_STEP_MS);

    expect(clock.pump).toHaveBeenLastCalledWith(SIM_STEP_MS);
    expect(clock.pump).toHaveBeenCalledTimes(2);
    host.stop();
  });

  it('is idempotent across duplicate start and stop calls', () => {
    const clock = fakeClock();
    const host = createSimulationClockHost(clock, { now: () => nowMs });

    host.start();
    host.start();
    nowMs = SIM_STEP_MS;
    vi.advanceTimersByTime(SIM_STEP_MS);
    host.stop();
    host.stop();
    nowMs = SIM_STEP_MS * 2;
    vi.advanceTimersByTime(SIM_STEP_MS);

    expect(clock.pump).toHaveBeenCalledTimes(2);
  });
});
