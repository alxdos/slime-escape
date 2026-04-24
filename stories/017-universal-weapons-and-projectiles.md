# Universal Weapons And Projectiles

- Status: planned
- Created: 2026-04-24
- Updated: 2026-04-24

## Player-facing

- Sees: the player has a visible ordered weapon set, can switch between weapon slots, holster the current weapon, and fight with bullets, thrown stones, grenades, bombs and four-direction fireballs that read as distinct projectiles.
- Can do: start a session with the loadout authored by that session, switch weapons with number keys, throw arcing projectiles with landing feedback, see grounded explosives pulse with a radius hint, pick up weapon upgrades, and notice that upgraded projectile size, speed, count, pierce, overdrive, knockback and fragments change the feel of combat.

## Technical

- Introduce the universal weapon/loadout/projectile contract from [universal-weapons-and-projectiles.md](../design/universal-weapons-and-projectiles.md): ordered loadouts, owner-local weapon instances, fire patterns, projectile motion kinds, impact damage, grounded state, timed explosions and fragment spawning.
- Extend content authoring for weapons, drops and sessions so `content/weapons.md`, `content/drops.md` and `content/sessions/*.md` can define multi-weapon loadouts, projectile specs, weapon modifiers and `rules.slimeFriendlyFire`.
- Extend input/protocol for slot selection and holster, and extend snapshots/HUD/rendering for selected weapon, projectile sprites, arc previews, grounded pulse and explosion radius indicators.
- Keep HP changes in `HealthDeathSystem`, projectile lifecycle in `CombatSystem`, pickup ownership in `DropSystem`, and deterministic behavior under session `seed`.

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
- Bullet, thrown rock, grenade, bomb and four-direction fireball examples are available in content and visible in a demo session.
- Rocks and grenades deal impact damage and ground at the impact point; grenades/bombs can later explode, while rocks can simply expire.
- Grounded grenades and bombs pulse and show a readable explosion radius hint before detonation.
- Arc weapons show an approximate landing point or trajectory preview before firing.
- Drops can increase projectile size, increase projectile speed, multiply projectile count symmetrically, add pierce, add explosion fragments, and temporarily reduce cooldown for the selected weapon.
- Knockback from impact and explosions is visible enough to make heavy projectiles and blasts feel different from basic bullets.
- Content build/check and automated tests cover loadout validation, projectile motion, explosion damage, friendly-fire filtering and modifier application.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [ ] | Migrate weapon/session/drop content contracts and builders to ordered loadouts, projectile specs, weapon modifiers and `slimeFriendlyFire`. | Keep old single-primary content expressible as one selected weapon during migration. |
| T2 | [ ] | Extend input, runtime weapon instances and `CombatSystem` for slot switching, holster, fire patterns, linear/arc/placed projectile state, impact, grounding, explosions, fragments, pierce and knockback. | Preserve deterministic ordering and route all HP loss through damage intents. |
| T3 | [ ] | Extend snapshot/render/HUD/audio presentation for selected weapon, projectile sprites, spin, grounded pulse, radius indicator, arc preview and distinct fire/hit/explosion events. | Presentation hints must not become authoritative gameplay state. |
| T4 | [ ] | Implement weapon-upgrade drops for size, speed, symmetric count, pierce, fragment explosion and temporary overdrive. | Modifiers apply only to future shots from the target weapon instance. |
| T5 | [ ] | Add regression and integration tests for universal ownership, friendly-fire rules, projectile lifecycles, modifiers, content validation and demo-session behavior. | Include at least one slime-to-slime enabled and disabled case. |

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
- [testing.md](../design/testing.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
