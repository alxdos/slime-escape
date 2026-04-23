# Session

| field | value |
|---|---|
| displayName | Побег |
| description | Основной забег: три волны, передышки и финальный босс. |
| visibleInMenu | true |
| order | 0 |
| arenaId | sandbox |
| playerId | hero-training |
| loadoutWeaponId | pistol |
| winCondition | bossDefeated |
| lossCondition | playerDeath |

# Encounters

## campaign-wave-1

| field | value |
|---|---|
| type | wave |
| spawnKind | wave |
| spawnIntervalMs | 1500 |
| maxAlive | 4 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 0 |
| zoneToMargin | 4 |
| zoneDurationMs | 8000 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-one-eye |
| 2 | slime-one-eye |
| 3 | slime-shell |
| 4 | slime-one-eye |
| 5 | slime-one-eye |
| 6 | slime-shell |

## campaign-break-after-wave-1

| field | value |
|---|---|
| type | break |
| spawnKind | empty |
| zoneKind | expandLinear |
| zoneFromMargin | 4 |
| zoneToMargin | 0 |
| zoneDurationMs | 2500 |
| transitionKind | timer |
| transitionDurationMs | 3000 |
| next | sequential |

## campaign-wave-2

| field | value |
|---|---|
| type | wave |
| spawnKind | wave |
| spawnIntervalMs | 1200 |
| maxAlive | 5 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 0 |
| zoneToMargin | 5 |
| zoneDurationMs | 10000 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-one-eye |
| 2 | slime-one-eye |
| 3 | slime-one-eye |
| 4 | slime-shell |
| 5 | slime-one-eye |
| 6 | slime-one-eye |
| 7 | slime-shell |
| 8 | slime-one-eye |
| 9 | slime-shell |
| 10 | slime-one-eye |

## campaign-break-after-wave-2

| field | value |
|---|---|
| type | break |
| spawnKind | empty |
| zoneKind | expandLinear |
| zoneFromMargin | 5 |
| zoneToMargin | 0 |
| zoneDurationMs | 2500 |
| transitionKind | timer |
| transitionDurationMs | 3000 |
| next | sequential |

## campaign-wave-3

| field | value |
|---|---|
| type | wave |
| spawnKind | wave |
| spawnIntervalMs | 1000 |
| maxAlive | 6 |
| edgeMargin | 0.5 |
| zoneKind | shrinkLinear |
| zoneFromMargin | 0 |
| zoneToMargin | 5 |
| zoneDurationMs | 12000 |
| transitionKind | allEnemiesCleared |
| next | sequential |

| seq | archetypeId |
|---:|---|
| 1 | slime-one-eye |
| 2 | slime-one-eye |
| 3 | slime-one-eye |
| 4 | slime-one-eye |
| 5 | slime-shell |
| 6 | slime-one-eye |
| 7 | slime-shell |
| 8 | slime-one-eye |
| 9 | slime-shell |
| 10 | slime-one-eye |
| 11 | slime-one-eye |
| 12 | slime-shell |

## campaign-pre-boss-break

| field | value |
|---|---|
| type | break |
| spawnKind | empty |
| zoneKind | expandLinear |
| zoneFromMargin | 5 |
| zoneToMargin | 0 |
| zoneDurationMs | 2500 |
| transitionKind | timer |
| transitionDurationMs | 3000 |
| next | sequential |

## campaign-boss

| field | value |
|---|---|
| type | boss |
| spawnKind | boss |
| bossArchetypeId | boss-scrap-king |
| bossSpawnPosition | top-center |
| bossEdgeMargin | 0.5 |
| zoneKind | disabled |
| transitionKind | allEnemiesCleared |
| next | sequential |
