# Social Links

- Status: in-progress
- Created: 2026-04-27
- Updated: 2026-04-27

## Product Intent

Players should have a quick, low-pressure path to the project source and community from the screens where they already stop and choose what to do next: the main menu and the Pause menu.

The links should feel like small side affordances, not new game modes or large calls to action. Play, Training, Resume, Settings, and Exit stay more important.

When players share the game, the browser and social previews should also look intentional. Slime Escape needs clear SEO metadata and Open Graph tags so shared links show the game name, a short description, and the project preview image.

The browser tab and saved shortcut should also use the game's own PNG icons instead of a default browser icon.

The failure loop should be short. If the player loses, the Result screen should make the next attempt feel one click away, with a clear Replay/Restart action at the top of the screen.

## Player-facing

- Sees: two side icons on the main menu: GitHub and Discord.
- Sees: the same two side icons on the Pause menu.
- Can do: open the GitHub repository in a new browser tab.
- Can do: open the Discord invite in a new browser tab.
- Sees: when the game link is shared in a rich preview surface, it uses the Slime Escape title, a short game description, and the preview image.
- Sees: browser tabs and saved shortcuts use Slime Escape icons.
- Sees: after losing a run, the Result screen has a clear Replay/Restart button at the top.
- Can do: after losing, start the same game session again directly from the Result screen.

## Technical

No new `design/` decision file is needed for this story. It stays inside existing contracts:

- menu and pause UI live under `src/main/ui/**` per [main-ui-shell.md](../design/main-ui-shell.md), [menu-and-startup-presentation.md](../design/menu-and-startup-presentation.md), and [web-stack.md](../design/web-stack.md);
- result presentation already belongs to `ResultOverlay`/`UiShell` per [main-ui-shell.md](../design/main-ui-shell.md) and [session-result-summary.md](../design/session-result-summary.md);
- metadata changes are static page `<head>` updates in `index.html` and `portal/index.html`.

For GitHub and Discord icons, use a shared main-UI link rail with real `<a>` elements and the local social SVG assets checked into the repository: `/images/social/github.svg` and `/images/social/discord.svg`. Do not add a new icon dependency or external font. The anchors own `href`, `target="_blank"`, `rel="noopener noreferrer"`, and accessible English labels.

The SVGs should use `currentColor` for their fill so the UI can set normal, hover, and focus colors through CSS. Do not paste unknown SVG path data into code without a recorded source.

For loss replay, do not introduce a new public phase. The one-click Result action may internally clear the result state through the existing return-to-menu path and then reuse the normal start-session path for the last started preset/source. The player sees this as Replay/Restart, while `UiShell` still owns session start and teardown.

## Out of scope

- Adding links to HUD, Result UI, Settings, loading, or startup error screens.
- In-game browser panels or embedded Discord/GitHub views.
- Account linking, OAuth, Discord SDK, GitHub API, or community membership checks.
- Analytics, tracking, share links, or custom invite generation.
- Any change to gameplay, session content, progression, or saved settings.
- A full redesign of the Result screen beyond adding the loss-state Replay/Restart action.
- Changing the victory result flow.

## Acceptance

- The main menu shows GitHub and Discord as side icons.
- The Pause menu shows the same GitHub and Discord side icons.
- Clicking GitHub opens `https://github.com/alxdos/slime-escape` in a new browser tab.
- Clicking Discord opens `https://discord.gg/rUwc52wc6v` in a new browser tab.
- Both links use `rel="noopener noreferrer"`.
- Both links have accessible English names.
- The icons are visually secondary to Play, Training, Resume, Settings, and Exit to Menu.
- The icons do not cover Play, Training, difficulty selection, Settings, Fullscreen, Resume, Exit to Menu, or the pause progress summary.
- Opening a link from Pause does not resume, stop, or otherwise change the active session.
- The page has SEO title and description metadata for Slime Escape.
- The page has Open Graph tags for title, description, and image.
- The main game page uses title `Slime Escape`.
- The main game page uses description `Survive escalating slime waves, outrun the closing darkness, and defeat the boss trapping you in a strange arena.`
- The portal page uses title `Slime Escape - Vibe Jam 2026`.
- The portal page uses description `Enter Slime Escape through the Vibe Jam portal, fight through the slime arena, and find the way back or onward.`
- Open Graph image points to `/images/slime-escape-og.jpg`.
- The page uses PNG favicon and touch icons from `/images/favicon-32.png`, `/images/apple-icon.png`, and `/images/icon-192.png`.
- After a loss, the Result screen shows a Replay/Restart button at the top.
- Clicking Replay/Restart after a loss starts the same session again.
- The existing Menu action remains available on the loss Result screen.
- The Replay/Restart action is not required on the victory Result screen.
- Desktop landscape and narrow viewport checks show no incoherent overlap.

## Metadata Copy

Main game page:

- Title: `Slime Escape`
- Description: `Survive escalating slime waves, outrun the closing darkness, and defeat the boss trapping you in a strange arena.`
- Open Graph title: `Slime Escape`
- Open Graph description: `Survive escalating slime waves, outrun the closing darkness, and defeat the boss trapping you in a strange arena.`
- Open Graph image: `/images/slime-escape-og.jpg`
- Open Graph URL: `https://slimeescape.com/`

Portal page:

- Title: `Slime Escape - Vibe Jam 2026`
- Description: `Enter Slime Escape through the Vibe Jam portal, fight through the slime arena, and find the way back or onward.`
- Open Graph title: `Slime Escape - Vibe Jam 2026`
- Open Graph description: `Enter Slime Escape through the Vibe Jam portal, fight through the slime arena, and find the way back or onward.`
- Open Graph image: `/images/slime-escape-og.jpg`
- Open Graph URL: `https://slimeescape.com/portal`

## Product Notes

- GitHub points to `https://github.com/alxdos/slime-escape`.
- Discord points to `https://discord.gg/rUwc52wc6v`.
- SEO and Open Graph text should be short, clear, and player-facing.
- Social previews should use `/images/slime-escape-og.jpg`.
- Favicon and touch icon setup should use the existing PNG files only: `/images/favicon-32.png`, `/images/apple-icon.png`, and `/images/icon-192.png`.
- The loss Result screen action label can be `Replay` or `Restart`; use the clearer label in the final UI.
- Replay/Restart should feel like the primary action after a loss, while Menu stays secondary.
- The icons should sit at the side of each screen, so they are available but not competing with the main actions.
- The two screens should use the same icon treatment so the links feel like a consistent project/community affordance.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Add static metadata to `index.html` and `portal/index.html`: SEO title/description, Open Graph title/description/image/url, and PNG favicon/touch icon links. | Use the copy and asset paths from `Metadata Copy` / `Product Notes`; no runtime code needed. |
| T2 | [x] | Add shared social link UI under `src/main/ui/**`: GitHub/Discord link data, rendering for `/images/social/github.svg` and `/images/social/discord.svg`, stable side-rail layout, accessible anchor labels, `target="_blank"`, and `rel="noopener noreferrer"`. | The local SVGs use `currentColor`, so normal/hover/focus colors can be set through CSS; no icon dependency. |
| T3 | [x] | Integrate the social link rail into `MenuOverlay` and `PauseOverlay`, keeping it visually secondary and clear of existing menu/pause controls on desktop and narrow viewports. | Pause links must not call sim, resume, exit, settings, or change phase. |
| T4 | [ ] | Add loss-only Replay/Restart: `ResultOverlay` renders a primary top action for `loss`, `UiShell` restarts the last started preset/source through the existing session start path, and victory result flow stays unchanged. | Avoid a new public `result -> running` phase; internally reuse existing cleanup/start orchestration. |
| T5 | [ ] | Add focused tests and verification notes for metadata, social anchors, menu/pause placement, loss replay, and no incoherent overlap. | Per pipeline, ask the user for live browser verification instead of starting the dev server directly. |

## Related

- [main-ui-shell.md](../design/main-ui-shell.md)
- [menu-and-startup-presentation.md](../design/menu-and-startup-presentation.md)
- [session-result-summary.md](../design/session-result-summary.md)
- [input-commands.md](../design/input-commands.md)
- [web-stack.md](../design/web-stack.md)
- [testing.md](../design/testing.md)
- [023-main-menu-and-startup-ux.md](023-main-menu-and-startup-ux.md)
- [024-session-end-results.md](024-session-end-results.md)
