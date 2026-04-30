# Session

| field | value |
|---|---|
| displayName | Combat Sandbox |
| description | A free-play arena with weapons and one static test enemy. |
| musicSampleId | none |
| visibleInMenu | false |
| order | 0 |
| arenaWidth | 32 |
| arenaHeight | 18 |
| playerId | hero-sandbox |
| loadoutWeaponIds | pistol, rock-thrower, grenade-launcher, bomb-placer, fireball-staff |
| selectedWeaponIndex | 0 |
| slimeFriendlyFire | false |
| aimAssistEnabled | false |
| aimAssistMaxAngleRadians | 0 |
| aimAssistMaxDistance | 0 |
| aimAssistStrength | 0 |
| winCondition | none |
| lossCondition | none |

| backgroundId | image |
|---|---|
| sandbox | ![Sandbox](../../public/images/bg/bg-01.jpg) |

# Encounters

## sandbox-with-combat-encounter

| field | value |
|---|---|
| type | sandbox |
| backgroundId | sandbox |
| introDurationMs | none |
| name | none |
| text | none |
| spawnKind | static |
| zoneKind | disabled |
| transitionKind | never |
| next | sequential |

| seq | archetypeId | x | y |
|---:|---|---:|---:|
| 1 | slime-bug | 5 | 0 |
