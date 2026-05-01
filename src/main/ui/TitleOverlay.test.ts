import { describe, expect, it } from 'vitest';

import type { EncounterDefinition, SessionDefinition } from '../../shared/session';
import type { Snapshot } from '../../shared/snapshot';
import type { SnapshotPair } from '../sim/SimWorkerHost';

import { createTitleOverlay, deriveTitleOverlayViewModel } from './TitleOverlay';

function makeSession(
  encounters: ReadonlyArray<EncounterDefinition>,
  overrides: Partial<Omit<SessionDefinition, 'players' | 'dynamicRoster'>> = {}
): SessionDefinition {
  return {
    id: 'title-overlay-session',
    seed: 1,
    arena: { width: 16, height: 9 },
    dynamicRoster: false,
    players: [
      {
        id: 'title-overlay-player',
        position: { x: 0, y: 0 },
        radius: 0.5,
        contactBox: { width: 1, height: 1 },
        maxSpeed: 5,
        maxHp: 5,
        loadout: { weapons: ['pistol'], selectedIndex: 0 },
        companion: null
      }
    ],
    backgrounds: [],
    musicSampleId: null,
    modifiers: [],
    rules: {
      damage: { slimeFriendlyFire: false, playerVsPlayerDamage: false },
      aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 }
    },
    encounters,
    winCondition: { kind: 'allEncountersComplete' },
    lossCondition: { kind: 'playerDeath' },
    playerCoopRevive: null,
    uiMeta: null,
    ...overrides
  };
}

function wave(id: string, name: string | null, introDurationMs = 2500): EncounterDefinition {
  return {
    id,
    type: 'wave',
    backgroundId: null,
    introDurationMs,
    name,
    text: null,
    spawnPlan: { kind: 'wave', spawns: [], spawnIntervalMs: 1000, maxAlive: 2 },
    zoneBehavior: { kind: 'disabled' },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
    tuning: null
  };
}

function breakEncounter(id: string, text: string | null): EncounterDefinition {
  return {
    id,
    type: 'break',
    backgroundId: null,
    introDurationMs: 0,
    name: null,
    text,
    spawnPlan: { kind: 'empty' },
    zoneBehavior: { kind: 'disabled' },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'timer', durationMs: 1000, next: 'sequential' },
    tuning: null
  };
}

function bossEncounter(id: string): EncounterDefinition {
  return {
    id,
    type: 'boss',
    backgroundId: null,
    introDurationMs: 0,
    name: null,
    text: null,
    spawnPlan: { kind: 'boss', bossArchetypeId: 'test-boss', position: { x: 0, y: 0 } },
    zoneBehavior: { kind: 'disabled' },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
    tuning: null
  };
}

type TestEncounterSnapshot =
  Omit<NonNullable<Snapshot['encounter']>, 'waveOrdinal'> &
    Partial<Pick<NonNullable<Snapshot['encounter']>, 'waveOrdinal'>>;

function snapshot(
  encounter: TestEncounterSnapshot | null
): Snapshot {
  return {
    simTimeMs: 0,
    entities: [],
    encounter:
      encounter === null
        ? null
        : {
            waveOrdinal: encounter.type === 'wave' ? encounter.index + 1 : null,
            ...encounter
          },
    zone: { mode: 'disabled', margin: 0 },
    waveProgress: null,
    bossHud: null,
    lastInputSequence: {}
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

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = {};
  textContent = '';
  parent: FakeElement | null = null;

  appendChild(child: FakeElement): void {
    child.parent = this;
    this.children.push(child);
  }

  remove(): void {
    if (this.parent === null) return;
    this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
}

class FakeDocument {
  createElement(): FakeElement {
    return new FakeElement();
  }
}

describe('TitleOverlay view model', () => {
  it('shows wave title with global numbering during intro', () => {
    const session = makeSession([
      wave('set-1-wave-1', 'First'),
      wave('set-1-wave-2', 'Second'),
      breakEncounter('set-1-pre-boss-break', null),
      bossEncounter('set-1-boss'),
      breakEncounter('set-1-after-boss-break', 'Next'),
      wave('set-2-wave-1', 'One Eye in the Dark')
    ]);

    const view = deriveTitleOverlayViewModel(
      session,
      snapshot({ id: 'set-2-wave-1', type: 'wave', index: 5, elapsedMs: 1000 })
    );

    expect(view).toMatchObject({
      kind: 'wave',
      titleText: 'Wave 3',
      nameText: 'One Eye in the Dark',
      opacity: 1
    });
  });

  it('keeps global numbering for consecutive waves', () => {
    const session = makeSession([
      wave('wave-1', 'First'),
      wave('wave-2', 'Second'),
      wave('wave-3', 'Third')
    ]);

    const view = deriveTitleOverlayViewModel(
      session,
      snapshot({ id: 'wave-3', type: 'wave', index: 2, elapsedMs: 1000 })
    );

    expect(view).toMatchObject({
      kind: 'wave',
      titleText: 'Wave 3',
      nameText: 'Third'
    });
  });

  it('uses the Dungeon snapshot wave ordinal when authored waves loop', () => {
    const session = makeSession(
      [wave('dungeon-wave-1', 'First'), wave('dungeon-wave-2', 'Second')],
      { winCondition: { kind: 'dungeon' } }
    );

    const view = deriveTitleOverlayViewModel(
      session,
      snapshot({
        id: 'dungeon-wave-1',
        type: 'wave',
        index: 0,
        elapsedMs: 1000,
        waveOrdinal: 12
      })
    );

    expect(view).toMatchObject({
      kind: 'wave',
      titleText: 'Wave 12',
      nameText: 'First'
    });
  });

  it('hides wave title outside the intro window', () => {
    const session = makeSession([wave('wave-1', 'First')]);

    expect(
      deriveTitleOverlayViewModel(
        session,
        snapshot({ id: 'wave-1', type: 'wave', index: 0, elapsedMs: 2500 })
      )
    ).toEqual({ kind: 'hidden' });
  });

  it('shows break transition text for the full break encounter', () => {
    const session = makeSession([breakEncounter('after-boss-break', 'Scrap Ghosts Ahead')]);

    expect(
      deriveTitleOverlayViewModel(
        session,
        snapshot({ id: 'after-boss-break', type: 'break', index: 0, elapsedMs: 900 })
      )
    ).toEqual({
      kind: 'break',
      text: 'Scrap Ghosts Ahead',
      opacity: 1
    });
  });

  it('renders, freezes while paused, hides on detach, and removes itself on dispose', () => {
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: new FakeDocument()
    });

    try {
      const parent = new FakeElement();
      const session = makeSession([wave('wave-1', 'First wave')]);
      const overlay = createTitleOverlay({ parent: parent as unknown as HTMLElement });

      overlay.attach(session);
      const root = parent.children[0]!;
      const titleLine = root.children[0]!;
      const subtitleLine = root.children[1]!;

      overlay.update(
        snapshotPair(snapshot({ id: 'wave-1', type: 'wave', index: 0, elapsedMs: 1000 })),
        { kind: 'running' }
      );

      expect(root.style.display).toBe('flex');
      expect(titleLine.textContent).toBe('Wave 1');
      expect(subtitleLine.textContent).toBe('First wave');
      expect(titleLine.style.cssText).toContain('font-size:28px');
      expect(subtitleLine.style.cssText).toContain('font-size:44px');

      overlay.update(
        snapshotPair(snapshot({ id: 'wave-1', type: 'wave', index: 0, elapsedMs: 2500 })),
        { kind: 'paused' }
      );

      expect(root.style.display).toBe('flex');
      expect(titleLine.textContent).toBe('Wave 1');

      overlay.detach();
      expect(root.style.display).toBe('none');

      overlay.dispose();
      expect(parent.children).toHaveLength(0);
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
  });

  it('uses smaller wave title text in mobile mode', () => {
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: new FakeDocument()
    });

    try {
      const parent = new FakeElement();
      const session = makeSession([wave('wave-1', 'First wave')]);
      const overlay = createTitleOverlay({
        parent: parent as unknown as HTMLElement,
        isMobile: true
      });

      overlay.attach(session);
      const root = parent.children[0]!;
      const titleLine = root.children[0]!;
      const subtitleLine = root.children[1]!;

      overlay.update(
        snapshotPair(snapshot({ id: 'wave-1', type: 'wave', index: 0, elapsedMs: 1000 })),
        { kind: 'running' }
      );

      expect(titleLine.textContent).toBe('Wave 1');
      expect(subtitleLine.textContent).toBe('First wave');
      expect(titleLine.style.cssText).toContain('font-size:22px');
      expect(subtitleLine.style.cssText).toContain('font-size:30px');

      overlay.dispose();
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
  });
});
