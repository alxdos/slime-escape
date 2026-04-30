# Co-Op Vs Slimes

- Status: planned
- Created: 2026-04-30
- Updated: 2026-04-30

## Product intent

Once the shared simulation core hosts multi-actor online sessions through the Node arena host (story 036), online co-op against authored slime waves becomes a session-config and UI exercise rather than an engine exercise. This story delivers it as a player-facing online mode: a new menu entry, a co-op session config that references existing campaign-shape content (waves, zone, encounters, boss), and the same Socket.IO join flow used by Public Arena. Specifics like party size, win/loss when a player dies, and run-summary semantics for co-op are decided at the start of this story by the product side and recorded as session config and existing `lossCondition`/run-summary policy from story 035 — not as new architectural decisions.

## Player-facing

- Sees: a new online mode entry point in the main menu alongside Public Arena.
- Can do: join a co-op slime arena run with up to N players against authored enemy waves and a boss encounter.
- Sees: shared progress through waves and shared boss state.
- Sees: when a player dies, the recorded co-op `lossCondition` plays out (working assumption: respawn-each, party plays on; final values agreed at story start).
- Sees: at the end of the run, the result screen reflects the co-op outcome per the run-summary policy from story 035.

## Technical

No new engine work. Author a co-op session config in shared content (`content/sessions/`) with `players: [<N>]`, existing wave/zone/boss content, and the chosen co-op `lossCondition`. Add a new online mode entry in the main menu (`UiShell` mode catalog). Reuse the existing Socket.IO join/leave flow from Public Arena; if needed, parameterize the join request with a session config id so the Node host knows which session to start (extension agreed within this story, not architectural).

## Out of scope

- New enemy or boss content — uses existing authored content only.
- Persistent co-op progression, accounts, lobbies, friend invites, or matchmaking.
- Client-side prediction, delta snapshots, or any transport optimization.
- Voice chat, text chat, emotes, or any social UI beyond the online mode entry point itself.
- Mobile-specific co-op UI tuning beyond what already works for Public Arena.

## Acceptance

- The new menu entry opens the co-op slime online flow.
- Two players can join the same co-op session, fight the same wave, share the same progress, and finish the encounter together.
- A player's death follows the co-op `lossCondition` recorded in story 035.
- The end-of-run result screen reflects the co-op run-summary policy recorded in story 035.
- No regression in Public Arena PvP, in local campaign, training, or dungeon.
- Live online verification by the user with two players.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [ ] | Author the co-op session config in shared content (players list, existing waves/zone/boss content, chosen `lossCondition`, run-summary policy). | Content PR. |
| T2 | [ ] | Add the co-op online mode entry in the main menu and the join flow to start the new session on the Node host. | Code PR. |
| T3 | [ ] | Make sure the Public Arena join flow and the co-op join flow share a common Socket.IO entry path with a session-config selector, without breaking the Public Arena protocol from story 036. | |
| T4 | [ ] | Run automated checks and request live online verification with two players completing one co-op run end-to-end. | |

## Related

- [simulation-runtime.md](../design/simulation-runtime.md)
- [session-definition.md](../design/session-definition.md)
- [main-ui-shell.md](../design/main-ui-shell.md)
- [034-extract-sim-core.md](034-extract-sim-core.md)
- [035-multi-actor-sessions.md](035-multi-actor-sessions.md)
- [036-node-arena-host.md](036-node-arena-host.md)
