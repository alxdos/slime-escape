# Companion Combat And Rescue

- Status: planned
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
