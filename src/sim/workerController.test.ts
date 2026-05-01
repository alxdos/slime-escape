import { describe, expect, it, vi } from 'vitest';

import { BOMB_PLACER } from '../shared/content/weapons';
import type { RuntimeEvent } from '../shared/events';
import type { SimToMain } from '../shared/protocol';
import type { PlayerConfig, SessionDefinition } from '../shared/session';
import type { SimulationCore, SimulationCoreOptions } from '../shared/sim/SimulationCore';
import type {
  OnlinePredictionCore,
  OnlinePredictionCoreOptions
} from '../shared/sim/OnlinePredictionCore';
import type { Snapshot } from '../shared/snapshot';
import { SIM_STEP_MS } from '../shared/timing';
import { createSimulationWorkerController } from './workerController';

const FORBIDDEN_PREDICTOR_EVENT_KINDS: ReadonlyArray<RuntimeEvent['kind']> = [
  'fire',
  'hit',
  'explosion',
  'death',
  'playerSpawn',
  'playerDowned',
  'playerRevived',
  'companionBoop',
  'companionDowned',
  'companionRescued',
  'dropSpawn',
  'dropPickup',
  'dropExpire',
  'bossPhaseChange',
  'win',
  'loss',
  'sessionStart',
  'sessionStop',
  'pause',
  'resume',
  'encounterStart',
  'encounterEnd'
];

describe('simulation worker controller modes', () => {
  it('stops the active runtime before switching modes and routes messages by mode', () => {
    const posted: SimToMain[] = [];
    const localCores: FakeLocalCore[] = [];
    const predictionCores: FakePredictionCore[] = [];
    const controller = createSimulationWorkerController({
      postToMain: (msg) => posted.push(msg),
      createLocalCore: (options) => {
        const core = createFakeLocalCore(options);
        localCores.push(core);
        return core.core;
      },
      createPredictionCore: (options) => {
        const core = createFakePredictionCore(options);
        predictionCores.push(core);
        return core.core;
      }
    });
    const session = makeSession();
    const moveInput = { kind: 'move', dx: 1, dy: 0 } as const;

    controller.handleMessage({ kind: 'startSession', session });
    controller.handleMessage({ kind: 'input', command: moveInput, inputSequence: 1 });

    expect(controller.mode()).toBe('local-authoritative');
    expect(localCores).toHaveLength(1);
    expect(localCores[0]?.core.start).toHaveBeenCalledWith(session);
    expect(localCores[0]?.core.submitInput).toHaveBeenCalledWith('self', moveInput, 1);

    controller.handleMessage({
      kind: 'startSession',
      session,
      mode: 'online-predictor',
      selfPlayerId: 'self'
    });
    controller.handleMessage({ kind: 'input', command: moveInput, inputSequence: 2 });
    controller.handleMessage({ kind: 'authoritativeSnapshot', snapshot: makeSnapshot() });

    expect(controller.mode()).toBe('online-predictor');
    expect(localCores[0]?.core.stop).toHaveBeenCalledTimes(1);
    expect(predictionCores).toHaveLength(1);
    expect(predictionCores[0]?.core.start).toHaveBeenCalledWith(session, 'self');
    expect(predictionCores[0]?.core.submitInput).toHaveBeenCalledWith(moveInput, 2);
    expect(predictionCores[0]?.core.receiveAuthoritativeSnapshot).toHaveBeenCalledWith(
      makeSnapshot()
    );

    controller.handleMessage({ kind: 'startSession', session });

    expect(controller.mode()).toBe('local-authoritative');
    expect(predictionCores[0]?.core.stop).toHaveBeenCalledTimes(1);
    expect(localCores).toHaveLength(2);
    expect(posted).toEqual([]);
  });

  it('emits predicted snapshots without engine events in online predictor mode', () => {
    const posted: SimToMain[] = [];
    const controller = createSimulationWorkerController({
      postToMain: (msg) => posted.push(msg)
    });
    const session = makeSession();

    controller.handleMessage({
      kind: 'startSession',
      session,
      mode: 'online-predictor',
      selfPlayerId: 'self'
    });
    controller.handleMessage({
      kind: 'input',
      command: { kind: 'aim', x: 4, y: 0 },
      inputSequence: 1
    });
    controller.handleMessage({
      kind: 'input',
      command: { kind: 'fire', phase: 'start' },
      inputSequence: 2
    });
    controller.handleMessage({
      kind: 'input',
      command: { kind: 'fire', phase: 'stop' },
      inputSequence: 3
    });
    controller.handleMessage({ kind: 'authoritativeSnapshot', snapshot: makeSnapshot() });
    controller.pump(0);
    controller.pump(SIM_STEP_MS);

    const eventMessages = posted.filter((msg): msg is Extract<SimToMain, { kind: 'event' }> => {
      return msg.kind === 'event';
    });

    expect(posted.some((msg) => msg.kind === 'predictedSnapshot')).toBe(true);
    expect(posted.every((msg) => msg.kind === 'predictedSnapshot')).toBe(true);
    expect(
      eventMessages.filter((msg) => FORBIDDEN_PREDICTOR_EVENT_KINDS.includes(msg.event.kind))
    ).toEqual([]);
  });

  it('suppresses explosive projectile events from the online predictor output stream', () => {
    const posted: SimToMain[] = [];
    const controller = createSimulationWorkerController({
      postToMain: (msg) => posted.push(msg)
    });
    const session = makeSession(BOMB_PLACER.id);

    controller.handleMessage({
      kind: 'startSession',
      session,
      mode: 'online-predictor',
      selfPlayerId: 'self'
    });
    controller.handleMessage({
      kind: 'input',
      command: { kind: 'aim', x: 0, y: 1 },
      inputSequence: 1
    });
    controller.handleMessage({
      kind: 'input',
      command: { kind: 'fire', phase: 'start' },
      inputSequence: 2
    });
    controller.handleMessage({
      kind: 'input',
      command: { kind: 'fire', phase: 'stop' },
      inputSequence: 3
    });
    controller.handleMessage({
      kind: 'authoritativeSnapshot',
      snapshot: makeSnapshot({}, BOMB_PLACER.id)
    });
    for (let step = 0; step < 170; step += 1) {
      controller.pump(step * SIM_STEP_MS);
    }

    const predictedSnapshots = posted.filter(
      (msg): msg is Extract<SimToMain, { kind: 'predictedSnapshot' }> =>
        msg.kind === 'predictedSnapshot'
    );
    const latestPrediction = predictedSnapshots.at(-1)?.snapshot;

    expect(predictedSnapshots.length).toBeGreaterThan(0);
    expect(
      predictedSnapshots.some((msg) =>
        msg.snapshot.entities.some((entity) => entity.kind === 'projectile')
      )
    ).toBe(true);
    expect(latestPrediction?.simTimeMs).toBeGreaterThan(2200);
    expect(latestPrediction?.entities.some((entity) => entity.kind === 'projectile')).toBe(false);
    expect(posted.every((msg) => msg.kind === 'predictedSnapshot')).toBe(true);
  });
});

type FakeLocalCore = Readonly<{
  core: SimulationCore & {
    start: ReturnType<typeof vi.fn<SimulationCore['start']>>;
    stop: ReturnType<typeof vi.fn<SimulationCore['stop']>>;
    submitInput: ReturnType<typeof vi.fn<SimulationCore['submitInput']>>;
  };
  options: SimulationCoreOptions;
}>;

type FakePredictionCore = Readonly<{
  core: OnlinePredictionCore & {
    start: ReturnType<typeof vi.fn<OnlinePredictionCore['start']>>;
    stop: ReturnType<typeof vi.fn<OnlinePredictionCore['stop']>>;
    submitInput: ReturnType<typeof vi.fn<OnlinePredictionCore['submitInput']>>;
    receiveAuthoritativeSnapshot: ReturnType<
      typeof vi.fn<OnlinePredictionCore['receiveAuthoritativeSnapshot']>
    >;
  };
  options: OnlinePredictionCoreOptions;
}>;

function createFakeLocalCore(options: SimulationCoreOptions): FakeLocalCore {
  return {
    options,
    core: {
      start: vi.fn<SimulationCore['start']>(),
      stop: vi.fn<SimulationCore['stop']>(),
      pause: vi.fn<SimulationCore['pause']>(),
      resume: vi.fn<SimulationCore['resume']>(),
      submitInput: vi.fn<SimulationCore['submitInput']>(),
      addPlayer: vi.fn<SimulationCore['addPlayer']>(),
      removePlayer: vi.fn<SimulationCore['removePlayer']>(),
      setPlayerForm: vi.fn<SimulationCore['setPlayerForm']>(),
      pump: vi.fn<SimulationCore['pump']>()
    }
  };
}

function createFakePredictionCore(options: OnlinePredictionCoreOptions): FakePredictionCore {
  return {
    options,
    core: {
      start: vi.fn<OnlinePredictionCore['start']>(),
      stop: vi.fn<OnlinePredictionCore['stop']>(),
      pause: vi.fn<OnlinePredictionCore['pause']>(),
      resume: vi.fn<OnlinePredictionCore['resume']>(),
      submitInput: vi.fn<OnlinePredictionCore['submitInput']>(),
      receiveAuthoritativeSnapshot:
        vi.fn<OnlinePredictionCore['receiveAuthoritativeSnapshot']>(),
      pump: vi.fn<OnlinePredictionCore['pump']>()
    }
  };
}

function makeSession(weaponArchetypeId = 'pistol'): SessionDefinition {
  const player: PlayerConfig = {
    id: 'self',
    position: { x: 0, y: 0 },
    radius: 0.5,
    contactBox: { width: 1, height: 1 },
    maxSpeed: 6,
    maxHp: 10,
    loadout: { weapons: [weaponArchetypeId], selectedIndex: 0 },
    companion: null
  };
  return {
    id: 'predictor-test',
    seed: 1,
    arena: { width: 20, height: 20 },
    backgrounds: [],
    musicSampleId: null,
    modifiers: [],
    rules: {
      damage: { slimeFriendlyFire: false, playerVsPlayerDamage: true },
      aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 }
    },
    encounters: [],
    winCondition: { kind: 'none' },
    lossCondition: { kind: 'none' },
    playerCoopRevive: null,
    uiMeta: null,
    players: [player],
    dynamicRoster: false
  };
}

function makeSnapshot(overrides: Partial<Snapshot> = {}, weaponArchetypeId = 'pistol'): Snapshot {
  return {
    simTimeMs: 100,
    entities: [
      {
        id: 10,
        kind: 'player',
        playerId: 'self',
        x: 0,
        y: 0,
        hp: 10,
        maxHp: 10,
        state: 'alive',
        formArchetypeId: null,
        weaponHud: {
          selectedIndex: 0,
          weapons: [
            {
              index: 0,
              weaponArchetypeId,
              cooldownStartedAtSimMs: 0,
              cooldownReadyAtSimMs: 0,
              modifiers: [],
              timedEffects: []
            }
          ]
        },
        statusEffects: []
      }
    ],
    encounter: null,
    zone: { mode: 'disabled', margin: 0 },
    waveProgress: null,
    bossHud: null,
    lastInputSequence: {},
    ...overrides
  };
}
