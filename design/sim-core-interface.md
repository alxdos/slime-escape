# Simulation Core Interface

- Status: accepted
- Created: 2026-04-30
- Updated: 2026-05-01 (story 036 review alignment: aligned the `invulnerableUntilSimMs` enforcement description with the shipped implementation — the filter lives in `HealthDeathSystem` damage-intent intake, covering every damage source uniformly. Recorded the trade-off honestly: `CombatSystem`'s `hit` event still fires on invulnerable targets (visual flash, zero damage), accepted as iframe-style feedback in exchange for one uniform filter point. The earlier draft of this Updated note that placed the filter in `CombatSystem` target resolution was over-prescriptive — both placements were valid choices for the engine primitive, and the implementer's pick stands. Tightened `setPlayerForm` HP-refill semantics for the case where `formUpdate.maxHp` is omitted: refill goes to the post-merge `maxHp` (existing value when omitted). Earlier: 2026-05-01 story 036 prep: added the dynamic-roster lifecycle methods `addPlayer(playerConfig, opts?)`, `removePlayer(playerId)`, and `setPlayerForm(playerId, formUpdate, opts?)` for sessions configured with `dynamicRoster: true` ([session-definition.md](session-definition.md)). Recorded `addPlayer` opts.invulnerableUntilSimMs as the engine primitive that replaces compact-sim spawn protection; `setPlayerForm` opts.refillHp as an explicit caller-owned policy hook so HP refill on form change does not leak in as a side effect. Recorded the tick-boundary application rule for both add and remove, and the silent in-flight projectile cleanup rule on `removePlayer`. Earlier: 2026-04-30 story 035 prep: closed the pre-flagged gap and updated `submitInput` to its multi-actor signature `submitInput(playerId, command)`. The transitional single-actor signature shipped by story 034 is gone. The `MainToSim.input` envelope shape is intentionally not changed; the browser worker entry tags every input with `players[0].id` from the active session — the routing convention is recorded in [input-commands.md](input-commands.md). The future Node arena host (story 036) derives `playerId` per Socket.IO socket and calls `submitInput(playerId, command)` directly.)

## Context

[simulation-runtime.md](simulation-runtime.md) records the umbrella decision that one shared simulation core runs under two hosts (browser worker for local play, Node arena host for online modes) and that "host integration is provided through explicit input/output ports on the core". It deliberately defers the concrete shape of those ports to subsequent decisions.

This file records that concrete shape: how a host constructs the core, which methods it calls into, which callbacks the core invokes back, how the wall-clock pump crosses the boundary, and what does **not** cross the boundary. Without a single recorded interface, story 036 (Node arena host) and story 038 (client running shared `MovementSystem` for prediction) would each redefine it locally and drift from the browser worker host introduced by story 034.

Story 035 generalised `SessionDefinition.player` into `SessionDefinition.players[]` and `RuntimeInputState` into a per-`playerId` map; `submitInput` carries `playerId` accordingly. The single-actor signature that shipped with story 034 is gone — local play continues to work because every local preset emits `players: [<one>]`, and the browser worker entry tags messages with `players[0].id`.

Story 036 generalises the lifecycle: the Node arena host runs one shared core for the public arena and needs to add and remove players after `start(session)`, change a player's form in place when level chains advance, and grant a short post-spawn invulnerability window. Those primitives live on the core; the kill→level→form policy that composes them lives in the host (recorded separately as part of story 036).

## Decision

### Factory

- The shared simulation core is constructed through a single factory exported from the core entry:
  ```ts
  function createSimulationCore(options: SimulationCoreOptions): SimulationCore;
  ```
- `SimulationCoreOptions` carries the output ports and nothing else. The host owns no further configuration of the core beyond what is passed at construction.
- The factory is host-agnostic: it must not reference `self`, `postMessage`, `Worker`, browser globals, Node globals, `setInterval`, `setTimeout`, `performance.now`, Socket.IO, or any other host-specific API. The full ban is in [simulation-runtime.md](simulation-runtime.md); compliance lives in the shared layer per [web-stack.md](web-stack.md).
- The factory creates internal systems, wires their internal hooks (death hooks, encounter callbacks, session-lifecycle hooks, damage hooks, etc.) and returns a façade with the public methods listed below. Internal wiring between systems does **not** cross the host boundary.

### Output ports (core → host)

- `onSnapshot(snapshot: Snapshot): void` — the core invokes this whenever `SnapshotExportSystem` produces a snapshot per [simulation-timing.md](simulation-timing.md).
- `onEvent(event: RuntimeEvent): void` — the core invokes this for every runtime event produced by its systems per [snapshot-shape.md](snapshot-shape.md).
- These are the only ports in the first version. Telemetry (`SimToMain.kind: 'telemetry'`) is intentionally not part of the core interface yet — it has no producer today; when a real consumer appears, this file is extended.

### Input methods (host → core)

The façade `SimulationCore` exposes exactly the following methods. Method names and shapes are the contract:

- `start(session: SessionDefinition): void` — initialize runtime state and move the clock to running. Mirrors the existing `MainToSim.kind: 'startSession'` shape minus the message envelope.
- `stop(): void` — reset runtime state and return the clock to idle. Mirrors `stopSession`.
- `pause(): void` — pause the clock; equivalent to `MainToSim.kind: 'pause'`.
- `resume(): void` — resume the clock; equivalent to `MainToSim.kind: 'resume'`.
- `submitInput(playerId: string, command: InputCommand): void` — feed a single input command into the core for the actor identified by `playerId` (a value from `SessionDefinition.players[].id`, see [session-definition.md](session-definition.md)). The method updates only that actor's slot in the per-player `RuntimeInputState` map ([input-commands.md](input-commands.md)). Inputs whose `playerId` is not in the active session's roster are dropped with a warning through the shared log module ([logging.md](logging.md)); silent ignore is forbidden. The host is responsible for choosing `playerId` — for the browser worker host this is `session.players[0].id` (one actor per local session), for the Node arena host (story 036) it is the per-socket actor id derived at intake.
- `pump(nowMs: number): void` — drive the simulation forward against a host-supplied wall-clock time. The core does its own catch-up against `SIM_STEP_MS` per [simulation-timing.md](simulation-timing.md). The host must not pass synthetic times to "speed up" or "skip" simulation; the value is the host's actual wall-clock now.

### Dynamic-roster lifecycle (host → core)

These methods extend the lifecycle for sessions configured with `dynamicRoster: true` ([session-definition.md](session-definition.md)). They allow the Node arena host to add and remove actors after `start(session)` and to advance an actor's form along a kill-chain without losing its position, knockback, or weapon timers.

- `addPlayer(playerConfig: PlayerConfig, opts?: { invulnerableUntilSimMs?: number }): void` — spawn a new actor mid-session. Creates the player entity with `playerConfig.position`/`radius`/`contactBox`/`maxSpeed`/`maxHp`, opens its slot in the per-player `RuntimeInputState` map, and applies `playerConfig.loadout` if non-null. `playerConfig.id` must be unique within the active session and is used by `submitInput` for routing. `opts.invulnerableUntilSimMs`, when set, seeds the actor's `invulnerableUntilSimMs` runtime field. Until that simTime, every `DamageIntent` targeting the actor is dropped at `HealthDeathSystem` intake before HP application, before damage hooks run, and before the `death` event/death-hook chain ([runtime-systems.md](runtime-systems.md)); the actor takes no damage and cannot die. The single intake filter covers every damage source uniformly (projectile impact, explosion AoE, enemy contact, retaliation, fragments, future status DoT / field-effect ticks). Trade-off recorded explicitly: `CombatSystem`'s `hit` event still fires for an invulnerable target with the projectile's nominal `damage` value, because `CombatSystem` does not consult invulnerability; only HP application is suppressed. The visual flash that this allows is acceptable iframe-style feedback. The opt is the engine primitive; the value is policy (PvP spawn protection from [online-arena-hosting.md](online-arena-hosting.md), future pause-ghost, future boss invincibility frames). Invalid in sessions with `dynamicRoster: false`; warning through the shared log, no entity is created. Invalid when the session is idle (no active session).
- `removePlayer(playerId: string): void` — remove an actor from the active session. Removes the player entity (alive or dead), drops the actor's `RuntimeInputState` slot, and **silently** removes every in-flight projectile owned by this actor. No `death`, `explosion`, or `dropExpire` events are produced for the silent cleanup; the actor and its projectiles simply disappear at the next `SnapshotExportSystem` pass. This is the expected shape for socket disconnect or kick. Invalid in sessions with `dynamicRoster: false`; warning, no removal. If `playerId` is not in the active roster, warning, no-op.
- `setPlayerForm(playerId: string, formUpdate: { radius?: number; contactBox?: ContactBox; maxSpeed?: number; maxHp?: number; loadout?: Loadout | null; formArchetypeId?: string | null }, opts?: { refillHp?: boolean }): void` — mutate an actor's form in place. `position` and the entity `id` are preserved. Provided fields replace the corresponding `PlayerConfig` fields; omitted fields stay as they were. `formArchetypeId` flows into `PlayerSnapshot.formArchetypeId` ([snapshot-shape.md](snapshot-shape.md)) for renderer choice between hero and slime/boss visuals; `null` means "back to canonical hero form". `loadout` replacement reuses the existing `setPlayerLoadout` path inside `CombatSystem`, including weapon-cooldown reset rules. `opts.refillHp === true` raises HP to the post-merge `maxHp` (the value of `formUpdate.maxHp` if provided, otherwise the existing `maxHp`); default `false` clamps current HP to `min(currentHp, postMergeMaxHp)` so HP refill is an explicit caller-owned policy hook, not an implicit side effect of form change. Invalid in sessions with `dynamicRoster: false`; invalid when `playerId` is not in the active roster (warning, no-op in both cases).

### Tick-boundary application

`addPlayer`, `removePlayer`, and `setPlayerForm` must not take effect mid-tick. The core buffers them and applies them at a tick boundary — either before the first system runs in the next tick, or after `SnapshotExportSystem` finishes the current tick. The choice between "before next tick" and "after current tick" is an implementation detail; the contract is that no system observes a player roster that changes between phases of the same tick. This preserves the invariant "for every tick, every system sees the same set of player entities".

`MainToSim.kind: 'debug'` is intentionally **not** part of the first version. Today the worker logs a warning for it and there is no consumer; when a real debug consumer appears, this file is extended (or a separate decision records the debug channel).

### What does not cross the boundary

- Internal system wiring. Death hooks (`HealthDeathSystem.registerHook`/`registerDamageHook`), session-lifecycle callbacks (`onSessionStart`/`onSessionStop`/`onEncounterStart`/`onEncounterEnd`/`onEncounterComplete`), spawn/RNG bootstrap, run-summary tracker hookup, retaliation wiring — all of this is constructed inside the factory and stays internal to the core. The host has no way to register or observe them and must not need to.
- Direct system access. The core does not expose `EntityStore`, `CombatSystem`, `MovementSystem`, etc. as part of its public API. Tests for individual systems continue to exercise them directly inside the shared layer; hosts must not.
- Clock control beyond `pause`/`resume`. The host cannot push `simTime` forward, snapshot it, or read it through the interface; the only handle on simulation time is the `simTime` field carried in each snapshot.

### Lifecycle

- The core is created **once** per host process, before the host begins accepting messages. Stopping a session does not destroy the core: it transitions to idle and is reused by the next `start(session)`. This preserves the existing rule from [runtime-systems.md](runtime-systems.md) and [thread-model.md](thread-model.md) that `stopSession` must not call `worker.terminate()`.
- The browser worker host calls `createSimulationCore` once at worker module load, then loops on `pump`. The Node arena host (story 036) follows the same pattern: one core per Node process for a given arena, reused across the arena's lifetime.
- After `stop()`, the core's internal state is fully reset (entities cleared, exporter reset, system caches cleared, RNG cleared, dynamic-roster pending operations dropped). A subsequent `start(session)` produces deterministic-by-`seed` behavior identical to a freshly constructed core, per the rule in [rng.md](rng.md). The new `playerSpawn` runtime event ([snapshot-shape.md](snapshot-shape.md)) re-fires for every initial `players[]` entry on every `start(session)`, including restarts after `stop()`.
- After `pump` is called while the core is idle, it is a no-op except for stabilizing the internal accumulator; no snapshots are emitted, no events are produced. This matches the existing `SimulationClock` behavior recorded in [simulation-timing.md](simulation-timing.md).

### Wall-clock pumping

- The host owns the wall-clock driver: `setInterval`, `setTimeout`, `requestAnimationFrame`, or any equivalent loop that can call `core.pump(now)`. The choice is host-specific.
- The host owns reading wall-clock time (`performance.now()` in browser/Node, or any monotonic source the host trusts) and passes it as the `nowMs` argument.
- The core owns the catch-up loop, the `SIM_STEP_MS` step, and `simTime` accumulation. It must not call wall-clock APIs itself. The split is recorded in [simulation-timing.md](simulation-timing.md); this file states only the boundary at the interface level.
- The first call to `pump(nowMs)` after `createSimulationCore` (and, equivalently, the first call after each `start(session)`) establishes the wall-clock baseline and does not advance ticks; subsequent calls drive the catch-up loop against that baseline. Hosts that need an instant first tick must therefore prime the pump with one no-op call before relying on tick output.

## Consequences

- The browser worker host (story 034) and the Node arena host (story 036) implement the same handful of method calls and the same two callbacks. Drift between hosts is mechanical to spot, not architectural.
- Story 038 (client-side prediction) imports the shared `MovementSystem` directly from the core's shared layer rather than going through this façade, because prediction is a partial replay against an authoritative reference, not a host of its own. That use case is intentionally outside this interface.
- The first-version omission of telemetry and `debug` keeps the interface minimal; both are easy extensions when a real consumer appears.
- The multi-actor `submitInput(playerId, command)` signature is the stable shape going forward. Hosts pick `playerId` per their own routing rules (browser worker uses `players[0].id`, Node arena host uses the per-socket id), but the core's input-state map is the single source of truth.
- Internal hooks staying inside the factory means changing system wiring (e.g. adding a new `death hook` consumer) is a core-internal change, not a host-protocol change.
- Dynamic-roster lifecycle methods stay primitives, not policy. The kill→level→form chain that composes them is recorded as host policy in story 036's hosting decision, not here. If a second consumer of the same chain appears (for example, an asymmetric co-op mode), lifting the policy into a shared `PlayerProgressionSystem` becomes a separate decision; until then the primitives are the contract.
- `addPlayer` opts.invulnerableUntilSimMs is intentionally a single field, not a status effect. It does not stack, does not animate, does not produce a runtime event; it only filters damage intents at HP-application time. Future invulnerability use cases (pause-ghost, boss invincibility frames) reuse this primitive instead of adding a new layer.

## Related

- [simulation-runtime.md](simulation-runtime.md)
- [simulation-timing.md](simulation-timing.md)
- [runtime-systems.md](runtime-systems.md)
- [thread-model.md](thread-model.md)
- [snapshot-shape.md](snapshot-shape.md)
- [input-commands.md](input-commands.md)
- [session-definition.md](session-definition.md)
- [web-stack.md](web-stack.md)
- [rng.md](rng.md)
- [../stories/035-multi-actor-sessions.md](../stories/035-multi-actor-sessions.md)
- [../stories/036-node-arena-host.md](../stories/036-node-arena-host.md)
