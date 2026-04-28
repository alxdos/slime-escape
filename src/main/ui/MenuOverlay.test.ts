import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMenuOverlay } from './MenuOverlay';
import type { MenuLabViewModel } from './MenuLabViewModel';

class FakeStyle {
  cssText = '';
  display = '';
}

class FakeClassList {
  add(): void {}
  remove(): void {}
}

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style = new FakeStyle();
  readonly classList = new FakeClassList();
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
  vi.useRealTimers();
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
      lab: makeLabViewModel(),
      onStart() {},
      onStartTraining() {},
      onOpenSettings() {},
      onToggleFullscreen() {},
      onOpenScreen() {},
      onBackToMainMenu() {},
      onTeaser() {},
      onStartDungeon() {},
      onPurchasePet() {
        return { ok: false, reason: 'insufficientXp', quality: 'green', price: 25, totalXp: 0 };
      },
      onButtonHover() {},
      onModeSwitch() {},
      dungeonBestWave: 0
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

  it('starts Dungeon from the subscreen and renders the saved best number only', () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: new FakeDocument()
    });

    const onStartDungeon = vi.fn();
    const parent = document.createElement('div');
    const overlay = createMenuOverlay({
      parent,
      modes: [],
      lab: makeLabViewModel(),
      onStart() {},
      onStartTraining() {},
      onOpenSettings() {},
      onToggleFullscreen() {},
      onOpenScreen() {},
      onBackToMainMenu() {},
      onTeaser() {},
      onStartDungeon,
      onPurchasePet() {
        return { ok: false, reason: 'insufficientXp', quality: 'green', price: 25, totalXp: 0 };
      },
      onButtonHover() {},
      onModeSwitch() {},
      dungeonBestWave: 12
    });

    overlay.showScreen('dungeon');

    const root = findByRole(parent, 'menu-overlay');
    const bestWave = findByRole(root, 'menu-dungeon-best-wave');
    const buttons = findAllByRole(root, 'menu-subscreen-button');
    const dungeonPlay = buttons.find(
      (button) => button.dataset['controlId'] === 'dungeon-play'
    );

    expect(bestWave.textContent).toBe('12');
    expect(bestWave.style.cssText).toContain('left:31.6%');
    expect(bestWave.style.cssText).toContain('top:48.2%');
    expect(dungeonPlay?.dataset['controlKind']).toBe('start');
    expect(dungeonPlay?.dataset['soon']).toBeUndefined();

    (dungeonPlay as unknown as FakeElement).listeners.get('click')?.forEach((listener) => {
      listener();
    });

    expect(onStartDungeon).toHaveBeenCalledTimes(1);

    overlay.setDungeonBestWave(Number.NaN);
    expect(bestWave.textContent).toBe('0');
  });

  it('renders Lab prices, purchase reveal, dismiss animation, and complete state', () => {
    vi.useFakeTimers();
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: new FakeDocument()
    });

    const onPurchasePet = vi.fn((quality: 'green' | 'purple') => {
      if (quality === 'green') {
        return {
          ok: true,
          petId: 'green-a',
          quality,
          price: 25,
          totalXp: 5
        } as const;
      }
      return {
        ok: false,
        reason: 'insufficientXp',
        quality,
        price: 75,
        totalXp: 30
      } as const;
    });
    const parent = document.createElement('div');
    const overlay = createMenuOverlay({
      parent,
      modes: [],
      lab: makeLabViewModel({ totalXp: 30 }),
      onStart() {},
      onStartTraining() {},
      onOpenSettings() {},
      onToggleFullscreen() {},
      onOpenScreen() {},
      onBackToMainMenu() {},
      onTeaser() {},
      onStartDungeon() {},
      onPurchasePet,
      onButtonHover() {},
      onModeSwitch() {},
      dungeonBestWave: 0
    });

    overlay.showScreen('lab');

    const root = findByRole(parent, 'menu-overlay');
    const xpTotal = findByRole(root, 'menu-lab-xp-total');
    const greenStand = findStand(root, 'green');
    const purpleStand = findStand(root, 'purple');

    expect(xpTotal.textContent).toBe('XP 30');
    expect(greenStand.dataset['state']).toBe('price');
    expect(greenStand.dataset['affordable']).toBe('true');
    expect(findByRole(greenStand, 'menu-lab-stand-price').textContent).toBe('25 XP');
    expect(purpleStand.dataset['affordable']).toBe('false');

    click(greenStand);

    expect(onPurchasePet).toHaveBeenCalledWith('green');
    expect(greenStand.dataset['state']).toBe('revealed');
    expect(findByRoleOptional(greenStand, 'menu-lab-stand-price')).toBeNull();
    const revealedPet = findByRole(greenStand, 'menu-lab-revealed-pet');
    expect(revealedPet.dataset['petId']).toBe('green-a');
    expect(revealedPet.getAttribute('aria-label')).toBeNull();
    expect((revealedPet as unknown as FakeElement).src).toBe('/green-a.png');

    overlay.setLabViewModel(makeLabViewModel({ totalXp: 5, greenOwnedCount: 1 }));
    expect(xpTotal.textContent).toBe('XP 5');
    expect(greenStand.dataset['state']).toBe('revealed');

    click(greenStand);
    expect(findByRole(greenStand, 'menu-lab-revealed-pet').className).toContain(
      'menu-lab-pet-dismiss'
    );
    vi.advanceTimersByTime(220);

    expect(greenStand.dataset['state']).toBe('price');
    expect(findByRole(greenStand, 'menu-lab-stand-price').textContent).toBe('25 XP');

    click(purpleStand);
    expect(onPurchasePet).toHaveBeenCalledWith('purple');
    expect(purpleStand.dataset['state']).toBe('price');
    expect(findByRoleOptional(purpleStand, 'menu-lab-revealed-pet')).toBeNull();

    overlay.setLabViewModel(makeLabViewModel({ totalXp: 90, greenOwnedCount: 2 }));
    expect(greenStand.dataset['state']).toBe('complete');
    expect(findByRole(greenStand, 'menu-lab-stand-price').textContent).toBe('Complete');
    const callsBeforeCompleteClick = onPurchasePet.mock.calls.length;
    click(greenStand);
    expect(onPurchasePet).toHaveBeenCalledTimes(callsBeforeCompleteClick);
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

function findStand(root: HTMLElement, quality: 'green' | 'purple'): HTMLElement {
  const stand = findAllByRole(root, 'menu-lab-stand').find(
    (element) => element.dataset['quality'] === quality
  );
  if (stand === undefined) {
    throw new Error(`Lab stand ${quality} not found`);
  }
  return stand;
}

function click(element: HTMLElement): void {
  (element as unknown as FakeElement).listeners.get('click')?.forEach((listener) => {
    listener();
  });
}

function makeLabViewModel(
  options: Readonly<{
    totalXp?: number;
    greenOwnedCount?: number;
    purpleOwnedCount?: number;
  }> = {}
): MenuLabViewModel {
  const totalXp = options.totalXp ?? 30;
  const greenOwnedCount = options.greenOwnedCount ?? 0;
  const purpleOwnedCount = options.purpleOwnedCount ?? 0;

  return {
    totalXp,
    stands: {
      green: {
        quality: 'green',
        price: 25,
        affordable: greenOwnedCount < 2 && totalXp >= 25,
        complete: greenOwnedCount >= 2,
        ownedCount: greenOwnedCount,
        totalCount: 2
      },
      purple: {
        quality: 'purple',
        price: 75,
        affordable: purpleOwnedCount < 1 && totalXp >= 75,
        complete: purpleOwnedCount >= 1,
        ownedCount: purpleOwnedCount,
        totalCount: 1
      }
    },
    pets: {
      'green-a': {
        petId: 'green-a',
        displayName: 'Green A',
        quality: 'green',
        image: '/green-a.png'
      },
      'green-b': {
        petId: 'green-b',
        displayName: 'Green B',
        quality: 'green',
        image: '/green-b.png'
      },
      'purple-a': {
        petId: 'purple-a',
        displayName: 'Purple A',
        quality: 'purple',
        image: '/purple-a.png'
      }
    }
  };
}
