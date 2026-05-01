import { describe, expect, it } from 'vitest';

import type { EncounterDefinition, SessionDefinition } from '../../shared/session';
import type { SessionResultSummary } from '../../shared/sessionResult';
import type { Snapshot } from '../../shared/snapshot';

import {
  deriveLiveEscapeProgressPathViewModel,
  deriveResultEscapeProgressPathViewModel
} from './EscapeProgressPathViewModel';

describe('deriveLiveEscapeProgressPathViewModel', () => {
  it('marks completed waves before an active wave and highlights the current wave', () => {
    const session = makeSession([
      wave('wave-1'),
      breakEncounter('break-1'),
      bossEncounter('boss-1'),
      wave('wave-2')
    ]);

    const view = deriveLiveEscapeProgressPathViewModel(
      session,
      snapshot({ id: 'wave-2', type: 'wave', index: 3, elapsedMs: 1200 })
    );

    expect(view).toMatchObject({
      kind: 'path',
      presentation: 'compact',
      totalWaves: 2,
      completedWaves: 1,
      activeWaveIndex: 2,
      flagState: 'pending',
      stop: { kind: 'none' }
    });
    expect(pointStates(view)).toEqual(['completed', 'active']);
  });

  it('uses expanded break presentation after the previous wave is completed', () => {
    const session = makeSession([
      wave('wave-1'),
      breakEncounter('break-1'),
      wave('wave-2')
    ]);

    const view = deriveLiveEscapeProgressPathViewModel(
      session,
      snapshot({ id: 'break-1', type: 'break', index: 1, elapsedMs: 500 })
    );

    expect(view).toMatchObject({
      kind: 'path',
      presentation: 'expandedBreak',
      completedWaves: 1,
      activeWaveIndex: null
    });
    expect(pointStates(view)).toEqual(['completed', 'upcoming']);
  });

  it('keeps boss encounters wave-only without adding a boss point', () => {
    const session = makeSession([
      wave('wave-1'),
      wave('wave-2'),
      bossEncounter('boss-1'),
      wave('wave-3')
    ]);

    const view = deriveLiveEscapeProgressPathViewModel(
      session,
      snapshot({ id: 'boss-1', type: 'boss', index: 2, elapsedMs: 1000 })
    );

    expect(view).toMatchObject({
      kind: 'path',
      presentation: 'compact',
      totalWaves: 3,
      completedWaves: 2,
      activeWaveIndex: null
    });
    expect(pointStates(view)).toEqual(['completed', 'completed', 'upcoming']);
  });

  it('hides until the snapshot resolves to a known encounter', () => {
    const session = makeSession([wave('wave-1')]);

    expect(deriveLiveEscapeProgressPathViewModel(session, null)).toEqual({ kind: 'hidden' });
    expect(
      deriveLiveEscapeProgressPathViewModel(
        session,
        snapshot({ id: 'missing-wave', type: 'wave', index: 12, elapsedMs: 0 })
      )
    ).toEqual({ kind: 'hidden' });
  });

  it('hides for sessions without wave encounters', () => {
    const session = makeSession([breakEncounter('break-1'), bossEncounter('boss-1')]);

    expect(
      deriveLiveEscapeProgressPathViewModel(
        session,
        snapshot({ id: 'break-1', type: 'break', index: 0, elapsedMs: 0 })
      )
    ).toEqual({ kind: 'hidden' });
  });

  it('hides for Dungeon sessions because endless loops have no flag path', () => {
    const session = makeSession([wave('dungeon-wave-1'), wave('dungeon-wave-2')], {
      winCondition: { kind: 'dungeon' }
    });

    expect(
      deriveLiveEscapeProgressPathViewModel(
        session,
        snapshot({ id: 'dungeon-wave-1', type: 'wave', index: 0, elapsedMs: 0 })
      )
    ).toEqual({ kind: 'hidden' });
  });
});

describe('deriveResultEscapeProgressPathViewModel', () => {
  it('fills every point and reaches the flag on victory', () => {
    const session = makeSession([wave('wave-1'), wave('wave-2'), bossEncounter('boss-1')]);

    const view = deriveResultEscapeProgressPathViewModel(session, makeSummary('win', {
      completedWaves: 2,
      totalWaves: 2,
      activeEncounterId: 'boss-1',
      activeEncounterIndex: 2
    }));

    expect(view).toMatchObject({
      kind: 'path',
      presentation: 'result',
      completedWaves: 2,
      activeWaveIndex: null,
      flagState: 'reached',
      stop: { kind: 'none' }
    });
    expect(pointStates(view)).toEqual(['completed', 'completed']);
  });

  it('anchors a loss marker on the active wave point', () => {
    const session = makeSession([wave('wave-1'), wave('wave-2'), wave('wave-3')]);

    const view = deriveResultEscapeProgressPathViewModel(session, makeSummary('loss', {
      completedWaves: 1,
      totalWaves: 3,
      activeEncounterId: 'wave-2',
      activeEncounterIndex: 1
    }));

    expect(view).toMatchObject({
      kind: 'path',
      completedWaves: 1,
      activeWaveIndex: 2,
      flagState: 'pending',
      stop: { kind: 'loss', anchor: 'activeWave' }
    });
    expect(pointStates(view)).toEqual(['completed', 'stopped', 'upcoming']);
  });

  it('anchors a loss after completed waves during a non-wave encounter', () => {
    const session = makeSession([
      wave('wave-1'),
      breakEncounter('break-1'),
      wave('wave-2')
    ]);

    const view = deriveResultEscapeProgressPathViewModel(session, makeSummary('loss', {
      completedWaves: 1,
      totalWaves: 2,
      activeEncounterId: 'break-1',
      activeEncounterIndex: 1
    }));

    expect(view).toMatchObject({
      kind: 'path',
      completedWaves: 1,
      activeWaveIndex: null,
      stop: { kind: 'loss', anchor: 'afterCompletedWaves' }
    });
    expect(pointStates(view)).toEqual(['completed', 'upcoming']);
  });

  it('keeps the flag pending for a loss after all waves before victory', () => {
    const session = makeSession([wave('wave-1'), wave('wave-2'), bossEncounter('final-boss')]);

    const view = deriveResultEscapeProgressPathViewModel(session, makeSummary('loss', {
      completedWaves: 2,
      totalWaves: 2,
      activeEncounterId: 'final-boss',
      activeEncounterIndex: 2
    }));

    expect(view).toMatchObject({
      kind: 'path',
      completedWaves: 2,
      activeWaveIndex: null,
      flagState: 'pending',
      stop: { kind: 'loss', anchor: 'beforeFlag' }
    });
    expect(pointStates(view)).toEqual(['completed', 'completed']);
  });

  it('hides for zero-wave result summaries', () => {
    const session = makeSession([bossEncounter('boss-1')]);

    expect(
      deriveResultEscapeProgressPathViewModel(session, makeSummary('loss', {
        completedWaves: 0,
        totalWaves: 0,
        activeEncounterId: 'boss-1',
        activeEncounterIndex: 0
      }))
    ).toEqual({ kind: 'hidden' });
  });

  it('hides for Dungeon result summaries even when waves were cleared', () => {
    const session = makeSession([wave('dungeon-wave-1'), wave('dungeon-wave-2')], {
      winCondition: { kind: 'dungeon' }
    });

    expect(
      deriveResultEscapeProgressPathViewModel(
        session,
        {
          ...makeSummary('loss', {
            completedWaves: 0,
            totalWaves: 0,
            activeEncounterId: 'dungeon-wave-1',
            activeEncounterIndex: 0
          }),
          dungeon: { wavesCleared: 12 }
        }
      )
    ).toEqual({ kind: 'hidden' });
  });
});

function pointStates(
  view: ReturnType<typeof deriveLiveEscapeProgressPathViewModel>
): ReadonlyArray<string> {
  if (view.kind !== 'path') {
    throw new Error('expected path view model');
  }
  return view.points.map((point) => point.state);
}

function makeSession(
  encounters: ReadonlyArray<EncounterDefinition>,
  overrides: Partial<SessionDefinition> = {}
): SessionDefinition {
  return {
    id: 'escape-progress-test',
    seed: 1,
    arena: { width: 16, height: 9 },
    players: [
      {
        id: 'escape-progress-player',
        position: { x: 0, y: 0 },
        radius: 0.5,
        contactBox: { width: 1, height: 1 },
        maxSpeed: 5,
        maxHp: 5,
        loadout: { weapons: ['pistol'], selectedIndex: 0 }
      }
    ],
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
    uiMeta: null,
    ...overrides,
    companion: overrides.companion ?? null
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

function makeSummary(
  outcome: 'win' | 'loss',
  progress: Pick<
    SessionResultSummary['progress'],
    'completedWaves' | 'totalWaves' | 'activeEncounterId' | 'activeEncounterIndex'
  >
): SessionResultSummary {
  return {
    outcome,
    durationMs: 1000,
    progress: {
      percent: outcome === 'win' ? 100 : 50,
      completedObjectiveEncounters: progress.completedWaves,
      totalObjectiveEncounters: progress.totalWaves,
      ...progress
    },
    kills: { total: 0, byArchetype: [] },
    drops: { pickedUpTotal: 0 },
    boss: null,
    defeat: null,
    dungeon: null
  };
}
