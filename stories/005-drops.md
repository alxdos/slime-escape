# Drops

- Status: done
- Created: 2026-04-19
- Updated: 2026-04-19 (story closed: all Tasks completed, contracts honoured, tests — `npm test` 19 files / 177 cases — green; `Index` in `design/README.md` is up to date)

## Player-facing

- Sees: a noticeable chance of a drop appearing where an enemy died; the object lies on the arena and is highlighted.
- Can do: walk over the drop to pick it up and see the applied effect (for example, HP restored).

## Technical

- A new `Drop` runtime entity with `kind: 'drop'` in `EntityStore`; `DropSystem` owns its lifecycle — per [../design/drops.md](../design/drops.md), [../design/runtime-systems.md](../design/runtime-systems.md).
- `DropArchetype` and `DropEffect` (minimum — `{ kind: 'heal'; amount }`) live in the content library; `EnemyArchetype` gains a mandatory `dropTable` field — per [../design/content-archetypes.md](../design/content-archetypes.md), [../design/content-boundaries.md](../design/content-boundaries.md).
- Drop spawn happens inside the death hook from `HealthDeathSystem` (filter `entityKind === 'enemy'`, exactly one `nextFloat` via session RNG, weighted pick over `dropTable`); removal and effect application happen in the `DropSystem` tick phase — per [../design/drops.md](../design/drops.md), [../design/health-and-death.md](../design/health-and-death.md), [../design/rng.md](../design/rng.md).
- Heal is the only sanctioned positive-side mutation of HP; it bypasses `HealthDeathSystem` (which stays the owner of decrement and death) — per [../design/health-and-death.md](../design/health-and-death.md), [../design/drops.md](../design/drops.md).
- The snapshot extends with a new `DropSnapshot` union member (`kind: 'drop'`, `archetypeId`, `x`, `y`) and three runtime events — `dropSpawn`, `dropPickup`, `dropExpire` (owner — `DropSystem`) — per [../design/snapshot-shape.md](../design/snapshot-shape.md).
- Pickup is a circle-vs-circle overlap of the player and the drop using `player.radius + drop.radius` in the `DropSystem` phase (after `HealthDeathSystem.removeDead()`); ttl always wins over pickup on a same-tick collision; one drop produces exactly one end-of-life event — per [../design/drops.md](../design/drops.md).
- Content: one `DropArchetype` (`heal-orb`) and non-empty `dropTable`s on `slime-fast`/`slime-tank`; `training-target` keeps `dropTable: []`.

## Out of scope

- Additional drop effects (weapon swap, modifiers, armour) — future stories, extension of the `DropEffect` union.
- A magnet / auto-pickup at a distance greater than the sum of radii.
- Sharing drop tables between different `EnemyArchetype`s (a shared `DropTableId` reference).
- Multiple drops from a single kill (secondary chances, a guaranteed drop on top of the table).
- Cleaning up drops on `encounterEnd` — intentionally not done; a drop lives until its ttl.
- HUD rendering of effect/icon/timer on a drop — that belongs to `007-hud-and-menu.md`; for 005 it is enough that the snapshot carries the right fields and events reach main.

## Acceptance

- When an enemy dies, a drop spawns according to the probability table.
- The drop is visible on the arena and disappears on timeout if not picked up.
- Player contact with the drop picks it up and applies the effect exactly once.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Extend the public contracts in `src/shared/**`: `snapshot.ts` (`DropSnapshot` with `kind: 'drop'`, `archetypeId`, `x`, `y`; include in the `EntitySnapshot` union), `events.ts` (`dropSpawn`, `dropPickup`, `dropExpire` with fields per `design/snapshot-shape.md`). Shapes and `assertNever`-ready unions only; implementation lives in separate tasks. | basis: `design/snapshot-shape.md`, `design/drops.md` |
| T2 | [x] | Content: a new `src/shared/content/drops.ts` with the `DropEffect` and `DropArchetype` types and a `DROP_ARCHETYPES` registry. Minimum content — one `heal-orb` archetype with `effect: { kind: 'heal', amount: 1 }` and reasonable `radius`/`ttlMs`/`color`. Re-export through `src/shared/content/index.ts`. No `EnemyArchetype` changes in this task. | basis: `design/content-archetypes.md`, `design/drops.md`, `design/content-boundaries.md`, `design/web-stack.md` |
| T3 | [x] | Content: `EnemyArchetype` gets a mandatory field `dropTable: ReadonlyArray<DropTableEntry>`; the `DropTableEntry` type (`archetypeId`, `chance`) is exported from `enemies.ts`. Fill `dropTable` for the existing archetypes: `training-target` — `[]`, `slime-fast` — a noticeable chance of `heal-orb`, `slime-tank` — a higher chance of `heal-orb`. Add validation in `validateEnemyRegistry` (and/or `buildSession`): `chance ∈ [0, 1]`, `chance` sum over a table `<= 1`, all `archetypeId`s resolve in the `DropArchetype` registry; violations produce `log.warn` via the unified log module. | basis: `design/content-archetypes.md`, `design/drops.md`, `design/logging.md` |
| T4 | [x] | `EntityStore`: add `Drop` (the minimal shape from `design/drops.md`: `id`, `kind: 'drop'`, `archetypeId`, `radius`, `effect`, `color`, `expireAtSimMs`, `position`), `DropSpawnSpec`, methods `spawnDrop`/`drops()`/`dropById`/`dropCount`/`removeDrop`, and include drops in `clear()`. No gameplay logic; a pure container. | basis: `design/drops.md`, `design/health-and-death.md`, `design/projectiles-and-combat.md` |
| T5 | [x] | `DropSystem` as a new module `src/sim/DropSystem.ts` per `design/drops.md`. Constructor takes `EntityStore`, `Rng`, and a `Record<string, DropArchetype>` map. Register a `DeathHook` via `HealthDeathSystem.registerHook` at simulation/session start: filter by `entityKind === 'enemy'`, resolve `EnemyArchetype` by `archetypeId`; with an empty `dropTable` skip the RNG call, otherwise one `rng.nextFloat()` and a weighted pick; on a pick — `EntityStore.spawnDrop` at `ctx.position` with `expireAtSimMs = ctx.simTime + dropArchetype.ttlMs` and publish `dropSpawn`. `tick(simTimeMs, store, emit)`: ttl expiry → `dropExpire` + remove; pickup detection (overlap player vs drop) → apply `DropEffect.kind: 'heal'` to `player.hp` clamped by `maxHp`, publish `dropPickup` + remove. Tolerant to `player === null`. `assertNever` on an unknown `DropEffect.kind`. State resets on `sessionStart`/`sessionStop`. | basis: `design/drops.md`, `design/runtime-systems.md`, `design/rng.md`, `design/health-and-death.md`, `design/snapshot-shape.md` |
| T6 | [x] | `SessionFlowSystem` / worker entry: create `DropSystem` at `startSession` next to `SpawnSystem`, hand it the session `Rng` and the `DROP_ARCHETYPES` map via DI; register its hook at the same hook-registration point used today (once at simulation/session start). Wire `DropSystem.tick` into the update order between `HealthDeathSystem.removeDead()` and `ZoneSystem.tick` per `design/runtime-systems.md`. On `stopSession`/`win`/`loss` runtime state resets, including drops (through the existing `EntityStore.clear()` path), without extra special rules. | basis: `design/runtime-systems.md`, `design/drops.md`, `design/rng.md`, `design/health-and-death.md` |
| T7 | [x] | `SnapshotExportSystem`: export drops into `entities` as `DropSnapshot` (`id`, `kind: 'drop'`, `archetypeId`, `x`, `y`). Source — `EntityStore.drops()`. Pure aggregation, no gameplay logic; no `expireAtSimMs`/`radius`/`effect` fields in the snapshot. | basis: `design/snapshot-shape.md`, `design/drops.md` |
| T8 | [x] | `Renderer` (main): render `kind: 'drop'` as a noticeable object (colour/radius from `DropArchetype`, soft glow/pulse — a renderer detail, not part of the contract); subscribe `worker → main` to the new `dropSpawn`/`dropPickup`/`dropExpire` events at least as records in the debug HUD/log (no audio — that is `008`). `player.hp` in the existing debug HUD updates automatically after a heal (taken from the snapshot). No new fields in the content library for drop rendering. | basis: `design/drops.md`, `design/snapshot-shape.md`, `design/thread-model.md`, `design/arena-and-coordinates.md` |
| T9 | [x] | Tests for the contract per `design/testing.md`: (a) the drop roll calls exactly one `nextFloat` per death with a non-empty `dropTable`, zero calls for `[]`; (b) the same `seed` + the same death sequence yields identical `(archetypeId, position)` drops; (c) `DropSystem` spawns the drop at exactly `DeathContext.position`; (d) `dropExpire` is published and the drop is removed when `simTime >= expireAtSimMs`; (e) `player ↔ drop` overlap by `player.radius + drop.radius` triggers `dropPickup`, applies the heal effect (`hp = min(maxHp, hp + amount)`), and removes the drop within one tick; (f) on a same-tick collision between ttl and pickup, ttl wins (`dropExpire`, not `dropPickup`); (g) tolerance to `player === null`: pickup phase is a no-op, drops keep expiring by ttl; (h) heal does not produce a `death` event and does not trigger a death hook (a repeat application does not cause recursion). | basis: `design/testing.md`, `design/drops.md`, `design/rng.md`, `design/health-and-death.md`, `design/snapshot-shape.md` |
| T10 | [x] | An integration test for the training session (or a new sandbox-with-drops): with a fixed `seed` and scenario — killing several enemies while the player walks over the drops — verify that (a) the `dropSpawn`/`dropPickup`/`dropExpire` sequence is deterministic, (b) `player.hp` in the final snapshot reflects the cumulative heal clamped by `maxHp`, (c) the number of drops on the arena at any tick is `>= 0` and does not leak after `stopSession`. | basis: `design/testing.md`, `design/drops.md`, `design/runtime-systems.md`, `design/rng.md` |
| T11 | [x] | Closing the story: closing checklist (see `stories/README.md`); verify that `Index` in `design/README.md` is still up to date; move the story `Status` to `done` and update the table in `stories/README.md`. | architect |

## Related

- [../design/drops.md](../design/drops.md)
- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../design/health-and-death.md](../design/health-and-death.md)
- [../design/snapshot-shape.md](../design/snapshot-shape.md)
- [../design/content-archetypes.md](../design/content-archetypes.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/rng.md](../design/rng.md)
- [../design/projectiles-and-combat.md](../design/projectiles-and-combat.md)
- [../design/session-definition.md](../design/session-definition.md)
- [../design/spawn-plan.md](../design/spawn-plan.md)
- [../design/zone.md](../design/zone.md)
- [../design/arena-and-coordinates.md](../design/arena-and-coordinates.md)
- [../design/simulation-timing.md](../design/simulation-timing.md)
- [../design/thread-model.md](../design/thread-model.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/logging.md](../design/logging.md)
- [../design/testing.md](../design/testing.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
