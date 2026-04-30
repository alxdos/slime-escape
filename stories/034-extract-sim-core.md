# Extract Simulation Core From Worker Host

- Status: planned
- Created: 2026-04-30
- Updated: 2026-04-30

## Product intent

Per [simulation-runtime.md](../design/simulation-runtime.md), the simulation runtime must live as a host-agnostic shared core so the same code runs under both the browser worker (for local play) and a future Node arena host (for online modes). Today `src/sim/worker.ts` mixes two concerns in one file: gameplay systems plus tick orchestration on one side, and `self.postMessage`/`self.addEventListener` worker plumbing on the other. This story does the mechanical extraction: split core (systems + tick) from host (worker plumbing), preserve all current local-play behavior bit-for-bit, no online or multi-actor work yet.

## Player-facing

- Sees: no change. Local campaign, training, dungeon, and the existing online Public Arena continue to behave identically. This is internal preparation for upcoming online modes.

## Technical

Pure refactor. Move host-agnostic systems and the tick orchestration out of `src/sim/**` into the shared layer so a Node host can import them later. The browser worker becomes a thin wrapper over the shared core: it owns only `self`-based message intake, host-side construction of the core, posting snapshots/events out. No system implementations or tick-order code lives in the host. The core has no references to `self`, `postMessage`, `Worker`, browser globals, or any other host-specific API. The exact target path of the shared layer (`src/shared/sim/**` is the working assumption) is finalized in the architectural task.

## Out of scope

- Any change to system contracts, tick order, snapshot shape, or runtime events.
- Multi-actor sessions — single player is preserved exactly.
- Node arena host — this story does not introduce server-side simulation.
- `server/src/arenaSimulation.ts` is untouched.
- Any change to local play behavior, performance, or rendering.

## Acceptance

- Local single-player campaign, training, and dungeon sessions play through end-to-end without behavioral regression.
- Existing automated tests in `src/sim/**` (and main integration tests) pass without changes to their behavioral assertions; only import paths change.
- The host file (browser worker entry) imports only the public API of the core; no system internals leak into the host.
- The core has no references to `self`, `postMessage`, `Worker`, browser globals, or worker-only APIs (verified by static check or test).
- `design/web-stack.md` records the new layer split (shared sim layer location, browser worker host location, import-direction rules).

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [ ] | Update [web-stack.md](../design/web-stack.md) (and any adjacent layer-rule files) to record the shared sim core location, the browser worker host location, and the rule that the core has no host-specific dependencies. | Architectural PR. |
| T2 | [ ] | Move all systems and tick orchestration from `src/sim/**` into the shared sim core location agreed in T1. Leave only host plumbing in the browser-side entry. | Code PR. |
| T3 | [ ] | Update imports across `src/main/**`, tests, and any other consumers; ensure the browser worker host file is the only place that touches `self`-based APIs. | Code PR. |
| T4 | [ ] | Run all existing sim and main integration tests; fix only import paths, no behavioral changes. Run typecheck and build. | |
| T5 | [ ] | Manual smoke check: campaign, training, and dungeon play through one wave/encounter each without regression. | |

## Related

- [simulation-runtime.md](../design/simulation-runtime.md)
- [thread-model.md](../design/thread-model.md)
- [runtime-systems.md](../design/runtime-systems.md)
- [web-stack.md](../design/web-stack.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [simulation-timing.md](../design/simulation-timing.md)
