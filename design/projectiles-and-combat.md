# Projectiles and Combat

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-24 (cleanup pass: legacy single-primary projectile shape no longer reproduced as a typed example; only the migration rule remains in one sentence. 017 alignment: data shapes live in [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md); this file owns stable `CombatSystem` responsibilities, tick order, hit/damage pipeline and integration boundaries. 018 alignment: mines and field/status follow-ups are delegated to [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md).)

## Context

[runtime-systems.md](runtime-systems.md) fixes `CombatSystem` as the owner of combat simulation inside the worker. Earlier stories introduced the first narrow version of that system: one player weapon, linear bullets, impact-only damage, and owner-kind filtering.

Story 017 replaces that narrow model with universal weapons and projectiles:

- ordered weapon loadouts and owner-local weapon instances;
- weapon archetypes with fire patterns and embedded projectile specs;
- linear, arc and placed projectile motion;
- impact damage, grounded projectiles, timed explosions, fragments, pierce and knockback;
- permissive default damage with explicit session rules such as `slimeFriendlyFire`;
- weapon modifier drops that affect future projectile spawn parameters.

This file remains necessary because [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md) defines the data model and feature contract, while this file defines where that contract runs in the simulation and how it exchanges work with neighboring systems.

## Decision

### Current projectile contract

- The active projectile, weapon, loadout, fire-pattern, explosion, fragment, modifier and friendly-fire data contracts are defined in [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). This file does not redefine them.
- Migration of any pre-017 single-primary scalar weapon (e.g. `primaryWeaponArchetypeId` + flat `projectileSpeed`/`projectileRadius`/`damage`/`projectileTtlMs`) is a builder concern: the builder produces an ordered loadout and a composition-based `WeaponArchetype` per [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). The old shape is not a valid runtime contract after 017.

### CombatSystem ownership

- `CombatSystem` owns:
  - firing decisions for any active combat actor that has a selected/usable weapon instance;
  - cooldown checks and `nextFireSimMs` updates on owner-local `WeaponInstance` state;
  - fire-pattern expansion into one or more projectile spawn requests;
  - application of weapon modifiers at spawn time;
  - projectile movement for `linear`, `arc` and `placed`/grounded projectiles;
  - projectile hit detection, pierce bookkeeping and impact damage-intent creation;
  - transition from flying to grounded when a projectile has `groundOnImpact`;
  - timed detonation of grounded/explosive projectiles;
  - radial explosion damage-intent creation;
  - fragment projectile spawning;
  - projectile lifecycle removal.
- `MovementSystem` still does not move projectiles. Actor movement, chase behavior and player controls remain outside `CombatSystem`.
- `HealthDeathSystem` remains the only owner of HP decrement and death. `CombatSystem` never mutates `hp`; it emits damage intents.
- `DropSystem` owns pickup and drop-effect application. For weapon upgrade drops, `DropSystem` may call the narrow runtime API that mutates owner-local `WeaponInstance` modifiers; it must not spawn projectiles.
- `BossPhaseSystem` and future enemy behavior systems may request firing, choose weapon instances, or set aim/targeting state, but projectile creation still routes through `CombatSystem`.

### Projectile as runtime entity

- Projectile remains a runtime entity in `EntityStore` with `kind: 'projectile'`.
- Runtime projectile state is copied from content and current modifiers at spawn time, per [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). Tick logic must not depend on mutable content objects after spawn.
- `ownerId` and `ownerKind` are both copied. The projectile owner is excluded from damage by default; other filtering is controlled by session damage rules.
- `hitEntityIds` or equivalent deterministic bookkeeping is required for pierce so a projectile cannot hit the same entity repeatedly unless a future design explicitly adds multi-hit behavior.
- Grounded explosive projectiles remain projectile entities until they expire or detonate. They are not converted into drops or field effects.

### Firing and input integration

- Player firing still starts from `RuntimeInputState.firing` and current `aimWorld`.
- Weapon slot and holster input are defined in [input-commands.md](input-commands.md). `CombatSystem` reads the current selected weapon state; it does not parse keyboard slots directly.
- A valid firing decision requires:
  1. an actor with a selected usable weapon instance;
  2. `simTime >= weaponInstance.nextFireSimMs`;
  3. a valid aim direction for aimed patterns, or a pattern that does not require aim (`multiDirection`, `place`);
  4. a content-resolved `WeaponArchetype`.
- Fire-pattern expansion must be deterministic. Symmetric projectile count and spread calculations must use stable ordering so tests can assert exact projectile directions.
- Random spread is not part of the current contract. If it is added later, it must use session RNG and update [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md).

### Motion and hit tests

- `linear` projectiles integrate position by velocity.
- `arc` projectiles use deterministic interpolation from spawn point to landing point over configured flight time/range. The simulation collision point is the 2D ground/shadow position; visual height is render-only.
- `placed` projectiles start grounded at spawn and do not move.
- Hit detection against `player` / `enemy` / `boss` uses projectile `hitRadius` against target `contactBox` as fixed by [body-contact-boxes.md](body-contact-boxes.md).
- Broadphase may use `SpatialIndex` but `EntityStore` remains the source of truth.
- The no-tunneling content invariant still applies to each projectile motion profile. Builder/content validation must warn or fail when speed, radius and expected target box sizes cannot be checked safely without sweep tests. Sweep tests are still a separate future design.

### Damage rules

- Default rule: a projectile or explosion can damage any damageable entity except its owner.
- The active session's `rules.damage.slimeFriendlyFire` filters enemy-to-enemy damage as defined in [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md) and [session-definition.md](session-definition.md).
- Damage filtering must be centralized in one helper used by impact, explosion, proximity-trigger checks and future field effects. Per-feature ad hoc target filters are not allowed.
- Friendly-fire retaliation is not a damage rule. It is behavior/aggro state defined in [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md).

### Damage intents and events

- Impact and explosion damage both become `DamageIntent` entries for `HealthDeathSystem`.
- Projectile impact may also apply non-HP side effects already owned by combat, such as projectile knockback from [impact-feedback.md](impact-feedback.md). Those side effects must remain deterministic and must not read/mutate HP.
- `fire`, `hit`, explosion-related events and death metadata must follow [snapshot-shape.md](snapshot-shape.md). Presentation consumers must not reconstruct authoritative combat facts from nearby snapshots.
- If a projectile has `impactDamage === 0`, `CombatSystem` may still publish presentation events when useful, but must not emit zero-amount damage intents unless [health-and-death.md](health-and-death.md) explicitly allows them. Current damage intents require positive `amount`.

### Tick order inside CombatSystem

Within the global order from [runtime-systems.md](runtime-systems.md), `CombatSystem` executes these phases:

1. Firing decisions: read actor weapon state and spawn new projectiles.
2. Projectile motion: update flying/arc projectile positions and transition landed arc projectiles to grounded state.
3. Lifetime cleanup: mark expired harmless projectiles.
4. Contact damage intents: create enemy contact intents as defined by [enemy-contact.md](enemy-contact.md).
5. Projectile impact hit detection: create impact damage intents, apply pierce/ground/remove decisions.
6. Grounded projectile detonation: trigger timed explosions, create radial damage intents and spawn fragments.
7. Removal: remove projectiles that expired, were consumed by impact, or detonated.

The order is intentional: fragments spawned by an explosion do not hit in the same phase that created them unless a future design explicitly changes same-tick projectile processing.

### Extension boundary for story 018

- Mines are grounded projectiles with proximity/timer triggers; trigger checks stay in `CombatSystem`, but the trigger contract is in [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md).
- Explosion-spawned puddles/fields are `fieldEffect` entities. `CombatSystem` may spawn them, but lifetime and periodic application belong to `FieldEffectSystem`.
- Burn/slow/poison and similar actor statuses belong to `StatusEffectSystem`; `CombatSystem` only creates the application requests.
- Aim assist chooses or adjusts aim before a firing decision. Its ownership must be fixed by the implementing story, following [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md).

## Consequences

- The code migration for story 017 must replace the current primary-only weapon state and old projectile fields with the universal contracts. Keeping both models active after 017 is not allowed.
- `CombatSystem` becomes broader, but remains the single owner of projectile lifecycle and damage-intent production.
- The old owner-kind target table is no longer current. Tests must cover permissive non-owner damage plus `slimeFriendlyFire`.
- Presentation contracts must grow in [snapshot-shape.md](snapshot-shape.md) before renderer/HUD code depends on new projectile state.
- Future field/status mechanics from 018 have a clean boundary and do not need to re-open the basic weapon/projectile model.

## Related

- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)
- [runtime-systems.md](runtime-systems.md)
- [health-and-death.md](health-and-death.md)
- [enemy-contact.md](enemy-contact.md)
- [content-archetypes.md](content-archetypes.md)
- [snapshot-shape.md](snapshot-shape.md)
- [input-commands.md](input-commands.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [boss-encounter.md](boss-encounter.md)
- [simulation-timing.md](simulation-timing.md)
- [logging.md](logging.md)
- [impact-feedback.md](impact-feedback.md)
- [body-contact-boxes.md](body-contact-boxes.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
