import { describe, expect, it, vi } from 'vitest';

import type { Log } from '../../shared/log';

import { type StorageApi } from './ClientSettingsStore';
import { createDungeonBestWaveStore } from './DungeonBestWaveStore';

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

function createLogHarness(): Log {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
}

function readStoredSnapshot(storage: FakeStorage): Record<string, unknown> | null {
  const raw = storage.entries.get('slime-escape:dungeon-best-wave');
  return raw === undefined ? null : (JSON.parse(raw) as Record<string, unknown>);
}

describe('createDungeonBestWaveStore', () => {
  it('defaults missing storage to zero without writing eagerly', () => {
    const storage = new FakeStorage();
    const store = createDungeonBestWaveStore({ storage, log: createLogHarness() });

    expect(store.get()).toBe(0);
    expect(storage.setItemCalls).toHaveLength(0);
  });

  it('loads the stored best wave from the versioned snapshot', () => {
    const storage = new FakeStorage();
    storage.entries.set(
      'slime-escape:dungeon-best-wave',
      JSON.stringify({ schemaVersion: 1, bestWave: 12 })
    );

    const store = createDungeonBestWaveStore({ storage, log: createLogHarness() });

    expect(store.get()).toBe(12);
  });

  it('resets invalid stored values to zero and rewrites the snapshot', () => {
    const storage = new FakeStorage();
    const log = createLogHarness();
    storage.entries.set(
      'slime-escape:dungeon-best-wave',
      JSON.stringify({ schemaVersion: 1, bestWave: -3 })
    );

    const store = createDungeonBestWaveStore({ storage, log });

    expect(store.get()).toBe(0);
    expect(log.warn).toHaveBeenCalledWith('dungeon best wave value is invalid; using default', {
      value: -3,
      normalizedValue: 0
    });
    expect(readStoredSnapshot(storage)).toEqual({
      schemaVersion: 1,
      bestWave: 0
    });
  });

  it('resets invalid JSON and unsupported schemas to zero', () => {
    const invalidJsonStorage = new FakeStorage();
    invalidJsonStorage.entries.set('slime-escape:dungeon-best-wave', '{oops');
    const invalidJsonStore = createDungeonBestWaveStore({
      storage: invalidJsonStorage,
      log: createLogHarness()
    });

    expect(invalidJsonStore.get()).toBe(0);
    expect(readStoredSnapshot(invalidJsonStorage)).toEqual({
      schemaVersion: 1,
      bestWave: 0
    });

    const unsupportedStorage = new FakeStorage();
    unsupportedStorage.entries.set(
      'slime-escape:dungeon-best-wave',
      JSON.stringify({ schemaVersion: 99, bestWave: 9 })
    );
    const unsupportedStore = createDungeonBestWaveStore({
      storage: unsupportedStorage,
      log: createLogHarness()
    });

    expect(unsupportedStore.get()).toBe(0);
    expect(readStoredSnapshot(unsupportedStorage)).toEqual({
      schemaVersion: 1,
      bestWave: 0
    });
  });

  it('stores only improvements and returns record metadata', () => {
    const storage = new FakeStorage();
    const store = createDungeonBestWaveStore({ storage, log: createLogHarness() });

    expect(store.record(7)).toEqual({
      previousBestWave: 0,
      bestWave: 7,
      isNewBest: true
    });
    expect(store.record(6)).toEqual({
      previousBestWave: 7,
      bestWave: 7,
      isNewBest: false
    });
    expect(store.record(7)).toEqual({
      previousBestWave: 7,
      bestWave: 7,
      isNewBest: false
    });
    expect(readStoredSnapshot(storage)).toEqual({
      schemaVersion: 1,
      bestWave: 7
    });
    expect(storage.setItemCalls).toHaveLength(1);
  });

  it('keeps in-memory improvements when persistence writes fail', () => {
    const storage = new FakeStorage();
    const log = createLogHarness();
    storage.throwOnSet = true;

    const store = createDungeonBestWaveStore({ storage, log });
    const result = store.record(4);

    expect(result).toEqual({
      previousBestWave: 0,
      bestWave: 4,
      isNewBest: true
    });
    expect(store.get()).toBe(4);
    expect(log.warn).toHaveBeenCalledWith('dungeon best wave persistence write failed', {
      error: 'setItem failed'
    });
  });
});
