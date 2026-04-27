# Bosses

## boss-gargoyle

![Gargoyle Slime](../public/assets/boss-01.png)

| field | value |
|---|---|
| displayName | Gargoyle Slime |
| color | #7bef63 |

## boss-saw-cyclops

![Saw Cyclops](../public/assets/boss-02.png)

| field | value |
|---|---|
| displayName | Saw Cyclops |
| color | #b8e86c |

## boss-scrap-king

![Scrap King](../public/assets/boss-03.png)

| field | value |
|---|---|
| displayName | Scrap King |
| color | #e9d13d |

## boss-tower-sentinel

![Tower Sentinel](../public/assets/boss-04.png)

| field | value |
|---|---|
| displayName | Tower Sentinel |
| color | #bdb8b2 |

## boss-bubble-hog

![Bubble Hog](../public/assets/boss-05.png)

| field | value |
|---|---|
| displayName | Bubble Hog |
| color | #f06c9a |

# Balance

## Body

| id | radius | maxHp |
|---|---:|---:|
| boss-gargoyle | 1.15 | 90 |
| boss-saw-cyclops | 1.25 | 110 |
| boss-scrap-king | 1.35 | 105 |
| boss-tower-sentinel | 1.30 | 130 |
| boss-bubble-hog | 1.20 | 105 |

## Movement

| id | maxSpeed |
|---|---:|
| boss-gargoyle | 2.0 |
| boss-saw-cyclops | 1.6 |
| boss-scrap-king | 1.9 |
| boss-tower-sentinel | 1.2 |
| boss-bubble-hog | 1.7 |

## Contact damage

| id | contactDamage | contactCooldownMs |
|---|---:|---:|
| boss-gargoyle | 2 | 800 |
| boss-saw-cyclops | 3 | 900 |
| boss-scrap-king | 2 | 800 |
| boss-tower-sentinel | 3 | 1000 |
| boss-bubble-hog | 2 | 850 |

## Knockback

| id | baseImpulse | velocityScale | durationMs |
|---|---:|---:|---:|
| boss-gargoyle | 2.5 | 0.1 | 120 |
| boss-saw-cyclops | 2.5 | 0.1 | 120 |
| boss-scrap-king | 2.5 | 0.1 | 120 |
| boss-tower-sentinel | 2.5 | 0.1 | 120 |
| boss-bubble-hog | 2.5 | 0.1 | 120 |

## Phases

| id | phaseId | allowedAttackIds | exitWhenHpFractionAtOrBelow |
|---|---|---|---:|
| boss-gargoyle | crown-intact | coneBurst, spawnAdds | 0.55 |
| boss-gargoyle | desperation | coneBurst, dashSlam | 0 |
| boss-saw-cyclops | crown-intact | coneBurst, spawnAdds | 0.55 |
| boss-saw-cyclops | desperation | coneBurst, dashSlam | 0 |
| boss-scrap-king | crown-intact | coneBurst, spawnAdds | 0.55 |
| boss-scrap-king | desperation | coneBurst, dashSlam | 0 |
| boss-tower-sentinel | crown-intact | coneBurst, spawnAdds | 0.55 |
| boss-tower-sentinel | desperation | coneBurst, dashSlam | 0 |
| boss-bubble-hog | crown-intact | coneBurst, spawnAdds | 0.55 |
| boss-bubble-hog | desperation | coneBurst, dashSlam | 0 |

## Attacks

| id | attackKey | pattern | cooldownMs | damage |
|---|---|---|---:|---:|
| boss-gargoyle | coneBurst | coneBurst | 1400 | 2 |
| boss-gargoyle | spawnAdds | spawnAdds | 3500 | 0 |
| boss-gargoyle | dashSlam | dashSlam | 1800 | 4 |
| boss-saw-cyclops | coneBurst | coneBurst | 1400 | 2 |
| boss-saw-cyclops | spawnAdds | spawnAdds | 3500 | 0 |
| boss-saw-cyclops | dashSlam | dashSlam | 1800 | 4 |
| boss-scrap-king | coneBurst | coneBurst | 1400 | 2 |
| boss-scrap-king | spawnAdds | spawnAdds | 3500 | 0 |
| boss-scrap-king | dashSlam | dashSlam | 1800 | 4 |
| boss-tower-sentinel | coneBurst | coneBurst | 1400 | 2 |
| boss-tower-sentinel | spawnAdds | spawnAdds | 3500 | 0 |
| boss-tower-sentinel | dashSlam | dashSlam | 1800 | 4 |
| boss-bubble-hog | coneBurst | coneBurst | 1400 | 2 |
| boss-bubble-hog | spawnAdds | spawnAdds | 3500 | 0 |
| boss-bubble-hog | dashSlam | dashSlam | 1800 | 4 |

## Sounds

| id | fire | phaseChange |
|---|---|---|
| boss-gargoyle | boss/boss-fireball | boss/boss-ahaha |
| boss-saw-cyclops | boss/boss-fireball | boss/boss-ahaha |
| boss-scrap-king | boss/boss-fireball | boss/boss-ahaha |
| boss-tower-sentinel | boss/boss-fireball | boss/boss-ahaha |
| boss-bubble-hog | boss/boss-fireball | boss/boss-ahaha |
