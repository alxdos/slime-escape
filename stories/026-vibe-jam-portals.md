# Vibe Jam Portals

- Status: in-progress
- Created: 2026-04-27
- Updated: 2026-04-27

## Product Intent

The Vibe Jam portal route should feel like a real door between games, not like a menu shortcut.

When a player arrives from another Vibe Jam game, Slime Escape remembers where they came from and gives them a physical return portal inside the arena. They can try the run, lose, return to the menu, start another mode, and still find the way back until the arena locks for the boss.

When the player clears the special portal run, Slime Escape should not end with a normal victory screen. The boss fight should give way to a quiet final encounter where the exit portal opens and the player chooses to step through it.

The core product idea: the first portal is a way back; the last portal is the way onward.

## Player-facing

- Sees: if they entered from a Vibe Jam portal with a return link, a black oval return portal appears two player widths to the left of the player spawn. It is about the size of the player and has a thick shimmering purple-lime outline.
- Sees: during normal waves, the return portal stays available as a clear diegetic exit back to the previous game.
- Sees: when the boss encounter starts, the return portal collapses and does not return. The arena has locked.
- Sees: after the boss is defeated in the `/portal` session, the game moves into a final portal encounter instead of ending immediately.
- Sees: the exit portal opens at the original spawn point, or shifts right if the player is standing there. It uses the same black oval and purple-lime outline, but reads as the only remaining way forward.
- Can do: walk into the return portal to go back to the previous game before boss lock-in.
- Can do: walk into the exit portal after the boss to continue through the Vibe Jam portal network.

## Experience

### Entering From Vibe Jam

If the player opens Slime Escape through a Vibe Jam portal, the URL may include:

```text
?portal=true&ref=...
```

The game treats this as an inbound portal context for the current browser tab. The player should land directly in the portal entry experience, not in the standard menu flow.

The return portal appears near the spawn:

```text
return portal = two player widths left of the player spawn
```

It should be close enough to notice and use, but not directly under the player's feet. It is an object in the world, not a UI button.

If `ref` is missing or unusable, no return portal appears. All incoming portal parameters are optional except `portal=true`; the experience must degrade cleanly.

### Return Portal Lifetime

The return portal is persistent before the boss lock-in.

If the player loses before the boss, returns to the menu, and starts any mode, the return portal can appear again near that mode's spawn. This supports the Vibe Jam promise that a player can come from another game, try Slime Escape, and still go back without needing to pass the run.

When the boss encounter starts, the return portal collapses and the return context is consumed. From that moment on, the player is committed to the end of the run. If they later lose, the return portal does not come back.

### Portal Session Ending

The `/portal` session has a special ending:

```text
10 waves -> boss-gargoyle -> final portal encounter -> exit portal
```

After `boss-gargoyle` is defeated, the game should not show the normal win result yet. Instead, combat pressure drops, the arena becomes quiet, and a final portal encounter starts.

The exit portal appears at the original player spawn point. If the player is standing on that point, it shifts to the right by a safe offset and continues shifting right until it is not under the player.

When the exit portal appears, any return portal is gone. The player should see only one meaningful portal: forward.

Walking into the exit portal redirects to:

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
- Portal outline: thick, animated, shimmering between purple and lime.
- Portal interior: black enough to read as depth, not as a hole in the UI.
- The portal should be visible during combat without becoming a HUD element.
- The return portal and exit portal can share the same visual language; their meaning comes from timing and placement.
- No explanatory label is required by default. The portal should read through placement, color, and interaction.

## Product Notes

- There are two portal concepts:
  - `return portal`: appears only for inbound Vibe Jam players with a usable return link.
  - `exit portal`: appears after the portal session boss and sends the player onward through Vibe Jam.
- The return portal should be available in any started mode while the inbound context is active and before boss lock-in.
- The exit portal belongs only to the special `/portal` session ending.
- The boss is the point of no return. This keeps the final sequence clear and prevents two different portals from competing for meaning.
- The portal route should remain fast. No login, no standard menu gate, no extra start screen.

## Technical

Architecture is prepared in [vibe-jam-portals.md](../design/vibe-jam-portals.md).

Key implementation contracts:

- `/portal` continues to use the existing `SLIME_ESCAPE_AUTO_START = "portal"` entrypoint path; [main-ui-shell.md](../design/main-ui-shell.md) and [menu-and-startup-presentation.md](../design/menu-and-startup-presentation.md) now record this as the sanctioned `loading -> running` exception for configured entrypoints.
- `EncounterDefinition.type` gains `portal`; shared session, snapshot, content authoring, encounter presentation, and result-progress rules are updated through the related design files.
- Portals are main-thread browser/world interactables, not simulation entities. No `EntitySnapshot` kind or runtime event is added for portals in this story.
- A main-thread portal controller owns inbound query parsing, tab-scoped return context, portal placement, overlap checks, one-shot redirects, and renderer portal descriptors.
- The `/portal` session should end its authored combat chain with a terminal `portal` encounter after `boss-gargoyle`; normal victory is not the completion path for that route.

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
- If the player arrives with `portal=true` and a usable `ref`, a return portal appears two player widths to the left of the spawn.
- Walking into the return portal redirects to the stored return link and preserves the Vibe Jam portal continuity parameters required by the portal contract.
- If the player loses before the boss and starts another mode in the same tab, the return portal can appear again near the new mode's spawn.
- When a boss encounter starts after an inbound portal visit, the return portal collapses and does not return.
- If the player loses after the boss lock-in, the return portal does not appear in later sessions.
- In the `/portal` session, defeating `boss-gargoyle` transitions into a final portal encounter instead of immediately showing the normal win result.
- The exit portal appears at the original spawn point, or shifts right if the player occupies that spot.
- When the exit portal appears, no return portal is visible.
- Walking into the exit portal redirects to `https://vibej.am/portal/2026` with `ref=https://slimeescape.com/portal`.
- If incoming optional parameters such as `username`, `color`, `hp`, or `speed` are absent, the portals still work.
- Demo: enter through `/portal?portal=true&ref=<test-return-url>`, see and use the return portal; enter again, survive to the boss and see the return portal collapse; defeat the boss and step into the final exit portal.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Architectural preparation: add [vibe-jam-portals.md](../design/vibe-jam-portals.md), update adjacent design files, story `Technical`/`Tasks`/`Related`, and story indexes. | No production code. |
| T2 | [ ] | Session/content contract: add `portal` encounter type to shared session/snapshot types, content parser/generator validation, generated sessions, and tests. | Add final `portal` encounter after `portal-boss`; change the portal preset to external-redirect completion per design. |
| T3 | [ ] | Inbound portal context: add main-thread parsing/storage helpers for `portal=true`, usable `ref`, optional query forwarding, return URL building, and exit URL building. | Pure tests for malformed refs, missing optional params, `sessionStorage`/tab lifetime, `ref=https://slimeescape.com/portal`, and preserving optional params. |
| T4 | [ ] | Portal controller lifecycle: wire a main-thread controller through `UiShell` so return portals appear across sessions before boss lock-in, collapse on boss start, and never appear after context is consumed. | No sim imports; derive from `SessionDefinition`, `SnapshotPair.curr`, phase, and browser context. |
| T5 | [ ] | Renderer portal presentation: draw main-owned world-space portal descriptors as black vertical ovals with thick purple-lime shimmer, sized from the player contact box. | Must not add portal snapshot entities; include reduced-motion and visibility tests where practical. |
| T6 | [ ] | Portal interaction and redirects: detect player overlap with return/exit portals, trigger exactly one browser redirect, and ensure exit portal appears only in the `portal` encounter. | Return portal uses stored return URL; exit portal targets `https://vibej.am/portal/2026` with Slime Escape as `ref`. |
| T7 | [ ] | Verification pass: focused unit/integration tests plus manual live-check instructions for the user. | Per pipeline, do not start the dev server or browser; ask the user to verify `/portal?portal=true&ref=<test-url>`, boss lock-in, and final exit portal. |

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
