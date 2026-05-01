# Online Lobby

- Status: accepted
- Created: 2026-05-01
- Updated: 2026-05-01

## Context

[online-session-hosting.md](online-session-hosting.md) records the generic Node host that runs any online session through the shared simulation core ([sim-core-interface.md](sim-core-interface.md)). It deliberately defers a key piece of the user experience: how a group of players ends up in the same room, who decides when the run starts, and how that decision is wired across the network.

Public Arena PvP (story 036) does not have a lobby phase — players join an open arena and play immediately, the host calls `core.start(session)` once at process start, and there is no pre-run hand-off between clients. Online co-op (story 037) needs a lobby because the run is a campaign-shape session: players want to assemble a party, the campaign starts when the party is ready, and "ready" is a player-facing decision (the human leader presses "Start"), not a function of population size or timer.

This file defines the Online Lobby contract: the room state machine, host election, host transfer, the wire envelope between client and host for lobby control, the lifecycle "alive while ≥1 client connected", and the interaction with [online-session-hosting.md](online-session-hosting.md) for late-join and per-session-config routing.

## Decision

### Two ways an online session begins

A session running under the Node host begins in one of two shapes, chosen by session content:

- **No lobby (instant-running):** authored sessions whose `# Session` has `lobby.kind: 'none'` (or omits the lobby block). The room moves directly into `running` on the first connecting socket; `core.start(session)` fires immediately. This matches the Public Arena PvP shape (story 036) — no waiting room, no host player, no Start button.
- **Host-controlled lobby:** authored sessions whose `# Session` has `lobby.kind: 'hostControlled'`. The room enters `lobby` on the first connecting socket, accumulates joiners up to `maxPlayers`, and transitions to `running` only when the current lobby host triggers a `lobby:start` action. This is the shape used by online co-op (story 037).

The two shapes share the same room registry, the same `SimulationCore` lifecycle, the same wire protocol for input/snapshot/event traffic, and the same per-event delivery table from [online-session-hosting.md](online-session-hosting.md). They differ only in when `core.start(session)` fires and in the lobby-specific control protocol below.

### Room state machine (host-controlled lobby)

A host-controlled-lobby room moves through these states:

```
[ open ] --(host fires lobby:start)--> [ running ] --(last socket leaves)--> [ closed ]
   |                                       |
   |--(last socket leaves)--> [ closed ]   |--(last socket leaves)--> [ closed ]
```

- **`open`**: the room is accepting joins up to `maxPlayers`, no `core.start(session)` has fired, no simulation pump is running. The lobby holds N joined sockets where `1 ≤ N ≤ maxPlayers`. Exactly one of those sockets is the current **lobby host** (see "Host election" below). Late-join is always allowed in `open` regardless of `lateJoinAllowed`; the latter governs `running`.
- **`running`**: `core.start(session)` has fired with `players: [<all-currently-joined-actors>]` (or with `players: []` for sessions that mix `dynamicRoster: true` + lobby; see "Roster handover" below). The room runs the standard pump per [online-session-hosting.md](online-session-hosting.md). Late-join in `running` is governed by `session.lateJoinAllowed`.
- **`closed`**: a transient state. The room has no connected sockets. The host shell tears the room down: stops the pump, calls `core.stop()`, releases the core, and removes the room from the registry. The state is observable for at most one tick boundary; in practice the registry entry is destroyed during the disconnect handler.

There is **no** `lobby → closed` direct transition that bypasses "no sockets" — a room cannot be canceled by a player action while sockets remain connected. The host who wants to "close the lobby" leaves the room (which transfers host to the next-eligible socket if any sockets remain, or destroys the room).

Likewise, `running → open` is forbidden: the room does not return to lobby after a session ends. When `win`/`loss` fires, the room stays in `running`; sockets see the result, and the room destroys itself once the last socket leaves. If a player wants to "play again", they reconnect, which may create a fresh lobby room for the same `sessionConfigId`.

### Lifecycle — "alive while ≥1 connected client"

- A room is created on demand: when a Socket.IO connection requests `sessionConfigId: <X>` and no existing room with that id is available (in `open` state for host-controlled-lobby sessions, or `running` with capacity for instant-running sessions), the host creates a new room.
- A room is destroyed exactly when its last socket disconnects. There is no idle-timeout — empty rooms cannot exist. There is no manual "close room" admin action; sockets leaving is the only sanctioned termination path.
- A room created in `open` and emptied before any `lobby:start` is destroyed without ever entering `running`. The `SimulationCore` is created lazily — for sessions in `open`, `core.start(session)` has not fired and the core may be uninstantiated until the start trigger. The implementer chooses between "construct core on room creation" and "construct core on `lobby:start`"; both satisfy the contract.

### Host election

- The lobby host is the connected socket that controls `lobby:start` and `lobby:transferHost`.
- On room creation (first joiner), that socket becomes the host immediately.
- When the current host disconnects (clean or unclean), the system **automatically** chooses the next host from the remaining connected sockets. The choice is deterministic: pick the socket with the **earliest connection simTime** to this room; ties are broken by `actorId` ascending lexicographic order (matching the existing tie-break rule from [runtime-systems.md](runtime-systems.md)). The new host is announced via `lobby:hostChanged` (see wire protocol below).
- A non-host socket **cannot** seize the host role. There is no `lobby:claimHost` command; client UI must not offer such an action. The only way for a non-host to become host is either:
  - the current host explicitly transfers via `lobby:transferHost`, or
  - the current host disconnects and the system auto-elects.
- The host role is per-room, not per-process. Different rooms have different hosts.
- The host role is presentation-only at the engine level — the engine does not see "host" as a concept. `SessionDefinition` and the simulation core are unaware of which actor is the host. The host role lives entirely in the host shell's room manager.

### Wire protocol: lobby control envelope

Lobby control messages live in the same Socket.IO event channel as other host-emitted events under the existing `host:*` namespace established by [online-session-hosting.md](online-session-hosting.md). Messages are typed under a `host:lobby:` sub-namespace to make routing explicit:

- `host:lobby:state` — periodic and on-change broadcast to all sockets in the room. Carries:
  - `roomId: string`
  - `sessionConfigId: string`
  - `state: 'open' | 'running'`
  - `joined: ReadonlyArray<{ actorId: string; petArchetypeId: string | null }>` (in stable join order)
  - `hostActorId: string`
  - `maxPlayers: number`
  - `lateJoinAllowed: boolean`
- `host:lobby:hostChanged` — fires when the host actor changes (transfer or auto-election). Carries `roomId`, `previousHostActorId | null`, `newHostActorId`.
- `host:lobby:start` — fires when the host has triggered the run start. Sent from the host server to **all** sockets after the room transitions `open → running`. Carries `roomId` and the timestamp of `core.start(session)`.

Client-to-host commands live in the existing input channel under a separate `lobby:*` kind on the wire:

- `lobby:start` — only valid from the current host actor, only valid in `open`. Triggers `core.start(session)`. The host shell validates "is this socket the current host?" and rejects with a warning if not. Issuing `lobby:start` after the room is already `running` is a no-op (idempotent ignore with warning).
- `lobby:transferHost` — only valid from the current host actor. Carries `targetActorId: string` (must be a currently connected actor in this room). Validates and applies the transfer; emits `host:lobby:hostChanged`. Self-transfer is a no-op (warning).

There is no `lobby:cancel`, no `lobby:kick`, no `lobby:lock` (the lobby is implicitly locked once all `maxPlayers` slots are filled — late connections see `joinRejected: 'roomFull'`). The first slice deliberately ships the minimum viable host UX: Start, Transfer, Leave.

### Roster handover at `lobby:start`

Two roster shapes are valid for host-controlled-lobby sessions, chosen by session content:

- **`dynamicRoster: false` (closed roster)**: at `lobby:start`, the host shell builds `SessionDefinition.players[]` from the currently joined sockets — one `PlayerConfig` per socket, ordered by join-order. `core.start(session)` fires with the full roster; subsequent late-join attempts are rejected because the engine does not accept `addPlayer` under `dynamicRoster: false`.
- **`dynamicRoster: true` (open roster, late-join allowed)**: at `lobby:start`, the host shell either passes the currently joined sockets as `players[]` (closed-at-start, late-join after) or passes `players: []` and follows up with `core.addPlayer` for each connected socket on the next tick (open-at-start). The implementer chooses; the contract is that every connected socket has an `addPlayer` realised by the time the second tick begins. After `running`, late-join sockets follow the standard `core.addPlayer` path from [online-session-hosting.md](online-session-hosting.md) gated by `lateJoinAllowed`.

The roster handover happens once per room (one `core.start(session)` per room lifetime). The companion delivery rule from [online-session-hosting.md](online-session-hosting.md) applies to every actor passed into `start` or added via `addPlayer`: the host fans the session-level `# Companion` template tuning out per actor combined with each actor's `selectedPetId` from join handshake.

### Disconnect during lobby (`open`)

- A non-host socket disconnecting in `open` is a plain leave: the room emits `host:lobby:state` to remaining sockets and continues waiting.
- The current host disconnecting in `open` triggers auto-election (above) and emits `host:lobby:hostChanged` along with the next `host:lobby:state`.
- The last socket disconnecting destroys the room (regardless of whether it was the host).
- Fresh joins to the now-emptied `sessionConfigId` create a new room (with a new `roomId`). Disconnected players cannot rejoin "the same lobby" — the room they came from is gone.

### Disconnect during run (`running`)

- A non-host socket disconnect during `running` follows [online-session-hosting.md](online-session-hosting.md) — `core.removePlayer(actorId)` immediately.
- The current host disconnecting during `running` is no longer a meaningful event for control flow (the run is already started, no `lobby:start` decisions remain). The system still re-elects a new host so that future control-plane decisions (none in 037; reserved for future stories) target a real socket. The `host:lobby:hostChanged` event fires.
- The last socket disconnecting tears the room down, calls `core.stop()`, and destroys the room.

### Validation and error handling

- A `lobby:start` from a non-host socket: ignored with warning through the shared log module ([logging.md](logging.md)); no state change.
- A `lobby:transferHost` with `targetActorId` not in the current roster: ignored with warning.
- A `lobby:start` against a room already in `running`: idempotent ignore with warning.
- A late-join request to a `running` room with `lateJoinAllowed: false`: `joinRejected: 'sessionInProgress'` per [online-session-hosting.md](online-session-hosting.md).
- A join request whose `requestedSessionId` resolves to session content with `lobby.kind: 'hostControlled'` while the only available room is in `running`: the host either creates a fresh `open` room (if global cap and process allows) or returns `joinRejected: 'sessionInProgress'`. The implementer chooses the more user-friendly path; the contract is that the same `sessionConfigId` may have multiple concurrent rooms.

### What lives in this file vs `online-session-hosting.md`

- This file (`online-lobby.md`) owns: room state machine, host election/transfer/auto-election, lobby wire protocol, "alive while ≥1 client" lifetime rule, roster-handover-at-start choice. The `core.start(session)` trigger point.
- `online-session-hosting.md` owns: room registry plumbing (multi-core, multi-room), per-session-config routing on join, companion delivery on join, the `running`-state input/snapshot/event protocol, wall-clock pump per room, kill→level→form policy for PvP rooms, spawn invulnerability content field, corner spawning, population caps, reconnect policy, shutdown contract.

Both files apply to every host-controlled-lobby room. Instant-running rooms (Public Arena PvP) skip this file entirely — they have no `open` state, no host actor, no `lobby:*` wire messages.

### Tests and verification

The lobby is testable without opening real sockets:

- Room state machine transitions (`open → running` on host action; `open|running → closed` on last-leave; no other transitions reachable).
- Host election determinism: with synthetic socket-join times and `actorId` strings, the elected host on the current host's disconnect matches the spec for ties.
- Wire protocol: `lobby:start` from non-host is rejected; `lobby:transferHost` with bad `targetActorId` is rejected; `host:lobby:hostChanged` fires once per host change; `host:lobby:state` reflects current `joined`/`hostActorId`.
- Roster handover: at `lobby:start`, the constructed `players[]` matches the joined sockets in deterministic order; `companion` field is built per session content + each actor's `selectedPetId`.
- Lifecycle: empty rooms cannot exist; the registry contains exactly the rooms with at least one connected socket.

Live online verification with at least 2 clients walking through join → wait → host triggers start → run together → disconnect → room destroyed, is part of the closing checklist of the story that introduces this file (story 037).

## Consequences

- The Node host runs both PvP-style instant-running sessions and co-op-style lobby sessions in one process and one codebase, with shared room registry, shared wire protocol, and shared input/snapshot/event paths. PvP is recoverable as the special case "instant-running, single room of `sessionConfigId: 'public-arena'`".
- A new product mode is now an authoring task ([content-authoring.md](content-authoring.md)) plus optionally a `lobby` subsection in `# Session`, with no host shell change and no engine change. Adding a third or fourth online mode (a tournament shape, an asymmetric co-op shape, etc.) follows the same path.
- Reconnect-with-state-recovery and persistent identity stay out of scope, same as in [online-session-hosting.md](online-session-hosting.md). A reconnecting client lands in whatever room currently matches its `sessionConfigId` (or a fresh one if none open) and starts as a fresh actor.
- The "no host claim" rule (host can be transferred but not seized) keeps the lobby control surface small and avoids race-condition UI ("two players claimed host at the same time"). Auto-election on host disconnect is the only exception, and it is fully deterministic.
- A future "kick player" or "lock lobby" feature requires extending this file. Until then, the only way out of a lobby is `Leave` on the client side, and lobbies stay open while at least one player remains.

## Related

- [online-session-hosting.md](online-session-hosting.md)
- [session-definition.md](session-definition.md)
- [sim-core-interface.md](sim-core-interface.md)
- [companion-combat.md](companion-combat.md)
- [snapshot-shape.md](snapshot-shape.md)
- [main-ui-shell.md](main-ui-shell.md)
- [content-authoring.md](content-authoring.md)
- [logging.md](logging.md)
- [testing.md](testing.md)
- [../stories/036-node-arena-host.md](../stories/036-node-arena-host.md)
- [../stories/037-coop-vs-slimes.md](../stories/037-coop-vs-slimes.md)
