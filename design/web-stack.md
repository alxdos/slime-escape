# Web Stack

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-23 (for story 011, explicitly recorded that build-time tools live outside `src/**`; permission for the root-level `scripts/` directory is covered by a separate decision, `content-authoring.md`)

## Context

The game runs in the browser and must keep both a `main thread` with DOM/UI/audio/rendering and a `simulation worker` (see [thread-model.md](thread-model.md)). The build stack, language, and source layout must be chosen once and remain stable for the project, because changing them later would touch all stories, the worker entry point, and message contracts at the same time. The project is also open source, so the entry barrier for judges and contributors should stay low.

## Decision

- Bundler: `Vite`.
  - Native TypeScript support without a separate compile step.
  - ESM workers through `new Worker(new URL(...), { type: 'module' })`; this is the same shape needed for `010` (render worker through `OffscreenCanvas`) without a separate worker bundler.
  - Simple dev server with HMR for main code and automatic worker rebuilds.
  - Static build: `npm run build` -> `dist/`, deployed as a regular static site.
- Language: `TypeScript` with `strict: true`.
  - A typed `main ↔ sim` protocol is required by [thread-model.md](thread-model.md); without static typing, it degrades into comments and loses value.
  - `noImplicitAny`, `strictNullChecks`, and `noUncheckedIndexedAccess` are enabled.
- Package manager: `npm`.
  - The project is open source for a contest; anyone with Node already has npm, with no extra step.
  - The lockfile is `package-lock.json` and is committed to the repository.
  - Migration to `pnpm` or `yarn` remains possible later without changing source code.
- Source layout is by layer, not by feature:
  - `src/main/**` — everything that lives on the `main thread`: bootstrap, render, DOM/HUD, audio, feature detection, and worker host wrappers.
  - `src/sim/**` — the `simulation worker`: clock, runtime systems, world, and worker entry point.
  - `src/shared/**` — types and pure utilities allowed in both contexts: message protocol, snapshot types, shared constants, and math.
- Inside `src/shared/**`, two named subfolders are reserved with fixed roles:
  - `src/shared/content/**` — the `content library` ([content-boundaries.md](content-boundaries.md)): enemy and weapon archetypes, boss profiles, arena parameters, drop tables, standard `ModePreset` values, and builder functions for `ModePreset + options → SessionDefinition`. It contains only data and pure functions, with no runtime state and no DOM/three.js.
  - Other `src/shared/**` modules (protocol, snapshot, shared constants, math) may sit next to `content/`.
- Import rules between layers:
  - `src/sim/**` must not import from `src/main/**`.
  - `src/shared/**` must not import from `src/main/**` or `src/sim/**`.
  - `src/main/**` may import from `src/shared/**`; `src/sim/**` may import from `src/shared/**`.
  - This gives one invariant: the `simulation worker` stays headless, the shared contract does not pull in DOM/three.js, and any code in `src/shared/**` (including `src/shared/content/**`) is safe in any context.
- The `content library` physically lives in `src/shared/content/**` because both `main` (for building `SessionDefinition` in UI and configuring camera/rendering for the arena) and `sim` (for executing `spawnPlan`, reading arena parameters, and so on) need to read it. Putting it in `src/main/**` or `src/sim/**` would require duplication or would violate import direction rules.
- The worker entry point is the single file `src/sim/worker.ts`. Main connects to it as follows:
  ```ts
  new Worker(new URL('../../sim/worker.ts', import.meta.url), { type: 'module' })
  ```
- Test and debug code, if added, lives next to the module (`*.test.ts`) and must not violate layer import rules. The concrete test runner and commands are defined in [testing.md](testing.md).
- All runtime-critical numeric constants for ticks, frequencies, and similar values live in `src/shared/**` (see [simulation-timing.md](simulation-timing.md)) instead of being duplicated across systems.

## Consequences

- There is one source of truth for scaffolding; future stories add files only inside the layers already defined here.
- The inter-thread contract naturally belongs in `src/shared/**` and does not depend on the chosen render backend.
- Stack migration (Vite -> another bundler, npm -> pnpm) is possible without rewriting gameplay code, but requires updating this decision at the same time.
- Stories must not introduce new root directories on their own (`src/render`, `src/game`, and so on); extensions happen only inside `main`, `sim`, and `shared`.
- Reserved subfolders such as `src/shared/content/**` (and any analogues added later) are defined here to avoid creating local contracts inside individual stories.

## Related

- [thread-model.md](thread-model.md)
- [content-boundaries.md](content-boundaries.md)
- [simulation-timing.md](simulation-timing.md)
- [session-definition.md](session-definition.md)
- [testing.md](testing.md)
- [logging.md](logging.md)
- [content-authoring.md](content-authoring.md)
