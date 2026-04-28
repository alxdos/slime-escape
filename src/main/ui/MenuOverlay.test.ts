import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMenuOverlay } from './MenuOverlay';

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
  title = '';
  src = '';
  alt = '';
  draggable = true;
  offsetWidth = 44;

  appendChild(child: FakeElement): FakeElement {
    child.parent?.remove();
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

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
}

class FakeDocument {
  createElement(_tagName: string): FakeElement {
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

describe('MenuOverlay', () => {
  it('renders the shared social link rail as a secondary side affordance', () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: new FakeDocument()
    });

    const parent = document.createElement('div');
    createMenuOverlay({
      parent,
      modes: [],
      onStart() {},
      onStartTraining() {},
      onOpenSettings() {},
      onToggleFullscreen() {},
      onOpenScreen() {},
      onBackToMainMenu() {},
      onTeaser() {},
      onSubscreenTeaser() {},
      onButtonHover() {},
      onModeSwitch() {}
    });

    const root = findByRole(parent, 'menu-overlay');
    const stage = findByRole(root, 'menu-stage');
    const socialRail = findByRole(stage, 'social-link-rail');
    const socialLinks = findAllByRole(stage, 'social-link');
    const style = root.children[0] as HTMLElement | undefined;

    expect(socialRail.dataset['placement']).toBe('menu');
    expect(socialRail.style.cssText).toContain('left:3.4%');
    expect(socialRail.style.cssText).toContain('top:38%');
    expect(socialRail.style.cssText).toContain('scale(0.9)');
    expect(style?.textContent).toContain('.menu-social-link-rail');
    expect(style?.textContent).toContain('max-width: 560px');
    expect(socialLinks.map((link) => link.dataset['socialLinkId'])).toEqual([
      'github',
      'discord'
    ]);
    expect(socialLinks[0]?.getAttribute('href')).toBe(
      'https://github.com/alxdos/slime-escape'
    );
    expect(socialLinks[0]?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(socialLinks[1]?.getAttribute('href')).toBe('https://discord.gg/rUwc52wc6v');
    expect(socialLinks[1]?.getAttribute('target')).toBe('_blank');
  });
});

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
