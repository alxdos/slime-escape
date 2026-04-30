# Render Scale

- Status: accepted
- Created: 2026-04-20
- Updated: 2026-04-30 (story 031 follow-up: render scale preserves the active visible area from [camera-and-visible-area.md](camera-and-visible-area.md); story 031 prep also made fitting use the effective game viewport from mobile web support, not always raw `window.innerWidth` / `window.innerHeight`.)

## Context

[arena-and-coordinates.md](arena-and-coordinates.md) defines the "no hardware advantage" invariant for arena bounds and simulation, while [camera-and-visible-area.md](camera-and-visible-area.md) defines the active visible area that the camera shows. Render scale must not change either concept: window size and DPR affect only image pixel density. Visible-area fitting to the viewport is defined there as well (letterbox/pillarbox through CSS, canvas container uses visible-area aspect ratio, black bars are empty page body). [thread-model.md](thread-model.md) defines rendering as a separate `main thread` layer that supports two backend modes (main-thread and offscreen render worker), and says changing backend must not change the `simulation worker` contract. [client-settings.md](client-settings.md) introduced `renderScalePreset: 'low' | 'medium' | 'high'` in client settings and the subscriber model; this decision defines what each preset **does** to the canvas.

What is **not** defined yet:

- Concrete semantics of `low`/`medium`/`high` in terms of backing canvas pixels, CSS canvas size, and `image-rendering`.
- Where the policy lives (module, pure function from preset and viewport to concrete values).
- Who reinitializes the render target when the preset changes without restarting the session, and how.
- Which invariants must hold for every preset (gameplay, aim, fit).
- How 010 (offscreen render worker) reuses the same contract.

Without an explicit contract, 009 would lock preset rules inside `Renderer`, 010 would reopen them in the worker version, and the "no hardware advantage" invariant could be broken by any careless change (for example, tying the camera visible area to `canvas.width`).

This decision treats render scale policy as a separate concept between client settings and the render backend.

## Decision

### Location

- Render scale policy and application live under `src/main/render/**` (see [web-stack.md](web-stack.md)). The project gets no new root directories.
- No module in `src/main/render/**` may import from `src/main/settings/**`. The flow goes the other way: `UiShell` subscribes `Renderer` to `ClientSettingsStore` ([client-settings.md](client-settings.md)) and passes already computed policy to `Renderer` through an explicit API. This preserves the "render does not know about player UI" rule from [main-ui-shell.md](main-ui-shell.md).
- The pure function "preset + viewport + fit -> render target params" lives next to `fitCanvasToViewport` (see `src/main/render/**`); actual file name is an implementation detail. The contract is that the function is pure, side-effect-free, and does not access `window`.

### Preset semantics

Presets define **only** image pixel density. Logical canvas size, CSS size on both axes, and aspect ratio are defined by the active visible area from [camera-and-visible-area.md](camera-and-visible-area.md), [arena-and-coordinates.md](arena-and-coordinates.md), and `fitCanvasToViewport`; the preset affects:

- `pixelRatio`, passed into `WebGLRenderer.setPixelRatio` (the actual number of backing pixels per CSS pixel);
- the CSS `image-rendering` value on the `<canvas>` itself.

Let `cssWidthPx` and `cssHeightPx` be the canvas size in CSS pixels, already fitted to the effective game viewport through `fitCanvasToViewport` (see [arena-and-coordinates.md](arena-and-coordinates.md) and [mobile-web-support.md](mobile-web-support.md)); `dpr` is `window.devicePixelRatio` capped at `2`, as currently in `src/main/index.ts`.

| Preset | Backing-pixels canvas | CSS canvas size | `image-rendering` | Meaning |
|--------|------------------------|-------------------|--------------------|-----------|
| `low`    | `canvas.width = round(cssWidthPx / 4)`, `canvas.height = round(cssHeightPx / 4)` (minimum `1`); `setPixelRatio(1)` | `cssWidthPx × cssHeightPx` (unchanged) | `pixelated` | Cheapest mode: fewer pixels rendered, browser scales the image without smoothing. |
| `medium` | `cssWidthPx × cssHeightPx`, `setPixelRatio(1)` | `cssWidthPx × cssHeightPx` | `auto` (or unset) | One canvas pixel equals one browser pixel; `devicePixelRatio` is ignored. Neutral default. |
| `high`   | `cssWidthPx × cssHeightPx`, `setPixelRatio(dpr)` | `cssWidthPx × cssHeightPx` | `auto` (or unset) | Full retina rendering: backing pixels = CSS pixels × DPR. |

Preset semantics are expressed as a pure function:

```ts
type RenderScalePreset = 'low' | 'medium' | 'high';

type RenderScaleResolution = Readonly<{
  cssWidthPx: number;       // canvas width in CSS pixels (from fitCanvasToViewport)
  cssHeightPx: number;      // canvas height in CSS pixels (from fitCanvasToViewport)
  backingWidthPx: number;   // canvas.width after applying the preset
  backingHeightPx: number;  // canvas.height after applying the preset
  pixelRatio: number;       // argument to WebGLRenderer.setPixelRatio
  imageRendering: 'auto' | 'pixelated';
}>;

function resolveRenderScale(input: Readonly<{
  preset: RenderScalePreset;
  cssWidthPx: number;
  cssHeightPx: number;
  devicePixelRatio: number;
}>): RenderScaleResolution;
```

Concrete thresholds (`/4` for `low`, `min(devicePixelRatio, 2)` for `high`) live in this function, not in `Renderer` or the settings overlay. Any value adjustment means editing this decision and `resolveRenderScale`.

### Invariants shared by all presets

- The active visible area **does not change** between presets. The camera is orthographic and its frustum is the current visible area from [camera-and-visible-area.md](camera-and-visible-area.md); no preset changes the frustum, visible-area size, or camera center.
- Canvas CSS size, aspect ratio, and letterbox/pillarbox bars **do not change** between presets. The preset affects only backing pixels and `image-rendering`.
- Pointer-to-world mapping uses canvas CSS size (`clientHeight`/`clientWidth`), not backing pixels. `UiShell` provides this through the active visible area, for example `canvas.clientHeight / visibleArea.height`. Any attempt to read `canvas.width`/`canvas.height` for aim calculation violates this decision.
- `fitCanvasToViewport` remains the only source of canvas CSS size; render scale runs "after" it and does not recalculate aspect/letterbox. Mobile support may change the effective viewport passed into that function, but render scale still does not read raw orientation state itself.
- No gameplay system in `src/sim/**` or `src/shared/content/**` may read `canvas.width`/`canvas.height`/`devicePixelRatio`/`renderScalePreset`. Render scale is purely a presentation setting.
- Changing the preset **must not** change the outcome of a run with the same `seed` (same invariant as all client settings; see [client-settings.md](client-settings.md), [content-boundaries.md](content-boundaries.md)).

### `Renderer` lifecycle and API

- `Renderer` is created by `UiShell` on `menu → running` and destroyed when leaving `running`/`paused` ([main-ui-shell.md](main-ui-shell.md)). During its lifetime, it is the only owner of canvas properties that affect pixels:
  - `canvas.width` / `canvas.height` (backing pixels);
  - `canvas.style.width` / `canvas.style.height` (CSS sizes);
  - `canvas.style.imageRendering`;
  - `WebGLRenderer.setPixelRatio` / `WebGLRenderer.setSize`.
- `Renderer` receives the current `RenderScalePreset` through `RendererInit` (replacing/extending the existing `pixelRatio` field), and supports an explicit method for changing it live:
  ```ts
  type Renderer = Readonly<{
    render(): void;
    fitToWindow(): void;
    applyScalePolicy(preset: RenderScalePreset): void;
    dispose(): void;
  }>;
  ```
- `applyScalePolicy(preset)` must:
  1. Compute `RenderScaleResolution` through `resolveRenderScale`, using the current canvas CSS size (already correctly fitted through `fitCanvasToViewport`) and current `devicePixelRatio`.
  2. Apply `imageRendering` to `canvas.style`.
  3. Call `WebGLRenderer.setPixelRatio(pixelRatio)`.
  4. Call `WebGLRenderer.setSize(cssWidthPx, cssHeightPx, false)` (the third argument `false` keeps CSS sizes unchanged, which is critical for the invariant "canvas CSS size does not change between presets").
- After viewport changes, `fitToWindow` also applies the current preset again (recomputes `RenderScaleResolution` from new CSS sizes and updates backing). This gives the invariant "after any resize, backing density matches the active preset".
- `applyScalePolicy` **does not** require rebuilding the whole `THREE.Scene`, entity meshes, or shaders. Web Audio-style "target reinitialization" here means exactly resizing backing canvas and reapplying pixel ratio on the same `WebGLRenderer`, which `WebGLRenderer.setPixelRatio` + `setSize` already do. The scene and uniforms (including zone overlay `uHalfSize`) do not depend on backing pixels and need no recalculation.
- `applyScalePolicy(preset)` is idempotent: repeating it with the same preset and same CSS sizes performs the same steps and creates no visual artifact. `ClientSettingsStore` already does not call listeners when the value is unchanged ([client-settings.md](client-settings.md)), so store-driven repeated calls will not happen, but `fitToWindow` may reapply on every resize.

### Default and startup

- On the first `menu → running`, `Renderer` is created with `renderScalePreset` from `ClientSettingsStore.get()`. If the store does not exist (tests), `Renderer` receives an explicitly passed preset; `Renderer` has no hardcoded default. The only default source, `'medium'`, lives in [client-settings.md](client-settings.md).
- `UiShell` owns the `ClientSettingsStore.subscribe` subscription for `renderScalePreset` changes. `Renderer` has no subscription: it is headless relative to `ClientSettingsStore` and can be tested without it.
- In the `menu` phase, `Renderer` does not exist, so there is nowhere to apply policy. This is fine: the next `Renderer` will be created with the current preset from the store. No pending applications need to be stored outside `Renderer`.

### Compatibility with 010 (offscreen render worker)

- The `Renderer` contract (`render`/`fitToWindow`/`applyScalePolicy`/`dispose`) does not depend on where `three.js` physically runs: on the `main thread` or in a render worker through `OffscreenCanvas`.
- In the offscreen variant, `applyScalePolicy(preset)` is forwarded to the render worker as a message; the worker calls analogous `setPixelRatio` / `setSize` on the `OffscreenCanvas` side. CSS properties (`style.width`/`style.height`/`style.imageRendering`) are applied on main because DOM remains on main ([thread-model.md](thread-model.md)).
- `resolveRenderScale` remains a pure function in `src/main/render/**` and is reused by both backends. 010 does not introduce its own copy.
- Changing preset in the offscreen variant does not require recreating the render worker. If a specific browser does require recreating `OffscreenCanvas` for backing-size changes, that is specified inside 010 as a backend implementation detail, not a policy contract.

### Tests

- `resolveRenderScale` is tested as a pure function:
  - `low` with `cssWidthPx=800, cssHeightPx=600, dpr=2` -> `backing=200×150`, `pixelRatio=1`, `imageRendering='pixelated'`;
  - `medium` with the same input -> `backing=800×600`, `pixelRatio=1`, `imageRendering='auto'`;
  - `high` with the same input -> `backing=800×600`, `pixelRatio=2`, `imageRendering='auto'`;
  - degenerate `cssWidthPx ≤ 0` -> backing minimum `1×1`, no crash (symmetric with current `fitCanvasToViewport`, which returns `0×0` and does not crash).
- `Renderer.applyScalePolicy(preset)` is tested without real WebGL/DOM: `THREE.WebGLRenderer` is wrapped in a narrow API in tests, as already done for audio and input. Required under test:
  - `setPixelRatio` called with `1` for `low` and `medium`, with `min(dpr, 2)` for `high`;
  - `setSize(cssW, cssH, false)` called (third argument `false`);
  - `canvas.style.imageRendering = 'pixelated'` for `low`, `'auto'`/empty for the others;
  - repeated `applyScalePolicy(samePreset)` gives the same visual result (idempotence);
  - `fitToWindow` after resize applies the current preset (calls `setPixelRatio`/`setSize` in the correct order).
- Tests do not introduce regressions for [arena-and-coordinates.md](arena-and-coordinates.md) or [camera-and-visible-area.md](camera-and-visible-area.md): active visible area and `fitCanvasToViewport` do not change between render-scale presets.

## Consequences

- 009 gets a compact contract: the settings overlay changes `renderScalePreset` in the store; `Renderer` accepts the preset through `applyScalePolicy`; `resolveRenderScale` is the single source of truth for numeric values.
- 010 (offscreen render worker) reuses the same `applyScalePolicy` and `resolveRenderScale`, without opening a parallel contract.
- The render-scale part of the "no hardware advantage" invariant has a place where tests can check it: no preset changes camera frustum, visible-area state, canvas CSS size, or aim mapping.
- `Renderer` gets explicit API `applyScalePolicy` instead of an implicit dependency on `pixelRatio` in init. The old `pixelRatio: number` in `RendererInit` is either replaced with `renderScalePreset: RenderScalePreset` or becomes an initial value after which the real source of truth is `applyScalePolicy`. The exact implementation step is a detail; the contract is that `applyScalePolicy` is the only legitimate way to change preset.
- Cost: one function (`resolveRenderScale`) and one method on `Renderer` (`applyScalePolicy`). Extending the preset list or changing their semantics requires editing this decision and `resolveRenderScale`, not local edits in the settings overlay.
- This decision explicitly rejects splitting presets into separate axes ("fxaa", "msaa", "postprocessing"). Those are extensions of this file, not silent additions inside `Renderer`.

## Related

- [arena-and-coordinates.md](arena-and-coordinates.md)
- [camera-and-visible-area.md](camera-and-visible-area.md)
- [thread-model.md](thread-model.md)
- [main-ui-shell.md](main-ui-shell.md)
- [client-settings.md](client-settings.md)
- [web-stack.md](web-stack.md)
- [testing.md](testing.md)
- [../stories/009-settings.md](../stories/009-settings.md)
- [../stories/010-render-pipeline-offscreen.md](../stories/010-render-pipeline-offscreen.md)
- [mobile-web-support.md](mobile-web-support.md)
