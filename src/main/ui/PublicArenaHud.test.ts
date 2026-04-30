import { afterEach, describe, expect, it } from 'vitest';

import { createPublicArenaHud } from './PublicArenaHud';

class FakeStyle {
  cssText = '';
  display = '';
}

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style = new FakeStyle();
  parent: FakeElement | null = null;
  textContent = '';

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
}

class FakeDocument {
  createElement(_tagName: string): FakeElement {
    return new FakeElement();
  }
}

const originalDocument = globalThis.document;

afterEach(() => {
  if (originalDocument === undefined) {
    delete (globalThis as Partial<typeof globalThis>).document;
  } else {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: originalDocument
    });
  }
});

describe('PublicArenaHud', () => {
  it('shows current level and arena population from online snapshots', () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: new FakeDocument()
    });

    const parent = document.createElement('div');
    const hud = createPublicArenaHud({ parent });

    hud.show();
    hud.update(makeSnapshot(), 200);

    expect(hud.isVisible()).toBe(true);
    expect(findByRole(parent, 'public-arena-hud-level').textContent).toBe('Level 4');
    expect(findByRole(parent, 'public-arena-hud-population').textContent).toBe(
      'Players 12/200'
    );

    hud.hide();

    expect(hud.isVisible()).toBe(false);
    expect(findByRole(parent, 'public-arena-hud').style.display).toBe('none');
  });
});

function makeSnapshot() {
  return {
    simTimeMs: 120,
    selfId: 'self',
    arena: { width: 40, height: 40, minX: -20, maxX: 20, minY: -20, maxY: 20 },
    population: 12,
    players: [
      {
        id: 'self',
        x: 1,
        y: 2,
        hp: 28,
        maxHp: 40,
        level: 4,
        form: { kind: 'slime', archetypeId: 'slime-hornling' }
      }
    ],
    projectiles: []
  } as const;
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
