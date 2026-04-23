// AUTO-GENERATED from content/sessions/*.md by `npm run content:build`.
// Do not edit by hand.
import { SANDBOX_ARENA } from './arenas';
import { BOSS_BUBBLE_HOG, BOSS_GARGOYLE, BOSS_SAW_CYCLOPS, BOSS_SCRAP_KING, BOSS_TOWER_SENTINEL } from './bosses.generated';
import { SLIME_BUG, SLIME_CANDLE, SLIME_CLAMPER, SLIME_DASHER, SLIME_DOOR, SLIME_DRONE, SLIME_ECHO, SLIME_FLAME, SLIME_FORTRESS, SLIME_HORNLING, SLIME_KINGLING, SLIME_LIFTER, SLIME_MANY_EYE, SLIME_MECH, SLIME_MECH_CRAB, SLIME_NINJA, SLIME_OBELISK, SLIME_ONE_EYE, SLIME_PRINCE, SLIME_SAW, SLIME_SHELL, SLIME_SLEEPER, SLIME_SPARK, SLIME_SPLITTER, SLIME_STACK, SLIME_STAR, SLIME_STONEHEAD, SLIME_TADPOLE, SLIME_TRICKSTER, SLIME_WRAITH } from './enemies.generated';
import { SANDBOX_PLAYER, TRAINING_PLAYER } from './players.generated';
import type { SessionPresetTemplate } from './sessions';
import { PISTOL } from './weapons.generated';

export const SESSION_PRESET_TEMPLATES = {
  campaign: {
    presetId: 'campaign',
    displayName: 'Побег',
    description: 'Основной забег: пять тематических сетов слаймов, после каждого — свой босс.',
    visibleInMenu: true,
    order: 0,
    arena: SANDBOX_ARENA,
    player: TRAINING_PLAYER,
    loadout: { primaryWeaponArchetypeId: PISTOL.id },
    winCondition: { kind: 'allEncountersComplete' },
    lossCondition: { kind: 'playerDeath' },
    encounters: [
      {
        id: 'campaign-set-1-wave-1',
        type: 'wave',
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_SLEEPER.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_HORNLING.id },
            { archetypeId: SLIME_SLEEPER.id }
          ],
          spawnIntervalMs: 1500,
          maxAlive: 4,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 3.5, durationMs: 8000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-1-wave-2',
        type: 'wave',
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_SLEEPER.id },
            { archetypeId: SLIME_HORNLING.id },
            { archetypeId: SLIME_SPARK.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_HORNLING.id },
            { archetypeId: SLIME_SPARK.id },
            { archetypeId: SLIME_SLEEPER.id },
            { archetypeId: SLIME_HORNLING.id }
          ],
          spawnIntervalMs: 1250,
          maxAlive: 5,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 3.5, toMargin: 4.5, durationMs: 9000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-1-wave-3',
        type: 'wave',
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_SLEEPER.id },
            { archetypeId: SLIME_HORNLING.id },
            { archetypeId: SLIME_SPARK.id },
            { archetypeId: SLIME_MANY_EYE.id },
            { archetypeId: SLIME_HORNLING.id },
            { archetypeId: SLIME_SPARK.id },
            { archetypeId: SLIME_MANY_EYE.id },
            { archetypeId: SLIME_STONEHEAD.id },
            { archetypeId: SLIME_SPARK.id },
            { archetypeId: SLIME_MANY_EYE.id },
            { archetypeId: SLIME_STONEHEAD.id }
          ],
          spawnIntervalMs: 1100,
          maxAlive: 6,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 4.5, toMargin: 5.5, durationMs: 11000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-1-pre-boss-break',
        type: 'break',
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'expandLinear', fromMargin: 5.5, toMargin: 0, durationMs: 2500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 3000, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-1-boss',
        type: 'boss',
        spawnPlan: {
          kind: 'boss',
          bossArchetypeId: BOSS_GARGOYLE.id,
          position: 'top-center',
          bossEdgeMargin: 0.5
        },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-1-after-boss-break',
        type: 'break',
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 2500, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-2-wave-1',
        type: 'wave',
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_TRICKSTER.id },
            { archetypeId: SLIME_WRAITH.id },
            { archetypeId: SLIME_TRICKSTER.id },
            { archetypeId: SLIME_SHELL.id },
            { archetypeId: SLIME_WRAITH.id },
            { archetypeId: SLIME_TRICKSTER.id },
            { archetypeId: SLIME_SHELL.id }
          ],
          spawnIntervalMs: 1400,
          maxAlive: 5,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 3.5, durationMs: 8500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-2-wave-2',
        type: 'wave',
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_TRICKSTER.id },
            { archetypeId: SLIME_WRAITH.id },
            { archetypeId: SLIME_SHELL.id },
            { archetypeId: SLIME_STACK.id },
            { archetypeId: SLIME_WRAITH.id },
            { archetypeId: SLIME_SHELL.id },
            { archetypeId: SLIME_STACK.id },
            { archetypeId: SLIME_TRICKSTER.id },
            { archetypeId: SLIME_MECH_CRAB.id },
            { archetypeId: SLIME_STACK.id }
          ],
          spawnIntervalMs: 1150,
          maxAlive: 6,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 3.5, toMargin: 4.5, durationMs: 10000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-2-wave-3',
        type: 'wave',
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_TRICKSTER.id },
            { archetypeId: SLIME_WRAITH.id },
            { archetypeId: SLIME_SHELL.id },
            { archetypeId: SLIME_STACK.id },
            { archetypeId: SLIME_MECH_CRAB.id },
            { archetypeId: SLIME_SHELL.id },
            { archetypeId: SLIME_STACK.id },
            { archetypeId: SLIME_MECH_CRAB.id },
            { archetypeId: SLIME_FLAME.id },
            { archetypeId: SLIME_WRAITH.id },
            { archetypeId: SLIME_STACK.id },
            { archetypeId: SLIME_MECH_CRAB.id },
            { archetypeId: SLIME_FLAME.id }
          ],
          spawnIntervalMs: 1000,
          maxAlive: 6,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 4.5, toMargin: 5.5, durationMs: 12000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-2-pre-boss-break',
        type: 'break',
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'expandLinear', fromMargin: 5.5, toMargin: 0, durationMs: 2500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 3000, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-2-boss',
        type: 'boss',
        spawnPlan: {
          kind: 'boss',
          bossArchetypeId: BOSS_SAW_CYCLOPS.id,
          position: 'top-center',
          bossEdgeMargin: 0.5
        },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-2-after-boss-break',
        type: 'break',
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 2500, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-3-wave-1',
        type: 'wave',
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_ECHO.id },
            { archetypeId: SLIME_BUG.id },
            { archetypeId: SLIME_ECHO.id },
            { archetypeId: SLIME_STAR.id },
            { archetypeId: SLIME_BUG.id },
            { archetypeId: SLIME_ECHO.id },
            { archetypeId: SLIME_STAR.id },
            { archetypeId: SLIME_BUG.id }
          ],
          spawnIntervalMs: 1300,
          maxAlive: 5,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 3.5, durationMs: 9000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-3-wave-2',
        type: 'wave',
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_ECHO.id },
            { archetypeId: SLIME_BUG.id },
            { archetypeId: SLIME_STAR.id },
            { archetypeId: SLIME_LIFTER.id },
            { archetypeId: SLIME_BUG.id },
            { archetypeId: SLIME_STAR.id },
            { archetypeId: SLIME_LIFTER.id },
            { archetypeId: SLIME_ECHO.id },
            { archetypeId: SLIME_DRONE.id },
            { archetypeId: SLIME_STAR.id },
            { archetypeId: SLIME_LIFTER.id }
          ],
          spawnIntervalMs: 1050,
          maxAlive: 6,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 3.5, toMargin: 4.5, durationMs: 10500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-3-wave-3',
        type: 'wave',
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_ECHO.id },
            { archetypeId: SLIME_BUG.id },
            { archetypeId: SLIME_STAR.id },
            { archetypeId: SLIME_LIFTER.id },
            { archetypeId: SLIME_DRONE.id },
            { archetypeId: SLIME_STAR.id },
            { archetypeId: SLIME_LIFTER.id },
            { archetypeId: SLIME_DRONE.id },
            { archetypeId: SLIME_SAW.id },
            { archetypeId: SLIME_BUG.id },
            { archetypeId: SLIME_STAR.id },
            { archetypeId: SLIME_LIFTER.id },
            { archetypeId: SLIME_DRONE.id },
            { archetypeId: SLIME_SAW.id }
          ],
          spawnIntervalMs: 900,
          maxAlive: 7,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 4.5, toMargin: 5.5, durationMs: 12500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-3-pre-boss-break',
        type: 'break',
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'expandLinear', fromMargin: 5.5, toMargin: 0, durationMs: 2500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 3000, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-3-boss',
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
      },
      {
        id: 'campaign-set-3-after-boss-break',
        type: 'break',
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 2500, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-4-wave-1',
        type: 'wave',
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_TADPOLE.id },
            { archetypeId: SLIME_FORTRESS.id },
            { archetypeId: SLIME_TADPOLE.id },
            { archetypeId: SLIME_SPLITTER.id },
            { archetypeId: SLIME_FORTRESS.id },
            { archetypeId: SLIME_TADPOLE.id },
            { archetypeId: SLIME_SPLITTER.id },
            { archetypeId: SLIME_FORTRESS.id }
          ],
          spawnIntervalMs: 1200,
          maxAlive: 6,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 3.5, durationMs: 9500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-4-wave-2',
        type: 'wave',
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_TADPOLE.id },
            { archetypeId: SLIME_FORTRESS.id },
            { archetypeId: SLIME_SPLITTER.id },
            { archetypeId: SLIME_PRINCE.id },
            { archetypeId: SLIME_FORTRESS.id },
            { archetypeId: SLIME_SPLITTER.id },
            { archetypeId: SLIME_PRINCE.id },
            { archetypeId: SLIME_TADPOLE.id },
            { archetypeId: SLIME_DASHER.id },
            { archetypeId: SLIME_SPLITTER.id },
            { archetypeId: SLIME_PRINCE.id },
            { archetypeId: SLIME_DASHER.id }
          ],
          spawnIntervalMs: 950,
          maxAlive: 7,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 3.5, toMargin: 4.5, durationMs: 11000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-4-wave-3',
        type: 'wave',
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_TADPOLE.id },
            { archetypeId: SLIME_FORTRESS.id },
            { archetypeId: SLIME_SPLITTER.id },
            { archetypeId: SLIME_PRINCE.id },
            { archetypeId: SLIME_DASHER.id },
            { archetypeId: SLIME_SPLITTER.id },
            { archetypeId: SLIME_PRINCE.id },
            { archetypeId: SLIME_DASHER.id },
            { archetypeId: SLIME_KINGLING.id },
            { archetypeId: SLIME_FORTRESS.id },
            { archetypeId: SLIME_SPLITTER.id },
            { archetypeId: SLIME_PRINCE.id },
            { archetypeId: SLIME_DASHER.id },
            { archetypeId: SLIME_KINGLING.id },
            { archetypeId: SLIME_KINGLING.id }
          ],
          spawnIntervalMs: 800,
          maxAlive: 8,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 4.5, toMargin: 5.5, durationMs: 13000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-4-pre-boss-break',
        type: 'break',
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'expandLinear', fromMargin: 5.5, toMargin: 0, durationMs: 2500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 3000, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-4-boss',
        type: 'boss',
        spawnPlan: {
          kind: 'boss',
          bossArchetypeId: BOSS_TOWER_SENTINEL.id,
          position: 'top-center',
          bossEdgeMargin: 0.5
        },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-4-after-boss-break',
        type: 'break',
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 2500, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-5-wave-1',
        type: 'wave',
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_DOOR.id },
            { archetypeId: SLIME_CANDLE.id },
            { archetypeId: SLIME_DOOR.id },
            { archetypeId: SLIME_MECH.id },
            { archetypeId: SLIME_CANDLE.id },
            { archetypeId: SLIME_DOOR.id },
            { archetypeId: SLIME_MECH.id },
            { archetypeId: SLIME_CANDLE.id },
            { archetypeId: SLIME_DOOR.id }
          ],
          spawnIntervalMs: 1100,
          maxAlive: 7,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 3.5, durationMs: 10000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-5-wave-2',
        type: 'wave',
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_DOOR.id },
            { archetypeId: SLIME_CANDLE.id },
            { archetypeId: SLIME_MECH.id },
            { archetypeId: SLIME_CLAMPER.id },
            { archetypeId: SLIME_CANDLE.id },
            { archetypeId: SLIME_MECH.id },
            { archetypeId: SLIME_CLAMPER.id },
            { archetypeId: SLIME_DOOR.id },
            { archetypeId: SLIME_NINJA.id },
            { archetypeId: SLIME_MECH.id },
            { archetypeId: SLIME_CLAMPER.id },
            { archetypeId: SLIME_NINJA.id },
            { archetypeId: SLIME_CANDLE.id }
          ],
          spawnIntervalMs: 850,
          maxAlive: 8,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 3.5, toMargin: 4.5, durationMs: 12000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-5-wave-3',
        type: 'wave',
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_DOOR.id },
            { archetypeId: SLIME_CANDLE.id },
            { archetypeId: SLIME_MECH.id },
            { archetypeId: SLIME_CLAMPER.id },
            { archetypeId: SLIME_NINJA.id },
            { archetypeId: SLIME_MECH.id },
            { archetypeId: SLIME_CLAMPER.id },
            { archetypeId: SLIME_NINJA.id },
            { archetypeId: SLIME_OBELISK.id },
            { archetypeId: SLIME_CANDLE.id },
            { archetypeId: SLIME_MECH.id },
            { archetypeId: SLIME_CLAMPER.id },
            { archetypeId: SLIME_NINJA.id },
            { archetypeId: SLIME_OBELISK.id },
            { archetypeId: SLIME_OBELISK.id },
            { archetypeId: SLIME_NINJA.id }
          ],
          spawnIntervalMs: 700,
          maxAlive: 9,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 4.5, toMargin: 5.5, durationMs: 14000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-5-pre-boss-break',
        type: 'break',
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'expandLinear', fromMargin: 5.5, toMargin: 0, durationMs: 2500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 3000, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-5-boss',
        type: 'boss',
        spawnPlan: {
          kind: 'boss',
          bossArchetypeId: BOSS_BUBBLE_HOG.id,
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
