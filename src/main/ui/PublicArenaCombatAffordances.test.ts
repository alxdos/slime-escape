import { describe, expect, it, vi } from 'vitest';

import { PUBLIC_ARENA_LOADOUT } from '../../shared/content/publicArena';
import { PROJECTILE_VISUALS } from '../render/projectileVisuals';

import { createPublicArenaCombatAffordances } from './PublicArenaCombatAffordances';

class FakeStyle {
  cssText = '';
  display = '';
  height = '';
  borderColor = '';
  background = '';
  boxShadow = '';
}

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style = new FakeStyle();
  readonly attributes = new Map<string, string>();
  parent: FakeElement | null = null;
  draggable = true;
  textContent = '';
  src = '';

  constructor(readonly tagName: string) {}

  set alt(value: string) {
    this.attributes.set('alt', value);
  }

  appendChild<T extends FakeElement>(child: T): T {
    child.parent?.removeChild(child);
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
    this.parent?.removeChild(this);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  private removeChild(child: FakeElement): void {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
    }
    child.parent = null;
  }
}

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName);
  }
}

function withFakeDocument(run: () => void): void {
  vi.stubGlobal('document', new FakeDocument() as unknown as Document);
  try {
    run();
  } finally {
    vi.unstubAllGlobals();
  }
}

function asHtmlElement(element: FakeElement): HTMLElement {
  return element as unknown as HTMLElement;
}

function findByDataset(root: FakeElement, key: string, value: string): FakeElement | null {
  if (root.dataset[key] === value) {
    return root;
  }
  for (const child of root.children) {
    const match = findByDataset(child, key, value);
    if (match !== null) {
      return match;
    }
  }
  return null;
}

function findAllByDataset(root: FakeElement, key: string): FakeElement[] {
  const matches: FakeElement[] = [];
  if (root.dataset[key] !== undefined) {
    matches.push(root);
  }
  for (const child of root.children) {
    matches.push(...findAllByDataset(child, key));
  }
  return matches;
}

function requireElement(element: FakeElement | null): FakeElement {
  if (element === null) {
    throw new Error('expected fake DOM element');
  }
  return element;
}

describe('PublicArenaCombatAffordances', () => {
  it('reuses standard HUD affordances with one selected rock weapon slot', () => {
    withFakeDocument(() => {
      const parent = new FakeElement('div');
      const affordances = createPublicArenaCombatAffordances({
        parent: asHtmlElement(parent)
      });

      const root = requireElement(findByDataset(parent, 'role', 'public-arena-combat-affordances'));
      const movementHint = requireElement(findByDataset(root, 'role', 'hud-movement-hint'));
      const fireHint = requireElement(findByDataset(root, 'role', 'hud-fire-hint'));
      const weaponBar = requireElement(findByDataset(root, 'role', 'hud-weapon-bar'));
      const weaponSlots = findAllByDataset(weaponBar, 'weaponSlot');
      const weaponImage = requireElement(findByTag(weaponSlots[0] ?? null, 'img'));
      const selectedWeaponId = PUBLIC_ARENA_LOADOUT.weapons[0];
      if (selectedWeaponId === undefined) {
        throw new Error('expected Public Arena portal loadout weapon');
      }

      expect(movementHint.children.map((child) => child.textContent)).toEqual(['W', 'A', 'S', 'D']);
      expect(fireHint.children.some((child) => child.textContent === 'Left click: shoot')).toBe(
        true
      );
      expect(weaponSlots).toHaveLength(PUBLIC_ARENA_LOADOUT.weapons.length);
      expect(weaponSlots[0]?.dataset['weaponSlot']).toBe('0');
      expect(PUBLIC_ARENA_LOADOUT.selectedIndex).toBe(0);
      expect(weaponImage.src).toBe(PROJECTILE_VISUALS[selectedWeaponId]?.image);
      expect(weaponBar.style.display).toBe('flex');

      expect(affordances.isVisible()).toBe(false);
      expect(root.style.display).toBe('none');

      affordances.show();
      expect(affordances.isVisible()).toBe(true);
      expect(root.style.display).toBe('block');

      affordances.hide();
      expect(affordances.isVisible()).toBe(false);
      expect(root.style.display).toBe('none');
    });
  });
});

function findByTag(root: FakeElement | null, tagName: string): FakeElement | null {
  if (root === null) {
    return null;
  }
  if (root.tagName === tagName) {
    return root;
  }
  for (const child of root.children) {
    const match = findByTag(child, tagName);
    if (match !== null) {
      return match;
    }
  }
  return null;
}
