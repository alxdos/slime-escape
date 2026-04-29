import { describe, expect, it, vi } from 'vitest';

import type { Log } from '../../shared/log';

import { createSampleRegistry, DEFAULT_SAMPLE_ENTRIES } from './SampleRegistry';
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

  connect(_destination: AudioConnectable): void {}

  disconnect(): void {}
}

class FakeBufferSourceNode implements AudioBufferSourceNodeLike {
  buffer: AudioBufferLike | null = null;
  loop = false;
  onended: ((event: Event) => unknown) | null = null;

  connect(_destination: AudioConnectable): void {}

  disconnect(): void {}

  start(): void {}

  stop(): void {
    this.onended?.({} as Event);
  }
}

class FakeAudioContext implements AudioContextLike {
  readonly destination = new FakeAudioDestination();
  currentTime = 0;
  decodeCalls = 0;

  get state(): AudioContextStateLike {
    return 'running';
  }

  createGain(): AudioGainNodeLike {
    return new FakeGainNode();
  }

  createBufferSource(): AudioBufferSourceNodeLike {
    return new FakeBufferSourceNode();
  }

  async decodeAudioData(audioData: ArrayBuffer): Promise<AudioBufferLike> {
    this.decodeCalls += 1;
    return { byteLength: audioData.byteLength };
  }

  async resume(): Promise<void> {}

  async close(): Promise<void> {}
}

function createLogHarness(): Log {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
}

function createArrayBuffer(byteLength: number): ArrayBuffer {
  return new Uint8Array(byteLength).buffer;
}

describe('createSampleRegistry', () => {
  it('throws when duplicate sample ids are registered', () => {
    const context = new FakeAudioContext();
    const audioApi: AudioApi = {
      createContext(): AudioContextLike {
        return context;
      },
      async fetchArrayBuffer(): Promise<ArrayBuffer> {
        return createArrayBuffer(4);
      }
    };

    expect(() =>
      createSampleRegistry({
        audioApi,
        context,
        entries: [
          {
            id: 'dup',
            url: '/one.mp3',
            category: 'sfx',
            normalizedGain: 1,
            defaultGain: 1
          },
          {
            id: 'dup',
            url: '/two.mp3',
            category: 'sfx',
            normalizedGain: 1,
            defaultGain: 1
          }
        ]
      })
    ).toThrow('duplicate id "dup"');
  });

  it('clamps invalid gains and emits warnings during registry initialization', () => {
    const context = new FakeAudioContext();
    const log = createLogHarness();
    const audioApi: AudioApi = {
      createContext(): AudioContextLike {
        return context;
      },
      async fetchArrayBuffer(): Promise<ArrayBuffer> {
        return createArrayBuffer(4);
      }
    };

    const registry = createSampleRegistry({
      audioApi,
      context,
      log,
      entries: [
        {
          id: 'clamped',
          url: '/clamped.mp3',
          category: 'music',
          normalizedGain: 0,
          defaultGain: 4,
          loop: true
        }
      ]
    });

    expect(registry.require('clamped')).toEqual({
      id: 'clamped',
      url: '/clamped.mp3',
      category: 'music',
      normalizedGain: 0.0001,
      defaultGain: 2,
      loop: true
    });
    expect(log.warn).toHaveBeenCalledTimes(2);
  });

  it('throws when a music sample is not marked as looped', () => {
    const context = new FakeAudioContext();
    const audioApi: AudioApi = {
      createContext(): AudioContextLike {
        return context;
      },
      async fetchArrayBuffer(): Promise<ArrayBuffer> {
        return createArrayBuffer(4);
      }
    };

    expect(() =>
      createSampleRegistry({
        audioApi,
        context,
        entries: [
          {
            id: 'music/not-looped',
            url: '/music/not-looped.mp3',
            category: 'music',
            normalizedGain: 1,
            defaultGain: 1
          }
        ]
      })
    ).toThrow('audio sample "music/not-looped" has category "music" but loop is not true');
  });

  it('keeps the drop pickup placeholder on the sfx bus even when it reuses a ui file', () => {
    const context = new FakeAudioContext();
    const audioApi: AudioApi = {
      createContext(): AudioContextLike {
        return context;
      },
      async fetchArrayBuffer(): Promise<ArrayBuffer> {
        return createArrayBuffer(4);
      }
    };

    const registry = createSampleRegistry({
      audioApi,
      context
    });

    expect(registry.require('events/drop-pickup')).toEqual({
      id: 'events/drop-pickup',
      url: '/sfx/ui/open-2.mp3',
      category: 'sfx',
      normalizedGain: 1,
      defaultGain: 1
    });
    expect(registry.require('ui/open-2').category).toBe('ui');
  });

  it('registers the victory fanfare on the ui bus', () => {
    const context = new FakeAudioContext();
    const audioApi: AudioApi = {
      createContext(): AudioContextLike {
        return context;
      },
      async fetchArrayBuffer(): Promise<ArrayBuffer> {
        return createArrayBuffer(4);
      }
    };

    const registry = createSampleRegistry({
      audioApi,
      context
    });

    expect(registry.require('ui/fanfare')).toEqual({
      id: 'ui/fanfare',
      url: '/sfx/ui/fanfare.mp3',
      category: 'ui',
      normalizedGain: 1,
      defaultGain: 1
    });
  });

  it('registers pet rescue samples on the sfx bus', () => {
    const context = new FakeAudioContext();
    const audioApi: AudioApi = {
      createContext(): AudioContextLike {
        return context;
      },
      async fetchArrayBuffer(): Promise<ArrayBuffer> {
        return createArrayBuffer(4);
      }
    };

    const registry = createSampleRegistry({
      audioApi,
      context
    });

    expect(registry.require('pets/shuffle')).toEqual({
      id: 'pets/shuffle',
      url: '/sfx/pets/shuffle.mp3',
      category: 'sfx',
      normalizedGain: 1,
      defaultGain: 1
    });
  });

  it('normalizes public music folder tracks with explicit per-file overrides', () => {
    const musicFolderEntries = DEFAULT_SAMPLE_ENTRIES.filter((entry) => entry.id.startsWith('music/'));
    const defaultNormalizedEntries = musicFolderEntries.filter(
      (entry) => entry.id !== 'music/digital-dawn'
    );

    expect(musicFolderEntries).not.toHaveLength(0);
    expect(defaultNormalizedEntries.every((entry) => entry.normalizedGain === 1.6)).toBe(true);
    expect(DEFAULT_SAMPLE_ENTRIES.find((entry) => entry.id === 'music/digital-dawn')?.normalizedGain).toBe(0.55);
    expect(DEFAULT_SAMPLE_ENTRIES.find((entry) => entry.id === 'boss/boss-music')?.normalizedGain).toBe(1);
  });

  it('decodes lazily and caches decoded buffers per sample id', async () => {
    const context = new FakeAudioContext();
    const fetched = vi.fn(async () => createArrayBuffer(16));
    const audioApi: AudioApi = {
      createContext(): AudioContextLike {
        return context;
      },
      fetchArrayBuffer: fetched
    };

    const registry = createSampleRegistry({
      audioApi,
      context,
      entries: [
        {
          id: 'lazy',
          url: '/lazy.mp3',
          category: 'sfx',
          normalizedGain: 1,
          defaultGain: 1
        }
      ]
    });

    expect(fetched).not.toHaveBeenCalled();

    const firstBuffer = registry.decode('lazy');
    const secondBuffer = registry.decode('lazy');
    const [firstDecoded, secondDecoded] = await Promise.all([firstBuffer, secondBuffer]);

    expect(fetched).toHaveBeenCalledTimes(1);
    expect(context.decodeCalls).toBe(1);
    expect(firstDecoded).toBe(secondDecoded);
  });

  it('warns once and caches null when sample loading fails', async () => {
    const context = new FakeAudioContext();
    const log = createLogHarness();
    const audioApi: AudioApi = {
      createContext(): AudioContextLike {
        return context;
      },
      async fetchArrayBuffer(): Promise<ArrayBuffer> {
        throw new Error('404');
      }
    };

    const registry = createSampleRegistry({
      audioApi,
      context,
      log,
      entries: [
        {
          id: 'missing',
          url: '/missing.mp3',
          category: 'ui',
          normalizedGain: 1,
          defaultGain: 1
        }
      ]
    });

    expect(await registry.decode('missing')).toBeNull();
    expect(await registry.decode('missing')).toBeNull();
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(context.decodeCalls).toBe(0);
  });
});
