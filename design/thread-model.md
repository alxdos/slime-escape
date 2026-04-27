# Thread Model

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-19 (moved per-kind snapshot fields and combat-event shapes into `snapshot-shape.md`)

## Context

The game must run on the web without blocking UI or rendering, while still aiming for smooth output on `90-120 Hz` displays. It also needs a reliable path for `mobile Safari`, where the architecture cannot depend on one worker-render mode only.

## Decision

- `main thread` owns:
  - browser lifecycle;
  - player input;
  - HUD, menus, and other DOM/UI;
  - audio;
  - feature detection;
  - worker startup and shutdown.
- `simulation worker` is the authoritative source of game state.
- The `simulation worker` contains:
  - the fixed simulation tick;
  - AI;
  - spawning;
  - damage and death;
  - collisions;
  - encounter transitions;
  - boss logic;
  - snapshot generation for rendering.
- Rendering must support two backend modes:
  - compatible mode: `three.js` on the `main thread`;
  - accelerated mode: `three.js` in a dedicated render worker through `OffscreenCanvas`, only where this is stable.
- Rendering does not make gameplay decisions and does not mutate authoritative state.
- Communication between `main thread` and `simulation worker` is built from commands, snapshots, and runtime events.
- Minimal `main -> sim` contract:
  - `startSession(SessionDefinition)` — typed; the `session` field has the full shape from [session-definition.md](session-definition.md), not `unknown`;
  - `stopSession`;
  - `pause`;
  - `resume`;
  - player input commands — the typed union from [input-commands.md](input-commands.md);
  - optional debug commands.
- Minimal `sim -> main/render` contract:
  - `state snapshot` for periodic world state;
  - `runtime events` for point-in-time facts;
  - `telemetry` and debug metrics.
- Snapshots are used for periodic state consumed by rendering and HUD. At minimum they must cover:
  - the list of visible runtime objects for rendering;
  - position and orientation data;
  - zone data and the current encounter;
  - run-level HUD aggregates: HP, wave progress, boss state.
- Every entity in a snapshot must carry a stable `kind` discriminator (for example `'player'`, and later `'enemy'`, `'projectile'`, `'drop'` as systems appear). Render and HUD choose visualization by `kind`, not by `id` or list order. Per-kind entity fields and combat runtime event shapes (`fire`/`hit`/`death`) are formalized in [snapshot-shape.md](snapshot-shape.md); extensions go there as well, not into local system code.
- Immutable session configuration (including `arena`) is **not duplicated** in every snapshot: `main` already owns the `SessionDefinition`, because it built it and passed it into `startSession`. `Renderer` and UI read `arena`, `player.position`, and similar data directly from that `SessionDefinition`; snapshots carry only mutable state.
- Runtime events are used for point-in-time facts that should not reconstruct the whole world. At minimum:
  - fire;
  - hit;
  - death;
  - drop pickup;
  - start/end encounter;
  - pause/resume;
  - win/loss.
- HUD and audio must not reconstruct authoritative state from the event stream alone; they rely on snapshots and use events as reaction triggers.
- If the event stream is overloaded, snapshot and game-state correctness keep priority; telemetry and low-priority debug events may degrade or be dropped.
- Simulation runs on a fixed tick; rendering runs on an independent frame loop with interpolation between the latest snapshots.
- Design the cross-thread API so the render backend can be changed without rewriting simulation.
- Thread lifecycle:
  - `main thread` creates the `simulation worker` at app startup;
  - render backend initializes separately and may be recreated without recreating simulation;
  - ending a session must not require a full page reload;
  - changing render backend must not change the `simulation worker` contract;
  - one `simulation worker` instance serves the whole app lifetime and is reused across sessions; `stopSession` must not call `worker.terminate()` and create a new worker. Full state (`runtime state`, input state, active session) is reset inside the worker by the `stopSession` contract.
- Feature detection determines platform capabilities: `Worker`, `OffscreenCanvas`, browser limitations, and baseline canvas/render behavior.
- Render backend policy decides which backend to use for the current run, based on support and practical reliability.
- Backend policy must not assume that `OffscreenCanvas` is always faster. The accelerated backend is allowed only as the preferred path where it is supported and does not break correctness.

## Consequences

- Long-running logic and AI spikes should not directly block UI or input.
- Browsers without a reliable `OffscreenCanvas` pipeline get a fallback path.
- Rendering and simulation can be optimized independently.
- We need to define a compact snapshot format and explicit inter-thread message protocol up front.
- HUD, audio, and render-backend stories must rely on the shared message contract instead of defining it locally.

## Related

- [session-definition.md](session-definition.md)
- [runtime-systems.md](runtime-systems.md)
- [content-boundaries.md](content-boundaries.md)
- [input-commands.md](input-commands.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [snapshot-shape.md](snapshot-shape.md)
