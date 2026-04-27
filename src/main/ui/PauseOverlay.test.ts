import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPauseOverlay } from './PauseOverlay';
import type { EscapeProgressPathViewModel } from './EscapeProgressPathViewModel';

class FakeStyle {
  cssText = '';
  display = '';
}

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style = new FakeStyle();
  readonly listeners = new Map<string, Array<() => void>>();
  readonly attributes = new Map<string, string>();
  parent: FakeElement | null = null;
  textContent = '';
  type = '';
  className = '';

  appendChild(child: FakeElement): FakeElement {
    child.parent?.remove();
    child.parent = this;
    this.children.push(child);
    return child;
  }

  replaceChildren(...children: FakeElement[]): void {
    for (const child of this.children) {
      child.parent = null;
    }
    this.children.length = 0;
    for (const child of children) {
      this.appendChild(child);
    }
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

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}

class FakeDocument {
  createElement(): FakeElement {
    return new FakeElement();
  }
}

const originalDocument = globalThis.document;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalDocument === undefined) {
    delete (globalThis as Partial<typeof globalThis>).document;
  } else {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: originalDocument
    });
  }
});

describe('PauseOverlay', () => {
  it('renders the current escape path inside the pause card and clears it on hide', () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: new FakeDocument()
    });
    const parent = new FakeElement();
    const overlay = createPauseOverlay({
      parent: parent as unknown as HTMLElement,
      onResume() {},
      onExit() {},
      onOpenSettings() {}
    });

    const escapePath = findByRole(parent, 'pause-escape-path');
    const card = findByRole(parent, 'pause-card');
    expect(card.style.cssText).toContain('width:min(640px, calc(100vw - 48px))');
    expect(card.style.cssText).toContain('max-height:calc(100vh - 48px)');
    expect(escapePath.style.display).toBe('none');

    overlay.setEscapePath(makeEscapePathViewModel());
    overlay.show();

    expect(escapePath.style.display).toBe('grid');
    expect(findByRole(escapePath, 'pause-escape-path-label').textContent).toBe('Wave 2/3');
    expect(findByRole(escapePath, 'pause-escape-path-text').textContent).toBe(
      'Exit in 2 waves'
    );
    const points = findAllByRole(escapePath, 'pause-escape-path-point');
    expect(points.map((point) => point.dataset['state'])).toEqual([
      'completed',
      'active',
      'upcoming'
    ]);
    expect(points[1]?.style.cssText).toContain('#ffd166');
    expect(findByRole(escapePath, 'pause-escape-path-flag').dataset['state']).toBe('pending');

    overlay.hide();
    expect(escapePath.style.display).toBe('none');
    expect(escapePath.children).toHaveLength(0);
  });
});

function makeEscapePathViewModel(): EscapeProgressPathViewModel {
  return {
    kind: 'path',
    presentation: 'compact',
    totalWaves: 3,
    completedWaves: 1,
    activeWaveIndex: 2,
    points: [
      { index: 1, state: 'completed', label: 'Wave 1' },
      { index: 2, state: 'active', label: 'Wave 2' },
      { index: 3, state: 'upcoming', label: 'Wave 3' }
    ],
    stop: { kind: 'none' },
    flagState: 'pending'
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

function findAllByRole(root: FakeElement, role: string): FakeElement[] {
  const matches: FakeElement[] = [];
  if (root.dataset['role'] === role) {
    matches.push(root);
  }
  for (const child of root.children) {
    matches.push(...findAllByRole(child, role));
  }
  return matches;
}
