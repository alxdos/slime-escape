# Main Menu and Startup UX

- Status: in-progress
- Created: 2026-04-26
- Updated: 2026-04-26

## Player-facing

- Sees: the startup splash no longer pads the real asset load with fake counters. After the assets are loaded, it continues with a short in-game world-prep ritual: `Activating slime`, `Spawning slimes`, `Waking the boss`.
- Sees: the splash fades out into a dark transitional background, and the main menu fades in. The first screen does not flicker or change with a hard swap.
- Sees: the main menu as a hand-drawn scene per the [001-main.jpg](../mockups/001-main.jpg) reference, composed of `public/images/bg/bg-main.jpg`, the `public/images/title-800.png` logo, and the sliced `public/images/menu/menu-main-*.png` assets.
- Hears: in the main menu a noticeable but background loop of ticking clocks from the existing `public/sfx/music/101-clock-ticking.mp3`.
- Sees: menu, settings, HUD, and runtime texts in a game/comic style: a light or vivid pastel fill, a pseudo outline made of four sharp black `text-shadow`s without blur, and a separate sharp black drop shadow.
- Sees: Settings and Pause overlays not as dark system cards but as drawn application UI: light paper, vivid elements, a black frame, and a sharp shadow.
- Can: open the Pause menu inside a session via `Esc` or `Space`; plain pause/resume without the menu stays on the physical key `P` and does not depend on the layout or CapsLock.
- Can: pick `easy`, `normal`, or `hard`; the chosen mode is highlighted with a thick coloured outline.
- Sees: in a calm menu the Play button gently breathes and stays the main visual call to action.
- Can: launch the chosen campaign with the big Play button.
- Can: launch a training session with a separate Training button, not mixed with the difficulty selection.
- Can: open settings via the top-right Settings button and toggle fullscreen via the top-right Fullscreen button.

## Product notes

- `normal` is the default selected mode. `easy` and `hard` read as difficulty toggles around it.
- Training is a separate entry, not a fourth difficulty.
- Pets, Dungeon, and Lab should make the menu feel like the game's world map. In this story they may be teaser blocks without separate screens.
- Candidate primary UI font: `M PLUS Rounded 1c` in weights `800/900`, because it is thick enough for the outline and supports Cyrillic plus a wide language set. The final font choice is part of the T1 design decision.

## Technical

The story rests on [menu-and-startup-presentation.md](../design/menu-and-startup-presentation.md): startup ritual timing, honest preload progress, the required first-screen UI assets, the phase transition curtain, the menu stage layout, image-button states, typography, and reduced-motion behaviour. `UiShell` stays the owner of phases, pause hotkeys, and the transition barrier per [main-ui-shell.md](../design/main-ui-shell.md) and [input-commands.md](../design/input-commands.md).

Technical slice:

- Update startup preload so it includes gameplay textures from [sprite-assets.md](../design/sprite-assets.md) and the required first-screen UI assets from the new menu/startup decision.
- Update `StartupOverlay`: the asset progress is honest; intentional delay only lives in themed post-load steps.
- Add a `UiShell`-owned phase transition curtain for `loading -> menu` and `menu -> running`: a dark midpoint, commit the phase switch while covered, fade in the next screen, block repeated input during the transition.
- Rebuild `MenuOverlay` from a card-based DOM UI into a fixed stage of image assets:
  - background: `public/images/bg/bg-main.jpg`;
  - logo: `public/images/title-800.png`;
  - top-right buttons: `menu-main-settings.png`, `menu-main-soon.png`, `menu-main-fullscreen.png`;
  - difficulty buttons: `menu-main-mode-easy.png`, `menu-main-mode-normal.png`, `menu-main-mode-hard.png`;
  - launch buttons: `menu-main-play.png`, `menu-main-training.png`;
  - lower scene blocks: `menu-main-pets.png`, `menu-main-dungeon.png`, `menu-main-lab.png`.
- Default selected campaign mode: `campaign-normal`.
- Play launches the chosen preset out of `campaign-easy`, `campaign-normal`, `campaign-hard`.
- Training launches the `training` preset directly even if it stays hidden from the generic playable catalog.
- Hover, selected, disabled/soon, appear, and reduced-motion states stay presentation-only: they do not change the layout geometry and do not mutate session data.

## Out of scope

- Standalone Pets, Dungeon, and Lab screens.
- New gameplay or persistence for Pets, Dungeon, and Lab.
- A full redesign of Result, the combat HUD, or the wave-title overlay beyond shared comic typography and text-clipping fixes. Settings and Pause overlay get a visual shell in this story so they do not stand out from the new main menu.
- Persisting the last selected mode across page reloads.
- XP/progression behaviour for the top-left sketch block until a separate progression story.
- New audio assets; the story may only reuse existing UI click/hover/mode-switch/overlay sounds.

## Acceptance

- On a cold start the asset-load progress reflects the actual preload state. After the assets are ready, any remaining delay is shown only as themed game-prep steps, not as fake asset counts.
- Finishing startup performs `splash fade out -> dark midpoint -> menu fade in` without a white/empty flash.
- On entering the menu every interactive menu asset appears via opacity `0 -> 1` and scale `0.5 -> 1`.
- Regular menu assets have no shadow at rest; hovering an active button uses brightness and a sharp black drop shadow without changing the layout footprint.
- Hovering menu buttons may play a short UI sound from existing assets; menu components do not call Audio directly.
- Clicking `easy`, `normal`, or `hard` updates the selected state; exactly one mode is selected at a time, highlighted with a thick coloured outline.
- Play in the idle state gently breathes via a presentation-only scale/filter animation without a black shadow; hovering/focusing Play adds the regular lifted-button response without interrupting the breathing.
- Play launches the currently selected campaign preset.
- Training launches the `training` preset.
- Settings opens an overlay in the drawn application style: a light background, vivid controls, a black frame, and a sharp shadow.
- The Pause overlay inside a session uses the same drawn visual language: a light background, vivid buttons, a black frame, and a sharp shadow.
- Fullscreen requests fullscreen if the browser allows it and gracefully fails if the request is denied.
- Inside an active session `Space` behaves like `Esc`: it pauses the simulation, opens the Pause overlay, and releases Pointer Lock for the system cursor.
- Inside an active session the physical key `KeyP` toggles pause/resume without the Pause overlay; it uses `KeyboardEvent.code`, so the keyboard locale and CapsLock do not matter.
- Soon and the lower Pets/Dungeon/Lab scene blocks do not start a session; if they are interactive they only give a soft `not yet` feedback.
- `prefers-reduced-motion` keeps the fade but disables strong zoom and the breathing animation.
- A check on desktop landscape and on a narrow viewport shows that elements do not overlap incoherently: the key buttons are visible, clickable, and the layout follows the mockup reference recognisably.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Architect: write [menu-and-startup-presentation.md](../design/menu-and-startup-presentation.md), update [main-ui-shell.md](../design/main-ui-shell.md), [design/README.md](../design/README.md), the Related/Technical/Tasks of this story, and the index [stories/README.md](README.md). | Closes the contract for honest preload, the post-load ritual, the transition curtain, the menu stage, typography, and reduced motion. |
| T2 | [x] | Extend the startup preload required asset set: gameplay textures + first-screen UI images (`slime-escape`, `title-800`, `bg-main`, `menu-main-*`), with a hard error via the existing startup error path. | UI images do not become `SpriteVisualSpec`; the list lives in `src/main/ui/**`. |
| T3 | [x] | Rework `StartupOverlay` view model/rendering: honest asset progress, a separate themed post-load ritual, progress to `100%`, no fake asset counts. | Cover the difference between actual asset progress and ritual progress with tests. |
| T4 | [x] | Add a `UiShell` phase transition curtain for `loading -> menu` and `menu -> running`, including an input guard against repeated start. | Commit the phase switch while the curtain is opaque; `StartupErrorOverlay` stays the emergency top layer. |
| T5 | [x] | Rebuild the `MenuOverlay` stage layout per [001-main.jpg](../mockups/001-main.jpg): `bg-main`, top-right controls, difficulty buttons, Play, Training, Pets/Dungeon/Lab blocks. | Stable reference coordinates/aspect ratio; no card-UI fallback. |
| T6 | [x] | Implement menu behaviour: default `campaign-normal`, difficulty selection, Play for the selected campaign, Training preset, Settings callback, Fullscreen callback, Soon/Pets/Dungeon/Lab teaser feedback. | `MenuOverlay` does not call sim/audio/settings/fullscreen directly; everything goes through callbacks from `UiShell`. |
| T7 | [x] | Implement menu/startup visual states: appear opacity/scale, active hover/focus shadow, the concentrated coloured outline of the selected difficulty, Play idle breathing, disabled/soon state, comic text style, and the reduced-motion fallback. | Motion must not resize the layout footprint; font loading is progressive enhancement. |
| T8 | [ ] | Final verification: unit tests for startup/menu state, `npm test`, dev-server visual sanity on desktop and narrow viewport, plus start flows for easy/normal/hard/training. | Verify no flashing, no overlap, clickable buttons, visible selected mode, graceful fullscreen failure. |

## Related

- [main-ui-shell.md](../design/main-ui-shell.md)
- [input-commands.md](../design/input-commands.md)
- [menu-and-startup-presentation.md](../design/menu-and-startup-presentation.md)
- [sprite-assets.md](../design/sprite-assets.md)
- [audio.md](../design/audio.md)
- [client-settings.md](../design/client-settings.md)
- [hud-presentation.md](../design/hud-presentation.md)
- [001-main.jpg](../mockups/001-main.jpg)
- [022-combat-hud-redesign.md](022-combat-hud-redesign.md)
