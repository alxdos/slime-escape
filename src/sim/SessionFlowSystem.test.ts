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

  it('runs onEncounterStart before encounterStart event and onEncounterEnd after encounterEnd event', () => {
    const clock = createFakeClock();
    const trace: string[] = [];
    const flow = createSessionFlowSystem({
      clock,
      emitEvent: (e) => trace.push(`event:${e.kind}`),
      onEncounterStart: (encounter) => trace.push(`onEncounterStart:${encounter.id}`),
      onEncounterEnd: (encounter) => trace.push(`onEncounterEnd:${encounter.id}`)
    });
    const session = buildSessionDefinition(SANDBOX_PRESET, { seed: 1 });
    const encounterId = session.encounters[0]!.id;

    flow.start(session);
    flow.stop();

    expect(trace).toEqual([
      'event:sessionStart',
      `onEncounterStart:${encounterId}`,
      'event:encounterStart',
      'event:encounterEnd',
      `onEncounterEnd:${encounterId}`,
      'event:sessionStop'
    ]);
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

import type { EncounterDefinition, SessionDefinition } from '../shared/session';
import type { WaveProgressSnapshot } from '../shared/snapshot';

function emptyEncounter(id: string, transitionRules: EncounterDefinition['transitionRules']): EncounterDefinition {
  return {
    id,
    type: 'wave',
    spawnPlan: { kind: 'empty' },
    zoneBehavior: { kind: 'disabled' },
    objectives: [],
    rewardRules: null,
    transitionRules,
    tuning: null
  };
}

function waveEncounter(id: string, transitionRules: EncounterDefinition['transitionRules']): EncounterDefinition {
  return {
    id,
    type: 'wave',
    spawnPlan: {
      kind: 'wave',
      spawns: [{ archetypeId: 'slime-fast' }],
      spawnIntervalMs: 100,
      maxAlive: 1
    },
    zoneBehavior: { kind: 'disabled' },
    objectives: [],
    rewardRules: null,
    transitionRules,
    tuning: null
  };
}

function makeSession(encounters: ReadonlyArray<EncounterDefinition>, options?: {
  win?: SessionDefinition['winCondition'];
  loss?: SessionDefinition['lossCondition'];
}): SessionDefinition {
  return {
    id: 'flow-test',
    seed: 1,
    arena: { width: 32, height: 18 },
    player: { position: { x: 0, y: 0 }, radius: 0.5, maxSpeed: 6, maxHp: 1 },
    loadout: null,
    modifiers: [],
    rules: null,
    encounters,
    winCondition: options?.win ?? { kind: 'allEncountersComplete' },
    lossCondition: options?.loss ?? { kind: 'playerDeath' },
    uiMeta: null
  };
}

describe('SessionFlowSystem encounter transitions', () => {
  it("'never' rule: checkTransitions never fires", () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({ clock, emitEvent: (e) => events.push(e) });
    const session = makeSession([emptyEncounter('a', { kind: 'never', next: 'sequential' })]);

    flow.start(session);
    events.length = 0;
    for (let t = 0; t < 1000; t += 16) flow.checkTransitions(t);
    expect(events).toHaveLength(0);
    expect(flow.isActive()).toBe(true);
  });

  it("'timer' rule: fires after durationMs and advances to next encounter", () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({ clock, emitEvent: (e) => events.push(e) });
    const session = makeSession([
      emptyEncounter('first', { kind: 'timer', durationMs: 100, next: 'sequential' }),
      emptyEncounter('second', { kind: 'never', next: 'sequential' })
    ]);

    flow.start(session);
    events.length = 0;
    flow.checkTransitions(99);
    expect(events).toHaveLength(0);
    flow.checkTransitions(100);
    expect(events.map((e) => e.kind)).toEqual(['encounterEnd', 'encounterStart']);
    expect(flow.activeEncounter()?.encounter.id).toBe('second');
  });

  it("'allEnemiesCleared' for empty plan fires on the very first check", () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({ clock, emitEvent: (e) => events.push(e) });
    const session = makeSession([
      emptyEncounter('a', { kind: 'allEnemiesCleared', next: 'sequential' }),
      emptyEncounter('b', { kind: 'never', next: 'sequential' })
    ]);

    flow.start(session);
    events.length = 0;
    flow.checkTransitions(0);
    expect(events.map((e) => e.kind)).toEqual(['encounterEnd', 'encounterStart']);
    expect(flow.activeEncounter()?.encounter.id).toBe('b');
  });

  it("'allEnemiesCleared' for wave fires only when waveProgress is dispatched=total && alive=0", () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    let progress: WaveProgressSnapshot | null = { dispatched: 0, total: 2, alive: 0 };
    const flow = createSessionFlowSystem({
      clock,
      emitEvent: (e) => events.push(e),
      waveProgress: () => progress
    });
    const session = makeSession([
      waveEncounter('w', { kind: 'allEnemiesCleared', next: 'sequential' }),
      emptyEncounter('end', { kind: 'never', next: 'sequential' })
    ]);

    flow.start(session);
    events.length = 0;

    progress = { dispatched: 1, total: 2, alive: 1 };
    flow.checkTransitions(50);
    expect(events).toHaveLength(0);

    progress = { dispatched: 2, total: 2, alive: 1 };
    flow.checkTransitions(100);
    expect(events).toHaveLength(0);

    progress = { dispatched: 2, total: 2, alive: 0 };
    flow.checkTransitions(150);
    expect(events.map((e) => e.kind)).toEqual(['encounterEnd', 'encounterStart']);
  });

  it("publishes 'win' once when last encounter ends and winCondition is allEncountersComplete", () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({ clock, emitEvent: (e) => events.push(e) });
    const session = makeSession([
      emptyEncounter('only', { kind: 'allEnemiesCleared', next: 'sequential' })
    ]);

    flow.start(session);
    events.length = 0;
    flow.checkTransitions(0);
    expect(events.map((e) => e.kind)).toEqual(['encounterEnd', 'win', 'sessionStop']);
    expect(flow.isActive()).toBe(false);
    expect(clock.isRunning()).toBe(false);
  });

  it("does not publish 'win' if winCondition is none, but still publishes sessionStop", () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({ clock, emitEvent: (e) => events.push(e) });
    const session = makeSession(
      [emptyEncounter('only', { kind: 'allEnemiesCleared', next: 'sequential' })],
      { win: { kind: 'none' }, loss: { kind: 'none' } }
    );

    flow.start(session);
    events.length = 0;
    flow.checkTransitions(0);
    expect(events.map((e) => e.kind)).toEqual(['encounterEnd', 'sessionStop']);
    expect(flow.isActive()).toBe(false);
  });

  it("'next: byId' jumps to a specific encounter and ignores sequential order", () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({ clock, emitEvent: (e) => events.push(e) });
    const session = makeSession([
      emptyEncounter('first', { kind: 'allEnemiesCleared', next: { kind: 'byId', id: 'third' } }),
      emptyEncounter('second', { kind: 'never', next: 'sequential' }),
      emptyEncounter('third', { kind: 'never', next: 'sequential' })
    ]);

    flow.start(session);
    flow.checkTransitions(0);
    expect(flow.activeEncounter()?.encounter.id).toBe('third');
  });

  it("throws when 'next: byId' references an unknown encounter id", () => {
    const clock = createFakeClock();
    const flow = createSessionFlowSystem({ clock, emitEvent: () => {} });
    const session = makeSession([
      emptyEncounter('first', { kind: 'allEnemiesCleared', next: { kind: 'byId', id: 'missing' } })
    ]);

    flow.start(session);
    expect(() => flow.checkTransitions(0)).toThrow(/byId/);
  });
});

describe('SessionFlowSystem player death', () => {
  it("publishes 'loss' once when onPlayerDeath fires under lossCondition.playerDeath", () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({ clock, emitEvent: (e) => events.push(e) });
    const session = makeSession([emptyEncounter('only', { kind: 'never', next: 'sequential' })]);

    flow.start(session);
    events.length = 0;
    flow.onPlayerDeath();
    expect(events.map((e) => e.kind)).toEqual(['encounterEnd', 'loss', 'sessionStop']);
    expect(flow.isActive()).toBe(false);
    expect(clock.isRunning()).toBe(false);
  });

  it("does not publish 'loss' when lossCondition is none", () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({ clock, emitEvent: (e) => events.push(e) });
    const session = makeSession(
      [emptyEncounter('only', { kind: 'never', next: 'sequential' })],
      { win: { kind: 'none' }, loss: { kind: 'none' } }
    );

    flow.start(session);
    events.length = 0;
    flow.onPlayerDeath();
    expect(events).toHaveLength(0);
    expect(flow.isActive()).toBe(true);
  });

  it("repeated onPlayerDeath after run end is a no-op", () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({ clock, emitEvent: (e) => events.push(e) });
    const session = makeSession([emptyEncounter('only', { kind: 'never', next: 'sequential' })]);

    flow.start(session);
    flow.onPlayerDeath();
    events.length = 0;
    flow.onPlayerDeath();
    expect(events).toHaveLength(0);
  });

  it("after win, input/pause/resume are warned and ignored", () => {
    const localWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const clock = createFakeClock();
      const flow = createSessionFlowSystem({ clock, emitEvent: () => {} });
      const session = makeSession([
        emptyEncounter('only', { kind: 'allEnemiesCleared', next: 'sequential' })
      ]);
      flow.start(session);
      flow.checkTransitions(0);
      expect(flow.isActive()).toBe(false);

      localWarn.mockClear();
      flow.pause();
      flow.resume();
      flow.handleInput({ kind: 'fire', phase: 'start' });
      expect(localWarn).toHaveBeenCalledTimes(3);
    } finally {
      localWarn.mockRestore();
    }
  });
});
