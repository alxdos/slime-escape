import { log as defaultLog, type Log } from '../../shared/log';

import { createBrowserStorageApi, type StorageApi } from './ClientSettingsStore';

export type DungeonBestWaveRecordResult = Readonly<{
  previousBestWave: number;
  bestWave: number;
  isNewBest: boolean;
}>;

export type DungeonBestWaveStore = Readonly<{
  get(): number;
  record(wavesCleared: number): DungeonBestWaveRecordResult;
}>;

export type CreateDungeonBestWaveStoreInit = Readonly<{
  storage?: StorageApi | null;
  log?: Log;
}>;

type PersistedDungeonBestWaveV1 = Readonly<{
  schemaVersion: 1;
  bestWave: number;
}>;

const DUNGEON_BEST_WAVE_STORAGE_KEY = 'slime-escape:dungeon-best-wave';
const DUNGEON_BEST_WAVE_SCHEMA_VERSION = 1;
const DEFAULT_BEST_WAVE = 0;

export function createDungeonBestWaveStore(
  init: CreateDungeonBestWaveStoreInit = {}
): DungeonBestWaveStore {
  const bestWaveLog = init.log ?? defaultLog;
  let storage = init.storage === undefined ? createBrowserStorageApi() : init.storage;
  let bestWave = DEFAULT_BEST_WAVE;

  if (storage !== null) {
    const initialRead = readInitialBestWave(storage, bestWaveLog);
    storage = initialRead.storage;
    bestWave = initialRead.bestWave;
  }

  return {
    get(): number {
      return bestWave;
    },
    record(wavesCleared): DungeonBestWaveRecordResult {
      const normalizedWavesCleared = normalizeBestWave(wavesCleared);
      const previousBestWave = bestWave;
      if (normalizedWavesCleared <= previousBestWave) {
        return {
          previousBestWave,
          bestWave,
          isNewBest: false
        };
      }

      bestWave = normalizedWavesCleared;
      persistSnapshot(storage, bestWave, bestWaveLog);
      return {
        previousBestWave,
        bestWave,
        isNewBest: true
      };
    }
  };
}

function readInitialBestWave(
  storage: StorageApi,
  bestWaveLog: Log
): Readonly<{
  bestWave: number;
  storage: StorageApi | null;
}> {
  let rawSnapshot: string | null;

  try {
    rawSnapshot = storage.getItem(DUNGEON_BEST_WAVE_STORAGE_KEY);
  } catch {
    return {
      bestWave: DEFAULT_BEST_WAVE,
      storage: null
    };
  }

  if (rawSnapshot === null) {
    return {
      bestWave: DEFAULT_BEST_WAVE,
      storage
    };
  }

  let parsedSnapshot: unknown;
  try {
    parsedSnapshot = JSON.parse(rawSnapshot);
  } catch (error) {
    bestWaveLog.warn('dungeon best wave storage JSON is invalid; resetting to default', {
      error: formatError(error)
    });
    persistSnapshot(storage, DEFAULT_BEST_WAVE, bestWaveLog);
    return {
      bestWave: DEFAULT_BEST_WAVE,
      storage
    };
  }

  if (
    !isRecord(parsedSnapshot) ||
    parsedSnapshot.schemaVersion !== DUNGEON_BEST_WAVE_SCHEMA_VERSION
  ) {
    bestWaveLog.warn('dungeon best wave schema is unsupported; resetting to default', {
      schemaVersion:
        isRecord(parsedSnapshot) && 'schemaVersion' in parsedSnapshot
          ? parsedSnapshot.schemaVersion
          : null
    });
    persistSnapshot(storage, DEFAULT_BEST_WAVE, bestWaveLog);
    return {
      bestWave: DEFAULT_BEST_WAVE,
      storage
    };
  }

  const normalized = normalizeStoredBestWave(parsedSnapshot.bestWave, bestWaveLog);
  if (normalized.shouldRewrite) {
    persistSnapshot(storage, normalized.value, bestWaveLog);
  }

  return {
    bestWave: normalized.value,
    storage
  };
}

function normalizeStoredBestWave(
  value: unknown,
  bestWaveLog: Log
): Readonly<{
  value: number;
  shouldRewrite: boolean;
}> {
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  ) {
    return {
      value,
      shouldRewrite: false
    };
  }

  bestWaveLog.warn('dungeon best wave value is invalid; using default', {
    value,
    normalizedValue: DEFAULT_BEST_WAVE
  });
  return {
    value: DEFAULT_BEST_WAVE,
    shouldRewrite: true
  };
}

function normalizeBestWave(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_BEST_WAVE;
  }
  return Math.floor(value);
}

function persistSnapshot(storage: StorageApi | null, bestWave: number, bestWaveLog: Log): void {
  if (storage === null) {
    return;
  }

  const snapshot: PersistedDungeonBestWaveV1 = {
    schemaVersion: DUNGEON_BEST_WAVE_SCHEMA_VERSION,
    bestWave
  };

  try {
    storage.setItem(DUNGEON_BEST_WAVE_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    bestWaveLog.warn('dungeon best wave persistence write failed', {
      error: formatError(error)
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
