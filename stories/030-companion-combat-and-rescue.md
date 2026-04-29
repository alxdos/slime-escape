# Companion Combat And Rescue

- Status: in-progress
- Created: 2026-04-29
- Updated: 2026-04-29

## Product intent

The selected pet should feel like a small living ally, not a cosmetic marker. It helps the player survive pressure, creates small emotional moments during a run, and stays fair by making combat power come from the current run rather than from permanent pet collection.

## Product rules

- A selected pet can help in combat only when the current run enables companion combat.
- Pet identity may change personality and presentation, but it must not give permanent combat stats.
- The current run decides the pet HP value and whether the pet has a weapon attack.
- If the current run gives the pet no weapon, the pet cannot shoot and only uses protective knockback.
- Pet movement must be soft, inertial, and readable. The pet must not snap to new directions, instantly reverse, or feel like a cursor attached to the player.
- Pet knockback is a protective `boop`, not a direct damage source.
- A ghost pet cannot use its weapon, but it can still protect the player with knockback.
- Pet death must not end the run and must not feel like an escort failure.

## Player-facing

- Sees: if no pet is selected, the run starts without a companion.
- Sees: if a pet is selected and companion combat is enabled, the pet enters the arena with its own small HP bar.
- Sees: between waves, the pet rests near the player, breathes softly, and sometimes looks around by flipping its sprite.
- Sees: during a wave, when no enemy is close enough, the pet patrols around the player in a smooth orbit.
- Sees: pet movement has visible inertia: it slows, turns in arcs, and catches up smoothly instead of changing direction sharply.
- Sees: when a nearby enemy becomes a threat, the pet gives a short warning gesture and turns toward it.
- Sees: when a pet has a weapon in the current run, it attacks its chosen threat with that weapon.
- Sees: when the current run gives the pet no weapon, the pet never fires but still guards the player.
- Sees: when the pet is hit by a slime or enemy projectile, it loses HP and splashes slime like a friendly slime creature.
- Sees: when the pet HP reaches zero, it becomes a ghost instead of disappearing.
- Sees: the ghost pet stays near the player, follows softly, and cannot use a weapon.
- Sees: living and ghost pets can push away nearby slimes with a short protective boop.
- Can do: stand close to the ghost pet for about one second to rescue it.
- Sees: while rescue is charging, the ghost pet rapidly flips and gathers itself back into a living pet.
- Sees: when rescue completes, the pet returns alive with partial HP.
- Sees: if the player leaves the rescue area too soon, rescue does not complete.
- Sees: different pets may express personality through presentation such as idle timing, look-around behavior, or ghost appearance, without changing combat strength.

## Technical

- Companion combat is worker-authoritative and session-owned by [companion-combat.md](../design/companion-combat.md).
- `SessionDefinition.companion` is the only simulation-visible bridge from selected pet progression to runtime companion behavior. If it is `null`, no runtime companion exists.
- `PetArchetype` remains collection/presentation identity only. Pet-specific HP, damage, cooldown, weapon, contact box, movement, boop, and rescue stats are forbidden.
- `content/sessions/<presetId>.md` may add an optional `# Companion` field table for session tuning. The selected pet id is never authored in MD; `UiShell` passes it to the session builder at run start.
- Runtime adds `kind: 'companion'` plus `CompanionSnapshot`, `CompanionSystem`, and companion events `companionBoop`, `companionDowned`, and `companionRescued`.
- `CompanionSystem` runs after `MovementSystem` and before `CombatSystem`. It owns mode selection, inertial movement, deterministic threat acquisition, boop, rescue, ghost follow, and companion aim intent.
- `CombatSystem` owns companion weapon firing through the existing owner-local weapon instance model with `ownerKind: 'companion'`.
- Damage rules add the friendly alliance `player + companion`: player projectiles cannot damage the companion, and companion projectiles cannot damage the player or companion.
- `HealthDeathSystem` applies companion damage, but HP reaching zero transitions the companion to `ghost` instead of publishing normal `death`, running death hooks, spawning drops, incrementing result kills, or removing the entity.
- `Renderer` draws the companion from `CompanionSnapshot.petArchetypeId` and `petVisuals`. Look-around flips, rescue flip rate, ghost shimmer, and personality are presentation-only.
- The in-world companion HP bar is presentation owned and reads from `CompanionSnapshot.hp/maxHp`.

## Out of scope

- Pet upgrades, pet levels, rarity-based stats, or permanent combat advantages.
- More than one companion in a run.
- Pet equipment, loadout editing, or choosing the pet weapon from the Pets screen.
- Pet-specific damage, fire rate, HP, cooldown, or rescue power differences.
- The pet healing the player or reviving the player.
- Direct player commands for pet targeting, position, rescue, or attack mode.
- Pet death causing loss, score penalty, or permanent injury.
- Persisting pet HP or ghost state between runs.
- Selling, fusing, trading, or rerolling pets.

## Acceptance

- Starting a run with no selected pet shows no companion.
- Starting a companion-enabled run with a selected pet shows the pet in the arena with a visible HP bar.
- During a break between waves, the pet stays calm near the player and occasionally flips as a look-around animation.
- During a wave with no close enemies, the pet orbits or patrols around the player smoothly.
- When the player suddenly changes direction, the pet follows with acceleration and curved motion rather than snapping or instantly reversing.
- When an enemy enters the pet threat range, the pet performs a visible warning gesture before engaging.
- In a run that gives the pet a weapon, the pet can attack a nearby threat with that weapon.
- In a run that does not give the pet a weapon, the pet never fires a weapon but can still boop nearby slimes away.
- Enemy contact or enemy projectile hits reduce pet HP and show friendly slime hit feedback.
- When pet HP reaches zero, the pet becomes a ghost, remains near the player, and stops weapon attacks.
- A ghost pet can still boop a nearby slime away from the player.
- Standing near a ghost pet for about one second completes a rescue, with rapid flip animation during the rescue.
- Leaving the rescue area before the rescue completes prevents the revive.
- After rescue completes, the pet returns alive with partial HP and can use its weapon again if the current run allows it.
- Demo scenario: select a pet, start a companion-enabled campaign, watch it rest during a break, patrol during a wave, warn on a close slime, attack when armed, get knocked into ghost form, rescue it by standing nearby, and confirm it returns alive without changing the player's own weapon or stats.

## Tasks

| # | Status | Task |
|---|--------|------|
| T1 | [x] | Record architecture decisions for session ownership, runtime system boundaries, snapshots/events, damage rules, ghost/downed handling, rendering, and MD authoring. |
| T2 | [ ] | Extend session types, content authoring, generated session data, and builder options so companion-enabled presets can produce `SessionDefinition.companion` from selected pet progression plus session tuning. |
| T3 | [ ] | Add companion runtime entity support, `CompanionSystem`, inertial movement modes, deterministic threat acquisition, ghost follow, rescue progress, and boop impulse behavior. |
| T4 | [ ] | Integrate companion weapon firing and combat rules: `ownerKind: 'companion'`, friendly alliance filtering, companion projectile events, weapon disable in ghost state, and weapon restore after rescue. |
| T5 | [ ] | Integrate companion HP/downed/rescue lifecycle in health/death, result summary, and cleanup rules without normal death hooks or entity removal. |
| T6 | [ ] | Add snapshot/event exports and renderer/UI presentation: companion sprite, HP bar, rest/guard/alert/engage/ghost/rescue visuals, look-around flips, warning, slime hit feedback, ghost aura, and rescue flip animation. |
| T7 | [ ] | Cover the feature with focused tests for builder validation, runtime mode transitions, smooth movement constraints, damage rules, downed/rescue behavior, boop without damage, snapshot/events, and renderer hard-error paths. |
| T8 | [ ] | Run content checks, typecheck/build/test, and a manual demo pass over the full select-pet -> run -> fight -> ghost -> rescue scenario. |

## Related

- [companion-combat.md](../design/companion-combat.md)
- [content-boundaries.md](../design/content-boundaries.md)
- [content-archetypes.md](../design/content-archetypes.md)
- [content-authoring.md](../design/content-authoring.md)
- [session-definition.md](../design/session-definition.md)
- [runtime-systems.md](../design/runtime-systems.md)
- [projectiles-and-combat.md](../design/projectiles-and-combat.md)
- [universal-weapons-and-projectiles.md](../design/universal-weapons-and-projectiles.md)
- [non-player-firing.md](../design/non-player-firing.md)
- [combat-modifiers-and-field-effects.md](../design/combat-modifiers-and-field-effects.md)
- [health-and-death.md](../design/health-and-death.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [enemy-contact.md](../design/enemy-contact.md)
- [body-contact-boxes.md](../design/body-contact-boxes.md)
- [impact-feedback.md](../design/impact-feedback.md)
- [sprite-assets.md](../design/sprite-assets.md)
- [main-ui-shell.md](../design/main-ui-shell.md)
- [session-result-summary.md](../design/session-result-summary.md)
