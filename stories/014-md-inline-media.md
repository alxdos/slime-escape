# MD Inline Media and Audio Sets

- Status: done
- Created: 2026-04-23
- Updated: 2026-04-23 (T10: the closing pass — `content:build`, `content:check`, `npm test`, `npm run build`, and broken PNG/MP3 smoke — passed; story moved to `done`. T9: the `enemies` audio side moved to `# Sound sets` with inline audio-link cells, the legacy `## Sounds`/`## Voice` in `# Balance` are forbidden, generated audio is unchanged. T8: the `enemies` image side moved to H2 inline images for the 30 slime PNGs, the legacy `## Visual` is forbidden, generated visuals are unchanged. T7: `bosses` moved to H2 inline image for the sprite PNG, legacy `## Visual` forbidden, generated visuals unchanged. T6: `players` moved to H2 inline image for the sprite PNG, legacy `## Visual` forbidden, generated visuals unchanged. T5: `weapons` moved to H2 inline audio-link for `fire`, legacy `## Sound` forbidden, generated audio unchanged. T4: helper `sharedResourceSet` added for `# Sound sets`-style partitions, membership invariants, and a uniform sampleId-cell shape. T3: helpers `inlineMedia` added for inline image/audio-link and URL↔SampleRegistry cross-check. T2: the parser layer `inputStructure` exposes H2 `mediaNodes` and `MarkdownCell.inlineLink`. T1: design extensions written — `content-authoring.md` (inline media nodes as a derive source, shared resource set partition), `Updated` notes in `audio.md` and `sprite-assets.md`; story decomposed and moved to `in-progress`.)

## Game designer

- Sees: opening `content/enemies.md`, `content/bosses.md`, `content/players.md`, `content/weapons.md` in any MD viewer (a GitHub PR, VS Code preview, the IDE), the game designer sees the picture of every archetype right under its `## <id>` heading — and next to every weapon a clickable "listen to the shot" link. Slime sounds are no longer smeared across 30 rows with identical pools: they are gathered in a new `# Sound sets` partition with narrow comparison tables (one pack — one row), where each cell is a clickable sample.
- Can do: add a new slime/boss/weapon by inserting `![](../public/assets/...)` (for an image) or `[sample-id](../public/audio/...)` (for the firing sound) directly under its `## <id>`; add a new sound set as a single row in each table of the `# Sound sets` partition; move a slime to a different sound set by moving its `id` from one row of `## Members` to another. A typo in the path → the image does not render in the MD viewer (immediately visible) and `npm run content:build` fails with a clear message.

## Technical

- Architect work: extending `design/content-authoring.md` (inline media nodes as the authoritative source for derive fields, the path `../public/**` → public-relative URL via stripping a single prefix; a new "shared resource set with members" class as a partition inside one area); a `Updated` note in `design/audio.md` (sound sets as a way to define enemy audio mappings without losing the runtime contract); a `Updated` note in `design/sprite-assets.md` (the authoring surface for the PNG path moves from the MD column `image` to an inline image node; `SpriteVisualSpec` and the `worldSize` producer rule do not change).
- Changes happen **only in the generator** (`scripts/content-build/**`): the runtime shapes (`SpriteVisualSpec`, `EnemyAudioMapping`, `BOSS_AUDIO_MAPPINGS`, `WEAPON_AUDIO_MAPPINGS`, `SampleRegistry`, `AudioMappings.ts`, validators) **do not change**. The generator does an N→1 sound-set expansion in `enemies/renderAudio.ts`; consumer code keeps receiving `Record<enemyArchetypeId, EnemyAudioMapping>` byte-for-byte.
- The generator stays read-only with respect to MD: the author writes `![](…)` and `[sample-id](../public/audio/…)`, the generator only parses and extracts what it needs.

## Out of scope

- Inline `<audio>` HTML tags — we use plain markdown links; on GitHub the HTML audio is stripped, so a single format works in every viewer.
- A separate preview generator (`*.preview.md`/HTML) — the authoring surface stays in `content/<area>.md` itself.
- Extending the "shared resource set" pattern to drops, weapons, players, sprite palettes — only sound sets for enemies. The rest are future stories, when the pain appears.
- Cross-MD references (between `content/<area>.md` files) — sound sets live in the same area as enemies. Cross-area references are deferred to a separate story.
- Any changes to the runtime audio and sprite contracts — strictly out of scope. If it turns out a runtime change is required, that is a stop sign, not an excuse to widen the scope.

## Acceptance

- In `content/{enemies,bosses,players}.md` every `## <id>` contains an inline `![alt](../public/assets/<file>.png)` between the H2 and the `field|value` table. This does not exist before — add it for every live archetype. The columns/groups like `## Visual` with `image` in `# Balance` go away: the sprite path comes from the inline image node, not from a table.
- In `content/weapons.md` every `## <id>` contains an inline markdown link `[sample-id](../public/audio/...)` between the H2 and the `field|value` table. The `## Sound` group in `# Balance` goes away: the `fire` sample id comes from the inline link node.
- In `content/enemies.md` a new partition `# Sound sets` appears with four narrow tables: `## Members` (`setId | slimes`), `## Hit` (`setId | s1 | s2 | s3 | s4`), `## Death` (the same), `## Voice` (the same). The `## Sounds` and `## Voice` groups in `# Balance` are removed. For MVP — one set `default` listing all 30 slimes; the runtime mapping for every slime after generation is byte-for-byte identical to what it was before this story. Partition template:

  ```markdown
  # Sound sets

  ## Members

  | setId   | slimes |
  |---------|--------|
  | default | slime-one-eye, slime-hornling, slime-many-eye, … (all 30) |

  ## Hit

  | setId   | s1                                                          | s2                                                          | s3                                                          | s4                                                          |
  |---------|-------------------------------------------------------------|-------------------------------------------------------------|-------------------------------------------------------------|-------------------------------------------------------------|
  | default | [slimes/hit-1](../public/audio/slimes/hit-1.mp3)            | [slimes/hit-2](../public/audio/slimes/hit-2.mp3)            | [slimes/hit-3](../public/audio/slimes/hit-3.mp3)            | [slimes/hit-4](../public/audio/slimes/hit-4.mp3)            |

  ## Death

  | setId   | s1                                                          | s2                                                          | s3                                                          | s4                                                          |
  |---------|-------------------------------------------------------------|-------------------------------------------------------------|-------------------------------------------------------------|-------------------------------------------------------------|
  | default | [slimes/death-1](../public/audio/slimes/death-1.mp3)        | [slimes/death-2](../public/audio/slimes/death-2.mp3)        | [slimes/death-3](../public/audio/slimes/death-3.mp3)        | [slimes/death-4](../public/audio/slimes/death-4.mp3)        |

  ## Voice

  | setId   | s1                                                          | s2                                                          | s3                                                          | s4                                                          |
  |---------|-------------------------------------------------------------|-------------------------------------------------------------|-------------------------------------------------------------|-------------------------------------------------------------|
  | default | [slimes/voice-1](../public/audio/slimes/voice-1.mp3)        | [slimes/voice-2](../public/audio/slimes/voice-2.mp3)        | [slimes/voice-3](../public/audio/slimes/voice-3.mp3)        | [slimes/voice-4](../public/audio/slimes/voice-4.mp3)        |
  ```

  Adding a second pack — one new row in each of the four tables with the same `setId`. Moving a slime to a different pack — moving its `id` from the `## Members` row of one `setId` to the row of another.
- The generator validates:
  - every `id` from `## Members.slimes` exists in `# Enemies`;
  - every `id` from `# Enemies` belongs to **exactly one** sound set (not zero, not two);
  - the URL in any media node starts with `../public/` and resolves to an existing file on disk; absolute `/assets/...`, `http(s)://...`, and any other prefixes are an error;
  - the sample id extracted from the URL exists in `SampleRegistry`.
- For any error (broken path, missing file, slime in two sets, slime in no sets, missing image node in the H2 of a sprite-area archetype, missing audio link in the H2 of a weapon) — `content:build` fails atomically with the message `content/<area>.md: section "## …": <expected>`, and the target files are not modified.
- Game behaviour **does not change**: after `npm run content:build` every `.generated.ts` keeps the same runtime meaning as before the story. `npm test` is green, `npm run build` is green, gameplay-regression tests are green.
- Demo (sprite preview): open `content/enemies.md` in a GitHub PR viewer — every slime is visible as a picture between the heading and the table. Change the sprite path of one slime to a non-existent one — `content:build` fails with `cannot read PNG …`.
- Demo (sound listening): open `content/weapons.md` in VS Code/GitHub — clicking the link near `## pistol` plays the shot in an external player. Change the path — `content:build` fails with `unknown sample id …`.
- Demo (sound set): open the `# Sound sets` partition of `content/enemies.md` — clicking any of the 12 samples in the `## Hit`/`## Death`/`## Voice` tables plays the matching sound. Move one slime id from the `default` row to a new second row in `## Members` (creating a second set with a different sample lineup) — after `content:build` that single slime sounds different in game; the other 29 are unchanged.

## Tasks

T1 is already done in this very architect pass (extending `design/content-authoring.md`, `Updated` notes in `design/audio.md` and `design/sprite-assets.md`); marked `[x]` when the story moves to `in-progress`. T2–T4 are build-time infrastructure extensions; T5–T9 are per-area migrations (each = bytes-equal `.generated.ts` + edits to the matching `content/<area>.md`); T10 is closing.

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Architect: write the design extensions — `design/content-authoring.md` (sections "Inline media nodes as derive sources" and "Shared resource set partition", clarify the role of inline nodes in the definitions partition, new entries in "Forbidden patterns"); a `Updated` note in `design/audio.md` (sound sets as a way to define enemy audio mappings without changing runtime shapes); a `Updated` note + the rule "MD column `image`" in `design/sprite-assets.md` (the authoring surface is an inline image node; the runtime contract `SpriteVisualSpec` does not change); decompose T2–T10, move `Status` to `in-progress`, update the table in `stories/README.md`. | architect |
| T2 | [x] | Extend the parser layer `scripts/content-build/parse/inputStructure.ts`: for every `MarkdownSection` expose `mediaNodes: ReadonlyArray<{ kind: 'image' \| 'link'; alt?: string; label?: string; url: string; position: SourcePosition }>`, gathered from `paragraph` nodes under the H2 (outside tables). In parallel, for `MarkdownCell`, store `inlineLink: { label: string; url: string } \| null` if the cell consists of exactly one link node with no extra text (for shared resource set partition cells). The parser does not validate semantics — only shape. Unit tests in `scripts/content-build/parse/inputStructure.test.ts`: image node and link node under H2; link cell; plain cell; mixed text + link cell → `inlineLink === null`. | basis: `design/content-authoring.md` |
| T3 | [x] | Helpers `scripts/content-build/util/inlineMedia.ts`: `requireInlineImage(section, opts)` → `{ url: publicRelativePath, absolutePath }` (validates the `../public/` prefix with a strip and the file's existence; bubbling message `content/<area>.md: section "## <id>": expected ![…](../public/…) under H2`); `requireInlineAudioLink(section, sampleRegistry)` → `{ sampleId, url, absolutePath }` (validates "exactly one audio link under H2", link text ∈ `SampleRegistry`, URL after strip byte-for-byte == `SampleRegistry[sampleId].url`); `requireInlineAudioLinkCell(cell, sampleRegistry)` for use inside group tables of a shared resource set partition (the same dual validation, no requirement of presence). All helpers are pure, with no hidden state. Unit tests in `util/inlineMedia.test.ts`: happy path (image), happy path (audio link H2), happy path (audio link cell), broken prefix, missing file, unknown sampleId, mismatched URL/registry, missing node where required. | basis: `design/content-authoring.md` |
| T4 | [x] | Helper `scripts/content-build/util/sharedResourceSet.ts`: `parseSharedResourceSetPartition(partition, opts)` → `{ members: ReadonlyMap<archetypeId, setId>; groups: ReadonlyMap<groupName, ReadonlyMap<setId, ReadonlyArray<MarkdownCell>>> }`. Validates the shared invariants ("exactly one set per archetype", "unknown setId", "unknown archetypeId in `## Members`"); the required-group check is an option `requiredGroups: ReadonlyArray<string>`. Helper `expandSetToMembers(members, perSetValue)` → `ReadonlyMap<archetypeId, value>` (a pure N→1 expansion). A helper for `sampleId` cells with detection of a uniform table shape (plain vs inline audio link, no mix in a single group table). Unit tests in `util/sharedResourceSet.test.ts`: happy path with one and two sets; archetype in two sets; archetype in no set; unknown setId in a group table; missing required group; mixed cell shapes in a single group table. | basis: `design/content-authoring.md` |
| T5 | [x] | Migrate the `weapons` area: edit `scripts/content-build/weapons/parse.ts` — `fire` for every weapon archetype is read via `requireInlineAudioLink` from H2; the `## Sound` group in `# Balance` is forbidden (the generator fails when it appears). Edit `content/weapons.md`: add an inline `[<sample-id>](../public/audio/...)` under each `## <id>`, remove the `## Sound` group. After `npm run content:build` `src/main/audio/weaponAudio.generated.ts` stays **byte-for-byte** identical; `content:check` is green. | basis: T2, T3 |
| T6 | [x] | Migrate the `players` area: edit `scripts/content-build/players/parse.ts` — the PNG path for every player archetype is read via `requireInlineImage` from H2; the `## Visual` group in `# Balance` is forbidden. Edit `content/players.md`: add inline `![alt](../public/assets/...)` under each `## <id>`, remove the `## Visual` group. `src/main/render/playerVisuals.generated.ts` byte-for-byte identical; `content:check` green. | basis: T2, T3 |
| T7 | [x] | Migrate the `bosses` area: edit `scripts/content-build/bosses/parse.ts` — the PNG path is read via `requireInlineImage`; the `## Visual` group is forbidden. Edit `content/bosses.md`: an inline image node under each `## <id>`, remove `## Visual`. `src/main/render/bossVisuals.generated.ts` byte-for-byte identical. | basis: T2, T3 |
| T8 | [x] | Migrate enemies — image: edit `scripts/content-build/enemies/parse.ts` — the PNG path is read via `requireInlineImage`; the `## Visual` group in `# Balance` is forbidden. Edit `content/enemies.md`: an inline image node under each of the 30 `## <id>`s, remove `## Visual`. `src/main/render/enemyVisuals.generated.ts` byte-for-byte identical. (The sound-set changes are a separate task T9 so the two independent migrations inside one MD file can be reviewed separately.) | basis: T2, T3 |
| T9 | [x] | Migrate enemies — sound sets: edit `scripts/content-build/enemies/parse.ts` to read the `# Sound sets` partition via `parseSharedResourceSetPartition` (`## Members` with header `setId | slimes`; required groups `## Hit`, `## Death`, `## Voice`, each with header `setId | s1 | s2 | s3 | s4`); the `## Sounds` and `## Voice` groups in `# Balance` are forbidden. The parser performs the N→1 expansion and feeds `enemies/renderAudio.ts` the same per-enemy `{ hit, death, voice.sampleIds }` as before — the resulting `src/main/audio/enemyAudio.generated.ts` stays **byte-for-byte** identical (for MVP — one set `default` listing all 30 slimes; cells in the inline audio-link form). Edit `content/enemies.md`: add the new `# Sound sets` partition per the template in `Acceptance`, remove `## Sounds` and `## Voice` from `# Balance`. The partition-invariant tests (slime in zero/two sets, unknown setId, missing required group) live at the T4 level; here it is the area-level `scripts/content-build/enemies/enemies.test.ts` (smoke + bytes-equal). | basis: T2, T3, T4 |
| T10 | [x] | Closing: `npm run content:build` (atomic success on a clean tree), `npm run content:check` (zero diff against the committed output), `npm test` and `npm run build` green; gameplay-regression tests still green. Manual demos from `Acceptance`: (1) the PR viewer shows the sprite preview under each slime/boss/hero H2; (2) clicking `[…](…)` in `## pistol` plays the MP3 in a player; (3) clicks on the 12 cells in `# Sound sets` play the expected samples; (4) an intentionally broken PNG/MP3 path — `content:build` fails with a clear message and no `.generated.ts` is modified. The architect moves the story `Status` to `done` and updates the table in `stories/README.md`. | architect |

## Related

- [../design/content-authoring.md](../design/content-authoring.md)
- [../design/audio.md](../design/audio.md)
- [../design/sprite-assets.md](../design/sprite-assets.md)
- [011-content-from-md.md](011-content-from-md.md)
- [012-content-archetypes-from-md.md](012-content-archetypes-from-md.md)
- [013-sprite-assets-and-loader.md](013-sprite-assets-and-loader.md)
