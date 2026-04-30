# Client Settings

- Status: accepted
- Created: 2026-04-20
- Updated: 2026-04-20

## Context

[content-boundaries.md](content-boundaries.md) already split data into four levels and placed "volume", "quality/render-scale policy", and UI-level preferences in `client settings`, explicitly stating that they are **not** part of `SessionDefinition`, **do not** affect authoritative state, and do not change the outcome of a run with the same `seed`. [thread-model.md](thread-model.md) states that DOM/UI/audio/render live on the `main thread`. [audio.md](audio.md) already described master/per-bus gain as graph nodes and explicitly named 009 as the place that "turns and saves" these values, without defining its own volume contract. [arena-and-coordinates.md](arena-and-coordinates.md) defines the "no hardware advantage" invariant: window size, DPR, and render scale from 009 affect only pixel density, **not** arena bounds, spawning, or balance; [camera-and-visible-area.md](camera-and-visible-area.md) owns presentation camera sizing separately.

What is **not** defined yet:

- Where the client settings store physically lives, its shape, and the shape of its `localStorage` snapshot.
- Who creates it, who reads it, and who writes it.
- How changing settings reach subscribers (Audio, Renderer) **live**, without restarting the session.
- How broken/outdated data in `localStorage` is handled (migrations, validation, defaults).
- Which concrete fields live in client settings for the 009 horizon.

Without this decision, 008 would have already locked in a magic volume point in code, and 009 would lock persistent storage locally inside the settings overlay. The same would happen for render scale and all future presentation settings (accessibility, mouse sensitivity, UI options).

This decision defines the shared client settings store contract for the MVP horizon. It **does not** add fields beyond those needed by 009, and **does not** cover per-bus volume, rebinding, or localization (see [../stories/009-settings.md](../stories/009-settings.md), `Out of scope`).

## Decision

### Location

- Client settings store lives under `src/main/settings/**`. The project gets no new root directories (see [web-stack.md](web-stack.md)).
- No module in `src/main/settings/**` may import from `src/sim/**` or `src/shared/content/**`. Settings are main-thread presentation data: they never enter `SessionDefinition`, are not serialized as session contract, and do not participate in snapshot/runtime event generation. This follows directly from [content-boundaries.md](content-boundaries.md).
- `src/sim/**` and `src/shared/**` **must not** import from `src/main/settings/**`. If simulation needs a "configurable" value, it is a content parameter and lives in `src/shared/content/**`, not in client settings.
- The registry of fields and their types lives in one file under `src/main/settings/**` (actual file name is an implementation detail). Extending the registry means adding a field there and updating this decision; introducing a local slice of persistent storage in overlay or system code is forbidden.

### Client settings fields for 009

For the MVP, client settings have exactly two fields:

```ts
type RenderScalePreset = 'low' | 'medium' | 'high';

type ClientSettings = Readonly<{
  masterVolume: number;            // [0, 1], where 0 is silence and 1 is no attenuation
  renderScalePreset: RenderScalePreset;
}>;
```

- `masterVolume` multiplies the audio graph master gain ([audio.md](audio.md)). Values outside `[0, 1]` are clamped before application and logged as warnings through the shared log module ([logging.md](logging.md)).
- `renderScalePreset` is the only axis by which 009 controls rendering. Preset semantics and render-target reinitialization belong to [render-scale.md](render-scale.md); this file only records that the value is stored here and reaches rendering through the same subscriber mechanism.
- Extending fields (for example, `sfxVolume`, `musicVolume`, separate aim sensitivity) is a separate decision, an update to this file, and a synchronous update to [audio.md](audio.md)/[render-scale.md](render-scale.md) when needed. Local additions in the settings overlay or system code are forbidden.

### Defaults

```ts
const DEFAULT_CLIENT_SETTINGS: ClientSettings = {
  masterVolume: 1,
  renderScalePreset: 'medium'
};
```

- `masterVolume = 1` matches the baseline audio graph from [audio.md](audio.md) (`master`/`bus` start at `1.0`); with no saved data, the player hears exactly what they would hear in 008.
- `renderScalePreset = 'medium'` means "one canvas pixel = one browser pixel, `devicePixelRatio` ignored" ([../stories/009-settings.md](../stories/009-settings.md)). It is a reasonable neutral default: it does not pixelate the image and does not put full-DPR load on retina devices.
- Defaults apply on the **first** launch (no `localStorage` key) and on **any** read/validation error; see below.

### Persistence: format and migrations

- Persistence is `localStorage`. This is enough for the MVP: one user per device, no cross-device sync; sandbox/iframe scenarios are not introduced in 009.
- One `localStorage` key stores the whole client settings snapshot, JSON-serialized:
  ```
  key: 'slime-escape:client-settings'
  value: JSON.stringify({ schemaVersion: 1, masterVolume, renderScalePreset })
  ```
- `schemaVersion` is **required**. Current version is `1`.
- Read algorithm at app startup:
  1. Read the string by key. `null` or unavailable `localStorage` (Safari private mode, etc.) -> use `DEFAULT_CLIENT_SETTINGS`, **do not** write anything back (the store works without writes; persistence is simply disabled).
  2. Parse JSON. Parse error -> warning in log, use defaults, **overwrite** the key with the default snapshot (broken data should not remain forever).
  3. Read `schemaVersion`. If `schemaVersion === 1`, validate fields (see below).
  4. If `schemaVersion` is unknown (newer or arbitrary) -> warning, use defaults, overwrite the key with the default snapshot. This mirrors "unknown archetype id is an error/overwrite", but without failing app startup: client settings must not block the game.
  5. Future migrations (`schemaVersion: 1 → 2`, etc.) are explicit conversion tables in this same file; do not add them before real need.
- Field validation algorithm:
  - `masterVolume` — number in `[0, 1]`. Non-number / NaN / out of range -> clamp into `[0, 1]` for numbers, otherwise default; warning in log.
  - `renderScalePreset` — one of `'low' | 'medium' | 'high'`. Anything else -> default; warning in log.
  - Extra fields are silently ignored (forward compatibility for future extensions).
  - Missing fields are replaced with defaults without warning (a partially filled snapshot is a normal case when adding a new field to an existing install).
- Writes to `localStorage` are **synchronous** on every store change. This is acceptable: settings changes are rare (volume slider drag is tens of writes per second in the worst case), and `JSON.stringify` of a tiny object is cheaper than introducing debouncing and rules for losing the final value. If this ever becomes a bottleneck, it is a separate decision, not a local edit.
- `localStorage` write error (quota, browser denial) is logged as a warning; the store keeps working in memory, and the next successful write restores persistence.

### Store API

- Store is created exactly once at `UiShell` startup (next to `Audio`, `SimWorkerHost`, `Hud`). Reinitialization is not part of the MVP.
- Minimal API:
  ```ts
  type ClientSettingsStore = Readonly<{
    get(): ClientSettings;
    setMasterVolume(value: number): void;
    setRenderScalePreset(preset: RenderScalePreset): void;
    subscribe(listener: (settings: ClientSettings) => void): () => void;
    dispose(): void;
  }>;
  ```
- `get()` always returns an already valid, clamped/normalized snapshot; consumers do not repeat validation.
- `setMasterVolume`/`setRenderScalePreset`:
  - clamp/validate input;
  - if the value did **not** change semantically (after clamp it equals current), it is a **no-op**: listeners are not called and nothing is written to `localStorage`. This is critical for UX where a slider can generate many events with the same result, and for render scale where reapplying the same preset must not churn renderer init.
  - if it changed, update in-memory state, synchronously write the whole snapshot to `localStorage`, and synchronously call all subscribers.
- `subscribe(listener)` returns an unsubscribe function. Listeners are called **synchronously** in registration order. This gives deterministic order such as "Audio applies gain first, then Renderer rebuilds target" when both listen to one store.
- `dispose()` removes all subscribers and stops writing to `localStorage`. Used in `UiShell.dispose()`.

Store **does not** use `window.addEventListener('storage', ...)`: cross-tab sync is not needed for the MVP and would introduce nontrivial edge cases (overwriting settings in the focused tab during slider drag). If it is ever needed, it is a separate decision.

### Applying settings to Audio and Renderer

- The only legitimate path from player UI to subscribers is through the store. UI components must not call `Audio.setMasterGain` or `Renderer.applyScalePolicy` directly; they change store values, and the store notifies subscribers.
- `UiShell` is the only subscription owner:
  - subscribes `Audio` to `masterVolume` changes: `audio.setMasterGain(settings.masterVolume)` ([audio.md](audio.md));
  - subscribes `Renderer` to `renderScalePreset` changes: `renderer.applyScalePolicy(...)` ([render-scale.md](render-scale.md));
  - applies current values once at startup so Audio and, if present, Renderer start in the selected configuration.
- Renderer does **not** exist yet in `menu` phase (see [main-ui-shell.md](main-ui-shell.md), "Render and input lifecycle across phases"): it is created on `menu → running`. Therefore Renderer subscription to the store is implemented as "apply current value on creation + subscribe + unsubscribe on `dispose()`". Changing `renderScalePreset` in `menu` is correct: the store saves the value, the next new Renderer reads it, and no separate pending application is needed.
- Audio exists for the full app lifetime, so the Audio subscription is always active. `masterVolume` changes in `menu`/`paused`/`result` use the same path.

### Boundaries and invariants

- Client settings **never** enter `SessionDefinition`. The builder in `src/shared/content/**` knows nothing about client settings. This reinforces "builder reads content library and options, outputs `SessionDefinition`" from [content-boundaries.md](content-boundaries.md): user options are `BuildOptions`, not presentation settings.
- Client settings **never** enter snapshots or runtime events. `src/sim/**` remains headless relative to how the player configured the client.
- Changing `masterVolume` or `renderScalePreset` **must never** change the outcome of a run with the same `seed`. This is already defined in [content-boundaries.md](content-boundaries.md) and made concrete here: no future client settings field may violate this invariant.
- The store is the only source of truth for current values; reading directly from `localStorage` anywhere except the store itself is forbidden.

### Tests

- Store is tested without real `localStorage`: introduce a narrow `StorageApi` (minimum `getItem`/`setItem`/`removeItem`) replaced by a fake implementation in tests. This is already an established pattern for `AudioApi`.
- Required under test:
  - reading empty/missing key -> defaults, no write;
  - reading broken JSON -> warning, defaults, key overwrite;
  - reading unknown `schemaVersion` -> warning, defaults, overwrite;
  - reading a valid snapshot with one invalid field -> clamp/default for that field, preserve others;
  - `setMasterVolume(0.5)` -> listener called once with new value; repeated `setMasterVolume(0.5)` -> listener **not** called;
  - clamp `setMasterVolume(2)` -> final value `1`, and snapshot/`localStorage` contain `1`;
  - unknown `setRenderScalePreset(value as any)` (TypeScript pass-through) -> no-op + warning;
  - listener call order equals registration order;
  - `dispose()` -> subsequent `set*` still clamp/validate, but listeners are not called and `localStorage` is not written;
  - `setItem` throws (quota) -> warning, but in-memory snapshot and listeners still work normally.
- Tests do not introduce regressions in [audio.md](audio.md) and [render-scale.md](render-scale.md): the store sits "above" those contracts and calls their public API.

## Consequences

- 009 gets a ready surface for settings UI: the overlay changes values through `store.set*`, and everything fans out to subscribers automatically.
- Audio and Renderer do not grow persistence logic internally; they accept current values through explicit API and subscription. Audio/Renderer tests do not depend on `localStorage`.
- Future presentation settings get one shared axis (accessibility, aim sensitivity, UI options): adding a field means editing one file in `src/main/settings/**` + migration if the shape changes + subscriber registration.
- Persistence format is versioned with `schemaVersion`: reinstalling the game does not break previous-version data, and explicit migration is handled as part of this decision.
- Cost: every new field needs a default, validation, and, when needed, migration. This is a deliberate tax to prevent settings from becoming a pile of "put a string in localStorage and forget it".
- This decision explicitly rejects cross-tab sync, separate `volume` buses inside 009, and settings effects on `BuildOptions`. That narrows 009 to the fixed scope; extending any of those points is a separate decision.

## Related

- [content-boundaries.md](content-boundaries.md)
- [audio.md](audio.md)
- [render-scale.md](render-scale.md)
- [main-ui-shell.md](main-ui-shell.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [camera-and-visible-area.md](camera-and-visible-area.md)
- [thread-model.md](thread-model.md)
- [web-stack.md](web-stack.md)
- [logging.md](logging.md)
- [testing.md](testing.md)
- [../stories/009-settings.md](../stories/009-settings.md)
