import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSocialLinkRail, SOCIAL_LINKS } from './SocialLinkRail';

class FakeStyle {
  cssText = '';
}

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style = new FakeStyle();
  readonly attributes = new Map<string, string>();
  parent: FakeElement | null = null;
  className = '';
  textContent = '';
  title = '';

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

describe('SocialLinkRail', () => {
  it('renders external GitHub and Discord anchors with local colorable icons', () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: new FakeDocument()
    });

    const rail = createSocialLinkRail();

    expect(rail.dataset['role']).toBe('social-link-rail');
    expect(rail.getAttribute('aria-label')).toBe('Project links');
    expect(rail.style.cssText).toContain('flex-direction:column');

    const links = findAllByRole(rail, 'social-link');
    expect(links).toHaveLength(2);
    expect(links.map((link) => link.dataset['socialLinkId'])).toEqual(['github', 'discord']);

    for (const [index, expected] of SOCIAL_LINKS.entries()) {
      const link = links[index];
      if (link === undefined) {
        throw new Error(`Missing social link ${expected.id}`);
      }
      expect(link.getAttribute('href')).toBe(expected.href);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('aria-label')).toBe(expected.label);
      expect(link.title).toBe(expected.label);

      const icon = findByRole(link, 'social-link-icon');
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(icon.style.cssText).toContain(expected.iconSrc);
      expect(icon.style.cssText).toContain('background:currentColor');
    }
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
