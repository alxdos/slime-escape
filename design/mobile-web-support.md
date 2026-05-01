# Mobile Web Support

- Status: accepted
- Created: 2026-04-30
- Updated: 2026-04-30 (story 032 follow-up: Public Arena may reuse mobile combat input in the `online` phase by sending the existing movement/aim/fire intent to the server; no new touch command kinds are added.)

## Context

The MVP is desktop-first, but [../docs/GDD_CORE.md](../docs/GDD_CORE.md) and [../docs/SCOPE.md](../docs/SCOPE.md) leave room for mobile web support if it stays simple. Story 031 makes that support concrete enough to need stable contracts:

- mobile detection must not trigger just because a desktop browser window is narrow;
- the game must behave as one landscape surface on a phone, including canvas and DOM UI;
- mobile combat should show a smaller visible area whose aspect matches the effective landscape game viewport, without changing the full arena world;
- touch controls should reuse the existing `InputCommand` contract instead of adding simulation-visible touch messages;
- mobile controls must coexist with `UiShell` pause/menu ownership.

Without a decision, the implementation could spread mobile rules across `index.ts`, renderer, HUD, input, and session building, while silently violating existing decisions such as [arena-and-coordinates.md](arena-and-coordinates.md), [input-commands.md](input-commands.md), and [main-ui-shell.md](main-ui-shell.md).

## Decision

### Mobile device profile

- The `main thread` owns mobile web feature detection. The simulation worker never reads `screen`, `navigator`, viewport size, orientation, or touch support.
- A page load is marked as mobile when both are true at startup:
  - `navigator.maxTouchPoints > 0`;
  - the physical screen shape is portrait at startup: `screen.height > screen.width`.
- This mobile flag is stable for the page lifetime. Runtime orientation changes update presentation state, not the mobile/non-mobile classification.
- A tall desktop browser window is not enough to enter mobile mode.
- Tablet-specific rules are not introduced by this decision. A touch device that matches the startup rule follows the same mobile path as a phone.

### Game root and effective viewport

- The app entrypoint owns a single game root element that contains the canvas and every player-facing game UI layer created by `UiShell`.
- `UiShell` receives that game root as its `parent`. Player-facing overlays must not be mounted directly into uncoordinated `document.body` children when they are part of the game screen.
- In mobile mode, the game root presents a landscape game surface:
  - if the current viewport is portrait, the root is rotated into landscape;
  - if the current viewport is landscape, the root is not manually rotated;
  - orientation changes update the root transform and dimensions without recreating the app.
- Rendering and CSS fitting use an effective game viewport, not raw `window.innerWidth` / `window.innerHeight`:
  - desktop effective viewport equals the browser viewport;
  - mobile effective viewport is always `longSide × shortSide` for the current page viewport.
- The app entrypoint or `UiShell` provides the effective game viewport to renderer fitting and visible-area camera sizing explicitly. Mobile renderer/camera code must not infer the game viewport from raw `window.innerWidth` / `window.innerHeight`.
- The same effective-viewport update path that updates the game root transform and dimensions must trigger renderer/camera refit. A resize-only listener is not sufficient if a browser can report orientation changes through a separate event path.
- `fitCanvasToViewport` still preserves the active visible area's aspect. Mobile support changes the effective viewport and, during combat, the visible area from [camera-and-visible-area.md](camera-and-visible-area.md); it does not stretch the image.

### Mobile visible area and camera

- Desktop, non-mobile, and mobile sessions keep the content-authored arena unchanged. `SessionDefinition.arena` remains the full playable world and the single source of truth for simulation bounds, spawning, zone bounds, projectile despawn, and aim clamping.
- In mobile `running`, the renderer uses a smaller visible area inside the arena as defined by [camera-and-visible-area.md](camera-and-visible-area.md).
- The mobile visible area aspect follows the effective landscape game viewport from the game root/effective viewport contract above:
  - `visibleAspect = effectiveViewportWidth / effectiveViewportHeight`.
- Startup physical screen dimensions are used only for stable mobile classification. They are not a separate camera aspect source after [camera-and-visible-area.md](camera-and-visible-area.md) became the active camera contract.
- The mobile visible area's smaller side is `12 wu` by the story 031 camera contract. This is main-thread camera tuning, not a `SessionDefinition` field and not a content-authored arena replacement.
- The mobile camera follows the player through the free-movement-zone rule from [camera-and-visible-area.md](camera-and-visible-area.md), then clamps the visible area inside the arena.
- No system in `src/sim/**` receives a mobile flag, reads screen dimensions, or receives visible-area/camera state. From the simulation worker's point of view, a mobile run uses the same immutable arena as the selected preset.

### Mobile input mapping

- Mobile combat controls are a `main thread` input adapter under `src/main/input/**` or an adjacent `src/main/**` module. They send the existing `InputCommand` union from [input-commands.md](input-commands.md).
- Mobile input does not add new `InputCommand.kind` values.
- Mobile input is active only in combat phases that have an input sink: local `running` and Public Arena `online`. In `menu`, `settings`, sub-screens, `onlineConnecting`, `paused`, `result`, `loading`, and `error('preload')`, normal UI pointer behavior owns the screen.
- Mobile input does not request Pointer Lock.
- Mobile input supports simultaneous touches by tracking `pointerId` ownership:
  - at most one active movement pointer;
  - at most one active aim pointer;
  - zero or more active fire pointers;
  - the pause/menu button owns its own pointer start and is not treated as fire.
- The top half of the game surface is the fire zone, except for the top-center pause/menu button hit area and its padding.
- The lower-left quadrant is the movement zone. It maps drag displacement from its touch origin to a normalized `move` command with the same vector semantics as keyboard movement.
- The lower-right quadrant is the aim zone. It moves the existing virtual aim point by relative drag deltas, converts CSS pixels to world units through the active visible-area mapping from [camera-and-visible-area.md](camera-and-visible-area.md), and clamps aim to `SessionDefinition.arena`.
- Fire zone touches send `fire start` when the first active fire pointer begins and `fire stop` after the last active fire pointer ends.
- A short tap in the fire zone must be observable by the simulation. The mobile input adapter keeps tap-fire active for at least one `SIM_STEP_MS` before sending `fire stop`, unless the touch is held longer.
- Starting a pointer on the top-center pause/menu button routes to `UiShell` and must not send `fire start`. In local `running`, it opens pause. In Public Arena `online`, it exits the online arena and returns to `menu`.
- Dragging an already active fire pointer over the pause/menu button does not open pause.
- When mobile input stops because the phase changes, the local session ends, or the online socket exits, it sends neutral state as needed: `move {0,0}` and `fire stop` if those states were active.

### Mobile controls presentation

- Mobile controls are presentation-only overlays owned by the main UI layer. They do not send simulation commands directly except through the mobile input adapter.
- The active control zones are not colored or boxed in normal gameplay.
- In mobile `running` and mobile `online`, the player sees:
  - subtle semi-transparent bullet silhouettes in the top-left and top-right fire areas;
  - a subtle semi-transparent movement stick in the lower-left area;
  - a subtle semi-transparent aim stick in the lower-right area;
  - a top-center pause/menu button.
- The existing desktop `WASD` and `LMB: Fire` HUD hints are hidden in mobile `running` and are not part of the Public Arena online HUD.
- Weapon slots, HP, boss strip, title overlays, escape progress, result UI, menu sub-screens, settings, and pause overlays keep their existing ownership. Mobile controls add a layer; they do not move those features into the input module.

### Pause and overlays

- `UiShell` remains the only owner of `running <-> paused`.
- The mobile top-center pause/menu button routes to the same pause behavior as desktop `Esc` / `Space`: simulation pauses and `PauseOverlay` is shown.
- Mobile pause does not depend on Pointer Lock release.
- Mobile control overlays are hidden when pause opens, so pause buttons receive normal pointer input.

### Tests and verification

- Mobile profile detection is tested as a pure function with touch/non-touch and portrait/landscape screen samples.
- Effective viewport/orientation state is tested without real browser rotation by injecting screen and viewport sizes.
- Mobile visible-area derivation is tested as main-thread camera state: current desktop `32 x 18` resolves to the full arena, mobile uses a smaller visible area with effective landscape viewport aspect, and the visible area clamps inside `SessionDefinition.arena`.
- Mobile camera following is tested with player positions inside the free-movement zone, beyond its boundary, and near arena edges.
- Mobile input mapping is tested with synthetic pointer streams: movement normalization, relative aim, fire hold, tap minimum pulse, multi-touch movement+aim+fire, pause-button priority, and cleanup on stop.
- HUD/presentation tests cover hiding desktop hints in mobile running and not hiding them on desktop.
- Live verification is required on a real or emulated touch phone viewport for portrait startup, rotate to landscape, rotate back, menu/sub-screen tapping, running controls, pause button priority, and no colored zone overlays.

## Consequences

- Mobile web support stays main-thread presentation/input work. The simulation worker remains headless and receives no mobile-specific commands.
- The existing `InputCommand` shape survives mobile support. The cost is a more capable main-thread input adapter that can coordinate multiple pointer ids and a minimum fire pulse.
- The arena "no hardware advantage" invariant no longer needs a mobile arena exception: mobile support changes main-thread camera/visible-area presentation, not `SessionDefinition.arena`.
- Renderer fitting must stop assuming raw `window.innerWidth` / `window.innerHeight` are always the game viewport.
- UI mounting becomes stricter: game UI belongs under the game root so the rotated mobile surface behaves as one screen.
- Full mobile balance and tablet-specific tuning remain outside this decision.

## Related

- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [../docs/SCOPE.md](../docs/SCOPE.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [camera-and-visible-area.md](camera-and-visible-area.md)
- [zone.md](zone.md)
- [session-definition.md](session-definition.md)
- [input-commands.md](input-commands.md)
- [main-ui-shell.md](main-ui-shell.md)
- [hud-presentation.md](hud-presentation.md)
- [render-scale.md](render-scale.md)
- [thread-model.md](thread-model.md)
- [testing.md](testing.md)
- [../stories/031-mobile-web-support.md](../stories/031-mobile-web-support.md)
- [online-arena-hosting.md](online-arena-hosting.md)
- [../stories/032-public-slime-arena.md](../stories/032-public-slime-arena.md)
