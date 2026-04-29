# Runtime Systems

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-29 (story 030 prep: add `CompanionSystem` after movement and before combat for companion AI, inertial steering, threat selection, boop, and rescue; full contract in [companion-combat.md](companion-combat.md). Earlier: 2026-04-27 story 026 prep: Vibe Jam portals are main-thread interactables and do not add simulation systems, runtime events, or snapshot entities; see [vibe-jam-portals.md](vibe-jam-portals.md). Earlier: 2026-04-26 story 024: `RunSummaryTracker` observes deaths/drop pickups/progress and provides `SessionResultSummary` for terminal `win`/`loss` events; see [session-result-summary.md](session-result-summary.md). Earlier: 2026-04-24 017 alignment: `CombatSystem` owns universal weapon/projectile lifecycle from [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). 018 alignment: `FieldEffectSystem` and `StatusEffectSystem` are added after health/death and before drops; see [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md). Earlier: boss encounter, bossPhaseChange, drops.)

## Context

The MVP needs a compact `core runtime` that supports campaign, training, and challenge modes without growing into a general-purpose engine. Systems must cover the current design in `docs/` and run inside the `simulation worker`.

## Decision

- Minimal `core runtime` systems:
  - `SimulationClock` — fixed tick, pause, timescale;
  - `SessionFlowSystem` — session start, `encounter` changes, win, loss;
  - `EntityStore` — storage and lifecycle for runtime entities;
  - `SpatialIndex` — fast neighbor lookup for enemies, bullets, and drops;
  - `MovementSystem` — movement of controlled actors (player, enemies with behavior); projectile movement lives in `CombatSystem`, see [projectiles-and-combat.md](projectiles-and-combat.md);
  - `CompanionSystem` — companion behavior modes, deterministic threat selection, inertial movement, boop, rescue, and companion aim intent;
  - `CombatSystem` — firing, hits, damage, cooldowns;
  - `HealthDeathSystem` — HP, death, entity removal, death hooks;
  - `SpawnSystem` — execution of `spawnPlan`;
  - `ZoneSystem` — dark zone and other visibility-limiting modes;
  - `FieldEffectSystem` - lifetime and periodic application for puddles/temporary area effects;
  - `StatusEffectSystem` - actor-local status ticks, expiry and movement-affecting status resolution;
  - `DropSystem` — drop spawning, lifetime, and pickup;
  - `BossPhaseSystem` — boss phase transitions and attacks;
  - `RunSummaryTracker` - hook-driven aggregation for terminal run summary; it observes deaths/drop pickups/progress and does not mutate gameplay state;
  - `SnapshotExportSystem` — data collection for rendering and HUD.
- Systems must work over simple runtime structures and an explicit update order.
- Minimal per-tick update order:
  1. read input commands and session-level control;
  2. `SessionFlowSystem` and encounter transitions;
  3. `SpawnSystem`;
  4. `BossPhaseSystem` and other high-level encounter rules;
  5. `MovementSystem`;
  6. `CompanionSystem`;
  7. `CombatSystem`;
  8. `HealthDeathSystem`;
  9. `FieldEffectSystem`;
  10. `StatusEffectSystem`;
  11. `DropSystem`;
  12. `ZoneSystem`;
  13. `SnapshotExportSystem`.
- Local order changes during prototyping are allowed only if the general principle remains: encounter control rules first, then action simulation, then death/drop consequences, then state export.
- Network code, saves, complex inventory, crafting, and a full mod system are outside MVP runtime.
- Do not use a separate physics engine; collisions and overlap checks remain custom and 2D-oriented.
- All systems must be driven through `SessionDefinition` and runtime state, not direct conditional branches by mode name.
- System responsibility boundaries:
  - `SessionFlowSystem` decides which encounter is active, when the run ends, and which session-level events are published; it owns session lifecycle and encounter transitions (see below);
  - `SpawnSystem` only executes `spawnPlan` and does not decide win or loss; `spawnPlan` shape and execution are defined in [spawn-plan.md](spawn-plan.md);
  - `MovementSystem` changes positions and basic kinematics of **controlled actors** (player, enemies with behavior), but does not apply damage; it owns the invariant "entity does not leave arena bounds" ([arena-and-coordinates.md](arena-and-coordinates.md)) and reads bounds from active `SessionDefinition.arena`, not from a global constant; projectiles live outside `MovementSystem` (see [projectiles-and-combat.md](projectiles-and-combat.md));
  - `CompanionSystem` owns companion-specific AI and movement after [companion-combat.md](companion-combat.md): mode selection, smooth velocity steering, threat acquisition, boop impulses, ghost follow, rescue progress, and companion aim intent. It does not create projectiles, apply HP damage, or publish normal death events;
  - `CombatSystem` creates shots, moves projectiles, computes hits and explosions, and produces damage intents; the full contract is [projectiles-and-combat.md](projectiles-and-combat.md) and [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md);
  - `HealthDeathSystem` is the only layer that applies final HP loss, records death, and removes damageable entities; the full contract is [health-and-death.md](health-and-death.md);
  - `FieldEffectSystem` owns `fieldEffect` entity lifetime and periodic damage/status applications; it produces intents/applications, does not mutate HP directly, and follows [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md);
  - `StatusEffectSystem` owns status ticking, expiry and resolved actor status state; it produces damage intents and exposes movement modifiers, but does not move actors directly;
  - `SpatialIndex` is an internal helper for systems (`CombatSystem`, `DropSystem`, and when needed `BossPhaseSystem`); see the minimal contract below;
  - `DropSystem` reacts to death hooks (spawning `Drop` in `EntityStore`) and in its own tick phase manages only the drop lifecycle (ttl, pickup, removal); the full contract is [drops.md](drops.md);
  - `ZoneSystem` manages zone state and export, but does not end encounters by itself and does not deal damage; the full zone contract (`margin` shape, modes, lifecycle, export) is in [zone.md](zone.md);
  - `BossPhaseSystem` manages phases and boss-specific attack rules without replacing `SessionFlowSystem`.
  - `RunSummaryTracker` observes facts that already happened (`DeathContext`, drop pickup, current encounter/wave/boss state) and builds `SessionResultSummary` when `SessionFlowSystem` requests it before publishing `win`/`loss`; it does not publish events itself, does not make win/loss decisions, and does not affect update order.
- `SpatialIndex` — minimal architecture-level contract:
  - used as an accelerator for neighbor queries and not as the source of truth: source entity state lives in `EntityStore`;
  - rebuilt every tick from the current `EntityStore` after phases that can change positions (`MovementSystem`, projectile movement phase inside `CombatSystem`);
  - minimal API has two queries: "neighbors in a radius around a point" and "neighbors in an axis-aligned rectangle";
  - granularity is one index per tick with filtering by `kind` at the call site; separate indexes by `kind` are an implementation detail, not a contract;
  - `SpatialIndex` does not publish runtime events and does not mutate entities.
- `death hooks` must fire after `HealthDeathSystem` has recorded an entity death, but before the final snapshot export. Minimal death-hook consumers:
  - `DropSystem`;
  - session-level statistics and progression;
  - `RunSummaryTracker` for `kills`, `defeat.cause`, and boss-defeated summary; this hook must run before the death hook that calls `SessionFlowSystem.onPlayerDeath` / `onBossDeath`;
  - runtime events for HUD/audio/debug.
- Runtime events must be produced by the systems that own the event fact:
  - `SessionFlowSystem` — pause/resume, encounter start/end, win/loss;
  - `CombatSystem` — fire/hit/explosion;
  - `CompanionSystem` — companionBoop and companionRescued;
  - `HealthDeathSystem` — death and companionDowned;
  - `DropSystem` — dropSpawn/dropPickup/dropExpire (full contract for kinds and ownership — [snapshot-shape.md](snapshot-shape.md), [drops.md](drops.md));
  - `BossPhaseSystem` — `bossPhaseChange` ([snapshot-shape.md](snapshot-shape.md)).
  `FieldEffectSystem` and `StatusEffectSystem` may publish future presentation events only after [snapshot-shape.md](snapshot-shape.md) defines their exact kinds.
- `SnapshotExportSystem` does not create new gameplay logic; it only aggregates already computed state and required HUD fields.
- Simulation lifecycle relative to a session:
  - `simulation worker` is created once at app startup and reused across sessions ([thread-model.md](thread-model.md)); `stopSession` does not call `worker.terminate()`.
  - `SimulationClock` starts in **idle** mode: while there is no active session, it does not advance `simTime` and does not update systems. The pump may run in idle, but its only action is to stabilize the accumulator and avoid "banking" wall-clock time. No snapshots or runtime events are published in idle.
  - On `startSession`, `SessionFlowSystem` initializes `runtime state` from `SessionDefinition`, activates the first encounter, and moves `SimulationClock` to **running**. From that point, systems tick in the normal update order.
  - On `stopSession`, `SessionFlowSystem` resets `runtime state` (including input state from [input-commands.md](input-commands.md)) and returns `SimulationClock` to idle. Incoming input commands after that are dropped with a warning through the shared log module.
  - `pause`/`resume` apply only when a session is active; `pause` without an active session is a no-op with a warning. `pause`/`resume` semantics for the running state are unchanged and described in [simulation-timing.md](simulation-timing.md).
  - `SessionFlowSystem` must publish lifecycle runtime events: `sessionStart`, `sessionStop`, `encounterStart`, `encounterEnd`, `pause`, `resume`, and when present `win`/`loss`. After story 024, `win`/`loss` must use the `{ kind, simTime, summary }` shape from [session-result-summary.md](session-result-summary.md); other lifecycle events remain in the minimal `{ kind, simTime }` shape until consumers appear. For `winCondition`/`lossCondition` with category `none` ([session-definition.md](session-definition.md)), `win`/`loss` events are not generated automatically.

- Encounter transitions are owned by `SessionFlowSystem` (this clarifies responsibility; `transitionRules` shape is defined in [session-definition.md](session-definition.md)):
  - checking the active encounter's `transitionRules` happens **once per tick**, after `HealthDeathSystem` (when dead entities have already been removed and `aliveFromThisPlan` in `SpawnSystem` reflects reality) and **before** `SnapshotExportSystem` (so the transition and related lifecycle events happen before export);
  - exact place in update order: after `DropSystem` and before `ZoneSystem`; no step renaming is required because `SessionFlowSystem` already appears at step 2. The "not twice per tick" rule remains: step 2 owns `startSession`/encounter activation, and the separate transition-check phase is the same `SessionFlowSystem`, not a new system;
  - when a transition fires, `SessionFlowSystem` publishes `encounterEnd` for the current encounter, selects the next one by `transitionRules.next` (sequential by default), activates it (`SpawnSystem.onEncounterStart`, `ZoneSystem` initialization, `encounterStart` publication). If there is no next encounter, the run ends by `winCondition`;
  - encounter change happens **within the same tick**: between two consecutive snapshots, `main` sees either the old encounter or the new one, with no intermediate "none". This preserves the contract that snapshots carry consistent state.
- Run completion (win/loss) is owned by the same `SessionFlowSystem`:
  - for `winCondition: { kind: 'allEncountersComplete' }`, after `encounterEnd` of the final encounter, `SessionFlowSystem` builds `SessionResultSummary` through `RunSummaryTracker` and publishes `win` exactly once;
  - for `lossCondition: { kind: 'playerDeath' }`, `SessionFlowSystem` registers a session-level death hook for `entityKind === 'player'` ([health-and-death.md](health-and-death.md)) at simulation start (or session start, in one place). The player-death hook publishes `loss` exactly once and initiates run completion;
  - for `winCondition: { kind: 'bossDefeated' }`, the boss death hook builds `SessionResultSummary` through `RunSummaryTracker` before publishing terminal `win`;
  - `win`/`loss` event payload includes `summary` by [session-result-summary.md](session-result-summary.md); terminal event without summary is invalid after story 024;
  - after publishing `win` or `loss`, `SessionFlowSystem` performs the same runtime-state reset and clock transition to idle as `stopSession`. No further encounter transitions run. Repeated `pause`/`resume`/`input` messages are dropped with a warning through the shared log module ([logging.md](logging.md)).

## Consequences

- The core has a clear minimal scope without premature complexity.
- New modes are added mostly through data and limited system extensions.
- Update order and runtime component shape must be defined up front so systems remain isolated and predictable.
- Combat, drop, and boss stories must extend existing system boundaries rather than blur them for a local task.

## Related

- [../docs/SCOPE.md](../docs/SCOPE.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
- [../docs/BOSS.md](../docs/BOSS.md)
- [thread-model.md](thread-model.md)
- [session-definition.md](session-definition.md)
- [simulation-timing.md](simulation-timing.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [input-commands.md](input-commands.md)
- [spawn-plan.md](spawn-plan.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [health-and-death.md](health-and-death.md)
- [snapshot-shape.md](snapshot-shape.md)
- [zone.md](zone.md)
- [enemy-contact.md](enemy-contact.md)
- [drops.md](drops.md)
- [rng.md](rng.md)
- [logging.md](logging.md)
- [boss-encounter.md](boss-encounter.md)
- [impact-feedback.md](impact-feedback.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)
- [session-result-summary.md](session-result-summary.md)
- [vibe-jam-portals.md](vibe-jam-portals.md)
- [companion-combat.md](companion-combat.md)
