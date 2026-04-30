# Session Definition

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-30 (story 031 prep: session build may receive an explicit `arenaOverride` from mobile web support; the final `SessionDefinition.arena` remains immutable and authoritative. Earlier: 2026-04-29 story 030 prep: `SessionDefinition` gets `companion: CompanionSessionConfig | null`; selected pet identity and all companion combat tuning are explicit immutable session config. Earlier: 2026-04-28 story 028 prep: `winCondition` adds `dungeon`, an endless authored-encounter loop that never emits automatic `win`, increments a run-level wave ordinal across loop iterations, and ends through `lossCondition: playerDeath`; the player-facing Dungeon preset is recorded here. Earlier: 2026-04-27 story 026 prep: `EncounterDefinition.type` adds `portal` for Vibe Jam portal presentation encounters, and the hidden `portal` preset is recorded as a supported mode with a transparent opening portal before normal boss completion; full contract in [vibe-jam-portals.md](vibe-jam-portals.md). Earlier: 2026-04-26 story 021: `SessionDefinition` gets a required `musicSampleId: string | null` field; `EncounterDefinition` gets required presentation fields `introDurationMs`/`name`/`text`; their shape, type-paired constraints, and intro delay contract are defined in [encounter-presentation.md](encounter-presentation.md); `musicSampleId` validation is in [audio.md](audio.md). Earlier: 2026-04-25 story 019: per-`seq` entries in `'static'`/`'wave'` `spawnPlan` carry optional `SpawnOverride`, with shape and semantics in [spawn-overrides.md](spawn-overrides.md); `EncounterDefinition` does not change structurally. Earlier: 2026-04-24 cleanup pass: legacy `{ primaryWeaponArchetypeId }` `loadout` no longer mentioned as a current shape; only the ordered form remains. 017 alignment: `loadout` becomes the ordered universal weapon loadout and `rules.damage.slimeFriendlyFire` is the session-owned friendly-fire toggle; see [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). Earlier: story 015 backgrounds/session MD, player contactBox, boss win condition, zone/transition rules, and player maxHp.)

## Context

The game runtime must run an externally defined session, not one hardcoded scenario. This is needed for the base campaign, training, challenge modes, and future variants without rewriting `core runtime`.

## Decision

- `core runtime` does not know about a concrete scenario such as "3 waves, then a boss".
- Every run is described by a `SessionDefinition` object.
- `SessionDefinition` is assembled externally from `ModePreset`, user options, and the `content library`.
- Environment options that affect the final run must be applied during session build, before runtime receives `SessionDefinition`. Story 031 adds one such option: `arenaOverride?: ArenaConfig`, used only by [mobile-web-support.md](mobile-web-support.md). When present, it replaces the preset arena for the final session and is used for validation and derived spawn positions.
- `ModePreset` defines the default shape of a mode, but is not an authoritative runtime object.
- User options and challenge restrictions modify the preset during session build; runtime receives only the resulting `SessionDefinition`.
- Base `SessionDefinition` fields:

```js
{
  id,
  seed,
  arena,
  player,
  companion,
  loadout,
  backgrounds,
  musicSampleId,
  modifiers,
  encounters,
  rules,
  winCondition,
  lossCondition,
  uiMeta
}
```

- `encounters` is an ordered list of `EncounterDefinition`.
- `backgrounds` is a session-level table of visual backgrounds available to encounters. Each item has shape `{ id: string; imageUrl: string }`, where `imageUrl` is already a public-relative URL (`/images/bg/...`) from the content library. The list is immutable during a session, like the other `SessionDefinition` fields.
- `musicSampleId` is the session-level selection for regular (non-boss) music. The value is either `null` (silent regular music for the whole session, for example sandbox/dev modes) or a string sampleId that must exist in `SampleRegistry` with `category: 'music'`; validation and playback rules (boss override, pause ducking, loop) are defined in [audio.md](audio.md). The field is required and immutable during the session; the builder must set either `null` or a known music sampleId. Missing field or unknown id are forbidden by the same "no two ways to say no data" rule as other required fields.
- After session start, `SessionDefinition` is considered an immutable runtime contract.
- Stable parts of the contract are the top-level field names, the general meaning of `EncounterDefinition`, and the `winCondition` / `lossCondition` models.
- Internal structures such as `spawnPlan`, `rewardRules`, and `tuning` may evolve as long as they do not break the top-level session assembly model.
- Minimal required field shape:
  - `arena` — rectangle `{ width, height }` in world units (see [arena-and-coordinates.md](arena-and-coordinates.md)). Concrete values are defined in the `content library` ([content-boundaries.md](content-boundaries.md)).
  - `player` is the initial player description as `{ position: { x, y }, radius, contactBox, maxSpeed, maxHp }`, where coordinates and sizes are in world units, speed is in world units per second, and `maxHp` is an integer > 0 (source of `HasHealth` from [health-and-death.md](health-and-death.md)). `contactBox` is the axis-aligned body footprint for body contact and player clamp per [body-contact-boxes.md](body-contact-boxes.md). For presets where the player is not damageable (sandbox without combat), `maxHp` is still set explicitly; omitting the field is forbidden by the same "no two ways to say no data" rule as other required fields. Additional fields (status effects, inventory) may be added by separate decisions without breaking the top-level model.
  - `companion` is either `null` or a `CompanionSessionConfig` from [companion-combat.md](companion-combat.md). It is the only simulation-visible way for selected pet progression to affect a run. The field is required: `null` means no runtime companion, while an object means the session starts one companion entity with session-owned HP, contact shape, movement tuning, weapon availability, boop, and rescue rules.
  - `seed` — integer value, the only source of RNG determinism in simulation; nondeterministic time/randomness sources outside `seed` are forbidden.
  - `id` — stable string session identifier for logs and debug.
- `loadout`, `modifiers`, `rules`, and `uiMeta` remain in the contract as stable names; their internal shape and requiredness depend on the preset and may evolve. The builder must explicitly set a meaningful value, `null`, or an empty object; omitting the field itself is forbidden so consumers do not need to distinguish two forms of "no data".
- Minimal `loadout` shape:
  - `null` — the preset has no built-in weapon (sandbox without combat, pure exploratory bring-up);
  - `Loadout` — the preset has at least one weapon; `Loadout` shape is defined in [content-archetypes.md](content-archetypes.md) and [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md): `{ weapons: string[]; selectedIndex: number | null }`.
- `rules` remains the session-owned place for gameplay switches. Story 017 requires:
  ```ts
  type SessionRules = Readonly<{
    damage: {
      slimeFriendlyFire: boolean;
    };
  }>;
  ```
  `slimeFriendlyFire` is immutable for the run and is consumed by `CombatSystem` and future field/status systems via the shared damage-rule helper.
- Base `EncounterDefinition` fields:

```js
{
  id,
  type,          // wave | break | boss | survivalTimer | sandbox | portal
  backgroundId,
  spawnPlan,
  zoneBehavior,
  objectives,
  rewardRules,
  transitionRules,
  tuning,
  introDurationMs,
  name,
  text
}
```

- Presentation fields `introDurationMs: number`, `name: string | null`, and `text: string | null` are flat and required; type-paired constraints and the intro delay contract for sim/UI are defined in [encounter-presentation.md](encounter-presentation.md). This file only records that these fields are stable names in `EncounterDefinition` and are present on every encounter, including sandbox/bring-up and the Vibe Jam `portal` encounter.

- `spawnPlan` describes data for `SpawnSystem`, not concrete spawn code. `spawnPlan` shape (discriminated union, set of `kind`, extension rules, `'empty'`/`'static'`/`'wave'`/`'boss'`, optional per-`seq` `SpawnOverride` for `'static'`/`'wave'`) is defined by separate decisions: [spawn-plan.md](spawn-plan.md) and [spawn-overrides.md](spawn-overrides.md). Future `kind` categories and new `SpawnOverride` fields are added there, without changing this file.
- A `portal` encounter is a non-combat presentation encounter for Vibe Jam. It uses `spawnPlan.kind: 'empty'`, `zoneBehavior.kind: 'disabled'`, and `transitionRules.kind: 'never'` or `'allEnemiesCleared'`; browser redirect and portal overlap are main-thread behavior defined in [vibe-jam-portals.md](vibe-jam-portals.md), not `SessionFlowSystem`.
- `backgroundId` is an explicit reference to one of `SessionDefinition.backgrounds[].id` or `null` if the encounter does not define a background. For player-facing `wave`/`break`/`boss` encounters, a background is required at the content-authoring level; sandbox/bring-up encounters may use `null` or a test background. Simulation does not read this field; it belongs to presentation/runtime config that main already received with immutable `SessionDefinition`.
- `zoneBehavior` is a discriminated union by `kind`. Concrete semantics and `ZoneSystem` behavior are defined in [zone.md](zone.md); this file records only the field shape and set of `kind` values:
  - `{ kind: 'disabled' }` — the zone is retracted and does not move, `margin = 0` for the whole encounter;
  - `{ kind: 'shrinkLinear'; fromMargin: number; toMargin: number; durationMs: number }` — linear shrink over `durationMs`, `from`/`to` in `[0, maxMargin]`, `durationMs > 0`;
  - `{ kind: 'expandLinear'; fromMargin: number; toMargin: number; durationMs: number }` — linear expansion with the same field shape.
  Extensions (per-side, circle, nonlinear curves) are separate decisions and new `kind` values, not additions to existing ones.
- `objectives` describes what must be achieved inside the encounter. For the MVP horizon, `objectives` remains a reserved field without a required shape; encounter completion decisions belong to `transitionRules`. Expected future meaning categories: clear enemies, survive by timer, kill boss, transition by external condition.
- `transitionRules` describes when an encounter ends and what happens next. It is a discriminated union by `kind`; MVP-horizon `kind` values:
  - `{ kind: 'never' }` — encounter does not end automatically (sandbox);
  - `{ kind: 'allEnemiesCleared' }` — encounter ends when `SpawnSystem` has dispatched all planned entities and `EntityStore` has no live entity from `aliveFromThisPlan` ([spawn-plan.md](spawn-plan.md)). For `spawnPlan: { kind: 'empty' }`, this rule fires immediately, intentionally: empty wave encounters without spawns must not block flow;
  - `{ kind: 'timer'; durationMs: number }` — encounter ends when `simTime − encounterStartSimMs >= durationMs`. Used for `break` encounters.
  `transitionRules` also has a stable field `next: 'sequential' | { kind: 'byId'; id: string }`. By default, `'sequential'` means the next encounter is taken by index from `SessionDefinition.encounters`. If there is no next encounter, the encounter is treated as **last**, and `SessionFlowSystem` initiates run completion according to `winCondition` (see below).
  Optional "break between encounters" and "runtime events on transition" are intentionally not added to `transitionRules`: the first is expressed as a separate `break` encounter with `transitionRules: { kind: 'timer' }`, and the second is covered by the already defined lifecycle events `encounterStart`/`encounterEnd` ([runtime-systems.md](runtime-systems.md)).
- `winCondition` and `lossCondition` are defined at the whole-session level, not by individual story implementations.
- Minimal `winCondition` categories: `{ kind: 'allEncountersComplete' }`, `{ kind: 'bossDefeated' }`, `{ kind: 'dungeon' }`, `{ kind: 'scenarioCondition' }`, **`{ kind: 'none' }`** — the session has no automatic victory condition at all (sandbox, free-roam, dev modes).
- Minimal `lossCondition` categories: `{ kind: 'playerDeath' }`, `{ kind: 'timerOrScenarioFail' }`, `{ kind: 'forced' }`, **`{ kind: 'none' }`** — the session has no automatic loss condition (sandbox; completion is possible only through `stopSession`).
- `winCondition` and `lossCondition` remain required `SessionDefinition` fields. The `none` category is explicit to separate "forgot to set a condition" from "intentionally no condition". `SessionFlowSystem` ([runtime-systems.md](runtime-systems.md)) must not generate the corresponding win/loss event automatically for `none`.
- Active category semantics implemented by `SessionFlowSystem`:
  - `winCondition: { kind: 'allEncountersComplete' }` — `win` is published exactly once, after `encounterEnd` of the last encounter in `encounters` (when `transitionRules.next` reaches "no next encounter");
  - `winCondition: { kind: 'bossDefeated' }` — victory through a session-level death hook on an entity `kind: 'boss'`, under the conditions from [boss-encounter.md](boss-encounter.md); it is not mixed with `allEncountersComplete` in one `SessionDefinition`;
  - `winCondition: { kind: 'dungeon' }` — no automatic `win` is ever published. When `transitionRules.next` reaches "no next encounter", `SessionFlowSystem` emits the current `encounterEnd` and starts the first authored encounter again through the normal `encounterStart` path instead of completing the run. The authored encounter index still points at `SessionDefinition.encounters`; a separate run-level wave ordinal increments every time a `type === 'wave'` encounter starts, including repeated passes through the same authored wave. Dungeon sessions must use `lossCondition: { kind: 'playerDeath' }` in the first player-facing version;
  - `lossCondition: { kind: 'playerDeath' }` — `SessionFlowSystem` registers a session-level death hook that reacts to `entityKind === 'player'` ([health-and-death.md](health-and-death.md)) and publishes `loss` exactly once;
  - after publishing `win` or `loss`, `SessionFlowSystem` ends the run correctly: no further encounter transitions run, the clock moves to idle, and runtime state resets through the same path as `stopSession`. A further run can start only through a new `startSession`.
- `win`/`loss` events are the only way `main` learns about automatic session completion. While publishing the event, `SessionFlowSystem` must also perform the same runtime-state reset as `stopSession`, so `main` can react to the event without sending an explicit `stopSession` in response. The concrete event shape is in [snapshot-shape.md](snapshot-shape.md).
- `ModePreset` is an external preset that prepares a default session but is not executed by itself.
- Minimal preset modes:
  - `campaign` — 3 waves, breaks, final boss;
  - `training` — a short training run without a boss. For the story 004 horizon, the minimal shape is exactly two wave encounters with a break encounter between them (`wave1 → break → wave2`), combat `loadout` in the current ordered shape, `winCondition: { kind: 'allEncountersComplete' }`, and `lossCondition: { kind: 'playerDeath' }`. Concrete numeric wave parameters (composition, pace, limit, break duration, `zoneBehavior` numbers) are `content library` content ([content-boundaries.md](content-boundaries.md)) and not part of this decision. Extending `training` to 3+ waves or another structure is allowed without editing this file if the preset id shape stays the same;
  - `pistolOnly` — starting loadout is limited to the pistol;
  - `sandbox` — one `sandbox` encounter without win/loss conditions and without built-in weapon (`loadout: null`), used for bring-up stories that do not require the combat stack;
  - `sandbox-with-combat` — sandbox variant with an ordered `Loadout` and `spawnPlan: { kind: 'static' }` for bring-up combat entities (for example, the training target from [../stories/003-combat-foundation.md](../stories/003-combat-foundation.md)). It follows all sandbox-encounter rules below: `winCondition: none`, `lossCondition: none`, the only exit path is external `stopSession`.
  - `portal` — hidden Vibe Jam entrypoint preset started by `/portal` through `UiShell.autoStartPresetId`; it opens a transparent `portal` encounter before the first wave, then runs authored waves and `boss-gargoyle`. It uses `winCondition: allEncountersComplete` and `lossCondition: playerDeath`, so the run can end with the normal result/menu path after the boss.
  - `dungeon` — one player-facing endless-wave preset started from the existing Dungeon menu screen. It is an authored encounter loop, not procedural generation in the first version: the session must contain at least one `type === 'wave'` encounter, use `winCondition: dungeon`, and use `lossCondition: playerDeath`. Concrete wave composition, breaks, backgrounds, and scaling are content data.
- The "Minimal preset modes" list grows as stories appear; new preset modes are recorded in this file and not introduced locally in `src/shared/content/**`. Removing an existing preset id is handled through `superseded`/updating this file.
- A `sandbox` encounter has the following minimal shape:
  - `spawnPlan` — `{ kind: 'empty' }` or `{ kind: 'static' }` (see [spawn-plan.md](spawn-plan.md)); other `kind` values (`'wave'`, `'boss'`, ...) are forbidden in sandbox encounters because they imply automatic transitions and completion, which sandbox semantics exclude.
  - `objectives` — empty list or equivalent "no objectives".
  - `transitionRules` — the "encounter does not end automatically" rule; the only way to leave a sandbox session is external `stopSession`.
  - `zoneBehavior`, `rewardRules`, and `tuning` may be empty/neutral.
  - A sandbox session must have `winCondition: none` and `lossCondition: none`; other combinations with sandbox encounters are forbidden because they are semantically unreachable.
  - Static spawn in a sandbox encounter is justified as bring-up: training entities for system development (for example, target in 003), not gameplay content.
- Add user challenge restrictions through `modifiers`, not separate runtime branches.
- The base campaign remains a preset mode. The concrete encounter list for the campaign may evolve, but must be described by session data, not `SessionFlowSystem` logic.

## Consequences

- The base campaign becomes one preset mode, not a special mode in code.
- Training and challenges can run without forking runtime logic.
- UI gets one entry point: the mode-selection screen builds a `SessionDefinition`, then passes it to runtime.
- Difficulty and content control move into data and builder functions.
- Stories must no longer define the run-completion model or transition structure on their own when the rule is stable at runtime level.

## Related

- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [../docs/WAVES_AND_SCALING.md](../docs/WAVES_AND_SCALING.md)
- [../docs/BOSS.md](../docs/BOSS.md)
- [thread-model.md](thread-model.md)
- [content-boundaries.md](content-boundaries.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [runtime-systems.md](runtime-systems.md)
- [spawn-plan.md](spawn-plan.md)
- [content-archetypes.md](content-archetypes.md)
- [zone.md](zone.md)
- [health-and-death.md](health-and-death.md)
- [snapshot-shape.md](snapshot-shape.md)
- [boss-encounter.md](boss-encounter.md)
- [body-contact-boxes.md](body-contact-boxes.md)
- [content-authoring.md](content-authoring.md)
- [main-ui-shell.md](main-ui-shell.md)
- [../stories/015-sessions-from-md.md](../stories/015-sessions-from-md.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [spawn-overrides.md](spawn-overrides.md)
- [encounter-presentation.md](encounter-presentation.md)
- [audio.md](audio.md)
- [vibe-jam-portals.md](vibe-jam-portals.md)
- [companion-combat.md](companion-combat.md)
- [../stories/028-dungeon-mode.md](../stories/028-dungeon-mode.md)
- [../stories/030-companion-combat-and-rescue.md](../stories/030-companion-combat-and-rescue.md)
- [mobile-web-support.md](mobile-web-support.md)
