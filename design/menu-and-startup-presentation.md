# Menu And Startup Presentation

- Status: accepted
- Created: 2026-04-26
- Updated: 2026-04-28 (story 029 prep: Pets and Lab stop being teaser blocks and open hand-drawn menu sub-screens for collection, selection, and XP purchases. Earlier: 2026-04-27 story 026 prep: the existing entrypoint `autoStartPresetId` path is recorded for `/portal`; after preload it may transition directly into the configured session, and the Training button routes to that configured preset when present.)

## Context

[main-ui-shell.md](main-ui-shell.md) already defines the `UiShell` phase model: the app starts in `loading`, normally moves to `menu` after successful preload, and starts an active session after an explicit player action. Special page entrypoints may provide a configured `autoStartPresetId`; in that case the shell moves from `loading` into the configured run after preload without showing the standard menu. [sprite-assets.md](sprite-assets.md) requires gameplay sprites to be preloaded and decoded before the menu or auto-started run, so the first run does not show lazy-load flicker.

Before story 023, startup UX was technical: `StartupOverlay` showed `Loading assets X/Y`, and minimum splash duration lived next to preload logic. That visually stabilized startup, but mixed two separate concerns:

- real readiness of required assets;
- an intentional presentation pause that keeps the splash screen from flashing too briefly.

Story 023 also replaces the old card-based menu with a hand-drawn scene based on [../mockups/001-main.jpg](../mockups/001-main.jpg) and sliced assets in `public/images/bg/**` / `public/images/menu/**`. Without a separate decision, menu code would start carrying architecture rules in DOM coordinates, hover effects, and timing constants.

This decision defines the presentation contract for the startup splash, phase visual transitions, and main menu. It does not change `SessionDefinition`, snapshots, sim runtime, or gameplay content.

## Decision

### Ownership and placement

- Startup overlay, phase transition curtain and main menu stay under `src/main/ui/**`, following [web-stack.md](web-stack.md) and [main-ui-shell.md](main-ui-shell.md).
- Menu/startup presentation code may import from `src/shared/content/**` only through the existing playable preset APIs (`ModePresetId`, `getPlayableModeCatalog`, `resolveModePreset`). It must not import from `src/sim/**`.
- Static menu/startup images live under `public/images/**`. They are presentation assets, not content library records and not `SpriteVisualSpec` entries.
- `UiShell` remains the only owner of phase changes, session start/stop, settings visibility, audio UI interaction routing and fullscreen side effects.
- `MenuOverlay` remains a presentation component. It receives callbacks such as `onStart`, `onStartTraining`, `onOpenSettings` and `onToggleFullscreen`; it does not call `SimWorkerHost`, `Audio`, `ClientSettingsStore` or browser fullscreen APIs directly.

### Startup assets and honest preload

- Startup preload has two asset groups:
  1. gameplay textures from the visual registries defined by [sprite-assets.md](sprite-assets.md);
  2. required first-screen UI images: `/images/slime-escape.jpg`, `/images/title-800.png`, `/images/bg/bg-main.jpg`, and the `menu-main-*` images used by the main menu.
- `loading -> menu` is allowed only after all required startup assets are loaded and decoded. A missing first-screen UI image is a startup preload error, not a degraded menu.
- Asset progress shown while assets are loading must be honest: if the UI displays `loaded/total`, those values are the actual loaded/decoded count from the required asset set. Time-gating must not invent lower loaded counts after an asset has actually completed.
- After all required assets are ready, `StartupOverlay` switches from asset progress to a themed post-load ritual. This ritual is the only place where startup duration may be intentionally extended for presentation.
- The post-load ritual is a fixed ordered list of short `StartupPresentationStep` entries owned by `src/main/ui/**`. Initial Russian copy:
  - `Priming slime`
  - `Spawning slimes`
  - `Waking the boss`
- The ritual advances the visible progress from the completed asset portion to `100%`. It must not continue showing fake asset counts.
- The ritual uses wall-clock presentation time in `main thread`; it is not seeded and does not affect simulation determinism.
- A reasonable initial ritual duration is hundreds of milliseconds, not seconds. The implementation may tune exact per-step durations locally, but the whole ritual should stay short enough to feel like an intro beat rather than a second loading screen.

### Phase transition curtain

- `UiShell` owns a full-viewport phase transition curtain for visual transitions between high-level screens. It is a presentation barrier, not a new public `UiShellPhase`.
- The transition curtain is used for:
  - successful `loading -> menu`;
  - successful `loading -> running` for configured entrypoint auto-start;
  - player-initiated `menu -> running`;
  - future return-to-menu transitions only if the story touching them explicitly opts in.
- The transition sequence is:
  1. fade the curtain from transparent to an opaque dark color;
  2. while the curtain is opaque, commit the phase switch and show/hide the relevant overlays according to [main-ui-shell.md](main-ui-shell.md);
  3. render at least one frame of the next screen behind the curtain;
  4. fade the curtain back to transparent.
- The curtain sits above normal overlays while active and must cover canvas, HUD, title overlay, menu and startup overlay. `StartupErrorOverlay` remains the emergency top layer.
- While a transition is active, player-facing controls that could trigger another transition are disabled or ignored. Repeated Play/Training clicks cannot start multiple sessions.
- `menu -> running` may prepare `SessionDefinition`, `Renderer` and `InputController` while the curtain is opaque. The authoritative session start still happens through the existing `UiShell` path; no menu component may start sim directly.
- Player input for the new session is not accepted until the running screen has begun its reveal. Pointer Lock request behavior continues to follow [input-commands.md](input-commands.md).

### Main menu stage

- The main menu is a fixed viewport stage based on [../mockups/001-main.jpg](../mockups/001-main.jpg), not a floating card layout.
- The base background is `/images/bg/bg-main.jpg`.
- The top-left logo is `/images/title-800.png`.
- The stage uses a stable reference coordinate system matching the mockup aspect ratio (`1000 x 707`). UI elements are placed in normalized stage coordinates and scaled with the stage.
- The stage is fitted into the viewport with `contain` behavior. On narrow or short viewports it may scale down and/or allow page-level scrolling, but it must preserve the relative mockup composition rather than reflow into generic cards.
- Interactive image controls are real `button` elements containing `img` assets, so keyboard focus and accessibility labels remain possible. The visual footprint is defined by stable width/height or aspect-ratio constraints; hover/selected states must not resize layout boxes.
- Required menu assets:
  - logo: `/images/title-800.png`;
  - top-right: `/images/menu/menu-main-settings.png`, `/images/menu/menu-main-soon.png`, `/images/menu/menu-main-fullscreen.png`;
  - difficulty: `/images/menu/menu-main-mode-easy.png`, `/images/menu/menu-main-mode-normal.png`, `/images/menu/menu-main-mode-hard.png`;
  - launch: `/images/menu/menu-main-play.png`, `/images/menu/menu-main-training.png`;
  - lower scene: `/images/menu/menu-main-pets.png`, `/images/menu/menu-main-dungeon.png`, `/images/menu/menu-main-lab.png`.
- Story 029 sub-screen assets:
  - Pets screen: `/images/bg/bg-pets.jpg`, `/images/menu/menu-pets-back.png`;
  - Lab screen: `/images/bg/bg-lab.jpg`, `/images/menu/menu-lab-back.png`.
- The top-left XP/progression sketch from the mockup becomes live progression presentation when a story supplies XP data through `UiShell`. Menu presentation still does not own persistence.

### Menu behavior

- Default selected campaign mode is `campaign-normal`.
- Difficulty buttons map directly:
  - Easy -> `campaign-easy`;
  - Normal -> `campaign-normal`;
  - Hard -> `campaign-hard`.
- Exactly one difficulty is selected at a time.
- The large Play button starts the currently selected campaign preset.
- Training is a separate entry point and normally starts preset `training` directly, even if `training.visibleInMenu === false`. This is an explicit special-case presentation entry, not a fourth difficulty and not a change to the generic playable catalog.
- If the current page entrypoint configured `autoStartPresetId`, the Training action starts that configured preset instead. This keeps special entrypoints such as `/portal` inside their dedicated session even after the player returns to the menu from a result screen.
- Settings opens the existing settings overlay through `UiShell`.
- Fullscreen requests browser fullscreen through `UiShell`. Rejection or unsupported fullscreen is handled as a no-op with optional warning/log; it must not break menu state.
- Soon remains non-launching feedback.
- Dungeon follows the existing Dungeon story contract and starts the Dungeon screen/preset through `UiShell`.
- Pets and Lab open menu sub-screens in story 029. They do not become `UiShellPhase` values, do not start sessions, and do not call persistence directly.

### Pets and Lab sub-screens

- Pets and Lab extend the same hand-drawn stage metaphor as the main menu. They use their own background art and a real back button image; they must not be rebuilt as generic card dashboards.
- A sub-screen is nested inside menu presentation state owned by `MenuOverlay`/`UiShell`. Pressing Back returns to the main menu stage without touching the selected campaign mode, settings, fullscreen state, worker, renderer, or active session state.
- Lab receives XP total, pet economy, pet content, owned pet ids, and purchase callbacks from `UiShell`. The Lab view may own local reveal animation state for the most recently purchased pet, but it does not decide ownership or write storage.
- Lab stand presentation has three mutually exclusive visual states per quality: purchasable price, revealed pet, and `Complete`. Affordability feedback is local presentation; purchase success/failure comes from the progression store callback.
- Pets receives pet content, pet visuals, owned pet ids, selected pet id, and select/clear callbacks from `UiShell`. It presents green and purple inventory zones plus one selected-companion area; it does not read `localStorage`.
- Pet sprites shown in menu sub-screens use pet visual registry image paths from [sprite-assets.md](sprite-assets.md), not duplicate image constants in UI.

### Motion and interaction states

- On menu show, interactive controls use an appear animation: opacity `0 -> 1` and scale `0.5 -> 1`.
- Initial appear may be staggered by small delays, but all primary actions must become available quickly. Stagger timing is presentation-only.
- Hover/focus for active image buttons uses brightness, drop-shadow, glow, or a subtle transform. It must not alter the element's layout footprint.
- Selected difficulty uses an always-visible selected state; it does not need idle motion. The large Play button uses a gentle idle breathing animation as the primary call-to-action; the idle breath has no black drop-shadow, and hover/focus applies the normal lifted button response without stopping the breath. This breathing is presentation-only and must not move surrounding controls.
- Disabled/soon controls are visually distinct from active controls and cannot start sessions.
- `prefers-reduced-motion: reduce` keeps simple opacity fades but disables strong zoom, Play breathing and large transforms.

### Typography

- New menu/startup/runtime labels that are not baked into images use the game/comic text treatment:
  - light or bright-pastel fill;
  - black outline via `-webkit-text-stroke` or equivalent layered text-shadow fallback;
  - sharp black shadow.
- Primary UI font for this style is `M PLUS Rounded 1c` at heavy weights (`800`/`900`), with fallback to a broad Unicode sans stack such as `Noto Sans Display`, `system-ui`, `sans-serif`.
- Font loading is a progressive enhancement. Startup preload must not block on remote font availability, and failure to load the font must fall back without breaking layout.
- Text containers must be sized for Cyrillic strings first and must not depend on negative letter spacing or viewport-width font scaling.

### Tests and verification

- Unit-level tests should cover pure view-model/state pieces where possible: selected mode, Play/Training routing, disabled/teaser behavior, reduced-motion state derivation and startup step progression.
- Unit-level tests should cover Pets/Lab menu state derivation where possible: Back routing, owned/selected partitioning, stand price/reveal/complete states, and disabled purchase affordance.
- `UiShell` tests should cover transition guarding: repeated Play/Training while transitioning cannot start more than one session.
- Preload tests should distinguish actual asset progress from post-load ritual progress.
- Browser/dev-server visual verification is required for desktop landscape and narrow viewport. It must check that the page is nonblank, menu assets render, buttons are clickable, selected mode is visible, Pets/Lab sub-screens are reachable/backable, and no incoherent overlap appears.

## Consequences

- Startup loading becomes easier to trust: asset progress is real, and the intentional delay is named as game-world preparation.
- The first menu becomes asset-driven and closer to the game's hand-drawn identity, but it now depends on a fixed set of UI images being present and decoded before `menu`.
- `UiShell` gains a small presentation transition layer. This keeps fade sequencing centralized instead of scattering `setTimeout`/CSS transition decisions across overlays.
- Training gets an explicit menu affordance without changing the generic playable catalog contract.
- The menu layout becomes less flexible than a card grid by design. Pets, Dungeon and Lab extend this stage metaphor rather than converting the main menu back into generic panels.
- Remote font loading cannot be treated as critical game readiness. The visual style must survive fallback fonts.

## Related

- [main-ui-shell.md](main-ui-shell.md)
- [sprite-assets.md](sprite-assets.md)
- [audio.md](audio.md)
- [client-settings.md](client-settings.md)
- [input-commands.md](input-commands.md)
- [hud-presentation.md](hud-presentation.md)
- [web-stack.md](web-stack.md)
- [testing.md](testing.md)
- [vibe-jam-portals.md](vibe-jam-portals.md)
- [../mockups/001-main.jpg](../mockups/001-main.jpg)
- [../stories/023-main-menu-and-startup-ux.md](../stories/023-main-menu-and-startup-ux.md)
- [../stories/029-xp-and-pet-companions.md](../stories/029-xp-and-pet-companions.md)
