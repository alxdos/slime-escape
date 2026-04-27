# Session

| field | value |
|---|---|
| displayName | Portal Run |
| description | Специальный вход для Vibe Jam: десять нарастающих волн, вооруженные слаймы и финальный gargoyle boss. |
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
| introDurationMs | none |
| name | none |
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

## portal-wave-2

| field | value |
|---|---|
| type | wave |
| backgroundId | portal |
| introDurationMs | none |
| name | none |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 1250 |
| maxAlive | 5 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 1.2 |
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

## portal-wave-3

| field | value |
|---|---|
| type | wave |
| backgroundId | portal |
| introDurationMs | none |
| name | none |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 1150 |
| maxAlive | 6 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 1.7 |
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

## portal-wave-4

| field | value |
|---|---|
| type | wave |
| backgroundId | portal |
| introDurationMs | none |
| name | none |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 1080 |
| maxAlive | 6 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 2.2 |
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

## portal-wave-5

| field | value |
|---|---|
| type | wave |
| backgroundId | portal |
| introDurationMs | none |
| name | none |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 1000 |
| maxAlive | 7 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 2.6 |
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

## portal-wave-6

| field | value |
|---|---|
| type | wave |
| backgroundId | portal |
| introDurationMs | none |
| name | none |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 930 |
| maxAlive | 8 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 3 |
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

## portal-wave-7

| field | value |
|---|---|
| type | wave |
| backgroundId | portal |
| introDurationMs | none |
| name | none |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 860 |
| maxAlive | 8 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 3.4 |
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

## portal-wave-8

| field | value |
|---|---|
| type | wave |
| backgroundId | portal |
| introDurationMs | none |
| name | none |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 800 |
| maxAlive | 9 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 3.8 |
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

## portal-wave-9

| field | value |
|---|---|
| type | wave |
| backgroundId | portal |
| introDurationMs | none |
| name | none |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 740 |
| maxAlive | 10 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 4.2 |
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

## portal-wave-10

| field | value |
|---|---|
| type | wave |
| backgroundId | portal |
| introDurationMs | none |
| name | none |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 680 |
| maxAlive | 11 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 4.6 |
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
