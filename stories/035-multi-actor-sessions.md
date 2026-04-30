# Multi-Actor Sessions

- Status: planned
- Created: 2026-04-30
- Updated: 2026-04-30

## Product intent

Per [simulation-runtime.md](../design/simulation-runtime.md), the shared simulation core must support sessions with multiple controlled actors so that PvP arena, online co-op vs slimes, and any future online co-op campaign all run on the same engine. Today `SessionDefinition.player` is a single-player config and several systems implicitly rely on that singleness. This story generalizes the session shape and the systems that read it, while preserving the existing single-player local path as a session with exactly one actor — local campaign, training, and dungeon must continue to behave identically.

## Player-facing

- Sees: no immediate new game mode. Local single-player campaign, training, dungeon, and Public Arena PvP behave the same. The change is internal preparation that unlocks online co-op later.

## Technical

Generalize `SessionDefinition.player: PlayerConfig` to `SessionDefinition.players: PlayerConfig[]` (or an equivalent actors list), and `RuntimeInputState` to a map keyed by `playerId`. Pick and record an AI-targeting policy for behavior-driven enemies in a multi-actor world (working assumption: deterministic nearest-by-squared-distance with `playerId` lexicographic tie-break, mirroring existing deterministic rules elsewhere). Extend `lossCondition: 'playerDeath'` semantics to cover multi-actor cases (any-died / all-died / respawn-each); this is a recorded design decision with its rationale, not an inline choice. Decide and record multi-actor semantics for `RunSummaryTracker` (per-actor / shared / disabled). The shared simulation core consumes the new shape directly; local play continues to work as a session with `players: [<one>]`. Public Arena PvP is **not** ported in this story — its current `server/src/arenaSimulation.ts` keeps running until story 036.

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
| T1 | [ ] | Record the multi-actor extensions in `design/`: update [session-definition.md](../design/session-definition.md), [runtime-systems.md](../design/runtime-systems.md), [health-and-death.md](../design/health-and-death.md) (multi-actor `lossCondition`), [session-result-summary.md](../design/session-result-summary.md) (multi-actor run summary), and add or extend the AI-targeting policy decision (likely an extension of an existing file rather than a new one). | Architectural PR. |
| T2 | [ ] | Generalize `SessionDefinition` and `RuntimeInputState` shapes in shared types. | Code PR, depends on T1. |
| T3 | [ ] | Update `MovementSystem` AI targeting, `SessionFlowSystem` loss-condition handling, `RunSummaryTracker`, and any other system that reads "the player" to read from the actors list. | Code PR, depends on T2. |
| T4 | [ ] | Add a multi-actor unit/integration test in the shared sim layer covering input fan-out by `playerId`, mutual damage, and one-actor-dies-other-plays-on. | Depends on T3. |
| T5 | [ ] | Regression: run all existing sim and main integration tests, plus a manual campaign/training/dungeon pass. | |

## Related

- [simulation-runtime.md](../design/simulation-runtime.md)
- [session-definition.md](../design/session-definition.md)
- [runtime-systems.md](../design/runtime-systems.md)
- [input-commands.md](../design/input-commands.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [health-and-death.md](../design/health-and-death.md)
- [session-result-summary.md](../design/session-result-summary.md)
- [034-extract-sim-core.md](034-extract-sim-core.md)
