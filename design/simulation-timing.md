# Simulation Timing

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-19

## Context

[thread-model.md](thread-model.md) defines only the principle of "fixed simulation tick plus independent rendering with interpolation between snapshots"; it does not define concrete frequencies, extrapolation rules, or time behavior during pause. Without an explicit contract, every story (HUD, audio, render backend, bosses) would reopen the same question and diverge in implementation. This decision sets shared numeric contracts for the simulation tick, snapshot frequency, and render interpolation.

## Decision

- `SimulationClock` ticks at a fixed step of `1000 / 60` ms (`SIM_HZ = 60`, `SIM_STEP_MS = 1000 / SIM_HZ`).
- Inside `SimulationClock`, use a catch-up time accumulator:
  ```ts
  while (lag >= SIM_STEP_MS) { tick(); lag -= SIM_STEP_MS; }
  ```
  This is resilient to worker timer jitter (`setInterval`/`setTimeout` may fire unevenly).
- `SnapshotExportSystem` publishes a snapshot every `2` ticks, i.e. at `SNAPSHOT_HZ = 30`, with `SNAPSHOT_INTERVAL_MS = 1000 / SNAPSHOT_HZ ≈ 33.333` ms.
- Every snapshot carries `simTime`: monotonic simulation time in milliseconds since simulation start, computed only from the number of completed ticks.
- Rendering keeps at least the two latest snapshots (`prev`, `curr`).
- Rendering intentionally lags behind `latestSimTime` by exactly `SNAPSHOT_INTERVAL_MS`:
  ```ts
  const renderSimTime = latestSimTime - SNAPSHOT_INTERVAL_MS;
  const alpha = (renderSimTime - prev.simTime) / (curr.simTime - prev.simTime);
  ```
  Clamp `alpha` to `[0, 1]`; extrapolation is forbidden.
- If the buffer does not yet contain two valid snapshots, or if `renderSimTime` goes beyond `curr.simTime`, rendering shows the `curr` position without extrapolation.
- On `pause`, simulation stops advancing `simTime` and stops publishing new snapshots. Rendering continues to draw the last interpolated state and does not move forward in simulation time.
- On `resume`, `SimulationClock` does **not** catch up lost wall-clock time; simulation time advances only through new ticks after resume. This preserves determinism by tick count and avoids a jump on resume.
- All runtime systems use `SIM_STEP_MS` as the only time step; any `dt` field in system code equals `SIM_STEP_MS`, and variable steps are not allowed.
- Numeric constants (`SIM_HZ`, `SIM_STEP_MS`, `SNAPSHOT_HZ`, `SNAPSHOT_INTERVAL_MS`) live in `src/shared/**` (see [web-stack.md](web-stack.md)) and are reused by both main and worker.
- Changing `SIM_HZ` or `SNAPSHOT_HZ` is a change to this design decision, not a local edit; such changes require updating this file and bumping `Updated`.

## Consequences

- Future HUD, audio, and render systems can rely on stable `SIM_STEP_MS` and `SNAPSHOT_INTERVAL_MS` without reopening timing.
- Forbidding extrapolation simplifies rendering and removes artifacts where a character jumps forward when a snapshot is lost.
- Pause/resume without catch-up makes the session reproducible by tick count and compatible with the future `seed` contract from [session-definition.md](session-definition.md).
- Magic numbers such as `60`/`30`/`33` in system code are now bugs; they must be replaced with imported constants from `src/shared/**`.
- Any move to a dynamic simulation step requires revisiting this decision and likely revisiting HUD/render contracts.

## Related

- [thread-model.md](thread-model.md)
- [runtime-systems.md](runtime-systems.md)
- [web-stack.md](web-stack.md)
- [session-definition.md](session-definition.md)
