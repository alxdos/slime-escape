# Main UI Shell

- Status: accepted
- Created: 2026-04-20
- Updated: 2026-04-26 (story 025: a separate UI layer `Escape Path` is added for compact/break progress path; its phase visibility, z-order, and result integration are defined in [escape-progress-path.md](escape-progress-path.md). Earlier story 024: Result UI consumes authoritative `SessionResultSummary` from terminal `win`/`loss` events and renders stats/effects without talking to sim; see [session-result-summary.md](session-result-summary.md). Earlier story 023: startup/menu presentation, post-load ritual, first-menu UI asset preload, and phase transition curtain are split into [menu-and-startup-presentation.md](menu-and-startup-presentation.md); this file keeps phase ownership and visibility. Earlier story 022: detailed combat HUD moved to [hud-presentation.md](hud-presentation.md); this file keeps only phase visibility, HUD passivity, and `UiShell` ownership. Earlier story 021: a separate `wave/break title overlay` UI layer is added; phase visibility, z-order, data sources, and global wave numbering are defined in [encounter-presentation.md](encounter-presentation.md). Earlier: 2026-04-24 017 terminology cleanup: session authoring references ordered `loadoutWeaponIds` instead of legacy singular `loadoutWeaponId`. Story 016: `UiShell` fans simulation runtime events out to `Renderer.handleEvent` while staying the only `SimWorkerHost.onEvent` owner; see [impact-feedback.md](impact-feedback.md). Earlier: story 015 follow-up: `Renderer` receives immutable `SessionDefinition` at creation, reads `session.backgrounds` + `encounters[].backgroundId`, and switches arena background by `snapshot.encounter.id`; snapshot is not extended because active encounter already exists. Story 015: playable preset catalog becomes a derived view over `SESSION_PRESET_TEMPLATES` from the content library; preset metadata (`displayName`/`description`/`visibleInMenu`/`order`) lives in the `# Session` partition of each `content/sessions/<presetId>.md`, next to the preset itself (see [content-authoring.md](content-authoring.md), "Multi-file areas"); separate `playableModes.ts` disappears; `PlayableModeEntry` collapses into a derived view with no separate registry. Story 013: startup phase `loading` and terminal phase `error('preload')` are added: visible splash plus sprite preload before menu, hard error on load failure, and no Renderer/InputController/Settings/SimWorkerHost availability in those phases.)

## Context

[thread-model.md](thread-model.md) defines that HUD, menu, and all DOM/UI live on the `main thread`, while `simulation worker` is the only source of authoritative state and runtime events. [snapshot-shape.md](snapshot-shape.md) and [runtime-systems.md](runtime-systems.md) define **what** main receives from sim: periodic snapshots with per-kind fields, top-level `encounter`/`zone`/`waveProgress`/`bossHud`, and lifecycle/`win`/`loss` events. [session-definition.md](session-definition.md) defines that main owns immutable `SessionDefinition` immediately after `startSession` and must build it from `ModePreset` through the builder in `src/shared/content/**` ([content-boundaries.md](content-boundaries.md), [web-stack.md](web-stack.md)). [input-commands.md](input-commands.md) defines pause UX (Esc, overlay, Pointer Lock).

In 001, main was "one canvas plus dev pause". In 002-006, `MenuOverlay`, `PauseOverlay`, `Renderer`, `InputController`, and `SimWorkerHost` appeared alongside it, and phase orchestration ("menu is visible", "session is running", "paused", "result") effectively lived in `src/main/index.ts` through `activeSession` and local `pause.show()`/`menu.setResult()` calls. Story 007 introduces all at once:

- real mode selection in the menu;
- HUD with HP/timer/wave/boss;
- pause UX from UI and hotkey;
- result screen with return to menu.

Without an explicit contract, 007 would lock in divergence along two axes:

- **UI phase orchestration**: where transitions `menu <-> running <-> paused <-> result` live, who owns overlay visibility, and how HUD coexists with pause overlay;
- **HUD data source**: what HUD reads from snapshots and `SessionDefinition`, what comes from runtime events, how "wave number" is computed, and what presentation considers the owner of "active encounter".

008 (audio), 009 (settings), and 010 (render backend) depend on the same orchestration: audio attaches to UI phases and runtime events; settings UI opens from the menu; render backend initializes and recreates within `running`. The contract belongs here rather than locally in 007.

## Decision

### Repository placement

- The full UI shell and HUD live under `src/main/ui/**` (see [web-stack.md](web-stack.md)). No new presentation root directories are introduced.
- The catalog of player-selectable modes is content library data under `src/shared/content/**` (see "Playable preset catalog" below).
- No UI module may import from `src/sim/**`. Contact with simulation goes only through the established `SimWorkerHost` API (`src/main/sim/SimWorkerHost.ts`): `startSession`, `stopSession`, `pause`, `resume`, `sendInput`, `snapshotPair()`, `isPaused()`, and `onEvent` subscription. Direct `postMessage`/`new Worker` from UI is forbidden.

### UI shell as explicit phase orchestrator

- A single `UiShell` component is introduced in `src/main/ui/**`; the exact filename is an implementation detail. It is the sole owner of the application's presentation phase.
- Presentation phase is a finite state machine:
  - `loading`: **initial** app state. Mandatory startup preload runs before entering `menu` (see [sprite-assets.md](sprite-assets.md), "Preload contract"). No session is active, `Renderer`/`InputController` do not exist, and simulation does not tick.
  - `menu`: start screen and between-runs screen. No session is active: `SimWorkerHost.startSession` has not been called, or the previous session has ended cleanly.
  - `running`: active session, simulation ticks, renderer and HUD are visible.
  - `paused`: active session, simulation is stopped (`SimWorkerHost.pause` called), HUD and scene remain visible and frozen, `PauseOverlay` appears above them.
  - `result(win | loss)`: the last session ended automatically via `win`/`loss` event and has not yet been dismissed by the user; the screen shows the result and the only action is "to menu".
  - `error('preload')`: **terminal** state reached if any required asset fails during `loading`. The screen shows `StartupErrorOverlay` with a clear message and one action, reload page. No other phase is reachable from `error('preload')`.
- Allowed transitions; any other transition is an orchestration bug, not UX freedom:
  - `loading -> menu` after successful startup preload;
  - `loading -> error('preload')` if loading/decoding any required asset fails;
  - `menu -> running` through an explicit player action (mode selection);
  - `running <-> paused` through `Esc`/`Space`/Pointer Lock loss/overlay buttons and the `KeyP` dev hotkey (see below);
  - `running -> result(win|loss)` through `win`/`loss` event from sim;
  - `running -> menu` through explicit exit from pause ("Exit to menu");
  - `paused -> menu` through the same exit, without an intermediate `running`;
  - `result -> menu` through the single "Menu" action;
  - `result -> running` directly is forbidden: a new run starts only from `menu`.
- There are no sanctioned transitions out of `error('preload')`; only `location.reload()` leaves it. This prevents a partially loaded mode where renderer fails on missing texture mid-combat.
- Transitions from `running`/`paused` to `menu` always call `SimWorkerHost.stopSession()`. Transition `running -> result` explicitly **does not** call `stopSession()`: simulation already performed teardown by [session-definition.md](session-definition.md). This avoids "no active session" warnings and double reset of runtime state.
- One `simulation worker` instance lives for the whole app lifetime and is reused between sessions ([thread-model.md](thread-model.md)). `UiShell` does not recreate the worker during phase transitions.
- Entering any phase explicitly shows/hides every overlay and HUD by the table below. No component may show/hide itself "around `UiShell`" in response to an event.

### Overlay and HUD visibility by phase

| Phase | Startup overlay | Menu overlay | HUD | Escape progress path | Title overlay | Pause overlay | Result UI | Startup error | Pointer Lock |
|------|-----------------|--------------|-----|----------------------|---------------|---------------|-----------|---------------|--------------|
| `loading` | visible | hidden | hidden | hidden | hidden | hidden | hidden | hidden | released |
| `menu` | hidden | visible | hidden | hidden | hidden | hidden | hidden | hidden | released |
| `running` | hidden | hidden | visible (live) | visible (see [escape-progress-path.md](escape-progress-path.md)) | visible (see [encounter-presentation.md](encounter-presentation.md)) | hidden | hidden | hidden | requested |
| `paused` | hidden | hidden | visible (frozen on last snapshot) | visible (frozen) | visible (frozen) | visible | hidden | hidden | released |
| `result(win|loss)` | hidden | hidden | hidden | hidden (static path inside Result UI) | hidden | hidden | visible | hidden | released |
| `error('preload')` | hidden | hidden | hidden | hidden | hidden | hidden | hidden | visible | released |

- `Startup overlay` in `loading` shows preload and post-load presentation ritual from [menu-and-startup-presentation.md](menu-and-startup-presentation.md). There is no "partially loaded" menu or HUD: the player sees splash, menu, or explicit startup error.
- `Startup error` in `error('preload')` is a separate overlay over an empty background, with a human-readable description of the first failed load and one button, "Reload page", which calls `location.reload()`.
- HUD remains visible in `paused` intentionally: the player should see the exact HP/timer/wave/boss values at pause time. Pause overlay draws above it.
- Result UI hides HUD: numbers from the run that just ended should not compete with final summary. Future "result summary" belongs to Result UI, not by bringing HUD back.

### Layer stack (z-order)

- Layers top to bottom: Startup error > Phase transition curtain > Startup overlay > Result UI > Settings overlay > Pause overlay > Menu overlay > Title overlay > Escape progress path > HUD > canvas. Numeric `z-index` values are implementation details; contract is order and non-overlapping visibility of simultaneous layers. By the phase table, at most one modal overlay appears together with Title overlay, Escape progress path, and HUD; in `loading` and `error('preload')`, HUD, Title overlay, and Escape progress path are absent. Phase transition curtain belongs to `UiShell` and is described in [menu-and-startup-presentation.md](menu-and-startup-presentation.md). Title overlay is the separate presentation layer from [encounter-presentation.md](encounter-presentation.md), drawn above HUD/Escape progress path and below any modal overlay; within `running`/`paused`, its visibility is additionally controlled by active encounter (intro for wave, `text !== null` for break), not only by `UiShell` phase. Escape progress path is the separate layer from [escape-progress-path.md](escape-progress-path.md): live/break variant draws above HUD and below Title overlay, while result variant is embedded inside Result UI.
- HUD and overlays are positioned relative to the viewport (`position: fixed`), not relative to canvas. Letterbox/pillarbox bands from [arena-and-coordinates.md](arena-and-coordinates.md) do not hide HUD; HUD is drawn over any empty bands. This keeps HUD placement stable at unusual aspect ratios.

### HUD as passive consumer

- HUD is a `src/main/ui/**` component, not an orchestrator. It does not know about `UiShell` phases beyond being told `attach(session)` / `update(snapshotPair)` / `detach()`.
- HUD data sources:
  1. **`SessionDefinition`** passed on `attach`: `arena`, `player.maxHp`, `encounters` for "total waves" and "active wave number", `winCondition`/`lossCondition` for deciding whether to render HP and boss blocks. `SessionDefinition` is immutable during the session ([session-definition.md](session-definition.md)).
  2. **`SnapshotPair`** ([../src/main/sim/SimWorkerHost.ts](../src/main/sim/SimWorkerHost.ts)): authoritative per-frame source for player `hp`/`maxHp`, `encounter`, `waveProgress`, and `bossHud`. HUD uses `curr` snapshot for text fields; interpolation between `prev`/`curr` is for renderer, not HUD.
- HUD **does not subscribe** to runtime events directly and does not apply authoritative updates from them. This is already established in [snapshot-shape.md](snapshot-shape.md) ("HUD must not reconstruct authoritative state only from combat events") and [thread-model.md](thread-model.md) ("HUD and audio rely on snapshots; events are reaction triggers"). If future HUD needs a short event animation, such as a flash on `bossPhaseChange`, that gets a separate contract and is routed through `UiShell`, not by leaking `SimWorkerHost.onEvent` into HUD.
- HUD never sends commands to `sim` and never mutates `SimWorkerHost`. All simulation interaction is orchestrated by `UiShell`.
- HUD updates in the shared main rAF loop, the same loop that calls `Renderer.render()`: exactly one `update(snapshotPair)` per frame. HUD does not get a separate timer.
- In `paused`, `UiShell` stops calling `update`, and HUD stays as it was. This preserves "HUD is frozen" without requiring HUD to know about pause.
- Concrete player-facing HUD layout after story 022, including run timer, compact HP, boss strip, control hints, weapon slots, cooldown fill, and upgrade badges, lives in [hud-presentation.md](hud-presentation.md). This file does not duplicate layout so `main-ui-shell.md` remains phase orchestration.

### HUD data derivation

- If HUD shows wave number or total waves, those numbers are **not** added to snapshot. They are computed on the HUD side from:
  - `SessionDefinition.encounters`, filtered by `type === 'wave'` and indexed in list order for global numbering across the session;
  - `snapshot.encounter.id` or `snapshot.encounter.index`, used to find the active encounter in that list.
- This preserves the [thread-model.md](thread-model.md) principle that snapshots carry only changing state while configuration already lives on main, and it does not require extending [snapshot-shape.md](snapshot-shape.md).
- HUD wave numbering intentionally remains **global**. The separate wave title overlay ([encounter-presentation.md](encounter-presentation.md)) uses the same global order of wave encounters, so title, HUD, and Result UI do not disagree.
- Run timer for the new combat HUD is `snapshot.simTimeMs`, not `snapshot.encounter.elapsedMs`; it shows current run duration and does not reset between encounters. HUD has no parallel wall-clock timer, which avoids drift with `pause`/`resume` ([simulation-timing.md](simulation-timing.md): `simTime` does not catch up to wall-clock after resume).
- If future HUD again shows wave progress (`dispatched`/`total`/`alive`), it reads `snapshot.waveProgress` and does not reconstruct it. For non-wave encounters, the field is `null`.
- Player HP is read from the single `PlayerSnapshot` in `snapshot.entities` (`hp`/`maxHp` from [snapshot-shape.md](snapshot-shape.md)). If `lossCondition.kind === 'none'`, HUD still renders the HP block: values are correct (`hp = maxHp` for the whole run by contract), and UX should not jump between combat and non-combat presets.
- Boss block reads `snapshot.bossHud`. When it is `null`, the block is hidden. Display phase name comes from `BossArchetype` ([content-archetypes.md](content-archetypes.md)) by the active boss `bossArchetypeId`; HUD can resolve it through `SessionDefinition` plus lookup or through a `kind: 'boss'` entity in `snapshot.entities` carrying `archetypeId`. Exact resolution path is an implementation detail. Contract: boss block is visible exactly when `bossHud !== null`.

### Menu and playable preset catalog

- Menu is data-driven: it displays a list of player-selectable modes and calls the session builder for the chosen one. Menu does not know concrete preset ids and does not contain `if`/`switch` by id for rendering.
- The source of truth for preset metadata (`displayName`, `description`, `visibleInMenu`, `order`) is the `# Session` partition of each `content/sessions/<presetId>.md`; see [content-authoring.md](content-authoring.md), "Multi-file areas". These fields live next to the preset itself (encounter list, `arenaId`/`playerId`/`loadoutWeaponIds`, etc.), not in a separate UI registry. A separate `playableModes.ts` file with its own `PlayableModeEntry` registry does not exist after the `sessions` area migrates to MD.
- Catalog is built as a **derived view** over generated `SESSION_PRESET_TEMPLATES` (typed as `as const satisfies Record<presetId, SessionPresetTemplate>` from the content library):
  ```ts
  // exact function name is an implementation detail
  function getPlayableModeCatalog(): ReadonlyArray<PlayableModeEntry> {
    return Object.values(SESSION_PRESET_TEMPLATES)
      .filter((preset) => preset.visibleInMenu)
      .sort((a, b) => a.order - b.order);
  }

  type PlayableModeEntry = Readonly<{
    presetId: keyof typeof SESSION_PRESET_TEMPLATES;
    displayName: string;
    description: string;
    order: number;
  }>;
  ```
  `PlayableModeEntry` remains a presentation type describing what menu needs, but its values come from templates and are not duplicated in a separate registry. This removes the two-source "catalog vs preset" problem.
- Build validation: every `presetId in keyof SESSION_PRESET_TEMPLATES` must have `visibleInMenu: boolean` and `order: number`. The "no two ways to say no data" rule from [content-archetypes.md](content-archetypes.md) applies: `order` is required even for `visibleInMenu: false` presets. Unknown `presetId` in code is a `tsc` error, not a runtime fallback, thanks to derived `keyof typeof`.
- `ModePreset` remains the minimal authoritative object (`{ id }`); fields `displayName`/`description` are **not** added to it. Display data belongs to presentation and is derived from templates, not attached to authoritative preset. This preserves the [content-boundaries.md](content-boundaries.md) rule: builder reads content library and options, output is `SessionDefinition`.
- At this revision, `visibleInMenu: true` catalog contains `campaign` (main run with boss) and `training` (short training without boss). Sandbox variants (`sandbox`, `sandbox-with-combat`) remain valid preset ids but have `visibleInMenu: false` and do not appear in menu: they are bring-up/development modes, not player-facing modes (see [session-definition.md](session-definition.md), sandbox section). Future catalog extension, for example `training-hard`, is a new `content/sessions/<id>.md` with `visibleInMenu: true`, not a change to this decision or UI code.
- `BuildOptions` from the menu are minimal: `seed` is generated by `UiShell` on mode selection; user options such as loadout, modifiers, or encounter customization are not introduced in this story (out of scope in [../stories/007-hud-and-menu.md](../stories/007-hud-and-menu.md)). Extending `BuildOptions` is a future [session-definition.md](session-definition.md) decision, not a local menu patch.

### Pause UX

- Pause UX is already defined in [input-commands.md](input-commands.md): `Esc`/`Space` open overlay, `KeyP` remains dev pause without overlay, "Exit to menu" calls `stopSession`, and Pointer Lock moves correctly between states.
- `UiShell` is the only place that actually calls `SimWorkerHost.pause()`/`.resume()`. Hotkeys `Esc`/`Space`/`KeyP` and overlay buttons route through `UiShell`; direct `pause/resume` calls from event handlers outside `UiShell` are forbidden. This avoids double pause and drift between UI `paused` phase and simulation `isPaused()`.
- HUD remains visible and frozen: `UiShell` skips `Hud.update()` while in `paused`. Pause overlay draws above HUD by z-order.
- The "Exit to menu" button in `paused` triggers `paused -> menu`: `UiShell` calls `SimWorkerHost.stopSession()` and detaches HUD. No "are you sure?" prompt is introduced in 007; result screen is not substituted here (`stopSession` is not a loss).

### Result UX

- On `win`/`loss` from sim, `UiShell` transitions to `result(win|loss)`. This is the only sanctioned trigger for result phase.
- Result UI is a separate component in `src/main/ui/**`; exact filename is an implementation detail. It is intentionally not attached to `MenuOverlay`, so menu overlay does not own both start screen and run summary.
- After story 024, terminal `win`/`loss` event must carry `SessionResultSummary` ([session-result-summary.md](session-result-summary.md)). `UiShell` stores this summary as part of result phase and passes it to Result UI. Result UI does not reconstruct stats from `death`/`dropPickup` event history and does not read `SnapshotPair` after run end.
- Result presentation may build `ResultViewModel` from `SessionDefinition`, `SessionResultSummary`, shared content registries, and visual registries. This is a main-thread derivation: Result UI does not import `src/sim/**` and does not access `SimWorkerHost`.
- Win/loss result effects are DOM/CSS presentation-only inside Result UI. Gameplay `Renderer` is destroyed in `result`, so fireworks or slime droplets are not arena-renderer effects and require no snapshot fields.
- In `result`, exactly one action is available: "Menu" (`result -> menu`). No retry, stats, or share actions are introduced in 007. They are future Result UI extensions.
- On `result -> menu`, `UiShell` clears internal "last result" state and shows a clean start screen. Result history is not persisted; `client settings` are not used for this ([content-boundaries.md](content-boundaries.md)).

### Settings overlay

- Settings overlay is a `src/main/ui/**` component; exact filename is an implementation detail. It **does not** become a `UiShell` phase and **must not** manipulate `SimWorkerHost.pause/resume`, `startSession`/`stopSession`, or HUD/Pause/Result/Menu overlay visibility. It is a pure sub-modal over the current phase.
- It is reachable from exactly two places:
  1. `MenuOverlay` in `menu`, through "Settings" next to mode selection;
  2. `PauseOverlay` in `paused`, through "Settings" next to "Resume" / "Exit to menu".
  In `running`, `result`, `loading`, and `error('preload')`, settings overlay is unavailable. In `running`, the player must pause first ([input-commands.md](input-commands.md)); this preserves the rule that overlays do not appear over a live scene without explicit pause. In `loading`, there is no Renderer to apply `renderScalePreset` and no sample playback to hear `masterVolume`; in `error('preload')`, the only sanctioned action is page reload.
- Opening/closing settings overlay has exactly one orchestration effect: `UiShell` shows/hides the component. It does not trigger transitions between `menu`/`paused`/`running`/`result`: opened in `paused`, closing returns to the same `Pause overlay` underneath; opened in `menu`, closing returns to mode selection.
- No other overlay appears above settings overlay at the same time. Z-order: Settings overlay above Pause/Menu overlays and below Result UI. Result UI and Settings overlay never coexist by construction because settings is unavailable in `result`. Numeric `z-index` is an implementation detail.
- Pointer Lock is already released by the browser in `paused` ([input-commands.md](input-commands.md)); opening/closing settings overlay in `paused` does not change it. In `menu`, Pointer Lock is not requested, and settings overlay does not touch it.
- The source of truth for values edited by settings overlay is `ClientSettingsStore` ([client-settings.md](client-settings.md)). On each player action, such as dragging volume slider or selecting render scale preset, overlay calls the corresponding `store.set*`. `UiShell` has already subscribed `Audio` to the store for `masterVolume` through `audio.setMasterGain` (see [audio.md](audio.md)) and `Renderer` for `renderScalePreset` through `renderer.applyScalePolicy` (see [render-scale.md](render-scale.md)). Changes apply live in the same phase, without restarting session and without special overlay logic.
- Settings overlay **must not** access `SimWorkerHost`, `Audio`, or `Renderer` directly. This preserves the "single orchestration owner is `UiShell`" invariant and keeps overlay as a pure presentation component.
- In `menu`, `Renderer` does not yet exist ([client-settings.md](client-settings.md), "Applying settings"); changing `renderScalePreset` in `menu` is still correct: store persists the value and the next `Renderer` reads it. No delayed application state is needed outside the store.
- Settings overlay buttons, including buttons inside the overlay and entry buttons from `MenuOverlay`/`PauseOverlay`, play through `audio.playUi('buttonClick')` like other UI buttons ([audio.md](audio.md)). Opening settings overlay itself **does not** play `events.uiOverlayShow`; that sound is reserved for transitions into `paused` and `result(*)` ([audio.md](audio.md)) and is not duplicated for every sub-modal.

### Renderer and input lifecycle within phases

- In `loading` and `error('preload')`, `Renderer` and `InputController` **do not exist**. Creating `THREE.WebGLRenderer` and subscribing to input events is deferred until the first `menu -> running`. This keeps `loading` cheap and guarantees preload does not compete with gameplay GPU/canvas work.
- `Renderer` and `InputController` are created by `UiShell` on `menu -> running` and destroyed on transition to `menu` (explicit exit) or `result` (`win`/`loss`). This preserves the existing `src/main/index.ts` model but moves it to a single owner.
- When creating `Renderer`, `UiShell` passes the same immutable `SessionDefinition` as to `SimWorkerHost.startSession()` and `Hud.attach()`. `Renderer` uses only presentation config from it: `backgrounds` and `encounters[].backgroundId`. Background switches by `snapshot.encounter.id`; no snapshot field is added because active encounter id is already authoritative runtime state from [snapshot-shape.md](snapshot-shape.md), and id-to-background mapping belongs to session configuration. One background tile's world-unit size is derived from loaded image pixels through the same `PX_PER_WU` as sprite assets ([sprite-assets.md](sprite-assets.md)); renderer does not stretch the image to arena size, it repeats it as a texture pattern across the arena.
- Arena background is a presentation-only layer inside render scene. If active encounter has no background (`backgroundId: null`) or snapshot does not yet contain encounter, renderer shows neutral arena floor. Unknown ids must be caught by `content:build`/builder, not become runtime fallback.
- In `paused`, `Renderer` continues rendering each frame; the picture does not freeze at the exact moment pause is received, it draws the last interpolated frame. `InputController` remains connected, but Pointer Lock is released by the browser ([input-commands.md](input-commands.md)). HUD is frozen, as above.
- In `result`, `Renderer` and `InputController` are destroyed. The screen contains only Result UI; canvas underneath may remain empty/black. This is explicit: "arena keeps moving behind the player death screen" is an unwanted artifact, and the contract excludes it.
- Render backend change in 010, main vs render worker through `OffscreenCanvas`, lives inside `Renderer` and does not break the `UiShell` phase model.
- Runtime events from `SimWorkerHost.onEvent` remain centralized in `UiShell`. For render-only impact feedback, `UiShell` forwards the event to `renderer.handleEvent(event)`, if renderer exists, after audio routing and before shell-level transition handling. `Renderer` filters interesting `kind` values internally and does not subscribe to `SimWorkerHost` directly. Full impact event fan-out contract: [impact-feedback.md](impact-feedback.md).

### Startup preload in `loading`

- `UiShell` starts in `loading` and **before** `menu` must run startup preload: sprite textures by [sprite-assets.md](sprite-assets.md) and required first-screen UI assets by [menu-and-startup-presentation.md](menu-and-startup-presentation.md). Lazy-loading these required assets in `menu`/`running`/`paused`/`result` is forbidden.
- Splash timing must no longer fake asset progress. Intentional minimum presentation pause lives as post-load ritual in [menu-and-startup-presentation.md](menu-and-startup-presentation.md), after successful asset loading and decoding.
- Sprite texture list comes from visual registries in `src/main/render/**`; preload does not know content registry directly and does not parse MD. `image` is already fixed in generated data. First-screen UI asset list comes from the static presentation list in [menu-and-startup-presentation.md](menu-and-startup-presentation.md).
- Preload progress (loaded count / total) is passed by callback to `StartupOverlay`. Textures count as ready only after successful decoding; a partially decoded bitmap is not exposed to renderer even briefly.
- Any load or decode failure for any required asset is the only sanctioned trigger for `loading -> error('preload')`. `UiShell` records the first failure (URL + browser message) and passes it to `StartupErrorOverlay`. Parallel loads are aborted; there is no partial-success mode.
- `SimWorkerHost.startSession` is not called in `loading`. The worker may be initialized empty, without a session, but that is an implementation detail.
- `Audio.unlock()` is not called in `loading`: audio context still waits for the first user gesture ([audio.md](audio.md)). Silent splash is expected.
- In `loading`, `ClientSettingsStore` is already available: creating it does not require worker or Renderer. UI forbids changing settings in `loading` because Settings overlay is unavailable, but programmatic reads are allowed; this is used on first `menu -> running`, see [render-scale.md](render-scale.md).

### Intersection with input-commands

- Pause hotkeys and Pointer Lock are owned by [input-commands.md](input-commands.md). This file only defines that the **router** for `Esc`/`Space`/`KeyP`/Pointer-Lock-loss is `UiShell`, and that `running <-> paused` transitions are the only sanctioned player-facing pause effect on the UI side.
- `Space` and `KeyP` behavior is defined in [input-commands.md](input-commands.md). `UiShell` must follow that behavior and must not introduce parallel pause hotkeys.

## Consequences

- 007 gets a compact, testable scheme: one orchestrator, finite phases, predefined actions and visibility. Tests can target the phase table instead of global `index.ts` state.
- HUD remains headless with respect to simulation: it can be tested with plain `SessionDefinition` + `SnapshotPair`, without worker or DOM event emulation.
- Snapshot is not extended for HUD aggregates such as wave number/total waves: they derive from `SessionDefinition.encounters` + `snapshot.encounter`. This keeps [snapshot-shape.md](snapshot-shape.md) minimal for 008/009/010.
- Menu becomes data-driven: adding a playable preset means adding one catalog/template entry and a builder branch, without UI code changes.
- Result UI is separate from menu: 008 (audio) and 009 (settings) can extend the menu start screen without touching final-screen UX.
- Pause UX stops being an `index.ts` handler that also talks to sim. The single `SimWorkerHost.pause/resume` call site makes debugging and determinism audits easier.
- Future extensions such as audio events for HUD, settings overlay from menu, or in-run notifications have an obvious integration point: `UiShell`, not scattered sites in `src/main/index.ts`.

## Related

- [thread-model.md](thread-model.md)
- [session-definition.md](session-definition.md)
- [snapshot-shape.md](snapshot-shape.md)
- [runtime-systems.md](runtime-systems.md)
- [input-commands.md](input-commands.md)
- [content-boundaries.md](content-boundaries.md)
- [content-archetypes.md](content-archetypes.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [simulation-timing.md](simulation-timing.md)
- [client-settings.md](client-settings.md)
- [audio.md](audio.md)
- [render-scale.md](render-scale.md)
- [sprite-assets.md](sprite-assets.md)
- [web-stack.md](web-stack.md)
- [boss-encounter.md](boss-encounter.md)
- [zone.md](zone.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [../docs/VISION.md](../docs/VISION.md)
- [../stories/007-hud-and-menu.md](../stories/007-hud-and-menu.md)
- [../stories/009-settings.md](../stories/009-settings.md)
- [../stories/013-sprite-assets-and-loader.md](../stories/013-sprite-assets-and-loader.md)
- [../stories/015-sessions-from-md.md](../stories/015-sessions-from-md.md)
- [impact-feedback.md](impact-feedback.md)
- [encounter-presentation.md](encounter-presentation.md)
- [hud-presentation.md](hud-presentation.md)
- [menu-and-startup-presentation.md](menu-and-startup-presentation.md)
- [session-result-summary.md](session-result-summary.md)
- [escape-progress-path.md](escape-progress-path.md)
