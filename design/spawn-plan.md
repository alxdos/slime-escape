# Spawn Plan

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-26 (story 021: intro delay — `SpawnSystem` does not materialize entities and does not advance internal plan state while encounter intro is active (`encounter.elapsedMs < encounter.introDurationMs`); full contract in [encounter-presentation.md](encounter-presentation.md). `SpawnPlan` and `SpawnOverride` shapes do not change. Earlier: 2026-04-25 story 019: per-`seq` entries in `'static'` and `'wave'` get optional `override?: SpawnOverride`; override shape and semantics are in [spawn-overrides.md](spawn-overrides.md). Earlier: 2026-04-23 static/boss builder fit refined to `contactBox` for `enemy` / `boss`; earlier: campaign break before boss, boss spawns top-center; `'boss'` kind for 006)

## Context

[session-definition.md](session-definition.md) states that every `EncounterDefinition` has a `spawnPlan` field executed by `SpawnSystem` ([runtime-systems.md](runtime-systems.md)), but does not define `SpawnPlan` shape or extension rules. Without an explicit contract:

- story 003 (training target) and story 004 (waves) will each reopen `spawnPlan` shape in their own way;
- story 006 (boss) will add another shape that may be incompatible with previous ones;
- `SpawnSystem` will start branching by concrete mode instead of data;
- any representation change will break several stories at once.

In `src/shared/session.ts`, `SpawnPlan = { kind: 'empty' }` is currently a sandbox stub from 002, not a contract.

## Decision

### SpawnPlan shape

- `SpawnPlan` is a discriminated union with a `kind` field. Extension happens by **adding** new `kind` values, not by changing existing fields.
- `kind` set as of 006:
  - `'empty'` — no spawns; `SpawnSystem` does nothing;
  - `'static'` — fixed spawn list executed once at encounter start;
  - `'wave'` — counted spawn budget with pace and max-alive limit, executed on ticks during the encounter;
  - `'boss'` — one spawn of one boss entity at encounter start ([boss-encounter.md](boss-encounter.md)).
- Future `kind` values are recorded in this same file as stories add them.
- Reusing a `kind` with changed semantics is forbidden; obsolete shapes go through `superseded`, like design decisions.

### Static spawn

- Shape:
  ```ts
  type StaticSpawnPlan = {
    kind: 'static';
    spawns: ReadonlyArray<{
      archetypeId: string;     // EnemyArchetype.id from content library
      position: { x: number; y: number };  // wu, entity center
      override?: SpawnOverride;            // see spawn-overrides.md
    }>;
  };
  ```
- Semantics:
  - the list runs **once** at encounter start;
  - execution order follows array order, giving stable `id` values under deterministic `SessionDefinition` build;
  - there are no repeated spawns or respawns;
  - `position` must be inside the arena ([arena-and-coordinates.md](arena-and-coordinates.md)); for `enemy`, the builder checks fit by full `contactBox`, not legacy `radius`, so static spawn cannot place a rectangular body outside arena bounds;
  - archetypes resolve through the `content library` ([content-archetypes.md](content-archetypes.md), [content-boundaries.md](content-boundaries.md));
  - `override` is optional "spawn context" for this concrete spawn (`guaranteedDrops`, `dropTable`, `retaliation`); shape, replace/add semantics, application timing, and validation are defined in [spawn-overrides.md](spawn-overrides.md). `SpawnSystem` materializes the override once at spawn time; after that, the runtime entity is indistinguishable from a spawn without override.

### Wave spawn

- Shape:
  ```ts
  type WaveSpawnPlan = {
    kind: 'wave';
    spawns: ReadonlyArray<{
      archetypeId: string;     // EnemyArchetype.id from content library
      override?: SpawnOverride;             // see spawn-overrides.md
    }>;
    spawnIntervalMs: number;   // > 0; minimum interval between two spawns from this plan
    maxAlive: number;          // > 0; max live entities spawned by this plan at once
    edgeMargin?: number;       // wu, >= 0; inset from the arena's inner edge when choosing position; default 0
  };
  ```
- Per-`seq` `override` is the only way `WaveSpawnPlan` carries "spawn context" (`guaranteedDrops`, `dropTable`, `retaliation`); the plan has no shared per-encounter override fields (see [spawn-overrides.md](spawn-overrides.md), "What must not be introduced locally in 019"). It is applied when materializing the entity through the same `SpawnSystem` mechanism as `'static'`.
- Semantics:
  - `spawns` is an ordered counted spawn budget; the plan **finishes dispatch** once all elements have been emitted and does not spawn again;
  - on each tick, `SpawnSystem` spawns **at most one** entity from the plan when all conditions are true:
    1. `dispatched < spawns.length`;
    2. `aliveFromThisPlan < maxAlive`;
    3. `simTime − lastSpawnSimMs >= spawnIntervalMs` (at encounter start, `lastSpawnSimMs = -∞`, so the first spawn can happen on the first tick);
  - `aliveFromThisPlan` is tracked by `SpawnSystem` through a death hook ([health-and-death.md](health-and-death.md)): when an entity spawned by this plan dies, the counter decreases. The "entity ↔ plan" link lives in internal `SpawnSystem` state (for example, `Set<EntityId>`), not as an entity field; this is an implementation detail;
  - archetype selection order from `spawns` is **strictly by index**: the first candidate tick takes `spawns[0]`, the second takes `spawns[1]`, and so on. This gives reproducibility by `seed` and leaves "wave composition" entirely content-driven;
  - each spawn position is chosen on the **arena perimeter** through session RNG ([rng.md](rng.md)), deterministically from `seed`. Algorithm: one `rng.nextFloat()` gives a normalized coordinate along the perimeter of the `arena` rectangle ([arena-and-coordinates.md](arena-and-coordinates.md)), inset inward by `edgeMargin + archetype.radius` so the spawned entity is guaranteed to fit inside safe bounds. `SpawnSystem` enforces this rule itself; `WaveSpawnPlan` has no explicit coordinates;
  - on `encounterEnd`, all wave state (`dispatched`, `aliveFromThisPlan`, `lastSpawnSimMs`, spawned entity indexes) is reset; unused budget does not carry between encounters.
- A wave plan **does not define** when the encounter ends. `SessionFlowSystem` decides "wave is over" through `transitionRules` ([session-definition.md](session-definition.md)); `allEnemiesCleared` is satisfied exactly when `dispatched == spawns.length && aliveFromThisPlan == 0`.
- `SpawnSystem` for `'wave'` is deterministic relative to `seed`: with the same `seed` and same tick sequence, spawn order and positions are identical. This is explicitly covered by tests under [testing.md](testing.md).

### Boss spawn

- Shape:
  ```ts
  type BossSpawnPlan = Readonly<{
    kind: 'boss';
    bossArchetypeId: string;          // BossArchetype.id from the bosses registry in content library
    position: { x: number; y: number }; // wu, boss entity center
  }>;
  ```
- Semantics:
  - executes **once** on `encounterStart`;
  - creates **exactly one** `kind: 'boss'` entity with `HasHealth`, initialized from `BossArchetype` ([content-archetypes.md](content-archetypes.md), [boss-encounter.md](boss-encounter.md));
  - `SpawnSystem` tracks this entity for `aliveFromThisPlan` the same way as for `'wave'`/`'static'`: boss death decrements the counter; under `allEnemiesCleared`, an encounter with `spawnPlan.kind: 'boss'` ends when the boss is dead and the plan expects no more spawns (for `'boss'`, this is equivalent to "boss killed");
  - `position` must be inside the arena ([arena-and-coordinates.md](arena-and-coordinates.md)); the builder checks fit by the boss's full `contactBox`, not by `radius`; for the campaign preset, the boss is placed **top-center** (x = 0, y = top band with an inset like the wave `edgeMargin`), not in the geometric center of the field;
  - there are no repeated per-tick spawns.

### SpawnSystem responsibility

- `SpawnSystem` executes the active encounter's `spawnPlan` and nothing else:
  - it does not decide `winCondition`/`lossCondition` ([session-definition.md](session-definition.md));
  - it does not manage encounter transitions; that is `SessionFlowSystem` ([runtime-systems.md](runtime-systems.md));
  - it does not own HP, cooldowns, or enemy behavior; other systems do.
- Lifecycle:
  - on `encounterStart`, `SpawnSystem` initializes for the current `spawnPlan`;
  - further spawn logic (for `'wave'`, etc.) runs inside the normal update tick per [runtime-systems.md](runtime-systems.md);
  - on `encounterEnd`, all internal `SpawnSystem` state resets; unused plan budget does not carry between encounters.
- All spawns go through `EntityStore` (see [runtime-systems.md](runtime-systems.md)); `SpawnSystem` does not create entities outside the store.
- `SpawnSystem` is deterministic relative to the session `seed`: the only randomness source is session RNG ([rng.md](rng.md)). `Math.random` is forbidden ([session-definition.md](session-definition.md)).

### Intro delay

- If the active encounter has `encounter.introDurationMs > 0` and `encounter.elapsedMs < encounter.introDurationMs` (intro is active per [encounter-presentation.md](encounter-presentation.md)):
  - a `'wave'` plan does not spawn entities on this tick and does not update `lastSpawnSimMs`. `dispatched`, `aliveFromThisPlan`, and the next `spawns[i]` index do not change. On the first tick after intro ends, the plan starts as if the encounter had just begun: the condition `simTime − lastSpawnSimMs >= spawnIntervalMs` for the first spawn is guaranteed true (`lastSpawnSimMs = -∞`);
  - a `'static'` plan delays its one "spawn-on-encounter-start" pass until the first tick where intro has ended. Order/positions are preserved because materialization depends deterministically on `seed` and the `spawns` array, not on `simTime`;
  - a `'boss'` plan is incompatible with `introDurationMs > 0` by the paired constraints in [encounter-presentation.md](encounter-presentation.md), so delay does not apply here;
  - `'empty'` is a no-op either way and needs no additional action.
- After intro ends, `SpawnSystem` continues the normal tick loop; there is no catch-up or compensation for skipped intervals. This gives predictable wave pacing measured from the actual start of spawning, not from `encounterStart`.
- Determinism by `seed` is preserved: intro changes only the simulation-time moment of the first spawn, not the sequence of `SpawnSystem` RNG calls.

### Extension and backward compatibility

- A new `kind` must be defined in a separate section of this file, with its own field and behavior description.
- `SpawnSystem` must explicitly reject unknown `kind` values through `assertNever` (see [web-stack.md](web-stack.md), `src/shared/protocol.ts`); silent ignore is forbidden.
- If an existing shape must be replaced (for example, simplifying `'wave'`), the old `kind` is marked deprecated in this file and removed in one PR together with all `content/` usages.

## Consequences

- `SpawnSystem` appears already in 003, but in the minimal form "execute a static list"; story 004 extends the system with `'wave'` kind instead of introducing a new one.
- Wave content (archetype order and composition) is fully content-driven; gameplay wave numbers (pace, limit) are plan fields, not constants in system code.
- Perimeter spawn positions are fully deterministic by `seed`: reproducibility tests compare `(archetypeId, position)` lists for two runs with the same `seed`.
- `EncounterDefinition.spawnPlan` remains a stable top-level field and evolves only through new `kind` values.
- Sandbox encounters are no longer hard-bound to "zero content": bring-up stories can spawn training entities through `'static'` without violating sandbox semantics (see update in [session-definition.md](session-definition.md)).
- Training and tutorial mode content is expressed as data in the `content library`, not branches in runtime code.

## Related

- [session-definition.md](session-definition.md)
- [runtime-systems.md](runtime-systems.md)
- [content-archetypes.md](content-archetypes.md)
- [content-boundaries.md](content-boundaries.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [rng.md](rng.md)
- [health-and-death.md](health-and-death.md)
- [testing.md](testing.md)
- [web-stack.md](web-stack.md)
- [boss-encounter.md](boss-encounter.md)
- [spawn-overrides.md](spawn-overrides.md)
- [encounter-presentation.md](encounter-presentation.md)
