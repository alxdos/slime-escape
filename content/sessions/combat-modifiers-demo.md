# Session

| field | value |
|---|---|
| displayName | Combat Modifiers Demo |
| description | Проверочная арена для puddles, statuses, proximity mines, carrier drops, magnet pickup, retaliation and aim assist. |
| visibleInMenu | true |
| order | 1 |
| arenaId | sandbox |
| playerId | hero-sandbox |
| loadoutWeaponIds | demo-hazard-grenade, demo-proximity-mine, pistol |
| selectedWeaponIndex | 0 |
| slimeFriendlyFire | true |
| aimAssistEnabled | true |
| aimAssistMaxAngleRadians | 0.35 |
| aimAssistMaxDistance | 8 |
| aimAssistStrength | 0.65 |
| winCondition | none |
| lossCondition | none |

| backgroundId | image |
|---|---|
| sandbox | ![Sandbox](../../public/images/bg/bg-01.jpg) |

# Encounters

## combat-modifiers-demo-encounter

| field | value |
|---|---|
| type | sandbox |
| backgroundId | sandbox |
| spawnKind | static |
| zoneKind | disabled |
| transitionKind | never |
| next | sequential |

| seq | archetypeId | x | y |
|---:|---|---:|---:|
| 1 | demo-carrier-slime | 4 | 1.5 |
| 2 | demo-retaliator-slime | 5 | -1 |
| 3 | demo-retaliator-slime | 7 | -1 |
| 4 | slime-bug | 6 | 2.5 |
