import type { RuntimeEvent } from '../../shared/events';
import { log as defaultLog, type Log } from '../../shared/log';
import type { SessionDefinition } from '../../shared/session';
import type { EncounterSnapshot } from '../../shared/snapshot';
import type { SnapshotPair } from '../sim/SimWorkerHost';
import type { UiShellPhase } from '../ui/UiShell';

import {
  createBrowserAudioApi,
  type AudioApi,
  type AudioContextLike,
  type AudioGainNodeLike
} from './AudioApi';
import {
  createSampleRegistry,
  type SampleCategory,
  type SampleRegistry
} from './SampleRegistry';
import { createAudioMappings, type AudioMappings } from './AudioMappings';

export type AudioBusId = SampleCategory;

export type AudioUiEventId = 'overlayShow' | 'buttonClick';

export type AudioInit = Readonly<{
  audioApi?: AudioApi;
  log?: Log;
}>;

export type Audio = Readonly<{
  unlock(): void;
  handleEvent(event: RuntimeEvent): void;
  update(snapshotPair: SnapshotPair, phase: UiShellPhase, encounter: EncounterSnapshot | null): void;
  attach(session: SessionDefinition): void;
  detach(): void;
  playUi(eventId: AudioUiEventId): void;
  dispose(): void;
}>;

type AudioRuntime = Readonly<{
  context: AudioContextLike;
  masterGain: AudioGainNodeLike;
  busGains: Readonly<Record<AudioBusId, AudioGainNodeLike>>;
}>;

const DEFAULT_GAIN = 1;

export function createAudio(init: AudioInit = {}): Audio {
  const audioLog = init.log ?? defaultLog;
  const audioApi = init.audioApi ?? createBrowserAudioApi();

  let runtime: AudioRuntime | null = null;
  try {
    runtime = createAudioRuntime(audioApi);
  } catch (error) {
    audioLog.warn('audio disabled: failed to initialize audio context', {
      error: formatError(error)
    });
  }
  const sampleRegistry: SampleRegistry | null =
    runtime === null
      ? null
      : createSampleRegistry({
          audioApi,
          context: runtime.context,
          log: audioLog
        });
  const audioMappings: AudioMappings | null =
    sampleRegistry === null
      ? null
      : createAudioMappings({
          sampleRegistry,
          log: audioLog
        });

  let attachedSession: SessionDefinition | null = null;
  let unlockInFlight: Promise<void> | null = null;
  let warnedBeforeUnlock = false;
  let disposed = false;

  function canPlay(reason: string): boolean {
    if (runtime === null || disposed) {
      return false;
    }

    if (runtime.context.state === 'running') {
      return true;
    }

    if (!warnedBeforeUnlock) {
      warnedBeforeUnlock = true;
      audioLog.warn('audio skipped before unlock', { reason });
    }
    return false;
  }

  return {
    unlock(): void {
      if (runtime === null || disposed) {
        return;
      }
      if (runtime.context.state === 'running' || unlockInFlight !== null) {
        return;
      }

      unlockInFlight = runtime.context
        .resume()
        .catch((error: unknown) => {
          audioLog.warn('audio unlock failed', {
            error: formatError(error)
          });
        })
        .finally(() => {
          unlockInFlight = null;
        });
    },
    handleEvent(event): void {
      if (!canPlay(`event:${event.kind}`)) {
        return;
      }
    },
    update(_snapshotPair, phase, _encounter): void {
      if (phase.kind === 'menu' || phase.kind === 'result') {
        return;
      }
      if (!canPlay(`phase:${phase.kind}`)) {
        return;
      }
    },
    attach(session): void {
      attachedSession = session;
    },
    detach(): void {
      attachedSession = null;
    },
    playUi(eventId): void {
      if (!canPlay(`ui:${eventId}`)) {
        return;
      }
      const sampleId = audioMappings?.resolveUiSample(eventId) ?? null;
      if (sampleId === null) {
        return;
      }
    },
    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      attachedSession = null;

      if (runtime === null) {
        return;
      }

      for (const busGain of Object.values(runtime.busGains)) {
        busGain.disconnect();
      }
      runtime.masterGain.disconnect();

      void runtime.context.close().catch((error: unknown) => {
        audioLog.warn('audio context close failed', {
          error: formatError(error)
        });
      });
    }
  };
}

function createAudioRuntime(audioApi: AudioApi): AudioRuntime {
  const context = audioApi.createContext();
  const masterGain = context.createGain();
  masterGain.gain.value = DEFAULT_GAIN;

  const busGains: Readonly<Record<AudioBusId, AudioGainNodeLike>> = {
    sfx: createBusGain(context, masterGain),
    music: createBusGain(context, masterGain),
    ui: createBusGain(context, masterGain)
  };

  masterGain.connect(context.destination);

  return {
    context,
    masterGain,
    busGains
  };
}

function createBusGain(
  context: AudioContextLike,
  masterGain: AudioGainNodeLike
): AudioGainNodeLike {
  const gainNode = context.createGain();
  gainNode.gain.value = DEFAULT_GAIN;
  gainNode.connect(masterGain);
  return gainNode;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
