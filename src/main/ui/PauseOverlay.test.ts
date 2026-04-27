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
    const parent = document.createElement('div');
    const overlay = createPauseOverlay({
      parent,
      onResume() {},
      onExit() {},
      onOpenSettings() {}
    });

    const card = findByRole(parent, 'pause-card');
    const escapePath = findByRole(parent, 'pause-escape-path');
    const root = findByRole(parent, 'pause-overlay');
    const socialRail = findByRole(parent, 'social-link-rail');
    const socialLinks = findAllByRole(parent, 'social-link');
    const style = root.children[0];
    expect(findByRole(parent, 'pause-layout').style.cssText).toContain('gap:18px');
    expect(socialRail.dataset['placement']).toBe('pause');
    expect(style?.textContent).toContain('.pause-social-link-rail');
    expect(style?.textContent).toContain('max-width: 560px');
    expect(socialLinks.map((link) => link.dataset['socialLinkId'])).toEqual([
      'github',
      'discord'
    ]);
    expect(card.style.cssText).toContain('width:min(640px, calc(100vw - 120px))');
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

function findByRole(root: HTMLElement, role: string): HTMLElement {
  const match = findByRoleOptional(root, role);
  if (match === null) {
    throw new Error(`role ${role} not found`);
  }
  return match;
}

function findByRoleOptional(root: HTMLElement, role: string): HTMLElement | null {
  if (root.dataset['role'] === role) {
    return root;
  }
  for (const child of root.children) {
    const match = findByRoleOptional(child as HTMLElement, role);
    if (match !== null) {
      return match;
    }
  }
  return null;
}

function findAllByRole(root: HTMLElement, role: string): HTMLElement[] {
  const matches: HTMLElement[] = [];
  if (root.dataset['role'] === role) {
    matches.push(root);
  }
  for (const child of root.children) {
    matches.push(...findAllByRole(child as HTMLElement, role));
  }
  return matches;
}
