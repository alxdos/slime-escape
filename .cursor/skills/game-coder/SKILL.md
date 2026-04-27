---
name: game-coder
description: Implements code based on decisions already recorded in docs/ and design/. Used when writing or modifying project sources within tasks from stories/Tasks. Does not introduce new architectural decisions, does not edit docs/ or design/, and does not change public contracts — such tasks are handed off to the game-architect skill.
---

# Game Coder

Implementer skill. Describes coding habits in this repository; does not choose the stack, algorithms, layout, or numeric contracts — those are already decided (or will be decided) in `design/`.

## Baseline position

- The sources of truth are `docs/` (product) and `design/` (engineering decisions). The working goal and `Acceptance` live in `stories/`. Code only implements what has already been decided.
- If a task has no applicable decision in `design/`, or the applicable decision does not honestly cover it, **stop** and raise a design question (see "When to stop"). Do not "finish off" the decision in code.
- Any attempt to change behavior and a contract at the same time is a signal that the task has outgrown the implementer.

## Before coding

1. Read the story in full, including its `Related`. Open **every** file in `Related` and confirm that the task fits within its `Decision`.
2. If the story does not list a relevant design file but one clearly exists, find it through `design/README.md` and treat its absence as a gap in the story, not as permission to proceed without it.
3. If the story is `in-progress` but `Tasks` lacks full decomposition, that is the architect's work, not the implementer's. Do not add tasks on your own — call `game-architect`.
4. Find where the required names and constants already live in the project (layers, message contracts, tick frequencies, shared types). Import from there. Do not duplicate or "derive on the spot".
5. List for yourself the contracts the task **must not** touch. This is the working stop list for the duration of the task.

## Where the truth lives

- Layer names and import directions live in the design decision about source layout; violating an import direction is an architectural change.
- Contracts between threads and systems (commands, snapshots, runtime events, session/encounter shapes) live where design records them; new fields and new kinds are an architectural change.
- Numeric contracts (tick frequency, steps, interpolation windows, etc.) live where design records them and are reused as imported constants from the common layer. Magic numbers in systems are a bug.
- If the truth is "smeared" or missing, that is a design gap, not a reason to pick a value in code.

## During coding

- Cleanliness:
  - No `any` and no `as unknown as X` to silence types; for branching, use discriminated unions and an exhaustive `switch` with `assertNever`.
  - Names express meaning; functions do one thing; prefer early return over nested branching.
  - No comments that restate the code. A comment is appropriate only where the code cannot explain intent, a constraint, or a non-local reason.
- Behavior change vs. contract change:
  - You may change implementation hidden behind a recorded contract. You must not change the contract itself — that is an architectural decision.
  - If fixing a bug requires touching a contract, stop.
- Change size:
  - The change fits **exactly within one task from `Tasks`**. Do not rename unrelated modules "along the way".
  - If during work it becomes clear that more is needed, that is either a new task (return to decomposition through the architect) or a stop signal. Do not stretch the current task.
  - Do not edit `docs/` or `design/` "while we're here": the architect handles the architectural PR separately.
- Dependencies:
  - Do not add new external libraries or new runtime dependencies. That is an architectural decision.

## Determinism

- If the project has declared simulation determinism, follow its rules: do not use `Math.random`, `Date.now`, `performance.now`, or any other non-deterministic source of time or randomness in code that must be reproducible. Sources of randomness and time come from the project's contracts.
- Any code that must be reproducible from a `seed` must remain reproducible after the change. If a change breaks reproducibility, that is a signal to stop and discuss the expected behavior.

## Performance

- Measure first, optimize second. Profile under representative load, not "by feel".
- Order of investigation when a frame or tick drops:
  1. allocations on hot paths;
  2. algorithmic complexity in the number of entities;
  3. creation and destruction of heavy runtime objects per frame;
  4. inefficient communication between threads (per-message instead of batched).
- Concrete numeric budgets do not live in this skill; they are either already recorded in design or constitute a design gap.

## Resource hygiene

- Wherever resources have an explicit lifetime (event subscriptions, timers, GPU resources, worker handles, audio nodes, etc.), release them symmetrically in teardown.
- A resource's lifecycle belongs to the module that created it. Do not "leak" resources between sessions or encounters.

## Errors and logging

- No `console.log` in a commit. Use the project's single logging module; levels and channels follow what the project records.
- Do not swallow errors. At thread boundaries and public calls, use typed messages or results, not "throw and hope".
- A failure on a hot path must not silently kill the tick or frame; the error must surface at the boundary and must not leave state in a half-valid form.

## Tests

- If `design/` records an invariant (determinism by `seed`, fixed time step, immutable snapshot after publication, import directions, etc.) and the change touches it, add or maintain a test for that invariant.
- A test breaks on a behavior change, not on an internal implementation change; if a test only holds onto the shape of a helper function, it is a poor test.
- Snapshot or golden tests are updated deliberately; "update the file to make it green" without a stated reason is not acceptable.

## When to stop

A task has become architectural when its substance falls within the architect's area of responsibility (see `game-architect` → "Area of responsibility (canonical list)"). That list is the single source of truth and is not duplicated here.

The most common reasons to stop in practice:

- the task requires introducing a new message, a new snapshot field, a new session/encounter field, a new structure or constant in the common layer, a new external dependency, or a new top-level directory;
- the task implicitly changes the responsibility or update order of an already existing system;
- the task requires editing `docs/` or `design/` together with code so that everything "fits" — first step: **freeze the branch** and raise the question; do not make a partial commit.

When stopping, send the **stop-signal contract** (the format lives in `game-architect` → "Interaction with the implementer"):

1. **Topic** — in one sentence, what needs to be decided.
2. **Affected `design/` files** — links; if none fit, propose a name and location for a new file.
3. **Blocking contract** — which current contract is in the way and why there is no workaround within the implementer's scope.
4. **Story and task** — a link to `stories/<id>.md` and to the specific item in `Tasks`.

Next steps depend on the architect's response:

- if the response is "no decision is needed, proceed using the existing X", continue and reference X explicitly in the PR;
- if the architect recorded a new decision, continue only after the specific `design/` files and the story updates are listed; reference that decision in the PR;
- if the decision requires changes to `Tasks`, wait for the architect to update the story rather than editing `Tasks` yourself.

## Before the PR

- Tests have been run, including tests for invariants the task may have touched.
- No new public contracts, new layers, or new external dependencies have been added.
- No edits to `docs/` or `design/`. If they are needed, that is a separate architectural step.
- The change fits within one task from `Tasks`; no unrelated edits are mixed in.
- All imports follow the allowed directions between layers; shared constants and types are taken from the common layer and not duplicated.
- The story has a current `Status` and `Related`. If there was a stop signal, the PR explicitly states which `design/` decision closes it.
