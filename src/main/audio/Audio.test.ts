import { describe, expect, it, vi } from 'vitest';

import type { RuntimeEvent } from '../../shared/events';
import type { Log } from '../../shared/log';
import type { SessionDefinition } from '../../shared/session';
import type { Snapshot } from '../../shared/snapshot';
import type { SnapshotPair } from '../sim/SimWorkerHost';

import { calculateEffectiveGain, createAudio } from './Audio';
import type {
  AudioApi,
  AudioBufferLike,
  AudioBufferSourceNodeLike,
  AudioConnectable,
  AudioContextLike,
  AudioContextStateLike,
  AudioDestinationNodeLike,
  AudioGainNodeLike,
  AudioParamLike
} from './AudioApi';

class FakeAudioDestination implements AudioDestinationNodeLike {}

class FakeAudioParam implements AudioParamLike {
  value = 0;
}

class FakeGainNode implements AudioGainNodeLike {
  readonly gain = new FakeAudioParam();
  readonly connections: AudioConnectable[] = [];
  disconnectCalls = 0;

  connect(destination: AudioConnectable): void {
    this.connections.push(destination);
  }

  disconnect(): void {
    this.disconnectCalls += 1;
    this.connections.length = 0;
  }
}

class FakeBufferSourceNode implements AudioBufferSourceNodeLike {
  buffer: AudioBufferLike | null = null;
  loop = false;
  onended: ((event: Event) => unknown) | null = null;
  readonly connections: AudioConnectable[] = [];
  startCalls = 0;
  stopCalls = 0;

  connect(destination: AudioConnectable): void {
    this.connections.push(destination);
  }

  disconnect(): void {
    this.connections.length = 0;
  }

  start(): void {
    this.startCalls += 1;
  }

  stop(): void {
    this.stopCalls += 1;
    this.onended?.({} as Event);
  }
}

class FakeAudioContext implements AudioContextLike {
  readonly destination = new FakeAudioDestination();
  readonly gains: FakeGainNode[] = [];
  readonly sources: FakeBufferSourceNode[] = [];
  currentTime = 0;
  resumeCalls = 0;
  closeCalls = 0;

  private _state: AudioContextStateLike = 'suspended';
  private resumeImpl: () => Promise<void> = async () => {
    this._state = 'running';
  };

  get state(): AudioContextStateLike {
    return this._state;
  }

  setState(next: AudioContextStateLike): void {
    this._state = next;
  }

  setResumeImpl(resumeImpl: () => Promise<void>): void {
    this.resumeImpl = resumeImpl;
  }

  createGain(): AudioGainNodeLike {
    const node = new FakeGainNode();
    this.gains.push(node);
    return node;
  }

  createBufferSource(): AudioBufferSourceNodeLike {
    const node = new FakeBufferSourceNode();
    this.sources.push(node);
    return node;
  }

  async decodeAudioData(audioData: ArrayBuffer): Promise<AudioBufferLike> {
    return { byteLength: audioData.byteLength };
  }

  async resume(): Promise<void> {
    this.resumeCalls += 1;
    await this.resumeImpl();
  }

  async close(): Promise<void> {
    this.closeCalls += 1;
    this._state = 'closed';
  }
}

function createLogHarness(): Log {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
}

function createAudioHarness(random?: () => number) {
  const context = new FakeAudioContext();
  const log = createLogHarness();
  const audioApi: AudioApi = {
    createContext(): AudioContextLike {
      return context;
    },
    async fetchArrayBuffer(): Promise<ArrayBuffer> {
      return new Uint8Array([1, 2, 3, 4]).buffer;
    }
  };

  const audio = createAudio({
    audioApi,
    log,
    random
  });

  return { audio, context, log };
}

function makeFireEvent(): RuntimeEvent {
  return {
    kind: 'fire',
    simTime: 10,
    shooterId: 1,
    ownerKind: 'player',
    weaponArchetypeId: 'pistol',
    originX: 0,
    originY: 0,
    dirX: 1,
    dirY: 0
  };
}

function makeSnapshotPair(curr: Snapshot | null = null, nowMs = 0): SnapshotPair {
  return {
    prev: null,
    curr,
    currReceivedAtMs: 0,
    nowMs
  };
}

function makeBossSession(): SessionDefinition {
  return {
    id: 'boss-session',
    seed: 1,
    arena: { width: 16, height: 9 },
    player: {
      position: { x: 0, y: 0 },
      radius: 0.5,
      maxSpeed: 5,
      maxHp: 5
    },
    loadout: { primaryWeaponArchetypeId: 'pistol' },
    modifiers: [],
    rules: null,
    encounters: [
      {
        id: 'boss-encounter',
        type: 'boss',
        spawnPlan: {
          kind: 'boss',
          bossArchetypeId: 'slime-king',
          position: { x: 0, y: 0 }
        },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      }
    ],
    winCondition: { kind: 'bossDefeated' },
    lossCondition: { kind: 'playerDeath' },
    uiMeta: null
  };
}

function getRequiredGainNodes(context: FakeAudioContext): Readonly<{
  masterGain: FakeGainNode;
  sfxGain: FakeGainNode;
  musicGain: FakeGainNode;
  uiGain: FakeGainNode;
}> {
  const masterGain = context.gains[0];
  const sfxGain = context.gains[1];
  const musicGain = context.gains[2];
  const uiGain = context.gains[3];

  if (
    masterGain === undefined ||
    sfxGain === undefined ||
    musicGain === undefined ||
    uiGain === undefined
  ) {
    throw new Error('audio mixer graph is incomplete');
  }

  return {
    masterGain,
    sfxGain,
    musicGain,
    uiGain
  };
}

function createDeferred(): Readonly<{
  promise: Promise<void>;
  resolve(): void;
}> {
  let resolvePromise: (() => void) | null = null;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve(): void {
      if (resolvePromise === null) {
        throw new Error('deferred promise was not initialized');
      }
      resolvePromise();
    }
  };
}

async function flushAudioWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('createAudio', () => {
  it('calculates effective gain from sample, bus, master and per-call multipliers', () => {
    expect(
      calculateEffectiveGain(
        {
          normalizedGain: 0.35,
          defaultGain: 0.3
        },
        {
          busGain: 0.5,
          masterGain: 0.8,
          perCallGainMul: 0.25
        }
      )
    ).toBeCloseTo(0.0105);
  });

  it('creates master, sfx, music and ui buses with unit gain and expected wiring', () => {
    const { audio, context } = createAudioHarness();

    expect(context.gains).toHaveLength(4);
    const { masterGain, sfxGain, musicGain, uiGain } = getRequiredGainNodes(context);
    expect(masterGain.gain.value).toBe(1);
    expect(sfxGain.gain.value).toBe(1);
    expect(musicGain.gain.value).toBe(1);
    expect(uiGain.gain.value).toBe(1);

    expect(masterGain.connections).toEqual([context.destination]);
    expect(sfxGain.connections).toEqual([masterGain]);
    expect(musicGain.connections).toEqual([masterGain]);
    expect(uiGain.connections).toEqual([masterGain]);

    audio.dispose();
  });

  it('keeps unlock idempotent while resume is in flight', async () => {
    const { audio, context } = createAudioHarness();
    const deferred = createDeferred();
    context.setResumeImpl(
      () =>
        deferred.promise.then(() => {
          context.setState('running');
        })
    );

    audio.unlock();
    audio.unlock();

    expect(context.resumeCalls).toBe(1);

    deferred.resolve();
    await flushAudioWork();

    audio.unlock();
    expect(context.resumeCalls).toBe(1);
  });

  it('warns once and no-ops on playback attempts before unlock', () => {
    const { audio, log } = createAudioHarness();

    audio.handleEvent(makeFireEvent());
    audio.playUi('buttonClick');
    audio.update(makeSnapshotPair(), { kind: 'running' }, null);

    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledWith('audio skipped before unlock', {
      reason: 'event:fire'
    });
  });

  it('disconnects the mixer graph and closes the context on dispose', async () => {
    const { audio, context } = createAudioHarness();

    audio.dispose();
    await flushAudioWork();

    expect(context.closeCalls).toBe(1);
    expect(context.gains.every((node) => node.disconnectCalls === 1)).toBe(true);
  });

  it('routes fire events to one-shot playback after unlock', async () => {
    const { audio, context } = createAudioHarness();
    context.setState('running');

    audio.handleEvent(makeFireEvent());
    await flushAudioWork();

    expect(context.sources).toHaveLength(1);
    expect(context.sources[0]?.startCalls).toBe(1);
  });

  it('routes hit and death through snapshot archetype resolution', async () => {
    const { audio, context } = createAudioHarness();
    context.setState('running');

    audio.update(
      makeSnapshotPair({
        simTimeMs: 100,
        entities: [
          {
            id: 99,
            kind: 'enemy',
            archetypeId: 'slime-fast',
            x: 0,
            y: 0,
            hp: 1,
            maxHp: 1
          }
        ],
        encounter: null,
        zone: { mode: 'disabled', margin: 0 },
        waveProgress: null,
        bossHud: null
      }),
      { kind: 'running' },
      null
    );
    await flushAudioWork();
    const baselineSourceCount = context.sources.length;

    audio.handleEvent({
      kind: 'hit',
      simTime: 110,
      projectileId: 1,
      targetId: 99,
      targetKind: 'enemy',
      weaponArchetypeId: 'pistol',
      damage: 1,
      x: 0,
      y: 0
    });
    audio.handleEvent({
      kind: 'death',
      simTime: 120,
      entityId: 99,
      entityKind: 'enemy',
      archetypeId: 'slime-fast',
      x: 0,
      y: 0
    });

    await flushAudioWork();

    expect(context.sources).toHaveLength(baselineSourceCount + 2);
  });

  it('skips unmapped training-target death with one warning and no crash', async () => {
    const { audio, context, log } = createAudioHarness();
    context.setState('running');

    audio.update(
      makeSnapshotPair({
        simTimeMs: 100,
        entities: [
          {
            id: 10,
            kind: 'enemy',
            archetypeId: 'training-target',
            x: 0,
            y: 0,
            hp: 0,
            maxHp: 3
          }
        ],
        encounter: null,
        zone: { mode: 'disabled', margin: 0 },
        waveProgress: null,
        bossHud: null
      }),
      { kind: 'running' },
      null
    );
    await flushAudioWork();
    const baselineSourceCount = context.sources.length;

    audio.handleEvent({
      kind: 'death',
      simTime: 100,
      entityId: 10,
      entityKind: 'enemy',
      archetypeId: 'training-target',
      x: 0,
      y: 0
    });
    audio.handleEvent({
      kind: 'death',
      simTime: 101,
      entityId: 10,
      entityKind: 'enemy',
      archetypeId: 'training-target',
      x: 0,
      y: 0
    });

    await flushAudioWork();

    expect(context.sources).toHaveLength(baselineSourceCount);
    expect(log.warn).toHaveBeenCalledWith('audio mapping missing; skipping playback', {
      mappingKey: 'enemies.training-target.death'
    });
  });

  it('routes drop pickup and boss phase change samples', async () => {
    const { audio, context } = createAudioHarness();
    context.setState('running');
    audio.attach(makeBossSession());

    audio.update(
      makeSnapshotPair({
        simTimeMs: 200,
        entities: [
          {
            id: 7,
            kind: 'boss',
            archetypeId: 'slime-king',
            x: 0,
            y: 0,
            hp: 20,
            maxHp: 40,
            phaseIndex: 0,
            phaseId: 'crown-intact',
            activeAttackIds: []
          }
        ],
        encounter: {
          id: 'boss-encounter',
          type: 'boss',
          index: 0,
          elapsedMs: 500
        },
        zone: { mode: 'disabled', margin: 0 },
        waveProgress: null,
        bossHud: {
          entityId: 7,
          phaseIndex: 0,
          phaseId: 'crown-intact',
          hp: 20,
          maxHp: 40,
          activeAttackIds: []
        }
      }),
      { kind: 'running' },
      null
    );
    await flushAudioWork();
    const baselineSourceCount = context.sources.length;

    audio.handleEvent({
      kind: 'dropPickup',
      simTime: 210,
      entityId: 1,
      archetypeId: 'heal-orb',
      pickerId: 2,
      x: 0,
      y: 0
    });
    audio.handleEvent({
      kind: 'bossPhaseChange',
      simTime: 220,
      bossId: 7,
      phaseIndex: 1,
      phaseId: 'desperation'
    });

    await flushAudioWork();

    expect(context.sources).toHaveLength(baselineSourceCount + 2);
  });

  it('starts regular music in running and ducks the music bus in paused', async () => {
    const { audio, context } = createAudioHarness(() => 0);
    const { musicGain } = getRequiredGainNodes(context);
    context.setState('running');

    audio.update(
      makeSnapshotPair({
        simTimeMs: 300,
        entities: [],
        encounter: {
          id: 'wave-1',
          type: 'wave',
          index: 0,
          elapsedMs: 0
        },
        zone: { mode: 'disabled', margin: 0 },
        waveProgress: null,
        bossHud: null
      }),
      { kind: 'running' },
      null
    );
    await flushAudioWork();

    expect(context.sources).toHaveLength(1);
    expect(context.sources[0]?.loop).toBe(false);
    expect(musicGain.gain.value).toBe(1);

    audio.update(
      makeSnapshotPair({
        simTimeMs: 320,
        entities: [],
        encounter: {
          id: 'wave-1',
          type: 'wave',
          index: 0,
          elapsedMs: 20
        },
        zone: { mode: 'disabled', margin: 0 },
        waveProgress: null,
        bossHud: null
      }),
      { kind: 'paused' },
      null
    );

    expect(context.sources).toHaveLength(1);
    expect(musicGain.gain.value).toBe(0.5);
  });

  it('switches to boss music and silences it in menu/result phases', async () => {
    const { audio, context } = createAudioHarness(() => 0);
    context.setState('running');

    audio.update(
      makeSnapshotPair({
        simTimeMs: 400,
        entities: [],
        encounter: {
          id: 'wave-1',
          type: 'wave',
          index: 0,
          elapsedMs: 0
        },
        zone: { mode: 'disabled', margin: 0 },
        waveProgress: null,
        bossHud: null
      }),
      { kind: 'running' },
      null
    );
    await flushAudioWork();

    audio.attach(makeBossSession());
    audio.update(
      makeSnapshotPair({
        simTimeMs: 450,
        entities: [
          {
            id: 7,
            kind: 'boss',
            archetypeId: 'slime-king',
            x: 0,
            y: 0,
            hp: 40,
            maxHp: 40,
            phaseIndex: 0,
            phaseId: 'crown-intact',
            activeAttackIds: []
          }
        ],
        encounter: {
          id: 'boss-encounter',
          type: 'boss',
          index: 0,
          elapsedMs: 0
        },
        zone: { mode: 'disabled', margin: 0 },
        waveProgress: null,
        bossHud: {
          entityId: 7,
          phaseIndex: 0,
          phaseId: 'crown-intact',
          hp: 40,
          maxHp: 40,
          activeAttackIds: []
        }
      }),
      { kind: 'running' },
      null
    );
    await flushAudioWork();

    expect(context.sources).toHaveLength(2);
    expect(context.sources[0]?.stopCalls).toBe(1);
    expect(context.sources[1]?.loop).toBe(true);

    audio.update(makeSnapshotPair(), { kind: 'menu' }, null);
    expect(context.sources[1]?.stopCalls).toBe(1);
  });

  it('pauses ambient slime voice timers while paused and resumes them in running', async () => {
    const { audio, context } = createAudioHarness(() => 0);
    context.setState('running');

    const slimeSnapshot: Snapshot = {
      simTimeMs: 500,
      entities: [
        {
          id: 21,
          kind: 'enemy',
          archetypeId: 'slime-fast',
          x: 0,
          y: 0,
          hp: 1,
          maxHp: 1
        }
      ],
      encounter: {
        id: 'wave-1',
        type: 'wave',
        index: 0,
        elapsedMs: 500
      },
      zone: { mode: 'disabled', margin: 0 },
      waveProgress: null,
      bossHud: null
    };

    audio.update(makeSnapshotPair(slimeSnapshot), { kind: 'running' }, null);
    await flushAudioWork();
    const baselineSourceCount = context.sources.length;

    audio.update(
      {
        prev: slimeSnapshot,
        curr: slimeSnapshot,
        currReceivedAtMs: 0,
        nowMs: 4000
      },
      { kind: 'paused' },
      null
    );
    await flushAudioWork();

    expect(context.sources).toHaveLength(baselineSourceCount);

    audio.update(
      {
        prev: slimeSnapshot,
        curr: slimeSnapshot,
        currReceivedAtMs: 0,
        nowMs: 4000
      },
      { kind: 'running' },
      null
    );
    await flushAudioWork();

    expect(context.sources).toHaveLength(baselineSourceCount + 1);
  });

  it('reinitializes ambient timers for newly appeared enemies after removals', async () => {
    const { audio, context } = createAudioHarness(() => 0);
    context.setState('running');

    audio.update(
      makeSnapshotPair({
        simTimeMs: 0,
        entities: [
          {
            id: 1,
            kind: 'enemy',
            archetypeId: 'slime-tank',
            x: 0,
            y: 0,
            hp: 5,
            maxHp: 5
          }
        ],
        encounter: {
          id: 'wave-1',
          type: 'wave',
          index: 0,
          elapsedMs: 0
        },
        zone: { mode: 'disabled', margin: 0 },
        waveProgress: null,
        bossHud: null
      }, 0),
      { kind: 'running' },
      null
    );
    await flushAudioWork();
    const baselineSourceCount = context.sources.length;

    audio.update(
      makeSnapshotPair({
        simTimeMs: 1000,
        entities: [],
        encounter: {
          id: 'wave-1',
          type: 'wave',
          index: 0,
          elapsedMs: 1000
        },
        zone: { mode: 'disabled', margin: 0 },
        waveProgress: null,
        bossHud: null
      }, 1000),
      { kind: 'running' },
      null
    );

    audio.update(
      makeSnapshotPair({
        simTimeMs: 1500,
        entities: [
          {
            id: 2,
            kind: 'enemy',
            archetypeId: 'slime-tank',
            x: 0,
            y: 0,
            hp: 5,
            maxHp: 5
          }
        ],
        encounter: {
          id: 'wave-1',
          type: 'wave',
          index: 0,
          elapsedMs: 1500
        },
        zone: { mode: 'disabled', margin: 0 },
        waveProgress: null,
        bossHud: null
      }, 1500),
      { kind: 'running' },
      null
    );
    await flushAudioWork();

    audio.update(
      makeSnapshotPair({
        simTimeMs: 5000,
        entities: [
          {
            id: 2,
            kind: 'enemy',
            archetypeId: 'slime-tank',
            x: 0,
            y: 0,
            hp: 5,
            maxHp: 5
          }
        ],
        encounter: {
          id: 'wave-1',
          type: 'wave',
          index: 0,
          elapsedMs: 5000
        },
        zone: { mode: 'disabled', margin: 0 },
        waveProgress: null,
        bossHud: null
      }, 5000),
      { kind: 'running' },
      null
    );
    await flushAudioWork();

    expect(context.sources).toHaveLength(baselineSourceCount + 1);
  });
});
