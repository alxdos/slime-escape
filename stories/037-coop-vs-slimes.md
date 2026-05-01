# Co-Op Vs Slimes

- Status: in-progress
- Created: 2026-04-30
- Updated: 2026-05-01 (architect prep T1 landed: split companion config from session-level into `PlayerConfig.companion` (per-player); implemented `lossCondition: 'allPlayersDead'` semantics with player ghost-state path; introduced `playerCoopRevive` for symmetric player-rescue; added `SessionRules.playerVsPlayerDamage`; renamed `online-arena-hosting.md` → `online-session-hosting.md` and expanded for multi-room hosting and companion delivery on join; created new `online-lobby.md` for host-controlled-lobby state machine, election, and wire protocol; added `onlineLobby` phase to `main-ui-shell.md` and made the online catalog data-driven; extended `content-authoring.md` for the new session-content fields. Tasks decomposed into T1 (architect, landed), T2/T3 (engine), T4 (content), T5 (host: lobby + multi-room), T6 (main UI: catalog + lobby + co-op HUD + online result), T7 (verify).)

## Product intent

Online co-op slime arena turns the shared simulation core (story 034) and Node arena host (story 036) into a generic online-session host that runs **any** content-authored session — not only Public Arena PvP. The first user-facing application of that generalisation is online co-op against authored slime waves: a small party assembles in a lobby, the lobby host triggers start, the party fights through a campaign-shape session together against authored enemy waves and a boss encounter. Death does not end the run for the party — a downed player becomes a ghost who can be rescued by another living player; the run ends in `loss` only when no live player remains, and in `win` when the campaign completes.

This story closes the architectural gap that made the previous online host PvP-specific: companions become per-player (each connected client brings their own pet from progression), the wire/HUD/result flow becomes content-driven, the host gains multi-room semantics, and a new lobby protocol handles the human-decided "everyone in, let's start" moment.

## Player-facing

- Sees: a new online catalog in the main menu listing both Public Arena and the new "Co-Op vs Slimes" entry.
- Sees: after picking the co-op entry, a lobby screen with the joined roster, the current host, and host-only controls (`Start`, `Transfer host`, `Leave`); non-host players see only `Leave`.
- Can do: as host, trigger the run start from the lobby at any time (with at least one player joined).
- Sees: the host can be transferred to another joined player; if the host disconnects, the system promotes the next player automatically.
- Sees: during the run, the same campaign-shape HUD as local play (HP, wave/encounter title, boss strip, escape progress, weapon slots) — driven entirely by the shared snapshot the host fans out.
- Can do: fight through authored enemy waves and a boss encounter together, including with companions (each player's selected pet from local progression appears as their companion in the run; companions can damage enemies, take damage, enter ghost, and be rescued by any living player).
- Sees: when a teammate falls, they become a ghost — visually distinct, no fire, no weapon, but still movable; companions of the ghost continue to guard their owner.
- Can do: revive a ghost teammate by approaching for a short channeling time (symmetric to companion rescue).
- Sees: the run ends in `loss` only when every player is a ghost simultaneously and no revive is in progress; the run ends in `win` when the boss is defeated or all encounters complete.
- Sees: an end-of-run result screen for the online run (the same Result UI used for local runs), with the aggregated co-op summary (kills, drops, defeat cause from the last actor to fall on `loss`, boss state on `win`).
- Sees: friendly fire between players is off (party cannot harm itself); slime cross-fire stays on per the campaign content.

## Technical

The story closes its architectural gap through one architectural PR (T1, landed) covering the engine, host, UI, and content-authoring contracts:

- Engine: `lossCondition: 'allPlayersDead'` is implemented in `SessionFlowSystem` ([runtime-systems.md](../design/runtime-systems.md)); player ghost state lives in `HealthDeathSystem` ([health-and-death.md](../design/health-and-death.md)) — death under this kind transitions the actor's `state` to `'ghost'` (`PlayerSnapshot.state`, [snapshot-shape.md](../design/snapshot-shape.md)) without removing the entity, fires `playerDowned` and `death`, runs death hooks once, and leaves the entity in `EntityStore`. The shared damage-helper ([projectiles-and-combat.md](../design/projectiles-and-combat.md)) gains a ghost-state filter and reads the new `SessionRules.damage.playerVsPlayerDamage` flag to gate cross-team HP-damage. Companion config moves from `SessionDefinition.companion` to `PlayerConfig.companion` ([session-definition.md](../design/session-definition.md), [companion-combat.md](../design/companion-combat.md)); `CompanionSystem` learns multi-companion sessions and owns a shared rescue-progress handler that drives both companion-rescue (`companionRescued`) and player-rescue (`playerRevived`, [snapshot-shape.md](../design/snapshot-shape.md)). Input intake gains a per-actor ghost-state filter that accepts only `move` ([input-commands.md](../design/input-commands.md)).
- Engine API: `SimulationCore.addPlayer` builds the actor's companion entity from `PlayerConfig.companion` on the same tick boundary; `removePlayer` silently removes the actor's companion alongside the actor's projectiles; `setPlayerForm` does not touch the actor's companion or transition out of ghost ([sim-core-interface.md](../design/sim-core-interface.md)).
- Host: `online-arena-hosting.md` is renamed to [online-session-hosting.md](../design/online-session-hosting.md) and expanded with multi-room hosting (one core per room, multiple rooms per process), per-session-config routing on join, per-room wall-clock pump, and per-actor companion delivery on join (`selectedPetId` from join handshake). PvP-specific rules (kill→level→form, spawn invulnerability) move under a "PvP session policy" subsection. A new sibling decision [online-lobby.md](../design/online-lobby.md) records the host-controlled-lobby state machine (`open`/`running`/`closed`), host election and transfer (no claim), wire protocol (`lobby:start`, `lobby:transferHost`, `host:lobby:hostChanged`, `host:lobby:state`), and the "alive while ≥1 connected client" lifetime.
- Result summary: [session-result-summary.md](../design/session-result-summary.md) records `defeat.cause = last to fall` for `'allPlayersDead'`. Aggregated stats remain single-shape (no per-actor split for this horizon).
- Main UI: [main-ui-shell.md](../design/main-ui-shell.md) gains the `onlineLobby` phase between `onlineConnecting` and `online`, makes the online catalog data-driven from session content (the existing hardcoded "Public Arena" entry is generalised), mounts the campaign-shape HUD layers (`Hud`/`EscapePath`/`TitleOverlay`) on top of the online combat path for co-op sessions, and wires terminal `win`/`loss` events from the online stream to the same Result UI used for local runs.
- Content authoring: [content-authoring.md](../design/content-authoring.md) gains `online`/`playerVsPlayerDamage`/`maxPlayers`/`lateJoinAllowed`/`lobbyKind` fields on `# Session` and a new `# CoopRevive` partition for the player-rescue tuning. The existing `# Companion` partition is reframed as session-level template tuning fanned out per actor.

The first co-op content slice is one session file `content/sessions/coop-slime.md` with: `online: true`, `lobbyKind: 'hostControlled'`, `maxPlayers: 4`, `lateJoinAllowed: true`, `dynamicRoster: true`, `playerVsPlayerDamage: false`, `slimeFriendlyFire: true`, `lossCondition: 'allPlayersDead'`, `winCondition: 'bossDefeated'` (or `'allEncountersComplete'`), `# CoopRevive` tuning, `# Companion` tuning, and authored enemy waves + boss encounter content drawn from existing campaign archetypes.

## Out of scope

- Per-actor stats in result summary (e.g. "your kills vs theirs"). The summary stays single-shape per [session-result-summary.md](../design/session-result-summary.md).
- Reconnect-with-state-recovery. A reconnecting client lands in a new room as a fresh actor.
- Anti-cheat verification of the joining client's `selectedPetId` against authoritative pet ownership; the host trusts the value as a presentation choice.
- Voice chat, text chat, emotes, friend invites, persistent matchmaking ratings, lobby browser UI ("see all open lobbies"), per-lobby chat, lobby kick/lock controls beyond `Start`/`Transfer`/`Leave`.
- Mobile-specific co-op UI tuning beyond what already works for Public Arena.
- A second co-op session content file (the first slice ships exactly one). Future co-op variants reuse the same engine/host/UI plumbing.
- New enemy or boss content; the co-op session uses existing authored content only.
- Client-side prediction or transport optimization (story 038).
- Multi-process scaling or Redis-backed multi-host scaling.

## Acceptance

- The new "Co-Op vs Slimes" entry appears in the online catalog in the main menu and uses the same data-driven flow as Public Arena.
- After picking the co-op entry, the player sees the lobby UI with their `actorId` shown, host status visible, and Start/Transfer/Leave controls correctly gated by host role.
- Two players can join the same lobby, the host triggers start, both players spawn into the run with their own companions (each from the joining client's `selectedPetId`), fight together, share the same wave/boss progression, and finish the encounter together.
- A player who falls becomes a ghost: visible in `entities[]` with `state: 'ghost'`, no fire/aim, can still move, no longer takes damage; their companion continues to guard them.
- Any living player can revive a ghost by approaching within `playerCoopRevive.rescueRadius` for `playerCoopRevive.rescueDurationMs`; the revived player resumes with HP set per `reviveHpFraction`, `playerRevived` event fires.
- The run ends in `loss` only when no live player remains (every actor is a ghost simultaneously); `defeat.cause` reports the cause that flipped the last live actor to ghost. `win` fires when the run's `winCondition` triggers, regardless of how many ghosts are present.
- The end-of-run Result UI displays the same shape as for local campaign runs (kills/drops/duration/boss/defeat).
- Friendly fire between players is off; slime cross-fire still resolves per the campaign content.
- No regression in: Public Arena PvP (story 036), local single-player campaign, training, dungeon, sandbox, or `/portal` flow.
- All existing automated tests pass; new tests cover the multi-companion path, the ghost-state lifecycle, the rescue handler for both companion and player targets, the `'allPlayersDead'` flow with revives, lobby state machine transitions and host election, multi-room host routing, and the data-driven online catalog.
- Live online verification by the user with at least 2 clients walking through join → lobby → start → run with at least one ghost-then-revive cycle → terminal `win` (and a separate session reaching `loss` to verify the wipe path) → result screen → both clients leave → room destroyed.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Architectural PR. Updates: [session-definition.md](../design/session-definition.md) (`'allPlayersDead'` impl semantics, `playerVsPlayerDamage`, per-`PlayerConfig` companion, `playerCoopRevive`); [snapshot-shape.md](../design/snapshot-shape.md) (`PlayerSnapshot.state`, `playerDowned`, `playerRevived`); [input-commands.md](../design/input-commands.md) (ghost input filter); [health-and-death.md](../design/health-and-death.md) (player ghost-state path); [runtime-systems.md](../design/runtime-systems.md) (`'allPlayersDead'` flow, multi-companion `CompanionSystem`, generalised rescue handler); [companion-combat.md](../design/companion-combat.md) (per-actor ownership, multi-companion, owner ghost-guarding, team damage model); [projectiles-and-combat.md](../design/projectiles-and-combat.md) (`playerVsPlayerDamage`, ghost damage filter); [session-result-summary.md](../design/session-result-summary.md) (`defeat.cause` for `'allPlayersDead'`); [sim-core-interface.md](../design/sim-core-interface.md) (per-actor companion in `addPlayer`/`removePlayer`/`setPlayerForm`); rename `online-arena-hosting.md` → [online-session-hosting.md](../design/online-session-hosting.md) and expand for multi-room, per-session-config routing, companion delivery on join; new [online-lobby.md](../design/online-lobby.md); [main-ui-shell.md](../design/main-ui-shell.md) (`onlineLobby` phase, online catalog data-driven, co-op HUD layers, online result UI); [content-authoring.md](../design/content-authoring.md) (new `# Session` fields, `# CoopRevive`, multi-companion authoring). [design/README.md](../design/README.md) index updated. | Architectural PR, no code. |
| T2 | [x] | Engine: implement multi-companion + player ghost lifecycle. Move companion state to per-actor (`PlayerConfig.companion`); update `CompanionSystem` to iterate per-actor companions; introduce `PlayerSnapshot.state` and the alive→ghost path in `HealthDeathSystem` with `playerDowned`/`death` co-emission; generalise the rescue handler to drive both companion-rescue and player-rescue; ghost-state damage filter at the shared damage-helper; ghost-state input filter at `submitInput`. Tests for multi-companion AI iteration, ghost-state lifecycle, generalised rescue, and the input filter. | Code PR, depends on T1. |
| T3 | [ ] | Engine: implement `'allPlayersDead'` flow + `playerVsPlayerDamage` + `playerCoopRevive`. Add the live-actor count check to `SessionFlowSystem`; wire `RunSummaryTracker.defeat.cause` to "last to fall" under this kind; add `SessionRules.damage.playerVsPlayerDamage` to the damage-helper team-table; surface `SessionDefinition.playerCoopRevive` to the rescue handler. Tests covering: `loss` fires only when zero live remain, revives between transitions cancel earlier candidate `defeat.cause`, mid-run revive to alive prevents `loss`, `playerVsPlayerDamage: false` blocks all cross-team HP-damage. | Code PR, depends on T2. |
| T4 | [ ] | Content: author `content/sessions/coop-slime.md` (or chosen filename) with online-session fields (`online: true`, `lobbyKind: 'hostControlled'`, `maxPlayers: 4`, `lateJoinAllowed: true`), gameplay rules (`dynamicRoster: true`, `playerVsPlayerDamage: false`, `slimeFriendlyFire: true`, `lossCondition: 'allPlayersDead'`, `winCondition` per product call), `# CoopRevive` tuning, `# Companion` tuning, and authored enemy/wave/boss content. Extend `scripts/content-build/sessions/**` for the new fields and partition. Update content drift / generated files. | Code PR, depends on T1. May land in parallel with T2/T3. |
| T5 | [ ] | Host: lobby + multi-room. Implement `server/src/online-host/**` with the room registry, per-session-config routing on `joinRequested`, the lobby state machine (`open` → `running` → `closed`) with host election, transfer, and auto-election, the `lobby:*` wire protocol, per-room `setInterval` pump, and per-actor companion delivery on join. Pure-function tests for room manager, lobby decisions, and host election; host-shell tests against in-memory cores without a live socket server. | Code PR, depends on T2/T3 (engine ops) and T4 (session content). |
| T6 | [ ] | Main UI: online catalog + lobby + co-op HUD + online result. Make the online catalog data-driven from session content; add the `onlineLobby` phase with host-only controls and roster display; mount the campaign-shape HUD layers (`Hud`/`EscapePath`/`TitleOverlay`) on top of the online combat path when snapshots carry `encounter`/`waveProgress`/`bossHud`/`zone`; wire terminal `win`/`loss` from the online stream to the existing Result UI; thread `selectedPetId` from `ClientProgression` into the join handshake. | Code PR, depends on T5 (wire protocol). |
| T7 | [ ] | Verify. Run automated checks (root + server typecheck/tests/build, content drift, sim import-boundary, server import-boundary). Request live online verification with at least 2 clients walking through join → lobby → start → co-op run → ghost-and-revive → terminal `win` and a separate session reaching `loss` → result screen → leave → room destroyed. | Depends on T6. |

## Related

- [simulation-runtime.md](../design/simulation-runtime.md)
- [sim-core-interface.md](../design/sim-core-interface.md)
- [session-definition.md](../design/session-definition.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [input-commands.md](../design/input-commands.md)
- [runtime-systems.md](../design/runtime-systems.md)
- [health-and-death.md](../design/health-and-death.md)
- [companion-combat.md](../design/companion-combat.md)
- [projectiles-and-combat.md](../design/projectiles-and-combat.md)
- [session-result-summary.md](../design/session-result-summary.md)
- [online-session-hosting.md](../design/online-session-hosting.md)
- [online-lobby.md](../design/online-lobby.md)
- [main-ui-shell.md](../design/main-ui-shell.md)
- [content-authoring.md](../design/content-authoring.md)
- [034-extract-sim-core.md](034-extract-sim-core.md)
- [035-multi-actor-sessions.md](035-multi-actor-sessions.md)
- [036-node-arena-host.md](036-node-arena-host.md)
- [038-online-client-prediction.md](038-online-client-prediction.md)
