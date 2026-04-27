import { log as defaultLog, type Log } from '../../shared/log';
import type { RenderScalePreset } from '../render/renderScale';

export type { RenderScalePreset } from '../render/renderScale';

export type ClientSettings = Readonly<{
  masterVolume: number;
  renderScalePreset: RenderScalePreset;
}>;

export type StorageApi = Readonly<{
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}>;

export type ClientSettingsStore = Readonly<{
  get(): ClientSettings;
  setMasterVolume(value: number): void;
  setRenderScalePreset(preset: RenderScalePreset): void;
  subscribe(listener: (settings: ClientSettings) => void): () => void;
  dispose(): void;
}>;

export type CreateClientSettingsStoreInit = Readonly<{
  storage?: StorageApi | null;
  log?: Log;
}>;

type PersistedClientSettingsV1 = Readonly<{
  schemaVersion: 1;
  masterVolume: number;
  renderScalePreset: RenderScalePreset;
}>;

const CLIENT_SETTINGS_STORAGE_KEY = 'slime-escape:client-settings';
const CLIENT_SETTINGS_SCHEMA_VERSION = 1;
const MIN_MASTER_VOLUME = 0;
const MAX_MASTER_VOLUME = 1;

export const DEFAULT_CLIENT_SETTINGS: ClientSettings = Object.freeze({
  masterVolume: 0.2,
  renderScalePreset: 'high'
});

export function createClientSettingsStore(
  init: CreateClientSettingsStoreInit = {}
): ClientSettingsStore {
  const settingsLog = init.log ?? defaultLog;
  let storage = init.storage === undefined ? createBrowserStorageApi() : init.storage;
  let disposed = false;
  let listeners: Array<(settings: ClientSettings) => void> = [];
  let currentSettings = DEFAULT_CLIENT_SETTINGS;

  if (storage !== null) {
    const initialRead = readInitialSettings(storage, settingsLog);
    currentSettings = initialRead.settings;
    storage = initialRead.storage;
  }

  function commitSettings(nextSettings: ClientSettings): void {
    currentSettings = freezeSettings(nextSettings);
    if (disposed) {
      return;
    }

    persistSnapshot(storage, currentSettings, settingsLog);
    for (const listener of listeners) {
      listener(currentSettings);
    }
  }

  return {
    get(): ClientSettings {
      return currentSettings;
    },
    setMasterVolume(value): void {
      const nextMasterVolume = normalizeMasterVolumeInput(value, settingsLog);
      if (nextMasterVolume === currentSettings.masterVolume) {
        return;
      }
      commitSettings({
        ...currentSettings,
        masterVolume: nextMasterVolume
      });
    },
    setRenderScalePreset(preset): void {
      if (!isRenderScalePreset(preset)) {
        settingsLog.warn('client settings renderScalePreset is invalid; ignoring update', {
          value: preset
        });
        return;
      }
      if (preset === currentSettings.renderScalePreset) {
        return;
      }
      commitSettings({
        ...currentSettings,
        renderScalePreset: preset
      });
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

export function createBrowserStorageApi(): StorageApi | null {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return null;
  }

  const storage = globalThis.localStorage;
  return {
    getItem(key: string): string | null {
      return storage.getItem(key);
    },
    setItem(key: string, value: string): void {
      storage.setItem(key, value);
    },
    removeItem(key: string): void {
      storage.removeItem(key);
    }
  };
}

function readInitialSettings(
  storage: StorageApi,
  settingsLog: Log
): Readonly<{
  settings: ClientSettings;
  storage: StorageApi | null;
}> {
  let rawSnapshot: string | null;

  try {
    rawSnapshot = storage.getItem(CLIENT_SETTINGS_STORAGE_KEY);
  } catch {
    return {
      settings: DEFAULT_CLIENT_SETTINGS,
      storage: null
    };
  }

  if (rawSnapshot === null) {
    return {
      settings: DEFAULT_CLIENT_SETTINGS,
      storage
    };
  }

  let parsedSnapshot: unknown;
  try {
    parsedSnapshot = JSON.parse(rawSnapshot);
  } catch (error) {
    settingsLog.warn('client settings storage JSON is invalid; resetting to defaults', {
      error: formatError(error)
    });
    persistSnapshot(storage, DEFAULT_CLIENT_SETTINGS, settingsLog);
    return {
      settings: DEFAULT_CLIENT_SETTINGS,
      storage
    };
  }

  if (!isRecord(parsedSnapshot) || parsedSnapshot.schemaVersion !== CLIENT_SETTINGS_SCHEMA_VERSION) {
    settingsLog.warn('client settings schema is unsupported; resetting to defaults', {
      schemaVersion:
        isRecord(parsedSnapshot) && 'schemaVersion' in parsedSnapshot
          ? parsedSnapshot.schemaVersion
          : null
    });
    persistSnapshot(storage, DEFAULT_CLIENT_SETTINGS, settingsLog);
    return {
      settings: DEFAULT_CLIENT_SETTINGS,
      storage
    };
  }

  const normalized = normalizeStoredSettings(parsedSnapshot, settingsLog);
  if (normalized.shouldRewrite) {
    persistSnapshot(storage, normalized.settings, settingsLog);
  }

  return {
    settings: normalized.settings,
    storage
  };
}

function normalizeStoredSettings(
  value: Record<string, unknown>,
  settingsLog: Log
): Readonly<{
  settings: ClientSettings;
  shouldRewrite: boolean;
}> {
  let shouldRewrite = false;

  const masterVolume = normalizeStoredMasterVolume(value.masterVolume, settingsLog);
  if (masterVolume.shouldRewrite) {
    shouldRewrite = true;
  }

  const renderScalePreset = normalizeStoredRenderScalePreset(value.renderScalePreset, settingsLog);
  if (renderScalePreset.shouldRewrite) {
    shouldRewrite = true;
  }

  return {
    settings: freezeSettings({
      masterVolume: masterVolume.value,
      renderScalePreset: renderScalePreset.value
    }),
    shouldRewrite
  };
}

function normalizeStoredMasterVolume(
  value: unknown,
  settingsLog: Log
): Readonly<{
  value: number;
  shouldRewrite: boolean;
}> {
  if (value === undefined) {
    return {
      value: DEFAULT_CLIENT_SETTINGS.masterVolume,
      shouldRewrite: false
    };
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= MIN_MASTER_VOLUME && value <= MAX_MASTER_VOLUME) {
      return {
        value,
        shouldRewrite: false
      };
    }

    const clampedValue = clampMasterVolume(value);
    settingsLog.warn('client settings masterVolume is invalid; using normalized value', {
      value,
      normalizedValue: clampedValue
    });
    return {
      value: clampedValue,
      shouldRewrite: true
    };
  }

  settingsLog.warn('client settings masterVolume is invalid; using normalized value', {
    value,
    normalizedValue: DEFAULT_CLIENT_SETTINGS.masterVolume
  });
  return {
    value: DEFAULT_CLIENT_SETTINGS.masterVolume,
    shouldRewrite: true
  };
}

function normalizeStoredRenderScalePreset(
  value: unknown,
  settingsLog: Log
): Readonly<{
  value: RenderScalePreset;
  shouldRewrite: boolean;
}> {
  if (value === undefined) {
    return {
      value: DEFAULT_CLIENT_SETTINGS.renderScalePreset,
      shouldRewrite: false
    };
  }

  if (isRenderScalePreset(value)) {
    return {
      value,
      shouldRewrite: false
    };
  }

  settingsLog.warn('client settings renderScalePreset is invalid; using default', {
    value,
    normalizedValue: DEFAULT_CLIENT_SETTINGS.renderScalePreset
  });
  return {
    value: DEFAULT_CLIENT_SETTINGS.renderScalePreset,
    shouldRewrite: true
  };
}

function normalizeMasterVolumeInput(value: number, settingsLog: Log): number {
  if (Number.isFinite(value)) {
    if (value >= MIN_MASTER_VOLUME && value <= MAX_MASTER_VOLUME) {
      return value;
    }

    const clampedValue = clampMasterVolume(value);
    settingsLog.warn('client settings masterVolume clamped to [0, 1]', {
      value,
      clampedValue
    });
    return clampedValue;
  }

  settingsLog.warn('client settings masterVolume is invalid; using default', {
    value,
    defaultValue: DEFAULT_CLIENT_SETTINGS.masterVolume
  });
  return DEFAULT_CLIENT_SETTINGS.masterVolume;
}

function persistSnapshot(
  storage: StorageApi | null,
  settings: ClientSettings,
  settingsLog: Log
): void {
  if (storage === null) {
    return;
  }

  try {
    storage.setItem(CLIENT_SETTINGS_STORAGE_KEY, serializeSnapshot(settings));
  } catch (error) {
    settingsLog.warn('client settings persistence write failed', {
      error: formatError(error)
    });
  }
}

function serializeSnapshot(settings: ClientSettings): string {
  const snapshot: PersistedClientSettingsV1 = {
    schemaVersion: CLIENT_SETTINGS_SCHEMA_VERSION,
    masterVolume: settings.masterVolume,
    renderScalePreset: settings.renderScalePreset
  };
  return JSON.stringify(snapshot);
}

function clampMasterVolume(value: number): number {
  return Math.min(MAX_MASTER_VOLUME, Math.max(MIN_MASTER_VOLUME, value));
}

function freezeSettings(settings: ClientSettings): ClientSettings {
  return Object.freeze({
    masterVolume: settings.masterVolume,
    renderScalePreset: settings.renderScalePreset
  });
}

function isRenderScalePreset(value: unknown): value is RenderScalePreset {
  return value === 'low' || value === 'medium' || value === 'high';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
