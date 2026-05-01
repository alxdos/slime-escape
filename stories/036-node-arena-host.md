# Node Arena Host Replaces Compact Server Sim

- Status: in-progress
- Created: 2026-04-30
- Updated: 2026-05-01 (architect prep T1a + T1b landed in one architectural commit. T1a engine contract: `sim-core-interface.md` (`addPlayer`/`removePlayer`/`setPlayerForm` with tick-boundary application, in-flight projectile cleanup on remove, opt-in `invulnerableUntilSimMs` and explicit `refillHp`), `session-definition.md` (`dynamicRoster: boolean` flag plus `lossCondition: 'respawnOnDeath'` semantics), `snapshot-shape.md` (`PlayerSnapshot.{playerId, formArchetypeId, weaponHud}`, `weaponHud` migrated out of top-level with companion exclusion, `RuntimeEvent.death.killerId`, new `playerSpawn` event, `levelUp` explicitly excluded from shared events), `runtime-systems.md` (respawnOnDeath path, `playerSpawn` ownership at `EntityStore.spawnPlayer`, dynamic-roster ordering rule, `invulnerableUntilSimMs` filter at `HealthDeathSystem` intake), `web-stack.md` (explicit `server/**` boundary rule). T1b host contract: created `online-arena-hosting.md` (lifecycle, wall-clock pump, wire envelope under Path A as a single discriminated union with `host:*` namespace, per-event delivery table, `pvpKillToLevelOps` pure-function policy with self-kill rule, host-side rationale, corner spawning from `session.arena`, `spawnInvulnerabilityMs` in PvP content, reconnect closed); deleted the provisional `public-multiplayer-arena.md`; redirected every reference in `design/**` and `stories/**`. Path A on the wire is confirmed; protocol version rename to `ARENA_HOST_PROTOCOL_VERSION` slated for T5. Tasks broken down into T1a/T1b/T2/T3/T4/T5/T6a/T6b/T6c/T7/T8 with file-level scope per task.)

## Product intent

Per [simulation-runtime.md](../design/simulation-runtime.md), the Node arena server must be a thin host over the shared simulation core, not a separate compact sim. With the shared core extracted (story 034) and multi-actor sessions in place (story 035), this story builds the Node arena host, expresses Public Arena PvP rules as a session config in shared content, switches Public Arena to it, and removes the compact `server/src/arenaSimulation.ts`. The provisional `design/public-multiplayer-arena.md` is removed in T1b; its replacement is the focused [online-arena-hosting.md](../design/online-arena-hosting.md) decision describing the Node host contract.

## Player-facing

- Sees: in the online Public Arena, weapon, projectile, explosion, and effect behavior aligns with single-player content content-for-content. Where the compact sim previously stubbed an effect (fragments, status effects, field effects, modifiers, etc.), online now plays it according to the same content used in single-player. No new game modes.

## Technical

Build `server/src/arena-host/**`. It is a thin wrapper over the shared core ([sim-core-interface.md](../design/sim-core-interface.md)): constructs one shared multi-actor session, drives the clock from `setInterval`, intakes Socket.IO `publicArena:input` per socket into the per-actor input state, and fans out the shared `Snapshot` and `RuntimeEvent` per socket (Path A — wire shape becomes the shared core's snapshot, not a separate `PublicArenaSnapshot`). Author the Public Arena PvP session config in shared content (`content/sessions/public-arena.md`): `dynamicRoster: true` ([session-definition.md](../design/session-definition.md)), empty initial `players[]`, single sandbox-style encounter, friendly fire on, `lossCondition: 'respawnOnDeath'`, `winCondition: 'none'`. The kill→level→form chain stays in the host as policy (recorded as a pure function `(death, state, content) → CoreOp[]` in `online-arena-hosting.md`), built on top of the engine primitives `addPlayer`/`removePlayer`/`setPlayerForm`; spawn invulnerability is the engine primitive `addPlayer.invulnerableUntilSimMs`, with the duration value living in PvP content rather than hard-coded in the host. Switch `server/src/server.ts` to the new host; rename `PUBLIC_ARENA_PROTOCOL_VERSION` to `ARENA_HOST_PROTOCOL_VERSION`. Remove `server/src/arenaSimulation.ts` and its tests. Remove `design/public-multiplayer-arena.md` and replace it with a new `design/online-arena-hosting.md` covering the Node host contract; update every `design/` file and story that linked to the old decision.

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
| T1a | [x] | Architectural PR (engine contract). Update [sim-core-interface.md](../design/sim-core-interface.md) (`addPlayer`/`removePlayer`/`setPlayerForm` with tick-boundary application, in-flight projectile silent cleanup on `removePlayer`, `addPlayer.invulnerableUntilSimMs` opt, `setPlayerForm.refillHp` opt); [session-definition.md](../design/session-definition.md) (`dynamicRoster: boolean`, empty `players[]` permitted under it, `'respawnOnDeath'` semantics implemented in 036); [snapshot-shape.md](../design/snapshot-shape.md) (`PlayerSnapshot.formArchetypeId` and `playerId`, `weaponHud` migrated into `PlayerSnapshot` excluding companions, `RuntimeEvent.death.killerId`, new `playerSpawn` event, `levelUp` explicitly host-only); [runtime-systems.md](../design/runtime-systems.md) (`'respawnOnDeath'` path, dynamic-roster ordering rule, `invulnerableUntilSimMs` filter at `HealthDeathSystem` intake, `playerSpawn` ownership and re-emit on session restart); [web-stack.md](../design/web-stack.md) (explicit `server/**` import boundary). Update [design/README.md](../design/README.md) index. | Architectural PR, no code. Landed together with T1b. |
| T1b | [x] | Architectural PR (host contract). Create [online-arena-hosting.md](../design/online-arena-hosting.md): Node host lifecycle (single core, `start(session)` at boot, `addPlayer` per join, `removePlayer` per disconnect, `setInterval`-pump with `performance.now`); kill→level→form policy as pure function `pvpKillToLevelOps(death, state, content) → CoreOp[]` with self-kill rule (`killerId === entityId || killerId === null` → no level reward); rationale for host-side placement vs an engine `PlayerProgressionSystem`; corner spawning derived from `session.arena`, not a constant; spawn-invulnerability value in PvP content (e.g. `spawnInvulnerabilityMs`), not host-hard-coded; per-event delivery mapping for shared `RuntimeEvent` and host-emitted `levelUp`; wire envelope shape (single discriminated union with `host:*` namespace); reconnect policy: closed for 036; rate-limit and shutdown reason carry over. Delete `design/public-multiplayer-arena.md`; update every reference in `design/**` and `stories/**` (032, 033, 034, 035, 036). Refresh [design/README.md](../design/README.md) index. | Architectural PR, no code. Landed together with T1a. |
| T2 | [x] | Shared sim implementation: `SimulationCore.addPlayer`/`removePlayer`/`setPlayerForm` with tick-boundary buffering; `HealthDeathSystem` invulnerability filter at damage-intent intake (drops every `DamageIntent` whose target has `invulnerableUntilSimMs > simTimeMs` before HP application, hooks, and `death` event/death-hook chain — uniform across all damage sources; `hit` event from `CombatSystem` still fires as accepted iframe feedback); `'respawnOnDeath'` path in `SessionFlowSystem` (no `loss`); `formArchetypeId` propagation through `EntityStore` and `SnapshotExportSystem`; migration of `weaponHud` into `PlayerSnapshot` (with `playerId` discriminator); `killerId` on `death` events and `ownerId` on `hit` and `explosion` events from `CombatSystem` emitters; new `playerSpawn` event from `EntityStore.spawnPlayer` re-firing on every `start(session)` (including restarts after `stop()`); `dynamicRoster` validation. Extend `scripts/content-build/sessions/**` so every existing preset emits `dynamicRoster: false` (the field is required and immutable per [session-definition.md](../design/session-definition.md)); `public-arena.md` is authored in T3 with `dynamicRoster: true`. Tests for each plus a regression test for the local single-player HUD after `weaponHud` migration. Split into T2a (snapshot/HUD additive extensions + regression) and T2b (dynamic-roster runtime APIs + respawnOnDeath) only if the diff exceeds a comfortable review window. | Code PR, depends on T1a. |
| T3 | [x] | Author `content/sessions/public-arena.md`: `dynamicRoster: true`, `players: []`, single sandbox-style encounter (`spawnPlan: 'empty'`, `zoneBehavior: 'disabled'`, `transitionRules: 'never'`), `slimeFriendlyFire: true`, `lossCondition: 'respawnOnDeath'`, `winCondition: 'none'`, regular/boss weapon ids and boss archetype id, `spawnInvulnerabilityMs`. Extend `scripts/content-build/sessions/**` for the new authoring case (empty `players[]` + `dynamicRoster`); the level-chain order continues to live in `src/shared/publicArenaProgression.ts` derived from enemies content. | Code PR, depends on T1a/T1b. May land in parallel with T2. |
| T4 | [x] | `server/src/arena-host/**`: pure-function policy module `pvpKillToLevelOps` per `online-arena-hosting.md` (testable in isolation against fake states); host shell that constructs the core once, owns `setInterval` pump, listens to `core.onSnapshot`/`core.onEvent`, computes recipient sets from the delivery table, applies policy ops via `addPlayer`/`removePlayer`/`setPlayerForm`, emits host `levelUp` events; corner spawning from `session.arena`; rate-limit and shutdown-reason carry over. Tests on the policy without poking sockets, plus host-shell tests against an in-memory `SimulationCore` without a real Socket.IO server. | Code PR, depends on T2 + T3. |
| T5 | [x] | Switch `server/src/server.ts` to the arena host. Fold `arenaState.ts` corner-spawn and cap responsibilities into the host shell. Rename `PUBLIC_ARENA_PROTOCOL_VERSION` → `ARENA_HOST_PROTOCOL_VERSION`; update `joinAccepted` shape (still cached arena bounds + assigned `actorId` + cap + population + tick/snapshot rates). | Code PR, depends on T4. |
| T6 plan | [x] | Before starting T6 client work, publish the file-by-file decomposition for T6a/T6b/T6c with concrete acceptance per sub-task. Already drafted in this story; finalised here when T5 lands. | Architect work, depends on T5. |
| T6a | [x] | Online renderer: `src/main/online/PublicArenaRenderer.ts` (+ tests) — switch from `PublicArenaSnapshot` to shared `Snapshot`. Iterate `entities[]` by `kind`; render players via `formArchetypeId` (non-null → enemy/boss visual; null → player visual); `zone`/`encounter`/`waveProgress`/`bossHud` carry through as `null` without PvP-mode stripping. | Code PR, depends on T5. |
| T6b | [x] | Online HUD/affordances: `src/main/ui/PublicArenaHud.ts`, `PublicArenaCombatAffordances.ts`, `PublicArenaStatusOverlay.ts`, `PublicArenaMenuOverlay.ts` (+ tests) — read per-player `weaponHud` from the local `PlayerSnapshot`; level/form derived from `formArchetypeId` against `PUBLIC_ARENA_SLIME_FORM_CHAIN`/`PUBLIC_ARENA_BOSS_LEVEL`. | Code PR, depends on T6a. |
| T6c | [x] | Online transport: `src/main/online/PublicArenaClient.ts` (+ tests) — accept shared `Snapshot`/`RuntimeEvent` plus host-emitted `levelUp`; updated `joinAccepted` parsing; cache `arena`/`selfActorId` for the lifetime of the connection. | Code PR, depends on T6b. |
| T7 | [x] | Remove `server/src/arenaSimulation.ts` and `arenaSimulation.test.ts`. Trim now-dead types (`PublicArenaSnapshot`, `PublicArenaPlayerSnapshot`, `PublicArenaProjectileSnapshot`, `PublicArenaPresentationEvent`) and rename `src/shared/publicArenaProtocol.ts` to `arenaHostProtocol.ts`. Verify `server/src/importBoundaries.test.ts` still passes (server allowed to import `src/shared/sim/**` only via the public façade, per [web-stack.md](../design/web-stack.md)). | Code PR, depends on T6c. |
| T8 | [x] | Run automated checks (root + server typecheck/tests/build, content drift, sim import-boundary). Request live online verification with at least two players reproducing the 032 demo: join, fire, kill, level up, become boss, fight boss. | Automated checks passed; live verification is a user handoff because Codex was instructed not to start the server/browser. |

## Finalized T6 decomposition

T6a renderer slice:

- Files: `src/main/online/publicArenaSnapshotView.ts` (new helper, with tests), `src/main/online/PublicArenaRenderer.ts`, `src/main/online/PublicArenaRenderer.test.ts`, and `src/main/render/projectilePresentation.ts` only if the projectile view type needs to stop depending on compact `PublicArenaProjectileSnapshot`.
- Acceptance: renderer tests build the online scene from a shared `Snapshot.entities[]`; player entities are keyed by `PlayerSnapshot.playerId`; `formArchetypeId === null` renders the normal player visual, regular slime form ids render `ENEMY_VISUALS`, boss form ids render `BOSS_VISUALS`; projectiles render from shared `ProjectileSnapshot`; `zone`, `encounter`, `waveProgress`, and `bossHud` are accepted as normal shared snapshot fields without PvP stripping.
- Boundary: keep a temporary legacy snapshot adapter only where needed for typecheck until T6c; no server or protocol file changes in T6a.

T6b HUD and affordance slice:

- Files: `src/main/ui/PublicArenaHud.ts`, `src/main/ui/PublicArenaHud.test.ts`, `src/main/ui/PublicArenaCombatAffordances.ts`, `src/main/ui/PublicArenaCombatAffordances.test.ts`, plus `PublicArenaStatusOverlay` / `PublicArenaMenuOverlay` tests only for type fallout.
- Acceptance: HUD finds the local player through shared `PlayerSnapshot.playerId`, derives level from `formArchetypeId` via `PUBLIC_ARENA_SLIME_FORM_CHAIN` / `PUBLIC_ARENA_BOSS_LEVEL`, and displays online population from `snapshot.entities` player count; combat affordances read the local `PlayerSnapshot.weaponHud` for selected slot, cooldowns, modifiers, and timed effects, with boss/no-weapon states rendering no selected regular slot.
- Boundary: do not change Socket.IO parsing in this slice; keep using the T6a view helper so old compact fixtures can be retired cleanly in T6c/T7.

T6c transport slice:

- Files: `src/shared/arenaHostProtocol.ts`, `src/main/online/PublicArenaClient.ts`, `src/main/online/PublicArenaClient.test.ts`, `src/main/ui/UiShell.ts`, `src/main/ui/UiShell.test.ts`, and audio/presentation tests touched by event shape fallout.
- Acceptance: protocol server-to-client payloads are shared `Snapshot` and `RuntimeEvent | { kind: 'host:levelUp', ... }`; `joinAccepted.actorId` and `arena` are cached for the connection; `UiShell` stores the local `actorId`, routes shared runtime events directly to audio/render impact paths, ignores `playerSpawn` for presentation, and handles `host:levelUp` without reintroducing compact `levelUp` events.
- Boundary: after T6c, no online client production code imports compact `PublicArenaSnapshot` or `PublicArenaPresentationEvent`; T7 is then limited to deleting dead server sim files, dead protocol types, and the protocol filename rename.

## Related

- [simulation-runtime.md](../design/simulation-runtime.md)
- [online-arena-hosting.md](../design/online-arena-hosting.md)
- [sim-core-interface.md](../design/sim-core-interface.md)
- [session-definition.md](../design/session-definition.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [runtime-systems.md](../design/runtime-systems.md)
- [web-stack.md](../design/web-stack.md)
- [034-extract-sim-core.md](034-extract-sim-core.md)
- [035-multi-actor-sessions.md](035-multi-actor-sessions.md)
- [037-coop-vs-slimes.md](037-coop-vs-slimes.md)
- [038-online-client-prediction.md](038-online-client-prediction.md)
