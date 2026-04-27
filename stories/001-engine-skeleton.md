# Engine Skeleton

- Status: done
- Created: 2026-04-19
- Updated: 2026-04-19

## Player-facing

- Sees: a page open in the browser with a test object moving smoothly across the scene; an FPS indicator in the corner.
- Can do: pause and resume, and see that motion actually stops and starts again.

## Technical

- Web build and the HTML entry point; the stack and source layout are fixed in [../design/web-stack.md](../design/web-stack.md).
- `three.js` renders an empty scene on the `main thread`.
- A `simulation worker` with a fixed `SimulationClock`, tick, and pause/resume; the exact rates and interpolation rules live in [../design/simulation-timing.md](../design/simulation-timing.md).
- A message protocol between `main ↔ simulation worker`: commands and snapshots.
- A minimal `SnapshotExportSystem`: the test object's position in the snapshot.
- Interpolation between the two latest snapshots on the renderer side.
- Feature detection (for the future offscreen path in `010`).

## Out of scope

- Player, input, combat, enemies, sessions, menu, audio.
- `OffscreenCanvas` render worker — a separate story `010`.
- Any physics or collisions.

## Acceptance

- The page opens without console errors.
- One test object is visible on the scene, moving at a steady speed.
- Motion stays smooth across screens with different FPS (visually no stutter).
- Pause stops motion, resume continues from the same spot.
- The current FPS is visible in the corner.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Lock down `design/web-stack.md` (Vite + TS + npm, `src/main`/`src/sim`/`src/shared` layout, import rules) | plan: `design-web-stack` |
| T2 | [x] | Lock down `design/simulation-timing.md` (`SIM_HZ=60`, `SNAPSHOT_HZ=30`, interpolation and pause/resume rules) | plan: `design-sim-timing` |
| T3 | [x] | Update `design/README.md` Index and the story `Related` list to match the new decisions | plan: `design-index` |
| T4 | [x] | Project skeleton (Vite + TS + npm, `index.html`, an empty `three.js` scene in `main`, `featureDetection`, `src/shared/timing.ts` with constants) | plan: `scaffold` |
| T5 | [x] | `simulation worker`: `SimulationClock` 60 Hz, world with `testEntity`, pause/resume, protocol in `src/shared` | plan: `sim-worker` |
| T6 | [x] | `SnapshotExportSystem` 30 Hz and snapshot publishing to main | plan: `snapshot-export` |
| T7 | [x] | `Renderer`: 2-snapshot buffer, position interpolation with a `SNAPSHOT_INTERVAL_MS` delay | plan: `render-interp` |
| T8 | [x] | `FpsOverlay` + hotkey `Space` for pause/resume + acceptance check | plan: `fps-pause` |
| T9 | [x] | Move the story to `done`, update `stories/README.md`, add a How to run section to the root README | plan: `story-status` |

## Related

- [../design/thread-model.md](../design/thread-model.md)
- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/simulation-timing.md](../design/simulation-timing.md)
- [../docs/SCOPE.md](../docs/SCOPE.md)
