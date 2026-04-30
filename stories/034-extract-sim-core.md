# Extract Simulation Core From Worker Host

- Status: in-progress
- Created: 2026-04-30
- Updated: 2026-04-30 (architect prep: recorded the host interface in [sim-core-interface.md](../design/sim-core-interface.md), the clock split in [simulation-timing.md](../design/simulation-timing.md), and the new layer reservation in [web-stack.md](../design/web-stack.md); refined Technical / Tasks / Related to match; moved Status to `in-progress` per the architect skill's `planned → in-progress` rule, since T1 (architectural PR) is the first task of this story.)

## Product intent

Per [simulation-runtime.md](../design/simulation-runtime.md), the simulation runtime must live as a host-agnostic shared core so the same code runs under both the browser worker (for local play) and a future Node arena host (for online modes). Today `src/sim/worker.ts` mixes two concerns in one file: gameplay systems plus tick orchestration on one side, and `self.postMessage`/`self.addEventListener` worker plumbing on the other. This story does the mechanical extraction: split core (systems + tick) from host (worker plumbing), preserve all current local-play behavior bit-for-bit, no online or multi-actor work yet.

## Player-facing

- Sees: no change. Local campaign, training, dungeon, and the existing online Public Arena continue to behave identically. This is internal preparation for upcoming online modes.

## Technical

Pure refactor against three architectural decisions recorded together with this story:

- target layer split is fixed in [web-stack.md](../design/web-stack.md): the shared simulation core lives at `src/shared/sim/**`; `src/sim/**` is reserved for the browser worker entry plumbing only (no systems, no tick orchestration, only port wiring and the wall-clock pump);
- the public façade between the core and any host (`createSimulationCore`, input methods, output ports, lifecycle, what stays internal) is recorded in [sim-core-interface.md](../design/sim-core-interface.md). `submitInput(command)` is shipped single-actor in this story; multi-actor extension is the responsibility of story 035;
- `SimulationClock` is split per [simulation-timing.md](../design/simulation-timing.md): the catch-up loop, `simTime` accumulation, and idle/running/pause state stay in the core; the host owns the wall-clock pump (`setInterval` + `performance.now()`) and calls `core.pump(nowMs)`. None of the existing timing invariants change.

Mechanically: every system file in `src/sim/**` and its tests move to `src/shared/sim/**`. The orchestration that today lives in `src/sim/worker.ts` (system construction, death-hook wiring, session-lifecycle hooks, per-tick update order, snapshot/event emission) moves into the core's `createSimulationCore` factory. The browser worker entry stays at `src/sim/worker.ts` and shrinks to roughly: construct the core with `onSnapshot`/`onEvent` callbacks that `self.postMessage`, register `self.addEventListener('message', ...)` to dispatch into the core's input methods, and run a `setInterval` that calls `core.pump(performance.now())`. A static check verifies the core has no host-specific globals or imports. No behavioral changes to local play.

## Out of scope

- Any change to system contracts, tick order, snapshot shape, or runtime events.
- Multi-actor sessions — single player is preserved exactly.
- Node arena host — this story does not introduce server-side simulation.
- `server/src/arenaSimulation.ts` is untouched.
- Any change to local play behavior, performance, or rendering.

## Acceptance

- Local single-player campaign, training, and dungeon sessions play through end-to-end without behavioral regression.
- Existing automated tests in `src/sim/**` (and main integration tests) pass without changes to their behavioral assertions; only import paths change.
- The browser worker entry (`src/sim/worker.ts`) imports only the public façade returned by `createSimulationCore` from `src/shared/sim/**` plus the shared protocol/event types from `src/shared/**`; no system internals leak into the host.
- The core (`src/shared/sim/**`) has no references to `self`, `postMessage`, `Worker`, `setInterval`, `setTimeout`, `performance.now`, `addEventListener`, browser globals, Node globals, or host-specific packages such as `node:*` or `socket.io`. This is verified by an automated test in the shape of `server/src/importBoundaries.test.ts`.
- The design layer reflects the new structure: [web-stack.md](../design/web-stack.md) records the layer split and the host-agnostic rule for `src/shared/sim/**`; [sim-core-interface.md](../design/sim-core-interface.md) records the host interface; [simulation-timing.md](../design/simulation-timing.md) records the clock split; [simulation-runtime.md](../design/simulation-runtime.md) no longer carries the misleading "Lives under `src/main/**`" wording.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Architectural PR: record the shared sim core layer reservation in [web-stack.md](../design/web-stack.md), the host interface in new [sim-core-interface.md](../design/sim-core-interface.md), and the clock stepping/pumping split in [simulation-timing.md](../design/simulation-timing.md). Correct the misleading "Lives under `src/main/**`" wording in [simulation-runtime.md](../design/simulation-runtime.md). Update [design/README.md](../design/README.md) index. | Architectural PR, no code. |
| T2 | [x] | Split `SimulationClock` into a host-agnostic stepper (catch-up loop, `simTime` accumulator, idle/running/pause state) that lives in the shared core and a tiny host driver that owns `setInterval` + `performance.now()` and calls `core.pump(nowMs)`. Update existing `SimulationClock` tests so the stepper is exercised without fake timers and the host pump is exercised with them. | Code PR, depends on T1. |
| T3 | [x] | Move every system file from `src/sim/**` (and its tests) to `src/shared/sim/**`: `EntityStore`, `SpatialIndex`, `MovementSystem`, `CompanionSystem`, `CombatSystem`, `HealthDeathSystem`, `SpawnSystem`, `ZoneSystem`, `FieldEffectSystem`, `StatusEffectSystem`, `DropSystem`, `BossPhaseSystem`, `RunSummaryTracker`, `RetaliationSystem`, `SessionFlowSystem`, `SnapshotExportSystem`, `RuntimeInputState`, `DamageRules`, `testSessionResultSummary`, and the integration tests. No behavioral changes; only file paths and import paths change. | Code PR, depends on T2. |
| T4 | [x] | Implement `createSimulationCore` in `src/shared/sim/**` as the public façade per [sim-core-interface.md](../design/sim-core-interface.md): construct systems, wire internal hooks (death hooks, session/encounter callbacks, retaliation hooks, run-summary hookup, RNG bootstrap), expose `start` / `stop` / `pause` / `resume` / `submitInput(command)` / `pump(nowMs)`, and accept `{ onSnapshot, onEvent }` at construction. Move all of today's `worker.ts` orchestration into this factory. | Code PR, depends on T3. |
| T5 | [ ] | Reduce `src/sim/worker.ts` to a thin host wrapper: construct the core once at module load with `self.postMessage`-backed callbacks, dispatch `self.addEventListener('message', ...)` into the core's input methods, run a single `setInterval(() => core.pump(performance.now()), SIM_STEP_MS)`. Confirm `src/sim/**` contains nothing else; main-side connector at `src/main/sim/SimWorkerHost.ts` and its tests stay unchanged. | Code PR, depends on T4. |
| T6 | [ ] | Add an automated boundary test (modeled on `server/src/importBoundaries.test.ts`) that scans `src/shared/sim/**` and fails on `self.`, `postMessage`, `Worker`, `setInterval`, `setTimeout`, `performance.now`, `performance.timeOrigin`, `addEventListener`, `globalThis`, `window.`, `document.`, and on imports of host-specific packages (`node:*`, `socket.io`, `socket.io-client`, browser-only modules). | Code PR, may land with T5. |
| T7 | [ ] | Update import paths in any consumer of `src/sim/**` outside the worker entry. Today this is limited to test files; the existing `src/main/sim/SimWorkerHost.ts` keeps its `new Worker(new URL('../../sim/worker.ts', import.meta.url))`. Ensure the server boundary test in `server/src/importBoundaries.test.ts` still passes unchanged (server is not allowed to import `src/sim/**`, but is allowed to import `src/shared/sim/**` once it exists; that ability is exercised by story 036, not here). | Code PR, depends on T5. |
| T8 | [ ] | Run automated checks: root typecheck, root tests (sim systems + main integration), root build, server typecheck and tests, content drift check. Fix only import paths and the new boundary test; no behavioral changes. | Depends on T7. |
| T9 | [ ] | Manual smoke check: campaign, training, and dungeon each play through one wave/encounter without regression. Public Arena online flow is left untouched and is expected to keep behaving as today. | Depends on T8. |

## Related

- [simulation-runtime.md](../design/simulation-runtime.md)
- [sim-core-interface.md](../design/sim-core-interface.md)
- [thread-model.md](../design/thread-model.md)
- [runtime-systems.md](../design/runtime-systems.md)
- [web-stack.md](../design/web-stack.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [simulation-timing.md](../design/simulation-timing.md)
- [input-commands.md](../design/input-commands.md)
- [session-definition.md](../design/session-definition.md)
- [rng.md](../design/rng.md)
- [035-multi-actor-sessions.md](035-multi-actor-sessions.md)
- [036-node-arena-host.md](036-node-arena-host.md)
- [038-online-client-prediction.md](038-online-client-prediction.md)
