# Drops

## heal-orb

![Heal orb](../public/assets/drops/heal-orb.png)

| field | value |
|---|---|
| displayName | Heal Orb |
| color | #ff7aa8 |

## size-up

![Size up](../public/assets/drops/size-up.png)

| field | value |
|---|---|
| displayName | Size Up |
| color | #ffcf5a |

## speed-up

![Speed up](../public/assets/drops/speed-up.png)

| field | value |
|---|---|
| displayName | Speed Up |
| color | #5ee6ff |

## multi-shot

![Multi shot](../public/assets/drops/multi-shot.png)

| field | value |
|---|---|
| displayName | Multi Shot |
| color | #b985ff |

## pierce

![Pierce](../public/assets/drops/pierce.png)

| field | value |
|---|---|
| displayName | Pierce |
| color | #e6f5ff |

## fragment

![Fragment](../public/assets/drops/fragment.png)

| field | value |
|---|---|
| displayName | Fragment |
| color | #ff8d5e |

## overdrive

![Overdrive](../public/assets/drops/overdrive.png)

| field | value |
|---|---|
| displayName | Overdrive |
| color | #77ff95 |

# Balance

## Body

| id | ttlMs |
|---|---:|
| heal-orb | 8000 |
| size-up | 10000 |
| speed-up | 10000 |
| multi-shot | 10000 |
| pierce | 10000 |
| fragment | 10000 |
| overdrive | 8000 |

## Effect

| id | kind | target | value | durationMs |
|---|---|---|---:|---:|
| heal-orb | heal | none | 1 | none |
| size-up | addWeaponModifier | selectedWeapon | none | none |
| speed-up | addWeaponModifier | selectedWeapon | none | none |
| multi-shot | addWeaponModifier | selectedWeapon | none | none |
| pierce | addWeaponModifier | selectedWeapon | none | none |
| fragment | addWeaponModifier | selectedWeapon | none | none |
| overdrive | temporaryOverdrive | selectedWeapon | 0.5 | 5000 |

## Weapon Modifier

| id | modifierKind | value | fragmentWeaponId | spreadRadians |
|---|---|---:|---|---:|
| size-up | projectileSizeMultiplier | 1.25 | none | 0 |
| speed-up | projectileSpeedMultiplier | 1.3 | none | 0 |
| multi-shot | symmetricProjectileMultiplier | 2 | none | 0 |
| pierce | pierceBonus | 1 | none | 0 |
| fragment | fragmentExplosion | 6 | pistol | 6.2831853072 |
