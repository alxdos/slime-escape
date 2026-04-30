# Node Arena Host Replaces Compact Server Sim

- Status: planned
- Created: 2026-04-30
- Updated: 2026-04-30

## Product intent

Per [simulation-runtime.md](../design/simulation-runtime.md), the Node arena server must be a thin host over the shared simulation core, not a separate compact sim. With the shared core extracted (story 034) and multi-actor sessions in place (story 035), this story builds the Node arena host, expresses Public Arena PvP rules as a session config in shared content, switches Public Arena to it, and removes the compact `server/src/arenaSimulation.ts`. The provisional [public-multiplayer-arena.md](../design/public-multiplayer-arena.md) is removed in the same architectural PR; its replacement is a new `online-arena-hosting.md` decision describing the Node host contract.

## Player-facing

- Sees: in the online Public Arena, weapon, projectile, explosion, and effect behavior aligns with single-player content content-for-content. Where the compact sim previously stubbed an effect (fragments, status effects, field effects, modifiers, etc.), online now plays it according to the same content used in single-player. No new game modes.

## Technical

Build `server/src/arena-host/**` (path agreed in T1). It is a thin wrapper over the shared core: constructs one shared multi-actor session, drives the clock from `setInterval`, intakes Socket.IO `publicArena:input` per socket into the per-actor input state, and fans out snapshots and runtime events per socket. Author the Public Arena PvP session config in shared content rather than in host code: friendly fire on, respawn-on-death (the new `lossCondition` from story 035), kill→level→form chain, no encounters. Switch `server/src/server.ts` to the new host. Remove `server/src/arenaSimulation.ts` and its tests. Remove `design/public-multiplayer-arena.md` and replace it with a new `design/online-arena-hosting.md` covering the Node host contract; update every `design/` file and story that linked to the old decision.

## Out of scope

- Online co-op vs slimes — that is story 037.
- Client-side prediction or any other transport optimization.
- Snapshot delta encoding or further protocol changes beyond what the new host requires.
- Story 033's interest filtering / immutable-fields cleanup is independent of this story and assumed already done.

## Acceptance

- Public Arena demo from story 032 plays through end-to-end on the new Node host: join, fire, kill, level up, become boss, fight boss.
- `server/src/arenaSimulation.ts` is removed; the Node server source contains only the host wrapper plus shared-core imports.
- Online weapon, projectile, and effect behavior matches single-player behavior for the same content (verified by running content-driven scenarios on both sides).
- `design/public-multiplayer-arena.md` is removed; `design/online-arena-hosting.md` covers the Node host contract; every `design/` file and `stories/` file that referenced the removed decision is updated.
- Live online verification by the user with at least two players reproducing the 032 demo.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [ ] | Architectural PR: create `design/online-arena-hosting.md` describing the Node host contract (clock, intent intake, snapshot fanout, lifecycle vs sockets, shutdown). Remove `design/public-multiplayer-arena.md`. Update every `design/` file (`web-stack.md`, `snapshot-shape.md`, `simulation-timing.md`, `runtime-systems.md`, etc. — full list determined while editing) and `stories/` reference to point at `online-arena-hosting.md` and `simulation-runtime.md` instead. Update `design/README.md` index. | Architectural PR, no code. |
| T2 | [ ] | Author the Public Arena PvP session config in shared content (rules, loadout, no encounters, respawn-on-death, kill→level→form chain). | Code PR, depends on T1. |
| T3 | [ ] | Implement `server/src/arena-host/**` against the shared core; route Socket.IO input intents into the per-actor input state; fan out snapshots and runtime events per socket. | Code PR, depends on T2. |
| T4 | [ ] | Switch `server/src/server.ts` to the new host. Wire join/leave/disconnect lifecycle to the host's actor add/remove. | |
| T5 | [ ] | Remove `server/src/arenaSimulation.ts` and its tests. Update remaining server tests to cover the new host's input intake, snapshot fanout, and lifecycle. | |
| T6 | [ ] | Run automated checks (root and server typecheck, tests, build, diff whitespace) and request live online verification with at least two players. | |

## Related

- [simulation-runtime.md](../design/simulation-runtime.md)
- [session-definition.md](../design/session-definition.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [runtime-systems.md](../design/runtime-systems.md)
- [034-extract-sim-core.md](034-extract-sim-core.md)
- [035-multi-actor-sessions.md](035-multi-actor-sessions.md)
