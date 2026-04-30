# Arena and Coordinates

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-30 (story 031 follow-up: the arena remains the full world while [camera-and-visible-area.md](camera-and-visible-area.md) defines desktop full-arena view and mobile smaller visible area/camera following. Earlier story 031 prep: mobile web support added a rotated game root and effective viewport; see [mobile-web-support.md](mobile-web-support.md). Earlier: 2026-04-27 story 026 prep: Vibe Jam portal placement uses the existing arena bounds and clamps/shifts main-thread portal descriptors inside the arena; see [vibe-jam-portals.md](vibe-jam-portals.md). Earlier: 2026-04-19.)

## Context

Gameplay is built around a single arena ([../docs/GDD_CORE.md](../docs/GDD_CORE.md), [../docs/SCOPE.md](../docs/SCOPE.md)), but neither `docs/` nor `design/` defines the arena shape, world units, axis directions, or the rule for fitting the arena to the browser viewport. Without this:

- `MovementSystem` cannot implement the invariant "the character cannot leave arena bounds";
- `SessionDefinition.arena` remains a magic object with an unknown shape;
- spawning "from edges" is ambiguous unless arena/world edge is explicitly separated from viewport/visible-area edge;
- dark-zone and spawn balance becomes dependent on the player's window size and aspect ratio, breaking reproducibility by `seed` ([session-definition.md](session-definition.md));
- rendering and input mapping would keep reopening the coordinate-system decision.

## Decision

### World coordinate system

- The world is two-dimensional, with real-valued coordinates.
- The unit is an abstract **world unit (wu)**. Concrete arena sizes, speeds, radii, and similar values are expressed in wu, not pixels.
- The X axis points right; the Y axis points up. `(0, 0)` is the arena center.
- "Pixels" exist only on the rendering side ([thread-model.md](thread-model.md)). No gameplay system in `src/sim/**` uses pixel sizes or depends on window size.

### Arena shape

- The arena is a rectangle centered at `(0, 0)`, described by two positive numbers, `width` and `height`, in wu.
- Safe coordinate bounds: `x ∈ [-width/2, +width/2]`, `y ∈ [-height/2, +height/2]`.
- Concrete `width` and `height` values for each mode/preset are defined in the `content library` (see [content-boundaries.md](content-boundaries.md), [web-stack.md](web-stack.md)) and enter `SessionDefinition.arena`. Hardcoding arena size in system code is forbidden.
- Arena aspect ratio, `arenaAspect = width / height`, is content, not engine behavior. Every render and UI system must work correctly for any `arenaAspect`.

### Mapping visible area to viewport (fit / letterbox / pillarbox)

- The `main thread` always shows the active **visible area** while preserving its proportions. The visible area is resolved by [camera-and-visible-area.md](camera-and-visible-area.md): with the current `32 x 18` arena desktop resolves to the full arena, while mobile resolves to a smaller camera window and future larger desktop arenas may scroll.
- Stretching the visible area to fit the viewport is forbidden.
- The viewport used for fitting is the effective game viewport. On desktop this equals the browser viewport; on mobile web it is the landscape game surface from [mobile-web-support.md](mobile-web-support.md).
- When `visibleAspect` and `viewportAspect` differ:
  - if `viewportAspect > visibleAspect`, use pillarbox: empty bars on the left/right;
  - if `viewportAspect < visibleAspect`, use letterbox: empty bars on the top/bottom.
- Fitting is implemented at the CSS level: the canvas container gets `aspect-ratio: visibleWidth / visibleHeight`, is centered in the window, and black bars are the empty page body outside the canvas. This gives three invariants:
  - canvas is always filled by the visible area without internal padding, so mouse/touch `clientX/Y` maps to the camera rectangle without a separate internal offset (important for aiming and Pointer Lock from [input-commands.md](input-commands.md));
  - `Renderer` does not know about the window; it receives the actual canvas size after CSS fitting;
  - the `three.js` scene draws only the active visible area; bars are outside the canvas, not part of the render scene.

### Camera

- The camera is orthographic and aligned with world axes. Rotation and tilt do not change during a session.
- The active visible camera area and camera center are defined by [camera-and-visible-area.md](camera-and-visible-area.md). With the current desktop arena this remains the full arena centered at `(0, 0)`.
- Pixel-to-world mapping uses the active visible area: `1 wu ≡ canvas.height / visibleArea.height` pixels on both axes.

### "No hardware advantage" invariant

- Arena bounds, spawning, dark-zone radius, movement speed, and deterministic simulation behavior **do not depend** on window size, DPR, render scale from 009, screen size, or mobile profile.
- The visible area may differ from the full arena only through an explicit camera decision such as [camera-and-visible-area.md](camera-and-visible-area.md). This can happen on mobile now and can happen on desktop/non-mobile when a future arena is larger than the desktop `18 wu` short-side anchor. It is main-thread presentation state, not simulation or content-authoring state.
- Window size and DPR affect image pixel density and CSS fitting, not arena bounds or simulation balance.
- Any attempt to make arena bounds or simulation balance depend on window size violates this decision.

### Arena bounds and systems

- The invariant "entity cannot leave arena bounds" belongs to `MovementSystem` ([runtime-systems.md](runtime-systems.md)). The concrete mechanism (`clamp` after integration, reflection, normal-based stop) is an implementation detail hidden behind `MovementSystem`.
- Future "spawn from arena edges" stories (003, 004) use arena bounds, not viewport or visible-area bounds. On mobile these no longer coincide, and semantically the source of truth is still the arena.
- Non-mobile displays with extreme aspect ratios (ultrawide, portrait windows) get the same desktop visible area for a given arena/camera profile; only the size of empty bars changes.

## Consequences

- `SessionDefinition.arena` gets a required `{ width, height }` pair in wu; formalized in [session-definition.md](session-definition.md).
- `MovementSystem` ([runtime-systems.md](runtime-systems.md)) must read bounds from the active session, not from a global constant.
- Aim and Pointer Lock ([input-commands.md](input-commands.md)) can compute cursor world position with a simple linear mapping without external offsets.
- Story 002 defines one concrete `{ width, height }` value for sandbox mode in the `content library`; future stories add new arenas through data, not by editing systems.
- Dark zone (004) and spawning (003) can rely on arena bounds as the only source of "edge", with no dependency on window size.
- Support for unusual non-mobile aspect ratios (ultrawide, portrait windows) is reduced to correct CSS fitting; gameplay does not change.
- Mobile web support deliberately adapts the main-thread visible area to the effective landscape game viewport aspect, while leaving the final session arena untouched.
- This decision explicitly forbids stretching the visible area to the viewport. Showing a smaller camera window inside the arena is allowed only through [camera-and-visible-area.md](camera-and-visible-area.md), where camera clamp and input mapping are defined.

## Related

- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [../docs/SCOPE.md](../docs/SCOPE.md)
- [session-definition.md](session-definition.md)
- [camera-and-visible-area.md](camera-and-visible-area.md)
- [content-boundaries.md](content-boundaries.md)
- [thread-model.md](thread-model.md)
- [runtime-systems.md](runtime-systems.md)
- [input-commands.md](input-commands.md)
- [web-stack.md](web-stack.md)
- [vibe-jam-portals.md](vibe-jam-portals.md)
- [mobile-web-support.md](mobile-web-support.md)
- [public-multiplayer-arena.md](public-multiplayer-arena.md)
