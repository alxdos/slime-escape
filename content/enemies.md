# Enemies

## training-target

| field | value |
|---|---|
| displayName | Training Target |
| color | #ff7766 |

## slime-fast

| field | value |
|---|---|
| displayName | Fast Slime |
| color | #77ff99 |

## slime-tank

| field | value |
|---|---|
| displayName | Tank Slime |
| color | #4488dd |

# Balance

## Body

| id | radius | maxHp | behavior |
|---|---:|---:|---|
| training-target | 0.6 | 3 | stationary |
| slime-fast | 0.4 | 1 | chase |
| slime-tank | 0.7 | 5 | chase |

## Movement

| id | maxSpeed |
|---|---:|
| training-target | 0 |
| slime-fast | 4 |
| slime-tank | 1.8 |

## Contact damage

| id | contactDamage | contactCooldownMs |
|---|---:|---:|
| training-target | 0 | 1 |
| slime-fast | 1 | 800 |
| slime-tank | 2 | 1000 |

## Knockback

| id | baseImpulse | velocityScale | durationMs |
|---|---:|---:|---:|
| training-target | 0 | 0 | 1 |
| slime-fast | 8 | 1.5 | 350 |
| slime-tank | 3 | 0.5 | 200 |

## Drops

| id | dropArchetypeId | chance |
|---|---|---:|
| slime-fast | heal-orb | 0.25 |
| slime-tank | heal-orb | 0.6 |

## Sounds

| id | hit | death |
|---|---|---|
| training-target | | |
| slime-fast | slimes/hit-1, slimes/hit-2, slimes/hit-3, slimes/hit-4 | slimes/death-1, slimes/death-2, slimes/death-3, slimes/death-4 |
| slime-tank | slimes/hit-1, slimes/hit-2, slimes/hit-3, slimes/hit-4 | slimes/death-1, slimes/death-2, slimes/death-3, slimes/death-4 |

## Voice

| id | sampleIds | intervalMinMs | intervalMaxMs |
|---|---|---:|---:|
| slime-fast | slimes/voice-1, slimes/voice-2, slimes/voice-3, slimes/voice-4 | 3000 | 6000 |
| slime-tank | slimes/voice-1, slimes/voice-2, slimes/voice-3, slimes/voice-4 | 3500 | 7000 |

## Visual

| id | image |
|---|---|
| training-target | /assets/slime-05.png |
| slime-fast | /assets/slime-06.png |
| slime-tank | /assets/slime-04.png |
