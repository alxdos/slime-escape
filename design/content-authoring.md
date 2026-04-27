# Content Authoring (Markdown Sources)

- Status: accepted
- Created: 2026-04-23
- Updated: 2026-04-26 (story 021: the `# Session` partition, first `field | value` table in the `sessions` area, receives required field `musicSampleId`; allowed values are `none` (-> `null`) or plain sampleId, cross-validated against `SampleRegistry` with `category: 'music'` ([audio.md](audio.md)). The encounter `field | value` table in the same area receives presentation fields `introDurationMs` / `name` / `text`, with paired constraints by `encounter.type`; exact shape and hard-error rules live in [encounter-presentation.md](encounter-presentation.md). This file defines the authoring surface and allowed cell forms: `none` -> `null`/`0`, integer `>= 0`, and non-empty string. Earlier: 2026-04-25 story 020: the override table in a `sessions` encounter section gains `loadoutWeaponIds | selectedWeaponIndex` for `SpawnOverride.loadout` ([spawn-overrides.md](spawn-overrides.md)). This makes that override table an exception to the "narrow table: id + <=4 fields" rule: exactly for the `sessions` override table, `seq` plus 6 fields is allowed in fixed column order. `loadoutWeaponIds` uses the existing CSV list-in-cell form for weapon ids. Earlier: story 019 adds a third optional encounter table `seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs` for per-spawn override fields from [spawn-overrides.md](spawn-overrides.md); "Multiple tables in one H2 section" expands from two allowed tables to three for `sessions`. A controlled list-in-cell exception is added for override-table `dropTable`: comma-separated `dropArchetypeId:chance` pairs. Earlier: story 017 aligns session loadout/rules authoring with ordered loadouts: `sessions` use `loadoutWeaponIds` plus `selectedWeaponIndex`, and `slimeFriendlyFire` for `rules.damage.slimeFriendlyFire`. Story 017 sprite extension: `weapons` and `drops` receive a required inline image node `![alt](../public/<path>)` under each archetype H2 as the load-bearing derive source for projectile/drop sprite; a parallel MD `image` column is forbidden by the no-two-sources rule. Earlier: story 015 adds multi-file `sessions`, session backgrounds table, and multiple-table H2 rules. Story 014 adds inline media nodes and shared resource set partitions. Story 013 adds external assets as derived-field sources and includes `players`. Story 012 adds the "fill out, do not trim down" rule for aligning MD with existing layers.)

## Context

Game content today, including enemy, weapon, drop, boss, player, arena, presets, session assembly, and audio mappings, lives as TypeScript literals spread across `src/shared/content/**` and `src/main/audio/AudioMappings.ts`. Any balance change is a TypeScript change: PR review mixes "changed a number" with "changed logic", and game design has no separate surface for changing parameters without opening code.

We need an authoring surface for game designers with these properties:

- one Markdown file is one content area, such as slimes/enemies, sessions, weapons;
- a build-time generator turns MD into the same TS literals used today, without changing consumers;
- runtime contracts (`EnemyArchetype`, `AudioMappings.EnemyAudioMapping`, ...) and validators do not change;
- an MD error never causes silent substitution or partial writes: either everything is valid and rewritten atomically, or generated files remain as they were and the build fails with a clear message;
- generated files cannot drift from MD: there is no state where MD says one thing and committed generated output says another.

This decision defines stable rules for the layer. Exact fields for a specific area, such as column names and balance table groups, belong to that area and its story rather than this document.

## Decision

### Source of truth and layers

- Every MD-managed content area has **one** `content/<area>.md` file at repo root. This is the only place where designers edit that area's data. The first area is `content/enemies.md`, including stationary targets. Later areas (`weapons`, `drops`, `bosses`, `players`, `sessions`, `arenas`, `presets`) are added by their own stories. At this revision the live areas are `enemies`, `weapons`, `drops`, `bosses`, `players`, and `sessions`.
- One area may produce several `<area>.generated.ts` output pairs beside different consumers:
  - `enemies` -> `src/shared/content/enemies.generated.ts` + `src/main/audio/enemyAudio.generated.ts` + `src/main/render/enemyVisuals.generated.ts`;
  - `weapons` -> `src/shared/content/weapons.generated.ts` + `src/main/audio/weaponAudio.generated.ts` + `src/main/render/projectileVisuals.generated.ts`;
  - `drops` -> `src/shared/content/drops.generated.ts` + `src/main/render/dropVisuals.generated.ts`;
  - `bosses` -> `src/shared/content/bosses.generated.ts` + `src/main/audio/bossAudio.generated.ts` + `src/main/render/bossVisuals.generated.ts`;
  - `players` -> `src/shared/content/players.generated.ts` + `src/main/render/playerVisuals.generated.ts`;
  - `sessions` -> `src/shared/content/sessions.generated.ts`.
- A single MD file may produce **one or more** generated `.ts` files, placed **in the layer that consumes the data**, not in a dumping-ground `generated` directory. For `enemies`, balance/content fields go to `src/shared/content/enemies.generated.ts`, while audio mapping goes to `src/main/audio/enemyAudio.generated.ts`.
- This split is mandatory and preserves [content-boundaries.md](content-boundaries.md): audio is presentation, not part of the `content library`. One MD file remains the single authoring source, and the generator owns routing fields to the correct target file.

### Layer alignment

- When an area migrates to MD, conversion is **fill out, not trim down**. If existing handwritten literals in the content library, presentation mappings, or adjacent registries already contain a more complete set of ids/links than the current minimal gameplay slice, MD must include that full set and generate it forward without loss.
- The same rule applies inside one area when one MD feeds several target layers: final MD reflects the union of existing data, not the intersection. If presentation already has audio mappings for several weapon ids, `content/weapons.md` defines all those weapon ids. If `SampleRegistry` already has separate hit/death/voice pools, the `enemies` area records them separately and does not collapse them into one shared pool.
- If the more complete state cannot be expressed in existing public forms for the area, that is a stop signal for a new design decision. The generator does not extend the contract locally and does not leave some data in handwritten `.ts` beside an MD source.

### External assets as derived-field sources

- Besides MD, the generator may read **binary assets under `public/**`** for derived values that should not be maintained manually, such as actual PNG pixel size. This is the only expansion of generator physical inputs beyond MD.
- The concrete set of derived fields and recalculation algorithm belongs to the **area decision** (for sprite visuals, [sprite-assets.md](sprite-assets.md)). This file defines only durable layer rules: a derived field is an output public-shape field recalculated from an asset on every `content:build` and not present in MD.
- For every derived field, the "no two sources of truth" rule applies:
  - MD must not contain a column/cell describing the derived field; adding one is an area-generator error, not a silent merge;
  - generated output always derives the field from the current asset, not from MD;
  - the derived value is not stored in `client settings`, snapshots, or any other durable place. The asset is the storage point.
- Binary asset reading lives in a utility under `scripts/content-build/util/`: a pure function `(absolutePath) -> derived value`, no hidden state, with clear errors like `content/<area>.md row "<id>": <what failed> <path>: <reason>`. Utilities may be reused; concrete consumers are area modules.
- Atomicity applies unchanged: failure to read a binary asset is the same `atomic fail` as an MD parse error. No target `.generated.ts` is modified until all derived values resolve.
- `content:check` detects drift from **any physical input**, not only MD:
  - MD changed and `.generated.ts` was not rebuilt -> check fails;
  - asset changed, including a PNG rewritten with different size, while MD did not change and `.generated.ts` was not rebuilt -> check also fails because a fresh generator run would produce different literals.
- Assets read only for derived fields do **not** become the generator's area list dependencies. The area list remains `content/<area>.md`; exact asset paths are formed by the area module from MD content, such as an `image` column or inline image node.

### Multi-file areas

- By default, "one file = one area" is mandatory: each area has one `content/<area>.md`, and every value of every field of every unit in that area lives in that file.
- In cases where an area consists of **independent units of one type**, and each unit is much richer than a comparison-table row, the area may be represented as a folder `content/<area>/` with one MD file per unit. Such areas are explicitly listed here; adding multi-file layout in generator code without updating this file is forbidden.
- Current multi-file areas:
  - `sessions` (`content/sessions/<presetId>.md`): each file describes one session preset in full, including preset metadata (`displayName`/`description`/`visibleInMenu`/`order`), session-level background-image table in `# Session`, and full encounter list in `# Encounters` order.
- Required rules for multi-file areas:
  - filename without extension equals the **unit id** (`presetId` for sessions); a typo creates a separate id, not a continuation of another file;
  - the folder is walked in **filename-sorted** order for stable generated diffs across OS/filesystems;
  - ids must be **unique across files**; duplicate id in two files is a generator error, not a merge;
  - all partition structure, table forms, derived-field rules, inline media rules, and shared resource set rules continue to apply per file;
  - cross-file uniqueness and sorted traversal are validated by the area parser, with `file:line` errors where possible.
- Cross-area references are allowed only in multi-file areas. `sessions` may reference `arenas`, `players`, `weapons`, `drops`, backgrounds, and enemy archetypes as defined by its area contract. The area parser performs user-friendly `file:line` validation, and generated TypeScript remains a second safety net through imports/types.

### Markdown format

- The parser is deliberately narrow:
  - H1 identifies the area or file title;
  - H2 identifies a unit or a known partition;
  - GFM tables carry data;
  - H3 and deeper sections are not part of the invariant form unless a future decision adds them explicitly.
- The default table shape is "narrow comparison": an id-like first column plus at most four data columns. This keeps MD readable in plain editors and prevents one table from becoming a spreadsheet substitute.
- Cells are plain scalars by default. Allowed scalar mini-syntaxes are area-defined: numbers, booleans, string ids, `none`, and known string unions.
- Lists-in-cell are forbidden by default. Controlled exceptions:
  - existing CSV id lists for session loadout (`loadoutWeaponIds`) and other explicitly named session fields;
  - override-table `dropTable`, written as comma-separated `dropArchetypeId:chance` pairs;
  - shared resource set cells where the section explicitly defines a list.
- Empty cell is not a semantic value. Use the area-defined explicit token, usually `none` or `empty`, so there is only one way to say "no data".
- Unknown columns, duplicate rows where the area requires unique ids, invalid enum values, malformed numbers, and unresolved references are hard errors.

### Inline media nodes as derive sources

- An inline media node directly under an H2 may be either preview-only or load-bearing; the role is defined by the area. The generator must not silently ignore a new load-bearing-looking node type without this file or the area decision being updated.
- Load-bearing inline images use `![alt](../public/<path>)`. The URL must be a relative path from the MD file to `public/`; generator strips the public prefix and writes a public-relative path. Other URL schemes (`http(s)://`, `/`, `./`, aliases) are errors.
- Load-bearing inline audio links use link text as `sampleId` and URL matching `SampleRegistry[sampleId].url`. Both sides are validated. A mismatch is an area-generator error.
- A load-bearing inline media node replaces the equivalent MD column. For example, if sprite image is authored through inline image, an `image` column for the same archetype is forbidden.
- Multiple media kinds may coexist under the same H2 if their syntax and roles differ. For `weapons`, story 014 audio-link for `fire` and story 017 image for projectile sprite share the same H2 without conflict.

### Shared resource set partition

- A shared resource set partition is a local deduplication mechanism for repeated presentation resources within one area, such as one sound-set shared by many slimes.
- The partition must define:
  - a members table mapping `setId` to area units, such as `setId | slimes`;
  - narrow group tables for resource groups, such as `Hit`, `Death`, and `Voice`, keyed by `setId`.
- The generator expands set membership N-to-1 into the same runtime mapping shape the consumer already expects, such as `Record<enemyArchetypeId, EnemyAudioMapping>`. Runtime shapes do not change.
- Shared resource sets are local to the area. They are not a general inheritance/template system and cannot be referenced from other areas.
- Inline image nodes are forbidden inside shared resource set partitions. `sampleId` cells may use either plain sample ids or inline audio-link cells, but one group table must not mix both forms.
- A shared resource set may not define a field that is already defined by a balance partition column in the same area, and vice versa. Parallel sources for the same field are an atomic generator failure.

### Multiple tables in one H2 section

- Default rule: one H2 section contains one GFM table.
- Current controlled exception: encounter sections in the `sessions` area may contain up to three tables:
  1. `field | value`: required encounter metadata. This includes gameplay fields (`id`, `type`, `spawnKind`, `duration`, `backgroundId`, etc.) and presentation fields `introDurationMs`, `name`, `text`. Pairing constraints, such as `name`/`introDurationMs > 0` for break/boss/sandbox/survivalTimer and `text` for wave/boss/sandbox/survivalTimer, are hard errors with MD-cell location; detailed rules live in [encounter-presentation.md](encounter-presentation.md).
  2. `seq | archetypeId` or `seq | archetypeId | x | y`: conditional spawn table. Required when `spawnKind in {wave, static}`, forbidden when `spawnKind in {empty, boss}`. The first column `seq` distinguishes it from the first table.
  3. `seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex`: fully optional override table. Allowed only when `spawnKind in {wave, static}`, forbidden when `spawnKind in {empty, boss}`. Each row defines `SpawnOverride` for a `seq` from the second table; missing `seq` is a hard error. Semantics and validation live in [spawn-overrides.md](spawn-overrides.md).
- The override table is the **only** controlled exception to "narrow table: id + <=4 fields": exactly this table may use `seq` + 6 fields in fixed order. Adding columns requires updating this file and [spawn-overrides.md](spawn-overrides.md).
- Allowed override cell values:
  - `guaranteedDrops`: `none` (field omitted) or CSV `dropArchetypeId`s;
  - `dropTable`: `none` (field omitted), `empty` (override `[]`), or CSV `dropArchetypeId:chance`;
  - `retaliationEnabled`: `none` or `true`/`false`;
  - `retaliationDurationMs`: `none` or integer `>= 0`;
  - `loadoutWeaponIds`: `none` (field omitted) or CSV `weaponArchetypeId`s;
  - `selectedWeaponIndex`: `none` (field omitted), integer in `[0, loadoutWeaponIds.length)`, or `null` for holstered.
- Paired fields must be complete:
  - if `retaliationEnabled = none`, then `retaliationDurationMs` must be `none`, and the reverse also holds. Together they define one `SpawnOverride.retaliation`;
  - if one of `loadoutWeaponIds` / `selectedWeaponIndex` is `none`, the other must also be `none`. Together they define one `SpawnOverride.loadout`.
- For any area that allows multiple tables in H2:
  - each allowed table is identified by header signature and required columns; wrong signature is a generator error, not "another table of the same type";
  - the narrow-table rule applies to each table individually, except the override table explicitly listed above;
  - conditional required/forbidden rules are defined explicitly by pairs such as first-table field value -> later table presence;
  - H3 subsections are still not introduced. The parser remains H1/H2-only.

### Build integration

Existing npm scripts remain: `dev = vite`, `build = tsc -p tsconfig.json && tsc -p tsconfig.worker.json && vite build`, `typecheck`, `test`, `test:watch`, `preview`. This decision adds three scripts and extends two existing ones **by composition**, not replacement:

- `content:build` runs the generator. On success, it atomically overwrites all `.generated.ts`. On any error, it writes nothing, exits non-zero, and reports `content/<area>.md:...`.
- `content:check` runs the generator into a temporary directory and compares output with committed `.generated.ts`. Any diff exits non-zero. This is the drift gate.
- `predev = content:build`. npm lifecycle runs it automatically before `npm run dev`, so the design loop is "edit MD -> `npm run dev` -> see it" without a separate command.
- `tsconfig.scripts.json` type-checks generator build-time code in `scripts/**` under the same strict TypeScript rules as runtime projects. The generator runs through `tsx`, but `tsx` does not replace `tsc` for generator sources.
- `build` expands to `tsc -p tsconfig.scripts.json && npm run content:check && tsc -p tsconfig.json && tsc -p tsconfig.worker.json && vite build`. Scripts typecheck first because `content:check` executes the generator. Then `content:check` catches generated drift before runtime `tsc` and `vite build`; the two original runtime `tsc` steps remain before `vite build`.
- The generator CLI fixes repository root relative to `scripts/content-build/index.ts` before reading `content/**` and writing `.generated.ts`. Direct `tsx /path/to/repo/scripts/content-build/index.ts` is independent of shell cwd.
- `.generated.ts` files are committed. This keeps fresh checkout `npm install && npm run dev` workable, lets PR review see both MD and literal diffs, and gives `content:check` something to compare against.

### Forbidden patterns

- No silent generator defaults: missing required field is an error, not substitution.
- No manual edits in `.generated.ts`; banner says so and review blocks it.
- No "MD has a field runtime ignores" beyond explicit area-defined roles. Each inline media node kind in an area is either fully preview-only or fully load-bearing. Adding a new ignored node kind requires updating this document.
- No mixing generator and runtime code under `src/**`. Generator lives entirely in `scripts/content-build/**` and is not imported from `src/**`. If generator needs a runtime type, such as `EnemyArchetype`, it imports from `src/shared/**`; import direction is one-way.
- No area MD file may become two sources of truth, such as some fields in MD and others in a handwritten `.ts` beside it. If a field is MD-managed, all values for all ids live in that MD.
- No MD column/cell for a field derived from an external asset. Same for load-bearing inline media nodes: if sprite PNG or `fire` sample id comes from an inline node, an MD column for the same derived field on the same archetype is an error.
- No load-bearing media URLs outside the relative-to-`public/` plus strip rule.
- No shared resource set partition for a field already defined by a balance partition column in the same area, and no reverse duplication.
- No inline image nodes inside shared resource set partitions.
- No mixing plain and inline-audio forms inside one shared resource group table.
- No multi-file layout (`content/<area>/*.md`) for an area not explicitly listed in "Multi-file areas". Creating such a folder is a generator error, not a default extension.
- No H2 section with more than one GFM table in an area not explicitly listed in "Multiple tables in one H2 section". A second, or third beyond the area's allowance, table is a generator error, not a silent merge.
- No cross-area references outside multi-file areas. A single-file area may not reference another area by id, even if the target area is generated. If a single-file area genuinely needs cross-area refs, that is a candidate to become multi-file, not a silent extension.

## Consequences

- A designer edits one area's balance by opening exactly one MD file and sees the result after `npm run dev`, or explicit `npm run content:build` plus restart.
- Runtime contracts and validators remain unchanged; after the first generation, game behavior is literal-equivalent to the current TS data.
- `tsc` on generated files catches drift between MD/template and public consumer types before runtime and close to the change.
- Adding a typical content area follows a template: add `content/<area>.md`, implement `scripts/content-build/<area>/` with parse projection and render templates, attach it to the same atomic write phase and `content:build`. Unusual needs, such as multiple target layers or mini-formats, extend this document or get a new decision.
- CI/Vercel deploy is protected by `tsconfig.scripts.json` and `content:check` at the start of `build`: generator is checked first, then drift becomes a build-time error instead of runtime incompatibility.
- A new root directory `scripts/` appears. This is **allowed** by this decision and does not open the door to future root directories locally; `web-stack.md` rules for `src/**` remain intact, and future top-level directories still require decisions.
- Generated `.generated.ts` files live in the repo. PR diffs for balance changes grow because both MD and generated deltas are visible, but the risk of forgetting to rebuild drops.
- Authoring for sprite/audio areas becomes visually rich: opening `content/<area>.md` in any MD viewer shows images and clickable sounds under archetype H2. Cost: each load-bearing media node has strict invariants: relative path to `public/`, and for audio, link text equals `SampleRegistry` id while URL equals `SampleRegistry[sampleId].url`.
- Shared resource set partitions give areas a **local** deduplication mechanism for identical resource lists, such as one `default` sound set covering 30 archetypes in one row, without changing runtime consumer shapes. Extending the pattern to new areas requires updating this decision.
- Multi-file areas (`content/<area>/*.md`) selectively extend "one file = one area" when a unit is too complex for one comparison-table row, currently session presets. Cost: the area validates cross-file id uniqueness and traversal order. Benefit: authoring focus becomes "one preset = one file" instead of a giant table mixing presets. Cross-area references inside multi-file areas are validated twice: area parser by `file:line`, then `tsc` over generated output, removing silent drift between one area's MD and another area's registry.

## Related

- [content-boundaries.md](content-boundaries.md)
- [content-archetypes.md](content-archetypes.md)
- [audio.md](audio.md)
- [sprite-assets.md](sprite-assets.md)
- [web-stack.md](web-stack.md)
- [logging.md](logging.md)
- [testing.md](testing.md)
- [../stories/014-md-inline-media.md](../stories/014-md-inline-media.md)
- [session-definition.md](session-definition.md)
- [main-ui-shell.md](main-ui-shell.md)
- [../stories/015-sessions-from-md.md](../stories/015-sessions-from-md.md)
- [spawn-overrides.md](spawn-overrides.md)
