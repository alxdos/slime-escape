# Logging

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-19

## Context

Several accepted decisions ([input-commands.md](input-commands.md), [runtime-systems.md](runtime-systems.md)) already state that some invalid situations (commands before `startSession`/after `stopSession`, `pause` without an active session) are reported "through the shared log module". The `game-coder` skill requires avoiding direct `console.log` calls and using a shared log module. The project has no such module and no contract for it, so each story would otherwise choose its own implementation and the shared rule "no `console.*` in committed code" would become unenforceable.

Logging is needed in both the `main thread` and the `simulation worker`, and must not pull in DOM or external runtime dependencies.

## Decision

### Module location

- The only logging channel lives in `src/shared/log.ts` ([web-stack.md](web-stack.md)) and is available to both `main` and `sim`. Parallel local loggers in `src/main/**` or `src/sim/**` are not allowed.
- The module has no external runtime dependencies: a thin wrapper over `console.*` is enough for the MVP. Replacing the backend (in-app overlay, telemetry sink) is a future decision, and this file is its entry point.

### API

- Export a `log` object with a fixed set of levels:
  ```ts
  log.info(msg: string, meta?: Record<string, unknown>): void;
  log.warn(msg: string, meta?: Record<string, unknown>): void;
  log.error(msg: string, meta?: Record<string, unknown>): void;
  ```
- There is intentionally no `debug` level: development-only printing is local and not committed.
- `meta` is an optional flat object of structured context (no functions, no cycles). The `msg` stays short and stable; all variable data goes into `meta`. This allows a future backend to filter and group events without parsing strings.
- Signatures are identical in `main` and `sim`.

### Channels and source identity

- `log` sets the output source from context: `[main]` for `src/main/**` and `[sim]` for `src/sim/**`. The exact mechanism (under-the-hood factories such as `createLog('main' | 'sim')` imported at entry level, or an explicit API argument) is an implementation detail hidden behind the public `log`. External code does not choose the source manually.
- The module does not add timestamps from `Date.now()`/`performance.now()` itself: browser console output already has them, and they must not enter deterministic simulation state ([session-definition.md](session-definition.md)).

### Usage rules

- Direct calls to `console.log`/`console.warn`/`console.error`/`console.info` are forbidden in source files under `src/**`. This is checked in review; a linter rule may enforce it later, but that is not part of this contract.
- Silently swallowing errors and warning conditions is forbidden: if a `design/` decision requires a warning (for example, command without an active session — [input-commands.md](input-commands.md), [runtime-systems.md](runtime-systems.md)), it goes through `log.warn`.
- Failures on hot paths (simulation tick, render frame) are caught at the module boundary, a structured message goes to `log.error`, and state is not left half-valid. This general rule is promoted from the `game-coder` skill into design as mandatory.
- `log.error` must not throw by itself and must not depend on a surrounding `try/catch`.

### Out of scope

- No serialization format is defined for `meta` in future sinks; for now it is console output.
- No ring buffer or in-app overlay is introduced; that can be added by a separate decision.
- No filtering policy is defined (production vs dev). All three levels print all the time; levels exist for future filtering, not for hiding output.
- Logging **does not** replace `runtime events` ([thread-model.md](thread-model.md)): events are the gameplay channel for HUD/audio, while log is an engineering channel. Their audiences and formats are different.

## Consequences

- Any system can call `log.warn`/`log.error` without knowing which thread it runs on and without introducing a local logger.
- Replacing the backend with an in-app overlay or telemetry later becomes a one-file change without touching system call sites.
- The ban on `console.*` becomes a checkable rule, not a chat agreement.
- Stories get one place for "engineering, not gameplay" information. This keeps `runtime events` from becoming a universal channel.
- Cost is minimal: one file, one object, no dependencies. Future replacement or extension remains cheap.

## Related

- [web-stack.md](web-stack.md)
- [thread-model.md](thread-model.md)
- [runtime-systems.md](runtime-systems.md)
- [input-commands.md](input-commands.md)
- [session-definition.md](session-definition.md)
