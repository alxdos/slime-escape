# Vibe Jam Portals

- Status: accepted
- Created: 2026-04-27
- Updated: 2026-04-29

## Context

Vibe Jam 2026 defines an optional portal webring on top of the required widget. A game may expose an exit portal that sends the player to `https://vibej.am/portal/2026`. When the portal redirector sends a player into a game, it adds `portal=true`; if it also provides `ref`, the receiving game should provide a start/return portal so the player can go back.

Slime Escape already has a separate `/portal` page entrypoint. That page configures `UiShell` with `SLIME_ESCAPE_AUTO_START = "portal"` and a portal-specific loading image. This decision records how that entrypoint, incoming portal context, return portals, and the exit portal fit the existing `main thread` / `simulation worker` architecture.

## Decision

### Entrypoint contract

- `/portal` is a static page entrypoint that runs the normal main bundle and sets `window.SLIME_ESCAPE_AUTO_START = "portal"` before `/src/main/index.ts` is imported.
- `src/main/index.ts` resolves `SLIME_ESCAPE_AUTO_START` only from page globals. URL query parameters must not start sessions directly.
- If the page global is a valid `ModePresetId`, `UiShell` receives it as `autoStartPresetId`. After successful startup preload, `UiShell` may transition directly into that preset, using the same session-start path as `menu -> running`.
- The normal root entrypoint remains menu-first. Auto-start is a page-entrypoint configuration, not a new generic menu behavior.

### Incoming portal context

- Main thread owns Vibe Jam portal URL handling. Simulation worker does not parse browser URLs.
- An inbound portal context exists only when the current URL has `portal=true` and a usable `ref`.
- A usable `ref` is a parseable absolute `http:` or `https:` URL. Missing, empty, malformed, or non-web refs mean "no return portal".
- The context is tab-scoped. Store it in memory and, if persistence across result/menu transitions needs a browser store, use `sessionStorage`. Do not use `localStorage`, server state, or saved-game state.
- Incoming optional parameters such as `username`, `color`, `speed`, `avatar_url`, `team`, `hp`, velocity, and rotation are preserved as opaque query parameters for forwarding. Gameplay must not depend on them.
- When building a return URL to the previous game, copy the incoming optional parameters, set `portal=true`, and set `ref` to Slime Escape's portal URL (`https://slimeescape.com/portal`). This lets the previous game create its own return portal back to Slime Escape.

### Return portal lifetime

- A return portal is available only when an inbound portal context is active and the current session contains at least one `type: portal` encounter.
- While the context is active, portal-capable sessions may show a return portal near the player spawn. Normal sessions without a `portal` encounter do not show or consume return portals.
- The preferred return portal position is:
  ```text
  x = session.player.position.x - 8 * session.player.contactBox.width
  y = session.player.position.y
  ```
- The return portal must fit inside the arena. If the preferred position would place it outside the arena, main-side placement clamps or shifts it inside the arena without changing simulation state.
- The return portal collapses and the inbound context is consumed when a boss encounter starts in a portal-capable session. After this boss lock-in, no later session in the same tab shows the return portal.
- Return portals are not shown during `boss` encounters. They may be shown alongside an early `portal` encounter before boss lock-in.

### Portal encounters

- Add encounter type `portal` to `EncounterType`.
- A `portal` encounter is a non-combat presentation encounter:
  - `spawnPlan.kind` is `empty`;
  - `zoneBehavior.kind` is `disabled`;
  - `transitionRules.kind` is `never` for a terminal portal, or `allEnemiesCleared` for a transparent opening portal;
  - `introDurationMs` is `0`;
  - `name` is `null`;
  - `text` is `null`.
- `portal` encounters are not objective encounters for result progress. They do not add wave count, boss count, or completion percent weight.
- The special `/portal` session ends its authored combat chain as:
  ```text
  portal-opening -> waves -> boss-gargoyle
  ```
- The portal session uses the normal run completion path after the boss: `winCondition: allEncountersComplete` and `lossCondition: playerDeath`. The exit portal remains an optional forward route during the run, not the only way to finish the session.

### Exit portal

- An exit portal is opened by a `portal` encounter. Current content authors that encounter in the `/portal` session; once opened, it remains visible through later waves, breaks, and boss encounters.
- The preferred exit portal position mirrors the return portal on the right:
  ```text
  x = session.player.position.x + 8 * session.player.contactBox.width
  y = session.player.position.y
  ```
- If the player currently overlaps the preferred position, shift the exit portal right by safe increments based on the player contact box until it no longer overlaps the player and still fits inside the arena.
- Before boss lock-in, an exit portal may be visible together with a return portal. After boss lock-in, only the exit portal remains.
- Entering the exit portal immediately starts the external Vibe Jam redirect to:
  ```text
  https://vibej.am/portal/2026
  ```
- The outgoing URL must include:
  ```text
  ref=https://slimeescape.com/portal
  ```
- Other incoming optional Vibe Jam parameters may be forwarded to the exit redirect, but the feature must work without them.

### Main-thread ownership and simulation boundary

- Portals are main-thread browser/world interactables, not simulation entities.
- Do not add a `portal` `EntitySnapshot` kind and do not add portal runtime events for this story.
- A main-thread portal controller derives visible portals from:
  - current browser portal context;
  - immutable `SessionDefinition`;
  - current `SnapshotPair.curr`;
  - current `UiShell` phase.
- The controller checks player overlap from `PlayerSnapshot` and `SessionDefinition.player.contactBox`. Redirect is performed by the browser through a single `location.assign`-style operation.
- Portal redirects are one-shot. Once portal travel has started, repeated frames must not trigger more redirects.
- Portal travel calls the target browser redirect immediately on overlap and also marks the portal travel timing so the local player zoom-out can appear as a best-effort frame while navigation is starting.
- `Renderer` may receive main-owned portal descriptors to draw world-space portals. These descriptors are presentation inputs, not authoritative simulation state.

### Portal presentation

- Portal shape is a black vertical oval.
- Portal size is based on the player contact box: about one player width and one player height.
- Return portal outline is thick and animated between purple and lime.
- Exit portal outline is thick and animated between cyan and pink.
- The same portal shape is used for return and exit portals. Their meaning comes from placement, timing, palette, and an uppercase `RETURN` label shown only on the return portal.
- The portal is drawn in world space over the arena, not as a DOM/HUD button.
- Reduced-motion mode may simplify shimmer animation, but the portal must remain visible and readable.

## Consequences

- `EncounterType` grows by one value, `portal`. Shared types, snapshots, content generation, and content validation must be updated together.
- The `/portal` session can now end normally after the boss so the result UI can offer the standard return-to-menu path.
- Browser URL parsing and redirects stay on the main thread, preserving the headless simulation worker contract.
- Because portals are not simulation entities, deterministic gameplay and snapshot shape remain smaller. The cost is that portal overlap and redirect behavior must be tested in main-thread code.
- The existing `/portal` auto-start implementation becomes a recorded design exception instead of an undocumented phase-model mismatch.

## Related

- [session-definition.md](session-definition.md)
- [main-ui-shell.md](main-ui-shell.md)
- [menu-and-startup-presentation.md](menu-and-startup-presentation.md)
- [snapshot-shape.md](snapshot-shape.md)
- [content-authoring.md](content-authoring.md)
- [encounter-presentation.md](encounter-presentation.md)
- [runtime-systems.md](runtime-systems.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [body-contact-boxes.md](body-contact-boxes.md)
- [../stories/026-vibe-jam-portals.md](../stories/026-vibe-jam-portals.md)
- [Vibe Jam 2026 portals](https://vibej.am/2026/#rules)
