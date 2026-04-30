import { afterEach, describe, expect, it } from 'vitest';

import { createMobileControlsOverlay } from './MobileControlsOverlay';

const originalDocument = globalThis.document;

afterEach(() => {
  if (originalDocument === undefined) {
    delete (globalThis as Partial<typeof globalThis>).document;
    return;
  }
  Object.defineProperty(globalThis, 'document', {
    value: originalDocument,
    configurable: true
  });
});

class FakeStyle {
  cssText = '';
  display = '';
}

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style = new FakeStyle();
  readonly attributes = new Map<string, string>();
  parent: FakeElement | null = null;
  textContent = '';
  type = '';

  constructor(readonly tagName: string) {}

  appendChild(child: FakeElement): void {
    child.parent = this;
    this.children.push(child);
  }

  remove(): void {
    if (this.parent === null) return;
    this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}

describe('MobileControlsOverlay', () => {
  it('renders subtle touch affordances and exposes the pause button element', () => {
    installFakeDocument();
    const parent = new FakeElement('main');

    const overlay = createMobileControlsOverlay({
      parent: parent as unknown as HTMLElement
    });
    const root = requireElement(findByRole(parent, 'mobile-controls'));
    const pauseButton = requireElement(findByRole(root, 'mobile-pause-button'));

    expect(overlay.isVisible()).toBe(false);
    expect(root.style.display).toBe('none');
    expect(root.style.cssText).toContain('pointer-events:none');
    expect(findByRole(root, 'mobile-fire-affordance-left')).not.toBeNull();
    expect(findByRole(root, 'mobile-fire-affordance-right')).not.toBeNull();
    expect(findByRole(root, 'mobile-move-stick')).not.toBeNull();
    expect(findByRole(root, 'mobile-aim-stick')).not.toBeNull();
    expect(pauseButton.attributes.get('aria-label')).toBe('Pause');
    expect(pauseButton.style.cssText).toContain('pointer-events:auto');
    expect(overlay.pauseButtonElement()).toBe(pauseButton);

    overlay.show();
    expect(overlay.isVisible()).toBe(true);
    expect(root.style.display).toBe('block');

    overlay.hide();
    expect(overlay.isVisible()).toBe(false);
    expect(root.style.display).toBe('none');
  });
});

function installFakeDocument(): void {
  Object.defineProperty(globalThis, 'document', {
    value: {
      createElement(tagName: string): FakeElement {
        return new FakeElement(tagName);
      }
    },
    configurable: true
  });
}

function findByRole(root: FakeElement, role: string): FakeElement | null {
  if (root.dataset['role'] === role) {
    return root;
  }
  for (const child of root.children) {
    const found = findByRole(child, role);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

function requireElement(element: FakeElement | null): FakeElement {
  if (element === null) {
    throw new Error('expected element');
  }
  return element;
}
