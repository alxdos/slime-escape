# Combat Foundation

- Status: done
- Created: 2026-04-19
- Updated: 2026-04-19

## Player-facing

- Sees: a training dummy enemy appears on the arena; a hit shows damage, the dummy dies and disappears.
- Can do: fire the only available weapon, hit the dummy, kill it.

## Technical

- Content: one `EnemyArchetype` (a stationary dummy) and one `WeaponArchetype` (a pistol) in the `content library` per [../design/content-archetypes.md](../design/content-archetypes.md); the session references them by `id`.
- `Loadout` in `SessionDefinition` gets a minimal shape `{ primaryWeaponArchetypeId }` ([../design/session-definition.md](../design/session-definition.md), [../design/content-archetypes.md](../design/content-archetypes.md)); a sandbox encounter with combat now carries `loadout` as an object instead of `null`.
- `SpawnPlan` extends to a union `{ empty | static }` per [../design/spawn-plan.md](../design/spawn-plan.md); `SpawnSystem` arrives in its minimal form: "execute the static list at encounter start".
- `CombatSystem` (firing/cooldown/projectile motion/hit-test/damage intents) and `HealthDeathSystem` (HP on entities, applying damage intents, death hooks, removal) — per [../design/projectiles-and-combat.md](../design/projectiles-and-combat.md) and [../design/health-and-death.md](../design/health-and-death.md). `MovementSystem` does not move projectiles.
- `SpatialIndex` arrives as a minimal per-tick rebuild with two queries (radius/box), an internal helper for `CombatSystem`; the contract lives in [../design/runtime-systems.md](../design/runtime-systems.md).
- The snapshot extends with new `EntitySnapshot` members for `enemy` and `projectile`, runtime events — `fire`/`hit`/`death` per [../design/snapshot-shape.md](../design/snapshot-shape.md). Owners: `CombatSystem` (`fire`/`hit`), `HealthDeathSystem` (`death`).
- Fire input reuses the existing `fire start/stop` from 002 ([../design/input-commands.md](../design/input-commands.md)); `aim` is taken from `RuntimeInputState`.
- The renderer on `main` receives the dummy and projectiles as regular entities by `kind` ([../design/thread-model.md](../design/thread-model.md), [../design/snapshot-shape.md](../design/snapshot-shape.md)); colour comes from the archetype.
- The sandbox encounter switches from `spawnPlan: { kind: 'empty' }` to `{ kind: 'static', spawns: [{ archetypeId, position }] }` for the training dummy; `winCondition`/`lossCondition` stay `none` (see the sandbox rules in [../design/session-definition.md](../design/session-definition.md)).

## Out of scope

- Multiple weapon types, multiple enemy types, buffs, and modifiers.
- Enemy behaviour beyond `stationary` (chase, wander, escort, AI firing) — that is 004 and later.
- Player HP and reaction to player death (`lossCondition: playerDeath`) — handled outside 003; the path is fixed in [../design/health-and-death.md](../design/health-and-death.md), implementation lives in a later story.
- Drops from corpses — that is `005` (works through the death hook left by [../design/health-and-death.md](../design/health-and-death.md)).
- Boss, waves, dark zone — `004`, `006`.
- Full damage/HP HUD, hit feedback, and sounds — that is `007`/`008`. For 003 it is enough that `hp` flows in the snapshot and `hit`/`death` events reach main.
- Sweep collision for projectiles and a tunable muzzle offset — postponed improvements, marked as "not in 003" in [../design/projectiles-and-combat.md](../design/projectiles-and-combat.md).

## Acceptance

- When the sandbox session starts, the training dummy spawns at the position defined by the content `spawnPlan` and is visible on the arena.
- Pressing LMB fires a projectile in the `aim` direction; repeated shots are limited to once per `cooldownMs` of the weapon.
- A projectile hit reduces the dummy's `hp` by exactly the weapon's `damage`; the projectile disappears on the same tick, and the hit produces a `hit` runtime event.
- When `hp == 0`, the dummy disappears on the **same** tick that received the final damage; a `death` runtime event is published.
- Miss: the projectile disappears once `projectileTtlMs` elapses or it leaves the arena bounds, and is no longer present in `EntityStore` or in snapshots.
- Holding LMB produces a sequence of shots at the `cooldownMs` rate without separate "auto-fire" speedups; releasing LMB stops firing without delay.
- All combat systems and `SpawnSystem` only run while a session is active; `stopSession` resets their state and leaves no entity leaks.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Extend the public contracts in `src/shared/**` for the combat model: new `EntitySnapshot` members (`enemy`, `projectile`) and three combat `RuntimeEvent`s (`fire`/`hit`/`death`) per `design/snapshot-shape.md`; `SpawnPlan` union `{ empty \| static }` in `src/shared/session.ts` per `design/spawn-plan.md`; the type `Loadout = { primaryWeaponArchetypeId }` per `design/content-archetypes.md`. No system implementations in this task — only shapes and `assertNever`-ready unions. | basis: `design/snapshot-shape.md`, `design/spawn-plan.md`, `design/content-archetypes.md`, `design/session-definition.md`, `design/thread-model.md` |
| T2 | [x] | Content library: registries for `EnemyArchetype` and `WeaponArchetype` in `src/shared/content/**` (`Record<string, Archetype>` keyed by `archetype.id`), one training dummy (`behavior: 'stationary'`) and one pistol; sandbox-with-combat `ModePreset`/builder that puts `loadout: { primaryWeaponArchetypeId }` and `spawnPlan: { kind: 'static', spawns: [{ archetypeId, position }] }` into the `SessionDefinition`. The old combat-less sandbox is preserved. | basis: `design/content-archetypes.md`, `design/content-boundaries.md`, `design/web-stack.md`, `design/session-definition.md`, `design/spawn-plan.md` |
| T3 | [x] | `EntityStore`: add the `enemy` kind (with `HasHealth = { hp, maxHp }` per `design/health-and-death.md`) and `projectile` kind (fields per `design/projectiles-and-combat.md`). `MovementSystem` must not move `projectile` entities and must not move `enemy` entities with `behavior: 'stationary'`; arena bounds still apply only to controllable actors. | basis: `design/runtime-systems.md`, `design/projectiles-and-combat.md`, `design/health-and-death.md`, `design/arena-and-coordinates.md` |
| T4 | [x] | `SpatialIndex` as an internal helper: per-tick rebuild from the current `EntityStore` after the phases that change positions; a minimal "neighbours within radius" and "neighbours in an axis-aligned box" API; no events published and no entity mutations. Wire it into the update order per `design/runtime-systems.md` (after `MovementSystem` and the projectile-motion phase inside `CombatSystem`). | basis: `design/runtime-systems.md` |
| T5 | [x] | `SpawnSystem`: execute the active encounter's `spawnPlan` — for `'static'` once on `encounterStart` via `EntityStore` (without scanning the store), for `'empty'` no-op; internal state resets on `encounterEnd`; an unknown `kind` is rejected via `assertNever`. The sandbox encounter spawns the dummy through `SpawnSystem` instead of "wiring it in" during initialisation. | basis: `design/spawn-plan.md`, `design/runtime-systems.md`, `design/session-definition.md` |
| T6 | [x] | `CombatSystem` per `design/projectiles-and-combat.md`: per-shooter cooldown in the shooter's runtime state; five tick phases (firing decisions → projectile movement → lifetime cleanup → hit detection → removal); hit-test through `SpatialIndex`; build a `DamageIntent` list for `HealthDeathSystem`; publish `fire` and `hit` runtime events per `design/snapshot-shape.md`. `MovementSystem` does not move projectiles. | basis: `design/projectiles-and-combat.md`, `design/snapshot-shape.md`, `design/input-commands.md`, `design/simulation-timing.md`, `design/runtime-systems.md` |
| T7 | [x] | `HealthDeathSystem` per `design/health-and-death.md`: apply damage intents (`hp = max(0, hp − amount)`), record death on the current tick, publish a `death` runtime event before running hooks; synchronous `DeathHook`s in registration order with the documented restrictions; removal of marked entities happens **before** `SnapshotExportSystem`. A repeat intent against a target already dead this tick is ignored. | basis: `design/health-and-death.md`, `design/snapshot-shape.md`, `design/runtime-systems.md` |
| T8 | [x] | `SnapshotExportSystem` and main render: export `enemy`/`projectile` into `snapshot.entities` with exactly the fields fixed in `design/snapshot-shape.md`; removed entities are absent from the snapshot. The main renderer draws `enemy` (colour from `EnemyArchetype.color`) and `projectile` (colour from `WeaponArchetype.color`); position interpolation follows the existing rules unchanged. | basis: `design/snapshot-shape.md`, `design/thread-model.md` |
| T9 | [x] | Tests for the combat contract per `design/testing.md`: per-shooter cooldown between two consecutive shots; the `hit → damage → death` chain happens within one tick; projectile despawn by `projectileTtlMs` and by leaving the arena; a repeat damage intent against a target already dead this tick does not fire the death hook a second time; the "projectiles are not moved by `MovementSystem`" invariant; an unknown `SpawnPlan.kind` triggers `assertNever`. | basis: `design/testing.md`, `design/projectiles-and-combat.md`, `design/health-and-death.md`, `design/spawn-plan.md` |
| T10 | [x] | Closing the story: closing checklist (see `stories/README.md`), move the story `Status` to `done`, update the table in `stories/README.md`; verify that `Index` in `design/README.md` is still up to date. | architect |

## Related

- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../design/projectiles-and-combat.md](../design/projectiles-and-combat.md)
- [../design/health-and-death.md](../design/health-and-death.md)
- [../design/spawn-plan.md](../design/spawn-plan.md)
- [../design/content-archetypes.md](../design/content-archetypes.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/session-definition.md](../design/session-definition.md)
- [../design/snapshot-shape.md](../design/snapshot-shape.md)
- [../design/thread-model.md](../design/thread-model.md)
- [../design/input-commands.md](../design/input-commands.md)
- [../design/arena-and-coordinates.md](../design/arena-and-coordinates.md)
- [../design/simulation-timing.md](../design/simulation-timing.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/logging.md](../design/logging.md)
- [../design/testing.md](../design/testing.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)

