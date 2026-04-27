# Universal Weapons And Projectiles

- Status: done
- Created: 2026-04-24
- Updated: 2026-04-24 (sprite extension: tasks T8–T11 added for the projectile/drop sprite pipeline per [sprite-assets.md](../design/sprite-assets.md); the full list of new weapon archetypes (rock-thrower, grenade-launcher, bomb-placer, fireball-staff) and projectile/drop sprites is fixed; inline image nodes are introduced in `content/weapons.md` and `content/drops.md`.)

## Player-facing

- Sees: the player has a visible ordered weapon set, can switch between weapon slots, holster the current weapon, and fight with bullets, thrown stones, grenades, bombs, and four-direction fireballs that read as distinct projectiles.
- Can do: start a session with the loadout authored by that session, switch weapons with number keys, throw arcing projectiles with landing feedback, see grounded explosives pulse with a radius hint, pick up weapon upgrades, and notice that upgraded projectile size, speed, count, pierce, overdrive, knockback, and fragments change the feel of combat.

## Technical

- Introduce the universal weapon/loadout/projectile contract from [universal-weapons-and-projectiles.md](../design/universal-weapons-and-projectiles.md): ordered loadouts, owner-local weapon instances, fire patterns, projectile motion kinds, impact damage, grounded state, timed explosions, and fragment spawning.
- Extend content authoring for weapons, drops, and sessions so `content/weapons.md`, `content/drops.md`, and `content/sessions/*.md` can define multi-weapon loadouts, projectile specs, weapon modifiers, and `rules.slimeFriendlyFire`.
- Extend the input/protocol for slot selection and holster, and extend snapshots/HUD/rendering for the selected weapon, projectile sprites, arc previews, the grounded pulse, and the explosion-radius indicators.
- Migrate `projectile` and `drop` from primitive rendering to PNG sprites per the extended scope of [sprite-assets.md](../design/sprite-assets.md): two new visual registries (`projectileVisuals`, `dropVisuals`), inline image nodes under each archetype H2 in `content/weapons.md` and `content/drops.md`, two new `<area>.generated.ts` outputs, an extended preload, and an asset-only renderer for five kinds.
- Keep HP changes in `HealthDeathSystem`, projectile lifecycle in `CombatSystem`, pickup ownership in `DropSystem`, and deterministic behaviour under the session `seed`.

### Spritelist for art/content production

The minimum PNG set without which acceptance cannot close. Each file is one static PNG, centred, per [sprite-assets.md](../design/sprite-assets.md) (`PX_PER_WU = 240`, `anchor = {0.5, 0.5}`). The pixel size is chosen so that `worldSize = sourceSizePx / PX_PER_WU` matches `projectile.size` (for a projectile) or `radius * 2` (for a drop) within the content-build validator's tolerance.

Projectile sprites (one per weapon archetype, path `public/assets/projectiles/<weapon-id>.png`):

| weapon id | purpose | motion |
|---|---|---|
| pistol         | existing, basic bullet | linear |
| shotgun        | existing, pellet        | linear (single sprite, count>1 at the fire-pattern level) |
| smg            | existing, small bullet  | linear |
| sniper         | existing, long bullet   | linear |
| laser          | existing, thin bolt     | linear |
| rock-thrower   | new, thrown stone       | arc, `groundOnImpact: true`, `explosion: null` |
| grenade-launcher | new, grenade          | arc, `groundOnImpact: true`, `explosion` via timer |
| bomb-placer    | new, bomb               | placed, `explosion` via timer |
| fireball-staff | new, 4-direction fire   | linear, `firePattern: multiDirection` × 4 |

Drop sprites (one per drop archetype, path `public/assets/drops/<drop-id>.png`):

| drop id        | DropEffect kind                       | purpose |
|---|---|---|
| heal-orb       | `heal`                                | existing |
| size-up        | `addWeaponModifier: projectileSizeMultiplier`     | new |
| speed-up       | `addWeaponModifier: projectileSpeedMultiplier`    | new |
| multi-shot     | `addWeaponModifier: symmetricProjectileMultiplier`| new |
| pierce         | `addWeaponModifier: pierceBonus`                  | new |
| fragment       | `addWeaponModifier: fragmentExplosion`            | new |
| overdrive      | `temporaryOverdrive`                              | new |

In this story HUD weapon icons reuse the same PNG as the projectile sprite (key — `weaponArchetypeId`). A separate icon channel is a future extension of [sprite-assets.md](../design/sprite-assets.md).

Drops from 018 (`pickupModifier`/`dropMagnet` and carrier markers) are out of scope for this story; their sprite list will land in T1 of story 018 under the same rules.

## Out of scope

- Walls, arena edge collision, and ricochet.
- Full physics gravity, bouncing, homing, terrain collision, or destructible objects.
- Enemy AI tactics for choosing between multiple weapons beyond using the same weapon-instance path.
- Status effects such as burn, slow, poison, panic, or faction retaliation.
- Permanent inventory UI, shops, crafting, ammo, reloads, or weapon durability.
- New final art polish beyond using prepared projectile sprites and clear placeholder indicators where sprites are missing.

## Acceptance

- A session can author at least three starting player weapons; the player can select them with number keys and holster the current weapon.
- The same weapon archetype can be granted to player, slime, and boss content without duplicating weapon data, and each owner has independent cooldown/modifier state.
- By default projectiles/explosions damage any damageable non-owner; `content/sessions` can turn slime-to-slime damage on or off via `slimeFriendlyFire`.
- Bullet, thrown rock, grenade, bomb, and four-direction fireball examples are available in content (as new weapon archetypes `rock-thrower`, `grenade-launcher`, `bomb-placer`, `fireball-staff`) and visible in a demo session with their own PNG sprites without primitive fallback.
- Drops (heal plus five weapon-modifier drops and temporary overdrive) render as PNG sprites by `dropArchetypeId`, without a `CircleGeometry` fallback and without `color` tinting.
- Rocks and grenades deal impact damage and ground at the impact point; grenades/bombs may explode later, while rocks may simply expire.
- Grounded grenades and bombs pulse and show a readable explosion-radius hint before detonation.
- Arc weapons show an approximate landing point or a trajectory preview before firing.
- Drops can increase projectile size, increase projectile speed, multiply projectile count symmetrically, add pierce, add explosion fragments, and temporarily reduce cooldown for the selected weapon.
- Knockback from impact and explosions is visible enough that heavy projectiles and blasts feel different from basic bullets.
- Content build/check and automated tests cover loadout validation, projectile motion, explosion damage, friendly-fire filtering, and modifier application.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Replace shared content types and generated content for weapons, loadouts, drops, and session rules. | Update `src/shared/content/**`, `scripts/content-build/{weapons,drops,sessions}/**`, `content/weapons.md`, `content/drops.md`, `content/sessions/*.md`; migrate the old primary weapons to ordered loadouts and add `rules.damage.slimeFriendlyFire`. |
| T2 | [x] | Extend `InputCommand`, input handling, and the runtime input/loadout state for `selectWeaponSlot` and `holsterWeapon`. | Update `src/shared/protocol.ts`, `src/main/input/**`, `src/sim/RuntimeInputState.ts`, and session-start initialisation from `SessionDefinition.loadout.selectedIndex`. |
| T3 | [x] | Replace the primary-only combat runtime with owner-local `WeaponInstance` state and universal projectile entities. | Update `EntityStore`, session startup, player/enemy/boss firing state, `CombatSystem` fire decisions, and deterministic fire-pattern expansion. |
| T4 | [x] | Implement the universal projectile lifecycle in `CombatSystem`: linear/arc/placed motion, impact, grounding, pierce, timed explosions, radial damage, fragments, and knockback. | All HP loss goes through `DamageIntent`; use shared damage-rule filtering for impact/explosion and route explosion deaths through `HealthDeathSystem`. |
| T5 | [x] | Extend snapshots, runtime events, the renderer, the HUD, and audio for selected weapons and projectile presentation. | Update `SnapshotExportSystem`, `src/shared/snapshot.ts`, `src/shared/events.ts`, `Renderer`, `Hud`, audio mappings; include spin, the grounded pulse, the radius indicator, the arc preview, and `explosion` events. |
| T6 | [x] | Implement weapon-upgrade drops for size, speed, symmetric count, pierce, fragment explosion, and temporary overdrive. | Update `DropSystem` pickup-effect handling through the weapon-state API; modifiers apply only to future shots from the selected weapon instance. |
| T7 | [x] | Add content validation, unit tests, and integration tests for the migration. | Cover loadout validation, projectile motion, grounding/explosion lifecycle, fragments, friendly-fire enabled/disabled, modifier application, snapshot/event shape, and demo-session behaviour. |
| T8 | [x] | Add inline image nodes for projectile sprites in `content/weapons.md` under each weapon-id H2 (including the new `rock-thrower`/`grenade-launcher`/`bomb-placer`/`fireball-staff`), and for drop sprites in `content/drops.md` under each drop-id H2 (including the new modifier drops and `overdrive`). Place PNG assets under `public/assets/projectiles/<weapon-id>.png` and `public/assets/drops/<drop-id>.png` per the "Spritelist for art/content production" list. | No MD `image` columns in either area: a load-bearing inline image is the only authoring channel for derive fields per `design/sprite-assets.md` and `design/content-authoring.md`. Each PNG's pixel size is chosen so `worldSize = sourceSizePx / 240` matches the corresponding gameplay size (see design). |
| T9 | [x] | Extend the `weapons` and `drops` area generators: add inline image-node reading (via the existing `scripts/content-build/util/inlineMedia.ts`), derive `sourceSizePx` through the same util as enemies/players/bosses, and render new output pairs `src/main/render/projectileVisuals.generated.ts` (key — `weaponArchetypeId`) and `src/main/render/dropVisuals.generated.ts` (key — `dropArchetypeId`) next to the existing `enemyVisuals.generated.ts`/`playerVisuals.generated.ts`/`bossVisuals.generated.ts`. | Atomicity and the `content:check` invariant are preserved: any inline-node invariant violation (missing, absolute URL, missing file, drift) — `atomic fail`. |
| T10 | [x] | Add the handwritten consumers `src/main/render/projectileVisuals.ts` and `src/main/render/dropVisuals.ts` with a `Readonly<Record<string, SpriteVisualSpec>>` registry, validators `validateProjectileVisuals(weaponsRegistry)`/`validateDropVisuals(dropsRegistry)`, and a content-build cross-check `worldSize ↔ projectile.size` / `worldSize ↔ drop.radius*2`. Extend preload to merge the five visual registries; switch the `Renderer` `projectile` and `drop` branches to `THREE.PlaneGeometry` + preloaded texture; remove the existing `CircleGeometry` for these kinds; `pulseWhenGrounded`/`spinRadiansPerSec`/`rotateWhileFlying`/`explosionRadiusIndicator` — render-only behaviours per `WeaponArchetype.projectile.visual`. | The hard-error policy and the no-fallback rule from `design/sprite-assets.md` extend to the five kinds. |
| T11 | [x] | Add tests for the extended sprite pipeline: `validateProjectileVisuals`/`validateDropVisuals` (happy + orphan visual + orphan archetype), `Renderer` creating PNG meshes for `projectile`/`drop` (no `CircleGeometry`), preload including projectile/drop textures, derive consistency (the same derive value from the PNG is written as `projectile.size` in `weapons.generated.ts` and as `worldSize` in `projectileVisuals.generated.ts`; `drop.radius` in `drops.generated.ts` equals `min(worldSize.width, worldSize.height) / 2` of the matching entry in `dropVisuals.generated.ts`). Regression test: changing `arena.width`/`arena.height` does not change the derive sizes for projectile/drop. | This is not a cross-check between two authoring sources — it is a check that the generator forks one derive value into two output files without drift. The tests are extensions of the existing test sets from 013, not a separate file. |

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
