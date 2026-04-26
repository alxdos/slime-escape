import { describe, expect, it } from 'vitest';

import type { BossArchetype } from '../../shared/content/bosses';
import type { EnemyArchetype } from '../../shared/content/enemies';
import type { SessionDefinition } from '../../shared/session';
import type { SessionResultSummary } from '../../shared/sessionResult';
import type { SpriteVisualSpec } from '../render/SpriteVisualSpec';

import { buildResultViewModel } from './ResultViewModel';

describe('buildResultViewModel', () => {
  it('resolves labels/icons, formats stats and omits zero-count kill rows', () => {
    const viewModel = buildResultViewModel(makeSession(), makeSummary(), {
      enemies: {
        slime: makeEnemy('slime', 'Обычный слайм'),
        unused: makeEnemy('unused', 'Нулевой слайм')
      },
      bosses: {
        boss: makeBoss('boss', 'Король слаймов')
      },
      enemyVisuals: {
        slime: makeVisual('slime', '/slime.png'),
        unused: makeVisual('unused', '/unused.png')
      },
      bossVisuals: {
        boss: makeVisual('boss', '/boss.png')
      }
    });

    expect(viewModel.title).toBe('Победа!');
    expect(viewModel.subtitle).toBe('Ты выбрался из мира слаймов');
    expect(viewModel.primaryStats).toContainEqual({
      id: 'duration',
      label: 'Время',
      value: '04:18'
    });
    expect(viewModel.primaryStats).toContainEqual({
      id: 'drops',
      label: 'Собрано усилений',
      value: '1'
    });
    expect(viewModel.killRows).toEqual([
      {
        id: 'enemy:slime',
        entityKind: 'enemy',
        archetypeId: 'slime',
        label: 'Обычный слайм',
        count: 2,
        iconUrl: '/slime.png'
      },
      {
        id: 'boss:boss',
        entityKind: 'boss',
        archetypeId: 'boss',
        label: 'Король слаймов',
        count: 1,
        iconUrl: '/boss.png'
      }
    ]);
    expect(viewModel.boss?.text).toBe('Босс повержен');
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
        enemies: { slime: makeEnemy('slime', 'Прыгающий слайм') },
        bosses: { boss: makeBoss('boss', 'Король слаймов') },
        enemyVisuals: { slime: makeVisual('slime', '/slime.png') },
        bossVisuals: { boss: makeVisual('boss', '/boss.png') }
      }
    );

    expect(viewModel.title).toBe('Забег окончен');
    expect(viewModel.defeatCause).toBe('Добил: Прыгающий слайм');
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
        enemies: { slime: makeEnemy('slime', 'Обычный слайм') },
        bosses: { boss: makeBoss('boss', 'Король слаймов') },
        enemyVisuals: { slime: makeVisual('slime', '/slime.png') },
        bossVisuals: { boss: makeVisual('boss', '/boss.png') }
      }
    );

    expect(viewModel.primaryStats).toContainEqual({
      id: 'progress',
      label: 'Прогресс',
      value: 'Свободный режим'
    });
  });

  it('throws when summary references missing presentation data', () => {
    expect(() =>
      buildResultViewModel(makeSession(), makeSummary(), {
        enemies: { slime: makeEnemy('slime', 'Обычный слайм') },
        bosses: { boss: makeBoss('boss', 'Король слаймов') },
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
    defeat: null
  };
}

function makeSession(overrides: Partial<SessionDefinition> = {}): SessionDefinition {
  return {
    id: 'result-test',
    seed: 1,
    arena: { width: 32, height: 18 },
    player: {
      position: { x: 0, y: 0 },
      radius: 0.5,
      contactBox: { width: 1, height: 1 },
      maxSpeed: 6,
      maxHp: 5
    },
    loadout: null,
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
