# Camera and Visible Area

- Status: accepted
- Created: 2026-04-30
- Updated: 2026-04-30 (story 032 aim polish: combat input stores virtual aim relative to the active visible area/viewport and converts it through the current visible-area center, so camera movement carries the cursor in both local and online play.)

## Context

[arena-and-coordinates.md](arena-and-coordinates.md) defines the arena as the world-space rectangle used by movement, spawning, projectiles, and the dark zone. Story 031 originally treated mobile support as a different arena shape, but the product rule changed: the arena must remain the full playable world, while the camera shows a visible window into that world.

This split is useful beyond mobile. The current desktop arena is `32 x 18`, so a desktop visible-area anchor of `18 wu` still shows the whole arena. If a future arena becomes larger, the same camera model can scroll on desktop too. Mobile uses a smaller anchor, `12 wu`, so phone play reads larger immediately.

Without this decision:

- mobile support would keep changing `SessionDefinition.arena` for presentation reasons;
- renderer, input, and HUD code would keep assuming "arena" and "visible area" are the same rectangle;
- player-following camera behavior could be implemented locally without clear clamp/dead-zone rules;
- future larger-world stories would need to reopen the same terminology.

## Decision

### Definitions

- The **arena** is the full gameplay world rectangle from `SessionDefinition.arena` (see [session-definition.md](session-definition.md) and [arena-and-coordinates.md](arena-and-coordinates.md)).
- The **visible area** is the world-space rectangle currently shown by the orthographic camera.
- The visible area is described by `{ width, height, center }` in world units.
- The visible area belongs to the `main thread` presentation layer. It is not sent to the simulation worker, and no system in `src/sim/**` reads camera state, viewport size, screen size, or device profile.
- The visible area must always stay inside the arena. If the requested camera center would show outside the arena, the camera center is clamped back inside the arena.
- World-space systems and effects, including the dark zone from [zone.md](zone.md), remain based on the full arena/world dimensions. They are not resized from the current viewport or visible area.

### Visible-area sizing

- The visible area's smaller side is derived from a platform anchor:
  - desktop and non-mobile: `18 wu`;
  - mobile: `12 wu`.
- The desktop/non-mobile visible area uses the existing desktop baseline aspect, `16:9` (`32 x 18`), not the raw browser-window aspect. This preserves current desktop behavior on unusual desktop window shapes.
- The mobile visible area aspect follows the effective landscape game viewport from [mobile-web-support.md](mobile-web-support.md):
  - `visibleAspect = effectiveViewportWidth / effectiveViewportHeight`.
- The visible area is fitted inside the arena while preserving its chosen aspect:
  - choose `shortSide = min(platformAnchor, arena.width, arena.height)`;
  - for landscape aspects, set `height = shortSide` and `width = height * visibleAspect`;
  - if `width > arena.width`, set `width = arena.width` and `height = width / visibleAspect`;
  - if `height > arena.height`, set `height = arena.height` and `width = height * visibleAspect`;
  - final `width` and `height` must both be positive and must not exceed arena bounds.
- With the current `32 x 18` arena, desktop/non-mobile resolves to `32 x 18`, so the desktop camera remains visually unchanged.
- With a future arena larger than the resolved visible area, desktop/non-mobile uses the same camera-following and clamp rules as mobile.

### Mobile visible area

- Mobile support does not replace `SessionDefinition.arena` and does not pass a mobile arena override into session building.
- In mobile `running`, the visible area is smaller than the arena so gameplay reads larger on a phone.
- The mobile visible area's smaller side is `12 wu`. In the landscape mobile surface this is normally the visible height; the visible width is derived from the phone's effective landscape ratio by the sizing rule above.
- The initial mobile camera center is clamped around the player start position. If the player starts near an arena edge, the camera starts at the nearest valid center.
- Menus, settings, pause, result, and other non-running UI can use the rotated/effective game surface without a world-space visible area. The visible-area camera contract applies to combat rendering and combat input mapping.

### Camera free-movement zone

- Camera following is active whenever the visible area is smaller than the arena on at least one axis.
- Camera following uses a central free-movement zone inside the visible area.
- The free-movement zone is a rectangle centered on the current camera center and sized as fractions of the visible area. The exact fractions are main-thread tuning constants, but each axis must satisfy `0 < freeZoneSize < visibleAreaSize`.
- While the player center stays inside the free-movement zone, the camera target does not change.
- When the player center tries to move beyond the free-movement zone, the camera target shifts by the minimal delta that places the player back on the nearest free-zone boundary.
- The camera target is always clamped so the visible area stays inside the arena.
- The actual camera center moves toward the target smoothly. The smoothing model is an implementation detail, but it must be frame-time aware and must not overshoot outside arena bounds.
- If the visible area equals the full arena on both axes, the camera is effectively static at the arena center.
- At arena edges, arena clamping wins: the camera stops scrolling, and `MovementSystem` remains responsible for clamping the player to the arena boundary.

### Rendering and input mapping

- The renderer's orthographic frustum is the active visible area, not always the full arena.
- On the current desktop arena this is equivalent to the existing `arena.width x arena.height` frustum because the resolved visible area equals the arena.
- Whenever the visible area is smaller than the arena, the renderer positions the camera at `visibleArea.center` and draws only that subset of the arena.
- Canvas CSS fitting uses the visible area's aspect ratio. It must not stretch the visible area.
- Pointer and touch aim deltas convert pixels to visible-area world units through the active visible area height:
  - `1 wu = canvas.clientHeight / visibleArea.height` CSS pixels.
- The virtual aim position is stored as an offset inside the visible area and is clamped to the visible-area rectangle. Before rendering the crosshair or sending an `aim` command, `main` converts that offset to world coordinates by adding the current visible-area center. This keeps the cursor visually attached to the viewport while preserving the `InputCommand.aim` world-coordinate contract.
- Simulation snapshots already include player position, so camera following does not require a new simulation protocol field.

## Consequences

- `SessionDefinition.arena` again means the full gameplay world for both desktop and mobile.
- The previously planned mobile `arenaOverride` path becomes obsolete for story 031 follow-up work. Implementations that already added it should replace it with main-thread visible-area/camera state.
- Renderer fitting, aim mapping, and mobile controls must stop assuming that `arena.height` is always the camera scale.
- The `main thread` gains a reusable camera concept that future larger-world stories can extend without changing simulation contracts.
- Mobile support can make objects larger without changing spawn positions, arena bounds, dark-zone bounds, or deterministic simulation behavior.

## Related

- [arena-and-coordinates.md](arena-and-coordinates.md)
- [zone.md](zone.md)
- [mobile-web-support.md](mobile-web-support.md)
- [session-definition.md](session-definition.md)
- [input-commands.md](input-commands.md)
- [render-scale.md](render-scale.md)
- [main-ui-shell.md](main-ui-shell.md)
- [thread-model.md](thread-model.md)
- [testing.md](testing.md)
- [../stories/031-mobile-web-support.md](../stories/031-mobile-web-support.md)
- [online-session-hosting.md](online-session-hosting.md)
