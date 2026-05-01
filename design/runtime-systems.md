# Runtime Systems

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-05-01 (story 037 prep: implemented `lossCondition: 'allPlayersDead'` flow in `SessionFlowSystem` — after each player ghost transition (see [health-and-death.md](health-and-death.md)) the system checks live-actor count among `players[]`; when zero live remain, `loss` fires exactly once with `defeat.cause` derived from the cause that brought the live count to zero. Generalised the rescue-progress logic in `CompanionSystem` to also handle player rescue: when `SessionDefinition.playerCoopRevive` ([session-definition.md](session-definition.md)) is non-null, ghost players accumulate rescue progress from any nearby live player by the same proximity+duration mechanic that companion rescue already uses, and on success the player transitions `'ghost' → 'alive'` with a `playerRevived` event ([snapshot-shape.md](snapshot-shape.md)); the same handler still publishes `companionRescued` for companion rescues. `CompanionSystem` learns multi-companion sessions: it iterates per-actor companions keyed by owning `playerId` (per `PlayerConfig.companion` from [session-definition.md](session-definition.md)) and runs orbit/threat/engage/ghost/heal-seek independently for each, with each companion's owner-relative behaviour resolved against its assigned `playerId` rather than via the multi-actor AI-targeting policy. Added `SessionRules.playerVsPlayerDamage` consumption point at the shared damage-rule helper ([projectiles-and-combat.md](projectiles-and-combat.md)) — gates HP-damage between two `kind: 'player'` actors symmetric to `slimeFriendlyFire`. Earlier: 2026-05-01 story 036 prep: recorded `'respawnOnDeath'` lossCondition implementation in `SessionFlowSystem` — death runs the existing `HealthDeathSystem.removePlayer` path and emits `death`, but no `loss` is published and no terminal hooks fire; respawn is host policy, not engine. Recorded ownership of the new `playerSpawn` runtime event under `EntityStore.spawnPlayer`, fired both for initial `players[]` and for `core.addPlayer` on tick boundaries. Recorded the dynamic-roster lifecycle methods (`addPlayer`/`removePlayer`/`setPlayerForm`) as buffered tick-boundary operations so no system observes a roster that changes between phases of the same tick. Recorded `addPlayer.invulnerableUntilSimMs` as a single runtime field consulted by `HealthDeathSystem` at damage-intent intake — invulnerable actors lose every incoming `DamageIntent` before HP application, hooks, or `death` events fire, uniformly across damage sources. Trade-off recorded honestly: `CombatSystem`'s `hit` event still fires for invulnerable targets (visual flash possible, no HP change), accepted as iframe-style feedback in exchange for a single uniform filter point. Not a status effect, not a system. Explicitly excluded `levelUp` from shared `RuntimeEvent`: it stays a host-emitted PvP event. Earlier: 2026-04-30 story 035 prep: recorded the multi-actor AI-targeting policy under `MovementSystem` — every system that previously hard-coded "the player" as a target chooses by deterministic nearest squared-distance among living `Player` entities, with `playerId` lexicographic ascending tie-break, applied to enemy chase fallback, boss chase, boss attacks, and companion threat/orbit/ghost positions. Updated `SessionFlowSystem` so the `'playerDeath'` lossCondition publishes `loss` exactly once on the first player death. Earlier: 2026-04-29 story 030 prep: add `CompanionSystem` after movement and before combat for companion AI, inertial steering, threat selection, boop, and rescue; full contract in [companion-combat.md](companion-combat.md). Earlier: 2026-04-27 story 026 prep: Vibe Jam portals are main-thread interactables and do not add simulation systems, runtime events, or snapshot entities; see [vibe-jam-portals.md](vibe-jam-portals.md). Earlier: 2026-04-26 story 024: `RunSummaryTracker` observes deaths/drop pickups/progress and provides `SessionResultSummary` for terminal `win`/`loss` events; see [session-result-summary.md](session-result-summary.md). Earlier: 2026-04-24 017 alignment: `CombatSystem` owns universal weapon/projectile lifecycle from [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). 018 alignment: `FieldEffectSystem` and `StatusEffectSystem` are added after health/death and before drops; see [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md). Earlier: boss encounter, bossPhaseChange, drops.)

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
  - `MovementSystem` changes positions and basic kinematics of **controlled actors** (players, enemies with behavior), but does not apply damage; it owns the invariant "entity does not leave arena bounds" ([arena-and-coordinates.md](arena-and-coordinates.md)) and reads bounds from active `SessionDefinition.arena`, not from a global constant; projectiles live outside `MovementSystem` (see [projectiles-and-combat.md](projectiles-and-combat.md)). Multi-actor sessions ([session-definition.md](session-definition.md)) add a single, deterministic **AI-targeting policy** that every system reusing "the player" as a target consults (`MovementSystem` enemy chase fallback, `MovementSystem` boss chase, `BossPhaseSystem` boss attack targeting): pick the **living `Player` entity nearest by squared distance to the chooser's position**; if two or more are tied at the same squared distance, break the tie by `playerId` ascending lexicographic order. **Ghost-state actors do not count as living for AI-targeting** (story 037, [snapshot-shape.md](snapshot-shape.md)) — enemies and bosses ignore ghost players and pick the nearest alive one; if no actor is alive, behaviour collapses to the existing "no player" path. The choice is taken from `EntityStore` per-tick (no caching across ticks). For enemy aggro memory ([combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)), the recorded target is still an `EntityId`; the new policy applies only to the fallback path when the aggro target is missing or expired (a target that ghosted is treated as missing). The policy is fully deterministic given `seed` and `players[].id`. **Multi-companion AI targeting is owner-pinned, not nearest-player**: in sessions where each player has its own companion (per `PlayerConfig.companion` in [session-definition.md](session-definition.md)), each companion follows its owning `playerId` for orbit/ghost-follow/rescue-target regardless of who the nearest live player is. The AI-targeting policy above does not apply to `CompanionSystem` orbit/ghost decisions; it remains relevant only for systems that genuinely pick "the player" from `players[]` collectively;
  - `CompanionSystem` owns companion-specific AI and movement after [companion-combat.md](companion-combat.md): mode selection, smooth velocity steering, threat acquisition, boop impulses, ghost follow, rescue progress, and companion aim intent. It does not create projectiles, apply HP damage, or publish normal death events. **Multi-companion (story 037)**: in sessions where multiple actors carry `PlayerConfig.companion !== null`, `CompanionSystem` iterates per-actor companions keyed by owning `playerId` and runs each companion's logic independently against its assigned owner — orbit/ghost-follow positions are computed against that owner only, threat acquisition reads from the shared spatial index per companion's own position, heal-seek is per-companion, and ghost-state on one companion does not perturb other companions. Rescue interactions (companion-rescue and the new player-rescue under `SessionDefinition.playerCoopRevive`) share one rescue-progress handler inside this system: the handler walks every alive player against every ghost target (companion or player) within the relevant radius, accumulates per-pair progress, and on completion triggers either `CompanionSystem`'s revive path (publishing `companionRescued`) or the player-revive path (transitioning the player from `'ghost' → 'alive'` per [snapshot-shape.md](snapshot-shape.md) and publishing `playerRevived`). The handler reads companion rescue tuning from each `PlayerConfig.companion.rescue` and player-rescue tuning from `SessionDefinition.playerCoopRevive`; when `playerCoopRevive` is `null`, ghost players are skipped and only companions can be rescued;
  - `CombatSystem` creates shots, moves projectiles, computes hits and explosions, and produces damage intents; the full contract is [projectiles-and-combat.md](projectiles-and-combat.md) and [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md);
  - `HealthDeathSystem` is the only layer that applies final HP loss, records death, and removes damageable entities; the full contract is [health-and-death.md](health-and-death.md);
  - `FieldEffectSystem` owns `fieldEffect` entity lifetime and periodic damage/status applications; it produces intents/applications, does not mutate HP directly, and follows [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md);
  - `StatusEffectSystem` owns status ticking, expiry and resolved actor status state; it produces damage intents and exposes movement modifiers, but does not move actors directly;
  - `SpatialIndex` is an internal helper for systems (`CombatSystem`, `DropSystem`, and when needed `BossPhaseSystem`); see the minimal contract below;
  - `DropSystem` reacts to death hooks (spawning `Drop` in `EntityStore`) and in its own tick phase manages only the drop lifecycle (ttl, pickup, removal); the full contract is [drops.md](drops.md);
  - `ZoneSystem` manages zone state and export, but does not end encounters by itself and does not deal damage; the full zone contract (`margin` shape, modes, lifecycle, export) is in [zone.md](zone.md);
  - `BossPhaseSystem` manages phases and boss-specific attack rules without replacing `SessionFlowSystem`.
  - `RunSummaryTracker` observes facts that already happened (`DeathContext`, drop pickup, current encounter/wave/boss state) and builds `SessionResultSummary` when `SessionFlowSystem` requests it before publishing `win`/`loss`; it does not publish events itself, does not make win/loss decisions, and does not affect update order. In multi-actor sessions it aggregates kill counts, drops, and boss state across all `players[]`; per-actor attribution is intentionally not produced. The full multi-actor policy, including how `defeat.cause` is selected when more than one player can die, lives in [session-result-summary.md](session-result-summary.md).
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
  - `CompanionSystem` — companionBoop, companionRescued, and `playerRevived` (story 037; the same rescue-progress handler emits both kinds);
  - `HealthDeathSystem` — death, companionDowned, and `playerDowned` (story 037; emitted on the alive→ghost transition under `lossCondition: 'allPlayersDead'`);
  - `DropSystem` — dropSpawn/dropPickup/dropExpire (full contract for kinds and ownership — [snapshot-shape.md](snapshot-shape.md), [drops.md](drops.md));
  - `BossPhaseSystem` — `bossPhaseChange` ([snapshot-shape.md](snapshot-shape.md));
  - `EntityStore.spawnPlayer` — `playerSpawn` ([snapshot-shape.md](snapshot-shape.md)).
  `FieldEffectSystem` and `StatusEffectSystem` may publish future presentation events only after [snapshot-shape.md](snapshot-shape.md) defines their exact kinds. PvP-specific events such as `levelUp` are explicitly **not** part of shared `RuntimeEvent`; they live in host-specific channels recorded in the corresponding host decision (story 036).
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
  - for `lossCondition: { kind: 'playerDeath' }`, `SessionFlowSystem` registers a session-level death hook for `entityKind === 'player'` ([health-and-death.md](health-and-death.md)) at simulation start (or session start, in one place). The hook publishes `loss` exactly once on the **first** player death (any of `players[]`); subsequent player deaths within the same tick or in following ticks do not republish `loss` and do not run further loss-related hooks. For sessions with `players.length === 1` this matches the previous single-player rule bit-for-bit;
  - for `lossCondition: { kind: 'respawnOnDeath' }`, `SessionFlowSystem` does **not** register a terminal death hook. Player death runs the standard `HealthDeathSystem.removePlayer` path: the entity is removed, the actor's `RuntimeInputState` slot is dropped, the `death` runtime event ([snapshot-shape.md](snapshot-shape.md)) fires, but no `loss` is published, no run-summary build is requested, and no terminal hook runs. The session continues; bringing the actor back is host policy via `core.addPlayer` ([sim-core-interface.md](sim-core-interface.md)). Implemented in story 036;
  - for `lossCondition: { kind: 'allPlayersDead' }` (story 037), `SessionFlowSystem` does **not** register a terminal death hook on the first death. Player deaths under this kind are routed by `HealthDeathSystem` to the ghost transition described in [health-and-death.md](health-and-death.md) instead of removal. After every player ghost transition, `SessionFlowSystem` runs a "live-actor count" check among `players[]` (a player counts as live when its entity exists and `state === 'alive'`); when the count is zero, `SessionFlowSystem` requests `SessionResultSummary` through `RunSummaryTracker` and publishes `loss` exactly once with `defeat.cause` derived from the most recent transition. Revives between transitions can bring the live count back above zero — in that case no `loss` fires for earlier ghost transitions (because the run is no longer over). The check runs in the same tick phase as the existing `'playerDeath'` decision (after death hooks, before snapshot export). Implemented in story 037;
  - for `winCondition: { kind: 'bossDefeated' }`, the boss death hook builds `SessionResultSummary` through `RunSummaryTracker` before publishing terminal `win`;
  - `win`/`loss` event payload includes `summary` by [session-result-summary.md](session-result-summary.md); terminal event without summary is invalid after story 024;
  - after publishing `win` or `loss`, `SessionFlowSystem` performs the same runtime-state reset and clock transition to idle as `stopSession`. No further encounter transitions run. Repeated `pause`/`resume`/`input` messages are dropped with a warning through the shared log module ([logging.md](logging.md)).
- Dynamic roster (story 036, [sim-core-interface.md](sim-core-interface.md), [session-definition.md](session-definition.md)):
  - `core.addPlayer(playerConfig, opts?)`, `core.removePlayer(playerId)`, and `core.setPlayerForm(playerId, formUpdate, opts?)` are valid only while a session with `dynamicRoster: true` is active. The core buffers them and applies them on a tick boundary (before the first system runs in the next tick, or after `SnapshotExportSystem` finishes the current tick). No system observes a roster that changes between phases of the same tick.
  - `addPlayer` goes through `EntityStore.spawnPlayer` and emits a `playerSpawn` runtime event on application; `setPlayerForm` mutates the existing entity in place and does **not** emit `playerSpawn`; `removePlayer` removes the entity, drops the input slot, and silently removes every in-flight projectile owned by this actor without producing `death`, `explosion`, or `dropExpire`.
  - `addPlayer.opts.invulnerableUntilSimMs`, when set, becomes a runtime field on the player entity. `HealthDeathSystem` consults this field at damage-intent intake — for every `DamageIntent` whose target has `invulnerableUntilSimMs > simTimeMs`, the intent is dropped before damage hooks run, before HP changes, and before the `death` event/death-hook chain. This single check covers every damage source uniformly (projectile impact, projectile explosion AoE, enemy contact, retaliation, fragment hits, future status DoT, future field-effect ticks): there is one place to verify and one place to update. Trade-off recorded honestly: the `hit` event from `CombatSystem` (and the explosion-derived `hit` events) **does still fire** for an invulnerable target with the projectile's nominal `damage`, because `CombatSystem` does not consult invulnerability — only HP application is suppressed. Renderers and audio that consume `hit` may show a visual flash on an invulnerable target, which is acceptable as iframe-style feedback; client presentation that wants to suppress the flash on its own actor can read `PlayerSnapshot` and check whether HP changed in the next snapshot, but this is presentation policy, not a snapshot-shape contract. The field is **not** a status effect — it does not stack, does not animate, does not produce an event of its own. Future invulnerability use cases (pause-ghost, boss invincibility frames) reuse this primitive and the same `HealthDeathSystem` intake filter instead of adding a new layer.
- `playerSpawn` event ownership (story 036): `EntityStore.spawnPlayer` is the single emitter, regardless of whether the call site is `start(session)` (one event per `players[]` entry) or `core.addPlayer` (one event per call). After `stop()` followed by `start(session)`, events re-fire for the new initial roster — a session restart is observationally equivalent to a fresh session for any consumer subscribed to spawn cues. No emitter outside `EntityStore.spawnPlayer` may publish `playerSpawn`.

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
- [sim-core-interface.md](sim-core-interface.md)
- [simulation-runtime.md](simulation-runtime.md)
- [online-session-hosting.md](online-session-hosting.md)
- [online-lobby.md](online-lobby.md)
- [input-commands.md](input-commands.md)
- [../stories/035-multi-actor-sessions.md](../stories/035-multi-actor-sessions.md)
- [../stories/036-node-arena-host.md](../stories/036-node-arena-host.md)
- [../stories/037-coop-vs-slimes.md](../stories/037-coop-vs-slimes.md)
