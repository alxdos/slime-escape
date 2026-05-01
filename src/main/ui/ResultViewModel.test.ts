import { describe, expect, it } from 'vitest';

import type { BossArchetype } from '../../shared/content/bosses';
import type { EnemyArchetype } from '../../shared/content/enemies';
import type { EncounterDefinition, SessionDefinition } from '../../shared/session';
import type { SessionResultSummary } from '../../shared/sessionResult';
import type { SpriteVisualSpec } from '../render/SpriteVisualSpec';

import { buildResultViewModel } from './ResultViewModel';

describe('buildResultViewModel', () => {
  it('resolves labels/icons, formats stats and omits zero-count kill rows', () => {
    const viewModel = buildResultViewModel(makeSession(), makeSummary(), {
      enemies: {
        slime: makeEnemy('slime', 'Basic Slime'),
        unused: makeEnemy('unused', 'Unused Slime')
      },
      bosses: {
        boss: makeBoss('boss', 'Slime King')
      },
      enemyVisuals: {
        slime: makeVisual('slime', '/slime.png'),
        unused: makeVisual('unused', '/unused.png')
      },
      bossVisuals: {
        boss: makeVisual('boss', '/boss.png')
      }
    });

    expect(viewModel.title).toBe('Victory!');
    expect(viewModel.subtitle).toBe('You escaped the slime world');
    expect(viewModel.primaryStats).toContainEqual({
      id: 'duration',
      label: 'Time',
      value: '04:18'
    });
    expect(viewModel.primaryStats).toContainEqual({
      id: 'drops',
      label: 'Power-ups collected',
      value: '1'
    });
    expect(viewModel.escapePath).toMatchObject({
      title: 'Escape Map',
      summaryText: 'You reached the exit flag',
      detailText: null,
      path: {
        completedWaves: 2,
        flagState: 'reached',
        stop: { kind: 'none' }
      }
    });
    expect(viewModel.killRows).toEqual([
      {
        id: 'enemy:slime',
        entityKind: 'enemy',
        archetypeId: 'slime',
        label: 'Basic Slime',
        count: 2,
        iconUrl: '/slime.png'
      },
      {
        id: 'boss:boss',
        entityKind: 'boss',
        archetypeId: 'boss',
        label: 'Slime King',
        count: 1,
        iconUrl: '/boss.png'
      }
    ]);
    expect(viewModel.boss?.text).toBe('Boss defeated');
    expect(viewModel.xpReward).toBeNull();
  });

  it('includes normalized XP reward values when supplied', () => {
    const viewModel = buildResultViewModel(
      makeSession(),
      {
        ...makeSummary(),
        kills: {
          total: 0,
          byArchetype: []
        },
        boss: null
      },
      {
        xpReward: {
          xpEarned: 7.8,
          totalXp: 42.2
        }
      }
    );

    expect(viewModel.xpReward).toEqual({
      xpEarned: 7,
      totalXp: 42
    });
  });

  it('describes defeat causes from content registries', () => {
    const viewModel = buildResultViewModel(
      makeSession(),
      {
        ...makeSummary('loss'),
        defeat: {
          cause: {
            kind: 'enemyContact',
            sourceEntityId: 2,
            sourceEntityKind: 'enemy',
            archetypeId: 'slime'
          }
        }
      },
      {
        enemies: { slime: makeEnemy('slime', 'Jumping Slime') },
        bosses: { boss: makeBoss('boss', 'Slime King') },
        enemyVisuals: { slime: makeVisual('slime', '/slime.png') },
        bossVisuals: { boss: makeVisual('boss', '/boss.png') }
      }
    );

    expect(viewModel.title).toBe('Run Over');
    expect(viewModel.defeatCause).toBe('Defeated by: Jumping Slime');
  });

  it('uses a mode fallback when progress percent is unavailable', () => {
    const viewModel = buildResultViewModel(
      makeSession({
        winCondition: { kind: 'none' },
        lossCondition: { kind: 'none' }
      }),
      {
        ...makeSummary('loss'),
        progress: {
          percent: null,
          completedObjectiveEncounters: 0,
          totalObjectiveEncounters: 0,
          completedWaves: 0,
          totalWaves: 0,
          activeEncounterId: 'sandbox',
          activeEncounterIndex: 0
        }
      },
      {
        enemies: { slime: makeEnemy('slime', 'Basic Slime') },
        bosses: { boss: makeBoss('boss', 'Slime King') },
        enemyVisuals: { slime: makeVisual('slime', '/slime.png') },
        bossVisuals: { boss: makeVisual('boss', '/boss.png') }
      }
    );

    expect(viewModel.primaryStats).toContainEqual({
      id: 'progress',
      label: 'Progress',
      value: 'Free Play'
    });
    expect(viewModel.escapePath).toBeNull();
  });

  it('foregrounds Dungeon waves, local best, and new-best state without escape progress', () => {
    const viewModel = buildResultViewModel(
      makeSession({
        winCondition: { kind: 'dungeon' }
      }),
      {
        ...makeSummary('loss'),
        progress: {
          percent: null,
          completedObjectiveEncounters: 0,
          totalObjectiveEncounters: 3,
          completedWaves: 0,
          totalWaves: 3,
          activeEncounterId: 'dungeon-wave-1',
          activeEncounterIndex: 0
        },
        dungeon: { wavesCleared: 12 }
      },
      {
        dungeonBest: {
          previousBestWave: 9,
          bestWave: 12,
          isNewBest: true
        },
        enemies: { slime: makeEnemy('slime', 'Basic Slime') },
        bosses: { boss: makeBoss('boss', 'Slime King') },
        enemyVisuals: { slime: makeVisual('slime', '/slime.png') },
        bossVisuals: { boss: makeVisual('boss', '/boss.png') }
      }
    );

    expect(viewModel.title).toBe('Dungeon Run Over');
    expect(viewModel.subtitle).toBe('New Best!');
    expect(viewModel.dungeon).toEqual({
      wavesCleared: 12,
      previousBestWave: 9,
      bestWave: 12,
      isNewBest: true
    });
    expect(viewModel.escapePath).toBeNull();
    expect(viewModel.primaryStats.map((stat) => stat.id)).toEqual([
      'duration',
      'total-kills',
      'drops'
    ]);
  });

  it('describes defeat path at the stopping wave', () => {
    const viewModel = buildResultViewModel(
      makeSession({
        encounters: [wave('wave-1'), wave('wave-2'), wave('wave-3')]
      }),
      {
        ...makeSummary('loss'),
        progress: {
          percent: 55,
          completedObjectiveEncounters: 1,
          totalObjectiveEncounters: 3,
          completedWaves: 1,
          totalWaves: 3,
          activeEncounterId: 'wave-2',
          activeEncounterIndex: 1
        }
      },
      {
        enemies: { slime: makeEnemy('slime', 'Basic Slime') },
        bosses: { boss: makeBoss('boss', 'Slime King') },
        enemyVisuals: { slime: makeVisual('slime', '/slime.png') },
        bossVisuals: { boss: makeVisual('boss', '/boss.png') }
      }
    );

    expect(viewModel.escapePath).toMatchObject({
      summaryText: 'You reached wave 2 of 3',
      detailText: '1 wave left to the exit',
      path: {
        activeWaveIndex: 2,
        flagState: 'pending',
        stop: { kind: 'loss', anchor: 'activeWave' }
      }
    });
  });

  it('keeps final-boss defeat before the flag', () => {
    const viewModel = buildResultViewModel(
      makeSession({
        encounters: [wave('wave-1'), wave('wave-2'), bossEncounter('final-boss')]
      }),
      {
        ...makeSummary('loss'),
        progress: {
          percent: 96,
          completedObjectiveEncounters: 2,
          totalObjectiveEncounters: 3,
          completedWaves: 2,
          totalWaves: 2,
          activeEncounterId: 'final-boss',
          activeEncounterIndex: 2
        }
      },
      {
        enemies: { slime: makeEnemy('slime', 'Basic Slime') },
        bosses: { boss: makeBoss('boss', 'Slime King') },
        enemyVisuals: { slime: makeVisual('slime', '/slime.png') },
        bossVisuals: { boss: makeVisual('boss', '/boss.png') }
      }
    );

    expect(viewModel.escapePath).toMatchObject({
      summaryText: 'You reached wave 2 of 2',
      detailText: 'The exit was close',
      path: {
        completedWaves: 2,
        flagState: 'pending',
        stop: { kind: 'loss', anchor: 'beforeFlag' }
      }
    });
  });

  it('throws when summary references missing presentation data', () => {
    expect(() =>
      buildResultViewModel(makeSession(), makeSummary(), {
        enemies: { slime: makeEnemy('slime', 'Basic Slime') },
        bosses: { boss: makeBoss('boss', 'Slime King') },
        enemyVisuals: {},
        bossVisuals: { boss: makeVisual('boss', '/boss.png') }
      })
    ).toThrow(/enemy visual/);
  });
});

function makeSummary(outcome: 'win' | 'loss' = 'win'): SessionResultSummary {
  return {
    outcome,
    durationMs: 258_000,
    progress: {
      percent: outcome === 'win' ? 100 : 73,
      completedObjectiveEncounters: outcome === 'win' ? 2 : 1,
      totalObjectiveEncounters: 2,
      completedWaves: outcome === 'win' ? 2 : 1,
      totalWaves: 2,
      activeEncounterId: 'boss',
      activeEncounterIndex: 2
    },
    kills: {
      total: 3,
      byArchetype: [
        { entityKind: 'enemy', archetypeId: 'slime', count: 2 },
        { entityKind: 'enemy', archetypeId: 'unused', count: 0 },
        { entityKind: 'boss', archetypeId: 'boss', count: 1 }
      ]
    },
    drops: {
      pickedUpTotal: 1
    },
    boss: {
      archetypeId: 'boss',
      encountered: true,
      defeated: outcome === 'win',
      hp: outcome === 'win' ? 0 : 28,
      maxHp: 100,
      hpPercent: outcome === 'win' ? 0 : 28
    },
    defeat: null,
    dungeon: null
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

function bossEncounter(id: string): EncounterDefinition {
  return {
    id,
    type: 'boss',
    backgroundId: null,
    introDurationMs: 0,
    name: null,
    text: null,
    spawnPlan: { kind: 'boss', bossArchetypeId: 'boss', position: { x: 0, y: 0 } },
    zoneBehavior: { kind: 'disabled' },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
    tuning: null
  };
}

function makeSession(overrides: Partial<Omit<SessionDefinition, 'players' | 'dynamicRoster'>> = {}): SessionDefinition {
  return {
    id: 'result-test',
    seed: 1,
    arena: { width: 32, height: 18 },
    dynamicRoster: false,
    players: [
      {
        id: 'result-player',
        position: { x: 0, y: 0 },
        radius: 0.5,
        contactBox: { width: 1, height: 1 },
        maxSpeed: 6,
        maxHp: 5,
        loadout: null,
        companion: null
      }
    ],
    backgrounds: [],
    musicSampleId: null,
    modifiers: [],
    rules: {
      damage: { slimeFriendlyFire: false },
      aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 }
    },
    encounters: [],
    winCondition: { kind: 'allEncountersComplete' },
    lossCondition: { kind: 'playerDeath' },
    uiMeta: null,
    ...overrides
  };
}

function makeEnemy(id: string, displayName: string): EnemyArchetype {
  return {
    id,
    displayName,
    radius: 0.5,
    contactBox: { width: 1, height: 1 },
    maxHp: 3,
    behavior: 'stationary',
    maxSpeed: 0,
    contactDamage: 0,
    contactCooldownMs: 500,
    knockbackBaseImpulse: 0,
    knockbackVelocityScale: 0,
    knockbackDurationMs: 100,
    color: 0x00ff00,
    dropTable: [],
    retaliation: { enabled: false, durationMs: 0 }
  };
}

function makeBoss(id: string, displayName: string): BossArchetype {
  return {
    id,
    displayName,
    radius: 1,
    contactBox: { width: 2, height: 2 },
    maxHp: 100,
    maxSpeed: 0,
    color: 0xff0000,
    contactDamage: 1,
    contactCooldownMs: 500,
    knockbackBaseImpulse: 0,
    knockbackVelocityScale: 0,
    knockbackDurationMs: 100,
    phases: [
      {
        id: 'phase-1',
        allowedAttackIds: ['slam'],
        exitWhenHpFractionAtOrBelow: 0.5
      }
    ],
    attacks: {
      slam: { pattern: 'slam', cooldownMs: 1000, damage: 1 }
    }
  };
}

function makeVisual(archetypeId: string, image: string): SpriteVisualSpec {
  return {
    archetypeId,
    image,
    sourceSizePx: { width: 64, height: 64 },
    worldSize: { width: 1, height: 1 },
    anchor: { x: 0.5, y: 0.5 }
  };
}
