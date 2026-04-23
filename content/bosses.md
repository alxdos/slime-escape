# Bosses

## slime-king

| field | value |
|---|---|
| displayName | Slime King |
| color | #aa44ff |

# Balance

## Body

| id | radius | maxHp |
|---|---:|---:|
| slime-king | 1.1 | 40 |

## Movement

| id | maxSpeed |
|---|---:|
| slime-king | 3 |

## Contact damage

| id | contactDamage | contactCooldownMs |
|---|---:|---:|
| slime-king | 2 | 800 |

## Knockback

| id | baseImpulse | velocityScale | durationMs |
|---|---:|---:|---:|
| slime-king | 5 | 0.4 | 220 |

## Phases

| id | phaseId | allowedAttackIds | exitWhenHpFractionAtOrBelow |
|---|---|---|---:|
| slime-king | crown-intact | coneBurst, spawnAdds | 0.55 |
| slime-king | desperation | coneBurst, dashSlam | 0 |

## Attacks

| id | attackKey | pattern | cooldownMs | damage |
|---|---|---|---:|---:|
| slime-king | coneBurst | coneBurst | 1400 | 2 |
| slime-king | spawnAdds | spawnAdds | 3500 | 0 |
| slime-king | dashSlam | dashSlam | 1800 | 4 |

## Sounds

| id | fire | phaseChange |
|---|---|---|
| slime-king | boss/boss-fireball | boss/boss-ahaha |
