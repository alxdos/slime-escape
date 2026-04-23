import type { RuntimeEvent } from '../../shared/events';
import { log as defaultLog, type Log } from '../../shared/log';
import { assertNever } from '../../shared/protocol';
import type { SessionDefinition } from '../../shared/session';
import type {
  BossSnapshot,
  EncounterSnapshot,
  EntitySnapshot,
  Snapshot
} from '../../shared/snapshot';
import type { SnapshotPair } from '../sim/SimWorkerHost';
import type { UiShellPhase } from '../ui/UiShellPhase';

import {
  createBrowserAudioApi,
  type AudioApi,
  type AudioBufferSourceNodeLike,
  type AudioContextLike,
  type AudioGainNodeLike
} from './AudioApi';
import type { AudioUiEventId } from './AudioUiEventId';
import {
  createSampleRegistry,
  type SampleCategory,
  type SampleEntry,
  type SampleRegistry
} from './SampleRegistry';
import {
  createAudioMappings,
  resolveBossArchetypeIdFromSession,
  type AudioMappings
} from './AudioMappings';

export type AudioBusId = SampleCategory;
export type { AudioUiEventId } from './AudioUiEventId';

export type AudioInit = Readonly<{
  audioApi?: AudioApi;
  log?: Log;
  random?: () => number;
}>;

export type Audio = Readonly<{
  unlock(): void;
  handleEvent(event: RuntimeEvent): void;
  update(snapshotPair: SnapshotPair, phase: UiShellPhase, encounter: EncounterSnapshot | null): void;
  attach(session: SessionDefinition): void;
  detach(): void;
  playUi(eventId: AudioUiEventId): void;
  setMasterGain(value: number): void;
  dispose(): void;
}>;

type AudioRuntime = Readonly<{
  context: AudioContextLike;
  masterGain: AudioGainNodeLike;
  musicDuckGain: AudioGainNodeLike;
  busGains: Readonly<Record<AudioBusId, AudioGainNodeLike>>;
}>;

type PlaybackDependencies = Readonly<{
  runtime: AudioRuntime;
  sampleRegistry: SampleRegistry;
  audioMappings: AudioMappings;
}>;

type ActiveOneShotPlayback = Readonly<{
  startedAt: number;
  source: AudioBufferSourceNodeLike;
  trimGain: AudioGainNodeLike;
}>;

type ActiveMusicPlayback = Readonly<{
  sampleId: string;
  source: AudioBufferSourceNodeLike;
  trimGain: AudioGainNodeLike;
}>;

const DEFAULT_GAIN = 1;
const MIN_MASTER_GAIN = 0;
const MAX_MASTER_GAIN = 1;
const MAX_ACTIVE_ONE_SHOTS = 32;
const PAUSED_MUSIC_DUCK_GAIN = 0.5;
const REGULAR_MUSIC_POOL = Object.freeze([
  'music/100-waves',
  'music/101-clock-ticking',
  'music/001-calm',
  'music/005-forest',
  'music/007-nature',
  'music/009-windy-forest'
]);
const BOSS_MUSIC_SAMPLE_ID = 'boss/boss-music';

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
          log: audioLog,
          random: init.random
        });

  let attachedSession: SessionDefinition | null = null;
  let latestSnapshot: Snapshot | null = null;
  let unlockInFlight: Promise<void> | null = null;
  let warnedBeforeUnlock = false;
  let disposed = false;
  const activeOneShots: ActiveOneShotPlayback[] = [];
  let activeMusic: ActiveMusicPlayback | null = null;
  let musicRequestToken = 0;
  let lastRegularMusicSampleId: string | null = null;
  const enemyVoiceTimers = new Map<number, number>();

  function getPlaybackDependencies(): PlaybackDependencies | null {
    if (runtime === null || sampleRegistry === null || audioMappings === null || disposed) {
      return null;
    }
    return {
      runtime,
      sampleRegistry,
      audioMappings
    };
  }

  function canPlay(reason: string): boolean {
    const dependencies = getPlaybackDependencies();
    if (dependencies === null) {
      return false;
    }

    if (dependencies.runtime.context.state === 'running') {
      return true;
    }

    if (!warnedBeforeUnlock) {
      warnedBeforeUnlock = true;
      audioLog.warn('audio skipped before unlock', { reason });
    }
    return false;
  }

  function removeTrackedPlayback(playback: ActiveOneShotPlayback): void {
    const index = activeOneShots.indexOf(playback);
    if (index >= 0) {
      activeOneShots.splice(index, 1);
    }
  }

  function disconnectPlayback(playback: ActiveOneShotPlayback): void {
    playback.source.disconnect();
    playback.trimGain.disconnect();
  }

  function trackOneShotPlayback(playback: ActiveOneShotPlayback): void {
    activeOneShots.push(playback);
    playback.source.onended = () => {
      removeTrackedPlayback(playback);
      disconnectPlayback(playback);
    };
  }

  function dropOldestOneShotIfNeeded(): void {
    if (activeOneShots.length < MAX_ACTIVE_ONE_SHOTS) {
      return;
    }

    const oldestPlayback = activeOneShots.shift();
    if (oldestPlayback === undefined) {
      return;
    }

    oldestPlayback.source.onended = null;
    stopSourceSafely(oldestPlayback.source, 'overflow-eviction');
    disconnectPlayback(oldestPlayback);
  }

  function playSampleById(sampleId: string, perCallGainMul = 1): void {
    const dependencies = getPlaybackDependencies();
    if (dependencies === null) {
      return;
    }

    const sample = dependencies.sampleRegistry.require(sampleId);
    void dependencies.sampleRegistry.decode(sampleId).then((buffer) => {
      const readyDependencies = getPlaybackDependencies();
      if (buffer === null || readyDependencies === null) {
        return;
      }

      dropOldestOneShotIfNeeded();

      const source = readyDependencies.runtime.context.createBufferSource();
      source.buffer = buffer;
      source.loop = sample.loop ?? false;

      const trimGain = readyDependencies.runtime.context.createGain();
      trimGain.gain.value = calculateEffectiveGain(sample, {
        perCallGainMul
      });

      source.connect(trimGain);
      trimGain.connect(readyDependencies.runtime.busGains[sample.category]);

      const playback: ActiveOneShotPlayback = {
        startedAt: readyDependencies.runtime.context.currentTime,
        source,
        trimGain
      };

      trackOneShotPlayback(playback);
      source.start();
    });
  }

  function disconnectMusicPlayback(playback: ActiveMusicPlayback): void {
    playback.source.disconnect();
    playback.trimGain.disconnect();
  }

  function stopMusicPlayback(): void {
    musicRequestToken += 1;
    const playback = activeMusic;
    activeMusic = null;
    if (playback === null) {
      return;
    }
    playback.source.onended = null;
    stopSourceSafely(playback.source, 'music-stop');
    disconnectMusicPlayback(playback);
  }

  function stopSourceSafely(
    source: AudioBufferSourceNodeLike,
    warningContext: 'dispose' | 'music-stop' | 'overflow-eviction'
  ): void {
    try {
      source.stop();
    } catch (error) {
      audioLog.warn('audio source stop failed', {
        context: warningContext,
        error: formatError(error)
      });
    }
  }

  function startMusicSample(sampleId: string): void {
    const dependencies = getPlaybackDependencies();
    if (dependencies === null) {
      return;
    }

    if (activeMusic?.sampleId === sampleId) {
      return;
    }

    stopMusicPlayback();
    const requestToken = musicRequestToken + 1;
    musicRequestToken = requestToken;

    const sample = dependencies.sampleRegistry.require(sampleId);
    void dependencies.sampleRegistry.decode(sampleId).then((buffer) => {
      const readyDependencies = getPlaybackDependencies();
      if (
        buffer === null ||
        readyDependencies === null ||
        requestToken !== musicRequestToken ||
        disposed
      ) {
        return;
      }

      const source = readyDependencies.runtime.context.createBufferSource();
      source.buffer = buffer;
      source.loop = sample.loop ?? false;

      const trimGain = readyDependencies.runtime.context.createGain();
      trimGain.gain.value = calculateEffectiveGain(sample, {});

      source.connect(trimGain);
      trimGain.connect(readyDependencies.runtime.busGains[sample.category]);

      const playback: ActiveMusicPlayback = {
        sampleId,
        source,
        trimGain
      };
      activeMusic = playback;
      source.onended = () => {
        if (activeMusic === playback) {
          activeMusic = null;
          if (REGULAR_MUSIC_POOL.includes(playback.sampleId)) {
            lastRegularMusicSampleId = playback.sampleId;
          }
        }
        disconnectMusicPlayback(playback);
      };
      source.start();
    });
  }

  function pickNextRegularMusicSampleId(): string {
    const random = init.random ?? Math.random;
    const rawIndex = Math.floor(Math.min(0.999999, Math.max(0, random())) * REGULAR_MUSIC_POOL.length);
    const candidate = REGULAR_MUSIC_POOL[rawIndex] ?? REGULAR_MUSIC_POOL[0];
    if (
      candidate !== undefined &&
      candidate === lastRegularMusicSampleId &&
      REGULAR_MUSIC_POOL.length > 1
    ) {
      const candidateIndex = REGULAR_MUSIC_POOL.indexOf(candidate);
      return REGULAR_MUSIC_POOL[(candidateIndex + 1) % REGULAR_MUSIC_POOL.length] ?? candidate;
    }
    return candidate ?? BOSS_MUSIC_SAMPLE_ID;
  }

  function syncMusicForPhase(phase: UiShellPhase): void {
    const dependencies = getPlaybackDependencies();
    if (dependencies === null) {
      return;
    }

    dependencies.runtime.musicDuckGain.gain.value =
      phase.kind === 'paused' ? PAUSED_MUSIC_DUCK_GAIN : DEFAULT_GAIN;

    if (phase.kind === 'menu' || phase.kind === 'result' || phase.kind === 'loading' || phase.kind === 'error') {
      stopMusicPlayback();
      return;
    }

    const desiredMusicSampleId =
      latestSnapshot?.encounter?.type === 'boss' ? BOSS_MUSIC_SAMPLE_ID : null;

    if (desiredMusicSampleId !== null) {
      startMusicSample(desiredMusicSampleId);
      return;
    }

    if (activeMusic !== null && REGULAR_MUSIC_POOL.includes(activeMusic.sampleId)) {
      return;
    }

    startMusicSample(pickNextRegularMusicSampleId());
  }

  function nextRandomFloat(): number {
    const random = init.random ?? Math.random;
    return Math.min(0.999999, Math.max(0, random()));
  }

  function randomBetween(min: number, max: number): number {
    return min + nextRandomFloat() * (max - min);
  }

  function syncEnemyAmbient(snapshotPair: SnapshotPair, phase: UiShellPhase): void {
    if (phase.kind !== 'running') {
      return;
    }

    const dependencies = getPlaybackDependencies();
    const snapshot = snapshotPair.curr;
    if (dependencies === null || snapshot === null) {
      return;
    }

    const liveEnemyIds = new Set<number>();
    for (const entity of snapshot.entities) {
      if (entity.kind !== 'enemy') {
        continue;
      }

      liveEnemyIds.add(entity.id);
      const voiceSpec = dependencies.audioMappings.resolveEnemyVoice(entity.archetypeId);
      if (voiceSpec === null) {
        continue;
      }

      const scheduledAt = enemyVoiceTimers.get(entity.id);
      if (scheduledAt === undefined) {
        enemyVoiceTimers.set(
          entity.id,
          snapshotPair.nowMs + randomBetween(voiceSpec.intervalMinMs, voiceSpec.intervalMaxMs)
        );
        continue;
      }

      if (snapshotPair.nowMs < scheduledAt) {
        continue;
      }

      const sampleIndex = Math.floor(nextRandomFloat() * voiceSpec.sampleIds.length);
      const sampleId = voiceSpec.sampleIds[sampleIndex];
      if (sampleId !== undefined) {
        playSampleById(sampleId);
      }

      enemyVoiceTimers.set(
        entity.id,
        snapshotPair.nowMs + randomBetween(voiceSpec.intervalMinMs, voiceSpec.intervalMaxMs)
      );
    }

    for (const entityId of Array.from(enemyVoiceTimers.keys())) {
      if (!liveEnemyIds.has(entityId)) {
        enemyVoiceTimers.delete(entityId);
      }
    }
  }

  function resolveEntity(targetId: number): EntitySnapshot | null {
    return latestSnapshot?.entities.find((entity) => entity.id === targetId) ?? null;
  }

  function resolveBossArchetypeId(entityId: number | null = null): string | null {
    const bossEntity =
      entityId === null
        ? latestSnapshot?.entities.find((entity): entity is BossSnapshot => entity.kind === 'boss') ?? null
        : latestSnapshot?.entities.find(
            (entity): entity is BossSnapshot => entity.kind === 'boss' && entity.id === entityId
          ) ?? null;

    if (bossEntity !== null) {
      return bossEntity.archetypeId;
    }

    if (attachedSession === null) {
      return null;
    }

    return resolveBossArchetypeIdFromSession(
      latestSnapshot?.encounter?.index ?? null,
      attachedSession.encounters
    );
  }

  function playRoutedEventSample(event: RuntimeEvent): void {
    const dependencies = getPlaybackDependencies();
    if (dependencies === null) {
      return;
    }

    switch (event.kind) {
      case 'fire': {
        let sampleId: string | null;
        if (event.ownerKind === 'boss') {
          const bossArchetypeId = resolveBossArchetypeId(event.shooterId);
          sampleId =
            bossArchetypeId === null
              ? null
              : dependencies.audioMappings.resolveBossSample('fire', bossArchetypeId);
        } else {
          sampleId = dependencies.audioMappings.resolveWeaponFire(event.weaponArchetypeId);
        }
        if (sampleId !== null) {
          playSampleById(sampleId);
        }
        return;
      }
      case 'hit': {
        if (event.targetKind === 'player') {
          return;
        }
        const target = resolveEntity(event.targetId);
        if (target?.kind === 'enemy') {
          const sampleId = dependencies.audioMappings.resolveEnemySample('hit', target.archetypeId);
          if (sampleId !== null) {
            playSampleById(sampleId);
          }
          return;
        }
        if (target?.kind === 'boss') {
          const sampleId = dependencies.audioMappings.resolveBossSample('hit', target.archetypeId);
          if (sampleId !== null) {
            playSampleById(sampleId);
          }
        }
        return;
      }
      case 'death': {
        if (event.entityKind === 'player') {
          return;
        }

        const target = resolveEntity(event.entityId);
        if (target?.kind === 'enemy') {
          const sampleId = dependencies.audioMappings.resolveEnemySample(
            'death',
            target.archetypeId
          );
          if (sampleId !== null) {
            playSampleById(sampleId);
          }
          return;
        }
        if (target?.kind === 'boss') {
          const sampleId = dependencies.audioMappings.resolveBossSample(
            'death',
            target.archetypeId
          );
          if (sampleId !== null) {
            playSampleById(sampleId);
          }
          return;
        }
        if (event.archetypeId !== null) {
          const sampleId =
            event.entityKind === 'boss'
              ? dependencies.audioMappings.resolveBossSample('death', event.archetypeId)
              : dependencies.audioMappings.resolveEnemySample('death', event.archetypeId);
          if (sampleId !== null) {
            playSampleById(sampleId);
          }
        }
        return;
      }
      case 'dropPickup': {
        const sampleId = dependencies.audioMappings.resolveEventSample('dropPickup');
        if (sampleId !== null) {
          playSampleById(sampleId);
        }
        return;
      }
      case 'bossPhaseChange': {
        const bossArchetypeId = resolveBossArchetypeId(event.bossId);
        if (bossArchetypeId === null) {
          return;
        }
        const sampleId = dependencies.audioMappings.resolveBossSample(
          'phaseChange',
          bossArchetypeId
        );
        if (sampleId !== null) {
          playSampleById(sampleId);
        }
        return;
      }
      case 'sessionStart':
      case 'sessionStop':
      case 'encounterStart':
      case 'encounterEnd':
      case 'pause':
      case 'resume':
      case 'win':
      case 'loss':
      case 'dropSpawn':
      case 'dropExpire':
        return;
      default:
        assertNever(event);
    }
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
      playRoutedEventSample(event);
    },
    update(snapshotPair, phase, _encounter): void {
      latestSnapshot = snapshotPair.curr;
      if (
        phase.kind === 'menu' ||
        phase.kind === 'result' ||
        phase.kind === 'loading' ||
        phase.kind === 'error'
      ) {
        syncMusicForPhase(phase);
        return;
      }
      if (!canPlay(`phase:${phase.kind}`)) {
        return;
      }
      syncMusicForPhase(phase);
      syncEnemyAmbient(snapshotPair, phase);
    },
    attach(session): void {
      attachedSession = session;
    },
    detach(): void {
      attachedSession = null;
      latestSnapshot = null;
      enemyVoiceTimers.clear();
      stopMusicPlayback();
    },
    playUi(eventId): void {
      if (!canPlay(`ui:${eventId}`)) {
        return;
      }

      const dependencies = getPlaybackDependencies();
      if (dependencies === null) {
        return;
      }

      const sampleId = dependencies.audioMappings.resolveUiSample(eventId);
      if (sampleId !== null) {
        playSampleById(sampleId);
      }
    },
    setMasterGain(value): void {
      if (runtime === null || disposed) {
        return;
      }
      const nextMasterGain = normalizeMasterGain(value, runtime.masterGain.gain.value, audioLog);
      if (runtime.masterGain.gain.value === nextMasterGain) {
        return;
      }
      runtime.masterGain.gain.value = nextMasterGain;
    },
    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      attachedSession = null;
      latestSnapshot = null;
      enemyVoiceTimers.clear();

      if (runtime === null) {
        return;
      }

      while (activeOneShots.length > 0) {
        const playback = activeOneShots.pop();
        if (playback === undefined) {
          continue;
        }
        playback.source.onended = null;
        stopSourceSafely(playback.source, 'dispose');
        disconnectPlayback(playback);
      }

      stopMusicPlayback();

      for (const busGain of Object.values(runtime.busGains)) {
        busGain.disconnect();
      }
      runtime.musicDuckGain.disconnect();
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
  const sfxGain = context.createGain();
  sfxGain.gain.value = DEFAULT_GAIN;
  const musicGain = context.createGain();
  musicGain.gain.value = DEFAULT_GAIN;
  const uiGain = context.createGain();
  uiGain.gain.value = DEFAULT_GAIN;
  const musicDuckGain = context.createGain();
  musicDuckGain.gain.value = DEFAULT_GAIN;

  masterGain.connect(context.destination);
  sfxGain.connect(masterGain);
  musicGain.connect(musicDuckGain);
  uiGain.connect(masterGain);
  musicDuckGain.connect(masterGain);

  const busGains: Readonly<Record<AudioBusId, AudioGainNodeLike>> = {
    sfx: sfxGain,
    music: musicGain,
    ui: uiGain
  };

  return {
    context,
    masterGain,
    musicDuckGain,
    busGains
  };
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function normalizeMasterGain(value: number, currentValue: number, audioLog: Log): number {
  if (Number.isNaN(value)) {
    audioLog.warn('audio master gain is not a number; keeping current value', {
      value,
      currentValue
    });
    return currentValue;
  }

  if (value >= MIN_MASTER_GAIN && value <= MAX_MASTER_GAIN) {
    return value;
  }

  const clampedValue = Math.min(MAX_MASTER_GAIN, Math.max(MIN_MASTER_GAIN, value));
  audioLog.warn('audio master gain clamped to [0, 1]', {
    value,
    clampedValue
  });
  return clampedValue;
}

export function calculateEffectiveGain(
  sample: Pick<SampleEntry, 'normalizedGain' | 'defaultGain'>,
  init: Readonly<{
    perCallGainMul?: number;
  }>
): number {
  return sample.normalizedGain * sample.defaultGain * (init.perCallGainMul ?? 1);
}
