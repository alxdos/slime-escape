// AUTO-GENERATED from content/sessions/*.md by `npm run content:build`.
// Do not edit by hand.
import { SANDBOX_ARENA } from './arenas';
import { BOSS_BUBBLE_HOG, BOSS_GARGOYLE, BOSS_SAW_CYCLOPS, BOSS_SCRAP_KING, BOSS_TOWER_SENTINEL } from './bosses.generated';
import { FRAGMENT, HEAL_ORB, MAGNET, MULTI_SHOT, OVERDRIVE, SIZE_UP } from './drops.generated';
import { SLIME_BUG, SLIME_CANDLE, SLIME_CLAMPER, SLIME_DASHER, SLIME_DOOR, SLIME_DRONE, SLIME_ECHO, SLIME_FLAME, SLIME_FORTRESS, SLIME_HORNLING, SLIME_IDOL, SLIME_KINGLING, SLIME_LIFTER, SLIME_MANY_EYE, SLIME_MECH, SLIME_MECH_CRAB, SLIME_NINJA, SLIME_OBELISK, SLIME_ONE_EYE, SLIME_PRINCE, SLIME_SAW, SLIME_SHELL, SLIME_SLEEPER, SLIME_SPARK, SLIME_SPLITTER, SLIME_STACK, SLIME_STAR, SLIME_STONEHEAD, SLIME_TADPOLE, SLIME_TRICKSTER, SLIME_WRAITH } from './enemies.generated';
import { SANDBOX_PLAYER, TRAINING_PLAYER } from './players.generated';
import type { SessionPresetTemplate } from './sessions';
import { BOMB_PLACER, DEMO_HAZARD_GRENADE, DEMO_PROXIMITY_MINE, FIREBALL_STAFF, GRENADE_LAUNCHER, LASER, PISTOL, ROCK_THROWER, SHOTGUN, SMG, SNIPER } from './weapons.generated';

export const SESSION_PRESET_TEMPLATES = {
  'campaign-easy': {
    presetId: 'campaign-easy',
    displayName: 'Кампания — easy',
    description: 'Короткий мягкий забег: friendly fire слаймов, щедрый aim assist, лужи и понятные волны.',
    visibleInMenu: true,
    order: 0,
    arena: SANDBOX_ARENA,
    player: TRAINING_PLAYER,
    loadout: { weapons: [PISTOL.id, SHOTGUN.id, SMG.id, SNIPER.id, LASER.id, ROCK_THROWER.id, GRENADE_LAUNCHER.id, BOMB_PLACER.id, FIREBALL_STAFF.id], selectedIndex: 1 },
    backgrounds: [
      {
        id: 'set-1',
        imageUrl: '/images/bg/bg-01.jpg'
      },
      {
        id: 'set-3',
        imageUrl: '/images/bg/bg-03.jpg'
      },
      {
        id: 'set-5',
        imageUrl: '/images/bg/bg-05.jpg'
      }
    ],
    musicSampleId: 'music/007-nature',
    rules: { damage: { slimeFriendlyFire: true }, aimAssist: { enabled: true, maxAngleRadians: 0.4, maxDistance: 8, strength: 0.7 } },
    winCondition: { kind: 'allEncountersComplete' },
    lossCondition: { kind: 'playerDeath' },
    encounters: [
      {
        id: 'campaign-easy-set-1-wave-1',
        type: 'wave',
        backgroundId: 'set-1',
        introDurationMs: 2500,
        name: 'Один глаз в темноте',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_SLEEPER.id },
            { archetypeId: SLIME_HORNLING.id }
          ],
          spawnIntervalMs: 2100,
          maxAlive: 3,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 1.2, durationMs: 20000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-easy-set-1-wave-2',
        type: 'wave',
        backgroundId: 'set-1',
        introDurationMs: 2500,
        name: 'Рога и искры',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_SLEEPER.id },
            {
              archetypeId: SLIME_HORNLING.id,
              override: { guaranteedDrops: [HEAL_ORB.id], dropTable: [] }
            },
            { archetypeId: SLIME_SPARK.id },
            { archetypeId: SLIME_HORNLING.id },
            { archetypeId: SLIME_SLEEPER.id }
          ],
          spawnIntervalMs: 1750,
          maxAlive: 4,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 1.2, toMargin: 1.7, durationMs: 23000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-easy-set-3-wave-1',
        type: 'wave',
        backgroundId: 'set-3',
        introDurationMs: 2500,
        name: 'Эхо в противогазах',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_ECHO.id },
            { archetypeId: SLIME_BUG.id },
            { archetypeId: SLIME_STAR.id },
            { archetypeId: SLIME_ECHO.id },
            { archetypeId: SLIME_BUG.id }
          ],
          spawnIntervalMs: 1900,
          maxAlive: 4,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 1.2, durationMs: 22000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-easy-set-3-wave-2',
        type: 'wave',
        backgroundId: 'set-3',
        introDurationMs: 2500,
        name: 'Качки и дроны',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_ECHO.id },
            { archetypeId: SLIME_BUG.id },
            {
              archetypeId: SLIME_STAR.id,
              override: { loadout: { weapons: [DEMO_PROXIMITY_MINE.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_LIFTER.id,
              override: { guaranteedDrops: [HEAL_ORB.id], dropTable: [] }
            },
            { archetypeId: SLIME_ECHO.id },
            { archetypeId: SLIME_STAR.id },
            { archetypeId: SLIME_BUG.id }
          ],
          spawnIntervalMs: 1600,
          maxAlive: 4,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 1.2, toMargin: 1.7, durationMs: 25000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-easy-set-5-wave-1',
        type: 'wave',
        backgroundId: 'set-5',
        introDurationMs: 2500,
        name: 'Дискеты и двигатели',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_DOOR.id },
            {
              archetypeId: SLIME_CANDLE.id,
              override: { loadout: { weapons: [DEMO_HAZARD_GRENADE.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_DOOR.id },
            { archetypeId: SLIME_MECH.id },
            { archetypeId: SLIME_CANDLE.id }
          ],
          spawnIntervalMs: 1700,
          maxAlive: 4,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 1.2, durationMs: 24000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-easy-set-5-wave-2',
        type: 'wave',
        backgroundId: 'set-5',
        introDurationMs: 2500,
        name: 'Магниты и ниндзя',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_DOOR.id },
            { archetypeId: SLIME_CANDLE.id },
            {
              archetypeId: SLIME_MECH.id,
              override: { loadout: { weapons: [DEMO_HAZARD_GRENADE.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_CLAMPER.id,
              override: { guaranteedDrops: [HEAL_ORB.id], dropTable: [] }
            },
            { archetypeId: SLIME_DOOR.id },
            {
              archetypeId: SLIME_CANDLE.id,
              override: { loadout: { weapons: [DEMO_HAZARD_GRENADE.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_MECH.id }
          ],
          spawnIntervalMs: 1450,
          maxAlive: 5,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 1.2, toMargin: 1.7, durationMs: 27000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      }
    ]
  },
  'campaign-hard': {
    presetId: 'campaign-hard',
    displayName: 'Кампания — hard',
    description: 'Плотный забег со стреляющими слаймами, скупыми дропами и короткими окнами реакции.',
    visibleInMenu: true,
    order: 2,
    arena: SANDBOX_ARENA,
    player: TRAINING_PLAYER,
    loadout: { weapons: [PISTOL.id, SMG.id, ROCK_THROWER.id], selectedIndex: 0 },
    backgrounds: [
      {
        id: 'set-1',
        imageUrl: '/images/bg/bg-01.jpg'
      },
      {
        id: 'set-2',
        imageUrl: '/images/bg/bg-02.jpg'
      },
      {
        id: 'set-3',
        imageUrl: '/images/bg/bg-03.jpg'
      },
      {
        id: 'set-4',
        imageUrl: '/images/bg/bg-04.jpg'
      },
      {
        id: 'set-5',
        imageUrl: '/images/bg/bg-05.jpg'
      }
    ],
    musicSampleId: 'music/100-waves',
    rules: { damage: { slimeFriendlyFire: false }, aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 } },
    winCondition: { kind: 'allEncountersComplete' },
    lossCondition: { kind: 'playerDeath' },
    encounters: [
      {
        id: 'campaign-set-1-wave-1',
        type: 'wave',
        backgroundId: 'set-1',
        introDurationMs: 2500,
        name: 'Один глаз в темноте',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            {
              archetypeId: SLIME_ONE_EYE.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_ONE_EYE.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_SLEEPER.id,
              override: { dropTable: [], loadout: { weapons: [PISTOL.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_ONE_EYE.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_HORNLING.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_SLEEPER.id,
              override: { dropTable: [] }
            }
          ],
          spawnIntervalMs: 1125,
          maxAlive: 5,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 2.6, durationMs: 11200 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-1-wave-2',
        type: 'wave',
        backgroundId: 'set-1',
        introDurationMs: 2500,
        name: 'Рога и искры',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            {
              archetypeId: SLIME_ONE_EYE.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_SLEEPER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_HORNLING.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_SPARK.id,
              override: { dropTable: [], loadout: { weapons: [SMG.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_SPARK.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_HORNLING.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_SPARK.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_SLEEPER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_HORNLING.id,
              override: { dropTable: [] }
            }
          ],
          spawnIntervalMs: 938,
          maxAlive: 7,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 2, toMargin: 3.64, durationMs: 12800 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-1-wave-3',
        type: 'wave',
        backgroundId: 'set-1',
        introDurationMs: 2500,
        name: 'Каменные взгляды',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            {
              archetypeId: SLIME_ONE_EYE.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_SLEEPER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_HORNLING.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_SPARK.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_MANY_EYE.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_HORNLING.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_SPARK.id,
              override: { dropTable: [], loadout: { weapons: [PISTOL.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_MANY_EYE.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_STONEHEAD.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_SPARK.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_MANY_EYE.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_STONEHEAD.id,
              override: { dropTable: [], loadout: { weapons: [SMG.id], selectedIndex: 0 } }
            }
          ],
          spawnIntervalMs: 825,
          maxAlive: 8,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 2.8, toMargin: 4.55, durationMs: 14400 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-1-pre-boss-break',
        type: 'break',
        backgroundId: 'set-1',
        introDurationMs: 0,
        name: null,
        text: null,
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'expandLinear', fromMargin: 4.55, toMargin: 0, durationMs: 3500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 3500, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-1-boss',
        type: 'boss',
        backgroundId: 'set-1',
        introDurationMs: 0,
        name: null,
        text: null,
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
        backgroundId: 'set-1',
        introDurationMs: 0,
        name: null,
        text: 'Дальше: Хламные призраки',
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
        backgroundId: 'set-2',
        introDurationMs: 2500,
        name: 'Панцири и призраки',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            {
              archetypeId: SLIME_TRICKSTER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_WRAITH.id,
              override: { dropTable: [], loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_TRICKSTER.id,
              override: { dropTable: [] }
            },
            { archetypeId: SLIME_SHELL.id },
            {
              archetypeId: SLIME_WRAITH.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_TRICKSTER.id,
              override: { dropTable: [] }
            },
            { archetypeId: SLIME_SHELL.id }
          ],
          spawnIntervalMs: 1050,
          maxAlive: 7,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 2.6, durationMs: 12000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-2-wave-2',
        type: 'wave',
        backgroundId: 'set-2',
        introDurationMs: 2500,
        name: 'Хламная куча',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            {
              archetypeId: SLIME_TRICKSTER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_WRAITH.id,
              override: { dropTable: [] }
            },
            { archetypeId: SLIME_SHELL.id },
            {
              archetypeId: SLIME_STACK.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_STACK.id,
              override: { dropTable: [], loadout: { weapons: [GRENADE_LAUNCHER.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_SHELL.id },
            {
              archetypeId: SLIME_STACK.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_TRICKSTER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_MECH_CRAB.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_STACK.id,
              override: { dropTable: [] }
            }
          ],
          spawnIntervalMs: 863,
          maxAlive: 8,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 2, toMargin: 3.64, durationMs: 13600 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-2-wave-3',
        type: 'wave',
        backgroundId: 'set-2',
        introDurationMs: 2500,
        name: 'Огненный скрап',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            {
              archetypeId: SLIME_TRICKSTER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_WRAITH.id,
              override: { dropTable: [] }
            },
            { archetypeId: SLIME_SHELL.id },
            {
              archetypeId: SLIME_STACK.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_MECH_CRAB.id,
              override: { dropTable: [] }
            },
            { archetypeId: SLIME_SHELL.id },
            {
              archetypeId: SLIME_STACK.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_MECH_CRAB.id,
              override: { dropTable: [], loadout: { weapons: [GRENADE_LAUNCHER.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_FLAME.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_WRAITH.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_STACK.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_MECH_CRAB.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_FLAME.id,
              override: { dropTable: [], loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            }
          ],
          spawnIntervalMs: 750,
          maxAlive: 8,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 2.8, toMargin: 4.55, durationMs: 15200 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-2-pre-boss-break',
        type: 'break',
        backgroundId: 'set-2',
        introDurationMs: 0,
        name: null,
        text: null,
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'expandLinear', fromMargin: 4.55, toMargin: 0, durationMs: 3500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 3500, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-2-boss',
        type: 'boss',
        backgroundId: 'set-2',
        introDurationMs: 0,
        name: null,
        text: null,
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
        backgroundId: 'set-2',
        introDurationMs: 0,
        name: null,
        text: 'Дальше: Индустриальные мутанты',
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
        backgroundId: 'set-3',
        introDurationMs: 2500,
        name: 'Эхо в противогазах',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            {
              archetypeId: SLIME_ECHO.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_BUG.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_ECHO.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_IDOL.id,
              override: { dropTable: [], loadout: { weapons: [LASER.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_BUG.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_ECHO.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_STAR.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_IDOL.id,
              override: { dropTable: [], loadout: { weapons: [SNIPER.id], selectedIndex: 0 } }
            }
          ],
          spawnIntervalMs: 975,
          maxAlive: 7,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 2.6, durationMs: 12800 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-3-wave-2',
        type: 'wave',
        backgroundId: 'set-3',
        introDurationMs: 2500,
        name: 'Качки и дроны',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            {
              archetypeId: SLIME_ECHO.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_BUG.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_STAR.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_IDOL.id,
              override: { dropTable: [], loadout: { weapons: [LASER.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_ECHO.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_STAR.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_IDOL.id,
              override: { dropTable: [], loadout: { weapons: [SNIPER.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_ECHO.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_DRONE.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_STAR.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_IDOL.id,
              override: { dropTable: [], loadout: { weapons: [LASER.id], selectedIndex: 0 } }
            }
          ],
          spawnIntervalMs: 788,
          maxAlive: 8,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 2, toMargin: 3.64, durationMs: 14400 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-3-wave-3',
        type: 'wave',
        backgroundId: 'set-3',
        introDurationMs: 2500,
        name: 'Бензопильный цех',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            {
              archetypeId: SLIME_ECHO.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_BUG.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_STAR.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_IDOL.id,
              override: { dropTable: [], loadout: { weapons: [LASER.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_DRONE.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_STAR.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_LIFTER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_IDOL.id,
              override: { dropTable: [], loadout: { weapons: [SNIPER.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_SAW.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_BUG.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_STAR.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_IDOL.id,
              override: { dropTable: [], loadout: { weapons: [LASER.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_DRONE.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_IDOL.id,
              override: { dropTable: [], loadout: { weapons: [SNIPER.id], selectedIndex: 0 } }
            }
          ],
          spawnIntervalMs: 675,
          maxAlive: 10,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 2.8, toMargin: 4.55, durationMs: 16000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-3-pre-boss-break',
        type: 'break',
        backgroundId: 'set-3',
        introDurationMs: 0,
        name: null,
        text: null,
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'expandLinear', fromMargin: 4.55, toMargin: 0, durationMs: 3500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 3500, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-3-boss',
        type: 'boss',
        backgroundId: 'set-3',
        introDurationMs: 0,
        name: null,
        text: null,
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
        backgroundId: 'set-3',
        introDurationMs: 0,
        name: null,
        text: 'Дальше: Королевство на войне',
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
        backgroundId: 'set-4',
        introDurationMs: 2500,
        name: 'Бомбы у ворот',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            {
              archetypeId: SLIME_TADPOLE.id,
              override: { dropTable: [] }
            },
            { archetypeId: SLIME_FORTRESS.id },
            {
              archetypeId: SLIME_TADPOLE.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_SPLITTER.id,
              override: { dropTable: [] }
            },
            { archetypeId: SLIME_FORTRESS.id },
            {
              archetypeId: SLIME_TADPOLE.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_IDOL.id,
              override: { dropTable: [], loadout: { weapons: [BOMB_PLACER.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_FORTRESS.id }
          ],
          spawnIntervalMs: 900,
          maxAlive: 8,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 2.6, durationMs: 13600 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-4-wave-2',
        type: 'wave',
        backgroundId: 'set-4',
        introDurationMs: 2500,
        name: 'Принцы и сюрикены',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            {
              archetypeId: SLIME_TADPOLE.id,
              override: { dropTable: [] }
            },
            { archetypeId: SLIME_FORTRESS.id },
            {
              archetypeId: SLIME_SPLITTER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_MECH_CRAB.id,
              override: { dropTable: [], retaliation: { enabled: true, durationMs: 2600 } }
            },
            {
              archetypeId: SLIME_IDOL.id,
              override: { dropTable: [], loadout: { weapons: [BOMB_PLACER.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_SPLITTER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_PRINCE.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_TADPOLE.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_DASHER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_SPLITTER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_MECH_CRAB.id,
              override: { dropTable: [], retaliation: { enabled: true, durationMs: 2600 } }
            },
            {
              archetypeId: SLIME_IDOL.id,
              override: { dropTable: [], loadout: { weapons: [BOMB_PLACER.id], selectedIndex: 0 } }
            }
          ],
          spawnIntervalMs: 713,
          maxAlive: 10,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 2, toMargin: 3.64, durationMs: 15200 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-4-wave-3',
        type: 'wave',
        backgroundId: 'set-4',
        introDurationMs: 2500,
        name: 'Корона мёртвых',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            {
              archetypeId: SLIME_TADPOLE.id,
              override: { dropTable: [] }
            },
            { archetypeId: SLIME_FORTRESS.id },
            {
              archetypeId: SLIME_SPLITTER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_MECH_CRAB.id,
              override: { dropTable: [], retaliation: { enabled: true, durationMs: 3000 } }
            },
            {
              archetypeId: SLIME_DASHER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_SPLITTER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_PRINCE.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_DASHER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_IDOL.id,
              override: { dropTable: [], loadout: { weapons: [BOMB_PLACER.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_FORTRESS.id },
            {
              archetypeId: SLIME_SPLITTER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_MECH_CRAB.id,
              override: { dropTable: [], retaliation: { enabled: true, durationMs: 3000 } }
            },
            {
              archetypeId: SLIME_DASHER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_IDOL.id,
              override: { dropTable: [], loadout: { weapons: [BOMB_PLACER.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_KINGLING.id }
          ],
          spawnIntervalMs: 600,
          maxAlive: 11,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 2.8, toMargin: 4.55, durationMs: 16800 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-4-pre-boss-break',
        type: 'break',
        backgroundId: 'set-4',
        introDurationMs: 0,
        name: null,
        text: null,
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'expandLinear', fromMargin: 4.55, toMargin: 0, durationMs: 3500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 3500, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-4-boss',
        type: 'boss',
        backgroundId: 'set-4',
        introDurationMs: 0,
        name: null,
        text: null,
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
        backgroundId: 'set-4',
        introDurationMs: 0,
        name: null,
        text: 'Дальше: Техно-финал',
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
        backgroundId: 'set-5',
        introDurationMs: 2500,
        name: 'Дискеты и двигатели',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_DOOR.id },
            {
              archetypeId: SLIME_CANDLE.id,
              override: { dropTable: [] }
            },
            { archetypeId: SLIME_DOOR.id },
            {
              archetypeId: SLIME_MECH.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_CANDLE.id,
              override: { dropTable: [] }
            },
            { archetypeId: SLIME_DOOR.id },
            {
              archetypeId: SLIME_MECH.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_CANDLE.id,
              override: { dropTable: [] }
            },
            { archetypeId: SLIME_DOOR.id }
          ],
          spawnIntervalMs: 825,
          maxAlive: 10,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 2.6, durationMs: 14400 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-5-wave-2',
        type: 'wave',
        backgroundId: 'set-5',
        introDurationMs: 2500,
        name: 'Магниты и ниндзя',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_DOOR.id },
            {
              archetypeId: SLIME_CANDLE.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_MECH.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_CLAMPER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_OBELISK.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_MECH.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_CLAMPER.id,
              override: { dropTable: [] }
            },
            { archetypeId: SLIME_DOOR.id },
            {
              archetypeId: SLIME_NINJA.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_MECH.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_CLAMPER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_NINJA.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_CANDLE.id,
              override: { dropTable: [] }
            }
          ],
          spawnIntervalMs: 638,
          maxAlive: 11,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 2, toMargin: 3.64, durationMs: 16000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-5-wave-3',
        type: 'wave',
        backgroundId: 'set-5',
        introDurationMs: 2500,
        name: 'Идолы последнего сектора',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_DOOR.id },
            {
              archetypeId: SLIME_CANDLE.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_MECH.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_CLAMPER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_NINJA.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_MECH.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_CLAMPER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_NINJA.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_IDOL.id,
              override: { dropTable: [], loadout: { weapons: [FIREBALL_STAFF.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_CANDLE.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_MECH.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_CLAMPER.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_NINJA.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_OBELISK.id,
              override: { dropTable: [] }
            },
            {
              archetypeId: SLIME_IDOL.id,
              override: { dropTable: [], loadout: { weapons: [FIREBALL_STAFF.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_NINJA.id,
              override: { dropTable: [] }
            }
          ],
          spawnIntervalMs: 525,
          maxAlive: 12,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 2.8, toMargin: 4.55, durationMs: 17600 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-5-pre-boss-break',
        type: 'break',
        backgroundId: 'set-5',
        introDurationMs: 0,
        name: null,
        text: null,
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'expandLinear', fromMargin: 4.55, toMargin: 0, durationMs: 3500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 3500, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-5-boss',
        type: 'boss',
        backgroundId: 'set-5',
        introDurationMs: 0,
        name: null,
        text: null,
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
  'campaign-normal': {
    presetId: 'campaign-normal',
    displayName: 'Кампания — normal',
    description: 'Основной забег: пять тематических сетов с камнями, минами и опасными лужами.',
    visibleInMenu: true,
    order: 1,
    arena: SANDBOX_ARENA,
    player: TRAINING_PLAYER,
    loadout: { weapons: [PISTOL.id, SHOTGUN.id, SMG.id, SNIPER.id, DEMO_HAZARD_GRENADE.id, DEMO_PROXIMITY_MINE.id], selectedIndex: 0 },
    backgrounds: [
      {
        id: 'set-1',
        imageUrl: '/images/bg/bg-01.jpg'
      },
      {
        id: 'set-2',
        imageUrl: '/images/bg/bg-02.jpg'
      },
      {
        id: 'set-3',
        imageUrl: '/images/bg/bg-03.jpg'
      },
      {
        id: 'set-4',
        imageUrl: '/images/bg/bg-04.jpg'
      },
      {
        id: 'set-5',
        imageUrl: '/images/bg/bg-05.jpg'
      }
    ],
    musicSampleId: 'music/005-forest',
    rules: { damage: { slimeFriendlyFire: true }, aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 } },
    winCondition: { kind: 'allEncountersComplete' },
    lossCondition: { kind: 'playerDeath' },
    encounters: [
      {
        id: 'campaign-set-1-wave-1',
        type: 'wave',
        backgroundId: 'set-1',
        introDurationMs: 2500,
        name: 'Один глаз в темноте',
        text: null,
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
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 2, durationMs: 14000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-1-wave-2',
        type: 'wave',
        backgroundId: 'set-1',
        introDurationMs: 2500,
        name: 'Рога и искры',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_ONE_EYE.id },
            { archetypeId: SLIME_SLEEPER.id },
            { archetypeId: SLIME_HORNLING.id },
            { archetypeId: SLIME_SPARK.id },
            {
              archetypeId: SLIME_SPARK.id,
              override: { guaranteedDrops: [SIZE_UP.id], dropTable: [] }
            },
            { archetypeId: SLIME_HORNLING.id },
            { archetypeId: SLIME_SPARK.id },
            { archetypeId: SLIME_SLEEPER.id },
            { archetypeId: SLIME_HORNLING.id }
          ],
          spawnIntervalMs: 1250,
          maxAlive: 5,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 2, toMargin: 2.8, durationMs: 16000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-1-wave-3',
        type: 'wave',
        backgroundId: 'set-1',
        introDurationMs: 2500,
        name: 'Каменные взгляды',
        text: null,
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
            {
              archetypeId: SLIME_STONEHEAD.id,
              override: { loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_SPARK.id },
            { archetypeId: SLIME_MANY_EYE.id },
            {
              archetypeId: SLIME_STONEHEAD.id,
              override: { loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            }
          ],
          spawnIntervalMs: 1100,
          maxAlive: 6,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 2.8, toMargin: 3.5, durationMs: 18000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-1-pre-boss-break',
        type: 'break',
        backgroundId: 'set-1',
        introDurationMs: 0,
        name: null,
        text: null,
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'expandLinear', fromMargin: 3.5, toMargin: 0, durationMs: 3500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 3500, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-1-boss',
        type: 'boss',
        backgroundId: 'set-1',
        introDurationMs: 0,
        name: null,
        text: null,
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
        backgroundId: 'set-1',
        introDurationMs: 0,
        name: null,
        text: 'Дальше: Хламные призраки',
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
        backgroundId: 'set-2',
        introDurationMs: 2500,
        name: 'Панцири и призраки',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_TRICKSTER.id },
            { archetypeId: SLIME_WRAITH.id },
            { archetypeId: SLIME_TRICKSTER.id },
            {
              archetypeId: SLIME_SHELL.id,
              override: { loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_WRAITH.id },
            { archetypeId: SLIME_TRICKSTER.id },
            {
              archetypeId: SLIME_SHELL.id,
              override: { loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            }
          ],
          spawnIntervalMs: 1400,
          maxAlive: 5,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 2, durationMs: 15000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-2-wave-2',
        type: 'wave',
        backgroundId: 'set-2',
        introDurationMs: 2500,
        name: 'Хламная куча',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_TRICKSTER.id },
            { archetypeId: SLIME_WRAITH.id },
            {
              archetypeId: SLIME_SHELL.id,
              override: { loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_STACK.id },
            {
              archetypeId: SLIME_STACK.id,
              override: { guaranteedDrops: [MULTI_SHOT.id], dropTable: [] }
            },
            {
              archetypeId: SLIME_SHELL.id,
              override: { loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_STACK.id },
            { archetypeId: SLIME_TRICKSTER.id },
            {
              archetypeId: SLIME_MECH_CRAB.id,
              override: { loadout: { weapons: [DEMO_PROXIMITY_MINE.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_STACK.id }
          ],
          spawnIntervalMs: 1150,
          maxAlive: 6,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 2, toMargin: 2.8, durationMs: 17000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-2-wave-3',
        type: 'wave',
        backgroundId: 'set-2',
        introDurationMs: 2500,
        name: 'Огненный скрап',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_TRICKSTER.id },
            { archetypeId: SLIME_WRAITH.id },
            {
              archetypeId: SLIME_SHELL.id,
              override: { loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_STACK.id },
            {
              archetypeId: SLIME_MECH_CRAB.id,
              override: { loadout: { weapons: [DEMO_PROXIMITY_MINE.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_SHELL.id,
              override: { loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_STACK.id },
            {
              archetypeId: SLIME_MECH_CRAB.id,
              override: { loadout: { weapons: [DEMO_PROXIMITY_MINE.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_FLAME.id,
              override: { loadout: { weapons: [DEMO_HAZARD_GRENADE.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_WRAITH.id },
            { archetypeId: SLIME_STACK.id },
            {
              archetypeId: SLIME_MECH_CRAB.id,
              override: { loadout: { weapons: [DEMO_PROXIMITY_MINE.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_FLAME.id,
              override: { loadout: { weapons: [DEMO_HAZARD_GRENADE.id], selectedIndex: 0 } }
            }
          ],
          spawnIntervalMs: 1000,
          maxAlive: 6,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 2.8, toMargin: 3.5, durationMs: 19000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-2-pre-boss-break',
        type: 'break',
        backgroundId: 'set-2',
        introDurationMs: 0,
        name: null,
        text: null,
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'expandLinear', fromMargin: 3.5, toMargin: 0, durationMs: 3500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 3500, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-2-boss',
        type: 'boss',
        backgroundId: 'set-2',
        introDurationMs: 0,
        name: null,
        text: null,
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
        backgroundId: 'set-2',
        introDurationMs: 0,
        name: null,
        text: 'Дальше: Индустриальные мутанты',
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
        backgroundId: 'set-3',
        introDurationMs: 2500,
        name: 'Эхо в противогазах',
        text: null,
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
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 2, durationMs: 16000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-3-wave-2',
        type: 'wave',
        backgroundId: 'set-3',
        introDurationMs: 2500,
        name: 'Качки и дроны',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_ECHO.id },
            { archetypeId: SLIME_BUG.id },
            { archetypeId: SLIME_STAR.id },
            {
              archetypeId: SLIME_LIFTER.id,
              override: { loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_ECHO.id,
              override: { guaranteedDrops: [MAGNET.id], dropTable: [] }
            },
            { archetypeId: SLIME_STAR.id },
            {
              archetypeId: SLIME_LIFTER.id,
              override: { loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_ECHO.id },
            { archetypeId: SLIME_DRONE.id },
            { archetypeId: SLIME_STAR.id },
            {
              archetypeId: SLIME_LIFTER.id,
              override: { loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            }
          ],
          spawnIntervalMs: 1050,
          maxAlive: 6,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 2, toMargin: 2.8, durationMs: 18000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-3-wave-3',
        type: 'wave',
        backgroundId: 'set-3',
        introDurationMs: 2500,
        name: 'Бензопильный цех',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_ECHO.id },
            { archetypeId: SLIME_BUG.id },
            { archetypeId: SLIME_STAR.id },
            {
              archetypeId: SLIME_LIFTER.id,
              override: { loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_DRONE.id },
            { archetypeId: SLIME_STAR.id },
            {
              archetypeId: SLIME_LIFTER.id,
              override: { loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_DRONE.id },
            { archetypeId: SLIME_SAW.id },
            { archetypeId: SLIME_BUG.id },
            { archetypeId: SLIME_STAR.id },
            {
              archetypeId: SLIME_LIFTER.id,
              override: { loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_DRONE.id },
            { archetypeId: SLIME_SAW.id }
          ],
          spawnIntervalMs: 900,
          maxAlive: 7,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 2.8, toMargin: 3.5, durationMs: 20000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-3-pre-boss-break',
        type: 'break',
        backgroundId: 'set-3',
        introDurationMs: 0,
        name: null,
        text: null,
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'expandLinear', fromMargin: 3.5, toMargin: 0, durationMs: 3500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 3500, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-3-boss',
        type: 'boss',
        backgroundId: 'set-3',
        introDurationMs: 0,
        name: null,
        text: null,
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
        backgroundId: 'set-3',
        introDurationMs: 0,
        name: null,
        text: 'Дальше: Королевство на войне',
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
        backgroundId: 'set-4',
        introDurationMs: 2500,
        name: 'Бомбы у ворот',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_TADPOLE.id },
            {
              archetypeId: SLIME_FORTRESS.id,
              override: { loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_TADPOLE.id },
            { archetypeId: SLIME_SPLITTER.id },
            {
              archetypeId: SLIME_FORTRESS.id,
              override: { loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_TADPOLE.id },
            { archetypeId: SLIME_SPLITTER.id },
            {
              archetypeId: SLIME_FORTRESS.id,
              override: { loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            }
          ],
          spawnIntervalMs: 1200,
          maxAlive: 6,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 2, durationMs: 17000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-4-wave-2',
        type: 'wave',
        backgroundId: 'set-4',
        introDurationMs: 2500,
        name: 'Принцы и сюрикены',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_TADPOLE.id },
            {
              archetypeId: SLIME_FORTRESS.id,
              override: { loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_SPLITTER.id },
            { archetypeId: SLIME_PRINCE.id },
            {
              archetypeId: SLIME_PRINCE.id,
              override: { guaranteedDrops: [FRAGMENT.id], dropTable: [] }
            },
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
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 2, toMargin: 2.8, durationMs: 19000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-4-wave-3',
        type: 'wave',
        backgroundId: 'set-4',
        introDurationMs: 2500,
        name: 'Корона мёртвых',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_TADPOLE.id },
            {
              archetypeId: SLIME_FORTRESS.id,
              override: { loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_SPLITTER.id },
            { archetypeId: SLIME_PRINCE.id },
            { archetypeId: SLIME_DASHER.id },
            { archetypeId: SLIME_SPLITTER.id },
            { archetypeId: SLIME_PRINCE.id },
            { archetypeId: SLIME_DASHER.id },
            { archetypeId: SLIME_KINGLING.id },
            {
              archetypeId: SLIME_FORTRESS.id,
              override: { loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 } }
            },
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
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 2.8, toMargin: 3.5, durationMs: 21000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-4-pre-boss-break',
        type: 'break',
        backgroundId: 'set-4',
        introDurationMs: 0,
        name: null,
        text: null,
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'expandLinear', fromMargin: 3.5, toMargin: 0, durationMs: 3500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 3500, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-4-boss',
        type: 'boss',
        backgroundId: 'set-4',
        introDurationMs: 0,
        name: null,
        text: null,
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
        backgroundId: 'set-4',
        introDurationMs: 0,
        name: null,
        text: 'Дальше: Техно-финал',
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
        backgroundId: 'set-5',
        introDurationMs: 2500,
        name: 'Дискеты и двигатели',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_DOOR.id },
            {
              archetypeId: SLIME_CANDLE.id,
              override: { loadout: { weapons: [DEMO_HAZARD_GRENADE.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_DOOR.id },
            {
              archetypeId: SLIME_MECH.id,
              override: { loadout: { weapons: [DEMO_PROXIMITY_MINE.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_CANDLE.id },
            { archetypeId: SLIME_DOOR.id },
            {
              archetypeId: SLIME_MECH.id,
              override: { loadout: { weapons: [DEMO_PROXIMITY_MINE.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_CANDLE.id,
              override: { loadout: { weapons: [DEMO_HAZARD_GRENADE.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_DOOR.id }
          ],
          spawnIntervalMs: 1100,
          maxAlive: 7,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 2, durationMs: 18000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-5-wave-2',
        type: 'wave',
        backgroundId: 'set-5',
        introDurationMs: 2500,
        name: 'Магниты и ниндзя',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_DOOR.id },
            { archetypeId: SLIME_CANDLE.id },
            {
              archetypeId: SLIME_MECH.id,
              override: { loadout: { weapons: [DEMO_PROXIMITY_MINE.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_CLAMPER.id,
              override: { loadout: { weapons: [DEMO_PROXIMITY_MINE.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_OBELISK.id,
              override: { guaranteedDrops: [OVERDRIVE.id], dropTable: [] }
            },
            { archetypeId: SLIME_MECH.id },
            { archetypeId: SLIME_CLAMPER.id },
            { archetypeId: SLIME_DOOR.id },
            { archetypeId: SLIME_NINJA.id },
            {
              archetypeId: SLIME_MECH.id,
              override: { loadout: { weapons: [DEMO_PROXIMITY_MINE.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_CLAMPER.id },
            { archetypeId: SLIME_NINJA.id },
            {
              archetypeId: SLIME_CANDLE.id,
              override: { loadout: { weapons: [DEMO_HAZARD_GRENADE.id], selectedIndex: 0 } }
            }
          ],
          spawnIntervalMs: 850,
          maxAlive: 8,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 2, toMargin: 2.8, durationMs: 20000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-5-wave-3',
        type: 'wave',
        backgroundId: 'set-5',
        introDurationMs: 2500,
        name: 'Идолы последнего сектора',
        text: null,
        spawnPlan: {
          kind: 'wave',
          spawns: [
            { archetypeId: SLIME_DOOR.id },
            { archetypeId: SLIME_CANDLE.id },
            {
              archetypeId: SLIME_MECH.id,
              override: { loadout: { weapons: [DEMO_PROXIMITY_MINE.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_CLAMPER.id,
              override: { loadout: { weapons: [DEMO_PROXIMITY_MINE.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_NINJA.id },
            { archetypeId: SLIME_MECH.id },
            { archetypeId: SLIME_CLAMPER.id },
            { archetypeId: SLIME_NINJA.id },
            {
              archetypeId: SLIME_OBELISK.id,
              override: { loadout: { weapons: [DEMO_HAZARD_GRENADE.id], selectedIndex: 0 } }
            },
            {
              archetypeId: SLIME_CANDLE.id,
              override: { loadout: { weapons: [DEMO_HAZARD_GRENADE.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_MECH.id },
            { archetypeId: SLIME_CLAMPER.id },
            { archetypeId: SLIME_NINJA.id },
            {
              archetypeId: SLIME_OBELISK.id,
              override: { loadout: { weapons: [DEMO_HAZARD_GRENADE.id], selectedIndex: 0 } }
            },
            { archetypeId: SLIME_OBELISK.id },
            { archetypeId: SLIME_NINJA.id }
          ],
          spawnIntervalMs: 700,
          maxAlive: 9,
          edgeMargin: 0.5
        },
        zoneBehavior: { kind: 'shrinkLinear', fromMargin: 2.8, toMargin: 3.5, durationMs: 22000 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-5-pre-boss-break',
        type: 'break',
        backgroundId: 'set-5',
        introDurationMs: 0,
        name: null,
        text: null,
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'expandLinear', fromMargin: 3.5, toMargin: 0, durationMs: 3500 },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 3500, next: 'sequential' },
        tuning: null
      },
      {
        id: 'campaign-set-5-boss',
        type: 'boss',
        backgroundId: 'set-5',
        introDurationMs: 0,
        name: null,
        text: null,
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
  'combat-modifiers-demo': {
    presetId: 'combat-modifiers-demo',
    displayName: 'Combat Modifiers Demo',
    description: 'Проверочная арена для puddles, statuses, proximity mines, carrier drops, magnet pickup, retaliation and aim assist.',
    visibleInMenu: false,
    order: 1,
    arena: SANDBOX_ARENA,
    player: SANDBOX_PLAYER,
    loadout: { weapons: [DEMO_HAZARD_GRENADE.id, DEMO_PROXIMITY_MINE.id, PISTOL.id], selectedIndex: 0 },
    backgrounds: [
      {
        id: 'sandbox',
        imageUrl: '/images/bg/bg-01.jpg'
      }
    ],
    musicSampleId: null,
    rules: { damage: { slimeFriendlyFire: true }, aimAssist: { enabled: true, maxAngleRadians: 0.35, maxDistance: 8, strength: 0.65 } },
    winCondition: { kind: 'none' },
    lossCondition: { kind: 'none' },
    encounters: [
      {
        id: 'combat-modifiers-demo-encounter',
        type: 'sandbox',
        backgroundId: 'sandbox',
        introDurationMs: 0,
        name: null,
        text: null,
        spawnPlan: {
          kind: 'static',
          spawns: [
            {
              archetypeId: SLIME_STAR.id,
              position: { x: 4, y: 1.5 },
              override: { guaranteedDrops: [MAGNET.id, HEAL_ORB.id], dropTable: [] }
            },
            {
              archetypeId: SLIME_SAW.id,
              position: { x: 5, y: -1 },
              override: { dropTable: [{ archetypeId: HEAL_ORB.id, chance: 0.2 }], retaliation: { enabled: true, durationMs: 2500 } }
            },
            {
              archetypeId: SLIME_SAW.id,
              position: { x: 7, y: -1 },
              override: { dropTable: [{ archetypeId: HEAL_ORB.id, chance: 0.2 }], retaliation: { enabled: true, durationMs: 2500 } }
            },
            {
              archetypeId: SLIME_BUG.id,
              position: { x: 6, y: 2.5 }
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
  sandbox: {
    presetId: 'sandbox',
    displayName: 'Песочница',
    description: 'Свободная пустая арена для проверки перемещения и камеры.',
    visibleInMenu: false,
    order: 0,
    arena: SANDBOX_ARENA,
    player: SANDBOX_PLAYER,
    loadout: null,
    backgrounds: [
      {
        id: 'sandbox',
        imageUrl: '/images/bg/bg-01.jpg'
      }
    ],
    musicSampleId: null,
    rules: { damage: { slimeFriendlyFire: false }, aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 } },
    winCondition: { kind: 'none' },
    lossCondition: { kind: 'none' },
    encounters: [
      {
        id: 'sandbox-encounter',
        type: 'sandbox',
        backgroundId: 'sandbox',
        introDurationMs: 0,
        name: null,
        text: null,
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
    loadout: { weapons: [PISTOL.id, ROCK_THROWER.id, GRENADE_LAUNCHER.id, BOMB_PLACER.id, FIREBALL_STAFF.id], selectedIndex: 0 },
    backgrounds: [
      {
        id: 'sandbox',
        imageUrl: '/images/bg/bg-01.jpg'
      }
    ],
    musicSampleId: null,
    rules: { damage: { slimeFriendlyFire: false }, aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 } },
    winCondition: { kind: 'none' },
    lossCondition: { kind: 'none' },
    encounters: [
      {
        id: 'sandbox-with-combat-encounter',
        type: 'sandbox',
        backgroundId: 'sandbox',
        introDurationMs: 0,
        name: null,
        text: null,
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
    visibleInMenu: false,
    order: 1,
    arena: SANDBOX_ARENA,
    player: TRAINING_PLAYER,
    loadout: { weapons: [PISTOL.id, SHOTGUN.id, SMG.id], selectedIndex: 0 },
    backgrounds: [
      {
        id: 'training',
        imageUrl: '/images/bg/bg-01.jpg'
      }
    ],
    musicSampleId: 'music/001-calm',
    rules: { damage: { slimeFriendlyFire: false }, aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 } },
    winCondition: { kind: 'allEncountersComplete' },
    lossCondition: { kind: 'playerDeath' },
    encounters: [
      {
        id: 'training-wave-1',
        type: 'wave',
        backgroundId: 'training',
        introDurationMs: 0,
        name: null,
        text: null,
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
        backgroundId: 'training',
        introDurationMs: 0,
        name: null,
        text: null,
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
        backgroundId: 'training',
        introDurationMs: 0,
        name: null,
        text: null,
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
