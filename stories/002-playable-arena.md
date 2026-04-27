# Playable Arena

- Status: done
- Created: 2026-04-19
- Updated: 2026-04-19

## Player-facing

- Sees: a stub menu with a single Start button; once started — an empty arena with a controllable character.
- Can do: start a session, walk around the arena with keyboard/mouse, end the session, and return to the menu.

## Technical

- A stub `content library` with one arena and one `ModePreset` of type `sandbox` lives in `src/shared/content/**` (see [../design/web-stack.md](../design/web-stack.md), [../design/content-boundaries.md](../design/content-boundaries.md)).
- Builder `ModePreset` + options → `SessionDefinition` constructs the session per [../design/session-definition.md](../design/session-definition.md), including `winCondition: none` / `lossCondition: none` for sandbox.
- `SessionFlowSystem`: idle by default, start/stop with an active encounter of type `sandbox`; simulation lifecycle as in [../design/runtime-systems.md](../design/runtime-systems.md).
- `SessionDefinition` is passed from `main` to the `simulation worker` via the typed `MainToSim.startSession` ([../design/thread-model.md](../design/thread-model.md)).
- Input commands `main → sim` (WASD movement, aim in world coordinates, LMB) — input layer in `src/main/input/**`, contract per [../design/input-commands.md](../design/input-commands.md). In 002 `fire` is a no-op in `sim`, but the protocol is valid.
- `EntityStore` minimal — just enough for a single player entity created from `SessionDefinition.player`.
- `MovementSystem` for the player inside the arena bounds ([../design/arena-and-coordinates.md](../design/arena-and-coordinates.md)).
- The camera and canvas fit the arena into the viewport (fit / letterbox / pillarbox); the arena and player render on top of 001; the virtual crosshair is drawn in `main` under Pointer Lock.
- The system cursor is hidden during a session; Esc → pause overlay with an "Exit to menu" button.
- Basic project infrastructure arrives in this story: a single log module ([../design/logging.md](../design/logging.md)) and a test runner ([../design/testing.md](../design/testing.md)) — this is the first story where they are actually needed.

## Out of scope

- Enemies, weapons, combat, drops.
- Full menu and HUD — that is `007`.
- Dark zone, waves, encounter transitions — that is `004`.

## Acceptance

- A session starts from the stub menu.
- The player sees their character in an empty arena and controls them.
- The character does not leave the arena bounds.
- Ending the session returns to the menu without errors or worker leaks.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Basic infrastructure: `vitest` in `devDependencies` and `scripts.test` / `scripts.test:watch` in `package.json`; `src/shared/log.ts` module with `log.info/warn/error` API per `design/logging.md`. | basis: `design/testing.md`, `design/logging.md` |
| T2 | [x] | Type the public contracts in `src/shared/**`: `SessionDefinition` / `EncounterDefinition` / `WinCondition` / `LossCondition`, discriminated `InputCommand`, `EntitySnapshot.kind`, minimal `RuntimeEvent` union of lifecycle kinds from `design/runtime-systems.md`. `MainToSim.startSession.session`, `MainToSim.input.command` and `SimToMain.event.event` stop being `unknown`. | basis: `design/session-definition.md`, `design/input-commands.md`, `design/thread-model.md`, `design/runtime-systems.md` |
| T3 | [x] | `content library` scaffold in `src/shared/content/**`: one arena `{ width, height }`, one sandbox `ModePreset`, builder `buildSessionDefinition(preset, options) → SessionDefinition` with `winCondition/lossCondition: none` and a starting `seed`. | basis: `design/web-stack.md`, `design/content-boundaries.md`, `design/session-definition.md` |
| T4 | [x] | Move `SimulationClock` and `worker.ts` to a session-driven lifecycle: idle by default, handle `startSession`/`stopSession` by initialising and resetting runtime state, no `worker.terminate()`. Warning via `log` for commands outside a session and for `pause` without a session. | basis: `design/runtime-systems.md`, `design/thread-model.md`, `design/logging.md` |
| T5 | [x] | Minimal `EntityStore` + creating the player entity from `SessionDefinition.player`; `SnapshotExportSystem` exports the player with `kind: 'player'`. The orbital test entity from 001 is removed. | basis: `design/runtime-systems.md`, `design/thread-model.md` |
| T6 | [x] | Input layer `src/main/input/**`: WASD via `KeyboardEvent.code`, Pointer Lock on the canvas, virtual crosshair in world coordinates clamped to the arena bounds, LMB → `fire start/stop`. Commands are sent to `sim` at the rate defined in `design/input-commands.md`. | basis: `design/input-commands.md`, `design/arena-and-coordinates.md` |
| T7 | [x] | `MovementSystem` for the player: integrate the `move` command at `player.maxSpeed` × `SIM_STEP_MS`, clamp to the `arena` bounds. The "character does not leave the arena" invariant is covered by a unit test per `design/testing.md`. | basis: `design/runtime-systems.md`, `design/arena-and-coordinates.md`, `design/simulation-timing.md`, `design/testing.md` |
| T8 | [x] | Render the arena and the player: ortho camera on `arena.width × arena.height`, CSS-fitted canvas (`aspect-ratio`), draw the arena rectangle, the player sprite, and the virtual crosshair. The system cursor is hidden over the canvas. | basis: `design/arena-and-coordinates.md`, `design/thread-model.md` |
| T9 | [x] | Stub menu (DOM overlay with a Start button); Esc → pause overlay with an "Exit to menu" button; integration of `startSession`/`stopSession`/`pause`/`resume`; re-request Pointer Lock on resume. Acceptance check. | basis: `design/input-commands.md`, `design/runtime-systems.md` |
| T10 | [x] | Move the story to `done`, update the table in `stories/README.md`. | architect |

## Related

- [../design/session-definition.md](../design/session-definition.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../design/thread-model.md](../design/thread-model.md)
- [../design/arena-and-coordinates.md](../design/arena-and-coordinates.md)
- [../design/input-commands.md](../design/input-commands.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/simulation-timing.md](../design/simulation-timing.md)
- [../design/logging.md](../design/logging.md)
- [../design/testing.md](../design/testing.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
