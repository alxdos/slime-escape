import { describe, expect, it } from 'vitest';

import type { SessionDefinition } from '../../shared/session';
import type { Snapshot } from '../../shared/snapshot';

import { deriveHudViewModel, formatElapsedMs } from './Hud';

function makeSession(): SessionDefinition {
  return {
    id: 'hud-session',
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
    modifiers: [],
    rules: { damage: { slimeFriendlyFire: false } },
    encounters: [
      {
        id: 'wave-1',
        type: 'wave',
        backgroundId: null,
        spawnPlan: { kind: 'wave', spawns: [], spawnIntervalMs: 1000, maxAlive: 2 },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'break-1',
        type: 'break',
        backgroundId: null,
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 1000, next: 'sequential' },
        tuning: null
      },
      {
        id: 'wave-2',
        type: 'wave',
        backgroundId: null,
        spawnPlan: { kind: 'wave', spawns: [], spawnIntervalMs: 1000, maxAlive: 2 },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      }
    ],
    winCondition: { kind: 'allEncountersComplete' },
    lossCondition: { kind: 'playerDeath' },
    uiMeta: null
  };
}

function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    simTimeMs: 0,
    entities: [
      {
        id: 1,
        kind: 'player',
        x: 0,
        y: 0,
        hp: 4,
        maxHp: 5
      }
    ],
    encounter: {
      id: 'wave-2',
      type: 'wave',
      index: 2,
      elapsedMs: 65000
    },
    zone: { mode: 'disabled', margin: 0 },
    waveProgress: { dispatched: 3, total: 7, alive: 2 },
    bossHud: null,
    ...overrides
  };
}

function makeBossSnapshot(): Snapshot {
  return makeSnapshot({
    entities: [
      {
        id: 1,
        kind: 'player',
        x: 0,
        y: 0,
        hp: 4,
        maxHp: 5
      },
      {
        id: 99,
        kind: 'boss',
        archetypeId: 'boss-scrap-king',
        x: 1,
        y: 1,
        hp: 22,
        maxHp: 40,
        phaseIndex: 1,
        phaseId: 'desperation',
        activeAttackIds: ['dashSlam']
      }
    ],
    encounter: {
      id: 'campaign-boss',
      type: 'boss',
      index: 2,
      elapsedMs: 12000
    },
    waveProgress: null,
    bossHud: {
      entityId: 99,
      phaseIndex: 1,
      phaseId: 'desperation',
      hp: 22,
      maxHp: 40,
      activeAttackIds: ['dashSlam']
    }
  });
}

describe('Hud view model', () => {
  it('formats elapsed milliseconds as mm:ss', () => {
    expect(formatElapsedMs(0)).toBe('00:00');
    expect(formatElapsedMs(65000)).toBe('01:05');
    expect(formatElapsedMs(601000)).toBe('10:01');
  });

  it('derives hp, encounter and wave text from session + snapshot', () => {
    const view = deriveHudViewModel(makeSession(), makeSnapshot());

    expect(view.hpText).toBe('4 / 5');
    expect(view.encounterIdText).toBe('wave-2');
    expect(view.encounterTypeText).toBe('wave');
    expect(view.encounterElapsedText).toBe('01:05');
    expect(view.waveTitleText).toBe('Волна 2 из 2');
    expect(view.waveProgressText).toBe('Выпущено 3/7 · Живых 2');
    expect(view.boss).toBeNull();
  });

  it('hides wave text for non-wave encounters or missing waveProgress', () => {
    const breakView = deriveHudViewModel(
      makeSession(),
      makeSnapshot({
        encounter: {
          id: 'break-1',
          type: 'break',
          index: 1,
          elapsedMs: 2000
        },
        waveProgress: null
      })
    );

    expect(breakView.waveTitleText).toBeNull();
    expect(breakView.waveProgressText).toBeNull();
    expect(breakView.boss).toBeNull();
  });

  it('shows boss block only when bossHud is present and resolves phase through archetype data', () => {
    const bossView = deriveHudViewModel(makeSession(), makeBossSnapshot());

    expect(bossView.boss).not.toBeNull();
    expect(bossView.boss?.titleText).toBe('Scrap King');
    expect(bossView.boss?.phaseText).toBe('Фаза 2/2 · desperation');
    expect(bossView.boss?.hpText).toBe('22 / 40');
    expect(bossView.boss?.hpRatio).toBe(0.55);
  });

  it('keeps boss summary hidden when only the boss entity is present without bossHud', () => {
    const view = deriveHudViewModel(
      makeSession(),
      makeSnapshot({
        entities: [
          {
            id: 1,
            kind: 'player',
            x: 0,
            y: 0,
            hp: 4,
            maxHp: 5
          },
          {
            id: 99,
            kind: 'boss',
            archetypeId: 'boss-scrap-king',
            x: 1,
            y: 1,
            hp: 22,
            maxHp: 40,
            phaseIndex: 1,
            phaseId: 'desperation',
            activeAttackIds: ['dashSlam']
          }
        ],
        encounter: {
          id: 'campaign-boss',
          type: 'boss',
          index: 2,
          elapsedMs: 12000
        },
        waveProgress: null,
        bossHud: null
      })
    );

    expect(view.boss).toBeNull();
  });

  it('falls back to an unknown phase count when boss archetype is unavailable', () => {
    const bossView = deriveHudViewModel(
      makeSession(),
      makeSnapshot({
        entities: [
          {
            id: 1,
            kind: 'player',
            x: 0,
            y: 0,
            hp: 4,
            maxHp: 5
          },
          {
            id: 99,
            kind: 'boss',
            archetypeId: 'missing-boss',
            x: 1,
            y: 1,
            hp: 22,
            maxHp: 40,
            phaseIndex: 1,
            phaseId: 'desperation',
            activeAttackIds: ['dashSlam']
          }
        ],
        encounter: {
          id: 'campaign-boss',
          type: 'boss',
          index: 2,
          elapsedMs: 12000
        },
        waveProgress: null,
        bossHud: {
          entityId: 99,
          phaseIndex: 1,
          phaseId: 'desperation',
          hp: 22,
          maxHp: 40,
          activeAttackIds: ['dashSlam']
        }
      })
    );

    expect(bossView.boss?.phaseText).toBe('Фаза 2/? · desperation');
  });

  it('falls back to waiting state before the first snapshot arrives', () => {
    const view = deriveHudViewModel(makeSession(), null);

    expect(view.hpText).toBe('-- / 5');
    expect(view.encounterIdText).toBe('waiting');
    expect(view.encounterTypeText).toBe('none');
    expect(view.encounterElapsedText).toBe('--:--');
    expect(view.waveTitleText).toBeNull();
    expect(view.waveProgressText).toBeNull();
    expect(view.boss).toBeNull();
  });
});
