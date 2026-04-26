import { describe, expect, it } from 'vitest';

import type { EncounterDefinition, SessionDefinition } from '../../shared/session';
import type { Snapshot } from '../../shared/snapshot';

import { deriveTitleOverlayViewModel } from './TitleOverlay';

function makeSession(encounters: ReadonlyArray<EncounterDefinition>): SessionDefinition {
  return {
    id: 'title-overlay-session',
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
    encounters,
    winCondition: { kind: 'allEncountersComplete' },
    lossCondition: { kind: 'playerDeath' },
    uiMeta: null
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

function snapshot(
  encounter: NonNullable<Snapshot['encounter']> | null
): Snapshot {
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

describe('TitleOverlay view model', () => {
  it('shows wave title with set-local numbering during intro', () => {
    const session = makeSession([
      wave('set-1-wave-1', 'First'),
      wave('set-1-wave-2', 'Second'),
      breakEncounter('set-1-break', null),
      wave('set-2-wave-1', 'Один глаз в темноте')
    ]);

    const view = deriveTitleOverlayViewModel(
      session,
      snapshot({ id: 'set-2-wave-1', type: 'wave', index: 3, elapsedMs: 1000 })
    );

    expect(view).toMatchObject({
      kind: 'wave',
      titleText: 'Волна 1',
      nameText: 'Один глаз в темноте',
      opacity: 1
    });
  });

  it('treats consecutive waves as one run when no non-wave encounter separates them', () => {
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
      titleText: 'Волна 3',
      nameText: 'Third'
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
    const session = makeSession([breakEncounter('after-boss-break', 'Дальше: Хламные призраки')]);

    expect(
      deriveTitleOverlayViewModel(
        session,
        snapshot({ id: 'after-boss-break', type: 'break', index: 0, elapsedMs: 900 })
      )
    ).toEqual({
      kind: 'break',
      text: 'Дальше: Хламные призраки',
      opacity: 1
    });
  });
});
