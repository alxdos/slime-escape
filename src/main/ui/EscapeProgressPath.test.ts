import { describe, expect, it } from 'vitest';

import type { EncounterDefinition, SessionDefinition } from '../../shared/session';
import type { Snapshot } from '../../shared/snapshot';
import type { SnapshotPair } from '../sim/SimWorkerHost';

import { createEscapeProgressPath } from './EscapeProgressPath';

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  parent: FakeElement | null = null;
  textContent = '';
  className = '';

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
  createElement(): FakeElement {
    return new FakeElement();
  }
}

describe('EscapeProgressPath', () => {
  it('renders compact wave progress, expanded break progress, freezes paused state, and detaches', () => {
    withFakeDocument(() => {
      const parent = new FakeElement();
      const session = makeSession([
        wave('wave-1'),
        breakEncounter('break-1'),
        wave('wave-2')
      ]);
      const path = createEscapeProgressPath({ parent: asHtmlElement(parent) });

      path.attach(session);
      const root = childAt(parent, 0);
      const style = childAt(root, 0);
      const label = childAt(root, 1);
      const track = childAt(root, 2);
      const footer = childAt(root, 3);
      expect(style.textContent).toContain('prefers-reduced-motion');
      expect(style.textContent).toContain('max-width: calc(100vw - 24px)');

      path.update(
        snapshotPair(snapshot({ id: 'wave-1', type: 'wave', index: 0, elapsedMs: 200 })),
        { kind: 'running' }
      );

      expect(root.style.display).toBe('grid');
      expect(root.dataset['presentation']).toBe('compact');
      expect(label.textContent).toBe('Wave 1/2');
      expect(footer.textContent).toBe('');
      expect(trackStates(track)).toEqual(['active', 'upcoming', 'pending']);
      expect(childAt(track, 0).style.cssText).toContain('#ffd166');
      expect(childAt(track, 0).style.cssText).toContain('width:20px');
      expect(label.style.cssText).toContain('font-size:17px');

      path.update(
        snapshotPair(snapshot({ id: 'break-1', type: 'break', index: 1, elapsedMs: 100 })),
        { kind: 'running' }
      );

      expect(root.dataset['presentation']).toBe('expandedBreak');
      expect(label.textContent).toBe('Wave 1 cleared');
      expect(footer.textContent).toBe('Exit in 1 wave');
      expect(trackStates(track)).toEqual(['completed', 'upcoming', 'pending']);

      path.update(
        snapshotPair(snapshot({ id: 'wave-2', type: 'wave', index: 2, elapsedMs: 100 })),
        { kind: 'paused' }
      );

      expect(root.dataset['presentation']).toBe('expandedBreak');
      expect(label.textContent).toBe('Wave 1 cleared');

      path.update(
        snapshotPair(snapshot({ id: 'wave-2', type: 'wave', index: 2, elapsedMs: 100 })),
        { kind: 'running' }
      );

      expect(root.dataset['presentation']).toBe('compact');
      expect(label.textContent).toBe('Wave 2/2');
      expect(trackStates(track)).toEqual(['completed', 'active', 'pending']);

      path.update(
        snapshotPair(snapshot({ id: 'wave-2', type: 'wave', index: 2, elapsedMs: 100 })),
        { kind: 'menu' }
      );

      expect(root.style.display).toBe('none');

      path.detach();
      expect(root.style.display).toBe('none');

      path.dispose();
      expect(parent.children).toHaveLength(0);
    });
  });

  it('hides sessions without wave progress', () => {
    withFakeDocument(() => {
      const parent = new FakeElement();
      const path = createEscapeProgressPath({ parent: asHtmlElement(parent) });
      path.attach(makeSession([breakEncounter('break-1')]));

      path.update(
        snapshotPair(snapshot({ id: 'break-1', type: 'break', index: 0, elapsedMs: 100 })),
        { kind: 'running' }
      );

      expect(childAt(parent, 0).style.display).toBe('none');
    });
  });
});

function withFakeDocument(run: () => void): void {
  const originalDocument = globalThis.document;
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: new FakeDocument()
  });
  try {
    run();
  } finally {
    if (originalDocument === undefined) {
      delete (globalThis as Partial<typeof globalThis>).document;
    } else {
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: originalDocument
      });
    }
  }
}

function asHtmlElement(element: FakeElement): HTMLElement {
  return element as unknown as HTMLElement;
}

function childAt(root: FakeElement, index: number): FakeElement {
  const child = root.children[index];
  if (child === undefined) {
    throw new Error(`expected child ${index}`);
  }
  return child;
}

function trackStates(track: FakeElement): ReadonlyArray<string> {
  return track.children.map((child) => child.dataset['state'] ?? '');
}

function makeSession(encounters: ReadonlyArray<EncounterDefinition>): SessionDefinition {
  return {
    id: 'escape-progress-live-test',
    seed: 1,
    arena: { width: 16, height: 9 },
    player: {
      position: { x: 0, y: 0 },
      radius: 0.5,
      contactBox: { width: 1, height: 1 },
      maxSpeed: 5,
      maxHp: 5
    },
    companion: null,
    loadout: { weapons: ['pistol'], selectedIndex: 0 },
    backgrounds: [],
    musicSampleId: null,
    modifiers: [],
    rules: {
      damage: { slimeFriendlyFire: false },
      aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 }
    },
    encounters,
    winCondition: { kind: 'allEncountersComplete' },
    lossCondition: { kind: 'playerDeath' },
    uiMeta: null
  };
}

function wave(id: string): EncounterDefinition {
  return {
    id,
    type: 'wave',
    backgroundId: null,
    introDurationMs: 0,
    name: null,
    text: null,
    spawnPlan: { kind: 'wave', spawns: [], spawnIntervalMs: 1000, maxAlive: 2 },
    zoneBehavior: { kind: 'disabled' },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
    tuning: null
  };
}

function breakEncounter(id: string): EncounterDefinition {
  return {
    id,
    type: 'break',
    backgroundId: null,
    introDurationMs: 0,
    name: null,
    text: 'Next',
    spawnPlan: { kind: 'empty' },
    zoneBehavior: { kind: 'disabled' },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'timer', durationMs: 1000, next: 'sequential' },
    tuning: null
  };
}

type TestEncounterSnapshot =
  Omit<NonNullable<Snapshot['encounter']>, 'waveOrdinal'> &
    Partial<Pick<NonNullable<Snapshot['encounter']>, 'waveOrdinal'>>;

function snapshot(encounter: TestEncounterSnapshot): Snapshot {
  return {
    simTimeMs: 0,
    entities: [],
    encounter: {
      waveOrdinal: encounter.type === 'wave' ? encounter.index + 1 : null,
      ...encounter
    },
    zone: { mode: 'disabled', margin: 0 },
    waveProgress: null,
    bossHud: null,
    weaponHud: null
  };
}

function snapshotPair(curr: Snapshot | null): SnapshotPair {
  return {
    prev: null,
    curr,
    currReceivedAtMs: 0,
    nowMs: 0
  };
}
