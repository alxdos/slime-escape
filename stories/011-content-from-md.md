# Content from Markdown

- Status: done
- Created: 2026-04-23
- Updated: 2026-04-23 (review: `build` first checks `scripts/**` via `tsconfig.scripts.json`, then runs `content:check`)

## Game designer

- Sees: a single MD file describing all slimes, with `# Slimes` (one definition per slime) and `# Balance` (narrow comparison tables grouped by parameter type). It is the single source of truth for slime balance; touching `.ts` and code is no longer needed.
- Can do: open the MD in any text editor, change a value (for example `slime-fast.maxSpeed`), run `npm run content:build`, refresh the local build, and immediately see the change in the game. On a typo the generator fails with a clear message and does not corrupt the working config.

## Technical

- The authoring surface and generation pipeline are pinned in [../design/content-authoring.md](../design/content-authoring.md): one MD per area (`content/<area>.md`), one or more `.generated.ts` next to the consumer, the generator in `scripts/content-build/`, atomic writes, no separate validator (helpers + `tsc` carry the structure), integration with `build` via `content:check`.
- For the enemies area the generator writes to **two** layers: balance/content literals → `src/shared/content/enemies.generated.ts` (consumer — handwritten `enemies.ts` with types and `validateEnemyRegistry`), audio mappings → `src/main/audio/enemyAudio.generated.ts` (consumer — handwritten `AudioMappings.ts`). The sim/presentation boundary follows [../design/content-boundaries.md](../design/content-boundaries.md).
- The shapes of `EnemyArchetype` and `EnemyAudioMapping` do not change — see [../design/content-archetypes.md](../design/content-archetypes.md) and [../design/audio.md](../design/audio.md). The generator must fit the existing contract; any field that cannot be expressed in those shapes is a signal for a new decision, not a local generator extension.
- A root `scripts/` directory for build-time tools is allowed by `content-authoring.md` (an exception to the [../design/web-stack.md](../design/web-stack.md) rule about new root directories). No imports from `scripts/**` into `src/**` and back (except types from `src/shared/**` into the generator).
- Existing npm scripts keep their shape; `build` extends to a composition: `tsc -p tsconfig.scripts.json && npm run content:check && tsc -p tsconfig.json && tsc -p tsconfig.worker.json && vite build`. Vercel deploys use the same `build`, so the generator is checked first and drift is caught on the CI side without an extra configuration.

## Out of scope

- Sessions and encounter composition (waves, breaks, boss spawn) — a separate story; here we work with slimes only.
- Bosses, weapons, arenas, the player, drop archetypes as standalone entities — separate stories when needed.
- Slime sprites: an image field may exist in MD, but the renderer still draws a slime as a coloured circle — the render side is not changed in this story.
- Hot reload of MD without restarting `npm run dev`: rebuilding the config is an explicit game-designer step.
- A UI/editor on top of MD: authoring happens in a regular text editor.
- Any format other than Markdown (YAML/TOML/JSON as the primary source of truth) — intentionally out of scope.

## Acceptance

- The repository contains a single MD file describing all slimes; editing it is the only way for a game designer to change slime parameters.
- MD structure: a top-level section `# Slimes` — slime definitions (a level-2 section `## <id>`, an optional image, a small "field/value" table for the named part). A top-level section `# Balance` — comparison tables grouped by parameter type (`## Body`, `## Movement`, `## Contact damage`, `## Knockback`, `## Drops`, `## Sounds`); each table is narrow (4–5 columns), the first column is `id`, referring to a slime in `# Slimes`. All groups are real, that is, the table values are actually consumed by the game; there are no "placeholder" fields in the format (the only exception is the image, whose render is explicitly disabled).
- The command `npm run content:build` (or whatever it is named) fully regenerates the slime data module in `src/shared/content/**`; the module is imported by code exactly as it is now, with no changes on the consumer side.
- For any error in the MD the generator fails with a clear message (file, section, line, field, what was expected) and **writes nothing** to the output file — the previously generated file stays valid and the game keeps running.
- Game behaviour does not change: after the first generation the produced data is equivalent to the current slime parameters and the current audio behaviour (the same `hit/death/voice` sample set as today).
- Runtime validations (`validateEnemyRegistry`, tunneling checks, drop-table checks) keep working on top of the generated data. If audio needs its own check (for example that a `sampleId` exists in the registry), it lives in the same style and the same layer.
- CI catches drift: if someone edits MD without rebuilding — the build is red (a single command compares freshly generated output against what is committed).
- `npm test` stays green.
- Demo (balance): the game designer opens the MD, changes `slime-fast.maxSpeed` from `4` to `6`, runs `npm run content:build` and `npm run dev`, sees faster slimes in `Escape` and `Training` modes.
- Demo (audio): the game designer in `## Sounds` swaps the `hit` column for `slime-tank` to a different set of `sampleId`s from `SampleRegistry`, rebuilds the config, and on a hit on the tank the chosen sample plays instead of the previous one.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Architect: write `design/content-authoring.md` — durable rules for the MD format, `<area>.ts ↔ <area>.generated.ts` pairs next to the consumer, the `parse → render → atomic write` pipeline, no separate validator (helpers + `tsc`), integration into `build`, the `scripts/` exception. Add back-refs in adjacent design files (`content-boundaries.md`, `content-archetypes.md`, `audio.md`, `web-stack.md`), update the `Index` in `design/README.md`, move the story to `in-progress`. | architect |
| T2 | [x] | Refactor `src/shared/content/enemies.ts`: move the `TRAINING_TARGET`/`SLIME_FAST`/`SLIME_TANK` literals (and the registry array, if it suits the template) into a new handwritten `src/shared/content/enemies.generated.ts`, typed by the public `EnemyArchetype` from `enemies.ts`. In `enemies.ts` remove the inline declarations and import the literals. The `ENEMY_ARCHETYPES` registry, the types, and `validateEnemyRegistry` stay in `enemies.ts`. The new file's header is, for now, a temporary "seed for content-from-md (story 011), regenerated by `scripts/content-build` after T6". `npm test` is green; behaviour is byte-for-byte identical. | basis: `design/content-authoring.md`, `design/content-archetypes.md` |
| T3 | [x] | Refactor `src/main/audio/AudioMappings.ts`: move `SLIME_VARIANTS` and `ENEMY_AUDIO_MAPPINGS` into a new handwritten `src/main/audio/enemyAudio.generated.ts`, typed `Readonly<Record<string, EnemyAudioMapping>>` (the type is imported from `AudioMappings.ts`). In `AudioMappings.ts` remove the inline declarations and import them. `WEAPON_AUDIO_MAPPINGS`/`BOSS_AUDIO_MAPPINGS`/`EVENT_AUDIO_MAPPINGS` are **not touched** — out of scope. `AudioMappings.test.ts` is green. Same temporary header. | basis: `design/content-authoring.md`, `design/content-boundaries.md`, `design/audio.md` |
| T4 | [x] | Bootstrap the generator: create `scripts/content-build/index.ts` (CLI: no args = `build`, `--check` = drift mode), `scripts/content-build/parse/` (micromark + mdast → input structure: a tree of sections by H1/H2 + GFM tables as `{ header[], rows[] }` referencing line/col), `scripts/content-build/util/atomicWrite.ts` (buffered + temp + rename for the whole set of target files; on error, nothing is written), `scripts/content-build/util/require.ts` (`requireSection`, `requireRow`, `requireCell`, `requireNumber`, `requireHexColor`, `requireSampleIdList` with human-readable messages `content/<area>.md: section "## …" row "<id>" column "<name>": <expected>`). Add to `devDependencies`: `tsx`, `micromark`, `mdast-util-from-markdown`, `micromark-extension-gfm-table`, `mdast-util-gfm-table`. No area logic, no targets: `tsx scripts/content-build/index.ts` is a no-op exiting with code 0. | basis: `design/content-authoring.md`, `design/web-stack.md` |
| T5 | [x] | Implement the enemies area in the generator: `scripts/content-build/enemies/parse.ts` (input structure → an intermediate enemies-area object that catches reference errors between `# Balance` and `# Enemies` and does not codegen), `scripts/content-build/enemies/renderContent.ts` (TS-tagged template → source for `src/shared/content/enemies.generated.ts`, importing the `EnemyArchetype` type from `../../../src/shared/content/enemies.ts`, AUTO-GENERATED banner), `scripts/content-build/enemies/renderAudio.ts` (same → `src/main/audio/enemyAudio.generated.ts`, importing the `EnemyAudioMapping` type from `../../../src/main/audio/AudioMappings.ts`). Register the area in `index.ts`. At this point there is no MD yet — the generator works, but without `content/enemies.md` it fails with a clear "source not found". | basis: `design/content-authoring.md`, `design/content-archetypes.md`, `design/audio.md` |
| T6 | [x] | Author `content/enemies.md` with all current data: a `# Enemies` partition (`## training-target`, `## slime-fast`, `## slime-tank` — each with a `field/value` table for `displayName`/`color`); a `# Balance` partition with `## Body` (id/radius/maxHp/behavior), `## Movement` (id/maxSpeed), `## Contact damage` (id/contactDamage/contactCooldownMs), `## Knockback` (id/baseImpulse/velocityScale/durationMs), `## Drops` (id/dropArchetypeId/chance — no row for `training-target`), `## Sounds` (id/hit/death — empty cells for `training-target`), `## Voice` (id/sampleIds/intervalMinMs/intervalMaxMs — no row for `training-target`). `npm run content:build` → the generated files are textually equivalent to the handwritten versions from T2/T3 after normalisation (key order, indentation). On differences, adjust the T5 templates, not the data. Once they converge, the temporary headers from T2/T3 are replaced by the final AUTO-GENERATED. `npm test` stays green. | basis: `design/content-authoring.md` |
| T7 | [x] | Extend `package.json`: add `content:build` (`tsx scripts/content-build/index.ts`), `content:check` (`tsx scripts/content-build/index.ts --check`), `predev` (`npm run content:build`); extend `build` to the composition `tsc -p tsconfig.scripts.json && npm run content:check && tsc -p tsconfig.json && tsc -p tsconfig.worker.json && vite build`. The existing `dev`/`preview`/`typecheck`/`test`/`test:watch` are unchanged. Verify: `npm run dev` (through `predev`) is green, `npm run build` is green. | basis: `design/content-authoring.md`, `design/web-stack.md` |
| T8 | [x] | Generator tests (vitest, next to the `scripts/content-build/**` modules or in `__tests__/`): (a) happy path — parsing the current `content/enemies.md` yields output identical to the committed `enemies.generated.ts` and `enemyAudio.generated.ts`; (b) a missing required cell → non-zero exit, target files unchanged; (c) a reference to an unknown `id` in `# Balance` → non-zero exit; (d) drift — a synthetic cell change in MD makes `--check` fail with a clear diff; (e) atomicity — a simulated render error in one area does not lead to a partial overwrite of another. Extend the vitest config if needed so that `scripts/**` tests are picked up. | basis: `design/content-authoring.md`, `design/testing.md` |
| T9 | [x] | Demo acceptance: (1) change `slime-fast.maxSpeed` `4 → 6` in MD, run `npm run content:build` + `npm run dev`, observe a faster slime in `Escape`/`Training`; (2) swap the `hit` column for `slime-tank` in `## Sounds` to a different set of `sampleId`s from `SampleRegistry`, rebuild, observe a different hit sound on the tank. After the check, revert the demo edits. Record the run in the story's `Updated`. | basis: `design/content-authoring.md` |
| T10 | [x] | Closing the story: closing checklist from `stories/README.md`; verify `Index` in `design/README.md`; move the story `Status` to `done` and update the table in `stories/README.md`. | architect |

## Related

- [../design/content-authoring.md](../design/content-authoring.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/content-archetypes.md](../design/content-archetypes.md)
- [../design/audio.md](../design/audio.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/logging.md](../design/logging.md)
- [../design/testing.md](../design/testing.md)
