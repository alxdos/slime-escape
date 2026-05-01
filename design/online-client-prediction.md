# Online Client-Side Prediction

- Status: accepted
- Created: 2026-05-01
- Updated: 2026-05-01

## Context

Today every action of the local player in an online session travels server-and-back before it shows on screen. The minimum visible delay between input and rendered effect is `RTT/2` (input to server) plus `SNAPSHOT_INTERVAL_MS` (server snapshot cadence per [simulation-timing.md](simulation-timing.md)) plus `RTT/2` (snapshot back to client) — `RTT + ~33 ms` in the best case, more under realistic networks. For fast-paced PvP (036) and competitive-feeling co-op (037) this is felt as input lag and breaks the contract that local play already meets.

Story 034 extracted the simulation runtime into `src/shared/sim/**` so the same core can run under multiple hosts ([simulation-runtime.md](simulation-runtime.md), [sim-core-interface.md](sim-core-interface.md), [web-stack.md](web-stack.md)). This decision records the contract for running that same core on the client itself, as a non-authoritative predictor: instant input feedback for the local player and the projectiles they fire, with server-authoritative reconciliation against incoming snapshots.

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

- The shared `SimulationCore` runs in the existing browser simulation worker ([web-stack.md](web-stack.md)). The worker has two **mutually exclusive** modes:
  - **local-authoritative** — current behavior for offline play (campaign, training, dungeon, sandbox). The core is the source of truth; runtime events flow out as `SimToMain` events.
  - **online-predictor** — used for online sessions ([online-session-hosting.md](online-session-hosting.md)). The core runs the same `SessionDefinition` the server runs, but the predictor's `EntityStore` is **synced from authoritative snapshots** (self-only, see above) and the buffered local inputs are **replayed** on top.
- At any moment the worker holds at most one core instance. Modes never coexist; switching modes is `core.stop()` followed by a fresh `core.start(session)` in the new mode. `UiShell` phase transitions ([main-ui-shell.md](main-ui-shell.md)) gate the switch — the same phase machine that already prevents local sessions from running concurrently with online sessions.
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
2. **Roll back** self-Projectile runtime state. The authoritative set of own projectiles is `snapshot.entities.filter(e => e.kind === 'projectile' && e.ownerKind === 'player' && e.ownerId === selfEntityId)`. Each authoritative own projectile is matched against the predictor's local own projectiles by `ProjectileSnapshot.spawnInputSequence` ([snapshot-shape.md](snapshot-shape.md)) when present; predicted projectiles whose `spawnInputSequence` does not appear in the authoritative set, **and** whose `inputSequence` is `<= snapshot.lastInputSequence[selfPlayerId]`, are removed via snap (server-rejected fire — see "Predicted-fire-rejected" below). Authoritative projectiles whose `spawnInputSequence` is present in the predictor are kept; their `position` is snapped to the authoritative `(x, y)` and the predictor continues from there with its locally-tracked velocity.
3. **Trim** the input buffer of every entry whose `inputSequence <= snapshot.lastInputSequence[selfPlayerId]`.
4. **Replay** the remaining buffered inputs through shared `MovementSystem` and shared `CombatSystem` against the predictor's runtime state. Replay advances the predictor's `simTime` by `SIM_STEP_MS` per replayed tick from `snapshot.simTimeMs`.
5. **Resume** the predictor's wall-clock pump from `simTime = snapshot.simTimeMs + (replayedTickCount * SIM_STEP_MS)`. Subsequent local pump ticks advance `simTime` normally until the next snapshot lands.

Step 4's "remaining buffered inputs" includes both state commands (`move`, `aim`) and edge commands (`fire`, `selectWeaponSlot`, `holsterWeapon`). State commands take effect at the predictor `simTime` at which the original input was applied locally; edge commands fire at that exact `simTime`. The predictor's catch-up loop applies them in order.

### Tick alignment

- After every reconciliation, the predictor's `simTime` equals `snapshot.simTimeMs + (replayedTickCount * SIM_STEP_MS)`. There is no independent wall-clock baseline for the predictor — the latest authoritative snapshot is always the anchor.
- Wall-clock drift between predictor and server is corrected on every snapshot by re-anchoring `simTime` to the authoritative value. The predictor never accumulates more than `SNAPSHOT_INTERVAL_MS + RTT/2` of unanchored ticks before the next snapshot lands.
- This rule applies **only** to predictor mode. Local-authoritative mode keeps the existing `simTime` accumulation rules from [simulation-timing.md](simulation-timing.md) unchanged.

### Reconciliation policy: snap vs blend

Reconciliation is **event-triggered** for large transitions and **threshold-blended** for small drift:

- **Snap** (no blend, abandon previously rendered position/projectile, jump to authoritative result):
  - `RuntimeEvent.playerSpawn` for self ([snapshot-shape.md](snapshot-shape.md)) — covers initial spawn and PvP respawn after a `core.addPlayer` from `pvpKillToLevelOps`.
  - `RuntimeEvent.playerDowned` for self — alive→ghost transition under `lossCondition: 'allPlayersDead'`.
  - `RuntimeEvent.playerRevived` for self — ghost→alive after `playerCoopRevive`.
  - `host:levelUp` for self ([online-session-hosting.md](online-session-hosting.md)) — PvP form change.
  - Any snapshot where `PlayerSnapshot.formArchetypeId` for self changed since the previous snapshot and no `host:levelUp` event accompanied it — defensive against future host policies that mutate form without a host event.
  - Predicted-fire-rejected (see below) — own projectile removed by snap.
- **Blend** (linear position interpolation over a fixed window):
  - When the position delta between the previously rendered self-position and the post-replay predicted self-position exceeds an epsilon and no snap event applies. Blend duration is `100 ms`, fixed. During the blend, the rendered self-position interpolates linearly from the pre-replay rendered position to the running predicted position over the blend window. Inputs continue to advance the predicted position normally during blend; the rendered position is the blended view, not the raw predictor output.
- **No render change** when the position delta is at or below the epsilon — predicted state is treated as confirmed, render keeps using the predictor's output.

The position epsilon is `0.05 wu`. Smaller deltas are within tick rounding noise and not worth the blend cost. Epsilon and blend duration are recorded here as the source of truth; system code must read them as named constants from `src/shared/**` rather than as magic numbers.

### Predicted-fire-rejected

A predicted own projectile is **server-rejected** when:

- its `inputSequence` for the originating `fire` command satisfies `inputSequence <= snapshot.lastInputSequence[selfPlayerId]` (i.e., the server has already applied this input); **and**
- no authoritative `ProjectileSnapshot` in the snapshot's `entities` carries a matching `spawnInputSequence`.

On rejection, the predictor removes the projectile from its `EntityStore` and the renderer drops it via snap (no fade, no blend). Reasons the server may reject a fire input are normal operation:

- weapon cooldown was not actually ready on the server at the tick the input applied (predictor's `weaponHud` snapshot was stale by `RTT/2`);
- the actor was in `'ghost'` or `'reviving'` state when the input applied (input-intake filter from [input-commands.md](input-commands.md));
- the actor was within `invulnerableUntilSimMs` (only relevant if a future policy gates fire by invulnerability, currently a no-op);
- the actor was removed from the session between the input being sent and being processed (disconnect or `removePlayer`).

Mispredicted-fire is not logged as an error; it is part of the contract. The acceptance criterion in story 038 covers this case explicitly.

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
  - `formArchetypeId` matching an `EnemyArchetype.id` → slime form. Stats come from `content/enemies.md` ([content-archetypes.md](content-archetypes.md)).
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

- The online renderer ([online-session-hosting.md](online-session-hosting.md), `src/main/online/PublicArenaRenderer.ts` and successors) draws the local player and own in-flight projectiles from the **predicted snapshot**. All other entities (other players, enemies, bosses, drops, field effects, companions, projectiles owned by anyone other than self) are drawn from the **authoritative snapshot pair** with interpolation per [simulation-timing.md](simulation-timing.md), unchanged.
- The renderer is responsible for the blend window between authoritative-snapped and predicted self-position. Blend state lives in the renderer, not in the predictor — the predictor always produces the latest predicted self-position; the renderer chooses what fraction of the previously rendered position vs the predicted position to display.
- Renderers used in local-authoritative mode (single-player campaign/training/dungeon) are not affected; their snapshot input is unchanged.

## Consequences

- Local input feel matches local play in PvP and co-op regardless of network conditions. Click-to-bullet-visible drops from `RTT + ~50 ms` to one render frame. WASD-to-position drops from `RTT + ~50 ms` to one render frame.
- Code reuse is total: `EntityStore`, `MovementSystem`, `CombatSystem`, `StatusEffectSystem`, `SpatialIndex` all run unmodified on the client predictor. No parallel implementation, no "online vs local" branches in those systems.
- The predictor is non-authoritative by construction. Server-authoritative invariants — no client-side hit decision, no client-side level up, no client-side death, no phantom projectiles — hold by design and are checked by the boundary test.
- Snapshot shape grows by three additive fields, all required:
  - `Snapshot.lastInputSequence: { [playerId]: number }` (top-level);
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
