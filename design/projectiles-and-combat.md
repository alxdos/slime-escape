# Projectiles and Combat

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-05-01 (story 037 prep: shared damage-rule helper extends to read `SessionRules.damage.playerVsPlayerDamage` ([session-definition.md](session-definition.md)) and gate cross-team damage between two `(player, companion)` teams identified by `ownerPlayerId`; same-team friendly fire stays off regardless of the flag, the previously recorded "player and companion are friendly" rule is the special case `team(player) === team(companion)`. Multi-team semantics live in [companion-combat.md](companion-combat.md). The helper also drops every incoming `DamageIntent` whose `targetId` resolves to a player entity with `state in {'ghost', 'reviving'}` ([snapshot-shape.md](snapshot-shape.md), [health-and-death.md](health-and-death.md)) — ghost-state filter is the same primitive shape as `addPlayer.invulnerableUntilSimMs` already recorded by 036 ([sim-core-interface.md](sim-core-interface.md)), applied at the same intake point. The filter is centralised in the existing damage-helper; systems must not branch on `state` at the call site. Earlier: 2026-04-30 story 032 prep: added Related link for the public multiplayer arena. Earlier: 2026-04-29 story 030 prep: `CombatSystem` accepts companion shooter state, companion target shapes, and friendly player/companion damage filtering; companion AI/boop/rescue remain in [companion-combat.md](companion-combat.md). Earlier: 2026-04-24 cleanup pass: legacy single-primary projectile shape no longer reproduced as a typed example; only the migration rule remains in one sentence. 017 alignment: data shapes live in [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md); this file owns stable `CombatSystem` responsibilities, tick order, hit/damage pipeline and integration boundaries. 018 alignment: mines and field/status follow-ups are delegated to [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md).)

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
- `BossPhaseSystem`, `CompanionSystem`, and future enemy behavior systems may request firing, choose weapon instances, or set aim/targeting state, but projectile creation still routes through `CombatSystem`.

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
  3. a valid aim direction for aimed patterns (`single`, `multiDirection`), or a pattern that does not require aim (`place`);
  4. a content-resolved `WeaponArchetype`.
- Fire-pattern expansion must be deterministic. Symmetric projectile count and spread calculations must use stable ordering so tests can assert exact projectile directions.
- Random spread is not part of the current contract. If it is added later, it must use session RNG and update [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md).

### Motion and hit tests

- `linear` projectiles integrate position by velocity.
- `arc` projectiles use deterministic interpolation from spawn point to landing point over configured flight time/range. The simulation collision point is the 2D ground/shadow position; visual height is render-only.
- `placed` projectiles start grounded at spawn and do not move.
- Hit detection against `player` / `enemy` / `boss` / `companion` uses projectile `hitRadius` against target `contactBox` as fixed by [body-contact-boxes.md](body-contact-boxes.md).
- Broadphase may use `SpatialIndex` but `EntityStore` remains the source of truth.
- The no-tunneling content invariant still applies to each projectile motion profile. Builder/content validation must warn or fail when speed, radius and expected target box sizes cannot be checked safely without sweep tests. Sweep tests are still a separate future design.

### Damage rules

- Default rule: a projectile or explosion can damage any damageable entity except its owner.
- Story 030 added one friendly alliance: `player` and `companion` cannot damage each other with projectiles or explosions. Companion-owned projectiles can damage enemies and bosses; enemy/boss projectiles can damage the companion unless a future explicit rule narrows that.
- Story 037 generalises the player/companion alliance into a **team** model. A team is one player plus that player's companion (`PlayerConfig.companion` from [session-definition.md](session-definition.md), keyed by `ownerPlayerId`). Same-team friendly fire is always off. Cross-team damage is gated by `SessionRules.damage.playerVsPlayerDamage`: when `false` (online co-op default), every team is friendly to every other team — projectiles and explosions from any player or any companion cannot damage any other team's player or companion; when `true` (PvP arena and any future PvP content), every other team is hostile. The full team table lives in [companion-combat.md](companion-combat.md); the helper reads `playerVsPlayerDamage` once per `DamageIntent` resolution and does not branch elsewhere in `CombatSystem`.
- The active session's `rules.damage.slimeFriendlyFire` filters enemy-to-enemy damage as defined in [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md) and [session-definition.md](session-definition.md). `slimeFriendlyFire` and `playerVsPlayerDamage` are independent flags; both are read from `SessionRules.damage` at the same helper.
- Ghost-state filter (story 037): a `DamageIntent` whose `targetId` resolves to a player entity with `state in {'ghost', 'reviving'}` ([snapshot-shape.md](snapshot-shape.md)) is dropped at the helper before HP application, identical to the `addPlayer.invulnerableUntilSimMs` filter for spawn-protected actors ([sim-core-interface.md](sim-core-interface.md)). Companion entities in `state: 'ghost'` are likewise filtered out (this preserves the existing rule that ghosted companions cannot be killed twice). The filter is the same intake point used by other damage-rule reads.
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
- [companion-combat.md](companion-combat.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
- [../stories/030-companion-combat-and-rescue.md](../stories/030-companion-combat-and-rescue.md)
- [../stories/037-coop-vs-slimes.md](../stories/037-coop-vs-slimes.md)
- [online-session-hosting.md](online-session-hosting.md)
- [online-lobby.md](online-lobby.md)
- [session-definition.md](session-definition.md)
- [sim-core-interface.md](sim-core-interface.md)
