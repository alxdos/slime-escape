# Arena and Coordinates

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-30 (story 031 prep: mobile web support may derive a mobile session arena from the physical screen landscape aspect before the run starts; see [mobile-web-support.md](mobile-web-support.md). Earlier: 2026-04-27 story 026 prep: Vibe Jam portal placement uses the existing arena bounds and clamps/shifts main-thread portal descriptors inside the arena; see [vibe-jam-portals.md](vibe-jam-portals.md). Earlier: 2026-04-19.)

## Context

Gameplay is built around a single arena ([../docs/GDD_CORE.md](../docs/GDD_CORE.md), [../docs/SCOPE.md](../docs/SCOPE.md)), but neither `docs/` nor `design/` defines the arena shape, world units, axis directions, or the rule for fitting the arena to the browser viewport. Without this:

- `MovementSystem` cannot implement the invariant "the character cannot leave arena bounds";
- `SessionDefinition.arena` remains a magic object with an unknown shape;
- spawning "from screen edges" in `GDD_CORE.md` is ambiguous (arena edge is not the same concept as viewport edge);
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
- The scoped exception is [mobile-web-support.md](mobile-web-support.md): for a mobile web run, main may derive the final arena from the content-authored arena height and the physical screen landscape aspect before building the immutable `SessionDefinition`. After that point, `SessionDefinition.arena` is again the only source of truth.
- Arena aspect ratio, `arenaAspect = width / height`, is content, not engine behavior. Every render and UI system must work correctly for any `arenaAspect`.

### Mapping arena to viewport (fit / letterbox / pillarbox)

- The `main thread` always shows the **entire** arena while preserving its proportions. Cropping the arena to fit the viewport is forbidden.
- The viewport used for fitting is the effective game viewport. On desktop this equals the browser viewport; on mobile web it is the landscape game surface from [mobile-web-support.md](mobile-web-support.md).
- When `arenaAspect` and `viewportAspect` differ:
  - if `viewportAspect > arenaAspect`, use pillarbox: empty bars on the left/right;
  - if `viewportAspect < arenaAspect`, use letterbox: empty bars on the top/bottom.
- Fitting is implemented at the CSS level: the canvas container gets `aspect-ratio: width / height`, is centered in the window, and black bars are the empty page body outside the canvas. This gives three invariants:
  - canvas is always filled by the arena without internal padding, so mouse `clientX/Y` maps trivially to world coordinates without a separate offset (important for aiming and Pointer Lock from [input-commands.md](input-commands.md));
  - `Renderer` does not know about the window; it receives the actual canvas size after CSS fitting;
  - the `three.js` scene draws only the arena; bars are outside the canvas, not part of the render scene.

### Camera

- The camera is orthographic and aligned with world axes. Rotation, tilt, and zoom do not change during a session.
- The visible camera area in wu is always `width × height`. In other words, `1 wu ≡ canvas.height / arena.height` pixels on both axes.
- The camera is static relative to the arena center `(0, 0)`. Any player-following modes are a separate decision and not part of this file.

### "No hardware advantage" invariant

- Outside the explicit mobile web exception, the gameplay surface (what the player sees and where entities live) and the visible arena area **do not depend** on window size, DPR, or render scale from 009.
- In mobile web mode, the final arena may depend on physical screen aspect before the run starts. The simulation still receives only immutable `SessionDefinition.arena`; no gameplay system reads window size, DPR, or screen data.
- Window size and DPR affect only image pixel density, not FOV, spawning, dark-zone radius, or movement speed.
- Any other attempt to make the visible area or balance depend on window size violates this decision.

### Arena bounds and systems

- The invariant "entity cannot leave arena bounds" belongs to `MovementSystem` ([runtime-systems.md](runtime-systems.md)). The concrete mechanism (`clamp` after integration, reflection, normal-based stop) is an implementation detail hidden behind `MovementSystem`.
- Future "spawn from arena edges" stories (003, 004) use arena bounds, not viewport bounds. These two sets coincide by construction, but semantically the source of truth is the arena.
- Non-mobile displays with extreme aspect ratios (ultrawide, portrait windows) get the same visible arena; only the size of empty bars changes.

## Consequences

- `SessionDefinition.arena` gets a required `{ width, height }` pair in wu; formalized in [session-definition.md](session-definition.md).
- `MovementSystem` ([runtime-systems.md](runtime-systems.md)) must read bounds from the active session, not from a global constant.
- Aim and Pointer Lock ([input-commands.md](input-commands.md)) can compute cursor world position with a simple linear mapping without external offsets.
- Story 002 defines one concrete `{ width, height }` value for sandbox mode in the `content library`; future stories add new arenas through data, not by editing systems.
- Dark zone (004) and spawning (003) can rely on arena bounds as the only source of "edge", with no dependency on window size.
- Support for unusual non-mobile aspect ratios (ultrawide, portrait windows) is reduced to correct CSS fitting; gameplay does not change.
- Mobile web support deliberately adapts the final session arena to the physical screen aspect, then uses the same fitting, camera, bounds, and input-mapping rules as any other arena.
- This decision explicitly forbids cropping and stretching the arena to the viewport: those options were considered and rejected because they break balance and the "viewport edge = arena edge" contract.

## Related

- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [../docs/SCOPE.md](../docs/SCOPE.md)
- [session-definition.md](session-definition.md)
- [content-boundaries.md](content-boundaries.md)
- [thread-model.md](thread-model.md)
- [runtime-systems.md](runtime-systems.md)
- [input-commands.md](input-commands.md)
- [web-stack.md](web-stack.md)
- [vibe-jam-portals.md](vibe-jam-portals.md)
- [mobile-web-support.md](mobile-web-support.md)
