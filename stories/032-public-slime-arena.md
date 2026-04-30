# Public Slime Arena

- Status: in-progress
- Created: 2026-04-30
- Updated: 2026-04-30

## Product intent

Public Slime Arena is a trashy always-online side mode where players drop into one shared slime pit, throw rocks at each other, evolve through slime forms by getting kills, and try to become the boss before someone knocks them back to the bottom.

The beauty of the mode is simplicity: join, spawn, throw rocks, kill, level up, die, start over.

## Product rules

- The mode uses one public online arena. There is no matchmaking, no private room list, no team selection, and no round start countdown in the first slice.
- The public multiplayer arena is a fixed `40 x 40 wu` square full playable world. Desktop and mobile visible area and camera behavior may affect what a player sees, but they do not change the playable online arena size.
- The server has a fixed player cap. A first target cap is `200` connected players.
- If the arena is full, a new player does not join and sees a clear full-arena message.
- Every player starts as the same level 1 slime.
- All non-boss slimes use the same attack: throw rocks.
- Killing any player gives exactly `+1 level`.
- Killing a boss still gives exactly `+1 level`; it does not skip slime forms.
- Death resets the player to level 1.
- Disconnecting loses the current arena progress.
- A player's level is visible above their character.
- Each level changes the player's slime form so the player can see the evolution path through the authored enemy slime roster.
- The final level transforms the player into the boss form.
- The first boss form should use the tower boss visual from `public/assets/boss-04.png`.
- Bosses use the standard boss scale, have much more HP than regular slimes, and are visually obvious targets.
- Regular slimes throw rocks. Bosses may use a fire attack like the existing game boss.
- Everyone can damage everyone, including boss versus boss.
- The mode does not award campaign XP, pet progress, unlocks, or permanent account progress in the first slice.

## Player-facing

- Sees: a new public arena entry point that is separate from campaign, training, and dungeon.
- Can do: open `/portal/` and enter the online Public Arena, not the old local portal preset session.
- Sees: if the arena is full, a short message says the online arena is full and the player remains outside the match.
- Can do: join the public arena immediately when a slot is available.
- Sees: on join, the player appears as the same small level 1 slime as everyone else.
- Sees: players spawn from simple corner spawn areas.
- Sees: every player has a level label above their slime.
- Can do: throw rocks at other players.
- Can do: kill another player to gain one level.
- Sees: after gaining a level, their slime changes into the next slime form.
- Sees: other players changing forms as they level up.
- Sees: when they die, they respawn as a level 1 slime.
- Sees: when another player reaches the final level, that player becomes a large boss using the tower boss visual.
- Can do: keep throwing rocks at boss players with the crowd.
- Sees: boss players have much more HP and feel like a public target.
- Can do: as a boss, use a fire attack instead of the normal rock throw.
- Sees: if multiple bosses exist, they can fight each other.
- Sees: killing a boss does not skip levels; the killer still advances by one level.
- Sees: a minimal HUD with their current level and the current arena population.
- Can do: open a minimal Public Arena menu and explicitly choose to leave the multiplayer arena.
- Sees: the standard combat control affordances still exist in online play: movement hint, fire hint, one selected rock weapon slot, aim crosshair, and a self HP bar with the level label above it.

## Technical

Public Slime Arena is built on [public-multiplayer-arena.md](../design/public-multiplayer-arena.md): one separate stateful Node/TypeScript server package, Socket.IO `4.x`, one authoritative in-memory `40 x 40 wu` arena, socket-local player identity, server-owned HP/kills/levels/boss transforms, and per-socket interest snapshots based on visible area plus margin. The static client gets the arena server URL at build time through a `VITE_` environment variable. The existing web shell uses the online phase branch recorded in [main-ui-shell.md](../design/main-ui-shell.md), with Public Arena as an explicit side-mode entry point rather than a local `ModePreset` run. Desktop and mobile online input reuse the visible-area camera mapping and the existing movement/aim/fire intent shape from [input-commands.md](../design/input-commands.md) and [mobile-web-support.md](../design/mobile-web-support.md). The first slice reuses shared content ids, world units, timing constants, input intent shape, and sprite registries, but it does not run the existing local one-player `src/sim` session runtime on the server.

Follow-up from online testing: the online arena must not render over an empty background. The Vibe Jam `/portal` entrypoint now leads to the online Public Arena, not to the old local authored portal run. Use `content/sessions/portal.md` as the content-authored source for the online arena's presentation config: arena size, background list, and active background. Remove the old authored waves/break/boss chain from that file. Do not introduce a hand-written `publicArenaConfig` copy of the same `portal` id, arena numbers, or background path; browser and server code must read the generated shared content projection instead.

Follow-up for portal entry behavior: `portal/index.html` is the public online arena page. It must request the Public Arena online flow directly instead of setting an auto-start local `portal` preset id. The portal loading image/intro can stay, but completing startup should connect to the online arena and must not start the local `src/sim` portal session.

Follow-up for HUD labels: online progression ids and the final boss level are shared headless Public Arena config. Server gameplay and main-thread HUD labels must import the same boss-level denominator, while authoritative snapshots can keep reporting the server-owned raw level.

Follow-up hardening before live verification: the server owns a simple per-socket input rate limit, sends an explicit `serverShutdown` close reason before intentional shutdown, and resolves overlapping projectile hits by deterministic nearest-target selection.

Follow-up from playtest: the current `Level 1/6` presentation is too short because it uses a hand-picked five-slime chain. Public Arena progression should use the authored enemy slime roster from generated content so players can climb through all available slime forms before the boss level.

Follow-up from playtest: online rendering should not feel like a stripped debug mode. Keep the simple deathmatch rules, but reuse the standard necessary combat UI affordances: desktop control hints, a single selected rock weapon slot, aim crosshair, self HP bar, readable online menu styling, and a better top HUD layout.

Follow-up from review: Public Arena must not hardcode the regular rock weapon or regular player movement/health outside content. The generated `portal` session remains the source for arena bounds, background, regular player `playerId`, and regular player loadout. The server and UI derive the regular selected weapon from that loadout, and the server derives weapon timing/projectile parameters from `content/weapons.md`.

Follow-up for spawn/camera semantics: spawn points are arena/world coordinates derived from the generated arena bounds, not viewport coordinates. The visible area/camera adapts to the spawned player. Spawn points must be inset far enough from arena edges that the player does not appear glued to the wall.

Follow-up for Vibe Jam portal semantics: return portal and exit portal positions are client-side main/render presentation only. The server does not know about these portals, does not include them in snapshots, and does not need protocol changes for them. Their rendered positions are world-space coordinates anchored relative to the arena center and generated arena bounds. They are not viewport coordinates, and they should not drift when the visible area or camera changes.

## Out of scope

- Matchmaking, ranked queues, private rooms, parties, invites, or friend joining.
- Teams, squads, alliances, or team scoring.
- Round timers, victory screens, match endings, or winner ceremonies.
- Persistent arena progress after disconnect.
- Campaign XP, pet XP, pet unlocks, achievements, or other permanent rewards.
- Choosing a starting slime or customizing the evolution chain before joining.
- Different weapons for different regular slime levels.
- Boss phases, boss hunt phases, or special rules when a boss appears.
- Boss-kill bonuses, level skipping, or comeback multipliers.
- Chat, emotes, player names, account profiles, reports, moderation UI, or cosmetics.
- Advanced map objectives, pickups, hazards, moving platforms, or procedural arena layouts.
- Spectator mode or replay.

## Acceptance

- The player can choose the public slime arena from a visible entry point.
- The `/portal/` page opens the online Public Arena flow and does not start the old local `portal` preset session.
- If the public arena has room, the player joins without a lobby or countdown.
- If the public arena is full, the player sees a clear full-arena message and is not connected to the arena.
- On join, the player appears as a level 1 slime at a corner spawn area.
- The public arena's playable world is fixed at `40 x 40 wu`, even when the visible area and camera show only part of it.
- The player's level is visible above their slime.
- Other players' levels are visible above their slimes.
- The local player's self HP line is visible like in standard mode, and the level label is above that HP line.
- Desktop online play shows the standard movement/fire affordances, a crosshair, and one selected rock weapon slot.
- A level 1 player can throw rocks.
- Killing another player increases the killer's level by exactly one.
- After a level increase, the killer's slime form changes.
- Killing a boss increases the killer's level by exactly one and does not skip forms.
- Dying resets the dead player to level 1.
- After death, the player respawns and can immediately re-enter the fight after any spawn safety rule ends.
- Reaching the final level transforms the player into the tower boss visual.
- The boss is larger and has much more HP than regular slimes.
- The boss can use a fire attack.
- Bosses can damage regular slimes and other bosses.
- Regular slimes can damage bosses with rocks.
- Disconnecting and rejoining starts the player back at level 1.
- The mode does not add campaign XP, pet progress, or permanent rewards after play.
- Multiplayer exit is explicit: desktop `Esc`/`Space`/Pointer Lock loss and the mobile menu button open a minimal Public Arena menu instead of immediately leaving; choosing `Exit Arena` closes the socket and returns to menu.
- Online spawn points are inset arena/world coordinates based on the generated arena bounds; changing the viewport must not change spawn coordinates, only the visible area/camera.
- Vibe Jam return and exit portal positions are render-only stable arena/world coordinates derived from the arena center, not from server state, viewport, or camera state.
- Online HUD layout shows population on the left and arena level progress in the right-side/top progress area; FPS must not be the only thing floating there during online play.
- Demo scenario: join the public arena, spawn as level 1, throw rocks, kill one player, see the level label and slime form change, die and return to level 1, then observe a high-level player become the tower boss and fight them without any separate boss phase starting.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Record the architecture decision for the public online arena runtime and link the story to it. | Added [public-multiplayer-arena.md](../design/public-multiplayer-arena.md). |
| T2 | [x] | Scaffold the `server/` package as a separate stateful Node/TypeScript deployable with npm scripts, tests, Socket.IO server dependency, and runtime config. | Added `server/` with Socket.IO host, runtime config, build/test scripts, lockfile, and import-boundary tests. |
| T3 | [x] | Define the first online protocol and client configuration path: build-time `VITE_` arena server URL, join accepted/rejected, input intent, authoritative snapshot, presentation events, disconnect/leave, and full-arena message. | Added shared Public Arena protocol types and `VITE_PUBLIC_ARENA_SERVER_URL` client config. |
| T4 | [x] | Implement server arena membership: one in-memory public arena, `200` player cap, socket-local player ids, corner spawn areas, disconnect removal, and restart-reset semantics. | Added in-memory arena state, Socket.IO join/leave/disconnect handlers, and membership tests. |
| T5 | [x] | Implement the compact authoritative arena simulation: fixed tick, player movement clamped to `40 x 40 wu`, rock throwing, boss fire, projectile hits, HP, death reset to level 1, kill `+1` level, slime form changes, tower boss transform, and boss-versus-boss damage. | Added compact server deathmatch simulation with movement, projectiles, HP/death/level rules, boss transform, and tests. |
| T6 | [x] | Implement Socket.IO delivery: reliable join/reject lifecycle, volatile per-socket snapshots at the snapshot cadence, and interest filtering by visible area plus margin. | Added volatile per-socket interest snapshots, presentation-event delivery, and interest filtering tests. |
| T7 | [x] | Add the Public Arena client entry point and connection flow in the existing web app. | Added the menu entry, Socket.IO client flow, accepted/rejected status handling, and tests that keep campaign/training/dungeon session start paths unchanged. |
| T8 | [x] | Render online snapshots with existing slime, boss, projectile, level-label, and HUD presentation. | Added online snapshot rendering, level labels, current level/population HUD, and tower boss/projectile visual registry coverage. |
| T9 | [x] | Route desktop and mobile online input to the server as movement, aim, and fire intent using the existing visible-area/camera mapping. | Reused desktop/mobile input adapters for online movement, aim, and fire intents while filtering non-online input commands. |
| T10 | [x] | Fix desktop online exit and update the shell contract. | Added desktop `Esc`/`Space` and Pointer Lock loss routing through `exitPublicArenaToMenu`, kept mobile pause/menu exit working, updated [main-ui-shell.md](../design/main-ui-shell.md), and covered the desktop online exit paths with `UiShell` tests. |
| T11 | [x] | Add server-owned respawn protection after death. | Added `spawnProtectionUntilSimMs` on the server so newly spawned and respawned players are skipped by projectile hit targeting during the protection window. Hits during protection do not reduce HP or create hit/death/level-up effects. Covered same-tick and later-tick boss burst cases. |
| T12 | [x] | Stop room-wide presentation event fanout before live verification. | Stopped emitting presentation events to the whole room in the first slice. The server still drains simulation events so the queue does not grow, and snapshots remain authoritative. |
| T13 | [x] | Add Public Arena background/config reuse from the portal visual setup. | Added a narrow shared Public Arena config with `arena: { width: 40, height: 40 }`, portal background image, and active background id. Server bounds and online renderer/tests now use that config, and the online renderer tiles the portal background without starting or mutating the portal preset/session flow. |
| T14 | [x] | Correct T13: replace the hardcoded Public Arena config with generated `portal.md` content. | Removed the hand-written `src/shared/publicArenaConfig.ts` path. Sessions now author `arenaWidth`/`arenaHeight`, `portal.md` is a minimal Public Arena presentation source, and server/renderer/tests read the generated Public Arena projection. |
| T15 | [x] | Correct T10: replace immediate multiplayer exit with a minimal Public Arena menu. | Added an online-only Public Arena menu overlay. Desktop `Esc`, `Space`, Pointer Lock loss, and the mobile menu button now open it, stop local online input, and send neutral movement/fire intent. `Exit Arena` is the explicit socket close path, while `Resume` restores online input without using local pause state. |
| T16 | [x] | Adjust the Public Arena HUD labels. | Added shared Public Arena progression config for the boss-level denominator. The HUD now shows `Online N` and `Level current/bossLevel`, clamping the displayed current level to the boss level while leaving authoritative snapshot levels unchanged. |
| T17 | [x] | Address remaining code-review hardening before live verification. | Added the per-socket `publicArena:input` rate limit, the intentional shutdown `serverShutdown` close reason, and deterministic nearest-overlapping projectile target selection with player-id tie-break tests. |
| T18 | [x] | Expand Public Arena progression to the full authored enemy slime roster. | Generated enemy content now exports `ENEMY_ARCHETYPE_LIST` in source order. Public Arena progression derives its slime chain and boss-level denominator from that list; server form lookup uses those generated entries and no longer falls back to the first slime. Added shared progression and final-slime-before-boss tests. |
| T19 | [x] | Restore standard desktop combat affordances in online play. | Public Arena online now reuses the standard HUD movement/fire hints and weapon slot bar on desktop, fed by the generated `portal` loadout. Mobile online keeps mobile controls. The portal session now selects `rock-thrower`; regular player health/movement come from the generated portal player, and server weapon timing/projectile values come from generated weapon content. The online menu contrast was restyled and desktop/mobile visibility plus content-source tests cover the contract. |
| T20 | [x] | Add online aim crosshair and self HP/level stack. | `PublicArenaRenderer` now receives the current online aim from `UiShell`, reuses the shared crosshair helper from the standard renderer, and renders a self-only world-space HP line with the local level label above it. Other players keep level labels only. Renderer/UI tests cover crosshair visibility/position, self HP ratio, and label ordering. |
| T21 | [x] | Tighten public arena spawn and camera semantics. | Public Arena corner spawns now use inset generated arena/world coordinates clamped by the level-1 regular form radius. Server tests cover spawn inset against generated bounds, and UI tests cover visible-area camera initialization from the authoritative self position rather than viewport-derived spawn data. |
| T22 | [x] | Rework the online top HUD layout. | Online population stays in the left top HUD (`Online N`), while arena level progress now occupies the right-side/top progress slot using the full slime-chain denominator. The FPS overlay is demoted below that lane with lower visual priority, and `PublicArenaHud`/`FpsOverlay`/`UiShell` tests cover labels and placement. |
| T23 | [ ] | Correct the `/portal/` page to enter the online Public Arena. | Replace the current local-preset auto-start behavior from `portal/index.html` with an online Public Arena entry signal. The startup path should preserve the portal loading image/intro, then enter `onlineConnecting` and connect through the configured `VITE_PUBLIC_ARENA_SERVER_URL` flow. It must not call `buildSessionDefinition('portal')`, `SimWorkerHost.startSession`, or any local `portal` `ModePreset` run. Update `UiShell`/startup tests so `/portal/` proves it starts the online arena and no longer expects a local `portal` session. |
| T24 | [ ] | Anchor return and exit portal coordinates to the arena center in main/render only. | Update the Vibe Jam portal positioning helpers/descriptors on the client presentation side so return portal and exit portal positions are generated in arena/world coordinates relative to the arena center and generated arena bounds, not relative to viewport/camera and not relative to the player's current spawn position. Do not add these portals to the server simulation, server snapshots, or Public Arena protocol; the server remains unaware of them. The main/render code should read the generated Public Arena arena config already used for presentation. Add tests that viewport changes do not move the portal coordinates and that the coordinates remain inside the authored arena bounds. |
| T25 | [ ] | Run automated checks and request live online verification from the user. | Include server unit tests, protocol/client tests, renderer/HUD/UI shell/startup tests, build/content checks, and a manual two-client arena check per pipeline. Confirm `/portal/` enters the online arena, explicit Public Arena exit menu, respawn protection, visible arena background, full slime progression denominator, standard combat affordances, crosshair, self HP/level stack, inset arena-coordinate spawns, render-only center-anchored return/exit portal coordinates, online count, top-right level progress, review hardening, and graceful server-close messaging. |

## Related

- [public-multiplayer-arena.md](../design/public-multiplayer-arena.md)
- [web-stack.md](../design/web-stack.md)
- [content-boundaries.md](../design/content-boundaries.md)
- [content-authoring.md](../design/content-authoring.md)
- [arena-and-coordinates.md](../design/arena-and-coordinates.md)
- [camera-and-visible-area.md](../design/camera-and-visible-area.md)
- [session-definition.md](../design/session-definition.md)
- [encounter-presentation.md](../design/encounter-presentation.md)
- [input-commands.md](../design/input-commands.md)
- [simulation-timing.md](../design/simulation-timing.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [content-archetypes.md](../design/content-archetypes.md)
- [universal-weapons-and-projectiles.md](../design/universal-weapons-and-projectiles.md)
- [projectiles-and-combat.md](../design/projectiles-and-combat.md)
- [health-and-death.md](../design/health-and-death.md)
- [boss-encounter.md](../design/boss-encounter.md)
- [sprite-assets.md](../design/sprite-assets.md)
- [main-ui-shell.md](../design/main-ui-shell.md)
- [mobile-web-support.md](../design/mobile-web-support.md)
- [vibe-jam-portals.md](../design/vibe-jam-portals.md)
- [testing.md](../design/testing.md)
