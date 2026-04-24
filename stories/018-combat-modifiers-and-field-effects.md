# Combat Modifiers And Field Effects

- Status: in-progress
- Created: 2026-04-24
- Updated: 2026-04-24 (architecture cleanup: drop magnet binding via new `DropEffect.kind: 'pickupModifier'` made explicit; aim assist owner fixed to `main thread`; tasks updated.)

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
| T1 | [x] | Add content/session types and builders for opt-in field effects, status applications, mine triggers, carrier markers, drop magnet, retaliation policy and aim assist. | Touch `src/shared/content/**`, `scripts/content-build/**`, `content/{weapons,drops,enemies,sessions}/**`; extend `DropEffect` union with `kind: 'pickupModifier'` per `design/drops.md` as the single binding point for drop magnet; validate all cross-area references. |
| T2 | [x] | Add `fieldEffect` runtime entities, snapshots and `FieldEffectSystem`. | Update `EntityStore`, `runtime-systems` wiring, `SnapshotExportSystem`, snapshot types and tests; field effects produce damage intents/status applications, never direct HP changes. |
| T3 | [x] | Add actor status runtime state and `StatusEffectSystem`. | Update damageable actor types, movement speed resolution, status tick/expiry logic, `DamageIntent.source`, snapshot/status presentation hints and stacking tests. |
| T4 | [x] | Extend `CombatSystem` for mine proximity triggers and explosion-spawned field effects/status applications. | Reuse universal projectile/explosion ownership and shared damage rules; proximity checks use `SpatialIndex` and deterministic ordering. |
| T5 | [x] | Extend `DropSystem`, enemy content and renderer for carrier drops and magnet attraction. | Carrier rewards still use death hooks; magnet movement/pickup expansion remains deterministic and owned by `DropSystem`. |
| T6 | [x] | Add friendly-fire retaliation behavior and optional aim-assist targeting. | Add aggro memory/behavior consumption in sim; implement aim assist on `main thread` per `design/combat-modifiers-and-field-effects.md` (corrects `aim` before sending the existing `InputCommand`, sim sees only a regular `aim` value); use deterministic target tie-breakers. |
| T7 | [ ] | Add demo content, visual/audio feedback and regression tests for all enabled mechanics. | Cover no-effect sessions as non-regression plus field lifecycle, status ticks, mine triggers, drop magnet, retaliation and aim-assist target selection. |

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
