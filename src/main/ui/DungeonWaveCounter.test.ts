import { describe, expect, it } from 'vitest';

import type { EncounterDefinition, SessionDefinition } from '../../shared/session';
import type { Snapshot } from '../../shared/snapshot';
import type { SnapshotPair } from '../sim/SimWorkerHost';

import {
  createDungeonWaveCounter,
  deriveDungeonWaveCounterViewModel
} from './DungeonWaveCounter';

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

  remove(): void {
    this.parent?.removeChild(this);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
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

describe('deriveDungeonWaveCounterViewModel', () => {
  it('shows the dungeon wave ordinal from the active encounter snapshot', () => {
    expect(
      deriveDungeonWaveCounterViewModel(
        makeSession({ winCondition: { kind: 'dungeon' } }),
        snapshot({ id: 'dungeon-wave-12', type: 'wave', index: 0, elapsedMs: 100, waveOrdinal: 12 })
      )
    ).toEqual({ kind: 'wave', ordinal: 12 });
  });

  it('hides outside dungeon and while no active wave ordinal exists', () => {
    expect(
      deriveDungeonWaveCounterViewModel(
        makeSession({ winCondition: { kind: 'allEncountersComplete' } }),
        snapshot({ id: 'wave-1', type: 'wave', index: 0, elapsedMs: 100, waveOrdinal: 1 })
      )
    ).toEqual({ kind: 'hidden' });

    expect(
      deriveDungeonWaveCounterViewModel(
        makeSession({ winCondition: { kind: 'dungeon' } }),
        snapshot({ id: 'dungeon-break', type: 'break', index: 1, elapsedMs: 100, waveOrdinal: null })
      )
    ).toEqual({ kind: 'hidden' });
  });
});

describe('DungeonWaveCounter', () => {
  it('renders top-right dungeon wave text, freezes while paused, and detaches', () => {
    withFakeDocument(() => {
      const parent = new FakeElement();
      const counter = createDungeonWaveCounter({ parent: asHtmlElement(parent) });
      counter.attach(makeSession({ winCondition: { kind: 'dungeon' } }));

      const root = childAt(parent, 0);
      const style = childAt(root, 0);
      const label = childAt(root, 1);
      const value = childAt(root, 2);
      expect(style.textContent).toContain('dungeon-wave-counter-value');
      expect(root.style.cssText).toContain('right:14px');
      expect(label.textContent).toBe('Wave');

      counter.update(
        snapshotPair(
          snapshot({ id: 'dungeon-wave-3', type: 'wave', index: 0, elapsedMs: 200, waveOrdinal: 3 })
        ),
        { kind: 'running' }
      );

      expect(root.style.display).toBe('grid');
      expect(value.textContent).toBe('3');
      expect(value.style.cssText).toContain('font-size:29px');
      expect(root.attributes.get('aria-label')).toBe('Dungeon wave 3');

      counter.update(
        snapshotPair(
          snapshot({ id: 'dungeon-wave-4', type: 'wave', index: 0, elapsedMs: 200, waveOrdinal: 4 })
        ),
        { kind: 'paused' }
      );

      expect(value.textContent).toBe('3');

      counter.update(
        snapshotPair(
          snapshot({ id: 'dungeon-wave-4', type: 'wave', index: 0, elapsedMs: 200, waveOrdinal: 4 })
        ),
        { kind: 'running' }
      );

      expect(value.textContent).toBe('4');

      counter.detach();
      expect(root.style.display).toBe('none');
      expect(value.textContent).toBe('');

      counter.dispose();
      expect(parent.children).toHaveLength(0);
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

function makeSession(overrides: Partial<SessionDefinition> = {}): SessionDefinition {
  return {
    id: 'dungeon-wave-counter-test',
    seed: 1,
    arena: { width: 16, height: 9 },
    player: {
      position: { x: 0, y: 0 },
      radius: 0.5,
      contactBox: { width: 1, height: 1 },
      maxSpeed: 5,
      maxHp: 5
    },
    loadout: { weapons: ['pistol'], selectedIndex: 0 },
    backgrounds: [],
    musicSampleId: null,
    modifiers: [],
    rules: {
      damage: { slimeFriendlyFire: false },
      aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 }
    },
    encounters: [wave('dungeon-wave-1')],
    winCondition: { kind: 'dungeon' },
    lossCondition: { kind: 'playerDeath' },
    uiMeta: null,
    ...overrides
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

function snapshot(encounter: NonNullable<Snapshot['encounter']>): Snapshot {
  return {
    simTimeMs: 0,
    entities: [],
    encounter,
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
