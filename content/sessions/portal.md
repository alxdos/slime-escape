# Session

| field | value |
|---|---|
| displayName | Portal Run |
| description | Vibe Jam entry point: ten escalating waves, short portal breaths, armed slimes, and a final gargoyle boss. |
| musicSampleId | music/005-forest |
| visibleInMenu | false |
| order | 90 |
| arenaId | sandbox |
| playerId | hero-training |
| loadoutWeaponIds | pistol, shotgun, smg, sniper, grenade-launcher |
| selectedWeaponIndex | 0 |
| slimeFriendlyFire | true |
| aimAssistEnabled | false |
| aimAssistMaxAngleRadians | 0 |
| aimAssistMaxDistance | 0 |
| aimAssistStrength | 0 |
| winCondition | allEncountersComplete |
| lossCondition | playerDeath |

| backgroundId | image |
|---|---|
| portal | ![Portal](../../public/images/bg/bg-01.jpg) |

# Encounters

## portal-wave-1

| field | value |
|---|---|
| type | wave |
| backgroundId | portal |
| introDurationMs | 1600 |
| name | Gate Static |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 1350 |
| maxAlive | 4 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 0 |
| zoneToMargin | 1.2 |
| zoneDurationMs | 14000 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-one-eye |
| 2 | slime-one-eye |
| 3 | slime-sleeper |
| 4 | slime-one-eye |
| 5 | slime-hornling |

## portal-break-1

| field | value |
|---|---|
| type | break |
| backgroundId | portal |
| introDurationMs | none |
| name | none |
| text | The portal opens in pulses. Breathe when it does, then move. |
| spawnKind | empty |
| zoneKind | expandLinear |
| zoneFromMargin | 1.2 |
| zoneToMargin | 0 |
| zoneDurationMs | 2400 |
| transitionKind | timer |
| transitionDurationMs | 6500 |
| next | sequential |

## portal-wave-2

| field | value |
|---|---|
| type | wave |
| backgroundId | portal |
| introDurationMs | 1600 |
| name | Horns in the Signal |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 1250 |
| maxAlive | 5 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 0 |
| zoneToMargin | 1.7 |
| zoneDurationMs | 15000 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-one-eye |
| 2 | slime-sleeper |
| 3 | slime-hornling |
| 4 | slime-spark |
| 5 | slime-one-eye |
| 6 | slime-hornling |
| 7 | slime-spark |

## portal-break-2

| field | value |
|---|---|
| type | break |
| backgroundId | portal |
| introDurationMs | none |
| name | none |
| text | Sparks mark the fast ones. Clear them before the circle tightens. |
| spawnKind | empty |
| zoneKind | expandLinear |
| zoneFromMargin | 1.7 |
| zoneToMargin | 0 |
| zoneDurationMs | 2400 |
| transitionKind | timer |
| transitionDurationMs | 7000 |
| next | sequential |

## portal-wave-3

| field | value |
|---|---|
| type | wave |
| backgroundId | portal |
| introDurationMs | 1600 |
| name | Stone on the Line |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 1150 |
| maxAlive | 6 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 0 |
| zoneToMargin | 2.2 |
| zoneDurationMs | 16500 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-one-eye |
| 2 | slime-sleeper |
| 3 | slime-hornling |
| 4 | slime-spark |
| 5 | slime-many-eye |
| 6 | slime-stonehead |
| 7 | slime-hornling |
| 8 | slime-spark |
| 9 | slime-stonehead |

| seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex |
|---:|---|---|---|---:|---|---|
| 6 | none | none | none | none | rock-thrower | 0 |
| 9 | none | none | none | none | rock-thrower | 0 |

## portal-break-3

| field | value |
|---|---|
| type | break |
| backgroundId | portal |
| introDurationMs | none |
| name | none |
| text | Heavy slimes carry strange tools. Take what falls and keep running. |
| spawnKind | empty |
| zoneKind | expandLinear |
| zoneFromMargin | 2.2 |
| zoneToMargin | 0 |
| zoneDurationMs | 2500 |
| transitionKind | timer |
| transitionDurationMs | 7000 |
| next | sequential |

## portal-wave-4

| field | value |
|---|---|
| type | wave |
| backgroundId | portal |
| introDurationMs | 1600 |
| name | Shells at the Rim |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 1080 |
| maxAlive | 6 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 0 |
| zoneToMargin | 2.6 |
| zoneDurationMs | 17500 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-one-eye |
| 2 | slime-hornling |
| 3 | slime-many-eye |
| 4 | slime-shell |
| 5 | slime-spark |
| 6 | slime-stonehead |
| 7 | slime-trickster |
| 8 | slime-many-eye |
| 9 | slime-shell |
| 10 | slime-stonehead |
| 11 | slime-spark |

| seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex |
|---:|---|---|---|---:|---|---|
| 6 | none | none | none | none | rock-thrower | 0 |
| 10 | none | none | none | none | rock-thrower | 0 |

## portal-break-4

| field | value |
|---|---|
| type | break |
| backgroundId | portal |
| introDurationMs | none |
| name | none |
| text | The gate is learning your route. Change lanes before the next pull. |
| spawnKind | empty |
| zoneKind | expandLinear |
| zoneFromMargin | 2.6 |
| zoneToMargin | 0 |
| zoneDurationMs | 2500 |
| transitionKind | timer |
| transitionDurationMs | 7000 |
| next | sequential |

## portal-wave-5

| field | value |
|---|---|
| type | wave |
| backgroundId | portal |
| introDurationMs | 1600 |
| name | Wraith Current |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 1000 |
| maxAlive | 7 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 0 |
| zoneToMargin | 3 |
| zoneDurationMs | 19000 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-hornling |
| 2 | slime-spark |
| 3 | slime-many-eye |
| 4 | slime-shell |
| 5 | slime-trickster |
| 6 | slime-stonehead |
| 7 | slime-wraith |
| 8 | slime-shell |
| 9 | slime-spark |
| 10 | slime-many-eye |
| 11 | slime-trickster |
| 12 | slime-stonehead |
| 13 | slime-one-eye |

| seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex |
|---:|---|---|---|---:|---|---|
| 6 | none | none | none | none | rock-thrower | 0 |
| 9 | none | none | none | none | pistol | 0 |
| 12 | none | none | none | none | rock-thrower | 0 |

## portal-break-5

| field | value |
|---|---|
| type | break |
| backgroundId | portal |
| introDurationMs | none |
| name | none |
| text | Do not save every pickup. Spend power while the crowd is still thin. |
| spawnKind | empty |
| zoneKind | expandLinear |
| zoneFromMargin | 3 |
| zoneToMargin | 0 |
| zoneDurationMs | 2600 |
| transitionKind | timer |
| transitionDurationMs | 7000 |
| next | sequential |

## portal-wave-6

| field | value |
|---|---|
| type | wave |
| backgroundId | portal |
| introDurationMs | 1600 |
| name | Fire in the Aperture |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 930 |
| maxAlive | 8 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 0 |
| zoneToMargin | 3.4 |
| zoneDurationMs | 20500 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-hornling |
| 2 | slime-spark |
| 3 | slime-shell |
| 4 | slime-trickster |
| 5 | slime-wraith |
| 6 | slime-stonehead |
| 7 | slime-flame |
| 8 | slime-shell |
| 9 | slime-spark |
| 10 | slime-many-eye |
| 11 | slime-trickster |
| 12 | slime-stonehead |
| 13 | slime-wraith |
| 14 | slime-flame |
| 15 | slime-one-eye |

| seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex |
|---:|---|---|---|---:|---|---|
| 6 | none | none | none | none | rock-thrower | 0 |
| 10 | none | none | none | none | pistol | 0 |
| 12 | none | none | none | none | rock-thrower | 0 |
| 14 | none | none | none | none | pistol | 0 |

## portal-break-6

| field | value |
|---|---|
| type | break |
| backgroundId | portal |
| introDurationMs | none |
| name | none |
| text | Flame slimes make panic expensive. Keep the center in sight. |
| spawnKind | empty |
| zoneKind | expandLinear |
| zoneFromMargin | 3.4 |
| zoneToMargin | 0 |
| zoneDurationMs | 2600 |
| transitionKind | timer |
| transitionDurationMs | 6500 |
| next | sequential |

## portal-wave-7

| field | value |
|---|---|
| type | wave |
| backgroundId | portal |
| introDurationMs | 1600 |
| name | Lifters in the Wake |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 860 |
| maxAlive | 8 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 0 |
| zoneToMargin | 3.8 |
| zoneDurationMs | 22000 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-shell |
| 2 | slime-trickster |
| 3 | slime-wraith |
| 4 | slime-flame |
| 5 | slime-bug |
| 6 | slime-stonehead |
| 7 | slime-lifter |
| 8 | slime-spark |
| 9 | slime-many-eye |
| 10 | slime-trickster |
| 11 | slime-wraith |
| 12 | slime-stonehead |
| 13 | slime-flame |
| 14 | slime-shell |
| 15 | slime-bug |
| 16 | slime-spark |
| 17 | slime-lifter |

| seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex |
|---:|---|---|---|---:|---|---|
| 6 | none | none | none | none | rock-thrower | 0 |
| 9 | none | none | none | none | pistol | 0 |
| 12 | none | none | none | none | rock-thrower | 0 |
| 14 | none | none | none | none | shotgun | 0 |
| 16 | none | none | none | none | pistol | 0 |

## portal-break-7

| field | value |
|---|---|
| type | break |
| backgroundId | portal |
| introDurationMs | none |
| name | none |
| text | The portal is throwing work crews now. Break the lifters first. |
| spawnKind | empty |
| zoneKind | expandLinear |
| zoneFromMargin | 3.8 |
| zoneToMargin | 0 |
| zoneDurationMs | 2700 |
| transitionKind | timer |
| transitionDurationMs | 7000 |
| next | sequential |

## portal-wave-8

| field | value |
|---|---|
| type | wave |
| backgroundId | portal |
| introDurationMs | 1600 |
| name | Sawtooth Drift |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 800 |
| maxAlive | 9 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 0 |
| zoneToMargin | 4.2 |
| zoneDurationMs | 23500 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-trickster |
| 2 | slime-wraith |
| 3 | slime-flame |
| 4 | slime-bug |
| 5 | slime-lifter |
| 6 | slime-stonehead |
| 7 | slime-saw |
| 8 | slime-shell |
| 9 | slime-many-eye |
| 10 | slime-spark |
| 11 | slime-trickster |
| 12 | slime-stonehead |
| 13 | slime-wraith |
| 14 | slime-flame |
| 15 | slime-bug |
| 16 | slime-shell |
| 17 | slime-lifter |
| 18 | slime-saw |
| 19 | slime-many-eye |

| seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex |
|---:|---|---|---|---:|---|---|
| 6 | none | none | none | none | rock-thrower | 0 |
| 9 | none | none | none | none | pistol | 0 |
| 12 | none | none | none | none | rock-thrower | 0 |
| 14 | none | none | none | none | shotgun | 0 |
| 16 | none | none | none | none | pistol | 0 |
| 18 | none | none | none | none | shotgun | 0 |

## portal-break-8

| field | value |
|---|---|
| type | break |
| backgroundId | portal |
| introDurationMs | none |
| name | none |
| text | Saw slime means no lazy circles. Cut across the arena when it commits. |
| spawnKind | empty |
| zoneKind | expandLinear |
| zoneFromMargin | 4.2 |
| zoneToMargin | 0 |
| zoneDurationMs | 2700 |
| transitionKind | timer |
| transitionDurationMs | 7500 |
| next | sequential |

## portal-wave-9

| field | value |
|---|---|
| type | wave |
| backgroundId | portal |
| introDurationMs | 1600 |
| name | Drone Weather |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 740 |
| maxAlive | 10 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 0 |
| zoneToMargin | 4.6 |
| zoneDurationMs | 25000 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-wraith |
| 2 | slime-flame |
| 3 | slime-bug |
| 4 | slime-lifter |
| 5 | slime-saw |
| 6 | slime-stonehead |
| 7 | slime-drone |
| 8 | slime-shell |
| 9 | slime-many-eye |
| 10 | slime-trickster |
| 11 | slime-wraith |
| 12 | slime-stonehead |
| 13 | slime-flame |
| 14 | slime-bug |
| 15 | slime-lifter |
| 16 | slime-spark |
| 17 | slime-saw |
| 18 | slime-shell |
| 19 | slime-drone |
| 20 | slime-many-eye |
| 21 | slime-trickster |

| seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex |
|---:|---|---|---|---:|---|---|
| 6 | none | none | none | none | rock-thrower | 0 |
| 9 | none | none | none | none | pistol | 0 |
| 12 | none | none | none | none | rock-thrower | 0 |
| 14 | none | none | none | none | shotgun | 0 |
| 16 | none | none | none | none | pistol | 0 |
| 18 | none | none | none | none | shotgun | 0 |
| 20 | none | none | none | none | rock-thrower | 0 |

## portal-break-9

| field | value |
|---|---|
| type | break |
| backgroundId | portal |
| introDurationMs | none |
| name | none |
| text | One more wave. Save a clean lane and a ready weapon. |
| spawnKind | empty |
| zoneKind | expandLinear |
| zoneFromMargin | 4.6 |
| zoneToMargin | 0 |
| zoneDurationMs | 2800 |
| transitionKind | timer |
| transitionDurationMs | 6500 |
| next | sequential |

## portal-wave-10

| field | value |
|---|---|
| type | wave |
| backgroundId | portal |
| introDurationMs | 1600 |
| name | Last Light Before Teeth |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 680 |
| maxAlive | 11 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 0 |
| zoneToMargin | 5 |
| zoneDurationMs | 27000 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-flame |
| 2 | slime-bug |
| 3 | slime-lifter |
| 4 | slime-saw |
| 5 | slime-drone |
| 6 | slime-stonehead |
| 7 | slime-star |
| 8 | slime-shell |
| 9 | slime-many-eye |
| 10 | slime-trickster |
| 11 | slime-wraith |
| 12 | slime-stonehead |
| 13 | slime-flame |
| 14 | slime-bug |
| 15 | slime-lifter |
| 16 | slime-spark |
| 17 | slime-saw |
| 18 | slime-shell |
| 19 | slime-drone |
| 20 | slime-many-eye |
| 21 | slime-trickster |
| 22 | slime-star |
| 23 | slime-wraith |
| 24 | slime-flame |

| seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex |
|---:|---|---|---|---:|---|---|
| 6 | none | none | none | none | rock-thrower | 0 |
| 9 | none | none | none | none | pistol | 0 |
| 12 | none | none | none | none | rock-thrower | 0 |
| 14 | none | none | none | none | shotgun | 0 |
| 16 | none | none | none | none | pistol | 0 |
| 18 | none | none | none | none | shotgun | 0 |
| 20 | none | none | none | none | rock-thrower | 0 |
| 22 | none | none | none | none | grenade-launcher | 0 |
| 24 | none | none | none | none | grenade-launcher | 0 |

## portal-pre-boss-break

| field | value |
|---|---|
| type | break |
| backgroundId | portal |
| introDurationMs | none |
| name | none |
| text | The darkness lets go. Something on the other side is laughing. |
| spawnKind | empty |
| zoneKind | expandLinear |
| zoneFromMargin | 5 |
| zoneToMargin | 0 |
| zoneDurationMs | 3600 |
| transitionKind | timer |
| transitionDurationMs | 8000 |
| next | sequential |

## portal-boss

| field | value |
|---|---|
| type | boss |
| backgroundId | portal |
| introDurationMs | none |
| name | none |
| text | none |
| spawnKind | boss |
| bossArchetypeId | boss-gargoyle |
| bossSpawnPosition | top-center |
| bossEdgeMargin | 0.5 |
| zoneKind | disabled |
| transitionKind | allEnemiesCleared |
| next | sequential |
