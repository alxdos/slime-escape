import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildSessionDefinition } from '../shared/content/buildSession';
import { SANDBOX_PRESET } from '../shared/content/presets';
import type { RuntimeEvent } from '../shared/events';
import type { SimulationClock } from './SimulationClock';
import { createSessionFlowSystem } from './SessionFlowSystem';

function createFakeClock(): SimulationClock & { _state: { running: boolean; paused: boolean; simTime: number } } {
  const state = { running: false, paused: false, simTime: 0 };
  return {
    _state: state,
    start: () => {},
    stop: () => {},
    pause: () => {
      state.paused = true;
    },
    resume: () => {
      state.paused = false;
    },
    toRunning: () => {
      state.running = true;
      state.paused = false;
      state.simTime = 0;
    },
    toIdle: () => {
      state.running = false;
      state.paused = false;
      state.simTime = 0;
    },
    isPaused: () => state.paused,
    isRunning: () => state.running,
    simTimeMs: () => state.simTime
  };
}

describe('SessionFlowSystem', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits sessionStart and encounterStart on start, then sessionStop/encounterEnd on stop', () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({
      clock,
      emitEvent: (e) => events.push(e)
    });
    const session = buildSessionDefinition(SANDBOX_PRESET, { seed: 1 });

    flow.start(session);
    expect(clock.isRunning()).toBe(true);
    expect(flow.isActive()).toBe(true);
    expect(events.map((e) => e.kind)).toEqual(['sessionStart', 'encounterStart']);

    flow.stop();
    expect(clock.isRunning()).toBe(false);
    expect(flow.isActive()).toBe(false);
    expect(events.map((e) => e.kind)).toEqual([
      'sessionStart',
      'encounterStart',
      'encounterEnd',
      'sessionStop'
    ]);
  });

  it('warns and ignores stop/pause/resume/input when no session is active', () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({ clock, emitEvent: (e) => events.push(e) });

    flow.stop();
    flow.pause();
    flow.resume();
    flow.handleInput({ kind: 'fire', phase: 'start' });

    expect(events).toHaveLength(0);
    expect(clock.isRunning()).toBe(false);
    expect(clock.isPaused()).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(4);
  });

  it('warns when start is called while a session is already active', () => {
    const clock = createFakeClock();
    const flow = createSessionFlowSystem({ clock, emitEvent: () => {} });
    const a = buildSessionDefinition(SANDBOX_PRESET, { seed: 1, id: 'a' });
    const b = buildSessionDefinition(SANDBOX_PRESET, { seed: 2, id: 'b' });

    flow.start(a);
    flow.start(b);

    expect(flow.activeSession()?.id).toBe('a');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('emits pause/resume only when active and only on state change', () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({ clock, emitEvent: (e) => events.push(e) });
    const session = buildSessionDefinition(SANDBOX_PRESET, { seed: 1 });

    flow.start(session);
    events.length = 0;

    flow.pause();
    flow.pause();
    expect(events.map((e) => e.kind)).toEqual(['pause']);
    expect(clock.isPaused()).toBe(true);

    flow.resume();
    flow.resume();
    expect(events.map((e) => e.kind)).toEqual(['pause', 'resume']);
    expect(clock.isPaused()).toBe(false);
  });

  it('runs onSessionStart and onSessionStop hooks once per transition', () => {
    const clock = createFakeClock();
    const onStart = vi.fn();
    const onStop = vi.fn();
    const flow = createSessionFlowSystem({
      clock,
      emitEvent: () => {},
      onSessionStart: onStart,
      onSessionStop: onStop
    });
    const session = buildSessionDefinition(SANDBOX_PRESET, { seed: 1 });

    flow.start(session);
    flow.stop();
    flow.start(session);
    flow.stop();

    expect(onStart).toHaveBeenCalledTimes(2);
    expect(onStop).toHaveBeenCalledTimes(2);
  });
});
