import { describe, expect, it, vi } from 'vitest';

import type { Snapshot } from '../../shared/snapshot';
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
  it('reuses standard HUD affordances with local weaponHud slots', () => {
    withFakeDocument(() => {
      const parent = new FakeElement('div');
      const affordances = createPublicArenaCombatAffordances({
        parent: asHtmlElement(parent)
      });

      const root = requireElement(findByDataset(parent, 'role', 'public-arena-combat-affordances'));
      const movementHint = requireElement(findByDataset(root, 'role', 'hud-movement-hint'));
      const fireHint = requireElement(findByDataset(root, 'role', 'hud-fire-hint'));
      const weaponBar = requireElement(findByDataset(root, 'role', 'hud-weapon-bar'));
      expect(weaponBar.style.display).toBe('none');

      affordances.update(publicArenaSnapshotWithSelectedWeapon(0), 'self');

      const weaponSlots = findAllByDataset(weaponBar, 'weaponSlot');
      const weaponImage = slotImage(weaponSlots[0]);

      expect(movementHint.children.map((child) => child.textContent)).toEqual(['W', 'A', 'S', 'D']);
      expect(fireHint.children.some((child) => child.textContent === 'Left click: shoot')).toBe(
        true
      );
      expect(weaponSlots).toHaveLength(2);
      expect(weaponSlots[0]?.dataset['weaponSlot']).toBe('0');
      expect(weaponSlots[1]?.dataset['weaponSlot']).toBe('1');
      expect(weaponImage.src).toBe(PROJECTILE_VISUALS['rock-thrower']?.image);
      expect(weaponBar.style.display).toBe('flex');
      expect(slotFrame(weaponSlots[0]).style.borderColor).toBe('rgba(255,255,255,0.94)');
      expect(slotFrame(weaponSlots[1]).style.borderColor).toBe('rgba(255,255,255,0.18)');
      expect(slotCooldownFill(weaponSlots[0]).style.height).toBe('50%');
      expect(slotBadges(weaponSlots[0]).children).toHaveLength(2);

      affordances.update(publicArenaSnapshotWithSelectedWeapon(1), 'self');

      expect(slotFrame(weaponSlots[0]).style.borderColor).toBe('rgba(255,255,255,0.18)');
      expect(slotFrame(weaponSlots[1]).style.borderColor).toBe('rgba(255,255,255,0.94)');

      affordances.update(publicArenaSnapshotWithoutWeaponHud(), 'self');

      expect(weaponBar.style.display).toBe('none');

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

function publicArenaSnapshotWithSelectedWeapon(selectedWeaponIndex: number): Snapshot {
  return {
    simTimeMs: 120,
    entities: [
      {
        id: 1,
        kind: 'player',
        playerId: 'self',
        x: 0,
        y: 0,
        hp: 20,
        maxHp: 20,
        state: 'alive',
        formArchetypeId: 'slime-one-eye',
        weaponHud: {
          selectedIndex: selectedWeaponIndex,
          weapons: [
            {
              index: 0,
              weaponArchetypeId: 'rock-thrower',
              cooldownStartedAtSimMs: 20,
              cooldownReadyAtSimMs: 220,
              modifiers: [{ kind: 'pierceBonus', amount: 1 }],
              timedEffects: [
                {
                  kind: 'temporaryOverdrive',
                  cooldownMultiplier: 0.5,
                  startedAtSimMs: 20,
                  expiresAtSimMs: 220
                }
              ]
            },
            {
              index: 1,
              weaponArchetypeId: 'pistol',
              cooldownStartedAtSimMs: 0,
              cooldownReadyAtSimMs: 0,
              modifiers: [],
              timedEffects: []
            }
          ]
        },
        statusEffects: []
      }
    ],
    encounter: null,
    zone: { mode: 'disabled', margin: 0 },
    waveProgress: null,
    bossHud: null,
    lastInputSequence: {}
  };
}

function publicArenaSnapshotWithoutWeaponHud(): Snapshot {
  return {
    ...publicArenaSnapshotWithSelectedWeapon(0),
    entities: [
      {
        id: 1,
        kind: 'player',
        playerId: 'self',
        x: 0,
        y: 0,
        hp: 20,
        maxHp: 20,
        state: 'alive',
        formArchetypeId: 'slime-one-eye',
        weaponHud: null,
        statusEffects: []
      }
    ]
  };
}

function slotBadges(slot: FakeElement | undefined): FakeElement {
  const badges = slot?.children[0];
  if (badges === undefined) {
    throw new Error('expected weapon slot badge row');
  }
  return badges;
}

function slotFrame(slot: FakeElement | undefined): FakeElement {
  const frame = slot?.children[1];
  if (frame === undefined) {
    throw new Error('expected weapon slot frame');
  }
  return frame;
}

function slotCooldownFill(slot: FakeElement | undefined): FakeElement {
  const fill = slotFrame(slot).children[1];
  if (fill === undefined) {
    throw new Error('expected weapon slot cooldown fill');
  }
  return fill;
}

function slotImage(slot: FakeElement | undefined): FakeElement {
  const image = slotFrame(slot).children[2];
  if (image === undefined) {
    throw new Error('expected weapon slot image');
  }
  return image;
}
