# Session

| field | value |
|---|---|
| displayName | Training |
| description | A structured boss-free lesson run: movement, pickups, darkness pressure, weapon rhythm, and armed slimes. |
| musicSampleId | music/001-calm |
| visibleInMenu | false |
| order | 1 |
| arenaId | sandbox |
| playerId | hero-training |
| loadoutWeaponIds | pistol, shotgun, smg |
| selectedWeaponIndex | 0 |
| slimeFriendlyFire | true |
| aimAssistEnabled | true |
| aimAssistMaxAngleRadians | 0.35 |
| aimAssistMaxDistance | 8 |
| aimAssistStrength | 0.55 |
| winCondition | allEncountersComplete |
| lossCondition | playerDeath |

| backgroundId | image |
|---|---|
| range | ![Range](../../public/images/bg/bg-02.jpg) |
| field | ![Field](../../public/images/bg/bg-01.jpg) |
| pressure | ![Pressure](../../public/images/bg/bg-03.jpg) |

# Encounters

## training-intro

| field | value |
|---|---|
| type | break |
| backgroundId | range |
| introDurationMs | none |
| name | none |
| text | Lesson one: move while you shoot. Standing still is how slime wins. |
| spawnKind | empty |
| zoneKind | disabled |
| transitionKind | timer |
| transitionDurationMs | 6500 |
| next | sequential |

## training-footwork

| field | value |
|---|---|
| type | wave |
| backgroundId | range |
| introDurationMs | 1800 |
| name | Footwork |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 1400 |
| maxAlive | 3 |
| edgeMargin | 0.5 |
| zoneKind | disabled |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-one-eye |
| 2 | slime-one-eye |
| 3 | slime-sleeper |
| 4 | slime-one-eye |
| 5 | slime-hornling |

## training-pickup-brief

| field | value |
|---|---|
| type | break |
| backgroundId | field |
| introDurationMs | none |
| name | none |
| text | Good. The glow is worth a risk, but only when you have a path out. |
| spawnKind | empty |
| zoneKind | disabled |
| transitionKind | timer |
| transitionDurationMs | 7000 |
| next | sequential |

## training-pickups

| field | value |
|---|---|
| type | wave |
| backgroundId | field |
| introDurationMs | 1800 |
| name | Pickups |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 1300 |
| maxAlive | 4 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 0 |
| zoneToMargin | 1.4 |
| zoneDurationMs | 16000 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-one-eye |
| 2 | slime-spark |
| 3 | slime-one-eye |
| 4 | slime-hornling |
| 5 | slime-spark |
| 6 | slime-hornling |

| seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex |
|---:|---|---|---|---:|---|---|
| 2 | speed-up | empty | none | none | none | none |
| 4 | size-up | empty | none | none | none | none |
| 6 | heal-orb | empty | none | none | none | none |

## training-darkness-brief

| field | value |
|---|---|
| type | break |
| backgroundId | field |
| introDurationMs | none |
| name | none |
| text | The dark edge is a timer. Finish the wave before it steals your warning. |
| spawnKind | empty |
| zoneKind | expandLinear |
| zoneFromMargin | 1.4 |
| zoneToMargin | 0 |
| zoneDurationMs | 2600 |
| transitionKind | timer |
| transitionDurationMs | 7000 |
| next | sequential |

## training-darkness-clock

| field | value |
|---|---|
| type | wave |
| backgroundId | field |
| introDurationMs | 1800 |
| name | Darkness Clock |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 1150 |
| maxAlive | 5 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 0 |
| zoneToMargin | 2.6 |
| zoneDurationMs | 19000 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-one-eye |
| 2 | slime-hornling |
| 3 | slime-spark |
| 4 | slime-shell |
| 5 | slime-one-eye |
| 6 | slime-stonehead |
| 7 | slime-spark |
| 8 | slime-shell |

| seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex |
|---:|---|---|---|---:|---|---|
| 4 | multi-shot | empty | none | none | none | none |
| 6 | heal-orb | empty | none | none | none | none |

## training-weapon-brief

| field | value |
|---|---|
| type | break |
| backgroundId | pressure |
| introDurationMs | none |
| name | none |
| text | Switch weapons on purpose: pistol for control, shotgun for clumps, SMG for panic. |
| spawnKind | empty |
| zoneKind | expandLinear |
| zoneFromMargin | 2.6 |
| zoneToMargin | 0 |
| zoneDurationMs | 2800 |
| transitionKind | timer |
| transitionDurationMs | 8000 |
| next | sequential |

## training-weapon-rhythm

| field | value |
|---|---|
| type | wave |
| backgroundId | pressure |
| introDurationMs | 1800 |
| name | Weapon Rhythm |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 1050 |
| maxAlive | 6 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 0 |
| zoneToMargin | 2.8 |
| zoneDurationMs | 21000 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-hornling |
| 2 | slime-one-eye |
| 3 | slime-shell |
| 4 | slime-many-eye |
| 5 | slime-hornling |
| 6 | slime-stonehead |
| 7 | slime-shell |
| 8 | slime-spark |
| 9 | slime-many-eye |
| 10 | slime-stonehead |

| seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex |
|---:|---|---|---|---:|---|---|
| 3 | pierce | empty | none | none | none | none |
| 6 | overdrive | empty | none | none | none | none |
| 10 | heal-orb | empty | none | none | none | none |

## training-return-fire-brief

| field | value |
|---|---|
| type | break |
| backgroundId | pressure |
| introDurationMs | none |
| name | none |
| text | One slime has a weapon. Strafe across its aim and let friendly fire work. |
| spawnKind | empty |
| zoneKind | expandLinear |
| zoneFromMargin | 2.8 |
| zoneToMargin | 0 |
| zoneDurationMs | 3000 |
| transitionKind | timer |
| transitionDurationMs | 8000 |
| next | sequential |

## training-return-fire

| field | value |
|---|---|
| type | wave |
| backgroundId | pressure |
| introDurationMs | 1800 |
| name | Return Fire |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 1100 |
| maxAlive | 5 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 0 |
| zoneToMargin | 3.2 |
| zoneDurationMs | 23000 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-hornling |
| 2 | slime-spark |
| 3 | slime-shell |
| 4 | slime-saw |
| 5 | slime-stonehead |
| 6 | slime-drone |
| 7 | slime-shell |
| 8 | slime-spark |
| 9 | slime-saw |

| seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex |
|---:|---|---|---|---:|---|---|
| 5 | heal-orb | empty | none | none | pistol | 0 |
| 9 | overdrive | empty | none | none | none | none |

## training-complete

| field | value |
|---|---|
| type | break |
| backgroundId | range |
| introDurationMs | none |
| name | none |
| text | Training complete. The portal run will not be polite, but it will be readable. |
| spawnKind | empty |
| zoneKind | expandLinear |
| zoneFromMargin | 3.2 |
| zoneToMargin | 0 |
| zoneDurationMs | 3200 |
| transitionKind | timer |
| transitionDurationMs | 6500 |
| next | sequential |
