# Render Pipeline: OffscreenCanvas

- Status: deferred
- Created: 2026-04-19
- Updated: 2026-04-22

## Player-facing

- Sees: visually the same picture as before this story; on supported browsers rendering is noticeably smoother and more stable under load.
- Can do: play on supported browsers with better smoothness without doing anything; on unsupported browsers get a clean fallback to the `001` mode. The resolution chosen in `009` keeps working in both modes.

## Technical

- The story is deferred until a confirmed performance problem appears in the current main-thread render pipeline.
- A render worker based on `OffscreenCanvas` for supported browsers.
- Render backend switching (`main` / `offscreen`) without rewriting the simulation.
- Fallback to the main-thread renderer from `001` when reliable `OffscreenCanvas` support is missing.
- Forwarding the render scale policy from `009` into the render worker.
- Measuring FPS / ms-per-frame in both modes to confirm the win and record it in acceptance.
- Correct render-worker stop/restart on resolution changes and session end.

## Out of scope

- A WebGPU backend.
- Moving the simulation to shared memory / `SharedArrayBuffer`.
- Mobile touch controls and UI adaptation.

## Acceptance

- Feature detection correctly picks offscreen or main backend without errors.
- On a supported browser under load (many enemies/projectiles), FPS / ms-per-frame in offscreen mode is measurably better than in main.
- On an unsupported browser the game starts via the fallback and looks identical.
- Resolution changes from `009` keep working in both backends.
- The simulation (worker, protocol, snapshots) is not rewritten: the difference is in the render layer only.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [ ] | Feature detection and the render backend abstraction | |
| T2 | [ ] | Render worker via `OffscreenCanvas` | |
| T3 | [ ] | Forward render scale from `009` into the render worker | |
| T4 | [ ] | Measure FPS / frame-time and compare modes | |

## Related

- [../design/thread-model.md](../design/thread-model.md)
- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../docs/SCOPE.md](../docs/SCOPE.md)
