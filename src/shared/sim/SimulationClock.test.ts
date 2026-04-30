import { describe, expect, it, vi } from 'vitest';

import { SIM_STEP_MS } from '../timing';

import { createSimulationClock } from './SimulationClock';

describe('SimulationClock stepper', () => {
  it('does not invoke onTick or advance simTime while idle', () => {
    const ticks = vi.fn();
    const clock = createSimulationClock(ticks);

    clock.pump(0);
    clock.pump(SIM_STEP_MS * 100);

    expect(ticks).not.toHaveBeenCalled();
    expect(clock.simTimeMs()).toBe(0);
  });

  it('invokes onTick with fixed step and monotonic simTime while running', () => {
    const ticks = vi.fn();
    const clock = createSimulationClock(ticks);

    clock.pump(0);
    clock.toRunning();
    clock.pump(0);
    clock.pump(SIM_STEP_MS * 10);

    expect(ticks).toHaveBeenCalledTimes(10);
    for (const call of ticks.mock.calls) {
      expect(call[0]).toBe(SIM_STEP_MS);
    }
    expect(clock.simTimeMs()).toBeCloseTo(SIM_STEP_MS * 10, 6);
  });

  it('stops invoking onTick after toIdle and resets simTime to 0', () => {
    const ticks = vi.fn();
    const clock = createSimulationClock(ticks);

    clock.pump(0);
    clock.toRunning();
    clock.pump(0);
    clock.pump(SIM_STEP_MS * 5);
    expect(clock.simTimeMs()).toBeCloseTo(SIM_STEP_MS * 5, 6);
    const callsAfterRun = ticks.mock.calls.length;

    clock.toIdle();
    clock.pump(SIM_STEP_MS * 100);

    expect(ticks).toHaveBeenCalledTimes(callsAfterRun);
    expect(clock.simTimeMs()).toBe(0);
  });

  it('does not catch up wall-clock time across pause/resume', () => {
    const ticks = vi.fn();
    const clock = createSimulationClock(ticks);

    clock.pump(0);
    clock.toRunning();
    clock.pump(0);
    clock.pump(SIM_STEP_MS * 2);
    const ticksBeforePause = ticks.mock.calls.length;
    const simTimeBeforePause = clock.simTimeMs();

    clock.pause();
    clock.pump(SIM_STEP_MS * 52);
    expect(ticks.mock.calls.length).toBe(ticksBeforePause);
    expect(clock.simTimeMs()).toBe(simTimeBeforePause);

    clock.resume();
    clock.pump(SIM_STEP_MS * 52);
    clock.pump(SIM_STEP_MS * 54);

    expect(ticks.mock.calls.length - ticksBeforePause).toBe(2);
  });
});
