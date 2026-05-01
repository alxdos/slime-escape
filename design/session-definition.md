# Session Definition

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-05-01 (story 037 prep: implement `lossCondition: 'allPlayersDead'` semantics — player death under this kind transitions the actor into a ghost state in [health-and-death.md](health-and-death.md) instead of removing the entity; `SessionFlowSystem` publishes `loss` exactly once when **no live player** remains (ghost actors do not count as live). Move `companion: CompanionSessionConfig | null` from top-level `SessionDefinition` into `PlayerConfig.companion` so every controlled actor carries its own companion; the multi-companion runtime contract lives in [companion-combat.md](companion-combat.md). Add `SessionRules.playerVsPlayerDamage: boolean` symmetric to `slimeFriendlyFire`, gating HP-damage between two `kind: 'player'` actors at the shared damage-rule helper ([projectiles-and-combat.md](projectiles-and-combat.md)). Add `SessionDefinition.playerCoopRevive: PlayerCoopReviveConfig | null` for the optional per-session player-revive interaction (symmetric to companion rescue from [companion-combat.md](companion-combat.md)); when `null`, ghost players cannot be revived and the run can only end by `win` or `loss`. Recorded the supported online combinations: `dynamicRoster: true + lossCondition: 'respawnOnDeath' + winCondition: 'none'` (Public Arena PvP, story 036), `dynamicRoster: true + lossCondition: 'allPlayersDead' + winCondition: 'allEncountersComplete' | 'bossDefeated'` (online co-op campaign, story 037 — admits late-join when the host policy allows it), and `dynamicRoster: false + lossCondition: 'allPlayersDead' + winCondition: 'allEncountersComplete' | 'bossDefeated'` (closed-roster co-op variant). Lobby host policy (`maxPlayers`, `lateJoinAllowed`, host election, start trigger) lives in [online-lobby.md](online-lobby.md) and session content; it is not part of `SessionDefinition`. Earlier: 2026-05-01 story 036 prep: added top-level `dynamicRoster: boolean` field and tied roster shape rules to it — `players[]` may be empty when `dynamicRoster: true`, and `core.addPlayer`/`removePlayer` ([sim-core-interface.md](sim-core-interface.md)) are valid only under that flag. Implemented the `lossCondition: 'respawnOnDeath'` semantics: player death runs the existing remove path but `SessionFlowSystem` does not publish `loss`; respawn policy is host-owned and lives in story 036's hosting decision, not here. Earlier: 2026-04-30 story 035 prep: generalised the single `player` field and the top-level `loadout` field into a non-empty `players: ReadonlyArray<PlayerConfig>`, where each `PlayerConfig` carries a stable `id`, the existing per-player spawn fields, and its own `loadout`. Extended the `lossCondition` union with `'allPlayersDead'` (recorded for story 037 co-op) and `'respawnOnDeath'` (recorded for story 036 PvP hosting); only the existing `'playerDeath'` kind is implemented in story 035 and now means "any controlled actor of `entityKind === 'player'` dies". Local presets continue to behave identically as `players: [<one>]`. Earlier: 2026-04-30 story 032 prep …)

## Context

The game runtime must run an externally defined session, not one hardcoded scenario. This is needed for the base campaign, training, challenge modes, and future variants without rewriting `core runtime`.

## Decision

- `core runtime` does not know about a concrete scenario such as "3 waves, then a boss".
- Every run is described by a `SessionDefinition` object.
- `SessionDefinition` is assembled externally from `ModePreset`, user options, and the `content library`.
- Environment options that affect gameplay must be applied during session build, before runtime receives `SessionDefinition`. Mobile visible-area and camera behavior from [camera-and-visible-area.md](camera-and-visible-area.md) is not such an option: it is main-thread presentation state and must not replace the preset arena in the final session.
- `ModePreset` defines the default shape of a mode, but is not an authoritative runtime object.
- User options and challenge restrictions modify the preset during session build; runtime receives only the resulting `SessionDefinition`.
- Base `SessionDefinition` fields:

```js
{
  id,
  seed,
  arena,
  players,
  dynamicRoster,
  backgrounds,
  musicSampleId,
  modifiers,
  encounters,
  rules,
  winCondition,
  lossCondition,
  playerCoopRevive,
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
  - `arena` — rectangle `{ width, height }` in world units (see [arena-and-coordinates.md](arena-and-coordinates.md)). Concrete values are authored as `arenaWidth` and `arenaHeight` in each `content/sessions/<presetId>.md` file and generated into the preset template.
  - `players` is an ordered list of `PlayerConfig` objects, one per controlled actor in the session at session start. The list is **non-empty when `dynamicRoster: false`** (the default; covers every static-roster mode — local single-player, training, dungeon, future fixed-party co-op). It **may be empty when `dynamicRoster: true`** (covers lobby-style sessions where actors arrive after `start(session)`, such as Public Arena PvP). Each `PlayerConfig` has shape `{ id, position: { x, y }, radius, contactBox, maxSpeed, maxHp, loadout, companion }`, where:
    - `id` is a stable string unique within the session and lexicographically comparable. It is the only cross-host identifier for an actor: per-actor input state is keyed by `id` ([input-commands.md](input-commands.md)), AI-targeting tie-breaks resolve by `id` ascending lexicographic order ([runtime-systems.md](runtime-systems.md)), and the host (browser worker for local play, Node arena host for online) routes input messages to the owning actor by `id`. `EntityId` is a sim-internal handle and is not stable across respawns; `id` is.
    - `position`, `radius`, `contactBox`, `maxSpeed`, `maxHp` carry the same meaning and the same units as the previous single-`player` shape: coordinates and sizes are in world units, speed is in world units per second, and `maxHp` is an integer > 0 (source of `HasHealth` from [health-and-death.md](health-and-death.md)). `contactBox` is the axis-aligned body footprint for body contact and player clamp per [body-contact-boxes.md](body-contact-boxes.md). For presets where a player is not damageable (sandbox without combat), `maxHp` is still set explicitly; omitting the field is forbidden by the same "no two ways to say no data" rule as other required fields.
    - `loadout` is the per-actor weapon loadout, with the same `Loadout | null` shape recorded below. It is `null` for actors without a built-in weapon (sandbox without combat) and a `Loadout` for combat-enabled actors. Each actor in `players` may have a different loadout; this is required for PvP arena (story 036) and for online co-op (story 037), and it is consistent for local single-player (the single actor carries the preset's loadout). The previous top-level `SessionDefinition.loadout` field is removed: there is exactly one place to author "what weapons does player X have", inside that player's `PlayerConfig`.
    - `companion` is either `null` (this actor has no runtime companion in this session) or a `CompanionSessionConfig` ([companion-combat.md](companion-combat.md)) describing one runtime companion entity owned by this actor. The field moved from `SessionDefinition.companion` (one per session) into `PlayerConfig.companion` (one per actor) so online co-op (story 037) runs with one companion per player while local single-player remains identical — the single actor in `players[]` carries the same `CompanionSessionConfig` the previous top-level field carried. Each actor's `companion.petArchetypeId` is presentation identity sourced from that actor's client progression at session build (local) or join handshake (online); session-level tuning fields (`maxHp`, contact shape, movement, threat, weapon, boop, rescue) are authored once per session in `content/sessions/<presetId>.md` and the builder fans the authored tuning out into every actor that has a companion. A `null` per-actor `companion` skips runtime companion creation for that actor regardless of session content. Multi-companion update order, ownership, and AI-targeting policy live in [companion-combat.md](companion-combat.md) and [runtime-systems.md](runtime-systems.md).
  - Additional fields (status effects, inventory) may be added to `PlayerConfig` by separate decisions without breaking the top-level model.
  - For sessions with `players.length === 1`, the runtime behaves identically to the previous single-player shape; this is the canonical local-play mode. Local content presets (`campaign`, `training`, `dungeon`, `sandbox`, `sandbox-with-combat`, `pistolOnly`, `portal`) emit a single-element `players` list.
  - `dynamicRoster: boolean` is the explicit switch between fixed-roster and dynamic-roster sessions. The field is required and immutable during the session.
    - `dynamicRoster: false` (default for every preset that exists today): `players[]` must be non-empty; the host must not call `core.addPlayer`/`removePlayer` mid-session — those calls are dropped with a warning through the shared log module ([logging.md](logging.md)). Every local preset behaves this way; no authoring change is required.
    - `dynamicRoster: true`: `players[]` may be empty (no actors at start); `core.addPlayer`/`removePlayer` ([sim-core-interface.md](sim-core-interface.md)) are valid for the lifetime of the session. Used by the Public Arena PvP session that story 036 introduces. Tying the empty-roster permission to this flag rather than to a specific `lossCondition` keeps the semantics clean for future modes that combine dynamic roster with other completion rules (e.g. a future tournament mode with an external timer).
    - Combinations are constrained: `dynamicRoster: true` with `lossCondition: { kind: 'playerDeath' }` is allowed but degenerate at start — the first death of any joiner ends the run. The honest pairing for Public Arena PvP is `dynamicRoster: true` + `lossCondition: { kind: 'respawnOnDeath' }` + `winCondition: { kind: 'none' }`.
  - **Authoring ergonomics are preserved.** `content/sessions/*.md` continues to author one player per session via the existing session-level fields (`playerId`, `loadoutWeaponIds`, `selectedWeaponIndex`) — see [content-authoring.md](content-authoring.md). The build pipeline (`scripts/content-build/sessions/**`) is responsible for expanding those single-player session-level fields into a single-element `players: [<one>]` for the runtime contract; the runtime gain in flexibility (per-actor loadout, future asymmetric co-op or hero classes) does **not** introduce a new authoring obligation. Per-player override in MD authoring is intentionally not introduced by story 035 — it stays a future concern of online co-op (story 037), and when it lands it must arrive as an additive rule that does not regress the existing single-player ergonomics ("fill in, do not trim").
  - The previous top-level `companion: CompanionSessionConfig | null` field is removed; companions are per-actor and live on `PlayerConfig.companion` (see the `players` field above). Multi-companion sessions (story 037 online co-op) carry one `CompanionSessionConfig` per actor that has a companion; legacy single-player presets continue to behave identically because their single `players[<one>]` entry carries exactly the `CompanionSessionConfig` the top-level field used to carry.
  - `seed` — integer value, the only source of RNG determinism in simulation; nondeterministic time/randomness sources outside `seed` are forbidden.
  - `id` — stable string session identifier for logs and debug.
- `modifiers`, `rules`, and `uiMeta` remain in the contract as stable names; their internal shape and requiredness depend on the preset and may evolve. The builder must explicitly set a meaningful value, `null`, or an empty object; omitting the field itself is forbidden so consumers do not need to distinguish two forms of "no data".
- Minimal `loadout` shape (carried by every `PlayerConfig`, see `players` above):
  - `null` — the actor has no built-in weapon (sandbox without combat, pure exploratory bring-up);
  - `Loadout` — the actor has at least one weapon; `Loadout` shape is defined in [content-archetypes.md](content-archetypes.md) and [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md): `{ weapons: string[]; selectedIndex: number | null }`.
- `rules` remains the session-owned place for gameplay switches. Current rules include:
  ```ts
  type SessionRules = Readonly<{
    damage: {
      slimeFriendlyFire: boolean;
      playerVsPlayerDamage: boolean;
    };
  }>;
  ```
  `slimeFriendlyFire` and `playerVsPlayerDamage` are immutable for the run and are consumed by `CombatSystem`, the shared damage-rule helper, and future field/status systems. `playerVsPlayerDamage` gates HP-damage between two `kind: 'player'` actors only — knockback, visual effects, projectile motion, and explosion physics are unaffected, exactly as `slimeFriendlyFire` gates only enemy-vs-enemy HP-damage. For PvP arena (story 036) both flags are `true`; for online co-op (story 037) `slimeFriendlyFire` is typically `true` (slimes still cross-fire each other) and `playerVsPlayerDamage` is typically `false` (party members cannot harm each other). Existing local presets continue to omit `playerVsPlayerDamage` from the authored MD form; the builder defaults the field to `false` for any session whose authored shape did not opt in, keeping single-player runs unchanged.
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
- `winCondition` and `lossCondition` are defined at the whole-session level, not by individual feature implementations.
- Minimal `winCondition` categories: `{ kind: 'allEncountersComplete' }`, `{ kind: 'bossDefeated' }`, `{ kind: 'dungeon' }`, `{ kind: 'scenarioCondition' }`, **`{ kind: 'none' }`** — the session has no automatic victory condition at all (sandbox, free-roam, dev modes).
- Minimal `lossCondition` categories: `{ kind: 'playerDeath' }`, `{ kind: 'allPlayersDead' }`, `{ kind: 'respawnOnDeath' }`, `{ kind: 'timerOrScenarioFail' }`, `{ kind: 'forced' }`, **`{ kind: 'none' }`** — the session has no automatic loss condition (sandbox; completion is possible only through `stopSession`).
- Multi-actor `lossCondition` semantics (the three player-related kinds):
  - `'playerDeath'` — `loss` fires exactly once when **any** controlled actor of `entityKind === 'player'` dies. For sessions with `players.length === 1` this is identical to the previous single-player rule.
  - `'allPlayersDead'` — when an actor's HP reaches zero or below, [health-and-death.md](health-and-death.md) transitions that actor into a **ghost-state** rather than removing the player entity. The actor stays in `EntityStore.players()` with `state: 'ghost'`, accepts only the ghost-state input set ([input-commands.md](input-commands.md)), is invulnerable to further HP-damage at the damage-helper, and produces no fire/aim. `SessionFlowSystem` registers a session-level hook that runs after each transition into ghost; when zero **live** actors remain (ghost actors do not count as live), it publishes `loss` exactly once with `defeat.cause` derived from the cause of the transition that brought the live count to zero (last actor to fall). A revive interaction described by `SessionDefinition.playerCoopRevive` (see below) may transition a ghost actor back to alive; while at least one actor is alive, `SessionFlowSystem` does not publish `loss` even if every other actor is currently a ghost. If the last live actor falls during an in-progress revive, the revive interaction is canceled (the rescuer flipped to ghost) and `loss` fires on the same tick. Implemented in story 037.
  - `'respawnOnDeath'` — death never produces `loss`. `SessionFlowSystem` does **not** publish `loss`, does not initiate run completion, and does not run terminal hooks. `HealthDeathSystem` runs the existing remove path: the dead player entity is removed, its `RuntimeInputState` slot is dropped, and the standard `death` runtime event ([snapshot-shape.md](snapshot-shape.md)) fires for HUD/audio/render consumers. **Bringing the actor back is host policy, not engine behavior**: the engine does not auto-respawn. The host (Node arena host for story 036) listens for `death` events and decides whether to call `core.addPlayer` again with a fresh `PlayerConfig` (level 1 stats, fresh spawn position, optional invulnerability via `addPlayer` opts per [sim-core-interface.md](sim-core-interface.md)). The run ends only through external `stopSession`. Implemented in story 036.
- `winCondition` and `lossCondition` remain required `SessionDefinition` fields. The `none` category is explicit to separate "forgot to set a condition" from "intentionally no condition". `SessionFlowSystem` ([runtime-systems.md](runtime-systems.md)) must not generate the corresponding win/loss event automatically for `none`.
- Active category semantics implemented by `SessionFlowSystem`:
  - `winCondition: { kind: 'allEncountersComplete' }` — `win` is published exactly once, after `encounterEnd` of the last encounter in `encounters` (when `transitionRules.next` reaches "no next encounter");
  - `winCondition: { kind: 'bossDefeated' }` — victory through a session-level death hook on an entity `kind: 'boss'`, under the conditions from [boss-encounter.md](boss-encounter.md); it is not mixed with `allEncountersComplete` in one `SessionDefinition`;
  - `winCondition: { kind: 'dungeon' }` — no automatic `win` is ever published. When `transitionRules.next` reaches "no next encounter", `SessionFlowSystem` emits the current `encounterEnd` and starts the first authored encounter again through the normal `encounterStart` path instead of completing the run. The authored encounter index still points at `SessionDefinition.encounters`; a separate run-level wave ordinal increments every time a `type === 'wave'` encounter starts, including repeated passes through the same authored wave. Dungeon sessions must use `lossCondition: { kind: 'playerDeath' }` in the first player-facing version;
  - `lossCondition: { kind: 'playerDeath' }` — `SessionFlowSystem` registers a session-level death hook that reacts to `entityKind === 'player'` ([health-and-death.md](health-and-death.md)) and publishes `loss` exactly once on the **first** player death (any of `players[]`). Subsequent player deaths within the same tick or in following ticks do not republish `loss` and do not run further loss-related hooks;
  - after publishing `win` or `loss`, `SessionFlowSystem` ends the run correctly: no further encounter transitions run, the clock moves to idle, and runtime state resets through the same path as `stopSession`. A further run can start only through a new `startSession`.
- `win`/`loss` events are the only way `main` learns about automatic session completion. While publishing the event, `SessionFlowSystem` must also perform the same runtime-state reset as `stopSession`, so `main` can react to the event without sending an explicit `stopSession` in response. The concrete event shape is in [snapshot-shape.md](snapshot-shape.md).
- `playerCoopRevive: PlayerCoopReviveConfig | null` is the per-session player-revive interaction. The field is required; `null` means ghost actors cannot be revived in this session and the run ends only by `win` or `loss`. When set, the session enables a player-rescue interaction symmetric to companion rescue from [companion-combat.md](companion-combat.md):

  ```ts
  type PlayerCoopReviveConfig = Readonly<{
    rescueRadius: number;       // world units; living actor must be within this radius of a ghost to accumulate rescue progress
    rescueDurationMs: number;   // continuous proximity time required to complete rescue (> 0)
    reviveHpFraction: number;   // (0, 1]; HP restored relative to the revived actor's maxHp
  }>;
  ```

  Semantics: when a living actor's contact box overlaps a ghost actor's revive radius for `rescueDurationMs` of continuous simulation time, the ghost transitions back to `state: 'alive'` with HP set to `max(1, floor(maxHp * reviveHpFraction))`, the actor's `RuntimeInputState` slot resumes the full input set, and a `playerRevived` event ([snapshot-shape.md](snapshot-shape.md)) fires. Multiple living actors may contribute to the same rescue; per-pair progress is independent and the first pair to reach the duration triggers the revive. The interaction is canceled if the ghost or the rescuer leaves the radius, or if the rescuer dies. The shared rescue handler that drives both companion-rescue and player-rescue lives in [runtime-systems.md](runtime-systems.md).

  `playerCoopRevive` is orthogonal to `lossCondition`. Natural pairing is `'allPlayersDead'` + `playerCoopRevive: { ... }`; `'allPlayersDead'` + `playerCoopRevive: null` is the no-revive variant; pairing with `'playerDeath'` is allowed but degenerate because the first death already ends the run. The builder must validate `rescueDurationMs > 0` and `reviveHpFraction` strictly greater than `0` and at most `1`; omission of the top-level field is forbidden by the same "no two ways to say no data" rule. Local presets keep `playerCoopRevive: null` and behave identically.

- `ModePreset` is an external preset that prepares a default session but is not executed by itself.
- Minimal preset modes:
  - `campaign` — 3 waves, breaks, final boss;
  - `training` — a short training run without a boss. The minimal shape is exactly two wave encounters with a break encounter between them (`wave1 → break → wave2`), exactly one player in `players` with a combat `loadout` in the current ordered shape, `winCondition: { kind: 'allEncountersComplete' }`, and `lossCondition: { kind: 'playerDeath' }`. Concrete numeric wave parameters (composition, pace, limit, break duration, `zoneBehavior` numbers) are `content library` content ([content-boundaries.md](content-boundaries.md)) and not part of this decision. Extending `training` to 3+ waves or another structure is allowed without editing this file if the preset id shape stays the same;
  - `pistolOnly` — the single player's `loadout` is limited to the pistol;
  - `sandbox` — one `sandbox` encounter without win/loss conditions and with the single player's `loadout: null` (no built-in weapon), used for bring-up stories that do not require the combat stack;
  - `sandbox-with-combat` — sandbox variant where the single player's `loadout` is an ordered `Loadout` and `spawnPlan: { kind: 'static' }` provides bring-up combat entities such as a training target. It follows all sandbox-encounter rules below: `winCondition: none`, `lossCondition: none`, the only exit path is external `stopSession`.
  - `portal` — hidden Vibe Jam/Public Arena entrypoint content source for `/portal`. It may provide presentation data such as arena dimensions and backgrounds through the normal session content pipeline, but the `/portal` entrypoint is not required to execute a local authored combat run.
  - `dungeon` — one player-facing endless-wave preset started from the existing Dungeon menu screen. It is an authored encounter loop, not procedural generation in the first version: the session must contain at least one `type === 'wave'` encounter, use `winCondition: dungeon`, and use `lossCondition: playerDeath`. Concrete wave composition, breaks, backgrounds, and scaling are content data.
- The "Minimal preset modes" list grows as product modes appear; new preset modes are recorded in this file and not introduced locally in `src/shared/content/**`. Removing an existing preset id is handled through `superseded`/updating this file.
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
- Feature work must no longer define the run-completion model or transition structure on its own when the rule is stable at runtime level.

## Related

- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [../docs/WAVES_AND_SCALING.md](../docs/WAVES_AND_SCALING.md)
- [../docs/BOSS.md](../docs/BOSS.md)
- [thread-model.md](thread-model.md)
- [content-boundaries.md](content-boundaries.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [camera-and-visible-area.md](camera-and-visible-area.md)
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
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [spawn-overrides.md](spawn-overrides.md)
- [encounter-presentation.md](encounter-presentation.md)
- [audio.md](audio.md)
- [vibe-jam-portals.md](vibe-jam-portals.md)
- [companion-combat.md](companion-combat.md)
- [mobile-web-support.md](mobile-web-support.md)
- [input-commands.md](input-commands.md)
- [sim-core-interface.md](sim-core-interface.md)
- [session-result-summary.md](session-result-summary.md)
- [simulation-runtime.md](simulation-runtime.md)
- [online-session-hosting.md](online-session-hosting.md)
- [online-lobby.md](online-lobby.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [../stories/035-multi-actor-sessions.md](../stories/035-multi-actor-sessions.md)
- [../stories/036-node-arena-host.md](../stories/036-node-arena-host.md)
- [../stories/037-coop-vs-slimes.md](../stories/037-coop-vs-slimes.md)
