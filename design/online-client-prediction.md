# Online Client-Side Prediction

- Status: accepted
- Created: 2026-05-01
- Updated: 2026-05-01 (story 039 prep — stabilization gaps in 038. Six contract clarifications/changes: **(1)** replay rule rewritten — replay catches up the predictor's `simTime` from `snapshot.simTimeMs` to a wall-clock target rather than ticking once per buffered command. `BufferedInput` gains a required `appliedAtSimTime` field (the predictor `simTime` at which the command was originally applied locally), recorded at `submitInput` time. The replay loop ticks the predictor's `MovementSystem` / `CombatSystem` for every `SIM_STEP_MS` step from `snapshot.simTimeMs` to `snapshot.simTimeMs + (nowWall - snapshotReceivedAtWall)`, applying buffered commands at their `appliedAtSimTime` and continuing intermediate ticks with the prevailing input state. The previous "one tick per buffered input" reading produced systematic motion underestimation for held state commands (e.g. holding W for 200 ms while only one `move` command sat in the buffer caused replay to advance by 16.67 ms instead of 200 ms). **(2)** Lost-frame-after-reconcile fix: `receiveAuthoritativeSnapshot` no longer resets the predictor's `lastWallMs` baseline. The next pump call advances normally, instead of the previous "first pump after reconcile is a no-op" frame gap. **(3)** Cooldown preservation rule: when the predictor synchronises weapon state from `PlayerSnapshot.weaponHud` on every snapshot, the rebuilt weapon's `nextFireSimMs` is `max(authoritative.cooldownReadyAtSimMs, predictor.nextFireSimMs)`. A snapshot whose `cooldownReadyAtSimMs` is in the past relative to the predictor's already-advanced cooldown cannot reset the local cooldown to a stale value. This closes phantom-respawn-after-fire under typical RTT. **(4)** Self-position blend criteria revised. The previous "blend on position delta > `0.05 wu`" gated the blend below per-tick motion at slime speed (~`0.1 wu`), so the blend triggered on every snapshot during routine movement and the local slime visibly skidded. The new rule: render the predicted self position **directly** every frame for routine motion (no blend, no threshold). Position correction is owned by the snap-on-event mechanism (`playerSpawn` / `playerDowned` / `playerRevived` / `host:levelUp` / `formArchetypeId` change / predicted-fire-rejected). The `0.05 wu` epsilon and `100 ms` blend window are retired as runtime constants in 039 — kept only as documentation of the original 038 design — and any future blend layer that this decision permits must source its animation `nowMs` from wall-clock, not from `authoritativeSnapshot.simTimeMs`. **(5)** Own-projectile renderer fallback rule: when the renderer composes the rendered scene, if no predicted self projectile matches an authoritative own projectile (by `spawnInputSequence` when present, otherwise by `(ownerId, ownerKind === 'player')` lookup), the renderer **falls back** to the authoritative entry rather than suppressing it. The previous "all authoritative own projectiles are filtered out and replaced by predicted only" rule produced "no bullets visible" whenever the predictor's `EntityStore` was empty in a race window. Predicted-when-present, authoritative-when-absent — never both, never neither. **(6)** Ack-window-before-removal in `syncOwnProjectiles`: a predicted projectile whose `spawnInputSequence` is acknowledged but absent from the authoritative set is retained for one full `SNAPSHOT_INTERVAL_MS` after the ack arrives, not removed on the first acknowledging snapshot. This bridges the race window where the server fires the projectile after the originating snapshot's `simTime` was captured (the projectile appears in the next snapshot, not the first acknowledging one). The rule also clarifies how this interacts with the main-thread predicted-fire-rejected snap window in `UiShell` — both must run, and the predictor's removal is the one that actually drops the projectile from `EntityStore`. The `2 * RTT_estimate + SNAPSHOT_INTERVAL_MS` window in `UiShell` from earlier 038 review remains for self-snap purposes. The full implementation lives in story 039 stabilization (see [../stories/039-online-prediction-stabilization.md](../stories/039-online-prediction-stabilization.md)). Earlier: 2026-05-01 story 038 review: rewrote own-projectile reconciliation to use **set-based existence**, not per-projectile position snap by `spawnInputSequence`. Multi-projectile fire patterns — shotgun spread, fragment cascades, scatter — share a single `spawnInputSequence` across every pellet of one fire intent, so the previous "match by sequence" rule collapsed N predicted pellets onto one authoritative position and visually showed one bullet. The new rule keeps every predicted own projectile alive on its locally-computed motion while the authoritative snapshot still carries any projectile with the same sequence, and only removes a predicted projectile when its sequence is acknowledged AND no authoritative projectile with that sequence remains. Predicted positions are not snapped to authoritative positions at all — predicted projectile motion is deterministic given owner position at fire time and fixed spread directions ([CombatSystem](../src/shared/sim/CombatSystem.ts) `aimedSpreadDirections` is RNG-free), so divergence is bounded and acceptable. Server still owns hits, despawn, and lifetime; cosmetic renderer feedback on visual coincidence remains permitted but never despawns the predicted projectile. The predicted-fire-rejected snap window is also clarified: it now uses an EWMA RTT estimate from acknowledged input ages, with the contracted `2 * RTT_estimate + SNAPSHOT_INTERVAL_MS` window bounded `[100 ms, 500 ms]`, instead of the prior `SNAPSHOT_INTERVAL_MS` literal that was removing predicted pellets before any realistic WAN ack could land. Earlier: clarified that online prediction uses a separate `createOnlinePredictionCore` factory in the existing browser worker, built from shared simulation systems rather than the public `createSimulationCore` façade. Clarified PvP slime-form parity: radius/contact/maxHp come from enemy content, while maxSpeed and ordered loadout mirror the host policy constants used by `pvpKillToLevelOps`.)

## Context

Today every action of the local player in an online session travels server-and-back before it shows on screen. The minimum visible delay between input and rendered effect is `RTT/2` (input to server) plus `SNAPSHOT_INTERVAL_MS` (server snapshot cadence per [simulation-timing.md](simulation-timing.md)) plus `RTT/2` (snapshot back to client) — `RTT + ~33 ms` in the best case, more under realistic networks. For fast-paced PvP (036) and competitive-feeling co-op (037) this is felt as input lag and breaks the contract that local play already meets.

Story 034 extracted the simulation runtime into `src/shared/sim/**` so shared systems can run under multiple hosts ([simulation-runtime.md](simulation-runtime.md), [sim-core-interface.md](sim-core-interface.md), [web-stack.md](web-stack.md)). This decision records the contract for running those same systems on the client itself through a non-authoritative predictor: instant input feedback for the local player and the projectiles they fire, with server-authoritative reconciliation against incoming snapshots.

The decision sits inside three pre-existing constraints that it does not relax:

- "Extrapolation forbidden" rule from [simulation-timing.md](simulation-timing.md) — clamp interpolation `alpha` to `[0, 1]`, never project past the latest snapshot. Applies to **other** entities; predicted self-state is not extrapolation, it is replay against authoritative inputs.
- Server stays authoritative for hits, HP, deaths, level changes, projectile lifetime, drops, encounter transitions, boss phase changes — per [simulation-runtime.md](simulation-runtime.md), [online-session-hosting.md](online-session-hosting.md), [runtime-systems.md](runtime-systems.md). The predictor never decides any of these.
- Local play (browser worker authoritative core, [web-stack.md](web-stack.md)) is unchanged. Online-mode prediction reuses the same worker entry through a mode switch, never side-by-side with local-authoritative.

## Decision

### Scope

The client predicts, for the local player only:

- the player's own position via shared `MovementSystem` ticked against the local input stream;
- the spawn of the player's own projectiles via shared `CombatSystem` firing phase — on `fire: start` input, the predictor immediately runs the same firing math the server runs (cooldown gate read from `PlayerSnapshot.weaponHud`, projectile spawned at the muzzle from the predicted player position, initial velocity/direction derived from the latest `aim` command);
- the in-flight motion of own predicted projectiles, again through shared `CombatSystem`, until the authoritative snapshot stops carrying that projectile;
- the application of status effects on the local player to movement speed, by reading `PlayerSnapshot.statusEffects` ([snapshot-shape.md](snapshot-shape.md)) authoritatively from each snapshot and feeding it through `resolveMovementSpeedMultiplier` ([combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)) on the predictor's local Player runtime entity;
- form changes for the local player, applied **reactively** — never derived by the client from local kill attribution. See "Form changes" below.

The client does not predict, by design:

- other players, enemies, bosses, drops, field effects, companions, projectiles owned by anyone other than self — these are rendered through snapshot interpolation per [simulation-timing.md](simulation-timing.md), with no extrapolation;
- hits, damage, HP changes, deaths, level up, drop spawn/pickup, encounter transitions, boss phase changes — server-authoritative; the predictor never publishes any `RuntimeEvent` for these (see "Predictor invariants");
- the **despawn or lifetime end** of own projectiles — the predictor renders the projectile until the authoritative snapshot no longer contains it; despawn is server-driven. This is the standard Source-style guarantee against phantom projectiles;
- collision of own projectiles against other entities — the predictor does not run collision against interpolated others. Cosmetic hit feedback on visual coincidence is allowed as presentation only and must not despawn the predicted projectile (see "Cosmetic hit feedback");
- companion behavior in co-op ([companion-combat.md](companion-combat.md)) — companions stay interpolated from snapshots in 038. A future story may add "companion follows predicted self" if the visible owner-companion lag is judged unacceptable in practice.

### Predictor world view

- The predictor's `EntityStore` contains exactly two kinds of entities: the local Player (one entry) and own in-flight Projectiles (zero or more). No other entities are present in the predictor's runtime state — no enemies, no other players, no drops, no field effects, no companions.
- Movement-affecting status — including consequences of other players' AoE, slime puddle, debuff projectiles — is sourced from `PlayerSnapshot.statusEffects` on each authoritative snapshot, not from running other-entity systems on the client. The predictor reads the resulting status set; it does not reason about source entities.
- Hit determination against other entities is therefore not performed by the predictor at all. This is the "(a) self-only" predictor world chosen explicitly over a full-mirror alternative (which would require sync-from-authoritative for every entity plus read-only invariants on cross-entity systems and was deemed not worth the artifact risk).

### Predictor host placement

- The existing browser simulation worker ([web-stack.md](web-stack.md)) has two **mutually exclusive** modes:
  - **local-authoritative** — current behavior for offline play (campaign, training, dungeon, sandbox). The worker owns a `createSimulationCore` instance; it is the source of truth and runtime events flow out as `SimToMain` events.
  - **online-predictor** — used for online sessions ([online-session-hosting.md](online-session-hosting.md)). The worker owns a separate `createOnlinePredictionCore` instance. That predictor is built from shared systems (`EntityStore`, `RuntimeInputState`, `MovementSystem`, `CombatSystem`, `SpatialIndex`, `SnapshotExportSystem`, and status-effect resolution) but does not expose the public `SimulationCore` façade. Its `EntityStore` is **synced from authoritative snapshots** (self-only, see above) and the buffered local inputs are **replayed** on top.
- At any moment the worker holds at most one runtime instance. Modes never coexist; switching modes is `stop()` on the active runtime followed by a fresh `start(...)` in the new mode. `UiShell` phase transitions ([main-ui-shell.md](main-ui-shell.md)) gate the switch — the same phase machine that already prevents local sessions from running concurrently with online sessions.
- This satisfies the layer rule from [web-stack.md](web-stack.md) that simulation logic lives in the worker and `src/main/**` is integration/UI only. The existing main-side connector at `src/main/sim/SimWorkerHost.ts` is extended to drive the predictor mode without touching the local-authoritative path; the existing local-play tests remain green without modification.
- Cost: the predictor's `EntityStore` contains at most `1 + maxOwnProjectiles` entities, bounded by the local player's weapon throughput. CPU per tick is negligible compared to either the existing browser worker budget for local play or the render frame budget.

### Inputs and the input buffer

- Every `MainToSim.input` envelope and every per-socket online input intent ([input-commands.md](input-commands.md), [online-session-hosting.md](online-session-hosting.md)) carries `inputSequence: number`, monotonically increasing per session, starting at `1`, never decreasing. Sequence resets to `1` on each `startSession` (worker side) or each `core.start(session)` (host side).
- `inputSequence` is owned by the **client side** of the wire (browser main thread on the way to the worker, browser main thread on the way to the Node host). The worker entry tags every outgoing input message with the next sequence number; in online mode, the same number rides on the Node host intent. There is one sequence stream per session per client, regardless of which `kind` of `InputCommand` carries it.
- The client maintains an ordered ring buffer of every `InputCommand` it has sent since the last acknowledged sequence. Each entry records the `InputCommand`, the `inputSequence`, and the predictor `simTime` at which the command was applied locally on the predictor.
- The server (Node arena host, [online-session-hosting.md](online-session-hosting.md)) tracks the **last applied** input sequence per actor and includes it in each authoritative snapshot as the new field `Snapshot.lastInputSequence: { [playerId]: number }` ([snapshot-shape.md](snapshot-shape.md)). The browser worker host (local-authoritative mode) does not produce `lastInputSequence` — its core IS authoritative; reconciliation is a no-op for local play because the predictor mode is not active.
- `inputSequence` is per-command, not per-tick. The current send-on-change protocol from [input-commands.md](input-commands.md) is preserved (`move`/`aim` are state commands sent on change; `fire`/`selectWeaponSlot`/`holsterWeapon` are edge). Replaying per-command requires the predictor to know the `simTime` at which each command became active; the local recorded `simTime` per buffer entry is exactly that.

### Reconciliation: rollback, sync, replay

On receipt of an authoritative snapshot for the active online session, the predictor performs the following steps **before** producing its next predicted snapshot for the renderer:

1. **Roll back** self-Player runtime state to the authoritative `PlayerSnapshot` for `selfPlayerId`. Fields restored: `position` (from `x`, `y`), `hp`, `maxHp`, `state`, `formArchetypeId`, `weaponHud`, `statusEffects`. Implicit fields (`velocity`, `aggroMemory`) are reset to neutral.
2. **Reconcile** self-Projectile runtime state through **set-based existence**, not per-projectile position snap. Build a `Set<number>` of every `spawnInputSequence` carried by `snapshot.entities.filter(e => e.kind === 'projectile' && e.ownerKind === 'player' && e.ownerId === selfEntityId && e.spawnInputSequence !== null)` — a single set, not a `Map<sequence, ProjectileSnapshot>`. For each predicted own projectile in the predictor's `EntityStore`:
   - if its `spawnInputSequence` is in the set → **keep** the projectile, do not touch its position; predicted velocity continues to drive motion;
   - if its `spawnInputSequence` is `null` (a fragment cascaded from a parent, or a non-sequenced spawn path) → **keep** until removed by predictor TTL or an authoritative drop;
   - if its `spawnInputSequence` is `> snapshot.lastInputSequence[selfPlayerId]` (server has not yet acknowledged the originating fire input) → **keep**, the authoritative side has not had a chance to spawn the projectile yet;
   - otherwise (sequence is acknowledged AND not present in the authoritative set) → **remove** via snap. Possible causes are recorded in "Predicted-fire-rejected" below: server cooldown gate, ghost/reviving state, server-confirmed despawn between the previous and current snapshot, or short-TTL grounded-then-expired.

   The set-based rule is the correct shape for multi-projectile fire patterns. Shotgun spread, fragment scatter, and any future pattern that calls `spawnProjectilesForDirections` ([CombatSystem](../src/shared/sim/CombatSystem.ts)) emits N projectiles all sharing one `spawnInputSequence`. A `Map<sequence, ProjectileSnapshot>` would only retain the last entry per sequence and collapse N predicted pellets onto one authoritative position — the visible bug being closed by this rule. Predicted projectile motion is deterministic for a given fire intent because `aimedSpreadDirections` is RNG-free; the only divergence source between predicted and authoritative positions is the predicted-vs-authoritative origin (the player's position at fire time), which is already kept tight by the player's own position prediction. Hits, despawn, and lifetime remain server-authoritative, so the small position drift between predicted and authoritative pellets is purely cosmetic.
3. **Trim** the input buffer of every entry whose `inputSequence <= snapshot.lastInputSequence[selfPlayerId]`.
4. **Replay** the remaining buffered inputs by **catching up the predictor's `simTime` to a wall-clock target**, not by advancing one tick per buffered command. The catch-up target is `snapshot.simTimeMs + (nowWall - snapshotReceivedAtWall)` — i.e., the simTime the server is approximately at right now from the predictor's point of view. The replay loop iterates from `snapshot.simTimeMs` to that target in `SIM_STEP_MS` increments, running shared `MovementSystem` and shared `CombatSystem` for every step. At each step, any buffered command whose `BufferedInput.appliedAtSimTime` matches (or has just passed) the current step's simTime is applied through `applyInputCommand` before that step's `tickSystems()` call. State commands (`move`, `aim`) flow through `RuntimeInputState` and persist across subsequent ticks; edge commands (`fire`, `selectWeaponSlot`, `holsterWeapon`) take effect at the matching tick. The number of intermediate ticks therefore equals the number of `SIM_STEP_MS` steps between `snapshot.simTimeMs` and the wall-clock target — typically `RTT/2 / SIM_STEP_MS`, not the buffer length.
5. **Resume** the predictor's wall-clock pump from the post-replay `simTime`. The pump's `lastWallMs` baseline is **preserved across reconciliation** — the previous behaviour of nulling it produced a one-frame no-op after every snapshot and a visible stutter at the snapshot boundary; with the baseline preserved, the next pump call advances `lagMs` normally from a valid baseline.

Step 4 requires that `BufferedInput` carry the predictor `simTime` at which the command was originally applied locally (`appliedAtSimTime: number`). Without this field, replay cannot correctly place commands on the timeline; the field is stored at `submitInput` time alongside `command` and `inputSequence`.

### Tick alignment

- After every reconciliation, the predictor's `simTime` equals `snapshot.simTimeMs + (replayedTickCount * SIM_STEP_MS)`, where `replayedTickCount` is the number of intermediate steps in the wall-clock catch-up loop (step 4 above). On a steady RTT this approximately equals the simTime the server is at right now: `snapshot.simTimeMs + (nowWall - snapshotReceivedAtWall)`.
- The predictor's wall-clock baseline (`lastWallMs`) is preserved across reconciliation, so subsequent pump ticks advance `simTime` smoothly from the post-replay anchor without an introductory no-op frame.
- Wall-clock drift between predictor and server is corrected on every snapshot by re-anchoring `simTime` to the authoritative value plus the inferred wall-clock-since-receive. The predictor's simTime stays within `RTT/2` of the server's current simTime by construction.
- This rule applies **only** to predictor mode. Local-authoritative mode keeps the existing `simTime` accumulation rules from [simulation-timing.md](simulation-timing.md) unchanged.

### Reconciliation policy: snap-on-event, render-direct otherwise

Reconciliation is **event-triggered** for large transitions; routine motion is rendered **directly** from the predictor's output without any blend layer.

- **Snap** (no blend, abandon previously rendered position/projectile, jump to authoritative result):
  - `RuntimeEvent.playerSpawn` for self ([snapshot-shape.md](snapshot-shape.md)) — covers initial spawn and PvP respawn after a `core.addPlayer` from `pvpKillToLevelOps`.
  - `RuntimeEvent.playerDowned` for self — alive→ghost transition under `lossCondition: 'allPlayersDead'`.
  - `RuntimeEvent.playerRevived` for self — ghost→alive after `playerCoopRevive`.
  - `host:levelUp` for self ([online-session-hosting.md](online-session-hosting.md)) — PvP form change.
  - Any snapshot where `PlayerSnapshot.formArchetypeId` for self changed since the previous snapshot and no `host:levelUp` event accompanied it — defensive against future host policies that mutate form without a host event.
  - Predicted-fire-rejected (see below) — own projectile removed by snap.
- **Render direct** (no blend, no threshold) for routine motion. The renderer reads the predicted self-position straight from the latest predicted snapshot every frame. The wall-clock catch-up replay (step 4) is what keeps the predictor's position close to the server's; that is the only smoothing layer required for self.

This replaces the earlier `0.05 wu` epsilon + `100 ms` blend rule from the original 038 draft. That rule had two failure modes that surfaced under live PvP testing:

- the threshold (`0.05 wu`) was below the per-tick distance at slime speed (`6 wu/s × SIM_STEP_SEC ≈ 0.1 wu`), so blend triggered on every snapshot during routine movement and the rendered slime visibly skidded;
- the blend animation `nowMs` was sourced from `authoritativeSnapshot.simTimeMs`, which only advances when a new snapshot lands, so the blend itself stuttered at the snapshot rate (30 Hz).

A future story may reintroduce a blend layer for very-large-but-not-snap-event corrections (e.g. anti-cheat-driven position rebases or future server-side lag compensation), but it must source `nowMs` from wall-clock and use a threshold high enough to never fire on routine motion (recommended floor: `≥ 1 × per-tick-motion`, i.e. `≥ ~0.15 wu` at current speeds with headroom).

### Predicted-fire-rejected

A predicted own projectile is **server-rejected** when **all three** conditions hold:

- its `spawnInputSequence` is acknowledged (`spawnInputSequence <= snapshot.lastInputSequence[selfPlayerId]`); **and**
- no authoritative `ProjectileSnapshot` for the local actor carries that `spawnInputSequence` in the current snapshot (set-based check from "Reconciliation" step 2); **and**
- the **ack age** is at least `SNAPSHOT_INTERVAL_MS` — i.e. the predictor remembers the wall-clock time at which `spawnInputSequence` was first observed in `lastInputSequence`, and only after one full snapshot interval has elapsed does the projectile become eligible for removal. This bridges the race window where the server fires the projectile **after** the originating snapshot's `simTime` was captured: the server processed the input, advanced `lastInputSequence`, but the projectile had not yet been written into `entities[]` when that snapshot was emitted; it appears in the next snapshot. Removing on the first acknowledging snapshot incorrectly drops a projectile the server actually fired.

On rejection, the predictor removes the projectile from its `EntityStore` and the renderer drops it via snap (no fade, no blend). Reasons the server may reject a fire input are normal operation:

- weapon cooldown was not actually ready on the server at the tick the input applied (predictor's `weaponHud` snapshot was stale by `RTT/2`);
- the actor was in `'ghost'` or `'reviving'` state when the input applied (input-intake filter from [input-commands.md](input-commands.md));
- the actor was within `invulnerableUntilSimMs` (only relevant if a future policy gates fire by invulnerability, currently a no-op);
- the actor was removed from the session between the input being sent and being processed (disconnect or `removePlayer`).

Mispredicted-fire is not logged as an error; it is part of the contract. The acceptance criterion in story 038 covers this case explicitly.

The main thread does not snap out an acknowledged-but-missing predicted fire immediately on the first acknowledging snapshot. The renderer's snap window for predicted-fire-rejected is `2 * rttEstimate + SNAPSHOT_INTERVAL_MS`, where `rttEstimate` is an EWMA over per-input round-trip samples taken at acknowledgement time. Each ack of an originating fire input contributes a sample `rttSample = max(0, nowMs - sentAtMs - SNAPSHOT_INTERVAL_MS)` (subtracting one snapshot interval accounts for the cadence at which the server fans state out) into the EWMA with smoothing factor `α = 0.25`. Until the first sample arrives, the estimate is `null` and the snap window falls back to `2 * SNAPSHOT_INTERVAL_MS + SNAPSHOT_INTERVAL_MS = ~99 ms`, which is the lowest budget the system uses; this is cut close on a high-latency connection but only applies to the first fire in a session before any ack has informed the estimate. Storage and update of `rttEstimate` live in the main-thread online prediction integration ([main-ui-shell.md](main-ui-shell.md)); the worker predictor itself does not need to know the estimate, since reconciliation step 2 above already keeps unacknowledged-and-still-pending projectiles via the `> lastInputSequence` branch. The estimate currently has no hard `[min, max]` bounds — a future refinement (e.g. clamping at `[100 ms, 500 ms]` to defend against a single outlier ack collapsing or stretching the window) is recorded as a known follow-up but is not required by this contract.

### Cosmetic hit feedback

- Renderers consuming the predicted self-projectile stream may render local cosmetic hit effects (impact sparks, slime splash droplets per [impact-feedback.md](impact-feedback.md)) when a predicted own projectile's rendered position visually coincides with the rendered position of an interpolated other entity. This is presentation only.
- The predicted projectile **must not** be despawned by this check; only the visual decoration is added. The authoritative snapshot stream still drives projectile lifetime. If the server later confirms the hit, the same `hit` runtime event fires through the existing channel and the renderer plays its normal feedback there as well — duplicates may occasionally show; this is accepted juice cost in exchange for instant local feel and is preferable to the phantom-projectile artifact that would arise from client-side despawn.
- The cosmetic feedback layer is optional. Renderers that omit it produce correct (if slightly less juicy) behavior. Story 038 does not mandate its delivery; it lifts the prohibition so future presentation work can land it without a contract change.

### Form changes (reactive snap)

- The predictor never attributes a kill or determines a level. Form change is always a **reaction** to one of:
  - `host:levelUp` event for self ([online-session-hosting.md](online-session-hosting.md)) — PvP kill-chain advance.
  - A snapshot's `PlayerSnapshot.formArchetypeId` for self differs from the predictor's current form (defensive path for future mutations not carrying a host event).
- On form change the predictor performs a snap-update of the local Player runtime entity:
  - `formArchetypeId === null` → canonical hero form. Stats (`maxSpeed`, `contactBox`, `maxHp`, default `loadout`) come from the cached `PlayerConfig` stored at join (or from session content on session restart).
  - `formArchetypeId` matching an `EnemyArchetype.id` → slime form. Body/contact/maxHp come from `content/enemies.md` ([content-archetypes.md](content-archetypes.md)); maxSpeed and ordered loadout intentionally mirror the PvP host policy constants `PUBLIC_ARENA_HOST_PLAYER.maxSpeed` and `PUBLIC_ARENA_HOST_LOADOUT`, not the slime's native `maxSpeed`, so prediction stays in parity with `pvpKillToLevelOps`.
  - `formArchetypeId` matching a `BossArchetype.id` → boss form. Stats come from `content/bosses.md`.
  - The actor's loadout for the new form is derived from per-form policy already encoded in shared content (PvP arena: `PUBLIC_ARENA_BOSS_WEAPON_ID` for boss, default ordered loadout for hero), exactly mirroring how the host's `pvpKillToLevelOps` builds the new `PlayerConfig.loadout`.
- The predictor never reads form stats from `PlayerSnapshot.weaponHud` — `weaponHud` is presentation state for the HUD, not authoritative form stats.
- Form change snap also resets the predictor's own in-flight projectiles owned by the previous form: any predicted projectile whose `spawnInputSequence` was issued **before** the snapshot's `simTimeMs - SNAPSHOT_INTERVAL_MS` is dropped (the form change implies the previous weapon is no longer available; the server's projectile lifecycle is authoritative either way).

### Predictor invariants (non-authoritative core)

The predictor must not act as a source of truth. The following are forbidden in predictor mode of the worker, enforced by an automated boundary test (modeled on the test in [simulation-runtime.md](simulation-runtime.md), [testing.md](testing.md), and the existing `server/src/importBoundaries.test.ts`):

- The predictor must not emit `SimToMain` messages of `kind: 'event'` carrying engine event kinds. Specifically: in predictor mode, the worker output stream must not contain `RuntimeEvent` of kind `fire`, `hit`, `explosion`, `death`, `playerSpawn`, `playerDowned`, `playerRevived`, `companionBoop`, `companionDowned`, `companionRescued`, `dropSpawn`, `dropPickup`, `dropExpire`, `bossPhaseChange`, `win`, `loss`, `sessionStart`, `sessionStop`, `pause`, `resume`, `encounterStart`, `encounterEnd`. These events on the online wire come from the **server**, not from the predictor; double-emission would cause double audio/feedback/HUD updates.
- The predictor must not publish HP, death, or level changes outwards in any form that downstream consumers (renderer, HUD, audio) would treat as authoritative. The predictor may compute these locally as inputs to its own snap/blend decisions; those computations must not surface as `SimToMain` events or as fields on a predicted snapshot beyond what the renderer needs for the local player visual (position, formArchetypeId snapped from authoritative).
- The shared sim layer must not import network APIs (`socket.io`, `socket.io-client`, `node:*`, `WebSocket`, `fetch` for protocol use). Already enforced for `src/shared/sim/**` by the 034 boundary test; this decision keeps that test in force and adds explicit checks for the predictor-specific output filter described above.

Allowed and required:

- Run shared `MovementSystem` against self.
- Run shared `CombatSystem` firing/projectile-motion phases for self only (the entity-iteration in those systems naturally collapses to self when the predictor's `EntityStore` contains only self + own projectiles).
- Run shared `StatusEffectSystem.resolveMovementSpeedMultiplier` against the local Player's status effects.
- Produce a **predicted snapshot** (a `Snapshot`-shaped object) the renderer consumes for self-only rendering. This predicted snapshot is local-only — it is not sent to anyone over the wire — and is distinct from the authoritative snapshot stream.

### Renderer composition

- The online renderer ([online-session-hosting.md](online-session-hosting.md), `src/main/online/PublicArenaRenderer.ts` and successors) draws the local player and own in-flight projectiles from the **predicted snapshot**. All other entities (other players, enemies, bosses, drops, field effects, companions, projectiles owned by anyone other than self) are drawn from the **authoritative snapshot pair** with interpolation per [simulation-timing.md](simulation-timing.md). Concretely the renderer keeps `prev` and `curr` authoritative snapshots, computes `renderSimTime = curr.simTimeMs - SNAPSHOT_INTERVAL_MS` and `alpha = clamp01((renderSimTime - prev.simTimeMs) / (curr.simTimeMs - prev.simTimeMs))`, and lerps every non-self entity's position between its `prev` and `curr` representations matched by stable entity `id`. Entities present only in `curr` (newly-spawned) render at `curr` directly; entities present only in `prev` (just despawned) render at `prev` for the lerp window then disappear at the next snapshot. The contract was already implied by [simulation-timing.md](simulation-timing.md) for any renderer; story 039 makes this explicit for the online renderer because the original 038 implementation slammed positions from the latest snapshot only and produced visible 30 Hz stair-step on every non-self entity.
- **Self position is rendered directly from the predicted snapshot** — no blend layer for routine motion, see "Reconciliation policy" above. The predictor produces a fresh predicted snapshot every pump tick (60 Hz) plus one after every reconciliation; the renderer reads the latest each frame and draws self at the predicted `(x, y)` straight.
- **Own-projectile fallback**: when composing the rendered scene, for each own-actor projectile the renderer prefers the predicted-snapshot entry. If no predicted entry exists for an authoritative own projectile (matched by `spawnInputSequence` when present, otherwise by `(ownerId === selfEntityId, ownerKind === 'player')` membership), the renderer **falls back** to the authoritative entry rather than suppressing it. Predicted-when-present, authoritative-when-absent — never both, never neither. The previous "filter all authoritative own projectiles, render only predicted" rule produced "no bullets visible" whenever the predictor's `EntityStore` was momentarily empty for that actor.
- **Co-op online renderer path**: the shared `Renderer` (`src/main/render/Renderer.ts`), used by online co-op campaigns ([main-ui-shell.md](main-ui-shell.md)), accepts an optional `getPredictedSnapshot` accessor. When wired (online sessions), the renderer applies the same self-from-predicted + own-projectile-fallback + non-self-interpolation rules as the PvP renderer. When `null` (local-authoritative play), the renderer's input/output is unchanged. The predictor therefore reaches the renderer for **every** online mode, not only Public Arena PvP.
- Renderers used in local-authoritative mode (single-player campaign/training/dungeon) are not affected; their snapshot pair input and interpolation behaviour are unchanged. The `getPredictedSnapshot` parameter is additive; passing `null` (or omitting it) preserves the existing local-play path bit-for-bit.

## Consequences

- Local input feel matches local play in PvP and co-op regardless of network conditions. Click-to-bullet-visible drops from `RTT + ~50 ms` to one render frame. WASD-to-position drops from `RTT + ~50 ms` to one render frame.
- Code reuse is total: `EntityStore`, `MovementSystem`, `CombatSystem`, `StatusEffectSystem`, `SpatialIndex` all run unmodified on the client predictor. No parallel implementation, no "online vs local" branches in those systems.
- The predictor is non-authoritative by construction. Server-authoritative invariants — no client-side hit decision, no client-side level up, no client-side death, no phantom projectiles — hold by design and are checked by the boundary test.
- Snapshot shape grows by four additive fields, all required:
  - `Snapshot.lastInputSequence: { [playerId]: number }` (top-level);
  - `ProjectileSnapshot.ownerId: number` — the `EntityId` of the projectile's owner; lets the predictor disambiguate "my own projectiles" from any other player's in multi-actor sessions, mirroring `RuntimeEvent.hit.ownerId` semantics;
  - `ProjectileSnapshot.spawnInputSequence: number | null` (`null` for projectiles whose owner is not a connected player or whose origin is not an `inputSequence`-tagged fire intent — slime, boss, fragment cascade);
  - `PlayerSnapshot.statusEffects` — the actor's currently active status effects, in a shape suitable for `resolveMovementSpeedMultiplier` and future presentation. The exact field shape is defined alongside the addition in [snapshot-shape.md](snapshot-shape.md).
- Local single-player consumers must absorb the new fields without regression. Covered by the existing local single-player HUD/render regression suite (in the same place that covered the `weaponHud` migration in 036) plus a new test for `statusEffects` propagation through the snapshot path.
- Phantom-projectile and "I shot first" classes of artifacts are avoided because the predictor predicts spawn and motion only — not hit determination, not despawn.
- Mispredicted fires (rejected by server) snap-out without retry; this is accepted as a small visual glitch on rare contention. The decision documents the trade-off honestly.
- Worker mode switching adds a small amount of plumbing in the worker entry and `SimWorkerHost.ts`. The mutual-exclusion invariant — one core at a time — keeps the runtime simple and removes the "two cores in one worker leak" failure mode.
- Future work that this decision unblocks but does not require: client-side rollback for hit determination (Quake-style despawn-on-predicted-hit with full reconciliation), server-side lag compensation (rewind for hits), per-tick input frame protocol in place of per-command, delta-encoded snapshots, predicted companion AI for self. Each of those is its own decision; this file is not the place to record them.

## Related

- [simulation-runtime.md](simulation-runtime.md)
- [simulation-timing.md](simulation-timing.md)
- [sim-core-interface.md](sim-core-interface.md)
- [snapshot-shape.md](snapshot-shape.md)
- [input-commands.md](input-commands.md)
- [online-session-hosting.md](online-session-hosting.md)
- [runtime-systems.md](runtime-systems.md)
- [thread-model.md](thread-model.md)
- [web-stack.md](web-stack.md)
- [content-archetypes.md](content-archetypes.md)
- [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)
- [companion-combat.md](companion-combat.md)
- [impact-feedback.md](impact-feedback.md)
- [main-ui-shell.md](main-ui-shell.md)
- [testing.md](testing.md)
- [../stories/034-extract-sim-core.md](../stories/034-extract-sim-core.md)
- [../stories/036-node-arena-host.md](../stories/036-node-arena-host.md)
- [../stories/037-coop-vs-slimes.md](../stories/037-coop-vs-slimes.md)
- [../stories/038-online-client-prediction.md](../stories/038-online-client-prediction.md)
- [../stories/039-online-prediction-stabilization.md](../stories/039-online-prediction-stabilization.md)
