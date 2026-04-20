import { describe, expect, it, vi } from 'vitest';

import type { RuntimeEvent } from '../../shared/events';
import type { Log } from '../../shared/log';
import type { EncounterSnapshot } from '../../shared/snapshot';
import type { SnapshotPair } from '../sim/SimWorkerHost';

import { createAudio } from './Audio';
import type {
  AudioApi,
  AudioBufferLike,
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

class FakeAudioContext implements AudioContextLike {
  readonly destination = new FakeAudioDestination();
  readonly gains: FakeGainNode[] = [];
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

function createAudioHarness() {
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
    log
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

function makeSnapshotPair(): SnapshotPair {
  return {
    prev: null,
    curr: null,
    currReceivedAtMs: 0,
    nowMs: 0
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

describe('createAudio', () => {
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
    await Promise.resolve();
    await Promise.resolve();

    audio.unlock();
    expect(context.resumeCalls).toBe(1);
  });

  it('warns once and no-ops on playback attempts before unlock', () => {
    const { audio, log } = createAudioHarness();

    audio.handleEvent(makeFireEvent());
    audio.playUi('buttonClick');
    audio.update(makeSnapshotPair(), { kind: 'running' }, null as EncounterSnapshot | null);

    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledWith('audio skipped before unlock', {
      reason: 'event:fire'
    });
  });

  it('disconnects the mixer graph and closes the context on dispose', async () => {
    const { audio, context } = createAudioHarness();

    audio.dispose();
    await Promise.resolve();

    expect(context.closeCalls).toBe(1);
    expect(context.gains.every((node) => node.disconnectCalls === 1)).toBe(true);
  });
});
