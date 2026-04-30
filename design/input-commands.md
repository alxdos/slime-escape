# Input Commands

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-30 (story 031 follow-up: aim pixel-to-world mapping uses the active visible area from [camera-and-visible-area.md](camera-and-visible-area.md), while mobile touch controls still map to existing `move`/`aim`/`fire` commands; see [mobile-web-support.md](mobile-web-support.md). Earlier: 2026-04-26 story 023 pause hotkey fix: player-facing pause overlay is `Esc` or `Space`; dev pause moves to physical `KeyP` through `UiShell`, independent of locale/CapsLock. Earlier: 017 alignment: weapon slot selection and holster commands are added for ordered loadouts; `Digit0` is the dedicated holster hotkey; see [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). 007 finalized pause routing through `UiShell`.)

## Context

[thread-model.md](thread-model.md) states that player input commands flow from `main → sim`, but does not define their shape, frequency, coordinate space, or keyboard/mouse binding. In `src/shared/protocol.ts`, `InputCommand = unknown` today. Without an explicit contract:

- story 002 will make an implicit decision about movement and aim command shape;
- story 003 (shooting) will reopen the same question for `fire`;
- story 007 (HUD/menu/pause) will reopen Esc/pause rules;
- every input feature will drag in an inter-thread contract that is expensive to change later.

There are also product requirements:

- WASD movement must not depend on the current keyboard layout;
- the system cursor is hidden during a session, and the game draws its own aim cursor;
- left mouse button means shooting (behavior is implemented in 003, but the contract is needed now).

## Decision

### Responsibility layers

- Raw input collection (key presses, mouse events, Pointer Lock) belongs to the `main thread`. Concretely, this is a module under `src/main/input/**` (exact placement inside `src/main` is an implementation detail, not fixed here).
- `sim` receives only aggregated `InputCommand` messages and knows nothing about keyboard, mouse, or viewport.
- The aim cursor (visual crosshair) is drawn on the `main` side; its position is computed in `main` and does not enter `sim` as a separate entity.

### Keyboard: WASD by physical key

- Movement commands are built from `KeyboardEvent.code`: `KeyW`, `KeyA`, `KeyS`, `KeyD`. `event.key` is not used for movement, so behavior does not depend on the active layout or modifiers.
- Arrow keys `ArrowUp/Down/Left/Right` are allowed equivalent input; mapping lives in `src/main/input/**`.
- No system key is taken from the browser without need. Specifically, `e.preventDefault()` is called only for `code` values the game actually uses.

### Keyboard: weapon slots

- `Digit1`..`Digit9` select 0-based weapon slot `0..8` and send `selectWeaponSlot`.
- `Digit0` is the dedicated holster hotkey and sends `holsterWeapon`.
- These commands use `KeyboardEvent.code`, not `event.key`, for the same layout reasons as movement.
- `event.repeat` is ignored for slot/holster hotkeys: these are edge commands, and holding the key must not generate a repeated selection stream.

### Movement command

- The pressed WASD key state is aggregated into a **movement direction** as a `(dx, dy)` pair:
  - `dx = (KeyD ? 1 : 0) - (KeyA ? 1 : 0)`;
  - `dy = (KeyW ? 1 : 0) - (KeyS ? 1 : 0)` (Y axis points up, see [arena-and-coordinates.md](arena-and-coordinates.md));
  - the vector is **normalized** if its length is greater than 1; a zero vector means "stand still".
- This means that when two perpendicular keys are pressed at the same time, the player moves diagonally at the **same** speed as along one axis. A raw vector with a `sqrt(2)` diagonal bonus is forbidden.
- Movement command is **state-based**: `main` sends the current "movement intent" to `sim`, not "pressed/released" events. This simplifies debounce handling and avoids making `sim` store keyboard state.

### Mouse and aiming

- During an active session, `main` requests Pointer Lock on the canvas. While Pointer Lock is active:
  - the system cursor is hidden;
  - the game maintains a **virtual aim position** in world coordinates, updating it from `movementX/Y` on `mousemove` events;
  - the virtual aim is strictly clamped to arena bounds ([arena-and-coordinates.md](arena-and-coordinates.md)); aim cannot leave the arena.
  - `movementX/Y` (in canvas pixels) is converted to world units with the same mapping as rendering: `1 wu ≡ canvas.height / visibleArea.height` pixels (see [camera-and-visible-area.md](camera-and-visible-area.md)). With the current `32 x 18` desktop arena, `visibleArea.height === arena.height`, preserving the existing feel. This gives the same aim sensitivity at any window size and the same perceived aim on 4K and FullHD.
  - aim sensitivity is not introduced by this decision; until settings exist ([../stories/009-settings.md](../stories/009-settings.md)), it is `1.0` of the mapping above.
- If Pointer Lock is not currently active (the browser just released it on Esc, the lock has not yet been requested again, and so on), aim stays at the last known world position, and mouse movement does not move it. This prevents aim jumps when lock is lost and restored.
- The main channel for "aim in `sim`" is the `aim` field in input commands (see below), in world coordinates. No screen coordinates are sent to `sim`.

### Shooting (left mouse button)

- The left mouse button is the only button for the primary attack. This is a design-level contract, not a configurable hotkey at this stage.
- Left mouse button produces a `fire` command with `start | stop` state:
  - `mousedown` → `fire: start`;
  - `mouseup` → `fire: stop`;
  - holding LMB must not generate a stream of repeated commands; firing rate is the responsibility of `CombatSystem` ([runtime-systems.md](runtime-systems.md)) and weapon parameters.
- In stories where `CombatSystem` does not exist yet (002), `sim` accepts `fire` as a valid command but ignores its gameplay effect. Silently dropping unknown commands is forbidden, otherwise protocol errors become invisible.

### Mobile touch controls

- Mobile touch controls are a main-thread input mapping defined by [mobile-web-support.md](mobile-web-support.md). They reuse the existing `InputCommand` union and do not add new `kind` values.
- Mobile movement sends the same normalized `move` command as keyboard movement.
- Mobile aim maintains the same virtual aim position as desktop Pointer Lock aiming, using relative drag deltas, the active visible-area pixel-to-world mapping, and clamping to arena bounds.
- Mobile fire sends the same `fire start` / `fire stop` commands as left mouse button.
- A mobile fire tap must remain active for at least one simulation step before the input layer sends `fire stop`; this keeps short taps observable without changing simulation semantics.
- Mobile input does not request Pointer Lock. Desktop Pointer Lock behavior remains unchanged.
- The mobile pause/menu button is not an input command. It routes to `UiShell` pause behavior and takes priority over the fire zone.

### Esc, pause, and Pointer Lock

- `Esc` always means "open pause overlay"; the "Exit to menu" button inside the overlay calls `stopSession`.
- During an active session, `Space` means the same player-facing action as `Esc`: open `PauseOverlay` and move `UiShell` to the `paused` phase. Because `Space` does not make the browser release Pointer Lock by itself, `UiShell` explicitly calls `document.exitPointerLock()` when entering overlay pause if Pointer Lock is active.
- The browser automatically releases Pointer Lock on `Esc`; this intentionally aligns with opening the pause overlay: the system cursor appears and can click buttons.
- When leaving pause, `main` requests Pointer Lock again. Until the user makes a gesture (click), the browser may reject the request; this is valid and is handled on the next mousedown.
- Physical `KeyP` is **dev pause**: it toggles `SimWorkerHost.pause()`/`.resume()`, but **does not** change the `UiShell` phase and **does not** show `PauseOverlay`. It uses `KeyboardEvent.code === 'KeyP'`, not `event.key`, so behavior does not depend on keyboard locale or CapsLock.
- Hotkey routing: `Esc`, `Space`, and `KeyP` are handled by the single owner `UiShell` ([main-ui-shell.md](main-ui-shell.md)). Direct `SimWorkerHost.pause()`/`.resume()` calls from `keydown` handlers outside `UiShell` are forbidden, otherwise `UiShell` phase (`running`/`paused`) can diverge from simulation `isPaused()`, causing double-pause scenarios from dev hotkey plus overlay.
- In the `paused` phase (overlay opened by `Esc`/`Space`), `KeyP` also does **nothing**: the orchestrator ignores the dev hotkey while normal pause is active, preventing "unpaused through dev hotkey while overlay stayed visible". In `menu` and `result` phases, all pause hotkeys are ignored.

### `InputCommand` shape

- A discriminated union, the only source of all `main → sim` commands:
  ```ts
  type InputCommand =
    | { kind: 'move'; dx: number; dy: number }       // normalized vector, |v| ∈ [0, 1]
    | { kind: 'aim';  x: number;  y: number  }       // world coordinates
    | { kind: 'fire'; phase: 'start' | 'stop' }
    | { kind: 'selectWeaponSlot'; slotIndex: number } // 0-based slot for keyboard 1..9
    | { kind: 'holsterWeapon' };
  ```
- Semantics:
  - `move` and `aim` are **state** commands: the last received command replaces the previous command of the same `kind`; `sim` stores the player's current intent and applies it on each tick.
  - `fire` is an **edge** command: every message is meaningful, but repeated messages with the same `phase` must not change gameplay state.
  - `selectWeaponSlot` and `holsterWeapon` are **edge** commands. `selectWeaponSlot` changes runtime selected weapon if the index exists in the current ordered loadout; invalid indices are ignored with warning and do not alter selection. `holsterWeapon` sets selected weapon to `null`.
- `start/stop/pause/resume/debug` commands remain at the top level of `MainToSim` ([thread-model.md](thread-model.md)) and are not part of `InputCommand`.

### Send frequency

- `move` and `aim` are sent **when the value changes**, not every frame. If nothing changed, `main` stays silent.
- `aim` is additionally limited: during a `mousemove` stream, `main` batches events for one `requestAnimationFrame` and sends at most one `aim` command per frame.
- `fire` is sent by event and is not throttled on the `main` side.
- There is no guarantee that a command reaches a specific tick: `main → sim` communication is asynchronous by [thread-model.md](thread-model.md). `sim` applies the latest received state on the nearest tick.

### Handling in sim

- `sim` stores per-session input state as part of runtime state ([content-boundaries.md](content-boundaries.md)): `{ moveDir, aimWorld, firing }`.
- On `startSession`, input state resets to neutral values (`moveDir = (0,0)`, `aimWorld = player.position`, `firing = false`).
- On `stopSession`, input state is discarded with the rest of runtime state.
- On `startSession`, selected weapon state is initialized from `SessionDefinition.loadout.selectedIndex` when `loadout !== null`.
- Commands received before `startSession` or after `stopSession` are dropped with a warning through the shared log module; silent ignore is forbidden.

## Consequences

- In `src/shared/protocol.ts`, `InputCommand` stops being `unknown` and becomes a concrete discriminated union; this is a **contract change** to `MainToSim` and is implemented immediately.
- `sim` stays headless: no `KeyboardEvent`, `MouseEvent`, `clientX`, or `viewport` inside `src/sim/**`.
- Aim and movement feel the same at any resolution and window aspect ratio (see invariant in [arena-and-coordinates.md](arena-and-coordinates.md)): one formula maps pointer delta to world through the active visible area.
- Esc/Space + Pointer Lock + pause overlay form a coherent UX: entering overlay pause opens the menu and provides a system cursor for clicks.
- `fire` exists in the contract already in 002 and is ignored at the gameplay level; 003 enables `CombatSystem` without extending the protocol.
- Sensitivity settings (009) become a multiplier on the single mouse-delta-to-world mapping and do not require revisiting this decision.
- Future key changes (remap, gamepad, touch extensions) extend mapping in `src/main/input/**` without changing `InputCommand` shape. If a new `kind` is required, that is a contract change and this file must be updated.

## Related

- [thread-model.md](thread-model.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [camera-and-visible-area.md](camera-and-visible-area.md)
- [runtime-systems.md](runtime-systems.md)
- [content-boundaries.md](content-boundaries.md)
- [main-ui-shell.md](main-ui-shell.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [mobile-web-support.md](mobile-web-support.md)
