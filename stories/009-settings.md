# Settings

- Status: done
- Created: 2026-04-19
- Updated: 2026-04-20

## Player-facing

- Sees: a settings screen reachable from the menu and from pause. A volume slider and an arena resolution selector: `low` / `medium` / `high`.
- Can do: change volume and resolution on the fly with an immediate visible effect; settings persist across launches.

Resolution semantics:

| Preset | Render scale |
|--------|--------------|
| low    | the arena is rendered at roughly 1/4 of the horizontal pixel count and scaled to the screen width without smoothing (`image-rendering: pixelated`); the cheapest mode |
| medium | one canvas pixel = one browser pixel; `devicePixelRatio` is ignored |
| high   | render 1:1 honouring `devicePixelRatio` (retina-friendly) |

## Technical

- `ClientSettingsStore` under `src/main/settings/**`: fields `masterVolume` and `renderScalePreset`, `localStorage` with `schemaVersion`, validation/clamping/migrations, subscriber model — contract in [../design/client-settings.md](../design/client-settings.md).
- Volume drives the audio graph master gain through an explicit `Audio.setMasterGain` — API extension in [../design/audio.md](../design/audio.md) (section "Settings integration (009)"). Per-bus volume for `sfx`/`music`/`ui` is explicitly out of scope in 009.
- Render scale policy in `src/main/render/**`: a pure `resolveRenderScale(preset, cssSize, dpr)` and `Renderer.applyScalePolicy(preset)` to reinitialise the render target without restarting the session — contract in [../design/render-scale.md](../design/render-scale.md). The "no hardware advantage" invariant from [../design/arena-and-coordinates.md](../design/arena-and-coordinates.md) is preserved: the preset only affects pixel density.
- The settings overlay is a `UiShell` sub-modal accessible from `MenuOverlay` and `PauseOverlay` and does not change the `UiShell` phase — section "Settings overlay" in [../design/main-ui-shell.md](../design/main-ui-shell.md). `Audio` and `Renderer` subscribe to the store on the `UiShell` side, the only orchestrator.
- `client settings` does not leak into `SessionDefinition`/snapshot/runtime events — a direct consequence of [../design/content-boundaries.md](../design/content-boundaries.md), pinned in [../design/client-settings.md](../design/client-settings.md).

## Out of scope

- Controls and key rebinding.
- Languages and localisation.
- Separate sfx/music/ambient buses — master gain is enough for now.
- Cross-tab settings sync (`window 'storage'` event).

## Acceptance

- Settings are reachable from the menu and from pause; changes apply immediately.
- Volume affects all in-game sounds.
- Each of the three resolution presets differs visually and in load as expected: `low` — noticeably more pixelated and faster, `medium` — native pixels, `high` — sharp picture on retina.
- Selected values persist across page reloads.
- The default resolution preset is a sensible choice (for example `medium`).

## Tasks

Full breakdown (story is `in-progress`). Task order reflects dependencies: foundational changes in `Audio`/`Renderer` first, the store next, wiring in `UiShell` after that, the UI overlay and entry points last. All foundational `design/` updates were made during preparation, so they are not repeated as tasks.

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | In `src/main/audio/Audio.ts` decompose `effectiveGain` across graph nodes: `perSourceTrim.gain.value = sample.normalizedGain * sample.defaultGain * (perCallGainMul ?? 1)`; the `bus` and `master` stay full nodes in the graph. Update `Audio.test.ts` (`calculateEffectiveGain` and per-node assignment tracing). | Cuts the existing double application of `bus*master`. Per [../design/audio.md](../design/audio.md), "Mixer graph" and "Two-layer volume" sections. Audio at baseline is unchanged (`bus`/`master` start at `1.0`). |
| T2 | [x] | Add `Audio.setMasterGain(value: number): void` to `src/main/audio/Audio.ts` and to the public `Audio` type: clamp to `[0, 1]`, warning via `log` for out-of-range, no-op on equal value, valid in any state (before `unlock`, in `menu`/`paused`/`result`, before and after `attach`/`detach`). Tests in `Audio.test.ts`. | Per [../design/audio.md](../design/audio.md), "Settings integration (009)". Depends on T1. |
| T3 | [x] | A pure `resolveRenderScale` function in `src/main/render/**` with the full preset table from the design and tests for every preset (including the degenerate `cssWidthPx ≤ 0`). | Per [../design/render-scale.md](../design/render-scale.md), "Preset semantics". No `Renderer` changes — pure function. |
| T4 | [x] | Move `Renderer` from `pixelRatio: number` in `RendererInit` to `renderScalePreset: RenderScalePreset`; add `applyScalePolicy(preset)` (calls `setPixelRatio`/`setSize(_, _, false)` and updates `canvas.style.imageRendering`); `fitToWindow` reapplies the current preset. Update `src/main/index.ts` (passes the initial preset instead of `Math.min(window.devicePixelRatio, 2)`) and `UiShell` (passes the preset when creating `Renderer`). Tests in the `Renderer` suite via a narrow `WebGLRenderer`-like wrapper. | Per [../design/render-scale.md](../design/render-scale.md), "Renderer lifecycle and API". Depends on T3. |
| T5 | [x] | Create `src/main/settings/**` with `ClientSettingsStore`: the `ClientSettings`/`RenderScalePreset` types, `DEFAULT_CLIENT_SETTINGS` (`masterVolume = 1`, `renderScalePreset = 'medium'`), a narrow `StorageApi` (`getItem`/`setItem`/`removeItem`) with a browser wrapper and a test fake; read/validate/clamp/overwrite a corrupted snapshot per the design rules; `setMasterVolume`/`setRenderScalePreset` (clamp + no-op on equal value + synchronous write + synchronous subscribers in registration order); `subscribe`/`dispose`. Tests for every scenario in the design's "Tests" section. | Per [../design/client-settings.md](../design/client-settings.md). Independent of T1–T4 (can run in parallel). |
| T6 | [x] | In `UiShell` create `ClientSettingsStore` exactly once (next to `Audio`/`SimWorkerHost`/`Hud`); apply the initial `masterVolume` to `Audio` via `setMasterGain` and subscribe `Audio` to changes; when creating `Renderer` (`menu → running`) pass the current `renderScalePreset` into `RendererInit` and subscribe `Renderer.applyScalePolicy` to changes, unsubscribing in `tearDownClientSession`; call `store.dispose()` in `UiShell.dispose()`. Tests in `UiShell.test.ts`. | Per [../design/client-settings.md](../design/client-settings.md), "Applying settings", and [../design/main-ui-shell.md](../design/main-ui-shell.md). Depends on T2, T4, T5. |
| T7 | [x] | Implement `SettingsOverlay` in `src/main/ui/**`: a slider `masterVolume → store.setMasterVolume`, a three-button selector `low`/`medium`/`high → store.setRenderScalePreset`, a Close button. The overlay reads the current snapshot via `store.get()` and subscribes to changes to keep its UI state in sync. No direct `Audio`/`Renderer`/`SimWorkerHost` calls from the overlay. Tests for the control wiring and unsubscribe on `dispose`. | Per [../design/main-ui-shell.md](../design/main-ui-shell.md), "Settings overlay". Depends on T5. |
| T8 | [x] | Entry points and orchestration: add a "Settings" button to `MenuOverlay` and to `PauseOverlay`; add `openSettings()`/`closeSettings()` to `UiShell` to show/hide `SettingsOverlay` over the current phase (`menu` or `paused`), not changing `UiShellPhase`, not touching Pointer Lock and not poking `SimWorkerHost`; unavailable in `running`/`result`. Each click ("Settings", "Close", and overlay buttons) plays `audio.playUi('buttonClick')`. Tests in `UiShell.test.ts` (visibility per phase, no phase transition, correct z-order via DOM check). | Per [../design/main-ui-shell.md](../design/main-ui-shell.md), "Settings overlay". Depends on T7. |

## Related

- [../design/client-settings.md](../design/client-settings.md)
- [../design/render-scale.md](../design/render-scale.md)
- [../design/audio.md](../design/audio.md)
- [../design/main-ui-shell.md](../design/main-ui-shell.md)
- [../design/arena-and-coordinates.md](../design/arena-and-coordinates.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/thread-model.md](../design/thread-model.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/logging.md](../design/logging.md)
- [../docs/SCOPE.md](../docs/SCOPE.md)
