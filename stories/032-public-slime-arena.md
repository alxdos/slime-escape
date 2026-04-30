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
- Each level changes the player's slime form so the player can see the evolution path.
- The final level transforms the player into the boss form.
- The first boss form should use the tower boss visual from `public/assets/boss-04.png`.
- Bosses use the standard boss scale, have much more HP than regular slimes, and are visually obvious targets.
- Regular slimes throw rocks. Bosses may use a fire attack like the existing game boss.
- Everyone can damage everyone, including boss versus boss.
- The mode does not award campaign XP, pet progress, unlocks, or permanent account progress in the first slice.

## Player-facing

- Sees: a new public arena entry point that is separate from campaign, training, and dungeon.
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

## Technical

Public Slime Arena is built on [public-multiplayer-arena.md](../design/public-multiplayer-arena.md): one separate stateful Node/TypeScript server package, Socket.IO `4.x`, one authoritative in-memory `40 x 40 wu` arena, socket-local player identity, server-owned HP/kills/levels/boss transforms, and per-socket interest snapshots based on visible area plus margin. The static client gets the arena server URL at build time through a `VITE_` environment variable. The first slice reuses shared content ids, world units, timing constants, input intent shape, and sprite registries, but it does not run the existing local one-player `src/sim` session runtime on the server.

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
- If the public arena has room, the player joins without a lobby or countdown.
- If the public arena is full, the player sees a clear full-arena message and is not connected to the arena.
- On join, the player appears as a level 1 slime at a corner spawn area.
- The public arena's playable world is fixed at `40 x 40 wu`, even when the visible area and camera show only part of it.
- The player's level is visible above their slime.
- Other players' levels are visible above their slimes.
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
- Demo scenario: join the public arena, spawn as level 1, throw rocks, kill one player, see the level label and slime form change, die and return to level 1, then observe a high-level player become the tower boss and fight them without any separate boss phase starting.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Record the architecture decision for the public online arena runtime and link the story to it. | Added [public-multiplayer-arena.md](../design/public-multiplayer-arena.md). |
| T2 | [ ] | Scaffold the `server/` package as a separate stateful Node/TypeScript deployable with npm scripts, tests, Socket.IO server dependency, and runtime config. | It may import `../src/shared/**`; it must not import `../src/main/**` or `../src/sim/**`. |
| T3 | [ ] | Define the first online protocol and client configuration path: build-time `VITE_` arena server URL, join accepted/rejected, input intent, authoritative snapshot, presentation events, disconnect/leave, and full-arena message. | Share protocol types only where both client and server need them. |
| T4 | [ ] | Implement server arena membership: one in-memory public arena, `200` player cap, socket-local player ids, corner spawn areas, disconnect removal, and restart-reset semantics. | Cover join/full/disconnect/spawn behavior with server-side tests. |
| T5 | [ ] | Implement the compact authoritative arena simulation: fixed tick, player movement clamped to `40 x 40 wu`, rock throwing, boss fire, projectile hits, HP, death reset to level 1, kill `+1` level, slime form changes, tower boss transform, and boss-versus-boss damage. | Keep this runtime deathmatch-only; no waves, zone, drops, campaign result, pets, or local session flow. |
| T6 | [ ] | Implement Socket.IO delivery: reliable join/reject lifecycle, volatile per-socket snapshots at the snapshot cadence, and interest filtering by visible area plus margin. | One arena, smart payloads; interest filtering must not affect gameplay authority. |
| T7 | [ ] | Add the Public Arena client entry point and connection flow in the existing web app. | Shows full-arena rejection, connects when accepted, and keeps campaign/training/dungeon flows unchanged. |
| T8 | [ ] | Render online snapshots with existing slime, boss, projectile, level-label, and HUD presentation. | Show current level and arena population; use `boss-tower-sentinel` / `boss-04.png` for boss players. |
| T9 | [ ] | Route desktop and mobile online input to the server as movement, aim, and fire intent using the existing visible-area/camera mapping. | The server remains authoritative; mobile support sends no new simulation-visible touch command kinds. |
| T10 | [ ] | Run automated checks and request live online verification from the user. | Include server unit tests, protocol/client tests, build/content checks, and a manual two-client arena check per pipeline. |

## Related

- [public-multiplayer-arena.md](../design/public-multiplayer-arena.md)
- [web-stack.md](../design/web-stack.md)
- [content-boundaries.md](../design/content-boundaries.md)
- [arena-and-coordinates.md](../design/arena-and-coordinates.md)
- [camera-and-visible-area.md](../design/camera-and-visible-area.md)
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
- [testing.md](../design/testing.md)
