# Multi-Actor Sessions

- Status: in-progress
- Created: 2026-04-30
- Updated: 2026-04-30 (architect prep: T1 design decisions recorded — `PlayerConfig` and `SessionDefinition.players[]`, `RuntimeInputState` per-player map, `submitInput(playerId, command)` host signature, multi-actor AI-targeting policy (deterministic nearest by squared distance, `playerId` lexicographic tie-break), multi-actor `lossCondition` semantics (`'playerDeath'` = any-died; `'allPlayersDead'` and `'respawnOnDeath'` recorded for stories 037/036, not implemented here), aggregated `RunSummaryTracker`, snapshot shape unchanged; explicit content-authoring rule that `content/sessions/*.md` continues to author one player per session and the build pipeline distributes it into `players: [<one>]`. Tasks broken down accordingly.)

## Product intent

Per [simulation-runtime.md](../design/simulation-runtime.md), the shared simulation core must support sessions with multiple controlled actors so that PvP arena, online co-op vs slimes, and any future online co-op campaign all run on the same engine. Today `SessionDefinition.player` is a single-player config and several systems implicitly rely on that singleness. This story generalizes the session shape and the systems that read it, while preserving the existing single-player local path as a session with exactly one actor — local campaign, training, and dungeon must continue to behave identically.

## Player-facing

- Sees: no immediate new game mode. Local single-player campaign, training, dungeon, and Public Arena PvP behave the same. The change is internal preparation that unlocks online co-op later.

## Technical

Architectural prep landed: `SessionDefinition.player: PlayerSpawn` and the top-level `loadout` are replaced by a non-empty `SessionDefinition.players: ReadonlyArray<PlayerConfig>` (per [session-definition.md](../design/session-definition.md)); `RuntimeInputState` becomes a map keyed by `PlayerConfig.id` (per [input-commands.md](../design/input-commands.md)); the host-facing `SimulationCore.submitInput(command)` becomes `submitInput(playerId, command)` (per [sim-core-interface.md](../design/sim-core-interface.md)); `MovementSystem`/`BossPhaseSystem`/`CompanionSystem` resolve "the player" via the recorded multi-actor AI-targeting policy under [runtime-systems.md](../design/runtime-systems.md); `lossCondition: 'playerDeath'` fires `loss` exactly once on the first player death (per [session-definition.md](../design/session-definition.md), [health-and-death.md](../design/health-and-death.md)); `RunSummaryTracker` aggregates across players and records `defeat` from the first dying player (per [session-result-summary.md](../design/session-result-summary.md)). Two further `lossCondition` kinds are recorded but **not implemented** here — `'allPlayersDead'` (consumer story 037) and `'respawnOnDeath'` (consumer story 036). Snapshot shape is unchanged; the existing main-side single-player UI keeps working because every local preset continues to emit `players: [<one>]`. Content authoring ergonomics are preserved per [content-authoring.md](../design/content-authoring.md): `content/sessions/*.md` continues to author one player per session at session level (`playerId`, `loadoutWeaponIds`, `selectedWeaponIndex`); the generator distributes those into the runtime `players[]` shape, and per-player MD override is **not** introduced by this story. Public Arena PvP is also not ported here — its current `server/src/arenaSimulation.ts` keeps running until story 036.

## Out of scope

- Node arena host (introduced in story 036).
- Replacing `server/src/arenaSimulation.ts`.
- New play modes (online co-op vs slimes) — that is story 037.
- Network protocol or transport changes.
- Per-player HUD, per-player camera, per-player visible area presentation in main UI.

## Acceptance

- Local single-player campaign, training, and dungeon sessions play through end-to-end without behavioral regression, expressed internally as a session with `players: [<one>]`.
- The shared simulation core can run a session with two controlled actors in a unit/integration test: both actors receive their own input by `playerId`, both produce projectiles, both can take damage, one can die while the other plays on.
- AI-targeting policy for multi-actor sessions is recorded in `design/` and covered by a deterministic test.
- Multi-actor `lossCondition` and `RunSummaryTracker` semantics are recorded in `design/`.
- All existing sim and main integration tests pass without behavioral changes.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [/] | Architectural PR — landed. Recorded: [session-definition.md](../design/session-definition.md) (`PlayerConfig`, `players[]`, `LossCondition` extensions, authoring-vs-runtime split), [input-commands.md](../design/input-commands.md) (per-player `RuntimeInputState`; browser worker `players[0].id` injection), [sim-core-interface.md](../design/sim-core-interface.md) (`submitInput(playerId, command)`), [runtime-systems.md](../design/runtime-systems.md) (multi-actor AI-targeting policy under `MovementSystem`; `'playerDeath'` first-death rule), [health-and-death.md](../design/health-and-death.md) (multi-actor player death and removal), [session-result-summary.md](../design/session-result-summary.md) (aggregated multi-actor `RunSummaryTracker`), [snapshot-shape.md](../design/snapshot-shape.md) (clarifying note; no field changes), [content-authoring.md](../design/content-authoring.md) (sessions area continues to author one player per session at session level; build pipeline distributes into `players: [<one>]`). | Architectural PR, no code. |
| T2 | [x] | Generalise shared types: `PlayerConfig`, `SessionDefinition.players[]`, drop `SessionDefinition.loadout`, `RuntimeInputState` per-player map, new `LossCondition` union members (types only — `'allPlayersDead'`/`'respawnOnDeath'` have no behaviour in 035). Update `SimulationCore.submitInput(playerId, command)`. Update content templates (`SessionPresetTemplate` in `src/shared/content/sessions.ts`) and the sessions generator (`scripts/content-build/sessions/**`) so existing presets keep their session-level authoring shape and emit `players: [<one>]` whose single `PlayerConfig` carries the session-level loadout. Update `buildSession.ts`. Update `src/sim/worker.ts` to inject `session.players[0].id` into every input message. **MD authoring shape stays unchanged** — no per-player override is added in this story. | Code PR, depends on T1. |
| T3 | [x] | Update systems for multi-actor reads: `MovementSystem` AI targeting (enemy chase fallback, boss chase), `BossPhaseSystem` boss-attack targeting, `CompanionSystem` orbit/threat/engage/ghost positions, `CombatSystem` per-player firing decisions and per-player loadout slot sync (iterate per-actor input map), `DropSystem` attraction (deterministic-nearest-player), `SessionFlowSystem.onPlayerDeath(entityId)` and the `'playerDeath'` first-death loss path, `HealthDeathSystem.removePlayer(id)`, `RunSummaryTracker.onDeath` recording the first dying player's cause, `EntityStore` API (`playerById(id)` and `players()` iterator alongside the existing single-player accessor). Wire `SimulationCore.onSessionStart` to spawn each player and load each player's loadout. | Code PR, depends on T2. |
| T4 | [x] | Add multi-actor coverage in `src/shared/sim/**`: (a) input fan-out by `playerId` produces independent movement, aim, and fire per actor; (b) both actors produce projectiles that can damage each other under `slimeFriendlyFire: true`; (c) one actor dies → `'playerDeath'` lossCondition publishes `loss` exactly once; the other actor's death does not republish. Plus a deterministic AI-targeting test: two players at known positions, one enemy at a third position; the enemy chases the nearer player, and tied positions resolve by `playerId` ascending lexicographic order. | Depends on T3. |
| T5 | [ ] | Regression: full automated check (root typecheck + tests, root build, server typecheck + tests, content drift check, sim import-boundary test). Manual smoke (campaign, training, dungeon) requested from the user — architect/coder do not start the dev server. | Depends on T4. |

## Related

- [simulation-runtime.md](../design/simulation-runtime.md)
- [session-definition.md](../design/session-definition.md)
- [runtime-systems.md](../design/runtime-systems.md)
- [input-commands.md](../design/input-commands.md)
- [sim-core-interface.md](../design/sim-core-interface.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [health-and-death.md](../design/health-and-death.md)
- [session-result-summary.md](../design/session-result-summary.md)
- [content-authoring.md](../design/content-authoring.md)
- [034-extract-sim-core.md](034-extract-sim-core.md)
- [036-node-arena-host.md](036-node-arena-host.md)
- [037-coop-vs-slimes.md](037-coop-vs-slimes.md)
- [038-online-client-prediction.md](038-online-client-prediction.md)
