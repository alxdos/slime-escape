import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  ClientSettings,
  ClientSettingsStore,
  RenderScalePreset
} from '../settings/ClientSettingsStore';

import { createSettingsOverlay } from './SettingsOverlay';

class FakeStyle {
  cssText = '';
  display = '';
  background = '';
  color = '';
  border = '';
}

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style = new FakeStyle();
  readonly listeners = new Map<string, Array<() => void>>();
  parent: FakeElement | null = null;
  textContent = '';
  type = '';
  min = '';
  max = '';
  step = '';
  value = '';

  appendChild(child: FakeElement): FakeElement {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  remove(): void {
    if (this.parent === null) {
      return;
    }
    this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }

  addEventListener(type: string, listener: () => void): void {
    const bucket = this.listeners.get(type) ?? [];
    bucket.push(listener);
    this.listeners.set(type, bucket);
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener();
    }
  }
}

class FakeDocument {
  createElement(): FakeElement {
    return new FakeElement();
  }
}

function createClientSettingsStoreHarness(initial: Partial<ClientSettings> = {}) {
  let settings: ClientSettings = {
    masterVolume: 1,
    renderScalePreset: 'medium',
    ...initial
  };
  let listeners: Array<(settings: ClientSettings) => void> = [];

  return {
    store: {
      get(): ClientSettings {
        return settings;
      },
      setMasterVolume(value: number): void {
        settings = {
          ...settings,
          masterVolume: value
        };
        for (const listener of listeners) {
          listener(settings);
        }
      },
      setRenderScalePreset(preset: RenderScalePreset): void {
        settings = {
          ...settings,
          renderScalePreset: preset
        };
        for (const listener of listeners) {
          listener(settings);
        }
      },
      subscribe(listener: (settings: ClientSettings) => void): () => void {
        listeners.push(listener);
        return () => {
          listeners = listeners.filter((entry) => entry !== listener);
        };
      },
      dispose(): void {}
    } satisfies ClientSettingsStore,
    get(): ClientSettings {
      return settings;
    },
    setMasterVolume(value: number): void {
      this.store.setMasterVolume(value);
    },
    setRenderScalePreset(preset: RenderScalePreset): void {
      this.store.setRenderScalePreset(preset);
    }
  };
}

function findByRole(root: FakeElement, role: string): FakeElement {
  if (root.dataset['role'] === role) {
    return root;
  }
  for (const child of root.children) {
    const match = findByRoleOptional(child, role);
    if (match !== null) {
      return match;
    }
  }
  throw new Error(`role ${role} not found`);
}

function findByRoleOptional(root: FakeElement, role: string): FakeElement | null {
  if (root.dataset['role'] === role) {
    return root;
  }
  for (const child of root.children) {
    const match = findByRoleOptional(child, role);
    if (match !== null) {
      return match;
    }
  }
  return null;
}

const originalDocument = globalThis.document;

afterEach(() => {
  if (originalDocument === undefined) {
    delete (globalThis as Partial<typeof globalThis>).document;
    return;
  }
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: originalDocument
  });
});

describe('createSettingsOverlay', () => {
  it('wires slider and preset buttons to the store and keeps the UI in sync', () => {
    const fakeDocument = new FakeDocument();
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: fakeDocument
    });

    const parent = new FakeElement();
    const store = createClientSettingsStoreHarness({
      masterVolume: 0.4,
      renderScalePreset: 'medium'
    });
    const onClose = vi.fn();
    const onButtonClick = vi.fn();

    createSettingsOverlay({
      parent: parent as unknown as HTMLElement,
      store: store.store,
      onClose,
      onButtonClick
    });

    const root = findByRole(parent, 'settings-overlay');
    const volumeInput = findByRole(root, 'settings-master-volume');
    const volumeValue = findByRole(root, 'settings-master-volume-value');
    const lowButton = findByRole(root, 'settings-render-scale-low');
    const mediumButton = findByRole(root, 'settings-render-scale-medium');
    const highButton = findByRole(root, 'settings-render-scale-high');
    const closeButton = findByRole(root, 'settings-close');

    expect(volumeInput.value).toBe('0.40');
    expect(volumeValue.textContent).toBe('40%');
    expect(mediumButton.dataset['selected']).toBe('true');

    volumeInput.value = '0.70';
    volumeInput.dispatch('input');
    expect(store.get().masterVolume).toBe(0.7);

    lowButton.dispatch('click');
    expect(onButtonClick).toHaveBeenCalledTimes(1);
    expect(store.get().renderScalePreset).toBe('low');

    store.setMasterVolume(0.2);
    store.setRenderScalePreset('high');
    expect(volumeInput.value).toBe('0.20');
    expect(volumeValue.textContent).toBe('20%');
    expect(highButton.dataset['selected']).toBe('true');
    expect(lowButton.dataset['selected']).toBe('false');

    closeButton.dispatch('click');
    expect(onButtonClick).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes from the store on dispose', () => {
    const fakeDocument = new FakeDocument();
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: fakeDocument
    });

    const parent = new FakeElement();
    const store = createClientSettingsStoreHarness({
      masterVolume: 0.3,
      renderScalePreset: 'medium'
    });

    const overlay = createSettingsOverlay({
      parent: parent as unknown as HTMLElement,
      store: store.store,
      onClose(): void {}
    });

    const root = findByRole(parent, 'settings-overlay');
    const volumeInput = findByRole(root, 'settings-master-volume');

    overlay.dispose();
    store.setMasterVolume(0.9);

    expect(volumeInput.value).toBe('0.30');
    expect(findByRoleOptional(parent, 'settings-overlay')).toBeNull();
  });
});
