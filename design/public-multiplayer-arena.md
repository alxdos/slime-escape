# Public Multiplayer Arena Runtime

- Status: accepted
- Created: 2026-04-30
- Updated: 2026-04-30

## Context

Story 032 introduces the first online gameplay mode: one public deathmatch arena where many players control slimes, throw rocks, level through slime forms, die back to level 1, and may become the tower boss.

The existing runtime is a local browser game: `main thread` owns UI/render/input, a `simulation worker` owns one-player session state, and `SessionDefinition` describes authored campaign/training/dungeon runs. That architecture gives useful contracts for world units, arena bounds, content ids, input, snapshots, projectiles, and sprites, but it does not define:

- a stateful deployment target;
- multiplayer connection ownership;
- server authority over kills, deaths, levels, and boss transforms;
- network message delivery;
- how to keep the first online slice small enough for a game jam.

The product rule is intentionally simple: there is one public arena, no matchmaking, no rooms, no persistence, and a first cap of `200` connected players.

## Decision

### Package and deployment

- Add one separate deployable npm package at repo root: `public-arena-server/`.
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
  - fire start/stop.
- The server owns:
  - connected player identity for the current socket;
  - the in-memory `PublicArenaState`;
  - the fixed `40 x 40 wu` arena;
  - player positions, HP, levels, current form, boss state, weapon cooldowns, projectiles, deaths, respawns, and population count.
- Identity is socket-local in the first slice. There are no accounts, player names, profiles, moderation records, or persistent arena progress.
- Disconnecting removes the player from the arena and loses their current level/state.
- Server restart resets the arena. This is acceptable for the first public trash arena.

### Arena model

- The online mode has exactly one public arena state in memory.
- The arena is a `40 x 40 wu` square, centered on `(0, 0)`, using the coordinate rules from [arena-and-coordinates.md](arena-and-coordinates.md).
- Spawn areas are the four arena corners. The first slice can choose a deterministic or simple rotating corner assignment; it does not need spawn balancing, squads, or private spawn groups.
- If the current connected-player count reaches the configured cap, the server rejects the next join with a clear "arena full" response and does not add that socket to `PublicArenaState`.
- All connected players are combatants in the same arena. There are no AI enemies, authored waves, encounter transitions, win/loss results, zone behavior, drops, pets, or campaign progression in this runtime.

### Content and combat shape

- Regular player forms use existing slime content and sprite ids from the shared content library.
- The level chain is an ordered list of slime archetype ids chosen for the online mode. The exact list is online-mode configuration, not account progression.
- The final level transforms the player into the tower boss form:
  - boss archetype id: `boss-tower-sentinel`;
  - visual source: `public/assets/boss-04.png` through the existing boss visual registry.
- The first online slice uses existing weapon content ids instead of creating a new combat data model:
  - regular slime attack: `rock-thrower`;
  - boss attack: `fireball-staff` or a compact fireball variant built from the same content shape.
- The server runtime may implement only the projectile behavior needed by those online weapons. It does not need to implement the whole local `CombatSystem` feature set before the arena can ship.
- Damage is permissive for online arena combat: every projectile or boss fire attack can damage any other damageable player, including boss versus boss, except its owner.
- The server owns level progression:
  - killing any player gives exactly `+1` level;
  - killing a boss still gives exactly `+1` level;
  - death resets the dead player to level 1;
  - no boss-kill bonus, level skip, campaign XP, pet progress, or permanent unlock is awarded.

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
- Gameplay-critical state must be recoverable from authoritative snapshots. Presentation events may be used for hit/death/level-up effects, but the client must not become the source of truth because it received or missed an event.
- The first protocol only needs:
  - client -> server: join request, input intent, disconnect/leave;
  - server -> client: accepted/rejected, authoritative snapshot, presentation events, server error/close reason.
- Network protocol types live in the server package or in `src/shared/**` only if both the static client and the server import them. They must not be hidden in browser UI modules.

### Interest snapshots

- The arena remains one shared simulation, but payload delivery is interest-based.
- The server builds an interest rectangle for each connected player and sends that socket only the players/projectiles/effects that intersect the rectangle.
- The interest rectangle must be a superset of what the client can currently see: active visible area plus a margin for fast projectiles, interpolation, and edge entry.
- For the first slice, the server may use a conservative fixed interest size derived from the largest current desktop visible area plus margin, centered and clamped around the player's authoritative position. This keeps the implementation simple, avoids trusting arbitrary client viewport values, and still avoids broadcasting the full `40 x 40 wu` world to every socket.
- Later work may narrow interest to exact desktop/mobile visible area and camera state if payload size becomes a real problem. That extension must not change gameplay authority.
- Interest filtering is a network optimization only. It must not affect hit detection, projectile motion, HP, death, level progression, or boss transforms.
- With the first cap of `200` players, a simple per-socket scan over current players and projectiles is acceptable. A spatial index is optional only after measurement shows the scan is too expensive.

### Client integration

- The existing web app remains the player-facing shell. It adds a Public Arena entry point that connects to the stateful server.
- Online arena rendering uses server snapshots and existing visual registries for slime, boss, projectile, and impact presentation.
- Desktop/mobile camera and visible-area presentation stay client-side. They affect what the player sees and how aim maps to world coordinates, but they do not give the client authority over the arena.
- The online client may reuse existing input mapping rules, including mobile touch controls, by sending the same kind of world-space movement/aim/fire intent to the server instead of the local worker.
- Local campaign, training, dungeon, settings, progression, and existing result screens remain unchanged.

### Tests and verification

- Server arena logic must be testable without opening real sockets:
  - cap and join rejection;
  - corner spawn selection;
  - movement clamped to `40 x 40 wu`;
  - rock/fire projectile hits;
  - kill gives `+1` level;
  - death resets to level 1;
  - boss transform;
  - boss versus boss damage;
  - interest snapshot filtering.
- Socket.IO integration tests are allowed for the protocol handshake, but most gameplay tests should call pure arena functions directly.
- Live verification still follows the story pipeline: do not treat local dev-server/browser checks as complete until the user verifies the requested online flow.

## Consequences

- The first online slice is small enough for a game jam: one package, one in-memory arena, one process, no database, no matchmaking, no event replay, no sharding.
- Server authority keeps kills, HP, boss transforms, and level resets stable even when clients lag or drop snapshot packets.
- The current local `src/sim` runtime remains clean and one-player focused. The cost is some duplicated compact gameplay logic on the server for movement/projectiles/deathmatch rules.
- Reuse stays at the right layer: content ids, world units, timing constants, sprites, and protocol types can be shared; browser UI and local worker session flow are not dragged into the server.
- Interest snapshots reduce network payload without changing the simple one-arena product model.
- If the mode grows past one process or needs persistence, this decision must be extended or superseded before adding Redis adapters, database state, reconnect restoration, account identity, or multiple arena shards.

## Related

- [../stories/032-public-slime-arena.md](../stories/032-public-slime-arena.md)
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
