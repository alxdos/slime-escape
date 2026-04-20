export type AudioContextStateLike = 'suspended' | 'running' | 'closed' | 'interrupted';

export type AudioParamLike = {
  value: number;
};

export type AudioConnectable = object;

export type AudioNodeLike = Readonly<{
  connect(destination: AudioConnectable): void;
  disconnect(): void;
}>;

export type AudioGainNodeLike = AudioNodeLike &
  Readonly<{
    gain: AudioParamLike;
  }>;

export type AudioDestinationNodeLike = object;

export type AudioBufferLike = object;

export type AudioBufferSourceNodeLike = AudioNodeLike & {
  buffer: AudioBufferLike | null;
  loop: boolean;
  onended: ((event: Event) => unknown) | null;
  start(when?: number): void;
  stop(when?: number): void;
};

export type AudioContextLike = Readonly<{
  state: AudioContextStateLike;
  currentTime: number;
  destination: AudioDestinationNodeLike;
  createGain(): AudioGainNodeLike;
  createBufferSource(): AudioBufferSourceNodeLike;
  decodeAudioData(audioData: ArrayBuffer): Promise<AudioBufferLike>;
  resume(): Promise<void>;
  close(): Promise<void>;
}>;

export type AudioApi = Readonly<{
  createContext(): AudioContextLike;
  fetchArrayBuffer(url: string): Promise<ArrayBuffer>;
}>;

type AudioContextCtor = new () => AudioContext;

export function createBrowserAudioApi(): AudioApi {
  return {
    createContext(): AudioContextLike {
      const AudioContextCtor = resolveAudioContextCtor();
      if (AudioContextCtor === null) {
        throw new Error('Web Audio API is not supported in this environment');
      }
      return new AudioContextCtor();
    },
    async fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`failed to fetch audio sample: ${response.status} ${response.statusText}`);
      }
      return response.arrayBuffer();
    }
  };
}

function resolveAudioContextCtor(): AudioContextCtor | null {
  const scope = globalThis as Partial<{
    AudioContext: AudioContextCtor;
    webkitAudioContext: AudioContextCtor;
  }>;

  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}
