# Public Multiplayer Arena Runtime

- Status: accepted
- Created: 2026-04-30
- Updated: 2026-04-30 (story 033 snapshot delivery cleanup: the first slice does not perform per-socket interest filtering — every connected socket receives the same authoritative arena snapshot. Authoritative snapshots carry only changing arena state; arena bounds and the recipient's player id are delivered once via `publicArena:joinAccepted` and cached on the client for the lifetime of the connection, in line with the rule from [snapshot-shape.md](snapshot-shape.md). Reintroducing interest filtering requires live measurement and an updated decision recorded here. Earlier story 032 loadout follow-up: Public Arena regular players use the full generated `portal` session loadout, and the server owns each regular player's selected weapon slot. Adding an existing weapon such as `shotgun` to `portal.md` must make it available without arena-specific weapon code. Earlier story 032 audio follow-up: online hit presentation events are delivered only to the projectile owner and hit target and carry the target form needed for configured hit audio; online death presentation events are delivered to every connected player and carry the dead form needed for configured death audio. Earlier story 032 T19 review follow-up: Public Arena regular player health/movement and regular weapon loadout come from the generated `portal` session player/loadout, while online weapon behavior, projectile presentation, and weapon fire audio are driven by existing `WeaponArchetype`/weapon mapping content rather than a rock-specific implementation. Earlier story 032 T18 follow-up: Public Arena regular progression uses the full authored enemy slime roster in content order and the server must not silently fall back for missing form entries. Story 032 T17 follow-up: public input rate limiting, shutdown close reason, and deterministic overlapping projectile target selection are recorded. Story 032 T16 follow-up: online progression ids and boss level live in shared headless config so server authority and client HUD labels use the same boss-level denominator.)

## Context

The public arena runtime is an online gameplay mode where many players control slimes, throw rocks, level through slime forms, die back to level 1, and may become the tower boss.

The existing runtime is a local browser game: `main thread` owns UI/render/input, a `simulation worker` owns one-player session state, and `SessionDefinition` describes authored campaign/training/dungeon runs. That architecture gives useful contracts for world units, arena bounds, content ids, input, snapshots, projectiles, and sprites, but it does not define:

- a stateful deployment target;
- multiplayer connection ownership;
- server authority over kills, deaths, levels, and boss transforms;
- network message delivery;
- how to keep the first online slice small enough for a game jam.

The product rule is intentionally simple: there is one public arena, no matchmaking, no rooms, no persistence, and a first cap of `200` connected players.

## Decision

### Package and deployment

- Add one separate deployable npm package at repo root: `server/`.
- This package owns the online arena server. It has its own `package.json`, TypeScript config, source files, tests, and lockfile because it is deployed as a stateful Node process, separately from the static web build.
- The server package may import shared, headless project code from `../src/shared/**`, including content registries, math, timing constants, and shared types.
- The server package must not import from `../src/main/**` or `../src/sim/**`.
  - `src/main/**` is browser/UI/render/input code.
  - `src/sim/**` is the local one-player worker runtime with session flow, encounters, zone, drops, result summary, and worker lifecycle.
  - Reusing those layers directly would make the first multiplayer slice larger and less stable than the product needs.
- The web client connects to the server through `socket.io-client`; the server uses the latest stable Socket.IO `4.x` release available when the implementation task installs it. Exact package versions are pinned by npm lockfiles.
- The first slice runs on one stateful Node process. Multi-process scaling, Redis adapters, sticky sessions, queues, and database-backed arena state are out of scope.
- Serverless/stateless hosting is not valid for this arena runtime because the arena state lives in process memory.
- The static web app receives the arena server URL at build time through a `VITE_` environment variable. The implementation may choose the exact variable name, but it must start with `VITE_` so Vite exposes it to browser code. The client must not hardcode a production server URL.
- The stateful server package owns its own runtime configuration separately from the static client's build-time `VITE_` configuration.

### Authority and state

- The server is authoritative for online arena gameplay.
- Clients do not broadcast gameplay facts such as hits, kills, level changes, HP changes, death, respawn, or boss transforms.
- Clients send only player intent:
  - movement direction;
  - aim in world coordinates;
  - fire start/stop;
  - regular weapon slot selection.
- The server owns:
  - connected player identity for the current socket;
  - the in-memory `PublicArenaState`;
  - the fixed public arena loaded from generated session content;
  - the selected regular weapon slot for each non-boss player;
  - player positions, HP, levels, current form, boss state, weapon cooldowns, projectiles, deaths, respawns, and population count.
- Identity is socket-local in the first slice. There are no accounts, player names, profiles, moderation records, or persistent arena progress.
- Disconnecting removes the player from the arena and loses their current level/state.
- Server restart resets the arena. This is acceptable for the first public trash arena.

### Arena model

- The online mode has exactly one public arena state in memory.
- The arena is a content-authored rectangle centered on `(0, 0)`, using the coordinate rules from [arena-and-coordinates.md](arena-and-coordinates.md). The content source is generated through the normal sessions content pipeline; the server and client must not duplicate those dimensions in a separate Public Arena config file.
- Spawn areas are the four arena corners. The first slice can choose a deterministic or simple rotating corner assignment; it does not need spawn balancing, squads, or private spawn groups.
- If the current connected-player count reaches the configured cap, the server rejects the next join with a clear "arena full" response and does not add that socket to `PublicArenaState`.
- All connected players are combatants in the same arena. There are no AI enemies, authored waves, encounter transitions, win/loss results, zone behavior, drops, pets, or campaign progression in this runtime.

### Content and combat shape

- Regular player forms use existing slime content and sprite ids from the shared content library.
- The level chain uses every authored enemy slime from `content/enemies.md` in source order. This is content progression for the online mode, not account progression. The generated enemy content must expose a content-order list so the server and client do not depend on module namespace key order.
- Online progression configuration lives in shared, headless code under `src/shared/**`, not in browser UI and not only inside `server/`. It derives the ordered slime form chain from the generated enemy list, derives the regular weapon ids and default selected regular weapon index from the generated `portal` session loadout, includes the boss weapon id plus the tower boss archetype id, and derives the boss level as `slime form chain length + 1`. Both the server runtime and main-thread Public Arena presentation may import this shared config.
- Regular Public Arena form progression uses the generated enemy list for slime form identity and form radius. Movement speed and max HP for regular players come from the generated `portal` session `playerId`; they are not copied from the enemy roster. If a level points at an enemy id without a form entry, that is a content/configuration error and must throw during setup or tests; falling back to the first slime is forbidden.
- The final level transforms the player into the tower boss form:
  - boss archetype id: `boss-tower-sentinel`;
  - visual source: `public/assets/boss-04.png` through the existing boss visual registry.
- The first online slice uses existing weapon content instead of creating a new combat data model:
  - regular slime attacks come from the generated `portal` session loadout. Current content sets that loadout to `rock-thrower` and `shotgun`, with `rock-thrower` selected by default.
  - boss attack: `fireball-staff` or a compact fireball variant built from the same content shape.
- The server owns each regular player's selected weapon slot. Desktop hotkeys and mobile weapon slot taps send `selectWeaponSlot` intent to the server; invalid slot indexes are ignored. Boss players use the boss weapon regardless of the regular selected slot and return to their existing regular selected slot if they later respawn as a regular slime.
- The server must derive weapon cooldown, fire pattern, projectile motion, projectile size, hit radius, impact damage, and ttl from `WeaponArchetype` content. Hand-written Public Arena copies of rock/fireball weapon numbers are forbidden.
- The generated `portal` loadout may contain any existing authored `WeaponArchetype`, and the generated selected index chooses only the default regular slot. Public Arena must not add rock-specific, shotgun-specific, or portal-only weapon behavior. Current authored weapon motion/pattern/lifecycle shapes (`single`, `multiDirection`, `place`, `linear`, `arc`, `placed`, impact, pierce, grounding, timer/proximity detonation, explosion, and fragments when present) must either run through the shared content shape or fail as a content validation error before a player enters the arena.
- Online projectile snapshots expose the same render-only projectile presentation facts used by the local renderer (`state`, `visualState`, `explosionRadius`, `detonateAtSimMs`, and `arcEnd` while flying) so standard projectile spin, grounded pulse, radius indicators, and arc affordances can be reused instead of reimplemented for the mode.
- Online weapon fire sound uses the existing weapon audio mapping generated from `content/weapons.md`. Public Arena presentation events may trigger audio, but audio remains main-thread presentation and never becomes authoritative gameplay state.
- Online hit sound uses the configured hit audio for the target's current form. To avoid arena-wide hit spam while preserving local feedback, `hit` presentation events are delivered only to the projectile owner and the hit target. The event carries `ownerId`/`ownerKind` and the target's current `PublicArenaPlayerFormSnapshot`, so both recipients route regular slime targets through existing enemy hit mappings and boss targets through existing boss hit mappings without depending on a possibly stale interest snapshot.
- Online death sound uses the configured death audio for the dead player's current form. Death is rare enough to be shared arena feedback, so `death` presentation events are delivered to every connected player. The event carries the dead player's current `PublicArenaPlayerFormSnapshot` before the server resets the player to level 1, so clients play the sound for the form that actually died.
- Damage is permissive for online arena combat: every projectile or boss fire attack can damage any other damageable player, including boss versus boss, except its owner.
- If a projectile overlaps multiple eligible players on the same server tick, the server chooses the hit target deterministically: nearest target by squared distance from projectile center to player center, with player id lexicographic order as the tie-breaker. `Map` insertion order must not decide combat outcomes.
- The server owns level progression:
  - killing any player gives exactly `+1` level;
  - killing a boss still gives exactly `+1` level;
  - death resets the dead player to level 1;
  - no boss-kill bonus, level skip, campaign XP, pet progress, or permanent unlock is awarded.
- Authoritative snapshots may expose the server-owned raw level even after a player is already a boss. Player-facing progress labels clamp the displayed current level to the shared boss level, for example `Level 6/6`, so the HUD communicates progress to boss form without hiding server authority.

### Runtime timing

- The server runs a fixed-tick simulation loop. The first slice should reuse the shared timing constants from [simulation-timing.md](simulation-timing.md) when practical:
  - simulation tick: `60 Hz`;
  - snapshot cadence: `30 Hz`.
- The server does not replay an event log. It holds current mutable state in memory and advances it each tick.
- Socket delivery jitter must not change authoritative gameplay. Incoming intents update each player's current input state; the next server tick consumes the latest state.
- Snapshot delivery may be lossy because the next snapshot supersedes the previous one.

### Socket.IO contract

- Socket.IO rooms are used only for coarse membership and lifecycle grouping, for example "socket is in the public arena".
- Frequent gameplay snapshots are sent per socket, not as a full room-wide world broadcast.
- Join/reject/identity messages are reliable.
- Frequent position/projectile snapshots are sent as volatile messages. If one is dropped, the next snapshot replaces it.
- Authoritative snapshots carry only changing arena state, in line with the rule from [snapshot-shape.md](snapshot-shape.md). Immutable session configuration — arena bounds and the recipient's player id — is delivered once via `publicArena:joinAccepted` and cached by the client for the lifetime of the connection. Repeating immutable values on each snapshot tick is forbidden.
- Gameplay-critical state must be recoverable from authoritative snapshots. Presentation events may be used for hit/death/level-up effects, but the client must not become the source of truth because it received or missed an event.
- Presentation event delivery is purpose-specific in the first slice: `fire` goes to the shooter, `hit` goes to the projectile owner and hit target, `death` goes to all connected players, `explosion` goes to the owner, and `levelUp`/`spawn` go to the affected player.
- The first protocol only needs:
  - client -> server: join request, input intent, disconnect/leave;
  - server -> client: accepted (carrying arena bounds, the assigned player id, server cap, current population, and tick/snapshot rates), rejected, authoritative snapshot of changing state, presentation events, server error/close reason.
- Network protocol types live in the server package or in `src/shared/**` only if both the static client and the server import them. They must not be hidden in browser UI modules.
- The server rate-limits `publicArena:input` per socket as a protective boundary around the authoritative simulation. The first slice accepts up to `240` input intents per socket per `1000 ms` server-time window. Excess input intents are dropped, not queued, and do not disconnect the socket. This limit is intentionally above normal desktop/mobile input cadence, including high-refresh pointer movement, and can be revisited only after measurement.
- Before an intentional server shutdown through `PublicArenaServer.close()`, connected sockets receive `publicArena:closeReason` with `reason: 'serverShutdown'` and the message `Arena server is restarting.`. Unplanned socket loss may still surface as `serverError` on the client.

### Snapshot delivery

- The arena remains one shared simulation. The first slice does not perform per-socket interest filtering: every connected socket receives the same authoritative arena snapshot, covering all players and projectiles in the `35 x 35 wu` arena.
- The previous configured interest rectangle already covered the full arena width and almost the full arena height, so the filter ran a per-socket scan and a divergent snapshot path while in practice filtering almost nothing. Removing it simplifies the snapshot path without losing observable accuracy.
- Authoritative snapshots carry only changing arena state (see "Socket.IO contract" above and [snapshot-shape.md](snapshot-shape.md)). Arena bounds and the recipient's player id are delivered once via `publicArena:joinAccepted` and cached by the client; they must not be repeated on each snapshot tick.
- The per-socket emit path on the server is a single `snapshotFor` returning the same authoritative state for every socket. The simulation does not maintain a separate filtered snapshot accessor.
- Reintroducing interest filtering is allowed only after live measurement shows that per-socket payload at the current cap (`200`) is a real problem. The reintroduction must be recorded as an updated decision here, must remain a network optimization only (no effect on hit detection, projectile motion, HP, death, level progression, or boss transforms), and must continue to deliver a superset of what the client can currently see.

### Client integration

- The existing web app remains the player-facing shell. It adds a Public Arena entry point that connects to the stateful server.
- Online arena rendering uses server snapshots and existing visual registries for slime, boss, projectile, and impact presentation.
- The online arena background and active background id come from generated session content. Authored local waves, breaks, and boss encounters are not part of the online arena runtime.
- Desktop/mobile camera and visible-area presentation stay client-side. They affect what the player sees and how aim maps to world coordinates, but they do not give the client authority over the arena.
- The online client may reuse existing input mapping rules, including mobile touch controls, by sending the same kind of world-space movement/aim/fire intent to the server instead of the local worker.
- Local campaign, training, dungeon, settings, progression, and existing result screens remain unchanged.

### Tests and verification

- Server arena logic must be testable without opening real sockets:
  - cap and join rejection;
  - corner spawn selection;
  - movement clamped to the generated public arena bounds;
  - rock/fire projectile hits;
  - kill gives `+1` level;
  - death resets to level 1;
  - boss transform;
  - boss versus boss damage;
  - snapshots delivered to two distant sockets are equal in `players`/`projectiles` and contain no immutable session config (`arena`/recipient player id).
- Socket.IO integration tests are allowed for the protocol handshake, but most gameplay tests should call pure arena functions directly.
- Live verification remains a required delivery step: do not treat local dev-server/browser checks as complete until the user verifies the requested online flow.

## Consequences

- The first online slice is small enough for a game jam: one package, one in-memory arena, one process, no database, no matchmaking, no event replay, no sharding.
- Server authority keeps kills, HP, boss transforms, and level resets stable even when clients lag or drop snapshot packets.
- The current local `src/sim` runtime remains clean and one-player focused. The cost is some duplicated compact gameplay logic on the server for movement/projectiles/deathmatch rules.
- Reuse stays at the right layer: content ids, world units, timing constants, sprites, and protocol types can be shared; browser UI and local worker session flow are not dragged into the server.
- Snapshot delivery is the simplest possible shape for the first slice: every socket receives the same full arena snapshot, and snapshots carry only changing state. Per-tick payload is dominated by what actually moves, not by repeated session configuration.
- If the mode grows past one process or needs persistence, this decision must be extended or superseded before adding Redis adapters, database state, reconnect restoration, account identity, or multiple arena shards.

## Related

- [web-stack.md](web-stack.md)
- [content-boundaries.md](content-boundaries.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [camera-and-visible-area.md](camera-and-visible-area.md)
- [input-commands.md](input-commands.md)
- [mobile-web-support.md](mobile-web-support.md)
- [main-ui-shell.md](main-ui-shell.md)
- [simulation-timing.md](simulation-timing.md)
- [snapshot-shape.md](snapshot-shape.md)
- [content-archetypes.md](content-archetypes.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [health-and-death.md](health-and-death.md)
- [boss-encounter.md](boss-encounter.md)
- [sprite-assets.md](sprite-assets.md)
- [testing.md](testing.md)
