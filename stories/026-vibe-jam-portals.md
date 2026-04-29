# Vibe Jam Portals

- Status: done
- Created: 2026-04-27
- Updated: 2026-04-29

## Product Intent

The Vibe Jam portal route should feel like a real door between games, not like a menu shortcut.

When a player arrives from another Vibe Jam game, Slime Escape remembers where they came from and gives them a physical return portal inside portal-capable runs. They can try the portal run, lose, return to the menu, restart that route, and still find the way back until the arena locks for the boss.

When the special portal run starts, Slime Escape should open the forward portal before the first wave, let the run continue, and keep that portal in the arena. The boss fight should then end through the normal result flow so the player can return to the menu after the run.

The core product idea: the left portal is a way back; the right portal is the way onward.

## Player-facing

- Sees: if they entered from a Vibe Jam portal with a return link, a black oval return portal appears eight player widths to the left of the player spawn. It is about the size of the player, has a thick shimmering purple-lime outline, and carries an uppercase `RETURN` label.
- Sees: during normal waves, the return portal stays available as a clear diegetic exit back to the previous game.
- Sees: the exit portal appears symmetrically to the right of spawn, using the same black oval but a cyan-pink shimmer so it reads differently from the return portal.
- Sees: when the boss encounter starts, the return portal collapses and does not return. The exit portal remains; the arena has locked only the way back.
- Sees: after the boss is defeated in the `/portal` session, the game ends normally and shows the standard result flow with a path back to the menu.
- Can do: walk into the return portal to go back to the previous game before boss lock-in.
- Can do: walk into the exit portal to continue through the Vibe Jam portal network.

## Experience

### Entering From Vibe Jam

If the player opens Slime Escape through a Vibe Jam portal, the URL may include:

```text
?portal=true&ref=...
```

The game treats this as an inbound portal context for the current browser tab. The player should land directly in the portal entry experience, not in the standard menu flow.

The return portal appears near the spawn:

```text
return portal = eight player widths left of the player spawn
```

It should be close enough to notice and use, but not directly under the player's feet. It is an object in the world, not a UI button.

If `ref` is missing or unusable, no return portal appears. All incoming portal parameters are optional except `portal=true`; the experience must degrade cleanly.

### Return Portal Lifetime

The return portal is persistent before the boss lock-in, but only in sessions that contain at least one `type: portal` encounter.

If the player loses before the boss, returns to the menu, and starts the portal route again, the return portal can appear again near that route's spawn. Normal sessions without a portal encounter do not show or consume the return portal.

When the boss encounter starts, the return portal collapses and the return context is consumed. From that moment on, the player is committed to the end of the run. If they later lose, the return portal does not come back.

### Portal Session Ending

The `/portal` session has a special ending:

```text
opening portal encounter -> 10 waves -> boss-gargoyle -> normal result
```

The opening portal encounter is transparent to gameplay: it opens the exit portal, immediately advances into the first wave, and leaves the portal behind in the arena.

After `boss-gargoyle` is defeated, the game should show the normal win result and allow the player to return to the menu.

The exit portal appears eight player widths to the right of the original player spawn point, mirroring the return portal on the left. If the player is standing on that point, it shifts right by a safe offset and continues shifting right until it is not under the player.

Walking into the exit portal immediately starts the external Vibe Jam redirect to:

```text
https://vibej.am/portal/2026
```

The outgoing link should include Slime Escape as the return reference:

```text
ref=https://slimeescape.com/portal
```

Other Vibe Jam character parameters may be forwarded or derived later, but the portal feature must not depend on them.

## Visual Direction

- Portal shape: black vertical oval.
- Portal size: about the player body's width and height.
- Return portal outline: thick, animated, shimmering between purple and lime.
- Exit portal outline: thick, animated, shimmering between cyan and pink.
- Portal interior: black enough to read as depth, not as a hole in the UI.
- The portal should be visible during combat without becoming a HUD element.
- The return portal and exit portal share the same portal shape, but use different shimmer palettes so their meanings stay readable when both are visible.
- The return portal carries an uppercase `RETURN` label. The exit portal stays unlabeled and reads through placement, color, and interaction.

## Product Notes

- There are two portal concepts:
  - `return portal`: appears only for inbound Vibe Jam players with a usable return link.
- `exit portal`: opens from a `type: portal` encounter, persists through the run, and sends the player onward through Vibe Jam.
- The return portal should be available only in sessions that contain at least one `type: portal` encounter while the inbound context is active and before boss lock-in.
- Current content authors the exit portal in the special `/portal` session.
- The boss is the point of no return for the return portal. The exit portal remains available as the forward route.
- The portal route should remain fast. No login, no standard menu gate, no extra start screen.

## Technical

Architecture is prepared in [vibe-jam-portals.md](../design/vibe-jam-portals.md).

Key implementation contracts:

- `/portal` continues to use the existing `SLIME_ESCAPE_AUTO_START = "portal"` entrypoint path; [main-ui-shell.md](../design/main-ui-shell.md) and [menu-and-startup-presentation.md](../design/menu-and-startup-presentation.md) now record this as the sanctioned `loading -> running` exception for configured entrypoints.
- `EncounterDefinition.type` gains `portal`; shared session, snapshot, content authoring, encounter presentation, and result-progress rules are updated through the related design files.
- Portals are main-thread browser/world interactables, not simulation entities. No `EntitySnapshot` kind or runtime event is added for portals in this story.
- A main-thread portal controller owns inbound query parsing, tab-scoped return context, portal placement, overlap checks, one-shot redirects, and renderer portal descriptors.
- The `/portal` session opens its exit portal with a transparent `portal` encounter before the first wave, then completes normally after `boss-gargoyle` so the result UI can return to the menu.

## Out of scope

- Full Vibe Jam avatar import or character customization.
- A visible username / team UI for incoming portal players.
- Portal travel cutscenes between games.
- Saving portal return context across browser restarts.
- Making standard campaign sessions end with the Vibe Jam exit portal.
- A menu-only return button. The primary interaction is the physical portal in the arena.
- Leaderboards, achievements, or rewards for portal runs.
- Final narrative text for the portal encounter.

## Acceptance

- Loading `https://slimeescape.com/portal` starts the portal entry experience without the standard menu gate.
- If the player arrives with `portal=true` and a usable `ref`, a return portal appears eight player widths to the left of the spawn with an uppercase `RETURN` label.
- Walking into the return portal redirects to the stored return link and preserves the Vibe Jam portal continuity parameters required by the portal contract.
- If the player loses before the boss and starts another portal-capable session in the same tab, the return portal can appear again near the new session's spawn.
- If the player starts a normal session without a `portal` encounter, no return portal appears and the return context is not consumed.
- When a boss encounter starts after an inbound portal visit, the return portal collapses and does not return.
- If the player loses after the boss lock-in, the return portal does not appear in later sessions.
- In the `/portal` session, a transparent opening portal encounter appears before the first wave and leaves the exit portal active while combat continues.
- The exit portal appears eight player widths to the right of the original spawn point, or shifts right if the player occupies that spot.
- In the `/portal` session, defeating `boss-gargoyle` ends the run normally and allows the result UI to return to the menu.
- When the boss lock-in happens, no return portal is visible.
- Walking into the exit portal immediately starts the Vibe Jam redirect to `https://vibej.am/portal/2026` with `ref=https://slimeescape.com/portal`; any local zoom-out is best-effort while navigation begins.
- If incoming optional parameters such as `username`, `color`, `hp`, or `speed` are absent, the portals still work.
- Demo: enter through `/portal?portal=true&ref=<test-return-url>`, see return left and exit right before the first wave; use the return portal; enter again, survive to the boss and see the return portal collapse while the exit remains; defeat the boss and return to the menu through the normal result flow.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Architectural preparation: add [vibe-jam-portals.md](../design/vibe-jam-portals.md), update adjacent design files, story `Technical`/`Tasks`/`Related`, and story indexes. | No production code. |
| T2 | [x] | Session/content contract: add `portal` encounter type to shared session/snapshot types, content parser/generator validation, generated sessions, and tests. | Add transparent opening `portal` encounter before `portal-wave-1` and keep normal completion after `portal-boss`. |
| T3 | [x] | Inbound portal context: add main-thread parsing/storage helpers for `portal=true`, usable `ref`, optional query forwarding, return URL building, and exit URL building. | Pure tests for malformed refs, missing optional params, `sessionStorage`/tab lifetime, `ref=https://slimeescape.com/portal`, and preserving optional params. |
| T4 | [x] | Portal controller lifecycle: wire a main-thread controller through `UiShell` so return portals appear across sessions before boss lock-in, collapse on boss start, and never appear after context is consumed. | No sim imports; derive from `SessionDefinition`, `SnapshotPair.curr`, phase, and browser context. |
| T5 | [x] | Renderer portal presentation: draw main-owned world-space portal descriptors as black vertical ovals with thick purple-lime shimmer, sized from the player contact box. | Must not add portal snapshot entities; include reduced-motion and visibility tests where practical. |
| T6 | [x] | Portal interaction and redirects: detect player overlap with return/exit portals, start exactly one browser redirect, keep travel timing for best-effort local zoom-out, and keep opened exit portals persistent after their `portal` encounter. | Return portal uses stored return URL; exit portal targets Vibe Jam with Slime Escape as `ref`; both start redirect immediately on overlap. |
| T7 | [x] | Verification pass: focused unit/integration tests plus manual live-check instructions for the user. | Per pipeline, do not start the dev server or browser; ask the user to verify `/portal?portal=true&ref=<test-url>`, boss lock-in, the opening exit portal, and normal post-boss result flow. |

## Related

- [vibe-jam-portals.md](../design/vibe-jam-portals.md)
- [session-definition.md](../design/session-definition.md)
- [main-ui-shell.md](../design/main-ui-shell.md)
- [menu-and-startup-presentation.md](../design/menu-and-startup-presentation.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [content-authoring.md](../design/content-authoring.md)
- [encounter-presentation.md](../design/encounter-presentation.md)
- [boss-encounter.md](../design/boss-encounter.md)
- [runtime-systems.md](../design/runtime-systems.md)
- [arena-and-coordinates.md](../design/arena-and-coordinates.md)
- [body-contact-boxes.md](../design/body-contact-boxes.md)
- [session-result-summary.md](../design/session-result-summary.md)
- [025-escape-progress-path.md](025-escape-progress-path.md)
