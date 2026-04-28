import {
  PET_ARCHETYPES,
  PET_ECONOMY,
  type PetArchetype,
  type PetEconomy,
  type PetQuality
} from '../../shared/content/pets';
import { log as defaultLog, type Log } from '../../shared/log';
import { createBrowserStorageApi, type StorageApi } from '../settings/ClientSettingsStore';

export type { StorageApi };

export type ClientProgression = Readonly<{
  schemaVersion: 1;
  totalXp: number;
  ownedPetIds: ReadonlyArray<string>;
  selectedPetId: string | null;
}>;

export type PetPurchaseResult =
  | Readonly<{
      ok: true;
      petId: string;
      quality: PetQuality;
      price: number;
      totalXp: number;
    }>
  | Readonly<{
      ok: false;
      reason: 'complete' | 'insufficientXp';
      quality: PetQuality;
      price: number;
      totalXp: number;
    }>;

export type PetSelectionResult =
  | Readonly<{ ok: true; selectedPetId: string }>
  | Readonly<{ ok: false; reason: 'notOwned'; selectedPetId: string }>;

export type RandomInt = (maxExclusive: number) => number;

export type ClientProgressionStore = Readonly<{
  get(): ClientProgression;
  awardXp(amount: number): ClientProgression;
  purchasePet(quality: PetQuality): PetPurchaseResult;
  selectPet(petId: string): PetSelectionResult;
  clearSelectedPet(): void;
  subscribe(listener: (progression: ClientProgression) => void): () => void;
  dispose(): void;
}>;

export type CreateClientProgressionStoreInit = Readonly<{
  storage?: StorageApi | null;
  log?: Log;
  petRegistry?: Readonly<Record<string, PetArchetype>>;
  economy?: PetEconomy;
  randomInt?: RandomInt;
}>;

type PersistedClientProgressionV1 = Readonly<{
  schemaVersion: 1;
  totalXp: number;
  ownedPetIds: ReadonlyArray<string>;
  selectedPetId: string | null;
}>;

const CLIENT_PROGRESSION_STORAGE_KEY = 'slime-escape:client-progression';
const CLIENT_PROGRESSION_SCHEMA_VERSION = 1;

export const DEFAULT_CLIENT_PROGRESSION: ClientProgression = freezeProgression({
  schemaVersion: CLIENT_PROGRESSION_SCHEMA_VERSION,
  totalXp: 0,
  ownedPetIds: [],
  selectedPetId: null
});

export function createClientProgressionStore(
  init: CreateClientProgressionStoreInit = {}
): ClientProgressionStore {
  const progressionLog = init.log ?? defaultLog;
  const petRegistry = init.petRegistry ?? PET_ARCHETYPES;
  const economy = init.economy ?? PET_ECONOMY;
  const randomInt = init.randomInt ?? createCryptoRandomInt();
  let storage = init.storage === undefined ? createBrowserStorageApi() : init.storage;
  let disposed = false;
  let listeners: Array<(progression: ClientProgression) => void> = [];
  let currentProgression = DEFAULT_CLIENT_PROGRESSION;

  if (storage !== null) {
    const initialRead = readInitialProgression(storage, petRegistry, progressionLog);
    currentProgression = initialRead.progression;
    storage = initialRead.storage;
  }

  function commitProgression(nextProgression: ClientProgression): void {
    currentProgression = freezeProgression(nextProgression);
    if (disposed) {
      return;
    }

    storage = persistSnapshot(storage, currentProgression, progressionLog);
    for (const listener of listeners) {
      listener(currentProgression);
    }
  }

  return {
    get(): ClientProgression {
      return currentProgression;
    },
    awardXp(amount): ClientProgression {
      const xpAwarded = normalizeAwardAmount(amount, progressionLog);
      if (xpAwarded === 0) {
        return currentProgression;
      }

      const nextProgression = freezeProgression({
        ...currentProgression,
        totalXp: currentProgression.totalXp + xpAwarded
      });
      commitProgression(nextProgression);
      return currentProgression;
    },
    purchasePet(quality): PetPurchaseResult {
      const price = economy.standPrices[quality];
      const unownedPetIds = getUnownedPetIdsByQuality(quality, currentProgression, petRegistry);
      if (unownedPetIds.length === 0) {
        return {
          ok: false,
          reason: 'complete',
          quality,
          price,
          totalXp: currentProgression.totalXp
        };
      }

      if (currentProgression.totalXp < price) {
        return {
          ok: false,
          reason: 'insufficientXp',
          quality,
          price,
          totalXp: currentProgression.totalXp
        };
      }

      const petId = unownedPetIds[requireRandomIndex(randomInt, unownedPetIds.length)];
      if (petId === undefined) {
        throw new Error('pet purchase random selection failed');
      }

      const nextProgression = freezeProgression({
        ...currentProgression,
        totalXp: currentProgression.totalXp - price,
        ownedPetIds: sortPetIds([...currentProgression.ownedPetIds, petId])
      });
      commitProgression(nextProgression);

      return {
        ok: true,
        petId,
        quality,
        price,
        totalXp: currentProgression.totalXp
      };
    },
    selectPet(petId): PetSelectionResult {
      if (!currentProgression.ownedPetIds.includes(petId)) {
        return {
          ok: false,
          reason: 'notOwned',
          selectedPetId: petId
        };
      }

      if (currentProgression.selectedPetId === petId) {
        return {
          ok: true,
          selectedPetId: petId
        };
      }

      commitProgression(
        freezeProgression({
          ...currentProgression,
          selectedPetId: petId
        })
      );

      return {
        ok: true,
        selectedPetId: petId
      };
    },
    clearSelectedPet(): void {
      if (currentProgression.selectedPetId === null) {
        return;
      }

      commitProgression(
        freezeProgression({
          ...currentProgression,
          selectedPetId: null
        })
      );
    },
    subscribe(listener): () => void {
      if (disposed) {
        return () => {};
      }

      listeners.push(listener);
      let active = true;
      return () => {
        if (!active) {
          return;
        }
        active = false;
        listeners = listeners.filter((entry) => entry !== listener);
      };
    },
    dispose(): void {
      disposed = true;
      listeners = [];
    }
  };
}

export function createCryptoRandomInt(): RandomInt {
  return (maxExclusive: number): number => {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error(`randomInt maxExclusive must be a positive integer, got ${maxExclusive}`);
    }

    const cryptoApi = globalThis.crypto;
    if (cryptoApi === undefined || typeof cryptoApi.getRandomValues !== 'function') {
      throw new Error('pet purchase requires crypto.getRandomValues');
    }

    const range = 0x100000000;
    const limit = range - (range % maxExclusive);
    const buffer = new Uint32Array(1);

    do {
      cryptoApi.getRandomValues(buffer);
    } while ((buffer[0] ?? 0) >= limit);

    return (buffer[0] ?? 0) % maxExclusive;
  };
}

function readInitialProgression(
  storage: StorageApi,
  petRegistry: Readonly<Record<string, PetArchetype>>,
  progressionLog: Log
): Readonly<{
  progression: ClientProgression;
  storage: StorageApi | null;
}> {
  let rawSnapshot: string | null;

  try {
    rawSnapshot = storage.getItem(CLIENT_PROGRESSION_STORAGE_KEY);
  } catch (error) {
    progressionLog.warn('client progression storage read failed; using memory only', {
      error: formatError(error)
    });
    return {
      progression: DEFAULT_CLIENT_PROGRESSION,
      storage: null
    };
  }

  if (rawSnapshot === null) {
    return {
      progression: DEFAULT_CLIENT_PROGRESSION,
      storage
    };
  }

  let parsedSnapshot: unknown;
  try {
    parsedSnapshot = JSON.parse(rawSnapshot);
  } catch (error) {
    progressionLog.warn('client progression storage JSON is invalid; resetting to defaults', {
      error: formatError(error)
    });
    const nextStorage = persistSnapshot(storage, DEFAULT_CLIENT_PROGRESSION, progressionLog);
    return {
      progression: DEFAULT_CLIENT_PROGRESSION,
      storage: nextStorage
    };
  }

  if (!isRecord(parsedSnapshot) || parsedSnapshot.schemaVersion !== CLIENT_PROGRESSION_SCHEMA_VERSION) {
    progressionLog.warn('client progression schema is unsupported; resetting to defaults', {
      schemaVersion:
        isRecord(parsedSnapshot) && 'schemaVersion' in parsedSnapshot
          ? parsedSnapshot.schemaVersion
          : null
    });
    const nextStorage = persistSnapshot(storage, DEFAULT_CLIENT_PROGRESSION, progressionLog);
    return {
      progression: DEFAULT_CLIENT_PROGRESSION,
      storage: nextStorage
    };
  }

  const normalized = normalizeStoredProgression(parsedSnapshot, petRegistry, progressionLog);
  const nextStorage = normalized.shouldRewrite
    ? persistSnapshot(storage, normalized.progression, progressionLog)
    : storage;

  return {
    progression: normalized.progression,
    storage: nextStorage
  };
}

function normalizeStoredProgression(
  value: Record<string, unknown>,
  petRegistry: Readonly<Record<string, PetArchetype>>,
  progressionLog: Log
): Readonly<{
  progression: ClientProgression;
  shouldRewrite: boolean;
}> {
  let shouldRewrite = false;

  const totalXp = normalizeStoredTotalXp(value.totalXp, progressionLog);
  if (totalXp.shouldRewrite) {
    shouldRewrite = true;
  }

  const ownedPetIds = normalizeStoredOwnedPetIds(value.ownedPetIds, petRegistry, progressionLog);
  if (ownedPetIds.shouldRewrite) {
    shouldRewrite = true;
  }

  const selectedPetId = normalizeStoredSelectedPetId(
    value.selectedPetId,
    ownedPetIds.value,
    progressionLog
  );
  if (selectedPetId.shouldRewrite) {
    shouldRewrite = true;
  }

  return {
    progression: freezeProgression({
      schemaVersion: CLIENT_PROGRESSION_SCHEMA_VERSION,
      totalXp: totalXp.value,
      ownedPetIds: ownedPetIds.value,
      selectedPetId: selectedPetId.value
    }),
    shouldRewrite
  };
}

function normalizeStoredTotalXp(
  value: unknown,
  progressionLog: Log
): Readonly<{ value: number; shouldRewrite: boolean }> {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return {
      value,
      shouldRewrite: false
    };
  }

  progressionLog.warn('client progression totalXp is invalid; using default', {
    value,
    normalizedValue: DEFAULT_CLIENT_PROGRESSION.totalXp
  });
  return {
    value: DEFAULT_CLIENT_PROGRESSION.totalXp,
    shouldRewrite: true
  };
}

function normalizeStoredOwnedPetIds(
  value: unknown,
  petRegistry: Readonly<Record<string, PetArchetype>>,
  progressionLog: Log
): Readonly<{ value: ReadonlyArray<string>; shouldRewrite: boolean }> {
  if (!Array.isArray(value)) {
    progressionLog.warn('client progression ownedPetIds is invalid; using default', {
      value,
      normalizedValue: []
    });
    return {
      value: [],
      shouldRewrite: true
    };
  }

  const normalizedPetIds = sortPetIds(
    value.filter((petId): petId is string => typeof petId === 'string' && petRegistry[petId] !== undefined)
  );
  const hadInvalidEntries =
    normalizedPetIds.length !== value.length ||
    new Set(normalizedPetIds).size !== value.length;

  if (hadInvalidEntries) {
    progressionLog.warn('client progression ownedPetIds contained invalid entries; filtering', {
      value,
      normalizedValue: normalizedPetIds
    });
  }

  return {
    value: normalizedPetIds,
    shouldRewrite: hadInvalidEntries || !arraysEqual(value, normalizedPetIds)
  };
}

function normalizeStoredSelectedPetId(
  value: unknown,
  ownedPetIds: ReadonlyArray<string>,
  progressionLog: Log
): Readonly<{ value: string | null; shouldRewrite: boolean }> {
  if (value === null) {
    return {
      value: null,
      shouldRewrite: false
    };
  }

  if (typeof value === 'string' && ownedPetIds.includes(value)) {
    return {
      value,
      shouldRewrite: false
    };
  }

  progressionLog.warn('client progression selectedPetId is invalid; clearing selection', {
    value,
    normalizedValue: null
  });
  return {
    value: null,
    shouldRewrite: true
  };
}

function persistSnapshot(
  storage: StorageApi | null,
  progression: ClientProgression,
  progressionLog: Log
): StorageApi | null {
  if (storage === null) {
    return null;
  }

  const snapshot: PersistedClientProgressionV1 = {
    schemaVersion: CLIENT_PROGRESSION_SCHEMA_VERSION,
    totalXp: progression.totalXp,
    ownedPetIds: progression.ownedPetIds,
    selectedPetId: progression.selectedPetId
  };

  try {
    storage.setItem(CLIENT_PROGRESSION_STORAGE_KEY, JSON.stringify(snapshot));
    return storage;
  } catch (error) {
    progressionLog.warn('client progression persistence write failed; using memory only', {
      error: formatError(error)
    });
    return null;
  }
}

function getUnownedPetIdsByQuality(
  quality: PetQuality,
  progression: ClientProgression,
  petRegistry: Readonly<Record<string, PetArchetype>>
): ReadonlyArray<string> {
  const ownedPetIds = new Set(progression.ownedPetIds);
  return Object.values(petRegistry)
    .filter((pet) => pet.quality === quality && !ownedPetIds.has(pet.id))
    .map((pet) => pet.id)
    .sort((left, right) => left.localeCompare(right));
}

function requireRandomIndex(randomInt: RandomInt, maxExclusive: number): number {
  const index = randomInt(maxExclusive);
  if (!Number.isInteger(index) || index < 0 || index >= maxExclusive) {
    throw new Error(
      `progression randomInt returned invalid index ${index} for maxExclusive ${maxExclusive}`
    );
  }
  return index;
}

function normalizeAwardAmount(amount: number, progressionLog: Log): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    if (amount !== 0) {
      progressionLog.warn('client progression XP award is invalid; using zero', {
        value: amount,
        normalizedValue: 0
      });
    }
    return 0;
  }
  return Math.floor(amount);
}

function freezeProgression(progression: ClientProgression): ClientProgression {
  return Object.freeze({
    schemaVersion: CLIENT_PROGRESSION_SCHEMA_VERSION,
    totalXp: progression.totalXp,
    ownedPetIds: Object.freeze([...progression.ownedPetIds]),
    selectedPetId: progression.selectedPetId
  });
}

function sortPetIds(petIds: ReadonlyArray<string>): ReadonlyArray<string> {
  return [...new Set(petIds)].sort((left, right) => left.localeCompare(right));
}

function arraysEqual(left: ReadonlyArray<unknown>, right: ReadonlyArray<unknown>): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
