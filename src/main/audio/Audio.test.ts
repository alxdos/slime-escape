import { describe, expect, it, vi } from 'vitest';

import type { RuntimeEvent } from '../../shared/events';
import type { Log } from '../../shared/log';
import type { SessionDefinition } from '../../shared/session';
import type { SessionResultSummary } from '../../shared/sessionResult';
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
  private currentValue = 0;
  setCalls = 0;

  get value(): number {
    return this.currentValue;
  }

  set value(next: number) {
    this.currentValue = next;
    this.setCalls += 1;
  }
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
  throwOnStop = false;

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
    if (this.throwOnStop) {
      throw new Error('stop failed');
    }
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
  const fetchedUrls: string[] = [];
  const audioApi: AudioApi = {
    createContext(): AudioContextLike {
      return context;
    },
    async fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
      fetchedUrls.push(url);
      return new Uint8Array([1, 2, 3, 4]).buffer;
    }
  };

  const audio = createAudio({
    audioApi,
    log,
    random
  });

  return { audio, context, log, fetchedUrls };
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

function makeWinEvent(simTime = 123): Extract<RuntimeEvent, { kind: 'win' }> {
  return {
    kind: 'win',
    simTime,
    summary: makeResultSummary('win', simTime)
  };
}

function makeResultSummary(
  outcome: 'win' | 'loss',
  durationMs: number
): SessionResultSummary {
  return {
    outcome,
    durationMs,
    progress: {
      percent: outcome === 'win' ? 100 : 64,
      completedObjectiveEncounters: 1,
      totalObjectiveEncounters: 1,
      completedWaves: 1,
      totalWaves: 1,
      activeEncounterId: null,
      activeEncounterIndex: null
    },
    kills: {
      total: 0,
      byArchetype: []
    },
    drops: {
      pickedUpTotal: 0
    },
    boss: null,
    defeat: null,
    dungeon: null
  };
}

type SnapshotInput = (Snapshot & Readonly<{ weaponHud?: unknown }>) | null;

function makeSnapshotPair(curr: SnapshotInput = null, nowMs = 0): SnapshotPair {
  const normalizedCurr = curr === null ? null : stripLegacyWeaponHud(curr);
  return {
    prev: null,
    curr: normalizedCurr,
    currReceivedAtMs: 0,
    nowMs
  };
}

function stripLegacyWeaponHud(snapshot: Snapshot & Readonly<{ weaponHud?: unknown }>): Snapshot {
  const { weaponHud: _legacyWeaponHud, ...rest } = snapshot;
  return rest;
}

function makeBossSession(
  overrides: Readonly<{
    musicSampleId?: string | null;
  }> = {}
): SessionDefinition {
  return {
    id: 'boss-session',
    seed: 1,
    arena: { width: 16, height: 9 },
    dynamicRoster: false,
    players: [
      {
        id: 'audio-test-player',
        position: { x: 0, y: 0 },
        radius: 0.5,
        contactBox: { width: 1, height: 1 },
        maxSpeed: 5,
        maxHp: 5,
        loadout: { weapons: ['pistol'], selectedIndex: 0 }
      }
    ],
    companion: null,
    backgrounds: [],
    musicSampleId: overrides.musicSampleId ?? null,
    modifiers: [],
    rules: {
      damage: { slimeFriendlyFire: false },
      aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 }
    },
    encounters: [
      {
        id: 'boss-encounter',
        type: 'boss',
        backgroundId: null,
        introDurationMs: 0,
        name: null,
        text: null,
        spawnPlan: {
          kind: 'boss',
          bossArchetypeId: 'boss-scrap-king',
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
  musicDuckGain: FakeGainNode;
}> {
  const masterGain = context.gains[0];
  const sfxGain = context.gains[1];
  const musicGain = context.gains[2];
  const uiGain = context.gains[3];
  const musicDuckGain = context.gains[4];

  if (
    masterGain === undefined ||
    sfxGain === undefined ||
    musicGain === undefined ||
    uiGain === undefined ||
    musicDuckGain === undefined
  ) {
    throw new Error('audio mixer graph is incomplete');
  }

  return {
    masterGain,
    sfxGain,
    musicGain,
    uiGain,
    musicDuckGain
  };
}

function getPlaybackTrimGain(context: FakeAudioContext, playbackIndex = 0): FakeGainNode {
  const trimGain = context.gains[5 + playbackIndex];
  if (trimGain === undefined) {
    throw new Error(`expected playback trim gain #${playbackIndex} to exist`);
  }
  return trimGain;
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
  it('calculates per-source trim gain from sample and per-call multipliers', () => {
    expect(
      calculateEffectiveGain(
        {
          normalizedGain: 0.35,
          defaultGain: 0.3
        },
        {
          perCallGainMul: 0.25
        }
      )
    ).toBeCloseTo(0.02625);
  });

  it('creates master, sfx, music and ui buses with unit gain and expected wiring', () => {
    const { audio, context } = createAudioHarness();

    expect(context.gains).toHaveLength(5);
    const { masterGain, sfxGain, musicGain, uiGain, musicDuckGain } = getRequiredGainNodes(context);
    expect(masterGain.gain.value).toBe(1);
    expect(sfxGain.gain.value).toBe(1);
    expect(musicGain.gain.value).toBe(1);
    expect(uiGain.gain.value).toBe(1);
    expect(musicDuckGain.gain.value).toBe(1);

    expect(masterGain.connections).toEqual([context.destination]);
    expect(sfxGain.connections).toEqual([masterGain]);
    expect(musicGain.connections).toEqual([musicDuckGain]);
    expect(uiGain.connections).toEqual([masterGain]);
    expect(musicDuckGain.connections).toEqual([masterGain]);

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

  it('applies master gain before unlock and across attach/detach', () => {
    const { audio, context } = createAudioHarness();
    const { masterGain } = getRequiredGainNodes(context);

    audio.setMasterGain(0.4);
    expect(masterGain.gain.value).toBe(0.4);

    audio.attach(makeBossSession());
    audio.detach();

    audio.setMasterGain(0.7);
    expect(masterGain.gain.value).toBe(0.7);
  });

  it('clamps out-of-range master gain, warns, and skips redundant assignments', () => {
    const { audio, context, log } = createAudioHarness();
    const { masterGain } = getRequiredGainNodes(context);

    const initialSetCalls = masterGain.gain.setCalls;

    audio.setMasterGain(2);
    expect(masterGain.gain.value).toBe(1);
    expect(masterGain.gain.setCalls).toBe(initialSetCalls);
    expect(log.warn).toHaveBeenCalledWith('audio master gain clamped to [0, 1]', {
      value: 2,
      clampedValue: 1
    });

    audio.setMasterGain(-0.25);
    expect(masterGain.gain.value).toBe(0);
    expect(masterGain.gain.setCalls).toBe(initialSetCalls + 1);
    expect(log.warn).toHaveBeenCalledWith('audio master gain clamped to [0, 1]', {
      value: -0.25,
      clampedValue: 0
    });

    const setCallsAfterClamp = masterGain.gain.setCalls;
    audio.setMasterGain(0);
    expect(masterGain.gain.setCalls).toBe(setCallsAfterClamp);

    audio.setMasterGain(Number.NaN);
    expect(masterGain.gain.value).toBe(0);
    expect(masterGain.gain.setCalls).toBe(setCallsAfterClamp);
    expect(log.warn).toHaveBeenCalledWith(
      'audio master gain is not a number; keeping current value',
      {
        value: Number.NaN,
        currentValue: 0
      }
    );
  });

  it('routes fire events to one-shot playback after unlock', async () => {
    const { audio, context } = createAudioHarness();
    const { masterGain, sfxGain } = getRequiredGainNodes(context);
    context.setState('running');
    masterGain.gain.value = 0.8;
    sfxGain.gain.value = 0.5;

    audio.handleEvent({
      kind: 'fire',
      simTime: 10,
      shooterId: 1,
      ownerKind: 'player',
      weaponArchetypeId: 'shotgun',
      originX: 0,
      originY: 0,
      dirX: 1,
      dirY: 0
    });
    await flushAudioWork();

    expect(context.sources).toHaveLength(1);
    expect(context.sources[0]?.startCalls).toBe(1);
    expect(getPlaybackTrimGain(context).gain.value).toBeCloseTo(0.35);
    expect(sfxGain.gain.value).toBe(0.5);
    expect(masterGain.gain.value).toBe(0.8);
  });

  it('skips unresolved boss fire events without emitting a missing-mapping warning', async () => {
    const { audio, context, log } = createAudioHarness();
    context.setState('running');

    audio.handleEvent({
      kind: 'fire',
      simTime: 10,
      shooterId: 77,
      ownerKind: 'boss',
      weaponArchetypeId: 'boss-fire',
      originX: 0,
      originY: 0,
      dirX: 1,
      dirY: 0
    });

    await flushAudioWork();

    expect(context.sources).toHaveLength(0);
    expect(log.warn).not.toHaveBeenCalled();
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
            archetypeId: 'slime-one-eye',
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
      targetArchetypeId: 'slime-one-eye',
      weaponArchetypeId: 'pistol',
      damage: 1,
      impactDirX: 1,
      impactDirY: 0,
      x: 0,
      y: 0
    });
    audio.handleEvent({
      kind: 'death',
      simTime: 120,
      entityId: 99,
      entityKind: 'enemy',
      archetypeId: 'slime-one-eye',
      weaponArchetypeId: 'pistol',
      impactDirX: 1,
      impactDirY: 0,
      killerId: null,
      x: 0,
      y: 0
    });

    await flushAudioWork();

    expect(context.sources).toHaveLength(baselineSourceCount + 2);
  });

  it('skips player hit events without playback or warnings', async () => {
    const { audio, context, log } = createAudioHarness();
    context.setState('running');

    audio.handleEvent({
      kind: 'hit',
      simTime: 110,
      projectileId: 1,
      targetId: 5,
      targetKind: 'player',
      targetArchetypeId: null,
      weaponArchetypeId: 'pistol',
      damage: 1,
      impactDirX: 1,
      impactDirY: 0,
      x: 0,
      y: 0
    });

    await flushAudioWork();

    expect(context.sources).toHaveLength(0);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('falls back to the event archetype when an enemy hit arrives without a snapshot entity', async () => {
    const { audio, context, log } = createAudioHarness();
    context.setState('running');

    audio.handleEvent({
      kind: 'hit',
      simTime: 110,
      projectileId: 1,
      targetId: 99,
      targetKind: 'enemy',
      targetArchetypeId: 'slime-one-eye',
      weaponArchetypeId: 'rock-thrower',
      damage: 3,
      impactDirX: 1,
      impactDirY: 0,
      x: 0,
      y: 0
    });

    await flushAudioWork();

    expect(context.sources).toHaveLength(1);
    expect(context.sources[0]?.startCalls).toBe(1);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('warns once and skips boss hit playback when the boss hit mapping is absent', async () => {
    const { audio, context, log } = createAudioHarness();
    context.setState('running');

    audio.update(
      makeSnapshotPair({
        simTimeMs: 100,
        entities: [
          {
            id: 7,
            kind: 'boss',
            archetypeId: 'boss-scrap-king',
            x: 0,
            y: 0,
            hp: 40,
            maxHp: 40,
            phaseIndex: 0,
            phaseId: 'crown-intact',
            activeAttackIds: []
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
      targetId: 7,
      targetKind: 'boss',
      targetArchetypeId: 'boss-scrap-king',
      weaponArchetypeId: 'pistol',
      damage: 1,
      impactDirX: 1,
      impactDirY: 0,
      x: 0,
      y: 0
    });
    audio.handleEvent({
      kind: 'hit',
      simTime: 111,
      projectileId: 2,
      targetId: 7,
      targetKind: 'boss',
      targetArchetypeId: 'boss-scrap-king',
      weaponArchetypeId: 'pistol',
      damage: 1,
      impactDirX: 1,
      impactDirY: 0,
      x: 0,
      y: 0
    });

    await flushAudioWork();

    expect(context.sources).toHaveLength(baselineSourceCount);
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledWith('audio mapping missing; skipping playback', {
      mappingKey: 'bosses.boss-scrap-king.hit'
    });
  });

  it('falls back to the event archetype when an enemy death arrives after the snapshot entity is gone', async () => {
    const { audio, context, log } = createAudioHarness();
    context.setState('running');

    audio.handleEvent({
      kind: 'death',
      simTime: 120,
      entityId: 42,
      entityKind: 'enemy',
      archetypeId: 'slime-one-eye',
      weaponArchetypeId: 'pistol',
      impactDirX: 1,
      impactDirY: 0,
      killerId: null,
      x: 0,
      y: 0
    });

    await flushAudioWork();

    expect(context.sources).toHaveLength(1);
    expect(context.sources[0]?.startCalls).toBe(1);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('skips unmapped enemy death with one warning and no crash', async () => {
    const { audio, context, log } = createAudioHarness();
    context.setState('running');

    audio.update(
      makeSnapshotPair({
        simTimeMs: 100,
        entities: [
          {
            id: 10,
            kind: 'enemy',
            archetypeId: 'missing-enemy',
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
      archetypeId: 'missing-enemy',
      weaponArchetypeId: null,
      impactDirX: null,
      impactDirY: null,
      killerId: null,
      x: 0,
      y: 0
    });
    audio.handleEvent({
      kind: 'death',
      simTime: 101,
      entityId: 10,
      entityKind: 'enemy',
      archetypeId: 'missing-enemy',
      weaponArchetypeId: null,
      impactDirX: null,
      impactDirY: null,
      killerId: null,
      x: 0,
      y: 0
    });

    await flushAudioWork();

    expect(context.sources).toHaveLength(baselineSourceCount);
    expect(log.warn).toHaveBeenCalledWith('audio mapping missing; skipping playback', {
      mappingKey: 'enemies.missing-enemy.death'
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
            archetypeId: 'boss-scrap-king',
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
          elapsedMs: 500,
          waveOrdinal: null
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
        },
        weaponHud: null
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
    audio.handleEvent({
      kind: 'explosion',
      simTime: 230,
      projectileId: 9,
      ownerKind: 'player',
      weaponArchetypeId: 'bomb-placer',
      damage: 5,
      radius: 2,
      x: 0,
      y: 0
    });

    await flushAudioWork();

    expect(context.sources).toHaveLength(baselineSourceCount + 3);
  });

  it('plays the victory fanfare on win but not on loss', async () => {
    const { audio, context, fetchedUrls } = createAudioHarness();
    context.setState('running');

    audio.handleEvent(makeWinEvent(240));
    audio.handleEvent({
      ...makeWinEvent(260),
      kind: 'loss',
      summary: makeResultSummary('loss', 260)
    });

    await flushAudioWork();

    expect(fetchedUrls).toEqual(['/sfx/ui/fanfare.mp3']);
    expect(context.sources).toHaveLength(1);
  });

  it('plays the pet revival sample when a companion is rescued', async () => {
    const { audio, context, fetchedUrls } = createAudioHarness();
    context.setState('running');

    audio.handleEvent({
      kind: 'companionRescued',
      simTime: 240,
      companionId: 4,
      petArchetypeId: 'pet-01',
      hp: 2,
      maxHp: 4,
      x: 1,
      y: 2
    });

    await flushAudioWork();

    expect(fetchedUrls).toEqual(['/sfx/pets/revival.mp3']);
    expect(context.sources).toHaveLength(1);
  });

  it('plays the pet shuffle sample while companion rescue is active', async () => {
    const { audio, context, fetchedUrls } = createAudioHarness();
    context.setState('running');
    const rescueSnapshot: Snapshot = {
      simTimeMs: 100,
      entities: [
        {
          id: 4,
          kind: 'companion',
          petArchetypeId: 'pet-01',
          x: 1,
          y: 2,
          hp: 0,
          maxHp: 4,
          state: 'ghost',
          mode: 'rescue',
          rescueProgress: 0.25,
          targetId: null
        }
      ],
      encounter: null,
      zone: { mode: 'disabled', margin: 0 },
      waveProgress: null,
      bossHud: null
    };

    audio.update(makeSnapshotPair(rescueSnapshot, 1000), { kind: 'running' }, null);
    await flushAudioWork();

    expect(fetchedUrls).toEqual(['/sfx/pets/shuffle.mp3']);
    expect(context.sources).toHaveLength(1);

    audio.update(makeSnapshotPair(rescueSnapshot, 1599), { kind: 'running' }, null);
    await flushAudioWork();
    expect(context.sources).toHaveLength(1);

    audio.update(makeSnapshotPair(rescueSnapshot, 1600), { kind: 'running' }, null);
    await flushAudioWork();
    expect(fetchedUrls).toEqual(['/sfx/pets/shuffle.mp3']);
    expect(context.sources).toHaveLength(2);
  });

  it('drops the oldest one-shot when more than 32 one-shots overlap', async () => {
    const { audio, context } = createAudioHarness();
    context.setState('running');

    for (let index = 0; index < 33; index += 1) {
      audio.handleEvent({
        kind: 'fire',
        simTime: index,
        shooterId: index,
        ownerKind: 'player',
        weaponArchetypeId: 'pistol',
        originX: 0,
        originY: 0,
        dirX: 1,
        dirY: 0
      });
    }

    await flushAudioWork();

    expect(context.sources).toHaveLength(33);
    expect(context.sources[0]?.startCalls).toBe(1);
    expect(context.sources[0]?.stopCalls).toBe(1);
    expect(context.sources.slice(1).every((source) => source.stopCalls === 0)).toBe(true);
  });

  it('starts session music in running and ducks the dedicated music duck gain without overwriting the music bus', async () => {
    const { audio, context, fetchedUrls } = createAudioHarness(() => 0);
    const { masterGain, musicGain, musicDuckGain } = getRequiredGainNodes(context);
    context.setState('running');
    masterGain.gain.value = 0.8;
    musicGain.gain.value = 0.2;
    audio.attach(makeBossSession({ musicSampleId: 'music/005-forest' }));

    audio.update(
      makeSnapshotPair({
        simTimeMs: 300,
        entities: [],
        encounter: {
          id: 'wave-1',
          type: 'wave',
          index: 0,
          elapsedMs: 0,
          waveOrdinal: 1
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
    expect(fetchedUrls).toEqual(['/sfx/music/005-forest.mp3']);
    expect(context.sources[0]?.loop).toBe(true);
    expect(getPlaybackTrimGain(context).gain.value).toBe(1.6);
    expect(masterGain.gain.value).toBe(0.8);
    expect(musicGain.gain.value).toBe(0.2);
    expect(musicDuckGain.gain.value).toBe(1);

    musicGain.gain.value = 0.2;

    audio.update(
      makeSnapshotPair({
        simTimeMs: 320,
        entities: [],
        encounter: {
          id: 'wave-1',
          type: 'wave',
          index: 0,
          elapsedMs: 20,
          waveOrdinal: 1
        },
        zone: { mode: 'disabled', margin: 0 },
        waveProgress: null,
        bossHud: null
      }),
      { kind: 'paused' },
      null
    );

    expect(context.sources).toHaveLength(1);
    expect(musicGain.gain.value).toBe(0.2);
    expect(musicDuckGain.gain.value).toBe(0.5);
  });

  it('keeps regular music silent when the attached session has no music sample', async () => {
    const { audio, context } = createAudioHarness(() => 0);
    context.setState('running');
    audio.attach(makeBossSession({ musicSampleId: null }));

    audio.update(
      makeSnapshotPair({
        simTimeMs: 300,
        entities: [],
        encounter: {
          id: 'wave-1',
          type: 'wave',
          index: 0,
          elapsedMs: 0,
          waveOrdinal: 1
        },
        zone: { mode: 'disabled', margin: 0 },
        waveProgress: null,
        bossHud: null
      }),
      { kind: 'running' },
      null
    );
    await flushAudioWork();

    expect(context.sources).toHaveLength(0);
  });

  it('rejects attached session music that does not reference a music sample', () => {
    const { audio } = createAudioHarness();

    expect(() =>
      audio.attach(makeBossSession({ musicSampleId: 'weapons/pistol' }))
    ).toThrow('audio session.musicSampleId "weapons/pistol" must reference a music sample');
  });

  it('warns instead of throwing when one-shot eviction hits an invalid stop state', async () => {
    const { audio, context, log } = createAudioHarness();
    context.setState('running');

    for (let index = 0; index < 32; index += 1) {
      audio.handleEvent({
        kind: 'fire',
        simTime: index,
        shooterId: index,
        ownerKind: 'player',
        weaponArchetypeId: 'pistol',
        originX: 0,
        originY: 0,
        dirX: 1,
        dirY: 0
      });
    }
    await flushAudioWork();

    const oldestSource = context.sources[0];
    if (oldestSource === undefined) {
      throw new Error('expected oldest source to exist');
    }
    oldestSource.throwOnStop = true;

    audio.handleEvent({
      kind: 'fire',
      simTime: 99,
      shooterId: 99,
      ownerKind: 'player',
      weaponArchetypeId: 'pistol',
      originX: 0,
      originY: 0,
      dirX: 1,
      dirY: 0
    });
    await flushAudioWork();

    expect(context.sources).toHaveLength(33);
    expect(log.warn).toHaveBeenCalledWith('audio source stop failed', {
      context: 'overflow-eviction',
      error: 'stop failed'
    });
  });

  it('switches session music to boss music, then returns to session music before menu ticking', async () => {
    const { audio, context, fetchedUrls } = createAudioHarness(() => 0);
    context.setState('running');
    audio.attach(makeBossSession({ musicSampleId: 'music/005-forest' }));

    audio.update(
      makeSnapshotPair({
        simTimeMs: 400,
        entities: [],
        encounter: {
          id: 'wave-1',
          type: 'wave',
          index: 0,
          elapsedMs: 0,
          waveOrdinal: 1
        },
        zone: { mode: 'disabled', margin: 0 },
        waveProgress: null,
        bossHud: null
      }),
      { kind: 'running' },
      null
    );
    await flushAudioWork();
    expect(fetchedUrls).toEqual(['/sfx/music/005-forest.mp3']);
    expect(context.sources).toHaveLength(1);
    expect(context.sources[0]?.loop).toBe(true);

    audio.update(
      makeSnapshotPair({
        simTimeMs: 450,
        entities: [
          {
            id: 7,
            kind: 'boss',
            archetypeId: 'boss-scrap-king',
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
          elapsedMs: 0,
          waveOrdinal: null
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
    expect(fetchedUrls).toEqual(['/sfx/music/005-forest.mp3', '/sfx/boss/boss-music.mp3']);
    expect(context.sources[0]?.stopCalls).toBe(1);
    expect(context.sources[1]?.loop).toBe(true);

    audio.update(
      makeSnapshotPair({
        simTimeMs: 500,
        entities: [],
        encounter: {
          id: 'wave-2',
          type: 'wave',
          index: 1,
          elapsedMs: 0,
          waveOrdinal: 2
        },
        zone: { mode: 'disabled', margin: 0 },
        waveProgress: null,
        bossHud: null
      }),
      { kind: 'running' },
      null
    );
    await flushAudioWork();

    expect(context.sources).toHaveLength(3);
    expect(context.sources[1]?.stopCalls).toBe(1);
    expect(context.sources[2]?.loop).toBe(true);

    audio.update(makeSnapshotPair(), { kind: 'menu' }, null);
    expect(context.sources[2]?.stopCalls).toBe(1);
    await flushAudioWork();

    expect(context.sources).toHaveLength(4);
    expect(context.sources[3]?.loop).toBe(true);
    expect(getPlaybackTrimGain(context, 3).gain.value).toBe(0.55);
    expect(fetchedUrls).toEqual([
      '/sfx/music/005-forest.mp3',
      '/sfx/boss/boss-music.mp3',
      '/sfx/music/digital-dawn.mp3'
    ]);
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
          archetypeId: 'slime-one-eye',
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
        elapsedMs: 500,
        waveOrdinal: 1
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
            archetypeId: 'slime-shell',
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
          elapsedMs: 0,
          waveOrdinal: 1
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
          elapsedMs: 1000,
          waveOrdinal: 1
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
            archetypeId: 'slime-shell',
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
          elapsedMs: 1500,
          waveOrdinal: 1
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
            archetypeId: 'slime-shell',
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
          elapsedMs: 5000,
          waveOrdinal: 1
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
