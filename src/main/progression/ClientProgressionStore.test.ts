import { describe, expect, it, vi } from 'vitest';

import type { PetArchetype, PetEconomy } from '../../shared/content/pets';
import type { Log } from '../../shared/log';

import {
  createClientProgressionStore,
  DEFAULT_CLIENT_PROGRESSION,
  type RandomInt,
  type StorageApi
} from './ClientProgressionStore';

class FakeStorage implements StorageApi {
  readonly entries = new Map<string, string>();
  setItemCalls: Array<Readonly<{ key: string; value: string }>> = [];
  throwOnGet = false;
  throwOnSet = false;

  getItem(key: string): string | null {
    if (this.throwOnGet) {
      throw new Error('getItem failed');
    }
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSet) {
      throw new Error('setItem failed');
    }
    this.entries.set(key, value);
    this.setItemCalls.push({ key, value });
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }
}

const TEST_PET_REGISTRY: Readonly<Record<string, PetArchetype>> = Object.freeze({
  'green-a': { id: 'green-a', displayName: 'Green A', quality: 'green' },
  'green-b': { id: 'green-b', displayName: 'Green B', quality: 'green' },
  'purple-a': { id: 'purple-a', displayName: 'Purple A', quality: 'purple' }
});

const TEST_ECONOMY: PetEconomy = Object.freeze({
  xpPerDestroyedSlime: 1,
  standPrices: {
    green: 25,
    purple: 75
  }
});

function createLogHarness(): Log {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
}

function createRandomInt(values: ReadonlyArray<number>): RandomInt {
  let index = 0;
  return vi.fn((_maxExclusive: number) => {
    const value = values[index] ?? 0;
    index += 1;
    return value;
  });
}

function readStoredSnapshot(storage: FakeStorage): Record<string, unknown> | null {
  const raw = storage.entries.get('slime-escape:client-progression');
  return raw === undefined ? null : (JSON.parse(raw) as Record<string, unknown>);
}

function createStore(
  options: Readonly<{
    storage?: FakeStorage;
    log?: Log;
    randomInt?: RandomInt;
  }> = {}
) {
  return createClientProgressionStore({
    storage: options.storage ?? new FakeStorage(),
    log: options.log ?? createLogHarness(),
    petRegistry: TEST_PET_REGISTRY,
    economy: TEST_ECONOMY,
    randomInt: options.randomInt ?? createRandomInt([0])
  });
}

describe('createClientProgressionStore', () => {
  it('uses defaults when the storage key is missing and does not write eagerly', () => {
    const storage = new FakeStorage();
    const store = createStore({ storage });

    expect(store.get()).toEqual(DEFAULT_CLIENT_PROGRESSION);
    expect(storage.setItemCalls).toHaveLength(0);
  });

  it('loads a valid versioned progression snapshot', () => {
    const storage = new FakeStorage();
    storage.entries.set(
      'slime-escape:client-progression',
      JSON.stringify({
        schemaVersion: 1,
        totalXp: 30,
        ownedPetIds: ['green-b', 'green-a'],
        selectedPetId: 'green-a'
      })
    );

    const store = createStore({ storage });

    expect(store.get()).toEqual({
      schemaVersion: 1,
      totalXp: 30,
      ownedPetIds: ['green-a', 'green-b'],
      selectedPetId: 'green-a'
    });
    expect(readStoredSnapshot(storage)).toEqual({
      schemaVersion: 1,
      totalXp: 30,
      ownedPetIds: ['green-a', 'green-b'],
      selectedPetId: 'green-a'
    });
  });

  it('resets invalid JSON and unsupported schemas to defaults without blocking startup', () => {
    const invalidJsonStorage = new FakeStorage();
    invalidJsonStorage.entries.set('slime-escape:client-progression', '{oops');
    const invalidJsonStore = createStore({ storage: invalidJsonStorage });

    expect(invalidJsonStore.get()).toEqual(DEFAULT_CLIENT_PROGRESSION);
    expect(readStoredSnapshot(invalidJsonStorage)).toEqual(DEFAULT_CLIENT_PROGRESSION);

    const unsupportedStorage = new FakeStorage();
    unsupportedStorage.entries.set(
      'slime-escape:client-progression',
      JSON.stringify({
        schemaVersion: 99,
        totalXp: 100,
        ownedPetIds: ['green-a'],
        selectedPetId: 'green-a'
      })
    );
    const unsupportedStore = createStore({ storage: unsupportedStorage });

    expect(unsupportedStore.get()).toEqual(DEFAULT_CLIENT_PROGRESSION);
    expect(readStoredSnapshot(unsupportedStorage)).toEqual(DEFAULT_CLIENT_PROGRESSION);
  });

  it('normalizes invalid stored XP, unknown pets, duplicates, and unowned selections', () => {
    const storage = new FakeStorage();
    const log = createLogHarness();
    storage.entries.set(
      'slime-escape:client-progression',
      JSON.stringify({
        schemaVersion: 1,
        totalXp: -3,
        ownedPetIds: ['green-b', 'ghost-pet', 'green-a', 'green-a', 42],
        selectedPetId: 'ghost-pet'
      })
    );

    const store = createStore({ storage, log });

    expect(store.get()).toEqual({
      schemaVersion: 1,
      totalXp: 0,
      ownedPetIds: ['green-a', 'green-b'],
      selectedPetId: null
    });
    expect(log.warn).toHaveBeenCalledWith('client progression totalXp is invalid; using default', {
      value: -3,
      normalizedValue: 0
    });
    expect(log.warn).toHaveBeenCalledWith(
      'client progression ownedPetIds contained invalid entries; filtering',
      {
        value: ['green-b', 'ghost-pet', 'green-a', 'green-a', 42],
        normalizedValue: ['green-a', 'green-b']
      }
    );
    expect(log.warn).toHaveBeenCalledWith(
      'client progression selectedPetId is invalid; clearing selection',
      {
        value: 'ghost-pet',
        normalizedValue: null
      }
    );
    expect(readStoredSnapshot(storage)).toEqual({
      schemaVersion: 1,
      totalXp: 0,
      ownedPetIds: ['green-a', 'green-b'],
      selectedPetId: null
    });
  });

  it('awards clamped integer XP, persists, and notifies subscribers synchronously', () => {
    const storage = new FakeStorage();
    const listener = vi.fn();
    const store = createStore({ storage });
    store.subscribe(listener);

    store.awardXp(12.8);
    store.awardXp(0);

    expect(store.get().totalXp).toBe(12);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      schemaVersion: 1,
      totalXp: 12,
      ownedPetIds: [],
      selectedPetId: null
    });
    expect(readStoredSnapshot(storage)).toEqual({
      schemaVersion: 1,
      totalXp: 12,
      ownedPetIds: [],
      selectedPetId: null
    });
  });

  it('purchases a random unowned pet of the requested quality without returning duplicates', () => {
    const storage = new FakeStorage();
    const randomInt = createRandomInt([1]);
    const store = createStore({ storage, randomInt });
    store.awardXp(50);

    const result = store.purchasePet('green');

    expect(result).toEqual({
      ok: true,
      petId: 'green-b',
      quality: 'green',
      price: 25,
      totalXp: 25
    });
    expect(store.get()).toEqual({
      schemaVersion: 1,
      totalXp: 25,
      ownedPetIds: ['green-b'],
      selectedPetId: null
    });
    expect(randomInt).toHaveBeenCalledWith(2);
  });

  it('does not spend XP or roll when a stand is unaffordable', () => {
    const randomInt = createRandomInt([0]);
    const store = createStore({ randomInt });
    store.awardXp(24);

    const result = store.purchasePet('green');

    expect(result).toEqual({
      ok: false,
      reason: 'insufficientXp',
      quality: 'green',
      price: 25,
      totalXp: 24
    });
    expect(store.get().ownedPetIds).toEqual([]);
    expect(randomInt).not.toHaveBeenCalled();
  });

  it('does not spend XP when every pet of a quality is already owned', () => {
    const storage = new FakeStorage();
    storage.entries.set(
      'slime-escape:client-progression',
      JSON.stringify({
        schemaVersion: 1,
        totalXp: 100,
        ownedPetIds: ['green-a', 'green-b'],
        selectedPetId: null
      })
    );
    const randomInt = createRandomInt([0]);
    const store = createStore({ storage, randomInt });

    const result = store.purchasePet('green');

    expect(result).toEqual({
      ok: false,
      reason: 'complete',
      quality: 'green',
      price: 25,
      totalXp: 100
    });
    expect(store.get().totalXp).toBe(100);
    expect(randomInt).not.toHaveBeenCalled();
  });

  it('selects only owned pets and clears the selected companion', () => {
    const storage = new FakeStorage();
    const listener = vi.fn();
    const store = createStore({ storage });
    store.awardXp(25);
    store.purchasePet('green');
    store.subscribe(listener);

    expect(store.selectPet('green-a')).toEqual({ ok: true, selectedPetId: 'green-a' });
    expect(store.selectPet('purple-a')).toEqual({
      ok: false,
      reason: 'notOwned',
      selectedPetId: 'purple-a'
    });
    store.clearSelectedPet();

    expect(store.get().selectedPetId).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(readStoredSnapshot(storage)).toEqual({
      schemaVersion: 1,
      totalXp: 0,
      ownedPetIds: ['green-a'],
      selectedPetId: null
    });
  });

  it('keeps in-memory updates and notifications when persistence writes fail', () => {
    const storage = new FakeStorage();
    const log = createLogHarness();
    const listener = vi.fn();
    storage.throwOnSet = true;
    const store = createStore({ storage, log });
    store.subscribe(listener);

    store.awardXp(10);

    expect(store.get().totalXp).toBe(10);
    expect(listener).toHaveBeenCalledWith({
      schemaVersion: 1,
      totalXp: 10,
      ownedPetIds: [],
      selectedPetId: null
    });
    expect(log.warn).toHaveBeenCalledWith(
      'client progression persistence write failed; using memory only',
      {
        error: 'setItem failed'
      }
    );
  });

  it('switches to memory-only when startup normalization cannot be persisted', () => {
    const storage = new FakeStorage();
    const log = createLogHarness();
    storage.entries.set('slime-escape:client-progression', '{oops');
    storage.throwOnSet = true;

    const store = createStore({ storage, log });
    storage.throwOnSet = false;
    store.awardXp(10);

    expect(store.get().totalXp).toBe(10);
    expect(storage.setItemCalls).toHaveLength(0);
    expect(log.warn).toHaveBeenCalledWith(
      'client progression persistence write failed; using memory only',
      {
        error: 'setItem failed'
      }
    );
  });

  it('stops writes and notifications after dispose while keeping memory state valid', () => {
    const storage = new FakeStorage();
    const listener = vi.fn();
    const store = createStore({ storage });
    store.subscribe(listener);
    store.dispose();

    store.awardXp(10);

    expect(store.get().totalXp).toBe(10);
    expect(listener).not.toHaveBeenCalled();
    expect(storage.setItemCalls).toHaveLength(0);
  });
});
