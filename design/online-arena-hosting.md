# Online Arena Hosting

- Status: accepted
- Created: 2026-05-01
- Updated: 2026-05-01 (story 036 replaces the provisional `public-multiplayer-arena.md` with this focused decision: the Node arena host runs Public Arena PvP through the shared simulation core ([simulation-runtime.md](simulation-runtime.md), [sim-core-interface.md](sim-core-interface.md)) instead of a compact in-process reimplementation. Durable rules from the provisional file (one stateful Node process, server authority, in-memory arena, content-driven combat, `30 Hz` snapshots, rate-limited input, shutdown reason) carry over; the wire shape moves to the shared `Snapshot`/`RuntimeEvent` plus a host event channel (Path A); the kill→level→form chain is a host pure-function policy on top of `addPlayer`/`removePlayer`/`setPlayerForm`; reconnect is intentionally closed.)

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
- The first slice runs on one stateful Node process. Multi-process scaling, Redis adapters, sticky sessions, queues, and database-backed arena state are out of scope. Serverless/stateless hosting is not valid for this runtime because arena state lives in process memory.

### Lifecycle: core, sockets, actors

- The host creates `SimulationCore` once at process start, before accepting Socket.IO connections, and reuses it across the lifetime of the arena, per [sim-core-interface.md](sim-core-interface.md).
- The host calls `core.start(session)` once at boot with the Public Arena PvP session loaded from shared content. The session has `dynamicRoster: true`, `players: []`, `lossCondition: { kind: 'respawnOnDeath' }`, and `winCondition: { kind: 'none' }`; see [session-definition.md](session-definition.md). Restarts (a planned `stop()` followed by `start(session)` for a tuning change or a content reload) reset the entity store, exporter, RNG and pending dynamic-roster operations exactly as a fresh process would.
- On each accepted Socket.IO connection, the host derives a stable `actorId` from the `socket.id` string and calls `core.addPlayer(playerConfig)` with a fresh `PlayerConfig` carrying that `actorId`, the level-1 stats from PvP content, the corner spawn position, and the level-1 loadout. The opt `addPlayer.opts.invulnerableUntilSimMs = simTimeMs + spawnInvulnerabilityMs` seeds spawn protection from PvP content (see "Spawn invulnerability" below).
- On each socket disconnect (clean or unclean), the host calls `core.removePlayer(actorId)` immediately. The dynamic-roster contract guarantees the removal is buffered to the next tick boundary; in the meantime the actor's input state is frozen until the buffered removal applies. In-flight projectiles owned by the actor disappear silently with the removal, as recorded in [sim-core-interface.md](sim-core-interface.md).
- Identity is socket-local. There are no accounts, names, profiles, moderation records, or persistent arena progress. `actorId` lives only for the current socket lifetime.

### Wall-clock pump

- The host owns the wall clock. It calls `core.pump(performance.now())` from a single `setInterval(..., SIM_STEP_MS)` loop ([simulation-timing.md](simulation-timing.md), [sim-core-interface.md](sim-core-interface.md)). The first call after `start(session)` establishes the baseline and does not advance ticks; subsequent calls drive the catch-up loop.
- The previous host kept two intervals (a tick interval and a snapshot interval). With the shared core both cadences are internal to `SimulationClock`/`SnapshotExportSystem`; the host runs one timer.

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

### Kill → level → form: pure-function host policy

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
- The function is testable in isolation against fake `state` and `content` values. It must be deterministic for a given input. It is the natural unit of test for the level chain, separate from socket plumbing.
- **Why host-side, not in shared sim.** The project's general pattern is "rules in session config, execution in `SessionFlowSystem`/`CombatSystem`/etc." (`slimeFriendlyFire` in [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md), `winCondition`/`lossCondition` in [session-definition.md](session-definition.md)). The kill-chain deviates from this pattern by living in the host. The deviation is justified for story 036 because (a) PvP is the only consumer today; lifting a `PlayerProgressionSystem` into the shared sim before a second consumer exists would be speculative; (b) the engine primitives `addPlayer`/`removePlayer`/`setPlayerForm` are sufficient to compose the chain cleanly from the host; (c) the pure-function shape keeps the policy liftable: when a second consumer arrives (an asymmetric co-op mode, a tournament mode), the same function moves into `src/shared/sim/**` as a system reading `SessionDefinition.playerProgression` without rewriting host plumbing. The deviation is recorded so the next architect does not have to reverse-engineer it.
- **Self-kill rule.** A `death` event with `killerId === death.entityId` (a player triggering their own mine, fragment, or self-AoE) or `killerId === null` (environmental damage) is treated as a non-attributable death: no killer level-up, only the dead actor respawn flow. This is recorded explicitly so the rule does not drift across the death-event field semantics in [snapshot-shape.md](snapshot-shape.md) and the policy implementation.
- **Respawn flow.** On a player `death` event under `respawnOnDeath`, `pvpKillToLevelOps` returns:
  - `{ kind: 'addPlayer', playerConfig: <level-1 config with same actorId, fresh corner position>, invulnerableUntilSimMs: simTime + spawnInvulnerabilityMs }`
  - if `killerId` is attributable to a connected actor and the killer is not at the boss level: `{ kind: 'setPlayerForm', actorId: killerId, formUpdate: <level N+1 stats>, refillHp: true }` plus `{ kind: 'emitHostEvent', event: { kind: 'host:levelUp', simTime, actorId: killerId, level: N+1, formArchetypeId: <new>` } }`
  - if the killer is already at the boss level (kills made as boss still award `+1` to the killer, but the chain caps at boss level — the existing PvP rule): only the `host:levelUp` event with `level: bossLevel`, no `setPlayerForm`.
  - The dead actor's `removePlayer` is **not** generated here because the engine already removed the entity through `HealthDeathSystem`; respawn is the `addPlayer` reuse of the same `actorId`.

### Spawn invulnerability

- The engine primitive is `addPlayer.opts.invulnerableUntilSimMs` ([sim-core-interface.md](sim-core-interface.md)). It is a single runtime field on the player entity consulted by `HealthDeathSystem` at damage-intent intake, not a status effect.
- The PvP value of "how many milliseconds of invulnerability after spawn" lives in shared content (the `content/sessions/public-arena.md` field `spawnInvulnerabilityMs`, default `900` matching the previous compact-sim constant). The host shell reads it once at `start(session)` and applies `simTimeMs + spawnInvulnerabilityMs` for both initial spawn and respawn through `pvpKillToLevelOps`. The host shell must not hard-code the magic number; this keeps the value tunable through content without redeploying the server.

### Corner spawning

- Spawn corners are derived from `session.arena` width/height at `start(session)`, not from a `PUBLIC_ARENA_WORLD_BOUNDS` constant. With content-authored arenas the constant is a hidden coupling; the host shell must compute corners from session data so changing arena dimensions in `content/sessions/public-arena.md` is sufficient to move spawn points.
- The host rotates through the four corners deterministically across sequential joins. The first slice does not need spawn balancing or squads.

### Population cap

- The host enforces a configured cap on connected actors. At the cap, the next `addPlayer` is preceded by a join-rejected message; the core never sees the `addPlayer` call. The cap, host, port, CORS origin, and tick/snapshot rates carry over from `server/src/config.ts` unchanged.

### Reconnect policy (closed for 036)

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
