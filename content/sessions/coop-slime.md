# Session

| field | value |
|---|---|
| displayName | Co-Op vs Slimes |
| description | Online co-op slime waves with shared revives, companions, and a boss finish. |
| musicSampleId | music/005-forest |
| visibleInMenu | false |
| order | 92 |
| online | true |
| maxPlayers | 4 |
| lateJoinAllowed | true |
| lobbyKind | hostControlled |
| arenaWidth | 32 |
| arenaHeight | 18 |
| dynamicRoster | true |
| playerId | hero-training |
| loadoutWeaponIds | pistol, shotgun, smg, grenade-launcher |
| selectedWeaponIndex | 0 |
| slimeFriendlyFire | true |
| playerVsPlayerDamage | false |
| aimAssistEnabled | false |
| aimAssistMaxAngleRadians | 0 |
| aimAssistMaxDistance | 0 |
| aimAssistStrength | 0 |
| winCondition | bossDefeated |
| lossCondition | allPlayersDead |

| backgroundId | image |
|---|---|
| coop-yard | ![Co-Op Yard](../../public/images/bg/bg-01.jpg) |
| coop-ruins | ![Co-Op Ruins](../../public/images/bg/bg-03.jpg) |

# CoopRevive

| field | value |
|---|---|
| rescueRadius | 1.5 |
| rescueDurationMs | 2500 |
| reviveHpFraction | 0.5 |

# Companion

| field | value |
|---|---|
| enabled | true |
| maxHp | 5 |
| contactBoxWidth | 0.55 |
| contactBoxHeight | 0.55 |
| movementMaxSpeed | 3.2 |
| movementAcceleration | 22 |
| movementOrbitRadius | 3.2 |
| threatAcquireRadius | 5.5 |
| threatReleaseRadius | 6.5 |
| weaponLoadoutIds | pistol |
| weaponSelectedIndex | 0 |
| boopRadius | 1.1 |
| boopImpulse | 7 |
| boopDurationMs | 260 |
| boopCooldownMs | 900 |
| rescueRadius | 1.4 |
| rescueDurationMs | 5000 |
| rescueReviveHpFraction | 0.5 |

# Encounters

## coop-slime-wave-1

| field | value |
|---|---|
| type | wave |
| backgroundId | coop-yard |
| introDurationMs | 2200 |
| name | Party Crashers |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 1000 |
| maxAlive | 7 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 0 |
| zoneToMargin | 2 |
| zoneDurationMs | 16000 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-one-eye |
| 2 | slime-one-eye |
| 3 | slime-sleeper |
| 4 | slime-hornling |
| 5 | slime-spark |
| 6 | slime-hornling |
| 7 | slime-sleeper |
| 8 | slime-spark |
| 9 | slime-many-eye |
| 10 | slime-stonehead |

## coop-slime-wave-2

| field | value |
|---|---|
| type | wave |
| backgroundId | coop-yard |
| introDurationMs | 2200 |
| name | Crossfire Practice |
| text | none |
| spawnKind | wave |
| spawnIntervalMs | 850 |
| maxAlive | 8 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 2 |
| zoneToMargin | 3 |
| zoneDurationMs | 18000 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-spark |
| 2 | slime-hornling |
| 3 | slime-shell |
| 4 | slime-trickster |
| 5 | slime-wraith |
| 6 | slime-shell |
| 7 | slime-spark |
| 8 | slime-stonehead |
| 9 | slime-trickster |
| 10 | slime-wraith |
| 11 | slime-many-eye |
| 12 | slime-stonehead |

| seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex |
|---:|---|---|---|---:|---|---|
| 8 | none | none | none | none | rock-thrower | 0 |
| 12 | none | none | none | none | rock-thrower | 0 |

## coop-slime-pre-boss-break

| field | value |
|---|---|
| type | break |
| backgroundId | coop-ruins |
| introDurationMs | none |
| name | none |
| text | Hold the circle. Big one incoming. |
| spawnKind | empty |
| zoneKind | expandLinear |
| zoneFromMargin | 3 |
| zoneToMargin | 0 |
| zoneDurationMs | 2500 |
| transitionKind | timer |
| transitionDurationMs | 2500 |
| next | sequential |

## coop-slime-boss

| field | value |
|---|---|
| type | boss |
| backgroundId | coop-ruins |
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
