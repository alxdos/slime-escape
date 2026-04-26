# Session

| field | value |
|---|---|
| displayName | Тренировка |
| description | Короткая сессия без босса, чтобы размяться и проверить сборку. |
| visibleInMenu | false |
| order | 1 |
| arenaId | sandbox |
| playerId | hero-training |
| loadoutWeaponIds | pistol, shotgun, smg |
| selectedWeaponIndex | 0 |
| slimeFriendlyFire | false |
| aimAssistEnabled | false |
| aimAssistMaxAngleRadians | 0 |
| aimAssistMaxDistance | 0 |
| aimAssistStrength | 0 |
| winCondition | allEncountersComplete |
| lossCondition | playerDeath |

| backgroundId | image |
|---|---|
| training | ![Training](../../public/images/bg/bg-01.jpg) |

# Encounters

## training-wave-1

| field | value |
|---|---|
| type | wave |
| backgroundId | training |
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

## training-break

| field | value |
|---|---|
| type | break |
| backgroundId | training |
| spawnKind | empty |
| zoneKind | expandLinear |
| zoneFromMargin | 4 |
| zoneToMargin | 0 |
| zoneDurationMs | 2500 |
| transitionKind | timer |
| transitionDurationMs | 3000 |
| next | sequential |

## training-wave-2

| field | value |
|---|---|
| type | wave |
| backgroundId | training |
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
