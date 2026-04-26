import { afterEach, describe, expect, it, vi } from 'vitest';

import { createResultOverlay } from './ResultOverlay';
import type { ResultViewModel } from './ResultViewModel';

class FakeStyle {
  cssText = '';
  display = '';
}

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style = new FakeStyle();
  readonly listeners = new Map<string, Array<() => void>>();
  parent: FakeElement | null = null;
  textContent = '';
  type = '';
  className = '';

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

function makeViewModel(outcome: 'win' | 'loss'): ResultViewModel {
  return {
    outcome,
    title: outcome === 'win' ? 'Победа!' : 'Забег окончен',
    subtitle:
      outcome === 'win' ? 'Ты выбрался из мира слаймов' : 'Слизни снова сомкнули ловушку',
    primaryStats: [],
    killRows: [],
    boss: null,
    defeatCause: null
  };
}

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

describe('createResultOverlay', () => {
  it('renders win and loss states in the comic modal style', () => {
    const fakeDocument = new FakeDocument();
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: fakeDocument
    });

    const parent = new FakeElement();
    const onBackToMenu = vi.fn();

    const overlay = createResultOverlay({
      parent: parent as unknown as HTMLElement,
      onBackToMenu
    });

    const root = findByRole(parent, 'result-overlay');
    const title = findByRole(root, 'result-title');
    const summary = findByRole(root, 'result-summary');
    const backButton = findByRole(root, 'result-back-to-menu');

    expect(root.style.display).toBe('none');
    expect(root.style.cssText).toContain('background:rgba(255,255,255,0.42)');
    expect(backButton.textContent).toBe('Вернуться в меню');
    expect(backButton.className).toBe('result-comic-button');

    overlay.show(makeViewModel('win'));
    expect(overlay.isVisible()).toBe(true);
    expect(root.style.display).toBe('flex');
    expect(root.dataset['outcome']).toBe('win');
    expect(title.textContent).toBe('Победа!');
    expect(summary.textContent).toBe('Ты выбрался из мира слаймов');
    expect(summary.style.cssText).toContain('background:#e9fbff');
    expect(backButton.style.cssText).toContain('background:#7cf58f');

    overlay.show(makeViewModel('loss'));
    expect(root.dataset['outcome']).toBe('loss');
    expect(title.textContent).toBe('Забег окончен');
    expect(summary.textContent).toBe('Слизни снова сомкнули ловушку');
    expect(summary.style.cssText).toContain('background:#ffe7f3');
    expect(backButton.style.cssText).toContain('background:#ff9fcf');

    backButton.dispatch('click');
    expect(onBackToMenu).toHaveBeenCalledTimes(1);

    overlay.hide();
    expect(overlay.isVisible()).toBe(false);
    expect(root.style.display).toBe('none');
    expect(root.dataset['outcome']).toBeUndefined();
    expect(title.textContent).toBe('');
    expect(summary.textContent).toBe('');
  });

  it('removes itself on dispose', () => {
    const fakeDocument = new FakeDocument();
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: fakeDocument
    });

    const parent = new FakeElement();
    const overlay = createResultOverlay({
      parent: parent as unknown as HTMLElement,
      onBackToMenu(): void {}
    });

    overlay.dispose();

    expect(findByRoleOptional(parent, 'result-overlay')).toBeNull();
  });
});
