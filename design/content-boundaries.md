# Content Boundaries

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-30 (story 032 prep: added Related link for the public multiplayer arena. Earlier: 2026-04-29 story 030 prep: selected pet can enter simulation only through explicit `SessionDefinition.companion` built for a companion-enabled run; combat numbers remain session configuration, not client progression. Earlier: 2026-04-28 story 029 prep: add `client progression` as a separate persistent browser data level for XP, owned pets, and selected companion; it is not `client settings` and does not enter simulation in the first pet story. Earlier: 2026-04-23 for story 011, added a back-reference to `content-authoring.md`: for areas governed by MD sources, `content library` literals are generated under the same layer-separation rules, without changing this document.)

## Context

Runtime code must be separated from game content so new modes, enemy sets, and loadout restrictions are defined through data rather than conditional branches in logic. We also need to separate game data from persistent client settings, so user preferences do not mix with authoritative run state.

## Decision

- Separate five data levels:
  - `content library` — long-lived descriptions of game elements;
  - `session configuration` — description of a specific run;
  - `runtime state` — current mutable state in simulation;
  - `client progression` — persistent local player progress and collection state stored by the browser;
  - `client settings` — persistent user preferences for the client.
- Store in the `content library`:
  - enemy archetypes;
  - weapon archetypes;
  - drop archetypes;
  - boss profiles;
  - pet archetypes and pet economy tuning;
  - arena parameters;
  - standard `ModePreset` values.
- Archetype shape (the fields of `EnemyArchetype`, `WeaponArchetype`, `DropArchetype`, `PetArchetype`, minimal `Loadout`, and lookup rules by stable `id`) is defined in [content-archetypes.md](content-archetypes.md). References in `SessionDefinition`, `EncounterDefinition`, `SpawnPlan`, persistent progression, and runtime state use only `id`; `id → archetype` resolution happens at the layer boundary that needs the data, such as session start or main-thread presentation.
- "Drop tables" are not a separate entity with their own `id`: one table is the `dropTable: ReadonlyArray<DropTableEntry>` field on `EnemyArchetype` (see [content-archetypes.md](content-archetypes.md)). Drop selection and lifecycle rules live in [drops.md](drops.md). If future work needs shared tables between enemies, that will be a separate decision (`dropTableId` on top of the existing field), not an in-place addition.
- Store in `session configuration`:
  - selected preset;
  - `SessionDefinition`;
  - user-selected modifiers;
  - derived tuning for the specific run.
- Store in `runtime state`:
  - live entities;
  - current HP, cooldowns, positions, and timers;
  - the active `encounter`;
  - wave progress;
  - active drop objects;
  - internal RNG states and runtime flags.
- Store in `client progression`:
  - total XP earned from completed eligible runs;
  - owned pet ids;
  - selected pet id, or explicit `null` for no companion;
  - local records such as Dungeon best wave when a story defines them as local browser progress.
- `client progression` lives on the main thread. It may be persisted through versioned browser storage and may be read by UI, result presentation, and renderer presentation setup.
- `client progression` is not `client settings`: it records player progress, not preferences like volume or render scale.
- In story 029, selected pet progression is presentation-only. It may be passed from `UiShell` to `Renderer` to show a companion, but it must not be passed to `SimWorkerHost.startSession`, `SessionDefinition`, snapshots, runtime events, or combat systems.
- If a future pet story makes companions affect combat, that will require an explicit `SessionDefinition`/runtime decision so the selected pet becomes authoritative session configuration instead of hidden main-thread state.
- In story 030, that future decision is [companion-combat.md](companion-combat.md): the selected pet id may be read from `client progression` by the session builder, but the simulation receives only `SessionDefinition.companion`. Pet combat HP, weapon availability, boop, rescue, contact shape, and movement tuning are session configuration, not progression fields.
- Store in `client settings`:
  - volume;
  - quality/render-scale policy;
  - UI-level preferences that do not affect simulation rules;
  - saved values for the next app launch.
- The `content library` must be read-only during a session.
- `SessionDefinition` is also immutable after session start.
- Any changes during gameplay apply only to `runtime state`.
- Builder functions may read the `content library` and user options, but their output must always be a new `SessionDefinition`.
- `client progression` is not copied wholesale into `SessionDefinition`.
- A selected pet id can affect gameplay only after the builder validates it and emits an explicit session-owned companion config. If `SessionDefinition.companion === null`, the selected pet id has no simulation effect.
- `client settings` are not part of `SessionDefinition`.
- `client settings` do not affect authoritative simulation state and must not change the outcome of a run with the same `seed`.
- `client settings` may affect audio mix, render backend policy, render scale, and other client-side presentation choices.
- Applying `client settings` happens on the `main thread` and in render/audio layers, not in gameplay runtime.

## Consequences

- It becomes easier to debug which issues come from content and which come from execution logic.
- There is a clean boundary between the mode we start and the state already unfolding inside the run.
- Debug-state serialization and run reproducibility through `seed` become simpler.
- Settings stories must not embed persistent preferences into the game session model.
- Progression stories get a separate local persistence lane without reclassifying XP, collections, or records as settings.

## Related

- [session-definition.md](session-definition.md)
- [runtime-systems.md](runtime-systems.md)
- [content-archetypes.md](content-archetypes.md)
- [spawn-plan.md](spawn-plan.md)
- [drops.md](drops.md)
- [content-authoring.md](content-authoring.md)
- [main-ui-shell.md](main-ui-shell.md)
- [companion-combat.md](companion-combat.md)
- [../stories/029-xp-and-pet-companions.md](../stories/029-xp-and-pet-companions.md)
- [../stories/030-companion-combat-and-rescue.md](../stories/030-companion-combat-and-rescue.md)
- [online-arena-hosting.md](online-arena-hosting.md)
