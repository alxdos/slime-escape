# Session

| field | value |
|---|---|
| displayName | Campaign - Easy |
| description | A short, gentle run with slime friendly fire, generous aim assist, and readable armed slimes. |
| musicSampleId | music/007-nature |
| visibleInMenu | true |
| order | 0 |
| arenaId | sandbox |
| playerId | hero-training |
| loadoutWeaponIds | pistol, shotgun, smg, sniper, rock-thrower, grenade-launcher, bomb-placer, fireball-staff |
| selectedWeaponIndex | 1 |
| slimeFriendlyFire | true |
| aimAssistEnabled | true |
| aimAssistMaxAngleRadians | 0.4 |
| aimAssistMaxDistance | 8 |
| aimAssistStrength | 0.7 |
| winCondition | allEncountersComplete |
| lossCondition | playerDeath |

| backgroundId | image |
|---|---|
| set-1 | ![Set 1](../../public/images/bg/bg-01.jpg) |
| set-3 | ![Set 3](../../public/images/bg/bg-03.jpg) |
| set-5 | ![Set 5](../../public/images/bg/bg-05.jpg) |

# Encounters

## campaign-easy-set-1-wave-1

| field | value |
|---|---|
| type | wave |
| backgroundId | set-1 |
| introDurationMs | 2500 |
| name | One Eye in the Dark |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 2100 |
| maxAlive | 3 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 0 |
| zoneToMargin | 1.2 |
| zoneDurationMs | 20000 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-one-eye |
| 2 | slime-one-eye |
| 3 | slime-sleeper |
| 4 | slime-hornling |

## campaign-easy-set-1-wave-2

| field | value |
|---|---|
| type | wave |
| backgroundId | set-1 |
| introDurationMs | 2500 |
| name | Horns and Sparks |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 1750 |
| maxAlive | 4 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 1.2 |
| zoneToMargin | 1.7 |
| zoneDurationMs | 23000 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-one-eye |
| 2 | slime-sleeper |
| 3 | slime-hornling |
| 4 | slime-spark |
| 5 | slime-hornling |
| 6 | slime-sleeper |

| seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex |
|---:|---|---|---|---:|---|---|
| 3 | heal-orb | empty | none | none | none | none |

## campaign-easy-set-3-wave-1

| field | value |
|---|---|
| type | wave |
| backgroundId | set-3 |
| introDurationMs | 2500 |
| name | Gas-Mask Echoes |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 1900 |
| maxAlive | 4 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 0 |
| zoneToMargin | 1.2 |
| zoneDurationMs | 22000 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-echo |
| 2 | slime-bug |
| 3 | slime-star |
| 4 | slime-echo |
| 5 | slime-bug |

## campaign-easy-set-3-wave-2

| field | value |
|---|---|
| type | wave |
| backgroundId | set-3 |
| introDurationMs | 2500 |
| name | Bruisers and Drones |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 1600 |
| maxAlive | 4 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 1.2 |
| zoneToMargin | 1.7 |
| zoneDurationMs | 25000 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-echo |
| 2 | slime-bug |
| 3 | slime-star |
| 4 | slime-lifter |
| 5 | slime-echo |
| 6 | slime-star |
| 7 | slime-bug |

| seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex |
|---:|---|---|---|---:|---|---|
| 3 | none | none | none | none | rock-thrower | 0 |
| 4 | heal-orb | empty | none | none | none | none |

## campaign-easy-set-5-wave-1

| field | value |
|---|---|
| type | wave |
| backgroundId | set-5 |
| introDurationMs | 2500 |
| name | Floppy Disks and Engines |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 1700 |
| maxAlive | 4 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 0 |
| zoneToMargin | 1.2 |
| zoneDurationMs | 24000 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-door |
| 2 | slime-candle |
| 3 | slime-door |
| 4 | slime-mech |
| 5 | slime-candle |

| seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex |
|---:|---|---|---|---:|---|---|
| 2 | none | none | none | none | smg | 0 |

## campaign-easy-set-5-wave-2

| field | value |
|---|---|
| type | wave |
| backgroundId | set-5 |
| introDurationMs | 2500 |
| name | Magnets and Ninjas |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 1450 |
| maxAlive | 5 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 1.2 |
| zoneToMargin | 1.7 |
| zoneDurationMs | 27000 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-door |
| 2 | slime-candle |
| 3 | slime-mech |
| 4 | slime-clamper |
| 5 | slime-door |
| 6 | slime-candle |
| 7 | slime-mech |

| seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex |
|---:|---|---|---|---:|---|---|
| 3 | none | none | none | none | rock-thrower | 0 |
| 4 | heal-orb | empty | none | none | none | none |
| 6 | none | none | none | none | smg | 0 |
