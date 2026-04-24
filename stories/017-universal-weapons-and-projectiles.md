# Universal Weapons And Projectiles

- Status: in-progress
- Created: 2026-04-24
- Updated: 2026-04-24 (sprite extension: добавлены задачи T8–T11 на projectile/drop sprite pipeline по [sprite-assets.md](../design/sprite-assets.md); зафиксирован полный перечень новых weapon archetypes (rock-thrower, grenade-launcher, bomb-placer, fireball-staff) и projectile/drop спрайтов; inline image-узлы вводятся в `content/weapons.md` и `content/drops.md`.)

## Player-facing

- Sees: the player has a visible ordered weapon set, can switch between weapon slots, holster the current weapon, and fight with bullets, thrown stones, grenades, bombs and four-direction fireballs that read as distinct projectiles.
- Can do: start a session with the loadout authored by that session, switch weapons with number keys, throw arcing projectiles with landing feedback, see grounded explosives pulse with a radius hint, pick up weapon upgrades, and notice that upgraded projectile size, speed, count, pierce, overdrive, knockback and fragments change the feel of combat.

## Technical

- Introduce the universal weapon/loadout/projectile contract from [universal-weapons-and-projectiles.md](../design/universal-weapons-and-projectiles.md): ordered loadouts, owner-local weapon instances, fire patterns, projectile motion kinds, impact damage, grounded state, timed explosions and fragment spawning.
- Extend content authoring for weapons, drops and sessions so `content/weapons.md`, `content/drops.md` and `content/sessions/*.md` can define multi-weapon loadouts, projectile specs, weapon modifiers and `rules.slimeFriendlyFire`.
- Extend input/protocol for slot selection and holster, and extend snapshots/HUD/rendering for selected weapon, projectile sprites, arc previews, grounded pulse and explosion radius indicators.
- Migrate `projectile` and `drop` from primitive rendering to PNG sprites per the extended scope of [sprite-assets.md](../design/sprite-assets.md): two new visual registries (`projectileVisuals`, `dropVisuals`), inline image-узлы под каждый H2 архетипа в `content/weapons.md` и `content/drops.md`, two new `<area>.generated.ts` outputs, расширенный preload и asset-only renderer для пяти kinds.
- Keep HP changes in `HealthDeathSystem`, projectile lifecycle in `CombatSystem`, pickup ownership in `DropSystem`, and deterministic behavior under session `seed`.

### Spritelist for art/content production

Минимальный набор PNG, без которого acceptance не закрывается. Каждый файл — один статический PNG, центрированный, согласно [sprite-assets.md](../design/sprite-assets.md) (`PX_PER_WU = 240`, `anchor = {0.5, 0.5}`). Размер в пикселях выбирается так, чтобы `worldSize = sourceSizePx / PX_PER_WU` совпал с `projectile.size` (для projectile) или `radius * 2` (для drop) в пределах допуска валидатора content-build.

Projectile sprites (один на каждый weapon archetype, путь `public/assets/projectiles/<weapon-id>.png`):

| weapon id | назначение | motion |
|---|---|---|
| pistol         | существующий, базовая пуля | linear |
| shotgun        | существующий, дробь        | linear (single sprite, count>1 на уровне fire pattern) |
| smg            | существующий, мелкая пуля  | linear |
| sniper         | существующий, длинная пуля | linear |
| laser          | существующий, тонкий болт  | linear |
| rock-thrower   | новый, бросок камня        | arc, `groundOnImpact: true`, `explosion: null` |
| grenade-launcher | новый, граната           | arc, `groundOnImpact: true`, `explosion` через timer |
| bomb-placer    | новый, бомба               | placed, `explosion` через timer |
| fireball-staff | новый, 4-direction fire    | linear, `firePattern: multiDirection` × 4 |

Drop sprites (один на каждый drop archetype, путь `public/assets/drops/<drop-id>.png`):

| drop id        | DropEffect kind                       | назначение |
|---|---|---|
| heal-orb       | `heal`                                | существующий |
| size-up        | `addWeaponModifier: projectileSizeMultiplier`     | новый |
| speed-up       | `addWeaponModifier: projectileSpeedMultiplier`    | новый |
| multi-shot     | `addWeaponModifier: symmetricProjectileMultiplier`| новый |
| pierce         | `addWeaponModifier: pierceBonus`                  | новый |
| fragment       | `addWeaponModifier: fragmentExplosion`            | новый |
| overdrive      | `temporaryOverdrive`                              | новый |

HUD weapon icons на этом горизонте используют тот же PNG, что и projectile sprite (key — `weaponArchetypeId`). Отдельный icon-channel — будущее расширение [sprite-assets.md](../design/sprite-assets.md).

Drops по 018 (`pickupModifier`/`dropMagnet` и carrier markers) — out of scope этой истории; их sprite-список ляжет в задачу T1 истории 018 по тем же правилам.

## Out of scope

- Walls, arena edge collision and ricochet.
- Full physics gravity, bouncing, homing, terrain collision or destructible objects.
- Enemy AI tactics for choosing between multiple weapons beyond using the same weapon instance path.
- Status effects such as burn, slow, poison, panic or faction retaliation.
- Permanent inventory UI, shops, crafting, ammo, reloads or weapon durability.
- New final art polish beyond using prepared projectile sprites and clear placeholder indicators where sprites are missing.

## Acceptance

- A session can author at least three starting player weapons and the player can select them with number keys and holster the current weapon.
- The same weapon archetype can be granted to player, slime and boss content without duplicating weapon data, and each owner has independent cooldown/modifier state.
- By default projectiles/explosions damage any damageable non-owner; `content/sessions` can turn slime-to-slime damage on or off with `slimeFriendlyFire`.
- Bullet, thrown rock, grenade, bomb and four-direction fireball examples are available in content (как новые weapon archetypes `rock-thrower`, `grenade-launcher`, `bomb-placer`, `fireball-staff`) и visible in a demo session со своими PNG-спрайтами без primitive fallback.
- Drops (heal плюс пять weapon-modifier drop-ов и temporary overdrive) рендерятся как PNG-спрайты по `dropArchetypeId`, без `CircleGeometry` fallback и без tint по `color`.
- Rocks and grenades deal impact damage and ground at the impact point; grenades/bombs can later explode, while rocks can simply expire.
- Grounded grenades and bombs pulse and show a readable explosion radius hint before detonation.
- Arc weapons show an approximate landing point or trajectory preview before firing.
- Drops can increase projectile size, increase projectile speed, multiply projectile count symmetrically, add pierce, add explosion fragments, and temporarily reduce cooldown for the selected weapon.
- Knockback from impact and explosions is visible enough to make heavy projectiles and blasts feel different from basic bullets.
- Content build/check and automated tests cover loadout validation, projectile motion, explosion damage, friendly-fire filtering and modifier application.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Replace shared content types and generated content for weapons, loadouts, drops and session rules. | Update `src/shared/content/**`, `scripts/content-build/{weapons,drops,sessions}/**`, `content/weapons.md`, `content/drops.md`, `content/sessions/*.md`; migrate old primary weapons to ordered loadouts and add `rules.damage.slimeFriendlyFire`. |
| T2 | [x] | Extend `InputCommand`, input handling and runtime input/loadout state for `selectWeaponSlot` and `holsterWeapon`. | Update `src/shared/protocol.ts`, `src/main/input/**`, `src/sim/RuntimeInputState.ts` and session-start initialization from `SessionDefinition.loadout.selectedIndex`. |
| T3 | [x] | Replace primary-only combat runtime with owner-local `WeaponInstance` state and universal projectile entities. | Update `EntityStore`, session startup, player/enemy/boss firing state, `CombatSystem` fire decisions and deterministic fire-pattern expansion. |
| T4 | [ ] | Implement universal projectile lifecycle in `CombatSystem`: linear/arc/placed motion, impact, grounding, pierce, timed explosions, radial damage, fragments and knockback. | All HP loss goes through `DamageIntent`; use shared damage-rule filtering for impact/explosion and route explosion deaths through `HealthDeathSystem`. |
| T5 | [ ] | Extend snapshots, runtime events, renderer, HUD and audio for selected weapons and projectile presentation. | Update `SnapshotExportSystem`, `src/shared/snapshot.ts`, `src/shared/events.ts`, `Renderer`, `Hud`, audio mappings; include spin, grounded pulse, radius indicator, arc preview and `explosion` events. |
| T6 | [ ] | Implement weapon-upgrade drops for size, speed, symmetric count, pierce, fragment explosion and temporary overdrive. | Update `DropSystem` pickup effect handling through the weapon-state API; modifiers apply only to future shots from the selected weapon instance. |
| T7 | [ ] | Add content validation, unit tests and integration tests for the migration. | Cover loadout validation, projectile motion, grounding/explosion lifecycle, fragments, friendly-fire enabled/disabled, modifier application, snapshot/event shape and demo-session behavior. |
| T8 | [ ] | Add inline image-узлы для projectile sprites в `content/weapons.md` под каждый H2 weapon-id (включая новые `rock-thrower`/`grenade-launcher`/`bomb-placer`/`fireball-staff`), и для drop sprites в `content/drops.md` под каждый H2 drop-id (включая новые modifier-дропы и `overdrive`). Положить PNG-ассеты под `public/assets/projectiles/<weapon-id>.png` и `public/assets/drops/<drop-id>.png` по списку из «Spritelist for art/content production». | Никаких MD-колонок `image` ни в одной из двух областей: load-bearing inline image — единственный авторский канал для derive-полей по `design/sprite-assets.md` и `design/content-authoring.md`. Размер каждого PNG выбирается так, чтобы `worldSize = sourceSizePx / 240` совпал с соответствующим gameplay-размером (см. design). |
| T9 | [ ] | Расширить генератор областей `weapons` и `drops`: добавить чтение inline image-узла (через существующий `scripts/content-build/util/inlineMedia.ts`), derive `sourceSizePx` через тот же util, что и enemies/players/bosses, и render новых выходных пар `src/main/render/projectileVisuals.generated.ts` (ключ — `weaponArchetypeId`) и `src/main/render/dropVisuals.generated.ts` (ключ — `dropArchetypeId`) рядом с существующими `enemyVisuals.generated.ts`/`playerVisuals.generated.ts`/`bossVisuals.generated.ts`. | Атомарность и `content:check`-инвариант сохраняются: ошибка любого инварианта inline-узла (отсутствие, абсолютный URL, несуществующий файл, drift) — `atomic fail`. |
| T10 | [ ] | Добавить рукописные потребители `src/main/render/projectileVisuals.ts` и `src/main/render/dropVisuals.ts` с реестром `Readonly<Record<string, SpriteVisualSpec>>`, валидаторами `validateProjectileVisuals(weaponsRegistry)`/`validateDropVisuals(dropsRegistry)` и content-build cross-check `worldSize ↔ projectile.size` / `worldSize ↔ drop.radius*2`. Расширить preload до объединения пяти visual registries; `Renderer` ветки `projectile` и `drop` переключить на `THREE.PlaneGeometry` + preloaded texture; убрать существующий `CircleGeometry` для этих kinds; `pulseWhenGrounded`/`spinRadiansPerSec`/`rotateWhileFlying`/`explosionRadiusIndicator` — render-only поведения по `WeaponArchetype.projectile.visual`. | Hard-error policy и no-fallback правило из `design/sprite-assets.md` распространяется на пять kinds. |
| T11 | [ ] | Добавить тесты под расширенный sprite-pipeline: `validateProjectileVisuals`/`validateDropVisuals` (happy + orphan visual + orphan archetype), `Renderer` создание PNG-mesh для `projectile`/`drop` (нет `CircleGeometry`), preload включает projectile/drop текстуры, derive-консистентность (одно и то же derive-значение из PNG записано как `projectile.size` в `weapons.generated.ts` и как `worldSize` в `projectileVisuals.generated.ts`; `drop.radius` в `drops.generated.ts` равно `min(worldSize.width, worldSize.height) / 2` соответствующей записи в `dropVisuals.generated.ts`). Регрессионный тест: при изменении `arena.width`/`arena.height` derive-размеры projectile/drop остаются прежними. | Это не cross-check двух авторских источников — это проверка, что генератор разнёс одно derive-значение в два выходных файла без расхождения. Тесты — расширение существующих тестовых наборов 013, не отдельный файл. |

## Related

- [universal-weapons-and-projectiles.md](../design/universal-weapons-and-projectiles.md)
- [projectiles-and-combat.md](../design/projectiles-and-combat.md)
- [content-archetypes.md](../design/content-archetypes.md)
- [session-definition.md](../design/session-definition.md)
- [input-commands.md](../design/input-commands.md)
- [runtime-systems.md](../design/runtime-systems.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [drops.md](../design/drops.md)
- [impact-feedback.md](../design/impact-feedback.md)
- [sprite-assets.md](../design/sprite-assets.md)
- [content-authoring.md](../design/content-authoring.md)
- [main-ui-shell.md](../design/main-ui-shell.md)
- [testing.md](../design/testing.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
