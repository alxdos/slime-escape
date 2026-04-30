# Mobile Web Support

- Status: in-progress
- Created: 2026-04-30
- Updated: 2026-04-30

## Product intent

The first mobile web support slice should make Slime Escape feel like one coherent game screen on a phone and give the player a clear first touch-control layout. A player opening the game on a touch phone should not see a narrow portrait page with a small 16:9 playfield. They should see the whole game presented as a landscape arcade surface that fits their device, with simple touch zones for moving, aiming, firing, and pausing during a run.

## Product rules

- This slice treats a device as mobile only when it is touch-capable and its physical screen is portrait-shaped at startup.
- A desktop browser window that happens to be tall and narrow is still desktop behavior.
- On a mobile device, the game surface is landscape-first even when the phone is held upright.
- The game surface includes every player-facing layer: startup, menu, menu sub-screens, settings, combat scene, HUD, title overlays, pause, and result.
- On a mobile device, the arena aspect follows the physical screen ratio after turning it into landscape: longer screen side divided by shorter screen side.
- Desktop and non-mobile devices keep the existing desktop arena feel.
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
- Sees: on a phone, the arena uses the phone screen's own landscape shape, so the playfield wastes much less space than a fixed 16:9 arena on very wide phones.
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

Mobile support is main-thread presentation and input work based on [mobile-web-support.md](../design/mobile-web-support.md). The simulation protocol does not get mobile-specific commands: touch movement, aim, and fire map to the existing `InputCommand` union from [input-commands.md](../design/input-commands.md). `UiShell` mounts player-facing layers under the game root, chooses desktop or mobile input, and routes the mobile top-center pause/menu button through the existing pause phase. Mobile runs may pass an `arenaOverride` into session building so the final immutable `SessionDefinition.arena` matches the physical screen landscape aspect.

## Out of scope

- Gyroscope, accelerometer, tilt, or rotation-based combat controls.
- Gamepad support.
- A native mobile app, install flow, PWA work, or OS-level orientation lock.
- Phone-specific balance tuning beyond matching the arena shape to the phone screen.
- Tablet-specific layout or balance rules beyond the mobile detection in this slice.
- Changing desktop arena proportions or desktop resize behavior.
- Redesigning menu, HUD, pause, settings, or result art.
- Colored debug overlays for the mobile control zones.
- Customizable touch-control layout or remapping.

## Acceptance

- On a touch phone held upright, loading the game shows the startup and main menu as one landscape game surface.
- On that phone, Settings, Lab, Pets, and Dungeon screens stay inside the same landscape game surface and their buttons are tappable where they appear.
- Starting a run on that phone shows the arena, HUD, title overlay, and pause overlay aligned to the same landscape surface.
- Rotating the phone from upright to sideways removes the forced portrait presentation without breaking menu or run layout.
- Rotating the phone back upright restores the landscape presentation without duplicating rotation or leaving any UI layer unrotated.
- On a phone whose screen is wider than 16:9 in landscape, the visible arena shape follows the phone screen ratio instead of staying fixed at 16:9.
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
- Demo scenario: open the game on a touch phone in portrait, navigate from the main menu to Settings and back, open one menu sub-screen and back, start a run, move with the lower-left stick, aim with the lower-right stick, fire from the top zone, pause from the top-center button, rotate the phone sideways and upright again, then end or leave the run and confirm every visible layer remains part of one landscape game surface.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Record architecture decisions for mobile profile, game root, effective viewport, mobile arena override, touch input zones, HUD/control presentation, pause routing, and verification. | Added [mobile-web-support.md](../design/mobile-web-support.md) and aligned adjacent decisions. |
| T2 | [x] | Add mobile profile and game-surface orientation on main: detect touch portrait-screen startup, keep the mobile flag stable, rotate the game root in portrait, unrotate in landscape, and expose an effective landscape viewport to renderer fitting. | All player-facing game layers must mount under the game root, not uncoordinated `document.body` children. |
| T3 | [x] | Apply mobile arena shape during session build: derive `arenaOverride` from base arena height and physical landscape screen aspect, pass it through `UiShell`, use it before spawn/boss validation, and cover desktop/mobile builder cases. | The final `SessionDefinition.arena` is the only runtime source of truth. |
| T4 | [ ] | Implement the mobile input adapter: lower-left movement stick, lower-right relative aim stick, top fire zone, multi-touch tracking, minimum tap-fire pulse, pause-button priority, and cleanup on stop/phase change. | It sends only existing `move`/`aim`/`fire` commands and does not request Pointer Lock. |
| T5 | [ ] | Implement mobile controls presentation and HUD variant: hide desktop `WASD`/mouse hints in mobile running, show subtle sticks, bullet silhouettes, and top-center pause/menu button only during running. | No colored debug zone blocks in normal gameplay. |
| T6 | [ ] | Run focused automated checks and request live mobile verification from the user. | Include profile/viewport, builder, mobile input, HUD/UI tests, then ask for phone/emulated-phone checks per pipeline. |

## Related

- [mobile-web-support.md](../design/mobile-web-support.md)
- [arena-and-coordinates.md](../design/arena-and-coordinates.md)
- [session-definition.md](../design/session-definition.md)
- [input-commands.md](../design/input-commands.md)
- [main-ui-shell.md](../design/main-ui-shell.md)
- [hud-presentation.md](../design/hud-presentation.md)
- [render-scale.md](../design/render-scale.md)
- [thread-model.md](../design/thread-model.md)
- [testing.md](../design/testing.md)
- [GDD_CORE.md](../docs/GDD_CORE.md)
- [SCOPE.md](../docs/SCOPE.md)
