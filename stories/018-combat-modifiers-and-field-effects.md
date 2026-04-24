# Combat Modifiers And Field Effects

- Status: planned
- Created: 2026-04-24
- Updated: 2026-04-24

## Player-facing

- Sees: combat gains small tactical surprises: mines arm on the ground, explosions can leave dangerous puddles, enemies can burn or slow, special slimes visibly carry rewards, drops can pull toward the player, and friendly fire can briefly turn slimes against each other.
- Can do: use upgraded weapons to create temporary zones, kite enemies through hazards, notice status effects without reading numbers, hunt carrier slimes for guaranteed rewards, and benefit from subtle aim assist that makes near-misses feel less frustrating.

## Technical

- Build on [universal-weapons-and-projectiles.md](../design/universal-weapons-and-projectiles.md) with the follow-up contracts in [combat-modifiers-and-field-effects.md](../design/combat-modifiers-and-field-effects.md): `fieldEffect` entities, status effects, mine proximity triggers, drop magnet, carrier drop metadata, friendly-fire retaliation and aim-assist tuning.
- Add runtime ownership for new effects without moving HP decrement out of `HealthDeathSystem` or drop lifecycle out of `DropSystem`.
- Extend content authoring for opt-in field effects, status applications, mine triggers, carrier markers, pickup modifiers, retaliation policy and aim-assist session tuning.
- Keep ricochet deferred until explicit wall/geometry collision exists.

## Out of scope

- Ricochet, walls, destructible objects and arena-boundary collision.
- Complex faction systems, permanent ally/enemy relationships or social AI.
- Stacking-heavy RPG buff UI, inventories, crafting or status cleansing.
- Network play or replay tooling.
- Any mechanic that requires non-deterministic randomness in simulation.

## Acceptance

- A demo weapon or upgrade can create a temporary field/puddle after an explosion; actors inside it receive deterministic damage or status applications.
- At least two statuses are implemented from content, with readable visual hints and tests for ticking, expiry and stacking policy.
- A mine-like placed projectile can arm, trigger by proximity and still detonate by timer when configured.
- A carrier slime is visibly marked and drops its authored reward on death through `DropSystem`.
- A drop magnet modifier expands pickup comfort and visibly attracts nearby drops without changing drop ownership.
- With slime friendly fire enabled, a configured slime can briefly retaliate against another slime that hurt it.
- Aim assist can be enabled/tuned per session and corrects only within a small explicit cone with deterministic target choice.
- Existing sessions without these features still run with unchanged behavior.
- Tests cover field-effect lifecycle, status ticks, mine triggers, drop magnet, retaliation and aim-assist target selection.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [ ] | Add content and session contracts for field effects, status applications, mine triggers, carrier markers, drop magnet, retaliation policy and aim assist. | All features must be opt-in and validate cross-area references. |
| T2 | [ ] | Implement `FieldEffectSystem` and `StatusEffectSystem` with damage-intent output and snapshot presentation fields. | HP loss still flows through `HealthDeathSystem`. |
| T3 | [ ] | Extend `CombatSystem` for mine proximity triggers and explosion-spawned field effects. | Reuse universal projectile/explosion ownership and damage rules. |
| T4 | [ ] | Extend `DropSystem` and renderer for carrier drops and magnet attraction. | Carrier reward still uses death hooks; magnet remains deterministic. |
| T5 | [ ] | Add friendly-fire retaliation behavior and optional aim-assist targeting. | Keep owner boundaries explicit: behavior layer owns aggro, chosen aim-assist owner is documented before implementation. |
| T6 | [ ] | Add demo content, visual/audio feedback and regression tests for all enabled mechanics. | Existing no-effect sessions must be covered as non-regression. |

## Related

- [combat-modifiers-and-field-effects.md](../design/combat-modifiers-and-field-effects.md)
- [universal-weapons-and-projectiles.md](../design/universal-weapons-and-projectiles.md)
- [projectiles-and-combat.md](../design/projectiles-and-combat.md)
- [runtime-systems.md](../design/runtime-systems.md)
- [health-and-death.md](../design/health-and-death.md)
- [drops.md](../design/drops.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [input-commands.md](../design/input-commands.md)
- [rng.md](../design/rng.md)
- [testing.md](../design/testing.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
