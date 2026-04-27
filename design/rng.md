# Session RNG

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-19 (for story 005, `DropSystem` is recorded as the second consumer of session RNG: one `nextFloat` for the dropTable roll when an enemy dies)

## Context

[session-definition.md](session-definition.md) states that `seed` is the only source of RNG determinism in simulation, and that nondeterministic time/randomness sources (`Math.random`, `Date.now`, `performance.now`) are forbidden in code that must be reproducible. [spawn-plan.md](spawn-plan.md) further requires every random choice in `SpawnSystem` (for example, spawn position for future `kind` values) to use session RNG rather than `Math.random`. [testing.md](testing.md) includes "simulation determinism by `seed`" among required invariants under test.

At the same time, the project has no RNG source yet:

- story 004 (waves) is the first to truly need randomness — choosing a spawn position on the arena perimeter and choosing from `wave.spawns` may require `rng.nextFloat()` or `rng.nextInt(n)`;
- story 006 (boss) will add randomness to phase attack selection;
- without an explicit contract, each system will reopen which PRNG to use, how to seed it, and where its state lives.

This decision defines one shared session RNG model so all systems use the same randomness channel.

## Decision

### Algorithm

- The session RNG algorithm is `mulberry32`. It is a 32-bit seedable PRNG implemented as one short function, with no external dependencies and a stable known sequence.
- The choice is based on three properties:
  - deterministic from one `uint32` `seed`, exactly the shape carried by `SessionDefinition.seed`;
  - no external dependencies and works identically in `main` and `sim` (matching [web-stack.md](web-stack.md));
  - stable sequence across runs and implementations, which is enough to reproduce gameplay invariants; the project does not need cryptographic properties.
- Alternatives (`xorshift32`, `splitmix32`, `pcg32`) were considered and rejected as unnecessary: mulberry32 has sufficient distribution quality for gameplay randomness and a shorter implementation.

### Location and API

- Implementation lives in `src/shared/rng.ts` ([web-stack.md](web-stack.md)). It can be imported from both `src/main/**` and `src/sim/**` without violating import directions.
- Public API:
  ```ts
  type Rng = Readonly<{
    nextUint32(): number;          // [0, 2^32)
    nextFloat(): number;           // [0, 1)
    nextInt(maxExclusive: number): number; // integer in [0, maxExclusive); maxExclusive > 0
    nextRange(min: number, maxExclusive: number): number; // float in [min, maxExclusive)
  }>;

  function createRng(seed: number): Rng;
  ```
- `nextInt` and `nextRange` are derived from `nextUint32`/`nextFloat`. They do not introduce separate algorithms and must not reopen RNG shape.
- An `Rng` instance is **stateful**: every `nextUint32` call advances internal state. Reproducibility is guaranteed over the same call sequence.

### Lifecycle and ownership

- Each session creates **exactly one** `Rng`. `SessionFlowSystem` ([runtime-systems.md](runtime-systems.md)) creates it on `startSession`, directly from `SessionDefinition.seed`. On `stopSession`, the instance is discarded with the rest of runtime state.
- Systems that need RNG receive it as a dependency; they do not create their own and do not seed locally. For the MVP horizon:
  - `SpawnSystem` (story 004): one `nextFloat` per spawn in a `'wave'` plan to choose the normalized coordinate on the arena perimeter ([spawn-plan.md](spawn-plan.md));
  - `DropSystem` (story 005): one `nextFloat` for a dropTable roll when the death hook fires for `entityKind === 'enemy'` with a non-empty `dropTable`; an empty table does not advance RNG ([drops.md](drops.md)).
- RNG call order within one tick is defined by update order ([runtime-systems.md](runtime-systems.md)): first `SpawnSystem` (if it spawns on that tick), then `DropSystem` inside the death hook from `HealthDeathSystem`. This order is stable and explicit; new RNG consumers added by separate decisions must define their place in this sequence here as well, so reproducibility by `seed` remains testable.
- If a system needs a randomness branch isolated from the main one (for example, a separate stream for tests), that is handled as a **separate decision** with an explicit sub-stream, not as `createRng(rng.nextUint32())` inside system code.
- There is no module-global state inside `Rng`. Static singletons such as `globalRng` are forbidden; they would break determinism between sessions and make system initialization order meaningful.

### Bans and invariants

- In `src/sim/**` and code executed on the simulation tick, the following are forbidden:
  - `Math.random()`;
  - `Date.now()`, `performance.now()`, `Date()` for gameplay logic;
  - any source that cannot be reduced to `SessionDefinition.seed`.
- This rule is already implied by `session-definition.md`; here it becomes a concise review check: `Math.random` appearing in `src/sim/**` or `src/shared/**` (outside `src/shared/rng.ts`) violates this decision.
- In `src/main/**`, `Math.random` is allowed only for purely visual effects that **do not** affect authoritative state and do not enter snapshots/events (for example, decorative particle drift). This does not apply to gameplay.
- Tests use `createRng(seed)` directly and do not mock it, so the invariant "same `seed` -> same gameplay event sequence" is tested for real rather than simulated.

### Extension

- Adding new derived methods (`nextBool(p)`, `pickWeighted(items, weights)`) is allowed in `src/shared/rng.ts` without a separate decision if they are expressed through `nextUint32`/`nextFloat` without changing the base algorithm.
- Replacing the algorithm itself (for example, switching to `pcg32`) is a change to this decision and is handled through `superseded`. This automatically invalidates any recorded golden test sequences; such tests should be expressed through invariants, not exact numbers.

## Consequences

- Randomness gets one source of truth, and the invariant "same `seed` -> same course of events" becomes testable.
- `SpawnSystem` (004), `DropSystem` (005), and any future system using randomness receive `Rng` as an explicit dependency; their determinism is visible from the constructor, not hidden in an import.
- The ban on `Math.random` in `src/sim/**` gets one concrete exception location (`src/shared/rng.ts`), which simplifies review.
- Cost is minimal: one file, one function, no runtime dependencies. Replacing the RNG backend later affects only this file and tests that rely on exact values.

## Related

- [session-definition.md](session-definition.md)
- [runtime-systems.md](runtime-systems.md)
- [spawn-plan.md](spawn-plan.md)
- [drops.md](drops.md)
- [web-stack.md](web-stack.md)
- [testing.md](testing.md)
- [impact-feedback.md](impact-feedback.md)
