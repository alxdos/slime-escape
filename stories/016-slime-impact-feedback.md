# Slime Impact Feedback

- Status: done
- Created: 2026-04-24
- Updated: 2026-04-24 (closed: PR #15 ready to merge. The architect pass introduced `design/impact-feedback.md` and the extensions of `snapshot-shape.md`, `health-and-death.md`, `projectiles-and-combat.md`, `enemy-contact.md`, `content-archetypes.md`, `sprite-assets.md`, `main-ui-shell.md`, `rng.md`, `runtime-systems.md`, `testing.md`. The code review confirmed that the new contracts for the `hit`/`death` payloads, `WeaponArchetype.knockbackImpulse`, projectile knockback in `CombatSystem`, `Renderer.handleEvent`, and the render-only droplets/stains/ghost are implemented without drift, without extending the snapshot, and without polluting `EntityStore`. Manual visual QA passed across the available weapons.)

## Player-facing

- Sees: when a projectile hits a slime, wet slime sprays out in the projectile's direction. A heavier weapon produces a wider and heavier splash. The hit slime briefly reacts with a flash/squash, and a destroyed slime leaves a quick fading ghost flying mostly upward, while a larger slime burst falls to the floor.
- Can do: read the weapon's force, the hit direction, and the kill confirmation through motion, wet trails, and body reaction — not only through HP and sound.

## Technical

- A new owner contract — [impact-feedback.md](../design/impact-feedback.md): authoritative projectile knockback lives in `sim`, while droplets/stains/ghosts/hit squash live only in `main/render`.
- The `hit`/`death` runtime events gain target archetype and impact direction, so the renderer can react without reconstructing already-removed entities from snapshots.
- `WeaponArchetype.knockbackImpulse` becomes a projectile force, separate from `damage`, applied to `enemy`/`boss` through the existing target knockback state.
- `UiShell` forwards runtime events into `Renderer.handleEvent(RuntimeEvent)` while remaining the sole owner of `SimWorkerHost.onEvent`.
- `EnemyArchetype.color` / `BossArchetype.color` are used as the material colour of render-only slime effects; base sprite rendering stays PNG-driven.

## Out of scope

- Gameplay puddles: slime stains do not slow, damage, block, heal, get picked up, or affect pathing.
- Player knockback from enemy/boss projectiles.
- Visual/audio reaction to contact damage.
- Authored particle atlases, sprite sheets, skeleton animation, or shader-only deformation.
- Persistent slime decals across sessions, saves, or returning to the menu.
- New weapons, new enemies, or a balance redesign, beyond adding force values to current weapon content.

## Acceptance

- Projectile hits on `enemy`/`boss` produce slime droplets offset along the projectile direction; hits on the player do not produce slime spray.
- Weapon force changes the feel of the splash: a higher `knockbackImpulse` produces a noticeably heavier/wider impact feedback than a low value.
- Hit slimes briefly flash and/or squash without changing simulation geometry, `SpriteVisualSpec`, `contactBox`, or the snapshot shape.
- Projectile hits apply simulation knockback to live `enemy`/`boss` in the projectile's direction, scaled by `WeaponArchetype.knockbackImpulse` and the target's susceptibility; HP is still mutated only by `HealthDeathSystem`.
- On a slime's death the renderer creates a transient ghost sprite from the dead slime's visual, moves it mostly upward with a smaller component along the impact direction, fades it out over roughly 1–2 seconds, and produces a slime burst larger than a regular hit.
- Slime droplets are irregular blob shapes, not crisp circles. After landing they grow slightly for about two seconds, remain as floor stains for a renderer-owned TTL, then fade out via opacity.
- Droplet/stain colour is taken from the colour of the target slime archetype.
- Slime droplets, floor stains, and death ghosts are render-only state: they do not appear in `Snapshot.entities`, do not enter `EntityStore`, and disappear on renderer dispose / leaving a run.
- Automated tests cover event payload shape, projectile knockback, renderer event handling/effect cleanup, and the mandatory weapon force content. Manual visual QA verifies the available weapons in a live run.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Pin the impact feedback architecture | Added `design/impact-feedback.md` and updates to the related design contracts before code work. |
| T2 | [x] | Extend the runtime event and damage intent payloads | Update `RuntimeEvent.hit`, `RuntimeEvent.death`, the projectile `DamageIntent.source`, and the tests for archetype/direction data. |
| T3 | [x] | Add weapon force to content | Add the mandatory `WeaponArchetype.knockbackImpulse`, update MD parsing/rendering/generated content, and set initial values on existing weapons. |
| T4 | [x] | Apply projectile knockback in simulation | Reuse the enemy/boss knockback state on projectile hits, account for the target's susceptibility/duration, and keep HP mutation inside `HealthDeathSystem`. |
| T5 | [x] | Forward runtime events into the renderer | Add `Renderer.handleEvent`, route events from `UiShell`, clean up renderer effects on dispose/session transitions. |
| T6 | [x] | Build a render-only impact effect store | Track transient hit impulses, droplets/stains, and death ghosts with bounded budgets, TTL, and per-frame updates. |
| T7 | [x] | Draw slime droplets and floor stains | Generate irregular blob geometry, spawn hit/death bursts from event data, briefly settle/grow stains, then fade/remove. |
| T8 | [x] | Add a live hit response | Apply a short flash and/or squash impulse to enemy/boss sprites without affecting breathing, position interpolation, or player rendering. |
| T9 | [x] | Add death ghost feedback | Spawn a transient sprite copy from the death event archetype/texture, move it upward plus along the impact direction, fade it out quickly, and work safely without a live mesh. |
| T10 | [x] | Verify and tune the overall feel | `npm run test` (399/399) and `npm run build` were run. Manual browser QA across the available weapons confirmed direction, force difference, colour, cleanup, and no leftovers after leaving a run. |

## Related

- [impact-feedback.md](../design/impact-feedback.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [projectiles-and-combat.md](../design/projectiles-and-combat.md)
- [health-and-death.md](../design/health-and-death.md)
- [enemy-contact.md](../design/enemy-contact.md)
- [content-archetypes.md](../design/content-archetypes.md)
- [sprite-assets.md](../design/sprite-assets.md)
- [main-ui-shell.md](../design/main-ui-shell.md)
- [rng.md](../design/rng.md)
- [testing.md](../design/testing.md)
