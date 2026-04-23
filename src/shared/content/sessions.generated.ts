// AUTO-GENERATED from content/sessions/*.md by `npm run content:build`.
// Do not edit by hand.
import { SANDBOX_ARENA } from './arenas';
import { BOSS_SCRAP_KING } from './bosses.generated';
import { SLIME_BUG, SLIME_ONE_EYE, SLIME_SHELL } from './enemies.generated';
import { SANDBOX_PLAYER, TRAINING_PLAYER } from './players.generated';
import type { SessionPresetTemplate } from './sessions';
import { PISTOL } from './weapons.generated';

export const SESSION_PRESET_TEMPLATES = {
  campaign: {
    presetId: 'campaign',
    displayName: 'Побег',
    description: 'Основной забег: три волны, передышки и финальный босс.',
    visibleInMenu: true,
    order: 0,
    arena: SANDBOX_ARENA,
    player: TRAINING_PLAYER,
    loadout: { primaryWeaponArchetypeId: PISTOL.id },
    winCondition: { kind: 'bossDefeated' },
    lossCondition: { kind: 'playerDeath' },
    encounters: [
      {
        id: 'campaign-wave-1',
        type: 'wave',
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_SHELL.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_SHELL.id }
          ],
          spawnIntervalMs: 1500,
          maxAlive: 4,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 4, durationMs: 8000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-break-after-wave-1',
        type: 'break',
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'expandLinear', fromMargin: 4, toMargin: 0, durationMs: 2500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 3000, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-wave-2',
        type: 'wave',
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_SHELL.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_SHELL.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_SHELL.id },
            { archetypeId: SLIME_ONE_EYE.id }
          ],
          spawnIntervalMs: 1200,
          maxAlive: 5,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 5, durationMs: 10000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-break-after-wave-2',
        type: 'break',
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'expandLinear', fromMargin: 5, toMargin: 0, durationMs: 2500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 3000, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-wave-3',
        type: 'wave',
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_SHELL.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_SHELL.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_SHELL.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_SHELL.id }
          ],
          spawnIntervalMs: 1000,
          maxAlive: 6,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 5, durationMs: 12000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-pre-boss-break',
        type: 'break',
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'expandLinear', fromMargin: 5, toMargin: 0, durationMs: 2500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 3000, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-boss',
        type: 'boss',
        spawnPlan: {
          kind: 'boss',
          bossArchetypeId: BOSS_SCRAP_KING.id,
          position: 'top-center',
          bossEdgeMargin: 0.5
        },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      }
    ]
  },
  sandbox: {
    presetId: 'sandbox',
    displayName: 'Песочница',
    description: 'Свободная пустая арена для проверки перемещения и камеры.',
    visibleInMenu: false,
    order: 0,
    arena: SANDBOX_ARENA,
    player: SANDBOX_PLAYER,
    loadout: null,
    winCondition: { kind: 'none' },
    lossCondition: { kind: 'none' },
    encounters: [
      {
        id: 'sandbox-encounter',
        type: 'sandbox',
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'never', next: 'sequential' },
        tuning: null
      }
    ]
  },
  'sandbox-with-combat': {
    presetId: 'sandbox-with-combat',
    displayName: 'Песочница с боем',
    description: 'Свободная арена с оружием и одним статическим тестовым противником.',
    visibleInMenu: false,
    order: 0,
    arena: SANDBOX_ARENA,
    player: SANDBOX_PLAYER,
    loadout: { primaryWeaponArchetypeId: PISTOL.id },
    winCondition: { kind: 'none' },
    lossCondition: { kind: 'none' },
    encounters: [
      {
        id: 'sandbox-with-combat-encounter',
        type: 'sandbox',
        spawnPlan: {
          kind: 'static',
          spawns: [
            {
              archetypeId: SLIME_BUG.id,
              position: { x: 5, y: 0 }
            }
          ]
        },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'never', next: 'sequential' },
        tuning: null
      }
    ]
  },
  training: {
    presetId: 'training',
    displayName: 'Тренировка',
    description: 'Короткая сессия без босса, чтобы размяться и проверить сборку.',
    visibleInMenu: true,
    order: 1,
    arena: SANDBOX_ARENA,
    player: TRAINING_PLAYER,
    loadout: { primaryWeaponArchetypeId: PISTOL.id },
    winCondition: { kind: 'allEncountersComplete' },
    lossCondition: { kind: 'playerDeath' },
    encounters: [
      {
        id: 'training-wave-1',
        type: 'wave',
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_SHELL.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_SHELL.id }
          ],
          spawnIntervalMs: 1500,
          maxAlive: 4,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 4, durationMs: 8000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'training-break',
        type: 'break',
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'expandLinear', fromMargin: 4, toMargin: 0, durationMs: 2500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 3000, next: 'sequential' },
        tuning: null
      },
      {
        id: 'training-wave-2',
        type: 'wave',
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_SHELL.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_SHELL.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_SHELL.id },
            { archetypeId: SLIME_ONE_EYE.id }
          ],
          spawnIntervalMs: 1200,
          maxAlive: 5,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 5, durationMs: 10000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      }
    ]
  }
} as const satisfies Record<string, SessionPresetTemplate>;
