# Online Session Hosting

- Status: accepted
- Created: 2026-05-01
- Updated: 2026-05-01 (story 037 prep: generalised this decision from "the Node arena host that runs Public Arena PvP" into "the Node host that runs **any** online session" — Public Arena PvP is now one of several session configurations the same host can run, alongside online co-op slime arena (story 037). The host gains: multi-room hosting (one `SimulationCore` per room, multiple rooms in the same Node process), per-session-config routing on `joinRequested` against an explicit `sessionConfigId`, and per-actor companion delivery on join (each connected client may send `selectedPetId` in its handshake, the host fans the session-level `# Companion` template tuning out per actor through the same builder used by `UiShell`). Lobby semantics — host-controlled start, host election, host transfer, lifetime "alive while ≥1 connected client" — moved into the new sibling decision [online-lobby.md](online-lobby.md); this file records only the room/core/wire/policy contract that applies once `start(session)` has fired. The existing PvP-specific rules (kill→level→form host policy, spawn-invulnerability content field, corner spawning, respawn-on-death loop) stay recorded in this file as **PvP session policy** — they apply to a Public Arena PvP room and not to a co-op room. Earlier: 2026-05-01 story 036 review alignment: aligned the spawn-invulnerability paragraph with the shipped implementation — the filter lives in `HealthDeathSystem` damage-intent intake, with the `hit`-event flash treated as accepted iframe-style feedback. Earlier review-fix note marked `pvpKillToLevelOps` pseudocode as illustrative only — concrete `state`/`CoreOp` field shapes are finalised by T4 under this contract. Earlier: 2026-05-01 story 036 replaces the provisional `public-multiplayer-arena.md` with this focused decision: the Node arena host runs Public Arena PvP through the shared simulation core ([simulation-runtime.md](simulation-runtime.md), [sim-core-interface.md](sim-core-interface.md)) instead of a compact in-process reimplementation. Durable rules from the provisional file (one stateful Node process, server authority, in-memory arena, content-driven combat, `30 Hz` snapshots, rate-limited input, shutdown reason) carry over; the wire shape moves to the shared `Snapshot`/`RuntimeEvent` plus a host event channel (Path A); the kill→level→form chain is a host pure-function policy on top of `addPlayer`/`removePlayer`/`setPlayerForm`; reconnect is intentionally closed.)

## Context

[simulation-runtime.md](simulation-runtime.md) records that one shared simulation core runs under two hosts: the browser worker (local play) and a Node arena host (online modes). Story 034 extracted the core; story 035 generalised sessions to multiple controlled actors; the host interface is now a stable contract ([sim-core-interface.md](sim-core-interface.md)).

The previous `public-multiplayer-arena.md` was the first-slice expedient delivered by story 032: a compact reimplementation of player movement, projectiles, hits, levels, deaths, and boss transforms inside `server/src/arenaSimulation.ts`, plus a PvP-specific wire shape (`PublicArenaSnapshot`/`PublicArenaPresentationEvent`). It was always provisional; story 036 retires it.

This file records the focused contract for the **Node arena host**: how the shared core is hosted in a Node process, how Socket.IO sockets are bound to actors, what crosses the wire, and which rules stay host-side rather than engine-side. It deliberately does not re-document the durable shared rules already covered elsewhere — content authority, arena coordinates, weapon archetypes, snapshot/runtime-event shapes — and links to them instead.

## Decision

### Package and deployment

- The Node arena host lives in the existing `server/` package at repo root: own `package.json`, TypeScript config, source files, tests, and lockfile, deployed as a stateful Node process separately from the static web build.
- The host source is `server/src/arena-host/**`. The previous `server/src/arenaSimulation.ts` is removed by story 036.
- Imports follow the boundary recorded in [web-stack.md](web-stack.md): `server/**` may import from `src/shared/**` (including `src/shared/sim/**`) only via the public façade returned by `createSimulationCore` and exported shared types (protocol, snapshot, content, timing, log, RNG); imports from `src/main/**` or `src/sim/**` are forbidden and are enforced by `server/src/importBoundaries.test.ts`.
- The web client connects to the host through `socket.io-client`; the host uses Socket.IO `4.x` already pinned in the server lockfile. The static web app receives the host URL at build time through a `VITE_`-prefixed environment variable; the client must not hardcode a production URL.
- The first slice runs on one stateful Node process. Multi-process scaling, Redis adapters, sticky sessions, queues, and database-backed arena state are out of scope. Serverless/stateless hosting is not valid for this runtime because session state lives in process memory.

### Multi-room hosting (story 037)

- The Node host owns a **room registry** keyed by an opaque `roomId`. Each room has exactly one `SimulationCore` (constructed with `createSimulationCore` per [sim-core-interface.md](sim-core-interface.md)) and exactly one current room state: `lobby` (waiting for the host player to start, see [online-lobby.md](online-lobby.md)) or `running` (`core.start(session)` has fired). One Node process holds many rooms simultaneously, and rooms run independently — sockets bound to room A do not see snapshots, events, or wire envelopes from room B.
- Each room is created against a specific `sessionConfigId` from shared content (`content/sessions/<sessionConfigId>.md`). The host loads the session config once per room creation, builds the `SessionDefinition` through the same builder used by `UiShell` (`src/shared/content/buildSession.ts`), and then either runs the lobby phase (per [online-lobby.md](online-lobby.md)) or moves directly into `running` for sessions that have no lobby phase. The `sessionConfigId` is also the room-shopping key clients use on connect — see "Per-session-config routing" below.
- Single-process scope: every room shares the same Node process (and therefore the same `setInterval` budget, the same memory pool, and the same `Date.now()`/`performance.now()` clock source). The host shell allocates one `setInterval(SIM_STEP_MS)` timer **per running room** (each room owns its own pump cadence) and avoids one shared 30Hz timer that fans out across all cores — the catch-up loop is per-core and a slow room must not stall faster ones. A pure-function room manager keeps `roomId → { state, sessionConfigId, core, hostActorId, sockets, timer? }` and is testable without a live `setInterval`.
- Room lifetime is owned by [online-lobby.md](online-lobby.md): a room is created when the first connecting client requests its `sessionConfigId` and no existing room is available, and it is destroyed when the last connected socket leaves. Host-state failure paths (timer crash, core throwing during `pump`) tear the room down and emit a `host:roomClosed` host event with a reason.
- The cap from [online-lobby.md](online-lobby.md) limits players per room. The Node process itself has a separate global cap — total connected sockets across all rooms — carried over from `server/src/config.ts`. The host rejects new connections with `joinRejected` once either cap fires.

### Per-session-config routing on join

- The Socket.IO connection handshake gains a required field `requestedSessionId: string` carried in the existing join intent payload. Valid values are exactly the `presetId`s that have `# Session.online === true` (or equivalent gate added by [content-authoring.md](content-authoring.md)) in `content/sessions/<presetId>.md`. The Public Arena PvP session (`presetId: 'public-arena'`) is one such value; co-op session content authored by story 037 is another.
- On accepting a join, the host:
  1. Validates `requestedSessionId` against the set of online-eligible session ids; an unknown id is `joinRejected` with reason `'unknownSession'`.
  2. Selects an existing room with the same `sessionConfigId` that still has an open lobby slot (lobby state, capacity not full). If multiple match, the host picks deterministically (oldest room first by creation `simTime`).
  3. If no matching room exists, creates a fresh room for `requestedSessionId` and assigns the joining socket as the lobby host (see [online-lobby.md](online-lobby.md)).
  4. Returns `joinAccepted` carrying `roomId`, `sessionConfigId`, the assigned `actorId`, the cached arena bounds (from the loaded session config), the room's `maxPlayers`/`lateJoinAllowed`, the current room state (`lobby` / `running`), and the cached tick/snapshot rates.
- Already-running rooms accept new joins only if `lateJoinAllowed: true` in their session content (see [online-lobby.md](online-lobby.md)); otherwise the host emits `joinRejected` with reason `'sessionInProgress'`. The same reason fires when the matched room's `maxPlayers` cap is full.
- Per-session protocol versions are unified: all online sessions share a single `ARENA_HOST_PROTOCOL_VERSION` (from story 036's planned T5 rename). A version bump is a session-content-agnostic protocol change and applies to every session config the host serves.

### Companion delivery on join (story 037)

- The same join intent payload carries `selectedPetId: string | null` (the value comes from each client's main-thread `ClientProgression.selectedPetId`, [main-ui-shell.md](main-ui-shell.md)). `null` means "this player has no companion this session" even if the session content enables companions.
- On `addPlayer` for the joining actor, the host builds the actor's `PlayerConfig.companion` ([session-definition.md](session-definition.md), [companion-combat.md](companion-combat.md)) by combining the session-level `# Companion` template tuning (loaded from `content/sessions/<sessionConfigId>.md` at room creation) with the actor's `selectedPetId`. If the session content has no `# Companion` table or has it disabled, every actor in that room gets `companion: null` regardless of what `selectedPetId` they sent. If the session content enables companions and the joining actor sent `selectedPetId: null`, that actor gets `companion: null` while other actors with a selected pet get a configured companion.
- The host validates `selectedPetId` against the shared `petArchetypeRegistry` (same content lookup the main thread uses); unknown id is treated as `null` with a warning through the shared log module ([logging.md](logging.md)) — the actor still joins with no companion. The host does **not** read or sync client-side pet ownership progress: it trusts the connected client's `selectedPetId` field as a presentation choice and does nothing else with it. Anti-cheat for "did this client actually own this pet" is intentionally out of scope (per the existing "no auth, no leaderboard, no anti-cheat" stance from story 028).
- Form changes via `setPlayerForm` for PvP-style sessions (see "PvP session policy" below) do not touch the actor's companion. PvP sessions typically run with `companion: null` for every actor — but if a future PvP session enables companions, the existing `setPlayerForm` contract still leaves the companion as-is.

### Lifecycle: core, sockets, actors (per room)

- Each room creates one `SimulationCore` on first need, per [sim-core-interface.md](sim-core-interface.md). The core's lifetime equals the room's lifetime — destroyed when the room is destroyed (last socket leaves, see [online-lobby.md](online-lobby.md)).
- The room calls `core.start(session)` once at the moment the lobby host triggers start (for sessions with a lobby phase) or immediately after the room's first socket joins (for sessions whose `# Session` has no lobby phase, e.g. Public Arena PvP — see "PvP session policy" below). The session passed to `start` is built once per room from `content/sessions/<sessionConfigId>.md` through `src/shared/content/buildSession.ts`. Restarts of the same session within the same room (a planned `stop()` followed by `start(session)` for a content reload) reset the entity store, exporter, RNG and pending dynamic-roster operations exactly as a fresh room would.
- On each accepted Socket.IO connection bound to a room, the host derives a stable `actorId` from the `socket.id` string. If the room is in `running` state with `dynamicRoster: true` and `lateJoinAllowed: true`, the host calls `core.addPlayer(playerConfig)` with a `PlayerConfig` shaped from the session config plus the per-socket join data (corner spawn position derived from `session.arena`, the level-1 loadout for PvP sessions or the authored loadout for co-op sessions, and the per-actor `companion` config built per "Companion delivery on join" above). For PvP sessions, the opt `addPlayer.opts.invulnerableUntilSimMs = simTimeMs + spawnInvulnerabilityMs` seeds spawn protection from PvP content (see "Spawn invulnerability" below). For co-op sessions with `playerCoopRevive`, spawn invulnerability is content-tunable per session and may be `0`.
- On each socket disconnect (clean or unclean), the host calls `core.removePlayer(actorId)` for the disconnected socket's room. The dynamic-roster contract guarantees the removal is buffered to the next tick boundary; in the meantime the actor's input state is frozen until the buffered removal applies. In-flight projectiles **and** the actor's companion entity (per [sim-core-interface.md](sim-core-interface.md), updated in 037) disappear silently with the removal.
- Identity is socket-local within a room. There are no accounts, names, profiles, moderation records, or persistent progress. `actorId` lives only for the current socket lifetime; a reconnect from the same client is a fresh actor in whichever room it joins next.

### Wall-clock pump (per room)

- Each running room owns its own wall-clock pump. The host runs one `setInterval(..., SIM_STEP_MS)` per room and calls `core.pump(performance.now())` for that room ([simulation-timing.md](simulation-timing.md), [sim-core-interface.md](sim-core-interface.md)). The first call after `start(session)` establishes the baseline for that room and does not advance ticks; subsequent calls drive the catch-up loop.
- One timer per room (rather than one shared timer fanning out to every core) keeps the per-room catch-up loop honest: a single slow room cannot stall the others. The Node process pays for `N` `setInterval` callbacks where `N` is the number of currently running rooms — acceptable in the host's single-process scope, since `N` is also bounded by the global socket cap.
- The previous host kept two intervals (a tick interval and a snapshot interval). With the shared core both cadences are internal to `SimulationClock`/`SnapshotExportSystem`; per-room pumping uses one timer per room.

### Input intake

- The Socket.IO event for input intent stays `publicArena:input` (renamed at the protocol-rename step in story 036; the event name on the wire is recorded with the protocol types). Each intent is shaped as a shared `InputCommand` ([input-commands.md](input-commands.md)).
- On each accepted intent the host calls `core.submitInput(actorId, command)` directly; the worker convention of "tag every message with `players[0].id`" recorded in [input-commands.md](input-commands.md) is browser-specific and does not apply here.
- The host applies a per-socket rate limit before forwarding into the core: up to `240` intents per socket per `1000 ms` server-time window, the same numbers carried over from the previous decision. Excess intents are dropped, not queued, and do not disconnect the socket.

### Wire envelope and Path A

- The wire snapshot is the shared `Snapshot` defined in [snapshot-shape.md](snapshot-shape.md). The host fans out the same authoritative `Snapshot` to every connected socket. Per-socket interest filtering remains absent (story 033 cleanup carries over). Renaming aside, snapshots already carry only changing arena state — immutable session config (arena bounds, recipient `actorId`, cap, population, tick/snapshot rates) lives in the join handshake and is cached on the client for the lifetime of the connection.
- The wire event union is a single discriminated union with two namespaces of `kind` values: shared engine events (every `RuntimeEvent.kind` from [snapshot-shape.md](snapshot-shape.md): `fire`, `hit`, `explosion`, `death`, `playerSpawn`, …) and host-emitted PvP events under a `host:*` prefix. Story 036 ships exactly one host event: `host:levelUp`. The single union preserves ordering between engine and host facts (the host emits its `host:levelUp` event in the same drain loop as the engine's `death`, before the next snapshot is published) and avoids the "two parallel queues" failure mode where the client has to merge by simTime. Adding a future host kind (for example `host:formChange` if a non-kill form change appears) extends this union here.
- `host:levelUp` payload: `{ kind: 'host:levelUp', simTime: number, actorId: string, level: number, formArchetypeId: string }`. `actorId` matches `PlayerSnapshot.playerId` ([snapshot-shape.md](snapshot-shape.md)); the recipient client uses it to drive the level-up presentation flourish for its own actor.
- Story 036 deliberately does **not** add `levelUp` to shared `RuntimeEvent`. Level chains are PvP policy; the shared sim has no current consumer in any other mode. If a second consumer of form changes appears in the shared sim later, the kind moves to shared events and `host:levelUp` is retired in the same architectural step.

### Per-event delivery

- The host computes a recipient set per outgoing event before fanning it out. Shared `RuntimeEvent` kinds map as follows; host-emitted kinds follow the same pattern:

  | event `kind` | recipients |
  |---|---|
  | `fire` | the shooter (`shooterId` resolved to the owning `actorId`) |
  | `hit` | `ownerId` + `targetId`, deduplicated; only resolved to a connected actor if `ownerKind === 'player'` and the owner is a current connected actor (otherwise the owner-side delivery is skipped) |
  | `explosion` | `ownerId`; same `ownerKind === 'player'` filter as `hit` |
  | `death` | every connected socket |
  | `playerSpawn` | the affected actor only |
  | `bossPhaseChange` | every connected socket (relevant for story 037) |
  | `dropSpawn` / `dropPickup` / `dropExpire` | every connected socket (relevant for story 037) |
  | `companionBoop` / `companionDowned` / `companionRescued` | every connected socket (relevant for story 037) |
  | `sessionStart` / `sessionStop` / `pause` / `resume` / `encounterStart` / `encounterEnd` | every connected socket |
  | `host:levelUp` | the affected actor only |

- The "owner-side delivery is skipped when no connected actor matches" rule keeps the table coherent for 037: when the projectile owner is a slime (`ownerKind === 'enemy'`) or a boss spawned by encounter content (`ownerKind === 'boss'`), there is no socket on the owner side; the engine event still fires, the host fanout simply does not target a non-existent actor.
- `win` and `loss` are not produced by the Public Arena PvP session because the session uses `winCondition: 'none'` and `lossCondition: 'respawnOnDeath'`. If a future online mode (story 037) uses a session that does produce them, the host delivers them to every connected socket along with the `summary` payload.

### PvP session policy: kill → level → form

This subsection applies only to PvP rooms (`content/sessions/public-arena.md` and any future PvP session). Co-op rooms ([online-lobby.md](online-lobby.md), session content with `lossCondition: 'allPlayersDead'`) do not run this policy — they use the engine's shared rescue mechanic from [companion-combat.md](companion-combat.md) and never call `setPlayerForm` against player deaths.

- The kill-chain rule lives in `server/src/arena-host/**` as a pure function:

  ```ts
  function pvpKillToLevelOps(
    death: Extract<RuntimeEvent, { kind: 'death' }>,
    state: ReadonlyMap<actorId, { level: number; positionAtDeath: { x: number; y: number } }>,
    content: ArenaProgressionContent
  ): ReadonlyArray<CoreOp>;

  type CoreOp =
    | { kind: 'addPlayer'; playerConfig: PlayerConfig; invulnerableUntilSimMs?: number }
    | { kind: 'removePlayer'; actorId: string }
    | { kind: 'setPlayerForm'; actorId: string; formUpdate: PlayerFormUpdate; refillHp?: boolean }
    | { kind: 'emitHostEvent'; event: HostEvent };
  ```

  The function does not touch Socket.IO, the `SimulationCore`, or any I/O. It returns the operations the host shell then applies in order against the core (`addPlayer`/`removePlayer`/`setPlayerForm`) and the host event stream (`emitHostEvent`).
- The TypeScript pseudocode above is **illustrative only**: it captures the inputs/outputs and the operation menu the host shell consumes, but the concrete field set of `state` (per-actor live data the host tracks: at minimum the actor's current level and current position; possibly the next spawn corner in rotation, weapon timers, or whatever the implementation decides to thread through) and the precise discriminated-union shape of `CoreOp` and `HostEvent` are finalised by the T4 implementation under this contract. Compliance with this decision is verified against the **invariants** (purity, no I/O, deterministic for a given input, one input per `death` event, output is a finite ordered list of operations the shell can replay against the core in order), not against the literal field names in this snippet.
- The function is testable in isolation against fake `state` and `content` values. It must be deterministic for a given input. It is the natural unit of test for the level chain, separate from socket plumbing.
- **Why host-side, not in shared sim.** The project's general pattern is "rules in session config, execution in `SessionFlowSystem`/`CombatSystem`/etc." (`slimeFriendlyFire` in [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md), `winCondition`/`lossCondition` in [session-definition.md](session-definition.md)). The kill-chain deviates from this pattern by living in the host. The deviation is justified for story 036 because (a) PvP is the only consumer today; lifting a `PlayerProgressionSystem` into the shared sim before a second consumer exists would be speculative; (b) the engine primitives `addPlayer`/`removePlayer`/`setPlayerForm` are sufficient to compose the chain cleanly from the host; (c) the pure-function shape keeps the policy liftable: when a second consumer arrives (an asymmetric co-op mode, a tournament mode), the same function moves into `src/shared/sim/**` as a system reading `SessionDefinition.playerProgression` without rewriting host plumbing. The deviation is recorded so the next architect does not have to reverse-engineer it.
- **Self-kill rule.** A `death` event with `killerId === death.entityId` (a player triggering their own mine, fragment, or self-AoE) or `killerId === null` (environmental damage) is treated as a non-attributable death: no killer level-up, only the dead actor respawn flow. This is recorded explicitly so the rule does not drift across the death-event field semantics in [snapshot-shape.md](snapshot-shape.md) and the policy implementation.
- **Respawn flow.** On a player `death` event under `respawnOnDeath`, `pvpKillToLevelOps` returns:
  - `{ kind: 'addPlayer', playerConfig: <level-1 config with same actorId, fresh corner position>, invulnerableUntilSimMs: simTime + spawnInvulnerabilityMs }`
  - if `killerId` is attributable to a connected actor and the killer is not at the boss level: `{ kind: 'setPlayerForm', actorId: killerId, formUpdate: <level N+1 stats>, refillHp: true }` plus `{ kind: 'emitHostEvent', event: { kind: 'host:levelUp', simTime, actorId: killerId, level: N+1, formArchetypeId: <new>` } }`
  - if the killer is already at the boss level (kills made as boss still award `+1` to the killer, but the chain caps at boss level — the existing PvP rule): only the `host:levelUp` event with `level: bossLevel`, no `setPlayerForm`.
  - The dead actor's `removePlayer` is **not** generated here because the engine already removed the entity through `HealthDeathSystem`; respawn is the `addPlayer` reuse of the same `actorId`.

### Spawn invulnerability (per-session content field)

- The engine primitive is `addPlayer.opts.invulnerableUntilSimMs` ([sim-core-interface.md](sim-core-interface.md)). It is a single runtime field on the player entity consulted by `HealthDeathSystem` at damage-intent intake; invulnerable actors lose every incoming `DamageIntent` before HP application or hooks fire, uniformly across damage sources. The `hit` event itself still fires (visible iframe-style flash, zero damage). Not a status effect.
- The PvP value of "how many milliseconds of invulnerability after spawn" lives in shared content (the `content/sessions/public-arena.md` field `spawnInvulnerabilityMs`, default `900` matching the previous compact-sim constant). The host shell reads it once at `start(session)` and applies `simTimeMs + spawnInvulnerabilityMs` for both initial spawn and respawn through `pvpKillToLevelOps`. The host shell must not hard-code the magic number; this keeps the value tunable through content without redeploying the server.

### Corner spawning (per session, derived from `session.arena`)

- Spawn corners are derived from `session.arena` width/height at `start(session)`, not from a `PUBLIC_ARENA_WORLD_BOUNDS` constant. With content-authored arenas the constant is a hidden coupling; the host shell must compute corners from session data so changing arena dimensions in `content/sessions/public-arena.md` is sufficient to move spawn points.
- The host rotates through the four corners deterministically across sequential joins. The first slice does not need spawn balancing or squads.

### Population cap (per room and global)

- The **per-room cap** comes from session content (`maxPlayers` field per [online-lobby.md](online-lobby.md), [content-authoring.md](content-authoring.md)). At the cap, the next join request to a full room is rejected with `joinRejected` reason `'roomFull'`; the host does not call `core.addPlayer` for that connection.
- The **global cap** is the maximum total connected sockets across all rooms in this Node process; carried over from `server/src/config.ts` unchanged. At the global cap, new joins are rejected with `joinRejected` reason `'serverFull'` regardless of which room they request.
- Host, port, CORS origin, and tick/snapshot rates carry over from `server/src/config.ts` unchanged.

### Reconnect policy (closed for 036/037)

- On socket disconnect (clean or unclean), the host immediately calls `core.removePlayer(actorId)`. State is **not** retained for the disconnected `actorId`. A subsequent reconnect from the same socket is a fresh join with a new `actorId` and starts at level 1 with fresh stats, fresh position, fresh invulnerability.
- Reconnect-with-state-recovery is intentionally out of scope for 036. Adding it later requires recording an updated decision here, with at minimum: how `actorId` persists across socket disconnects, how the protocol identifies a returning actor, how state is preserved when the disconnect is unclean (network drop) versus intentional (player exit), and how the cap interacts with held-state slots. Story 036 must not introduce ad-hoc partial reconnect support that ships before a decision lands.

### Shutdown contract

- Before an intentional shutdown through `arenaServer.close()`, every connected socket receives `publicArena:closeReason` with `reason: 'serverShutdown'` and a short message. Unplanned socket loss may still surface as `serverError` on the client. These mirror the previous host's behavior.
- On shutdown, the host drives the core to idle through `core.stop()` after closing connections, so any pending dynamic-roster operations are dropped per [sim-core-interface.md](sim-core-interface.md).

### Tests and verification

- The host must be testable without opening real sockets:
  - `pvpKillToLevelOps` exercised against synthetic `death` events and synthetic content;
  - host shell exercised against an in-memory `SimulationCore` (or a fake) without a real Socket.IO server, covering corner spawning, addPlayer/removePlayer lifecycle, recipient-set computation per the delivery table, and rate limit;
  - corner cases: self-kill produces no level-up; kill at boss level emits `host:levelUp` only with no `setPlayerForm`; respawn invulnerability seeds correctly; spawn corners derive from `session.arena` rather than constants.
- Socket.IO integration tests are allowed for the join handshake and protocol-version path, but most gameplay tests should call pure host functions or the shell directly.
- Live online verification with at least two connected players reproducing the story 032 demo (join, fire, kill, level up, become boss, fight boss) remains a required delivery step.

## Consequences

- The Public Arena runs on the same simulation rules as local play: every weapon, projectile, explosion, status effect, field effect, and modifier authored in `content/**` is in scope online without a parallel implementation. Effects that the compact sim previously stubbed (fragments, statuses, fields, modifiers) play correctly online because the engine evaluates them.
- The compact `server/src/arenaSimulation.ts` is removed in the same story; the host source is `server/src/arena-host/**` and is intentionally thin. New online behavior is added either in the host policy module, in shared content, or as a shared engine extension recorded in its own decision — never as a parallel re-implementation in the host.
- The wire shape becomes the shared `Snapshot`/`RuntimeEvent` plus `host:*` events. Story 037 adds online co-op without engine work because the wire already carries enemies, drops, encounters, zone, and boss state. Story 038 runs the shared `MovementSystem` on the client for self-prediction against the same snapshots the server sends.
- The `PUBLIC_ARENA_PROTOCOL_VERSION` rename to `ARENA_HOST_PROTOCOL_VERSION` is a one-time rename: after Path A this is the host protocol for any session content the host runs, not a Public-Arena-specific version. Future bumps follow normal additive rules.
- The kill→level→form chain stays liftable to the shared sim. Until a second consumer demands it, the policy lives in the host as a pure function and is tested in isolation.
- Reconnect-with-state-recovery, persistent identity, multi-process scaling, and database-backed state stay out of scope. Adding any of them requires updating this decision.

## Related

- [simulation-runtime.md](simulation-runtime.md)
- [sim-core-interface.md](sim-core-interface.md)
- [session-definition.md](session-definition.md)
- [online-lobby.md](online-lobby.md)
- [companion-combat.md](companion-combat.md)
- [snapshot-shape.md](snapshot-shape.md)
- [runtime-systems.md](runtime-systems.md)
- [simulation-timing.md](simulation-timing.md)
- [input-commands.md](input-commands.md)
- [web-stack.md](web-stack.md)
- [content-boundaries.md](content-boundaries.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [camera-and-visible-area.md](camera-and-visible-area.md)
- [main-ui-shell.md](main-ui-shell.md)
- [content-archetypes.md](content-archetypes.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [health-and-death.md](health-and-death.md)
- [boss-encounter.md](boss-encounter.md)
- [sprite-assets.md](sprite-assets.md)
- [mobile-web-support.md](mobile-web-support.md)
- [testing.md](testing.md)
- [../stories/032-public-slime-arena.md](../stories/032-public-slime-arena.md)
- [../stories/033-full-snapshot.md](../stories/033-full-snapshot.md)
- [../stories/034-extract-sim-core.md](../stories/034-extract-sim-core.md)
- [../stories/035-multi-actor-sessions.md](../stories/035-multi-actor-sessions.md)
- [../stories/036-node-arena-host.md](../stories/036-node-arena-host.md)
- [../stories/037-coop-vs-slimes.md](../stories/037-coop-vs-slimes.md)
- [../stories/038-online-client-prediction.md](../stories/038-online-client-prediction.md)
