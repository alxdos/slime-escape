# Online Prediction Stabilization

- Status: in-progress
- Created: 2026-05-01
- Updated: 2026-05-01 (architect prep T1 landed: stabilization scope decomposed across **renderer composition (PR-A)** and **predictor consistency (PR-B)**. Six contract clarifications/changes recorded in [online-client-prediction.md](../design/online-client-prediction.md): (1) replay catches up by wall-clock target (`BufferedInput` gains `appliedAtSimTime`); (2) `lastWallMs` baseline preserved across reconcile (no lost-frame after snapshot); (3) cooldown preservation `max(authoritative, predictor)` rule on `setPlayerWeaponHud`; (4) self-blend criteria revised — render predicted directly, snap-on-event only, retire the `0.05 wu` epsilon and `100 ms` blend window for routine motion; if any future blend layer is added, animation `nowMs` from wall-clock not `authoritativeSnapshot.simTimeMs`; (5) own-projectile renderer fallback — when predicted has no entry, render authoritative; never both, never neither; (6) `syncOwnProjectiles` ack-window — wait one full `SNAPSHOT_INTERVAL_MS` after sequence ack before removing a predicted projectile that has no authoritative match. [main-ui-shell.md](../design/main-ui-shell.md) extended with the co-op online renderer wiring rule — the shared `Renderer` accepts an optional `getPredictedSnapshot` accessor so co-op's campaign-shape online path reads the predictor's output instead of running it uselessly. Tasks decomposed: T2 PvP renderer interpolation + self-direct + own-projectile fallback, T3 co-op renderer wiring, T4 predictor consistency code, T5 verification under throttled network.)

## Product intent

Story 038 shipped the online client-side prediction infrastructure (predictor in worker, sequence-tracked inputs, authoritative reconciliation, renderer composition). Live PvP testing showed the cybersport-grade UX target ("movement of own player and own bullets feel like local play") is **not** met: the local slime moves jerkily, own projectiles flicker or vanish, other players stair-step at the snapshot rate, and online co-op (story 037) has no prediction at all because the campaign-shape online renderer never reads the predicted snapshot.

Three independent reviews agreed on the failure surface. The simulation core, sequence-tracked input contract, predictor-in-worker mode, and authoritative server policy from 034–038 are **correct**; the gaps are concentrated in the renderer composition layer and in a handful of predictor reconciliation rules that the original 038 contract under-specified or specified wrong.

This story is **stabilization, not redesign**. Closes the gaps so the cybersport-grade UX target from 038 is actually delivered. No host-side changes, no wire-shape changes, no engine changes.

## Player-facing

- Sees: in online PvP (Public Arena), other players' slimes and their bullets render as smoothly as offline single-player — no visible 30 Hz stair-step on remote entities.
- Sees: in online PvP, the local player's own slime moves smoothly under continuous input (e.g., holding W) — no per-snapshot "skid" or visible blend overshoot during normal direction changes.
- Sees: in online PvP, the local player's own bullets are visible from the moment of fire to despawn — no intermediate vanishing frames after firing.
- Sees: in online co-op vs slimes, the local player's slime has the same instant-input feel as in offline play — no full server-round-trip lag.
- Sees: form changes (level up to slime/boss in PvP, ghost / revive in co-op) still snap cleanly, no blend across the teleport.
- Sees: shotgun and other multi-projectile weapons show all pellets, not collapsed onto a single visible bullet.

## Technical

Stabilization fixes recorded in [online-client-prediction.md](../design/online-client-prediction.md) and [main-ui-shell.md](../design/main-ui-shell.md). Two clusters:

**PR-A — Presentation/reconciliation layer**:

- The PvP online renderer (`src/main/online/PublicArenaRenderer.ts`) accepts a `SnapshotPair` (prev + curr) via a `getSnapshotPair` accessor and interpolates every non-self entity per [simulation-timing.md](../design/simulation-timing.md): `renderSimTime = curr.simTimeMs - SNAPSHOT_INTERVAL_MS`, `alpha = clamp01((renderSimTime - prev.simTimeMs) / (curr.simTimeMs - prev.simTimeMs))`, lerp by stable entity `id`. Self entity and own projectiles continue from the predicted snapshot.
- Self position renders **directly** from the predicted snapshot every frame — no blend layer for routine motion, no `0.05 wu` epsilon test. The wall-clock-catch-up replay (PR-B) is the only smoothing mechanism for self.
- Own-projectile fallback: when the predicted snapshot does not contain a corresponding self-projectile (predictor's `EntityStore` momentarily empty, or predicted-fire-rejected snap-out completed but server still has the projectile), the renderer falls back to the authoritative entry. Predicted-when-present, authoritative-when-absent — never both, never neither.
- The shared `Renderer` (`src/main/render/Renderer.ts`) gains an optional `getPredictedSnapshot` accessor. `UiShell.ensureOnlineCampaignRenderer` wires it through for online co-op; local-session renderer creation passes `null` (or omits). Co-op self-prediction therefore reaches the renderer instead of running uselessly in the worker.

**PR-B — Predictor consistency**:

- `BufferedInput` gains `appliedAtSimTime: number` recorded at `submitInput` time.
- `replayBufferedInputs` rewrites: catches up the predictor's `simTime` from `snapshot.simTimeMs` to a wall-clock target (`snapshot.simTimeMs + (nowWall - snapshotReceivedAtWall)`), running shared `MovementSystem` and `CombatSystem` for every intermediate step. Buffered commands are applied at their `appliedAtSimTime`. The previous "one tick per buffered command" produced systematic motion underestimation for held state commands.
- `receiveAuthoritativeSnapshot` no longer nulls the predictor's `lastWallMs`; the next pump call advances normally instead of no-op'ing for one frame.
- `setPlayerWeaponHud` uses `max(authoritative.cooldownReadyAtSimMs, predictor.nextFireSimMs)` so a stale snapshot cannot reset a locally-advanced cooldown.
- `syncOwnProjectiles` waits one full `SNAPSHOT_INTERVAL_MS` after a sequence is acknowledged before removing a predicted projectile with no authoritative match. This bridges the race window where the server fires the projectile after the originating snapshot's `simTime` was captured.

Server-side code (`server/src/online-host/**`) is not touched. Wire shape unchanged. No engine changes.

## Out of scope

- Re-architecting the simulation core, predictor world view, sequence ownership, snapshot extensions, or input contract from 034–038 — all stand.
- Server-side changes (host policy, snapshot fanout, input intake) — none.
- Wire shape changes — none. Existing `Snapshot` / `RuntimeEvent` / `host:*` envelope unchanged.
- Snapshot delta encoding or transport optimization.
- Companion prediction (companions stay snapshot-interpolated).
- Hit-determination prediction, despawn prediction, server-side lag compensation.
- Local single-player play — unchanged. The only change in `Renderer.ts` is an additive optional `getPredictedSnapshot` parameter that local play passes as `null`.
- Per-tick "input frame" protocol in place of per-command — stabilization keeps per-command.
- Quake-style rollback for hit determination, RTT bounds clamping — both stay deferred.

## Acceptance

- In online PvP (Public Arena), other players' slimes, enemies, bosses, drops, and other players' projectiles render with smooth interpolation between snapshots; visual smoothness equals offline single-player. Verified under simulated `100 ms` and `200 ms` RTT.
- In online PvP, the local player's slime moves smoothly under continuous input (held W, held W+A, etc.) without visible per-snapshot skid or jerk.
- In online PvP, the local player's own bullets are visible from the moment of fire to despawn for both single-shot and multi-projectile (shotgun spread) weapons. Verified under throttled network.
- In online co-op vs slimes, the local player's slime has instant-input feel matching offline play. The `Renderer` reads the predicted snapshot via `getPredictedSnapshot`; predictor's output is no longer dropped on the floor.
- All transition events (`playerSpawn`, `playerDowned`, `playerRevived`, `host:levelUp`, `formArchetypeId` change) still snap cleanly.
- Existing tests pass without behavioral regression. New regression tests cover: non-self interpolation correctness (two snapshots with projectile at `(0,0)` → `(10,0)` give `(5,0)` at `alpha = 0.5`); replay catch-up by wall-clock (held W for 200 ms produces ~12 ticks of replayed motion, not 1); cooldown preserved across snapshot when predictor has fired more recently than server; predicted projectile not removed in race window; own-projectile fallback when predicted absent.
- Predictor non-authoritative boundary test still passes (no `RuntimeEvent` of engine kinds emitted from predictor mode).

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Architectural PR. Updates [online-client-prediction.md](../design/online-client-prediction.md) with the six clarifications/changes (replay-by-wall-clock with `BufferedInput.appliedAtSimTime`; `lastWallMs` preserved across reconcile; cooldown max-rule; self-blend retired for routine motion; own-projectile renderer fallback; ack-window-before-removal). Updates [main-ui-shell.md](../design/main-ui-shell.md) with the co-op renderer wiring rule (shared `Renderer` accepts `getPredictedSnapshot`). Story 038 `Related` extended to point at 039. [stories/README.md](README.md) table extended. | Architectural PR, no code. |
| T2 | [ ] | Code PR-A part 1: PvP renderer composition. `PublicArenaRenderer` accepts `SnapshotPair` via `getSnapshotPair`, interpolates every non-self entity per `simulation-timing.md`. Removes the `0.05 wu` epsilon blend layer for routine self motion — render predicted self position directly from `predictedSnapshot.entities[selfPlayerId]`. Adds own-projectile fallback path: when no predicted entry matches an authoritative own projectile (`spawnInputSequence` or `(ownerId, ownerKind === 'player')` lookup), render authoritative. Tests: two-snapshot interpolation correctness, no-blend-on-routine-self, own-projectile fallback when predicted empty, snap-on-transition still works. | Code PR, depends on T1. |
| T3 | [ ] | Code PR-A part 2: co-op renderer wiring. The shared `Renderer` (`src/main/render/Renderer.ts`) gains an optional `getPredictedSnapshot` accessor. `UiShell.ensureOnlineCampaignRenderer` wires the predicted accessor through; local-session renderer creation paths pass `null` (or omit). The renderer's self-from-predicted + own-projectile-fallback rules apply when `getPredictedSnapshot` is non-null. Tests: co-op online renders self from predicted snapshot, local single-player path bit-for-bit unchanged. | Code PR, depends on T2. |
| T4 | [ ] | Code PR-B: predictor consistency. `BufferedInput` gains `appliedAtSimTime`. `replayBufferedInputs` rewrites to catch up by wall-clock target with intermediate ticks. `receiveAuthoritativeSnapshot` keeps `lastWallMs` across reconcile. `setPlayerWeaponHud` uses `max` rule for `nextFireSimMs`. `syncOwnProjectiles` retains a sequence-acknowledged-but-missing predicted projectile until ack age exceeds `SNAPSHOT_INTERVAL_MS`. Tests: held W for 200 ms replays ~12 ticks of motion; cooldown not regressed by stale snapshot when predictor advanced cooldown locally; predicted projectile survives the first acknowledging snapshot when authoritative entry has not yet been fanned. | Code PR, depends on T1. May land in parallel with T2/T3. |
| T5 | [ ] | Verify. Run automated checks (root + server typecheck/tests/build, content drift, sim import-boundary, predictor non-authoritative boundary). Request live online verification: PvP single-shot smoothness, PvP shotgun multi-pellet visibility, PvP held-W direction-change smoothness, co-op self-prediction working, all non-self entities smooth — under simulated `100 ms` and `200 ms` RTT throttle. | Depends on T2, T3, T4. |

## Related

- [034-extract-sim-core.md](034-extract-sim-core.md)
- [035-multi-actor-sessions.md](035-multi-actor-sessions.md)
- [036-node-arena-host.md](036-node-arena-host.md)
- [037-coop-vs-slimes.md](037-coop-vs-slimes.md)
- [038-online-client-prediction.md](038-online-client-prediction.md)
- [../design/online-client-prediction.md](../design/online-client-prediction.md)
- [../design/simulation-timing.md](../design/simulation-timing.md)
- [../design/main-ui-shell.md](../design/main-ui-shell.md)
- [../design/snapshot-shape.md](../design/snapshot-shape.md)
- [../design/sim-core-interface.md](../design/sim-core-interface.md)
- [../design/online-session-hosting.md](../design/online-session-hosting.md)
- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/testing.md](../design/testing.md)
