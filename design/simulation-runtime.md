# Simulation Runtime

- Status: accepted
- Created: 2026-04-30
- Updated: 2026-05-01 (story 036 prep: redirected references away from the now-deleted `public-multiplayer-arena.md` to the focused [online-session-hosting.md](online-session-hosting.md). The migration plan recorded under "Decision" is now historical: the Node arena host owns Public Arena PvP through the shared core, and `server/src/arenaSimulation.ts` is removed in story 036. Earlier: 2026-04-30 story 034 prep: corrected the "browser worker host lives under `src/main/**`" wording — the host is split across `src/main/sim/**` for the main-side connector and `src/sim/**` for the worker-context entry; concrete host-interface contract moved to its own file [sim-core-interface.md](sim-core-interface.md).)

## Context

Before story 036, the project had two parallel simulations: the rich runtime in `src/sim/**` driven by the browser simulation worker, and a compact reimplementation in `server/src/arenaSimulation.ts` driven by the Node arena server. The compact server simulation was the right first-slice choice for the Public Arena (story 032), but it did not scale to upcoming online modes. In particular, multi-player co-op against authored slime waves needs the full local-sim machinery — encounters, waves, zone, drops, boss phases, status effects, field effects, content-driven weapons, modifiers, retaliation, and run summary. Reimplementing that compactly on the server would have created a third sim, not solved the duplication.

This decision records the chosen direction: a single simulation core runs under two hosts. Concrete contracts (host interface, multi-actor `SessionDefinition` shape, online-specific session rules, AI targeting policy for multi-actor sessions) are deferred to subsequent decisions linked from this file as the corresponding stories enter work.

## Decision

- The simulation runtime is a single shared core. Its target physical location is `src/shared/sim/**`; the existing `src/sim/**` content moves there as part of the extraction story. The core owns all gameplay-authoritative state and rules: tick, systems, weapons, projectiles, hits, HP, deaths, drops, statuses, fields, encounters, boss phases, and snapshot export. The full per-system contract is in [runtime-systems.md](runtime-systems.md).
- The core has no host-specific dependencies. It must not reference `self`, `postMessage`, `Worker`, `setInterval`, browser globals, Node globals, Socket.IO, or any I/O. Host integration is provided through explicit input/output ports on the core.
- Two hosts run this core. The concrete host interface (factory shape, input methods, output ports, lifecycle relative to sessions) is recorded in [sim-core-interface.md](sim-core-interface.md):
  - **Browser simulation worker host** (browser context, used for all local play). Owns clock pumping, message-port input intake, snapshot/event delivery to `main`. Used by campaign, training, dungeon, and any future single-player or local content. The host is split across two files by physical execution context: the main-side connector lives in `src/main/sim/**`, and the worker-context entry (which uses `self.postMessage` / `self.addEventListener` and is referenced from `new Worker(new URL(...))`) lives in `src/sim/**`. The directory `src/sim/**` is reserved for this worker-context entry only — it must not contain system implementations or tick orchestration; those belong in the shared core. Layer rules are in [web-stack.md](web-stack.md).
  - **Node arena host** (Node context, used for all online modes). Owns clock pumping, Socket.IO input intake, per-socket snapshot/event fanout. Lives under `server/**`. Used by Public Arena and any future online mode (online co-op vs slimes, online co-op campaign).
- Local play continues to run in the browser worker host. The Node host is engaged only by online modes. Single-player offline play does not require a server, does not depend on network availability, and incurs no server cost.
- Online modes are sessions of the shared core with multiple controlled actors and online-specific session rules (friendly fire, respawn-on-death, kill→level→form chain in PvP, shared waves in co-op, etc.). They are not a separate runtime. Online-specific rules are expressed through existing session/encounter/loadout configuration where possible, and through narrowly scoped extensions to those configs where required.
- Story 036 retires the first-slice expedient from story 032 (`server/src/arenaSimulation.ts` and the provisional `public-multiplayer-arena.md`) and replaces it with the Node arena host running on the shared core, recorded in [online-session-hosting.md](online-session-hosting.md). New online behavior lives behind the `online-session-hosting.md` contract, in shared content, or as a recorded shared-engine extension — never as a parallel re-implementation in the server.
- Concrete contracts deferred to subsequent decisions, recorded as their stories enter work:
  - the host interface to the shared core (factory shape, input methods, output ports, lifecycle relative to sessions) — recorded in [sim-core-interface.md](sim-core-interface.md);
  - generalizing `SessionDefinition` and the systems to a list of controlled actors instead of a single player (input state map by `playerId`, AI targeting policy, `lossCondition` semantics for multi-player, run summary semantics for multi-player);
  - the Node host interface and its lifecycle relative to Socket.IO sockets, including how shared-core snapshots and events are fanned out per socket;
  - online-specific session rules expressed through existing session/encounter/loadout config rather than through host-specific code.
- The host contract for online play is recorded in [online-session-hosting.md](online-session-hosting.md), which replaces the provisional `public-multiplayer-arena.md` deleted in story 036.

## Consequences

- One source of truth for combat, hits, weapons, projectiles, drops, statuses, fields, encounters, boss phases, and run summary. Content authored in `content/**` reaches every play mode (local single, local future co-op-on-one-machine, online PvP, online co-op vs slimes) without per-mode reimplementation.
- Online co-op against authored slime content becomes a session-config exercise, not an engine exercise.
- Cost: one round of structural work — extracting the core from the worker host, generalizing session shape to multi-actor, building the Node host. The work is split into separate stories so the local single-player path is preserved through every transition.
- Server cost stays minimal: the Node host is required only when online modes are active. Local play continues to have no server dependency.
- The existing Public Arena protocol and snapshot delivery decisions stay valid through the transition. Story 033's snapshot-delivery cleanup (no interest filtering, snapshots carry only changing state) is independent of and compatible with this direction.
- The transition period with two simulations ended in story 036. New online behavior belongs in the Node host, shared content, or shared runtime systems, not in a parallel server-side simulation.

## Related

- [thread-model.md](thread-model.md)
- [runtime-systems.md](runtime-systems.md)
- [sim-core-interface.md](sim-core-interface.md)
- [session-definition.md](session-definition.md)
- [snapshot-shape.md](snapshot-shape.md)
- [simulation-timing.md](simulation-timing.md)
- [online-session-hosting.md](online-session-hosting.md)
- [content-boundaries.md](content-boundaries.md)
- [input-commands.md](input-commands.md)
- [web-stack.md](web-stack.md)
