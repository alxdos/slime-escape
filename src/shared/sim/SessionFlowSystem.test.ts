import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildSessionDefinition } from '../content/buildSession';
import { SANDBOX_PRESET } from '../content/sessions';
import type { RuntimeEvent } from '../events';
import type { SimulationClock } from './SimulationClock';
import type { EntityId } from './EntityStore';
import {
  createSessionFlowSystem as createRawSessionFlowSystem,
  type SessionFlowDeps
} from './SessionFlowSystem';
import { runtimeInputForPlayer } from './RuntimeInputState';
import { makeTestResultSummary } from './testSessionResultSummary';

function createFakeClock(): SimulationClock & { _state: { running: boolean; paused: boolean; simTime: number } } {
  const state = { running: false, paused: false, simTime: 0 };
  return {
    _state: state,
    pump: () => {},
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
    flow.handleInput('missing-player', { kind: 'fire', phase: 'start' });

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

  it('starts dynamic roster sessions with an empty initial roster', () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({ clock, emitEvent: (e) => events.push(e) });
    const base = makeSession([emptyEncounter('only', { kind: 'never', next: 'sequential' })]);
    const session: SessionDefinition = {
      ...base,
      dynamicRoster: true,
      players: []
    };

    flow.start(session);

    expect(flow.isActive()).toBe(true);
    expect(clock.isRunning()).toBe(true);
    expect(events.map((event) => event.kind)).toEqual(['sessionStart', 'encounterStart']);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('rejects fixed roster sessions with an empty roster at runtime', () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({ clock, emitEvent: (e) => events.push(e) });
    const base = makeSession([emptyEncounter('only', { kind: 'never', next: 'sequential' })]);
    const session = {
      ...base,
      players: []
    } as unknown as SessionDefinition;

    flow.start(session);

    expect(flow.isActive()).toBe(false);
    expect(clock.isRunning()).toBe(false);
    expect(events).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate player ids before starting the session', () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({ clock, emitEvent: (e) => events.push(e) });
    const base = makeSession([emptyEncounter('only', { kind: 'never', next: 'sequential' })]);
    const session: SessionDefinition = {
      ...base,
      players: [
        base.players[0],
        {
          ...base.players[0],
          position: { x: 1, y: 0 }
        }
      ]
    };

    flow.start(session);

    expect(flow.isActive()).toBe(false);
    expect(clock.isRunning()).toBe(false);
    expect(events).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('initializes runtime loadout selection from the session loadout', () => {
    const clock = createFakeClock();
    const flow = createSessionFlowSystem({ clock, emitEvent: () => {} });
    const session = makeSession([emptyEncounter('only', { kind: 'never', next: 'sequential' })], {
      loadout: { weapons: ['pistol', 'shotgun', 'smg'], selectedIndex: 1 }
    });

    flow.start(session);

    expect(runtimeInputForPlayer(flow.inputState(), session.players[0].id)?.loadout).toEqual({
      weapons: ['pistol', 'shotgun', 'smg'],
      selectedIndex: 1
    });
  });

  it('selects valid weapon slots and holsters the selected weapon', () => {
    const clock = createFakeClock();
    const flow = createSessionFlowSystem({ clock, emitEvent: () => {} });
    const session = makeSession([emptyEncounter('only', { kind: 'never', next: 'sequential' })], {
      loadout: { weapons: ['pistol', 'shotgun', 'smg'], selectedIndex: 0 }
    });

    flow.start(session);
    flow.handleInput(session.players[0].id, { kind: 'selectWeaponSlot', slotIndex: 2 });
    expect(runtimeInputForPlayer(flow.inputState(), session.players[0].id)?.loadout?.selectedIndex).toBe(2);

    flow.handleInput(session.players[0].id, { kind: 'holsterWeapon' });
    expect(runtimeInputForPlayer(flow.inputState(), session.players[0].id)?.loadout?.selectedIndex).toBeNull();
  });

  it('warns and keeps current selection for invalid weapon slots', () => {
    const clock = createFakeClock();
    const flow = createSessionFlowSystem({ clock, emitEvent: () => {} });
    const session = makeSession([emptyEncounter('only', { kind: 'never', next: 'sequential' })], {
      loadout: { weapons: ['pistol', 'shotgun'], selectedIndex: 1 }
    });

    flow.start(session);
    warnSpy.mockClear();

    flow.handleInput(session.players[0].id, { kind: 'selectWeaponSlot', slotIndex: 2 });
    flow.handleInput(session.players[0].id, { kind: 'selectWeaponSlot', slotIndex: -1 });
    flow.handleInput(session.players[0].id, { kind: 'selectWeaponSlot', slotIndex: 0.5 });

    expect(runtimeInputForPlayer(flow.inputState(), session.players[0].id)?.loadout?.selectedIndex).toBe(1);
    expect(warnSpy).toHaveBeenCalledTimes(3);
  });

  it('warns and ignores weapon slot selection when the session has no loadout', () => {
    const clock = createFakeClock();
    const flow = createSessionFlowSystem({ clock, emitEvent: () => {} });
    const session = buildSessionDefinition(SANDBOX_PRESET, { seed: 1 });

    flow.start(session);
    warnSpy.mockClear();

    flow.handleInput(session.players[0].id, { kind: 'selectWeaponSlot', slotIndex: 0 });
    flow.handleInput(session.players[0].id, { kind: 'holsterWeapon' });

    expect(runtimeInputForPlayer(flow.inputState(), session.players[0].id)?.loadout).toBeNull();
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

function createSessionFlowSystem(
  deps: Omit<SessionFlowDeps, 'buildResultSummary'> &
    Partial<Pick<SessionFlowDeps, 'buildResultSummary'>>
) {
  return createRawSessionFlowSystem({
    buildResultSummary: (outcome, simTimeMs) => makeTestResultSummary(outcome, simTimeMs),
    ...deps
  });
}

import type { EncounterDefinition, SessionDefinition } from '../session';
import type { WaveProgressSnapshot } from '../snapshot';

function emptyEncounter(id: string, transitionRules: EncounterDefinition['transitionRules']): EncounterDefinition {
  return {
    id,
    type: 'wave',
    backgroundId: null,
    introDurationMs: 0,
    name: null,
    text: null,
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
    backgroundId: null,
    introDurationMs: 0,
    name: null,
    text: null,
    spawnPlan: {
      kind: 'wave',
      spawns: [{ archetypeId: 'test-wave-enemy' }],
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

function breakEncounter(id: string, transitionRules: EncounterDefinition['transitionRules']): EncounterDefinition {
  return {
    id,
    type: 'break',
    backgroundId: null,
    introDurationMs: 0,
    name: null,
    text: 'Break',
    spawnPlan: { kind: 'empty' },
    zoneBehavior: { kind: 'disabled' },
    objectives: [],
    rewardRules: null,
    transitionRules,
    tuning: null
  };
}

function makeSession(
  encounters: ReadonlyArray<EncounterDefinition>,
  options?: {
    loadout?: SessionDefinition['players'][number]['loadout'];
    win?: SessionDefinition['winCondition'];
    loss?: SessionDefinition['lossCondition'];
  }
): SessionDefinition {
  return {
    id: 'flow-test',
    seed: 1,
    arena: { width: 32, height: 18 },
    dynamicRoster: false,
    players: [
      {
        id: 'flow-player',
        position: { x: 0, y: 0 },
        radius: 0.5,
        contactBox: { width: 1, height: 1 },
        maxSpeed: 6,
        maxHp: 1,
        loadout: options?.loadout ?? null,
        companion: null
      }
    ],
    backgrounds: [],
    musicSampleId: null,
    modifiers: [],
    rules: {
      damage: { slimeFriendlyFire: false, playerVsPlayerDamage: false },
      aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 }
    },
    encounters,
    winCondition: options?.win ?? { kind: 'allEncountersComplete' },
    lossCondition: options?.loss ?? { kind: 'playerDeath' },
    playerCoopRevive: null,
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

  it("'timer' rule does not fire before encounter intro has finished", () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({ clock, emitEvent: (e) => events.push(e) });
    const session = makeSession([
      {
        ...emptyEncounter('first', { kind: 'timer', durationMs: 100, next: 'sequential' }),
        introDurationMs: 200
      },
      emptyEncounter('second', { kind: 'never', next: 'sequential' })
    ]);

    flow.start(session);
    events.length = 0;
    flow.checkTransitions(100);
    expect(events).toHaveLength(0);
    expect(flow.activeEncounter()?.encounter.id).toBe('first');
    flow.checkTransitions(199);
    expect(events).toHaveLength(0);
    flow.checkTransitions(200);
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

  it("'allEnemiesCleared' for empty plan waits for intro before firing", () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({ clock, emitEvent: (e) => events.push(e) });
    const session = makeSession([
      {
        ...emptyEncounter('a', { kind: 'allEnemiesCleared', next: 'sequential' }),
        introDurationMs: 100
      },
      emptyEncounter('b', { kind: 'never', next: 'sequential' })
    ]);

    flow.start(session);
    events.length = 0;
    flow.checkTransitions(99);
    expect(events).toHaveLength(0);
    expect(flow.activeEncounter()?.encounter.id).toBe('a');
    flow.checkTransitions(100);
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

  it("'allEnemiesCleared' for wave waits for intro even when waveProgress is already complete", () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({
      clock,
      emitEvent: (e) => events.push(e),
      waveProgress: () => ({ dispatched: 2, total: 2, alive: 0 })
    });
    const session = makeSession([
      {
        ...waveEncounter('w', { kind: 'allEnemiesCleared', next: 'sequential' }),
        introDurationMs: 100
      },
      emptyEncounter('end', { kind: 'never', next: 'sequential' })
    ]);

    flow.start(session);
    events.length = 0;
    flow.checkTransitions(99);
    expect(events).toHaveLength(0);
    expect(flow.activeEncounter()?.encounter.id).toBe('w');
    flow.checkTransitions(100);
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
    expect(terminalEvent(events, 'win').summary).toEqual(makeTestResultSummary('win', 0));
    expect(flow.isActive()).toBe(false);
    expect(clock.isRunning()).toBe(false);
  });

  it('builds terminal summaries through the configured summary builder', () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const summary = makeTestResultSummary('win', 0, { totalKills: 1 });
    const flow = createSessionFlowSystem({
      clock,
      emitEvent: (e) => events.push(e),
      buildResultSummary: (outcome, simTimeMs) => {
        expect(outcome).toBe('win');
        expect(simTimeMs).toBe(0);
        return summary;
      }
    });
    const session = makeSession([
      emptyEncounter('only', { kind: 'allEnemiesCleared', next: 'sequential' })
    ]);

    flow.start(session);
    events.length = 0;
    flow.checkTransitions(0);

    expect(terminalEvent(events, 'win').summary).toBe(summary);
  });

  it('rejects terminal summaries that do not match the terminal event', () => {
    const clock = createFakeClock();
    const flow = createSessionFlowSystem({
      clock,
      emitEvent: () => {},
      buildResultSummary: () => makeTestResultSummary('loss', 0)
    });
    const session = makeSession([
      emptyEncounter('only', { kind: 'allEnemiesCleared', next: 'sequential' })
    ]);

    flow.start(session);

    expect(() => flow.checkTransitions(0)).toThrow(/outcome mismatch/);
  });

  it('rejects terminal summaries with a mismatched duration', () => {
    const clock = createFakeClock();
    const flow = createSessionFlowSystem({
      clock,
      emitEvent: () => {},
      buildResultSummary: (outcome) => makeTestResultSummary(outcome, 999)
    });
    const session = makeSession([
      emptyEncounter('only', { kind: 'allEnemiesCleared', next: 'sequential' })
    ]);

    flow.start(session);

    expect(() => flow.checkTransitions(0)).toThrow(/duration mismatch/);
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

describe('SessionFlowSystem dungeon transitions', () => {
  it('loops from the last authored encounter back to the first without publishing win or sessionStop', () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({
      clock,
      emitEvent: (e) => events.push(e),
      waveProgress: () => ({ dispatched: 1, total: 1, alive: 0 })
    });
    const session = makeSession(
      [
        waveEncounter('dungeon-wave', { kind: 'allEnemiesCleared', next: 'sequential' }),
        breakEncounter('dungeon-reset', { kind: 'timer', durationMs: 100, next: 'sequential' })
      ],
      { win: { kind: 'dungeon' }, loss: { kind: 'playerDeath' } }
    );

    flow.start(session);
    events.length = 0;

    flow.checkTransitions(0);
    flow.checkTransitions(100);

    expect(events.map((event) => event.kind)).toEqual([
      'encounterEnd',
      'encounterStart',
      'encounterEnd',
      'encounterStart'
    ]);
    expect(events.some((event) => event.kind === 'win' || event.kind === 'sessionStop')).toBe(false);
    expect(flow.activeEncounter()?.encounter.id).toBe('dungeon-wave');
    expect(flow.isActive()).toBe(true);
    expect(clock.isRunning()).toBe(true);
  });

  it('increments the run wave ordinal every time a dungeon wave starts', () => {
    const clock = createFakeClock();
    const flow = createSessionFlowSystem({
      clock,
      emitEvent: () => {},
      waveProgress: () => ({ dispatched: 1, total: 1, alive: 0 })
    });
    const session = makeSession(
      [
        waveEncounter('dungeon-wave', { kind: 'allEnemiesCleared', next: 'sequential' }),
        breakEncounter('dungeon-reset', { kind: 'timer', durationMs: 100, next: 'sequential' })
      ],
      { win: { kind: 'dungeon' }, loss: { kind: 'playerDeath' } }
    );

    flow.start(session);
    expect(flow.activeEncounter()?.waveOrdinal).toBe(1);

    flow.checkTransitions(0);
    expect(flow.activeEncounter()?.waveOrdinal).toBeNull();

    flow.checkTransitions(100);
    expect(flow.activeEncounter()?.waveOrdinal).toBe(2);

    flow.checkTransitions(100);
    flow.checkTransitions(200);
    expect(flow.activeEncounter()?.waveOrdinal).toBe(3);
  });

  it('keeps finite wave ordinals tied to the authored encounter order', () => {
    const clock = createFakeClock();
    const flow = createSessionFlowSystem({
      clock,
      emitEvent: () => {},
      waveProgress: () => ({ dispatched: 1, total: 1, alive: 0 })
    });
    const session = makeSession([
      waveEncounter('first', { kind: 'allEnemiesCleared', next: 'sequential' }),
      breakEncounter('break', { kind: 'timer', durationMs: 100, next: 'sequential' }),
      waveEncounter('second', { kind: 'never', next: 'sequential' })
    ]);

    flow.start(session);
    expect(flow.activeEncounter()?.waveOrdinal).toBe(1);
    flow.checkTransitions(0);
    expect(flow.activeEncounter()?.waveOrdinal).toBeNull();
    flow.checkTransitions(100);
    expect(flow.activeEncounter()?.waveOrdinal).toBe(2);
  });

  it('notifies completion only when a transition rule completes an encounter', () => {
    const clock = createFakeClock();
    const completed: string[] = [];
    const flow = createSessionFlowSystem({
      clock,
      emitEvent: () => {},
      waveProgress: () => ({ dispatched: 1, total: 1, alive: 0 }),
      onEncounterComplete: (encounter) => completed.push(encounter.id)
    });
    const session = makeSession([
      waveEncounter('completed-wave', { kind: 'allEnemiesCleared', next: 'sequential' }),
      breakEncounter('idle-break', { kind: 'never', next: 'sequential' })
    ]);

    flow.start(session);
    flow.checkTransitions(0);

    expect(completed).toEqual(['completed-wave']);
  });
});

describe('SessionFlowSystem bossDefeated', () => {
  const bossEncounter = (
    id: string,
    rules: EncounterDefinition['transitionRules']
  ): EncounterDefinition => ({
    id,
    type: 'boss',
    backgroundId: null,
    introDurationMs: 0,
    name: null,
    text: null,
    spawnPlan: {
      kind: 'boss',
      bossArchetypeId: 'test-boss',
      position: { x: 0, y: 0 }
    },
    zoneBehavior: { kind: 'disabled' },
    objectives: [],
    rewardRules: null,
    transitionRules: rules,
    tuning: null
  });

  it('publishes encounterEnd, win, sessionStop from onBossDeath when winCondition is bossDefeated', () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({ clock, emitEvent: (e) => events.push(e) });
    const session = makeSession([bossEncounter('boss', { kind: 'never', next: 'sequential' })], {
      win: { kind: 'bossDefeated' },
      loss: { kind: 'playerDeath' }
    });

    flow.start(session);
    events.length = 0;
    flow.onBossDeath(42 as EntityId);
    expect(events.map((e) => e.kind)).toEqual(['encounterEnd', 'win', 'sessionStop']);
    expect(terminalEvent(events, 'win').summary.outcome).toBe('win');
    expect(flow.isActive()).toBe(false);
    expect(clock.isRunning()).toBe(false);
  });

  it('does nothing onBossDeath when winCondition is allEncountersComplete', () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({ clock, emitEvent: (e) => events.push(e) });
    const session = makeSession([bossEncounter('boss', { kind: 'never', next: 'sequential' })], {
      win: { kind: 'allEncountersComplete' },
      loss: { kind: 'playerDeath' }
    });

    flow.start(session);
    events.length = 0;
    flow.onBossDeath(1 as EntityId);
    expect(events).toHaveLength(0);
    expect(flow.isActive()).toBe(true);
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
    flow.onPlayerDeath(1 as EntityId);
    expect(events.map((e) => e.kind)).toEqual(['encounterEnd', 'loss', 'sessionStop']);
    expect(terminalEvent(events, 'loss').summary).toEqual(makeTestResultSummary('loss', 0));
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
    flow.onPlayerDeath(1 as EntityId);
    expect(events).toHaveLength(0);
    expect(flow.isActive()).toBe(true);
  });

  it("does not publish 'loss' when lossCondition is respawnOnDeath", () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({ clock, emitEvent: (e) => events.push(e) });
    const session = makeSession(
      [emptyEncounter('only', { kind: 'never', next: 'sequential' })],
      { win: { kind: 'none' }, loss: { kind: 'respawnOnDeath' } }
    );

    flow.start(session);
    events.length = 0;
    flow.onPlayerDeath(1 as EntityId);

    expect(events).toHaveLength(0);
    expect(flow.isActive()).toBe(true);
    expect(clock.isRunning()).toBe(true);
  });

  it("keeps allPlayersDead sessions running while another player is still alive", () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    let livePlayers = 1;
    const flow = createSessionFlowSystem({
      clock,
      emitEvent: (e) => events.push(e),
      livePlayerCount: () => livePlayers
    });
    const session = makeSession(
      [emptyEncounter('only', { kind: 'never', next: 'sequential' })],
      { loss: { kind: 'allPlayersDead' } }
    );

    flow.start(session);
    events.length = 0;
    flow.onPlayerDeath(1 as EntityId);

    expect(events).toHaveLength(0);
    expect(flow.isActive()).toBe(true);
    expect(clock.isRunning()).toBe(true);
  });

  it("publishes loss for allPlayersDead only when no live players remain", () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    let livePlayers = 0;
    const flow = createSessionFlowSystem({
      clock,
      emitEvent: (e) => events.push(e),
      livePlayerCount: () => livePlayers
    });
    const session = makeSession(
      [emptyEncounter('only', { kind: 'never', next: 'sequential' })],
      { loss: { kind: 'allPlayersDead' } }
    );

    flow.start(session);
    events.length = 0;
    flow.onPlayerDeath(1 as EntityId);

    expect(events.map((event) => event.kind)).toEqual(['encounterEnd', 'loss', 'sessionStop']);
    expect(flow.isActive()).toBe(false);
    expect(clock.isRunning()).toBe(false);
  });

  it("repeated onPlayerDeath after run end is a no-op", () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({ clock, emitEvent: (e) => events.push(e) });
    const session = makeSession([emptyEncounter('only', { kind: 'never', next: 'sequential' })]);

    flow.start(session);
    flow.onPlayerDeath(1 as EntityId);
    events.length = 0;
    flow.onPlayerDeath(1 as EntityId);
    expect(events).toHaveLength(0);
  });

  it("does not republish 'loss' when a second player death arrives after the run ended", () => {
    const clock = createFakeClock();
    const events: RuntimeEvent[] = [];
    const flow = createSessionFlowSystem({ clock, emitEvent: (e) => events.push(e) });
    const base = makeSession([emptyEncounter('only', { kind: 'never', next: 'sequential' })]);
    const session: SessionDefinition = {
      ...base,
      players: [
        { ...base.players[0], id: 'alpha' },
        { ...base.players[0], id: 'bravo', position: { x: 1, y: 0 } }
      ]
    };

    flow.start(session);
    events.length = 0;
    flow.onPlayerDeath(1 as EntityId);
    flow.onPlayerDeath(2 as EntityId);

    expect(events.map((event) => event.kind)).toEqual(['encounterEnd', 'loss', 'sessionStop']);
  });

  it('does not mark the active encounter complete when player death ends the run', () => {
    const clock = createFakeClock();
    const completed: string[] = [];
    const flow = createSessionFlowSystem({
      clock,
      emitEvent: () => {},
      onEncounterComplete: (encounter) => completed.push(encounter.id)
    });
    const session = makeSession([waveEncounter('active-wave', { kind: 'never', next: 'sequential' })]);

    flow.start(session);
    flow.onPlayerDeath(1 as EntityId);

    expect(completed).toEqual([]);
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
      flow.handleInput(session.players[0].id, { kind: 'fire', phase: 'start' });
      expect(localWarn).toHaveBeenCalledTimes(3);
    } finally {
      localWarn.mockRestore();
    }
  });
});

function terminalEvent<TKind extends 'win' | 'loss'>(
  events: ReadonlyArray<RuntimeEvent>,
  kind: TKind
): Extract<RuntimeEvent, { kind: TKind }> {
  const event = events.find((candidate): candidate is Extract<RuntimeEvent, { kind: TKind }> => {
    return candidate.kind === kind;
  });
  if (event === undefined) {
    throw new Error(`missing terminal event: ${kind}`);
  }
  return event;
}
