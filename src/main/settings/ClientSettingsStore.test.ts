import { describe, expect, it, vi } from 'vitest';

import type { Log } from '../../shared/log';

import {
  DEFAULT_CLIENT_SETTINGS,
  createClientSettingsStore,
  type ClientSettings,
  type StorageApi
} from './ClientSettingsStore';

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
  const raw = storage.entries.get('slime-escape:client-settings');
  return raw === undefined ? null : (JSON.parse(raw) as Record<string, unknown>);
}

describe('createClientSettingsStore', () => {
  it('uses defaults when the storage key is missing and does not write eagerly', () => {
    const storage = new FakeStorage();
    const store = createClientSettingsStore({ storage, log: createLogHarness() });

    expect(store.get()).toEqual(DEFAULT_CLIENT_SETTINGS);
    expect(storage.setItemCalls).toHaveLength(0);
  });

  it('resets invalid JSON to defaults and rewrites the stored snapshot', () => {
    const storage = new FakeStorage();
    const log = createLogHarness();
    storage.entries.set('slime-escape:client-settings', '{oops');

    const store = createClientSettingsStore({ storage, log });

    expect(store.get()).toEqual(DEFAULT_CLIENT_SETTINGS);
    expect(log.warn).toHaveBeenCalledWith(
      'client settings storage JSON is invalid; resetting to defaults',
      expect.objectContaining({
        error: expect.any(String)
      })
    );
    expect(readStoredSnapshot(storage)).toEqual({
      schemaVersion: 1,
      masterVolume: 1,
      renderScalePreset: 'medium'
    });
  });

  it('resets unknown schema versions to defaults and rewrites the snapshot', () => {
    const storage = new FakeStorage();
    const log = createLogHarness();
    storage.entries.set(
      'slime-escape:client-settings',
      JSON.stringify({
        schemaVersion: 99,
        masterVolume: 0.25,
        renderScalePreset: 'low'
      })
    );

    const store = createClientSettingsStore({ storage, log });

    expect(store.get()).toEqual(DEFAULT_CLIENT_SETTINGS);
    expect(log.warn).toHaveBeenCalledWith(
      'client settings schema is unsupported; resetting to defaults',
      {
        schemaVersion: 99
      }
    );
    expect(readStoredSnapshot(storage)).toEqual({
      schemaVersion: 1,
      masterVolume: 1,
      renderScalePreset: 'medium'
    });
  });

  it('normalizes invalid stored fields while keeping valid ones', () => {
    const storage = new FakeStorage();
    const log = createLogHarness();
    storage.entries.set(
      'slime-escape:client-settings',
      JSON.stringify({
        schemaVersion: 1,
        masterVolume: 2,
        renderScalePreset: 'low'
      })
    );

    const store = createClientSettingsStore({ storage, log });

    expect(store.get()).toEqual({
      masterVolume: 1,
      renderScalePreset: 'low'
    });
    expect(log.warn).toHaveBeenCalledWith(
      'client settings masterVolume is invalid; using normalized value',
      {
        value: 2,
        normalizedValue: 1
      }
    );
    expect(readStoredSnapshot(storage)).toEqual({
      schemaVersion: 1,
      masterVolume: 1,
      renderScalePreset: 'low'
    });
  });

  it('notifies listeners once per semantic change and skips duplicate writes', () => {
    const storage = new FakeStorage();
    const listener = vi.fn();
    const store = createClientSettingsStore({ storage, log: createLogHarness() });
    store.subscribe(listener);

    store.setMasterVolume(0.5);
    store.setMasterVolume(0.5);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      masterVolume: 0.5,
      renderScalePreset: 'medium'
    });
    expect(readStoredSnapshot(storage)).toEqual({
      schemaVersion: 1,
      masterVolume: 0.5,
      renderScalePreset: 'medium'
    });
    expect(storage.setItemCalls).toHaveLength(1);
  });

  it('clamps master volume updates into the persisted snapshot', () => {
    const storage = new FakeStorage();
    const log = createLogHarness();
    const store = createClientSettingsStore({ storage, log });

    store.setMasterVolume(0.25);
    store.setMasterVolume(2);

    expect(store.get()).toEqual({
      masterVolume: 1,
      renderScalePreset: 'medium'
    });
    expect(log.warn).toHaveBeenCalledWith('client settings masterVolume clamped to [0, 1]', {
      value: 2,
      clampedValue: 1
    });
    expect(readStoredSnapshot(storage)).toEqual({
      schemaVersion: 1,
      masterVolume: 1,
      renderScalePreset: 'medium'
    });
  });

  it('warns and ignores invalid render scale updates', () => {
    const storage = new FakeStorage();
    const log = createLogHarness();
    const listener = vi.fn();
    const store = createClientSettingsStore({ storage, log });
    store.subscribe(listener);

    store.setRenderScalePreset('ultra' as never);

    expect(store.get()).toEqual(DEFAULT_CLIENT_SETTINGS);
    expect(listener).not.toHaveBeenCalled();
    expect(storage.setItemCalls).toHaveLength(0);
    expect(log.warn).toHaveBeenCalledWith(
      'client settings renderScalePreset is invalid; ignoring update',
      {
        value: 'ultra'
      }
    );
  });

  it('calls listeners synchronously in registration order', () => {
    const storage = new FakeStorage();
    const order: ClientSettings[] = [];
    const store = createClientSettingsStore({ storage, log: createLogHarness() });

    store.subscribe((settings) => {
      order.push(settings);
    });
    store.subscribe((settings) => {
      order.push(settings);
    });

    store.setMasterVolume(0.25);

    expect(order).toEqual([
      { masterVolume: 0.25, renderScalePreset: 'medium' },
      { masterVolume: 0.25, renderScalePreset: 'medium' }
    ]);
  });

  it('stops writes and notifications after dispose while keeping in-memory state valid', () => {
    const storage = new FakeStorage();
    const listener = vi.fn();
    const store = createClientSettingsStore({ storage, log: createLogHarness() });
    store.subscribe(listener);
    store.dispose();

    store.setMasterVolume(0.25);
    store.setRenderScalePreset('low');

    expect(store.get()).toEqual({
      masterVolume: 0.25,
      renderScalePreset: 'low'
    });
    expect(listener).not.toHaveBeenCalled();
    expect(storage.setItemCalls).toHaveLength(0);
  });

  it('keeps in-memory updates and notifications when persistence writes fail', () => {
    const storage = new FakeStorage();
    const log = createLogHarness();
    const listener = vi.fn();
    storage.throwOnSet = true;
    const store = createClientSettingsStore({ storage, log });
    store.subscribe(listener);

    store.setMasterVolume(0.75);

    expect(store.get()).toEqual({
      masterVolume: 0.75,
      renderScalePreset: 'medium'
    });
    expect(listener).toHaveBeenCalledWith({
      masterVolume: 0.75,
      renderScalePreset: 'medium'
    });
    expect(log.warn).toHaveBeenCalledWith('client settings persistence write failed', {
      error: 'setItem failed'
    });
  });
});
