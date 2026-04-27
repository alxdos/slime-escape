# Sessions from Markdown

- Status: done
- Created: 2026-04-23
- Updated: 2026-04-23 (T1: design extensions written — `content-authoring.md` (new sections "Multi-file areas" and "Multiple tables in one H2 section" with explicit lists of areas and signatures, "Forbidden patterns" and "Consequences" extended, story 015 added to `Related`); `Updated` notes in `session-definition.md` (preset metadata moves to the `content library`, the shape of `SessionDefinition` does not change); `Updated` note in `main-ui-shell.md` (the playable preset catalog becomes a derived view over `SESSION_PRESET_TEMPLATES`, the standalone `playableModes.ts`/`PlayableModeEntry` registry disappears, the section "Menu and playable preset catalog" is rewritten around the new source of truth); T2–T10 decomposed in `Tasks`, the story `Status` moved to `in-progress`, the table in `stories/README.md` updated; T9: demo checks passed — `campaign-wave-3` 1000→400 reached the runtime session, `training-wave-1` changed wave composition, a temporary `training-hard.md` appeared in `getPlayableModeCatalog()` without code changes, `arenaId | sndbox` failed `content:build` without modifying `sessions.generated.ts`; demo edits reverted; T10: story closed, `stories/README.md` switched to `[x]`)

## Game designer

- Sees: a new folder `content/sessions/` with one MD file per preset (`campaign.md`, `training.md`, `sandbox.md`, `sandbox-with-combat.md`). Each file is the single source of truth for one preset: metadata (`displayName`, `description`, `order`, `arenaId`, `playerId`, `loadoutWeaponId`, `winCondition`, `lossCondition`) + the full ordered list of encounters with all wave, break, zone, and boss parameters visible in one place. Going to `src/shared/content/buildSession.ts` and `playableModes.ts` for those numbers is no longer needed.
- Can do: open `content/sessions/campaign.md`, change any balance value of a single encounter (wave pace `spawnIntervalMs`, alive cap `maxAlive`, wave composition in the `seq | archetypeId` table, zone duration `zoneDurationMs`, break duration `transitionDurationMs`, boss choice `bossArchetypeId`), run `npm run content:build` and `npm run dev`, immediately see the change in the game. Add a new preset — create `content/sessions/<id>.md` from the same template; nothing else needs touching. Hide a preset from the menu — `visibleInMenu | false` in `# Session`. A typo in any id (`arenaId`, `playerId`, `loadoutWeaponId`, `bossArchetypeId`, an `archetypeId` in a spawn) — the generator fails with a clear `content/sessions/<file>.md:<line>:<col>: …`, and no `.generated.ts` is modified.

## Technical

- Architect work: extend [../design/content-authoring.md](../design/content-authoring.md) — two new sections: "Multi-file areas" (filename without extension = id of the unit; sorted traversal for stable diffs; cross-file id uniqueness; the explicit list of multi-file areas currently contains only `sessions`) and "Multiple tables in a single H2 section" (a focused rule for the `sessions` area: an encounter section allows the first `field | value` table + an optional second `seq | archetypeId [| x | y]` with a special signature; for `spawnKind ∈ {wave, static}` the second table is required, for `spawnKind ∈ {empty, boss}` it is forbidden). `Updated` note in [../design/session-definition.md](../design/session-definition.md) (preset metadata — `displayName`/`description`/`visibleInMenu`/`order` — moves to the `content library`, formerly in `playableModes.ts`; the shape of `SessionDefinition` does not change). `Updated` note in [../design/main-ui-shell.md](../design/main-ui-shell.md) (the playable preset catalog is derived from `SESSION_PRESET_TEMPLATES.filter(visibleInMenu).sort(byOrder)`; `PLAYABLE_MODE_CATALOG` as a standalone entity disappears).
- Changes happen **only** in `scripts/content-build/**` (a new `sessions/` area), `src/shared/content/sessions.generated.ts` (new file), and `src/shared/content/buildSession.ts` (collapsed into a thin wrapper). Removed: `src/shared/content/presets.ts` and `src/shared/content/playableModes.ts`. The runtime shapes (`SessionDefinition`, `EncounterDefinition`, `SpawnPlan`, `ZoneBehavior`, `TransitionRules`, `Loadout`, `WinCondition`, `LossCondition`) **do not change** — out of scope for this story, no extensions per [content-archetypes.md](../design/content-archetypes.md) and [session-definition.md](../design/session-definition.md).
- Cross-area references (`arenaId`, `playerId`, `loadoutWeaponId`, `bossArchetypeId`, `archetypeId` in spawns) are validated by the area parser by importing the already-generated `arenas/players/weapons/bosses/enemies.generated.ts`; `sessions.generated.ts` is written as **direct TS imports** of constants (`SANDBOX_ARENA`, `HERO`, `PISTOL`, `BOSS_SCRAP_KING`, `SLIME_ONE_EYE`, …), so any drift between MD and the registries is caught by `tsc` over the generated output. This is the first area with cross-area refs; the principle is pinned in "Multi-file areas" in `content-authoring.md`.
- `bossSpawnPosition: top-center` stays a **builder-side computation** (`bossTopCenterSpawnInArena(arena, bossRadius, bossEdgeMargin)` already lives in `buildSession.ts:367-375`); the `BossSpawnPlan.position: Vec2` shape (`spawn-plan.md`) does not change. Additional symbolic positions are added when a consumer appears, as a separate `spawn-plan.md` extension.
- The `ModePresetId` type becomes derived: `as const satisfies` over the `SESSION_PRESET_TEMPLATES` literal + `keyof typeof`; there is no separate declaration in `presets.ts` (the file is removed). This eliminates the duplication "object keys vs type alternatives".

## Out of scope

- Any changes to **values** of balance numbers in the existing presets: the goal is a 1:1 move; in-game behaviour stays byte-for-byte until the first edit by the game designer.
- Extending `EncounterDefinition` with new fields (new `kind` for `spawnPlan`/`zoneBehavior`/`transitionRules`, new session-meta fields). If it turns out a runtime-contract extension is required, that is a stop sign, not an excuse to widen the scope.
- New presets beyond the existing four (`campaign`, `training`, `sandbox`, `sandbox-with-combat`). Adding a preset is a separate story when there is a designer task.
- Moving `arenas`/`players` into full multi-entity areas (each currently has a single element — `SANDBOX_ARENA`, `HERO`). Cross-area refs from sessions point to the existing `arenas.generated.ts`/`players.generated.ts`/`weapons.generated.ts`; reshaping those areas belongs to future stories.
- New boss positionings beyond `top-center` (for example `arena-center`, arbitrary coordinates). Added when a consumer appears, as a separate `spawn-plan.md` extension.
- Audio/visuals areas (for example `content/audio.md` for `SampleRegistry`/music pool) — separate stories.
- Hot reload of MD without restarting `npm run dev` and a UI editor on top of MD: authoring stays in a regular text editor; rebuilding the config is an explicit step.

## Acceptance

- The repository gains a `content/sessions/` folder with four files: `campaign.md`, `training.md`, `sandbox.md`, `sandbox-with-combat.md`. This is the **only** way for a game designer to edit session preset parameters. The file `src/shared/content/buildSession.ts` collapses into a thin wrapper (reads the template from `sessions.generated.ts`, supplies `seed`/`id` from `BuildOptions`, resolves symbolic positions like `top-center`, and assembles the final `SessionDefinition`). The files `src/shared/content/presets.ts` and `src/shared/content/playableModes.ts` are gone — preset metadata (`displayName`, `description`, `order`, `visibleInMenu`) lives in the `# Session` of each MD.
- Each MD structure: a `# Session` partition with a single `field | value` table (preset metadata). A `# Encounters` partition with one H2 per encounter in order; each H2 contains one `field | value` table with the shared encounter parameters (with the prefixes `spawn*`, `zone*`, `transition*`, `boss*` for grouping) and optionally a second table `seq | archetypeId [| x | y]` for waves (`spawnKind = wave`) and static spawns (`spawnKind = static`). For `spawnKind ∈ {empty, boss}` the second table must not appear. All fields are real, that is, the table values are actually consumed by the game; no "placeholder" fields exist.
- The command `npm run content:build` regenerates `src/shared/content/sessions.generated.ts`; the existing builder code imports it the same way as `enemies.generated.ts`/`weapons.generated.ts`/`bosses.generated.ts`/`drops.generated.ts`/`players.generated.ts` are imported today — with no runtime changes on the consumer side (`UiShell`, `MenuOverlay`, tests).
- Cross-area references are validated at generation: `arenaId`, `playerId`, `loadoutWeaponId`, `bossArchetypeId`, `archetypeId` in spawns must exist in the corresponding committed `*.generated.ts`. An unknown id — `content:build` fails with `content/sessions/<file>.md:<line>:<col>: section "## …": unknown <field> "<value>"`. In the generated `sessions.generated.ts` the same references are direct TS imports of constants (`SANDBOX_ARENA`, `HERO`, `PISTOL`, `BOSS_SCRAP_KING`, `SLIME_ONE_EYE`, …) — drift between MD and the registries is caught by `tsc` over the generated output.
- For any error in MD (missing required cell, typo in `spawnKind`/`zoneKind`/`transitionKind`, unknown id, a second table where forbidden, the absence of one where required) the generator fails with a clear message and **writes nothing** into the output file — the previous `sessions.generated.ts` stays valid and the game keeps working.
- The MD template for one preset (using `training`, which shows all five encounter shapes: a wave with a second table, a break with a timer transition, a sandbox encounter without a second table, a boss encounter with a symbolic position, and a static encounter with coordinates):

  ```markdown
  # Session

  | field | value |
  |---|---|
  | displayName | Training |
  | description | A short session without a boss to warm up and check the build. |
  | visibleInMenu | true |
  | order | 1 |
  | arenaId | sandbox |
  | playerId | hero |
  | loadoutWeaponId | pistol |
  | winCondition | allEncountersComplete |
  | lossCondition | playerDeath |

  # Encounters

  ## training-wave-1

  | field | value |
  |---|---|
  | type | wave |
  | spawnKind | wave |
  | spawnIntervalMs | 1500 |
  | maxAlive | 4 |
  | edgeMargin | 0.5 |
  | zoneKind | shrinkLinear |
  | zoneFromMargin | 0 |
  | zoneToMargin | 4 |
  | zoneDurationMs | 8000 |
  | transitionKind | allEnemiesCleared |
  | next | sequential |

  | seq | archetypeId |
  |---:|---|
  | 1 | slime-one-eye |
  | 2 | slime-one-eye |
  | 3 | slime-shell |
  | 4 | slime-one-eye |
  | 5 | slime-one-eye |
  | 6 | slime-shell |

  ## training-break

  | field | value |
  |---|---|
  | type | break |
  | spawnKind | empty |
  | zoneKind | expandLinear |
  | zoneFromMargin | 4 |
  | zoneToMargin | 0 |
  | zoneDurationMs | 2500 |
  | transitionKind | timer |
  | transitionDurationMs | 3000 |
  | next | sequential |

  ## training-wave-2

  | field | value |
  |---|---|
  | type | wave |
  | spawnKind | wave |
  | spawnIntervalMs | 1200 |
  | maxAlive | 5 |
  | edgeMargin | 0.5 |
  | zoneKind | shrinkLinear |
  | zoneFromMargin | 0 |
  | zoneToMargin | 5 |
  | zoneDurationMs | 10000 |
  | transitionKind | allEnemiesCleared |
  | next | sequential |

  | seq | archetypeId |
  |---:|---|
  | 1  | slime-one-eye |
  | 2  | slime-one-eye |
  | 3  | slime-one-eye |
  | 4  | slime-shell |
  | 5  | slime-one-eye |
  | 6  | slime-one-eye |
  | 7  | slime-shell |
  | 8  | slime-one-eye |
  | 9  | slime-shell |
  | 10 | slime-one-eye |
  ```

  Additional encounter shapes (used in `campaign.md`/`sandbox.md`/`sandbox-with-combat.md`):

  ```markdown
  ## campaign-boss

  | field | value |
  |---|---|
  | type | boss |
  | spawnKind | boss |
  | bossArchetypeId | boss-scrap-king |
  | bossSpawnPosition | top-center |
  | bossEdgeMargin | 0.5 |
  | zoneKind | disabled |
  | transitionKind | allEnemiesCleared |
  | next | sequential |

  ## sandbox-encounter

  | field | value |
  |---|---|
  | type | sandbox |
  | spawnKind | empty |
  | zoneKind | disabled |
  | transitionKind | never |
  | next | sequential |

  ## sandbox-with-combat-encounter

  | field | value |
  |---|---|
  | type | sandbox |
  | spawnKind | static |
  | zoneKind | disabled |
  | transitionKind | never |
  | next | sequential |

  | seq | archetypeId | x | y |
  |---:|---|---:|---:|
  | 1 | slime-bug | 5 | 0 |
  ```

  For a hidden preset (`sandbox.md`/`sandbox-with-combat.md`) `# Session` differs by two rows: `| visibleInMenu | false |` and `| order | 0 |` (the `order` value is still required by the rule "no two different files without data"; the preset does not appear in the UI catalog because of `visibleInMenu`).
- Game behaviour **does not change**: for every presetId with seed=0 (and any other stable seed) the current and the new `buildSessionDefinition` return a deep-equal `SessionDefinition`. The acceptance comparison test is added and green. All existing gameplay and integration tests (`SessionFlowSystem.test.ts`, `boss.integration.test.ts`, `combat.integration.test.ts`, `drops.integration.test.ts`, `training.integration.test.ts`, `playableModes.test.ts`) — green without changing the numeric expectations.
- The mode catalog in the UI (menu) after migration is built from `Object.values(SESSION_PRESET_TEMPLATES).filter(p => p.visibleInMenu).sort(byOrder)`. The catalog membership and order are byte-for-byte identical to the current `PLAYABLE_MODE_CATALOG`: `campaign` (`order: 0`), `training` (`order: 1`); `sandbox` and `sandbox-with-combat` are present as presets but `visibleInMenu: false`.
- `npm run content:check` catches drift: editing any `content/sessions/*.md` without `npm run content:build` makes the build red. `npm run build` is green. `npm test` is green.
- Demo (balance): the game designer opens `content/sessions/campaign.md`, in the encounter `## campaign-wave-3` changes `spawnIntervalMs` from `1000` to `400`, runs `npm run content:build` + `npm run dev`, sees noticeably more frequent spawns in the third campaign wave; `training` is unchanged.
- Demo (wave composition): the game designer in `## training-wave-1` second table replaces one `slime-one-eye` with `slime-shell`, rebuilds, sees a different composition for the first training wave.
- Demo (new preset): the game designer copies `content/sessions/training.md` to `content/sessions/training-hard.md`, changes `displayName`, `order`, halves `spawnIntervalMs` for every wave, keeps `visibleInMenu: true`, rebuilds — a third entry "Training (hard)" appears in the menu, playable, with no code changes.
- Demo (typo): the game designer writes `arenaId | sndbox` (a typo); `npm run content:build` fails with `content/sessions/campaign.md:7:3: section "# Session": unknown arenaId "sndbox"`, the file `sessions.generated.ts` stays unchanged, the game keeps working.

## Tasks

T1 is the architectural step (design extensions + decomposition into T2–T8 + moving `Status` to `in-progress`); it is performed in this very architect pass at the moment the story is picked up. T2 is the preparatory refactor (move template literals into a handwritten `sessions.generated.ts` with a temporary header), allowing a safe merge to `main` before the generator is ready. T3–T4 are buildtime infrastructure extensions (the sessions area parser + cross-area refs helper). T5 is authoring `content/sessions/*.md` and registering in `AREAS`; at this step the generated `sessions.generated.ts` must be **byte-for-byte** identical to the handwritten one from T2 (the convergence point). T6 is gameplay acceptance (deep-equal `SessionDefinition` with seed=0). T7 is dead-code cleanup. T8 is parser-error tests. T9 is demo + closing.

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Architect: write design extensions — `design/content-authoring.md` (new sections "Multi-file areas" and "Multiple tables in an H2 section" with explicit lists of areas and signatures; update "Forbidden patterns" — forbid multi-file without an explicit listing and forbid N tables in an H2 without an explicit listing); `Updated` note in `design/session-definition.md` (preset metadata — `displayName`/`description`/`visibleInMenu`/`order` — moves to the `content library`); `Updated` note in `design/main-ui-shell.md` (playable preset catalog derived from `SESSION_PRESET_TEMPLATES`); add an entry in the `Index` of `design/README.md` if needed; decompose T2–T9, move the story `Status` to `in-progress`, update the table in `stories/README.md`. | architect |
| T2 | [x] | Refactor `src/shared/content/buildSession.ts` as preparation: introduce the `SessionPresetTemplate` type in a new handwritten `src/shared/content/sessions.ts` (Readonly<{ presetId, displayName, description, visibleInMenu, order, arena, player, loadout, winCondition, lossCondition, encounters }>); move encounter literals and metadata of the four presets (`campaign`/`training`/`sandbox`/`sandbox-with-combat`) into a new handwritten `src/shared/content/sessions.generated.ts`, declared as `as const satisfies Record<string, SessionPresetTemplate>`; export `SESSION_PRESET_TEMPLATES` and the derived `type ModePresetId = keyof typeof SESSION_PRESET_TEMPLATES`. Collapse `buildSession.ts` into a thin wrapper: read the template, resolve the symbolic position `top-center` via the existing `bossTopCenterSpawnInArena`, attach `seed`/`id` from `BuildOptions`, validate via the existing `validateEnemyRegistry`/`warnIfWeaponMayTunnel`, return `SessionDefinition`. The new file's header at this step is a temporary "seed for sessions-from-md (story 015), regenerated by `scripts/content-build` after T5". `playableModes.ts` is updated: the catalog of modes = `Object.values(SESSION_PRESET_TEMPLATES).filter(p => p.visibleInMenu).sort(byOrder)`. `presets.ts` is **not yet removed** (used by SwitchOverlay/tests) — the re-export of `ModePresetId` stays. `npm test` is green; behaviour byte-for-byte. | basis: `design/session-definition.md`, `design/main-ui-shell.md` |
| T3 | [x] | Bootstrap the sessions area parser: `scripts/content-build/sessions/{index,parse,renderContent}.ts`. `index.ts` globs `content/sessions/*.md` (sorted) and parses each file. `parse.ts` uses `parseMarkdownFile`, requires the partitions `# Session` and `# Encounters`, validates the shared fields (enums `winCondition`/`lossCondition`/`spawnKind`/`zoneKind`/`transitionKind`), and reads encounters. Helper `requireEncounterTables(section, spawnKind)` on top of the existing parser: returns `{ fields: MarkdownTable, spawns: MarkdownTable | null }`; throws if `spawnKind ∈ {wave, static}` and the second table is missing, or `spawnKind ∈ {empty, boss}` and the second table is present. `renderContent.ts` renders `sessions.generated.ts` through the same `util/render.ts` helpers; references to arenas/players/weapons/bosses/enemies are direct TS imports of constants, not strings. With no `content/sessions/` the area fails with a clear "source directory not found" — fine for now, the generator just reports its absence. Register `SESSIONS_AREA` in `index.ts` (last in `AREAS`). | basis: `design/content-authoring.md` (T1) |
| T4 | [x] | Cross-area refs helper: `scripts/content-build/sessions/crossAreaRefs.ts` — imports the already-generated `src/shared/content/{arenas,players,weapons,bosses,enemies,drops}.generated.ts` via a regular TS import, exposes sets of known ids (`ARENA_IDS`, `PLAYER_IDS`, `WEAPON_IDS`, `BOSS_IDS`, `ENEMY_IDS`, `DROP_IDS`) and id→constName maps for `renderContent.ts`. The sessions parser uses these sets to validate `arenaId`/`playerId`/`loadoutWeaponId`/`bossArchetypeId`/`archetypeId` with the line and column of the error in MD. At this step the sessions area already works in "MD exists → generate, MD missing → message" mode. | basis: T3, `design/content-authoring.md` |
| T5 | [x] | Author `content/sessions/{campaign,training,sandbox,sandbox-with-combat}.md` with all current data from `buildSession.ts:117-365` exactly 1:1 (wave numbers, zone durations, spawn composition, edgeMargin, zone behaviors, transition rules — everything). `npm run content:build` → the generated `sessions.generated.ts` is **byte-for-byte** identical to the handwritten one from T2 after normalisation (key order, indentation). On differences, adjust the T3 rendering, not the MD data. After convergence the temporary header from T2 is replaced with the final AUTO-GENERATED. `npm test` stays green. | basis: T2, T3, T4 |
| T6 | [x] | Gameplay acceptance: `src/shared/content/buildSession.test.ts` — for every `presetId ∈ keyof SESSION_PRESET_TEMPLATES` with seed=0 (and a couple of stable seeds: 1, 42) compare `buildSessionDefinition(resolveModePreset(presetId), { seed })` deep-equal with a fixed snapshot (via `expect(...).toMatchSnapshot()` or an equivalent vitest mechanism). The snapshot is created **before** moving to the MD source (run the test on the T2 commit, save the snapshot), then the same test on the T5 commit must pass without updating the snapshot. This is the formal guarantee of the 1:1 move. All existing gameplay tests (`SessionFlowSystem.test.ts`, `boss.integration.test.ts`, `combat.integration.test.ts`, `drops.integration.test.ts`, `training.integration.test.ts`, `playableModes.test.ts`) are green without changing numeric expectations. | basis: `design/testing.md` |
| T7 | [x] | Cleanup: remove `src/shared/content/presets.ts` (the `ModePreset` shape is collapsed; `ModePresetId` is imported from `sessions.ts`); remove `src/shared/content/playableModes.ts` (replaced by a single `getPlayableModeCatalog()` function next to `SESSION_PRESET_TEMPLATES` or in `sessions.ts` directly); remove from `buildSession.ts` everything that remains from `makeCampaignRunEncounters`/`makeTrainingRunEncounters`/`buildCampaignSession`/`buildTrainingSession`/`buildSandboxSession`/`buildSandboxWithCombatSession` (their bodies collapse into one generic function). Update importers: `MenuOverlay`, `UiShell`, tests. `npm test` green, `npm run build` green. | basis: T6 |
| T8 | [x] | Sessions parser tests (vitest, next to `scripts/content-build/sessions/**`): (a) happy path — parsing the committed `content/sessions/*.md` yields output identical to the committed `sessions.generated.ts`; (b) a missing required cell in `# Session` → non-zero exit, target files unchanged; (c) a typo in `spawnKind`/`zoneKind`/`transitionKind` → non-zero exit naming the allowed values; (d) an unknown `arenaId`/`playerId`/`loadoutWeaponId`/`bossArchetypeId`/`archetypeId` → non-zero exit with line and column; (e) a second `seq | archetypeId` table for an encounter with `spawnKind = empty` or `boss` → non-zero exit; (f) a missing second table for `spawnKind = wave` or `static` → non-zero exit; (g) duplicate presetId across two files in `content/sessions/` → non-zero exit; (h) drift — a synthetic cell change in MD makes `--check` fail with a clear diff; (i) cross-area drift — a synthetic id change in `arenas.generated.ts` without updating MD → generator error (validation against the registry at `content:build`). | basis: `design/content-authoring.md`, `design/testing.md` |
| T9 | [x] | Demo acceptance: (1) change `spawnIntervalMs` `1000 → 400` in `## campaign-wave-3` of `content/sessions/campaign.md`, run `npm run content:build` + `npm run dev`, observe noticeably more frequent spawns in the third wave of `Escape`; (2) replace one `slime-one-eye` with `slime-shell` in `## training-wave-1`, rebuild, observe a different composition for the first wave of `Training`; (3) copy `training.md` to `training-hard.md`, change `displayName`, `order`, halve `spawnIntervalMs` for every wave, keep `visibleInMenu: true`, rebuild — a third entry "Training (hard)" appears in the menu, playable, with no code changes; (4) intentionally typo `arenaId | sndbox` — `npm run content:build` fails with a clear message and no `.generated.ts` is modified. After all checks revert the demo edits. Record the run in the story's `Updated`. | basis: T5 |
| T10 | [x] | Closing the story: closing checklist from `stories/README.md`; verify `Index` in `design/README.md`; move the story `Status` to `done` and update the table in `stories/README.md`. | architect |

## Related

- [../design/content-authoring.md](../design/content-authoring.md)
- [../design/session-definition.md](../design/session-definition.md)
- [../design/main-ui-shell.md](../design/main-ui-shell.md)
- [../design/spawn-plan.md](../design/spawn-plan.md)
- [../design/zone.md](../design/zone.md)
- [../design/boss-encounter.md](../design/boss-encounter.md)
- [../design/content-archetypes.md](../design/content-archetypes.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/testing.md](../design/testing.md)
- [011-content-from-md.md](011-content-from-md.md)
- [012-content-archetypes-from-md.md](012-content-archetypes-from-md.md)
- [013-sprite-assets-and-loader.md](013-sprite-assets-and-loader.md)
- [014-md-inline-media.md](014-md-inline-media.md)
