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

export type AudioContextLike = Readonly<{
  state: AudioContextStateLike;
  currentTime: number;
  destination: AudioDestinationNodeLike;
  createGain(): AudioGainNodeLike;
  resume(): Promise<void>;
  close(): Promise<void>;
}>;

export type AudioApi = Readonly<{
  createContext(): AudioContextLike;
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
