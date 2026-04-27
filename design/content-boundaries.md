# Content Boundaries

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-23 (for story 011, added a back-reference to `content-authoring.md`: for areas governed by MD sources, `content library` literals are generated under the same layer-separation rules, without changing this document)

## Context

Runtime code must be separated from game content so new modes, enemy sets, and loadout restrictions are defined through data rather than conditional branches in logic. We also need to separate game data from persistent client settings, so user preferences do not mix with authoritative run state.

## Decision

- Separate four data levels:
  - `content library` — long-lived descriptions of game elements;
  - `session configuration` — description of a specific run;
  - `runtime state` — current mutable state in simulation;
  - `client settings` — persistent user preferences for the client.
- Store in the `content library`:
  - enemy archetypes;
  - weapon archetypes;
  - drop archetypes;
  - boss profiles;
  - arena parameters;
  - standard `ModePreset` values.
- Archetype shape (the fields of `EnemyArchetype`, `WeaponArchetype`, `DropArchetype`, minimal `Loadout`, and lookup rules by stable `id`) is defined in [content-archetypes.md](content-archetypes.md). References in `SessionDefinition`, `EncounterDefinition`, `SpawnPlan`, and runtime state use only `id`; `id → archetype` resolution happens once during session build/start.
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
- Store in `client settings`:
  - volume;
  - quality/render-scale policy;
  - UI-level preferences that do not affect simulation rules;
  - saved values for the next app launch.
- The `content library` must be read-only during a session.
- `SessionDefinition` is also immutable after session start.
- Any changes during gameplay apply only to `runtime state`.
- Builder functions may read the `content library` and user options, but their output must always be a new `SessionDefinition`.
- `client settings` are not part of `SessionDefinition`.
- `client settings` do not affect authoritative simulation state and must not change the outcome of a run with the same `seed`.
- `client settings` may affect audio mix, render backend policy, render scale, and other client-side presentation choices.
- Applying `client settings` happens on the `main thread` and in render/audio layers, not in gameplay runtime.

## Consequences

- It becomes easier to debug which issues come from content and which come from execution logic.
- There is a clean boundary between the mode we start and the state already unfolding inside the run.
- Debug-state serialization and run reproducibility through `seed` become simpler.
- Settings stories must not embed persistent preferences into the game session model.

## Related

- [session-definition.md](session-definition.md)
- [runtime-systems.md](runtime-systems.md)
- [content-archetypes.md](content-archetypes.md)
- [spawn-plan.md](spawn-plan.md)
- [drops.md](drops.md)
- [content-authoring.md](content-authoring.md)
