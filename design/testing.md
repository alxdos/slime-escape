# Testing

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-30 (story 032 prep: added Related link for the public multiplayer arena. Earlier: 2026-04-19.)

## Context

[web-stack.md](web-stack.md) defines where test code lives (`*.test.ts` next to the module) and the import rules between layers. The test runner and `package.json` command are not defined. The `game-coder` skill requires tests for invariants explicitly fixed in `design/` (determinism by `seed`, fixed step, immutable snapshots after publication, import directions, and so on). Story 002 already requires a test for the invariant "the character cannot leave arena bounds" ([arena-and-coordinates.md](arena-and-coordinates.md)). Without choosing a runner, every story will reopen the question, or the invariants will remain untested.

The runner is a dev/runtime dependency and a shared tool for future stories (003 — `CombatSystem`, 004 — determinism by `seed`, 006 — boss phases), so the decision is made once here.

## Decision

### Test runner

- The project test runner is `vitest`.
  - It works natively with Vite and `tsconfig.json` without a separate build and without `ts-jest`/`babel-jest`.
  - It supports ESM modules and `import.meta.url`, which the current stack relies on ([web-stack.md](web-stack.md)).
  - Minimal config: unit tests in `src/sim/**` and `src/shared/**` need no extra setup; `vitest.config.ts` is added only when needed (for example, separate test environments).
- `vitest` is added to `devDependencies` in `package.json`. This is the only new dev dependency justified by this decision; no other test-related packages (jsdom, happy-dom, testing-library, etc.) are introduced in the MVP. They will be added by separate decisions when needed (for example, for DOM tests of menu/HUD).

### Commands

- Add to `scripts` in `package.json`:
  - `test` — one-off run of all tests;
  - `test:watch` — watch mode for development.
- `typecheck` remains a separate command; `test` does not replace typecheck and must not duplicate it.

### Location and naming

- Test files live next to their modules and are named `<module>.test.ts`. This is already defined in [web-stack.md](web-stack.md); it is repeated here only for completeness.
- Tests follow the same import directions between layers ([web-stack.md](web-stack.md)): a test in `src/sim/**` does not import `src/main/**`; a test in `src/shared/**` imports neither `src/main/**` nor `src/sim/**`. This preserves the headless-simulation invariant and the reusable shared layer.
- Test environment is `node` (Vitest default). DOM-dependent code in the MVP is not covered by unit tests; those checks are handled manually through story acceptance.

### Required test coverage

- Any invariant explicitly fixed in `design/` and touched by a change must have a test that fails when the invariant is broken. Current minimum invariants:
  - simulation determinism by `seed` ([session-definition.md](session-definition.md)) once RNG exists;
  - fixed tick step and pause without wall-clock catch-up ([simulation-timing.md](simulation-timing.md));
  - immutable snapshot after publication ([thread-model.md](thread-model.md));
  - "entity cannot leave arena bounds" ([arena-and-coordinates.md](arena-and-coordinates.md));
  - simulation idle/running lifecycle and no ticks while idle ([runtime-systems.md](runtime-systems.md)).
- This list is not exhaustive: adding a new invariant in `design/` automatically creates an obligation to cover it with a test in the nearest change that touches it.

### Not required

- Internal implementation outside fixed invariants is tested **at the implementer's discretion**. Tests that only lock in helper-function shape and break on any refactor are bad tests and are not needed.
- No coverage gate is introduced. Coverage metrics can be useful as guidance, but not as a merge requirement.
- Snapshot/golden tests are allowed only where the result is stable and human-readable; updating a snapshot without explaining why is not allowed (this rule is promoted from the `game-coder` skill into design as mandatory).

### Determinism in tests

- Tests for determinism/time use only sources allowed by the project contract (explicit `seed`, `SimulationClock` with controlled ticking). `Math.random`, `Date.now`, and `performance.now` are forbidden in simulation-code tests by the same rules that apply to simulation itself ([session-definition.md](session-definition.md)).

### CI

- Automated CI is not introduced by this decision. Running tests before a PR is the implementer's responsibility under the `game-coder` checklist. Adding CI is a separate future decision.

## Consequences

- `package.json` gets exactly one new dev dependency (`vitest`) and two commands (`test`, `test:watch`).
- Stories that touch fixed invariants get one shared way to protect them, without reopening tool choice.
- The headless-simulation invariant is stronger: tests run in a node environment without DOM, so pulling DOM into `src/sim/**`/`src/shared/**` breaks the test run immediately.
- When DOM tests are needed (menu, HUD, input), that will be a separate decision on top of `vitest` (`jsdom`/`happy-dom` env or an e2e tool). No incidental test-stack additions.
- Cost: one dev dependency, minimal config, no gameplay-code changes.

## Related

- [web-stack.md](web-stack.md)
- [session-definition.md](session-definition.md)
- [simulation-timing.md](simulation-timing.md)
- [thread-model.md](thread-model.md)
- [runtime-systems.md](runtime-systems.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [impact-feedback.md](impact-feedback.md)
- [mobile-web-support.md](mobile-web-support.md)
- [camera-and-visible-area.md](camera-and-visible-area.md)
- [online-session-hosting.md](online-session-hosting.md)
