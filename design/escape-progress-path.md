# Escape Progress Path

- Status: accepted
- Created: 2026-04-26
- Updated: 2026-04-28 (story 028 prep: Escape Path is hidden for Dungeon because an endless authored loop has no finite flag path; Dungeon result stats are rendered by Result UI instead.)

## Context

Story 025 adds the player-facing Escape Path: a compact wave path during combat, an expanded progress map during breaks, and a reached-path map in the Result UI.

The project already has all authoritative data needed for this UI:

- `SessionDefinition.encounters` gives the full encounter order and global numbering for `type === 'wave'`;
- `Snapshot.encounter` reports the active encounter and its index during a run;
- `SessionResultSummary.progress` reports `completedWaves`, `totalWaves`, `activeEncounterId`, and `activeEncounterIndex` for the terminal result.

Therefore the story must not extend the simulation worker, `Snapshot`, runtime events, or session content. This is a main-thread presentation layer that must stay consistent with global numbering from [encounter-presentation.md](encounter-presentation.md) and result stats from [session-result-summary.md](session-result-summary.md).

## Decision

### Ownership

- Escape Path lives in `src/main/ui/**`.
- It does not import from `src/sim/**`, does not call `SimWorkerHost` directly, does not send input commands, and does not subscribe to runtime events.
- Authoritative sources:
  - live/break: immutable `SessionDefinition` + current `SnapshotPair.curr`;
  - result: immutable `SessionDefinition` + terminal `SessionResultSummary`.
- Escape Path itself introduces no fields in `Snapshot`, `RuntimeEvent`, `SessionDefinition`, `EncounterDefinition`, or `SessionResultSummary`. Later stories may extend those contracts for other reasons; Escape Path remains a pure consumer and simply hides itself for modes such as Dungeon where a finite path is not meaningful.
- Progress calculation is pure main-side derivation. Keep it in a separate helper/view-model module near the UI so compact, break, and result use one formula.

### Wave Path Model

The path is built only from wave encounters:

- `totalWaves` = number of encounters with `type === 'wave'` in `session.encounters`;
- global wave encounter number = number of wave encounters from session start through the current encounter, inclusive;
- boss, break, survivalTimer, and sandbox encounters do not get their own path points.

If `totalWaves === 0`, Escape Path is hidden: sandbox/modes without waves have no meaningful path. If `session.winCondition.kind === 'dungeon'`, Escape Path is also hidden even though the session has wave encounters, because an endless loop has no finite path to a flag.

Recommended internal view model:

```ts
type EscapeProgressPathViewModel = Readonly<{
  totalWaves: number;
  completedWaves: number;
  activeWaveIndex: number | null; // 1-based, only when active encounter is wave
  stop:
    | Readonly<{ kind: 'none' }>
    | Readonly<{ kind: 'loss'; anchor: 'activeWave' | 'afterCompletedWaves' | 'beforeFlag' }>;
  flagState: 'pending' | 'reached';
}>;
```

Type names are implementation details, but semantics are required:

- `completedWaves` — number of already completed wave encounters;
- `activeWaveIndex` — current wave if the player is currently inside a wave encounter;
- `stop` is used only for result/loss presentation;
- `flagState: 'reached'` is allowed only on victory.

### Live / Break Derivation

Live state uses `SessionDefinition + Snapshot`:

- If snapshot is missing or active encounter cannot resolve by `snapshot.encounter.index`/`id`, the path renders `completedWaves = 0`, `activeWaveIndex = null`, or hides until the first valid snapshot. Implementation must choose one stable option and cover it with a test; it must not infer encounter from wall-clock.
- For active wave encounters:
  - `completedWaves` = number of wave encounters with index lower than active encounter index;
  - `activeWaveIndex` = `completedWaves + 1`;
  - the active wave point is highlighted but not counted as completed.
- For active non-wave encounters:
  - `completedWaves` = number of wave encounters with index lower than active encounter index;
  - `activeWaveIndex = null`;
  - all points through `completedWaves` are highlighted as reached.
- During boss encounters, the path remains wave-only: boss gets no marker, and the flag stays `pending`.

Presentation modes:

- `compact`: default in `running` for wave/boss/non-wave encounters except break;
- `expandedBreak`: active encounter `type === 'break'`; expanded path replaces compact path for the duration of break;
- `hidden`: no session, no valid path, `totalWaves === 0`, or UI phase hides the live component.

### Result Derivation

Result state uses `SessionDefinition + SessionResultSummary`:

- `totalWaves` comes from `summary.progress.totalWaves`;
- `completedWaves` comes from `summary.progress.completedWaves`;
- `progress.percent` is not used to fill points, because percent includes boss/objective partial progress while the path shows only the wave path.
- For Dungeon results (`summary.dungeon !== null` or `session.winCondition.kind === 'dungeon'`), no Escape Path view model is produced. Result UI shows Dungeon-specific stats from [session-result-summary.md](session-result-summary.md) instead.

Outcome rules:

- `win`: `completedWaves = totalWaves`, `activeWaveIndex = null`, `stop.kind = 'none'`, `flagState = 'reached'`;
- `loss` during active wave: stop marker anchors on that active wave point; completed points remain only before it;
- `loss` during non-wave with `completedWaves < totalWaves`: stop marker anchors after the last completed wave and before the next wave point;
- `loss` after all waves but before victory, for example on final boss: all wave points may be completed, but `flagState` stays `pending`; stop marker anchors `beforeFlag`.

This rule prevents a final-boss loss from looking like a completed escape while still respecting the product decision that bosses are not path nodes.

### UiShell Integration

Live Escape Path is a separate UI component, not part of `Renderer` and not a simulation system.

Recommended lifecycle mirrors `Hud` / `TitleOverlay`:

```ts
type EscapeProgressPath = Readonly<{
  attach(session: SessionDefinition): void;
  update(snapshotPair: SnapshotPair, phase: UiShellPhase): void;
  detach(): void;
  dispose(): void;
}>;
```

`UiShell` owns it:

- creates it once with the other overlays;
- attaches it when a client session starts;
- updates it during `running`;
- freezes it during `paused` using the last visible view model, matching `TitleOverlay` behavior;
- detaches it in `tearDownClientSession`;
- does not show the live component in `result`.

### Layering

Standalone live/break path visibility by phase:

| Phase | Escape progress path |
|---|---|
| `loading` | hidden |
| `menu` | hidden |
| `running` | visible when `totalWaves > 0` |
| `paused` | visible frozen when it was visible before pause |
| `result(win|loss)` | hidden; Result UI renders its own static path |
| `error('preload')` | hidden |

Z-order, top to bottom:

Startup error > Phase transition curtain > Startup overlay > Result UI > Settings overlay > Pause overlay > Menu overlay > Title overlay > **Escape progress path** > HUD > canvas.

The expanded break path must not cover title overlay text. If the break title text and expanded path are both visible, title overlay wins in z-order.

### Result UI Integration

`ResultViewModel` gains an optional escape path view model derived from `SessionDefinition + SessionResultSummary`.

`ResultOverlay` renders that static path inside the result card/stage. It does not reuse live snapshots, does not keep the live `EscapeProgressPath` component mounted, and does not query `SimWorkerHost` after terminal teardown.

The existing result stat tile `Wave N / M` may remain. The path augments the stat; it is not a replacement for all result stats.

### Tests

Implementation must cover:

- pure view-model derivation for active wave, break after wave, boss after wave, win, loss during wave, loss during non-wave, loss after all waves before flag, and zero-wave sessions;
- live component lifecycle: attach/update/detach, compact vs expanded break mode, freeze in `paused`, hide outside active session;
- `UiShell` wiring: component attaches/detaches with session and is not visible in result;
- ResultViewModel/ResultOverlay integration for win and loss maps;
- responsive presentation sanity for small widths and reduced motion fallback for path-fill animation.

## Consequences

- No simulation contract changes are needed; this keeps story 025 presentation-only from the worker perspective.
- A new UI layer appears in `UiShell`, so `main-ui-shell.md` must know its phase visibility and z-order.
- Result UI gets one more derived presentation block, but still depends only on terminal summary and registries.
- Final-boss losses require a distinct `beforeFlag` loss marker so a completed wave row does not falsely imply victory.
- The same pure path derivation becomes the single source of truth for compact, break and result variants.

## Related

- [main-ui-shell.md](main-ui-shell.md)
- [hud-presentation.md](hud-presentation.md)
- [encounter-presentation.md](encounter-presentation.md)
- [session-result-summary.md](session-result-summary.md)
- [snapshot-shape.md](snapshot-shape.md)
- [thread-model.md](thread-model.md)
- [testing.md](testing.md)
- [../stories/025-escape-progress-path.md](../stories/025-escape-progress-path.md)
- [../stories/028-dungeon-mode.md](../stories/028-dungeon-mode.md)
