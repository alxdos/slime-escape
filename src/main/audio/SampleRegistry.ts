import { log as defaultLog, type Log } from '../../shared/log';

import type { AudioApi, AudioBufferLike, AudioContextLike } from './AudioApi';

export type SampleCategory = 'sfx' | 'music' | 'ui';

export type SampleEntry = Readonly<{
  id: string;
  url: string;
  category: SampleCategory;
  normalizedGain: number;
  defaultGain: number;
  loop?: boolean;
}>;

export type SampleRegistryInit = Readonly<{
  audioApi: AudioApi;
  context: AudioContextLike;
  log?: Log;
  entries?: ReadonlyArray<SampleEntry>;
}>;

export type SampleRegistry = Readonly<{
  all(): ReadonlyArray<SampleEntry>;
  get(sampleId: string): SampleEntry | null;
  require(sampleId: string): SampleEntry;
  decode(sampleId: string): Promise<AudioBufferLike | null>;
}>;

const MAX_GAIN = 2;
const MIN_NORMALIZED_GAIN = 0.0001;

export const DEFAULT_SAMPLE_ENTRIES: ReadonlyArray<SampleEntry> = Object.freeze([
  {
    id: 'weapons/pistol',
    url: '/sfx/weapons/pistol.mp3',
    category: 'sfx',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'weapons/shotgun',
    url: '/sfx/weapons/shotgun.mp3',
    category: 'sfx',
    normalizedGain: 0.35,
    defaultGain: 1
  },
  {
    id: 'weapons/smg',
    url: '/sfx/weapons/smg.mp3',
    category: 'sfx',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'weapons/sniper',
    url: '/sfx/weapons/sniper.mp3',
    category: 'sfx',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'weapons/laser',
    url: '/sfx/weapons/laser.mp3',
    category: 'sfx',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'slimes/hit-1',
    url: '/sfx/slimes/slime-1.mp3',
    category: 'sfx',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'slimes/hit-2',
    url: '/sfx/slimes/slime-2.mp3',
    category: 'sfx',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'slimes/hit-3',
    url: '/sfx/slimes/slime-3.mp3',
    category: 'sfx',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'slimes/hit-4',
    url: '/sfx/slimes/slime-4.mp3',
    category: 'sfx',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'slimes/death-1',
    url: '/sfx/slimes/slime-1.mp3',
    category: 'sfx',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'slimes/death-2',
    url: '/sfx/slimes/slime-2.mp3',
    category: 'sfx',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'slimes/death-3',
    url: '/sfx/slimes/slime-3.mp3',
    category: 'sfx',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'slimes/death-4',
    url: '/sfx/slimes/slime-4.mp3',
    category: 'sfx',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'slimes/voice-1',
    url: '/sfx/slimes/slime-1.mp3',
    category: 'sfx',
    normalizedGain: 1,
    defaultGain: 0.3
  },
  {
    id: 'slimes/voice-2',
    url: '/sfx/slimes/slime-2.mp3',
    category: 'sfx',
    normalizedGain: 1,
    defaultGain: 0.3
  },
  {
    id: 'slimes/voice-3',
    url: '/sfx/slimes/slime-3.mp3',
    category: 'sfx',
    normalizedGain: 1,
    defaultGain: 0.3
  },
  {
    id: 'slimes/voice-4',
    url: '/sfx/slimes/slime-4.mp3',
    category: 'sfx',
    normalizedGain: 1,
    defaultGain: 0.3
  },
  {
    id: 'boss/boss-fireball',
    url: '/sfx/boss/boss-fireball.mp3',
    category: 'sfx',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'boss/boss-ahaha',
    url: '/sfx/boss/boss-ahaha.mp3',
    category: 'sfx',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'boss/boss-music',
    url: '/sfx/boss/boss-music.mp3',
    category: 'music',
    normalizedGain: 1,
    defaultGain: 1,
    loop: true
  },
  {
    id: 'music/100-waves',
    url: '/sfx/music/100-waves.mp3',
    category: 'music',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'music/101-clock-ticking',
    url: '/sfx/music/101-clock-ticking.mp3',
    category: 'music',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'music/001-calm',
    url: '/sfx/music/001-calm.mp3',
    category: 'music',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'music/005-forest',
    url: '/sfx/music/005-forest.mp3',
    category: 'music',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'music/007-nature',
    url: '/sfx/music/007-nature.mp3',
    category: 'music',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'music/009-windy-forest',
    url: '/sfx/music/009-windy-forest.mp3',
    category: 'music',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'events/explosion',
    url: '/sfx/boss/boss-fireball.mp3',
    category: 'sfx',
    normalizedGain: 0.6,
    defaultGain: 1
  },
  {
    id: 'events/drop-pickup',
    url: '/sfx/ui/open-2.mp3',
    category: 'sfx',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'ui/open-1',
    url: '/sfx/ui/open-1.mp3',
    category: 'ui',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'ui/open-2',
    url: '/sfx/ui/open-2.mp3',
    category: 'ui',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'ui/switch-1',
    url: '/sfx/ui/switch-1.mp3',
    category: 'ui',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'ui/switch-2',
    url: '/sfx/ui/switch-2.mp3',
    category: 'ui',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'ui/switch-3',
    url: '/sfx/ui/switch-3.mp3',
    category: 'ui',
    normalizedGain: 1,
    defaultGain: 1
  },
  {
    id: 'ui/switch-4',
    url: '/sfx/ui/switch-4.mp3',
    category: 'ui',
    normalizedGain: 1,
    defaultGain: 1
  }
]);

export function createSampleRegistry(init: SampleRegistryInit): SampleRegistry {
  const audioLog = init.log ?? defaultLog;
  const entries = validateSampleEntries(init.entries ?? DEFAULT_SAMPLE_ENTRIES, audioLog);
  const entriesById = buildEntriesById(entries);
  const decodeCache = new Map<string, Promise<AudioBufferLike | null>>();

  return {
    all(): ReadonlyArray<SampleEntry> {
      return entries;
    },
    get(sampleId: string): SampleEntry | null {
      return entriesById[sampleId] ?? null;
    },
    require(sampleId: string): SampleEntry {
      const entry = entriesById[sampleId];
      if (entry === undefined) {
        throw new Error(`audio sample "${sampleId}" is missing from the registry`);
      }
      return entry;
    },
    decode(sampleId: string): Promise<AudioBufferLike | null> {
      const cached = decodeCache.get(sampleId);
      if (cached !== undefined) {
        return cached;
      }

      const entry = entriesById[sampleId];
      if (entry === undefined) {
        throw new Error(`audio sample "${sampleId}" is missing from the registry`);
      }

      const decodePromise = init.audioApi
        .fetchArrayBuffer(entry.url)
        .then((audioData) => init.context.decodeAudioData(audioData))
        .catch((error: unknown) => {
          audioLog.warn('audio sample failed to load', {
            sampleId: entry.id,
            url: entry.url,
            error: formatError(error)
          });
          return null;
        });

      decodeCache.set(sampleId, decodePromise);
      return decodePromise;
    }
  };
}

function validateSampleEntries(
  entries: ReadonlyArray<SampleEntry>,
  audioLog: Log
): ReadonlyArray<SampleEntry> {
  const seenIds = new Set<string>();
  const sanitizedEntries: SampleEntry[] = [];

  for (const entry of entries) {
    if (seenIds.has(entry.id)) {
      throw new Error(`audio sample registry contains duplicate id "${entry.id}"`);
    }
    seenIds.add(entry.id);

    sanitizedEntries.push(
      Object.freeze({
        ...entry,
        normalizedGain: clampGain({
          value: entry.normalizedGain,
          min: MIN_NORMALIZED_GAIN,
          max: MAX_GAIN,
          sampleId: entry.id,
          field: 'normalizedGain',
          audioLog
        }),
        defaultGain: clampGain({
          value: entry.defaultGain,
          min: 0,
          max: MAX_GAIN,
          sampleId: entry.id,
          field: 'defaultGain',
          audioLog
        })
      })
    );
  }

  return Object.freeze(sanitizedEntries);
}

function buildEntriesById(
  entries: ReadonlyArray<SampleEntry>
): Readonly<Record<string, SampleEntry>> {
  const entriesById: Record<string, SampleEntry> = {};
  for (const entry of entries) {
    entriesById[entry.id] = entry;
  }
  return Object.freeze(entriesById);
}

function clampGain(init: Readonly<{
  value: number;
  min: number;
  max: number;
  sampleId: string;
  field: 'normalizedGain' | 'defaultGain';
  audioLog: Log;
}>): number {
  if (init.value >= init.min && init.value <= init.max) {
    return init.value;
  }

  const clampedValue = Math.min(init.max, Math.max(init.min, init.value));
  init.audioLog.warn('audio sample gain clamped to design/audio.md range', {
    sampleId: init.sampleId,
    field: init.field,
    value: init.value,
    clampedValue
  });
  return clampedValue;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
