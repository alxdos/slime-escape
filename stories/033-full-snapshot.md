# Public Arena Full Snapshot

- Status: in-progress
- Created: 2026-04-30
- Updated: 2026-04-30

## Product intent

The public arena is a fixed `35 x 35 wu` deathmatch with a first cap of `200` connected players. The first slice carries two snapshot-delivery decisions that are now too costly relative to their value:

- **Per-socket interest filtering.** Each socket receives only players/projectiles inside a fixed interest rectangle around their own position. In practice the configured interest rectangle is already the full arena width and almost the full arena height, so the filter currently does almost no filtering, but still adds a per-socket scan, configuration constants, and a divergent snapshot path.
- **Immutable session config in every snapshot.** Each `publicArena:snapshot` repeats `arena` (the world bounds) and `selfId` (the recipient's player id), even though both are already delivered once in `publicArena:joinAccepted`. At `30 Hz` snapshot cadence this is pure repetition that violates the existing rule from [snapshot-shape.md](../design/snapshot-shape.md): a snapshot carries only changing state.

This story drops both. Every connected socket receives the same authoritative arena snapshot, and the snapshot only carries the changing arena state. `arena` and the recipient's player id come from the join handshake and are cached on the client for the lifetime of the connection. If payload pressure becomes real after live measurement, interest filtering may be reintroduced as a separate, measured decision, not as a default optimization.

## Player-facing

- Sees: in the public arena, players on the far side of the arena are visible on the same terms as nearby players. There is no longer a near/far cutoff beyond the arena bounds themselves.
- Sees: no other change to gameplay, controls, HUD, or rules. Authority, movement, combat, levels, and boss transforms all behave as before.

## Technical

Updates [online-arena-hosting.md](../design/online-arena-hosting.md) twice. The "Interest snapshots" section is replaced with a recorded decision that the first slice does not perform interest filtering. The "Authority and state" / "Socket.IO contract" sections record that the authoritative snapshot carries only changing state, with `arena` and the recipient's player id delivered once via `joinAccepted` in line with [snapshot-shape.md](../design/snapshot-shape.md). `PublicArenaSnapshot` in `src/shared/arenaHostProtocol.ts` drops `selfId` and `arena` and bumps `ARENA_HOST_PROTOCOL_VERSION`. Interest filtering implementation is removed from `server/src/arenaSimulation.ts`; the per-socket emit path in `server/src/server.ts` calls a single full `snapshotFor`. Client UI/renderer code (`UiShell`, `PublicArenaRenderer`, `PublicArenaHud`, `PublicArenaCombatAffordances`) reads `selfId` and `arena` from the cached `joinAccepted` payload instead of from each snapshot.

## Out of scope

- Client-side prediction, reconciliation, or extrapolation.
- Reintroducing interest filtering in any form.
- Server scaling, multiple arenas, sharding, or persistence.
- Snapshot delta encoding or per-entity change tracking.
- Any change to the per-entity field set inside `players`/`projectiles`.

## Acceptance

- Two players standing in opposite corners of the public arena both see each other in their snapshots, regardless of viewport size.
- Online demo from story 032 still works: join, kill, level up, die, become the boss, fight the boss.
- `PublicArenaSnapshot` no longer contains `selfId` or `arena`.
- `ARENA_HOST_PROTOCOL_VERSION` is bumped, and a client connecting to a server with a mismatched version receives a clean `protocolMismatch` rejection.
- `design/online-arena-hosting.md` (formerly `design/public-multiplayer-arena.md`, renamed in story 036) reflects both decisions: no interest filtering in the first slice, and authoritative snapshots carry only changing state.
- Server tests: the dedicated interest-filter test is removed; a new test verifies that snapshots delivered to two distant sockets are equal in `players`/`projectiles` and contain no `selfId`/`arena`.
- Client tests: cover that `selfId` and `arena` come from `joinAccepted` and reach the renderer/HUD/combat affordances; HUD self lookup, renderer self ring, and online camera/input setup still work after the snapshot loses `selfId`/`arena`.
- Live online verification by the user with at least two players on opposite corners of the arena.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Update [online-arena-hosting.md](../design/online-arena-hosting.md): replace the "Interest snapshots" section with the no-filter decision and the trigger for reintroducing it; record in "Authority and state" / "Socket.IO contract" that the authoritative snapshot carries only changing state, with `arena` and the recipient player id delivered once via `joinAccepted`. Update `Consequences`. | Recorded in [online-arena-hosting.md](../design/online-arena-hosting.md); architectural PR, no code. |
| T2 | [x] | Update `src/shared/arenaHostProtocol.ts`: drop `selfId` and `arena` from `PublicArenaSnapshot`, bump `ARENA_HOST_PROTOCOL_VERSION`, update `arenaHostProtocol.test.ts`. | Protocol test passes. |
| T3 | [x] | Server: drop interest filtering from `server/src/arenaSimulation.ts` (`InterestRect`, `interestRectFor`, `playerIntersectsInterest`, `projectileIntersectsInterest`, `circleIntersectsRect`, `interestSnapshotFor`, `PUBLIC_ARENA_INTEREST_*`); simplify `snapshotFor` to no longer include `selfId`/`arena`; switch `server/src/server.ts` to the simplified `snapshotFor` per socket. | Server typecheck passes. |
| T4 | [x] | Update `server/src/arenaSimulation.test.ts`: remove the interest-filter test; add a test that snapshots delivered to two distant sockets are equal in `players`/`projectiles` and contain no `selfId`/`arena`. | Server arena simulation test passes. |
| T5 | [x] | Client: cache `arena` and the assigned `playerId` from `joinAccepted` in `PublicArenaClient`; pass them into `UiShell` so the visible-area camera and `PublicArenaInput` are initialized from the cached `arena` instead of `snapshot.arena`; pass `selfId` into `PublicArenaRenderer`, `PublicArenaHud`, and `PublicArenaCombatAffordances` separately from `snapshot`. | Root typecheck reaches only pending T6 test fixture updates. |
| T6 | [x] | Update client tests (`PublicArenaClient.test.ts`, `PublicArenaRenderer.test.ts`, `PublicArenaHud.test.ts`, `PublicArenaCombatAffordances.test.ts`, `UiShell.test.ts`) to feed `selfId`/`arena` from the cached join handshake instead of the snapshot. | Root typecheck and focused client tests pass. |
| T7 | [ ] | Run automated checks (root and server typecheck, tests, build, diff whitespace) and request live online verification with two players on opposite corners of the arena. | |

## Related

- [online-arena-hosting.md](../design/online-arena-hosting.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [simulation-timing.md](../design/simulation-timing.md)
- [arena-and-coordinates.md](../design/arena-and-coordinates.md)
- [../stories/032-public-slime-arena.md](032-public-slime-arena.md)
