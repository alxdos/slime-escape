import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SIM_STEP_MS } from '../shared/timing';

import { createSimulationClock } from './SimulationClock';

describe('SimulationClock lifecycle', () => {
  let nowMs = 0;

  beforeEach(() => {
    nowMs = 0;
    vi.useFakeTimers();
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function advance(ms: number): void {
    nowMs += ms;
    vi.advanceTimersByTime(ms);
  }

  it('does not invoke onTick or advance simTime while idle', () => {
    const ticks = vi.fn();
    const clock = createSimulationClock(ticks);

    clock.start();
    advance(SIM_STEP_MS * 100);

    expect(ticks).not.toHaveBeenCalled();
    expect(clock.simTimeMs()).toBe(0);
    clock.stop();
  });

  it('invokes onTick with fixed step and monotonic simTime while running', () => {
    const ticks = vi.fn();
    const clock = createSimulationClock(ticks);

    clock.start();
    clock.toRunning();
    advance(SIM_STEP_MS * 10);

    expect(ticks.mock.calls.length).toBeGreaterThan(0);
    for (const call of ticks.mock.calls) {
      expect(call[0]).toBe(SIM_STEP_MS);
    }
    expect(clock.simTimeMs()).toBeCloseTo(SIM_STEP_MS * ticks.mock.calls.length, 6);
    clock.stop();
  });

  it('stops invoking onTick after toIdle and resets simTime to 0', () => {
    const ticks = vi.fn();
    const clock = createSimulationClock(ticks);

    clock.start();
    clock.toRunning();
    advance(SIM_STEP_MS * 5);
    expect(clock.simTimeMs()).toBeGreaterThan(0);
    const callsAfterRun = ticks.mock.calls.length;

    clock.toIdle();
    advance(SIM_STEP_MS * 100);

    expect(ticks).toHaveBeenCalledTimes(callsAfterRun);
    expect(clock.simTimeMs()).toBe(0);
    clock.stop();
  });

  it('does not catch up wall-clock time across pause/resume', () => {
    const ticks = vi.fn();
    const clock = createSimulationClock(ticks);

    clock.start();
    clock.toRunning();
    advance(SIM_STEP_MS * 2);
    const ticksBeforePause = ticks.mock.calls.length;
    const simTimeBeforePause = clock.simTimeMs();

    clock.pause();
    advance(SIM_STEP_MS * 50);
    expect(ticks.mock.calls.length).toBe(ticksBeforePause);
    expect(clock.simTimeMs()).toBe(simTimeBeforePause);

    clock.resume();
    advance(SIM_STEP_MS * 2);
    const elapsedSinceResume = ticks.mock.calls.length - ticksBeforePause;
    expect(elapsedSinceResume).toBeGreaterThanOrEqual(0);
    expect(elapsedSinceResume).toBeLessThanOrEqual(3);
    clock.stop();
  });
});
