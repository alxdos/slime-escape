# Mobile Web Support

- Status: in-progress
- Created: 2026-04-30
- Updated: 2026-04-30

## Product intent

The first mobile web support slice should make Slime Escape feel like one coherent game screen on a phone and give the player a clear first touch-control layout. A player opening the game on a touch phone should not see a narrow portrait page with a tiny full-arena playfield. They should see a landscape arcade surface where the arena remains the full game world, while a smaller visible area makes the character, enemies, projectiles, and controls readable on a phone.

## Product rules

- This slice treats a device as mobile only when it is touch-capable and its physical screen is portrait-shaped at startup.
- A desktop browser window that happens to be tall and narrow is still desktop behavior.
- On a mobile device, the game surface is landscape-first even when the phone is held upright.
- The game surface includes every player-facing layer: startup, menu, menu sub-screens, settings, combat scene, HUD, title overlays, pause, and result.
- The arena remains the full playable world. Mobile support changes the visible area and camera behavior, not the arena's world bounds.
- The dark zone remains based on arena/world dimensions, not the current viewport or camera visible area.
- Desktop and non-mobile visible area is anchored by `18 wu` on the smaller side. With the current `32 x 18` arena this still equals the full arena, preserving the current desktop feel.
- Mobile visible area is anchored by `12 wu` on the smaller side and follows the physical screen ratio after turning it into landscape: longer screen side divided by shorter screen side.
- If a future arena is larger than the desktop visible area, the same camera-following model may scroll on desktop too.
- On a mobile device, the camera has a central free-movement zone: movement inside it does not scroll the visible area.
- When the player tries to move beyond the free-movement zone, the visible area smoothly follows through the arena while there is arena space left.
- When the visible area reaches the arena edge, the camera stops there and the player can still move up to the arena boundary.
- Mobile combat controls are active only during a running gameplay session.
- Mobile combat controls use invisible screen zones. The player should not see colored zone blocks.
- The top half of the game surface is the fire zone, except for the pause/menu button area.
- The bottom half is split into movement on the left and aim on the right.
- The pause/menu button in the top center has priority over the fire zone. Pressing it opens pause and must not fire.
- A pause gesture should start on the pause/menu button. Dragging an existing fire touch over the button should not suddenly pause the run.

## Player-facing

- Sees: when opening the game on a touch phone held upright, the whole game appears as one landscape-oriented screen instead of a narrow portrait page.
- Sees: startup, main menu, settings, Lab, Pets, Dungeon, combat HUD, pause, and result screens are all aligned to the same rotated game surface.
- Sees: when turning the same phone sideways, the game stays landscape and no longer looks manually rotated.
- Sees: when turning the phone back upright, the game returns to the landscape presentation without leaving UI behind in the page.
- Sees: on a phone, the visible area uses the phone screen's own landscape shape, so the run wastes much less space than a fixed 16:9 view on very wide phones.
- Sees: during a mobile gameplay session, the visible area shows a smaller part of the full arena, making the character, enemies, and projectiles feel larger and easier to read.
- Sees: during a mobile gameplay session, moving near the edge of the camera's free-movement zone smoothly scrolls the visible area through the arena.
- Sees: when the visible area reaches the arena edge, the camera stops showing new space beyond that edge while the character can still reach the arena boundary.
- Can do: tap existing menu, sub-screen, settings, pause, and result buttons on a phone with the hit areas visually matching what is on screen.
- Sees: during a mobile gameplay session, desktop `WASD` and mouse-control hints are hidden.
- Sees: during a mobile gameplay session, the top left and top right show subtle semi-transparent bullet silhouettes as firing affordances.
- Sees: during a mobile gameplay session, a subtle semi-transparent movement stick appears in the lower-left control area.
- Sees: during a mobile gameplay session, a subtle semi-transparent aim stick appears in the lower-right control area.
- Sees: during a mobile gameplay session, a pause/menu button appears at the top center.
- Can do: tap or hold in the top fire zone to shoot.
- Can do: hold and drag in the lower-left area to move.
- Can do: hold and drag in the lower-right area to aim.
- Can do: move, aim, and fire at the same time with separate touches.
- Can do: tap the top-center pause/menu button to pause without firing.
- Sees: on desktop, including a tall narrow desktop browser window, the game keeps the current desktop presentation.

## Technical

Mobile support is main-thread presentation and input work based on [mobile-web-support.md](../design/mobile-web-support.md) and [camera-and-visible-area.md](../design/camera-and-visible-area.md). The simulation protocol does not get mobile-specific commands: touch movement, aim, and fire map to the existing `InputCommand` union from [input-commands.md](../design/input-commands.md). `UiShell` mounts player-facing layers under the game root, chooses desktop or mobile input, and routes the mobile top-center pause/menu button through the existing pause phase. The follow-up camera contract keeps `SessionDefinition.arena` as the full content-authored world, derives visible area on main (`18 wu` smaller-side anchor for desktop/non-mobile, `12 wu` for mobile), uses the effective landscape game viewport as the mobile visible-area aspect, and keeps the dark zone world/arena-based per [zone.md](../design/zone.md).

## Out of scope

- Gyroscope, accelerometer, tilt, or rotation-based combat controls.
- Gamepad support.
- A native mobile app, install flow, PWA work, or OS-level orientation lock.
- Phone-specific balance tuning beyond the visible-area size and camera-follow feel needed for this slice.
- Tablet-specific layout or balance rules beyond the mobile detection in this slice.
- Changing desktop arena proportions or desktop resize behavior.
- Large worlds, long scrolling levels, rooms, or procedural maps beyond the current arena.
- Redesigning menu, HUD, pause, settings, or result art.
- Colored debug overlays for the mobile control zones.
- Customizable touch-control layout or remapping.

## Acceptance

- On a touch phone held upright, loading the game shows the startup and main menu as one landscape game surface.
- On that phone, Settings, Lab, Pets, and Dungeon screens stay inside the same landscape game surface and their buttons are tappable where they appear.
- Starting a run on that phone shows the combat scene, HUD, title overlay, and pause overlay aligned to the same landscape surface.
- Rotating the phone from upright to sideways removes the forced portrait presentation without breaking menu or run layout.
- Rotating the phone back upright restores the landscape presentation without duplicating rotation or leaving any UI layer unrotated.
- On a phone whose screen is wider than 16:9 in landscape, the visible area follows the phone screen ratio instead of staying fixed at 16:9.
- During a mobile run, the visible area is smaller than the full arena, so the character, enemies, and projectiles appear larger than they would in a full-arena phone view.
- During a mobile run, moving inside the camera's free-movement zone does not scroll the visible area.
- During a mobile run, trying to move beyond the free-movement zone scrolls the visible area smoothly while there is arena space in that direction.
- During a mobile run, when the visible area reaches the arena edge, the camera stays clamped and does not show outside the arena while the player can still reach the arena boundary.
- During a mobile run with a shrinking dark zone, the dark zone remains based on the arena/world dimensions rather than shrinking from the current camera rectangle.
- During a mobile run, the desktop `WASD` and mouse-control hints are not shown.
- During a mobile run, the player sees semi-transparent movement and aim sticks plus subtle bullet silhouettes, but no colored zone blocks.
- Holding in the lower-left area moves the player.
- Holding and dragging in the lower-right area moves the aim/crosshair.
- Tapping or holding in the top fire zone fires the current weapon.
- The player can move, aim, and fire at the same time with separate touches.
- Tapping the top-center pause/menu button opens pause and does not fire.
- Starting a fire touch outside the pause/menu button and dragging over the button does not accidentally open pause.
- On desktop, resizing the browser window to a tall portrait shape does not trigger the phone presentation.
- Existing desktop menu and gameplay presentation remain visually unchanged.
- Demo scenario: open the game on a touch phone in portrait, navigate from the main menu to Settings and back, open one menu sub-screen and back, start a run, confirm the visible area is smaller than the full arena, move inside the free-movement zone, push far enough to scroll the visible area, reach an arena edge where the camera clamps, aim with the lower-right stick, fire from the top zone, pause from the top-center button, rotate the phone sideways and upright again, then end or leave the run and confirm every visible layer remains part of one landscape game surface.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Record architecture decisions for mobile profile, game root, effective viewport, mobile arena override, touch input zones, HUD/control presentation, pause routing, and verification. | Added [mobile-web-support.md](../design/mobile-web-support.md) and aligned adjacent decisions. |
| T2 | [x] | Add mobile profile and game-surface orientation on main: detect touch portrait-screen startup, keep the mobile flag stable, rotate the game root in portrait, unrotate in landscape, and expose an effective landscape viewport to renderer fitting. | All player-facing game layers must mount under the game root, not uncoordinated `document.body` children. |
| T3 | [x] | Apply the original mobile arena-shape path during session build: derive `arenaOverride` from base arena height and mobile landscape aspect, pass it through `UiShell`, use it before spawn/boss validation, and cover desktop/mobile builder cases. | Historical task; superseded by T8. The final `SessionDefinition.arena` is the only runtime source of truth. |
| T4 | [x] | Implement the mobile input adapter: lower-left movement stick, lower-right relative aim stick, top fire zone, multi-touch tracking, minimum tap-fire pulse, pause-button priority, and cleanup on stop/phase change. | It sends only existing `move`/`aim`/`fire` commands and does not request Pointer Lock. |
| T5 | [x] | Implement mobile controls presentation and HUD variant: hide desktop `WASD`/mouse hints in mobile running, show subtle sticks, bullet silhouettes, and top-center pause/menu button only during running. | No colored debug zone blocks in normal gameplay. |
| T6 | [ ] | Run focused automated checks and request live mobile verification from the user. | Run after the remaining follow-up fixes. Include profile/viewport, visible-area/camera, world-space dark zone, mobile input, HUD/UI tests, then ask for phone/emulated-phone checks per pipeline. |
| T7 | [x] | Record follow-up architecture for arena vs visible area, desktop/mobile smaller-side anchors, camera following, active visible-area input mapping, and world-based dark zone wording. | Added [camera-and-visible-area.md](../design/camera-and-visible-area.md) and aligned adjacent decisions/docs. |
| T8 | [x] | Replace the implemented mobile `arenaOverride` path with main-thread visible-area camera state: keep `SessionDefinition.arena` content-authored, remove mobile arena replacement from session building, and preserve current desktop behavior for `32 x 18`. | Desktop/non-mobile anchor is `18 wu`; mobile anchor is `12 wu`; mobile aspect follows the effective landscape game viewport. |
| T9 | [x] | Update renderer/camera fitting: render the active visible area, follow the player through the free-movement zone when the arena is larger than the visible area, clamp camera to arena bounds, and draw the dark zone from world/arena `margin` rather than viewport bounds. | Current desktop arena should still look unchanged; future larger arenas can scroll on desktop. |
| T10 | [x] | Update input mapping to the active visible area: convert desktop Pointer Lock and mobile aim deltas through `visibleArea.height`, account for camera center, and keep aim clamped to arena bounds. | No new `InputCommand` kinds; simulation stays headless. |
| T11 | [x] | Align architecture wording after review: mobile camera aspect follows the effective landscape game viewport, renderer/camera fitting receives that viewport explicitly, and render-scale/input wording uses active visible area height. | Updated [mobile-web-support.md](../design/mobile-web-support.md), [arena-and-coordinates.md](../design/arena-and-coordinates.md), and [render-scale.md](../design/render-scale.md). |
| T12 | [x] | Fix mobile touch coordinate mapping so control-zone classification always computes pointer positions from `clientX/clientY - surface.getBoundingClientRect()`, never from target-relative `offsetX/offsetY`; add a regression with a child event target whose local offsets differ from the game surface. | This protects fire/move/aim/pause classification when the pointer target is the canvas, HUD, or another child under the game root. |
| T13 | [x] | Make effective viewport flow explicit end to end: remove the stale `screenLandscapeAspect` camera fallback, pass the effective game viewport/provider to renderer and visible-area camera without raw-window hidden coupling, and ensure orientation changes trigger the same renderer/camera refit path as resize. | Keep `screen.width/height` only for startup mobile classification unless a new design decision gives it another role. |

## Related

- [mobile-web-support.md](../design/mobile-web-support.md)
- [arena-and-coordinates.md](../design/arena-and-coordinates.md)
- [camera-and-visible-area.md](../design/camera-and-visible-area.md)
- [session-definition.md](../design/session-definition.md)
- [input-commands.md](../design/input-commands.md)
- [main-ui-shell.md](../design/main-ui-shell.md)
- [hud-presentation.md](../design/hud-presentation.md)
- [render-scale.md](../design/render-scale.md)
- [zone.md](../design/zone.md)
- [thread-model.md](../design/thread-model.md)
- [testing.md](../design/testing.md)
- [GDD_CORE.md](../docs/GDD_CORE.md)
- [WAVES_AND_SCALING.md](../docs/WAVES_AND_SCALING.md)
- [SCOPE.md](../docs/SCOPE.md)
