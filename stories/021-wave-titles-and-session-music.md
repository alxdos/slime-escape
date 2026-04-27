# Wave Titles and Session Music

- Status: in-progress
- Created: 2026-04-26
- Updated: 2026-04-26 (architecture preparation: contracts moved into design/)

## Player-facing

- Sees: before every wave a large title appears over the arena for a few seconds. The first line states the wave's global number in the session (`Wave 1`, `Wave 2`, `Wave 3`, ...); the second line, if set in content, gives an artistic wave name (`Stone Stares`). Slimes only start coming out after the title.
- Sees: in short break windows after a boss a transitional text may appear, for example `Up next: Industrial mutants`. It is not a menu or a card — the same bright title text over the arena.
- Hears: regular music is no longer picked at random from a hardcoded pool. Each session has its own track that plays through every regular wave and break. On a boss encounter the music temporarily switches to the current boss track; after the boss the session track returns.
- Feels: the campaign reads like one chapter at a time: a set is announced by a short break text, a wave is announced by its number and name, and the session music holds the overall tone of the run.

## Technical

The story adds presentation fields on encounters (`introDurationMs`/`name`/`text`), a session-level regular music (`musicSampleId`), and a separate UI title-overlay layer on top of the existing MD system from 015. The architectural contracts are in design/:

- The encounter field shape, paired constraints by `type`, intro delay for `SpawnSystem`/`ZoneSystem`/`SessionFlowSystem`, global numbering of wave encounters, the wave/break overlay render contract — [encounter-presentation.md](../design/encounter-presentation.md).
- `SessionDefinition.musicSampleId: string | null` and the link to audio validation — [session-definition.md](../design/session-definition.md).
- The source of regular music = `attachedSession.musicSampleId`, the boss override is preserved, `category: 'music'` ⇒ `loop: true`, `musicSampleId` must reference a music-category sample — [audio.md](../design/audio.md).
- Authoring: `# Session` gains the field `musicSampleId` (`none` → `null`); the encounter field|value gains `introDurationMs`/`name`/`text` with hard errors on paired-constraint violations — [content-authoring.md](../design/content-authoring.md).

The HUD wave numbering, the overlay, and the result screen use the global order of wave encounters (per [main-ui-shell.md](../design/main-ui-shell.md) and [encounter-presentation.md](../design/encounter-presentation.md)). The snapshot is not extended: intro activity is derived from `snapshot.encounter.elapsedMs` and `SessionDefinition.encounters[i].introDurationMs`.

### Visual style

- The overlay is not a card and does not block the arena view with a decorative panel.
- The text is centred over the viewport/arena, on top of the gameplay canvas/HUD.
- Letters are bright and light, with a black outline and a contrasting shadow. Reference:
  - the first line (`Wave 3`) is smaller, uppercase or small-caps allowed;
  - the second line (`Stone Stares`) is larger and more expressive;
  - `-webkit-text-stroke`/equivalent stroke 2-3 px in black;
  - several layered `text-shadow` for readability over the bright set-1/set-2/set-4/set-5 backgrounds;
  - fade in / hold / fade out without layout jumps.
- The text must fit on mobile and desktop. Long names wrap to at most two subtitle lines, without negative letter-spacing and without viewport-width-driven font-size.

### Content naming

The prototype comments are not copied verbatim. Names should match the current archetypes and PNG sprites.

Current set map:

| set | theme | current main slimes | boss |
|---|---|---|---|
| set-1 | First slimes | One-Eye, Sleeper, Hornling, Spark, Many-Eye, Stonehead | Gargoyle Slime |
| set-2 | Junk ghosts | Trickster, Wraith, Shell, Stack, Mech Crab, Flame | Saw Cyclops |
| set-3 | Industrial mutants | Echo, Bug, Star, Lifter, Drone, Saw, Idol on hard | Scrap King |
| set-4 | Kingdom at war | Tadpole, Fortress, Splitter, Prince, Dasher, Kingling, Idol/Mech Crab on hard | Tower Sentinel |
| set-5 | Techno-final | Door, Candle, Mech, Clamper, Obelisk, Ninja, Idol on hard | Bubble Hog |

Suggested wave names for normal/hard:

| encounter pattern | name |
|---|---|
| campaign-set-1-wave-1 | One Eye in the Dark |
| campaign-set-1-wave-2 | Horns and Sparks |
| campaign-set-1-wave-3 | Stone Stares |
| campaign-set-2-wave-1 | Shells and Ghosts |
| campaign-set-2-wave-2 | Heap of Junk |
| campaign-set-2-wave-3 | Burning Scrap |
| campaign-set-3-wave-1 | Echoes in Gas Masks |
| campaign-set-3-wave-2 | Lifters and Drones |
| campaign-set-3-wave-3 | The Sawmill Shop |
| campaign-set-4-wave-1 | Bombs at the Gate |
| campaign-set-4-wave-2 | Princes and Shuriken |
| campaign-set-4-wave-3 | Crown of the Dead |
| campaign-set-5-wave-1 | Discs and Engines |
| campaign-set-5-wave-2 | Magnets and Ninjas |
| campaign-set-5-wave-3 | Idols of the Last Sector |

Easy uses set-1 / set-3 / set-5 only, two waves each. For easy you can reuse the names of the first two waves of the matching sets.

Suggested after-boss break texts:

| break | text |
|---|---|
| campaign-set-1-after-boss-break | Up next: Junk Ghosts |
| campaign-set-2-after-boss-break | Up next: Industrial Mutants |
| campaign-set-3-after-boss-break | Up next: Kingdom at War |
| campaign-set-4-after-boss-break | Up next: Techno-Final |

There is no after-boss break for the final boss after set-5, since the campaign ends on the boss encounter. The final outro/result overlay is not part of this story.

## Out of scope

- Per-wave music, per-set music, and crossfades between sets. In this story the regular track is one for the whole session.
- Per-boss custom music in content. All boss encounters use the current `boss/boss-music`.
- New music, new mp3 files, normalisation/mastering of tracks. We can only wire already-present files from `public/sfx/music/` into the registry.
- Renaming enemy `displayName` / `id` for the sake of artistic wave names. The story adds player-facing encounter texts; it does not change archetypes.
- Localisation into multiple languages. All new campaign texts are written in the same language as today's campaign `displayName`s.
- Landing pages, separate cutscene screens, set illustrations, slime portraits in the title.
- Saving/skipping the intro by a button. The player waits a short fixed intro.
- Changes to the HUD wave progress. The existing HUD may keep its progress line; the overlay is a separate layer.
- Changing boss music behaviour beyond returning to the session track after a boss.

## Acceptance

- At the start of every wave with `introDurationMs > 0` an overlay appears. While the overlay is up `waveProgress.dispatched` stays `0`, enemy count does not grow, and the zone stays at the starting margin.
- After the intro ends the first wave starts spawning slimes per the existing `spawnIntervalMs`, and the zone starts shrinking from the zero point of its wave timer.
- The overlay shows the global number: `campaign-set-2-wave-1` is shown as `Wave 4`, not `Wave 1`.
- The overlay does not show "Wave 1" from markdown: the number is computed from `session.encounters`.
- If `name` is set, two lines are visible; if `name` is missing, only the number line is visible.
- A break with `text` shows that text during the break encounter and disappears on the transition to the next encounter.
- The overlay text is readable across every current background (`bg-01`..`bg-05`): bright light letters, black outline, contrasting shadow, no card.
- All campaign session files pass `npm run content:check`: `name`, `introDurationMs`, `text`, `musicSampleId` are parsed and land in the generated content.
- `content:check` fails if `musicSampleId` is unknown or refers to a sample whose `category` is not `music`.
- For a session with `musicSampleId: none` the regular music does not start.
- For a session with `musicSampleId: music/005-forest` regular wave/break encounters play exactly that track, no random pool.
- On entering a boss encounter `boss/boss-music` starts; on leaving the boss encounter the current session's `musicSampleId` resumes.
- In `menu` / `result` / `loading` / `error` music stops as before this story.
- Pause does not change the track, only ducks the music gain, as before.
- `npm run content:check && tsc -p tsconfig.scripts.json && npm run typecheck && npm test` pass.
- Visual check via the dev server: starting the normal campaign shows `Wave 1 / One Eye in the Dark`, slimes appear only after the title; after the first boss `Up next: Junk Ghosts` appears; boss music turns on for the boss and goes back to the session music after.

## Tasks

The architecture pass is already closed in one PR (`[021 architect]`) — every contract in `design/` is accepted. Code tasks proceed sequentially, each as a separate commit on the same branch.

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Architectural preparation: new [encounter-presentation.md](../design/encounter-presentation.md); updates to [session-definition.md](../design/session-definition.md), [audio.md](../design/audio.md), [content-authoring.md](../design/content-authoring.md), [spawn-plan.md](../design/spawn-plan.md), [zone.md](../design/zone.md), [main-ui-shell.md](../design/main-ui-shell.md), `design/README.md`; updating the story's `Related`/`Technical`/`Tasks`. | Architect branch, no edits in `src/**` or `content/**`. |
| T2 | [x] | Extend shared types in `src/shared/session.ts` and adjacent: `SessionDefinition.musicSampleId: string \| null`; `EncounterDefinition` gains **mandatory** `introDurationMs: number`, `name: string \| null`, `text: string \| null` (a flat shape, without `?`). | Invariant — an empty `name`/`text` is forbidden, the value is either `null` or a non-empty string. TS fixtures in tests are filled in explicitly, without a backward-compat shim. |
| T3 | [x] | `scripts/content-build/sessions/**`: parse `musicSampleId` in the first `# Session` table (`none` → `null`, plain → cross-check via `SampleRegistry` + `category: 'music'`); parse `introDurationMs`/`name`/`text` in encounter field\|value (`none` → `null`/`0`); hard error on paired-constraint violations from [encounter-presentation.md](../design/encounter-presentation.md). | Error messages with `file:line`; unit tests in T8. |
| T4 | [x] | Update all `content/sessions/*.md` (the three campaigns + `training`/`sandbox`/`sandbox-with-combat`/`combat-modifiers-demo`): add `musicSampleId` (`none` for sandboxes, an explicit track for the campaigns); add `introDurationMs: 2500` and `name` from the Content naming section to campaign waves; add `text` to after-boss breaks and bump `transitionDurationMs` if needed. | Content, not code. Regenerate `sessions.generated.ts` via `content:build`. |
| T5 | [x] | `Audio`: remove `REGULAR_MUSIC_POOL` and `lastRegularMusicSampleId`, the source of regular music = `attachedSession.musicSampleId`; do not touch the boss override or pause ducking; in `SampleRegistry` set `loop: true` for every entry with `category: 'music'`; in `createAudio`/`attach` add the validations from [audio.md](../design/audio.md). | Fill in `SampleRegistry` with every already-present `/sfx/music/*.mp3` if the content needs them. |
| T6 | [x] | Implement intro delay in sim: `SpawnSystem`, `ZoneSystem`, and `SessionFlowSystem` honour `encounter.elapsedMs < encounter.introDurationMs` per the rules in [encounter-presentation.md](../design/encounter-presentation.md); `'allEnemiesCleared'` is suppressed during intro. | `encounter.elapsedMs` is already in the snapshot — no extra fields needed. |
| T7 | [x] | Implement the wave/break title overlay in `src/main/ui/**`: a separate component, wired by `UiShell` next to `Hud`; data — `SessionDefinition` + `snapshot.encounter`; global numbering across every wave encounter; show condition and z-order — per [encounter-presentation.md](../design/encounter-presentation.md). | Do not make a card. Styles (outline, shadow, fade) — the Visual style section of this story. |
| T8 | [x] | content-build tests: a valid `musicSampleId`, `none`, an unknown sample, a non-music-category sample; `introDurationMs`/`name`/`text` with valid combinations and hard errors on paired-constraint violations. | Unit tests on top of `scripts/content-build/sessions/**`. |
| T9 | [x] | sim/UI/audio tests: global wave numbering across break/boss boundaries; delayed spawn and zone during intro; `allEnemiesCleared` does not trigger during intro, including a `spawnPlan: { kind: 'empty' }` wave; overlay lifecycle; session music → boss music → session music; `musicSampleId: null` = silent; `category: 'music'` && `!loop` = a module error. | `Hud.test.ts`, `Audio.test.ts`, `SessionFlowSystem` tests, a new overlay test. |
| T10 | [ ] | Final verification: `npm run content:check && tsc -p tsconfig.scripts.json && npm run typecheck && npm test`; dev-server visual/audio sanity. | Check the path: set-1 wave-1 (intro + name + first slime), set-1 pre-boss break, set-1 boss (musicSampleId → boss music), set-1 after-boss break (text), set-2 wave-1 (the global "Wave 4", not "Wave 1"). |

## Related

- [encounter-presentation.md](../design/encounter-presentation.md)
- [session-definition.md](../design/session-definition.md)
- [audio.md](../design/audio.md)
- [content-authoring.md](../design/content-authoring.md)
- [spawn-plan.md](../design/spawn-plan.md)
- [zone.md](../design/zone.md)
- [main-ui-shell.md](../design/main-ui-shell.md)
- [008-audio-baseline.md](008-audio-baseline.md)
- [015-sessions-from-md.md](015-sessions-from-md.md)
- [020-shooting-slimes.md](020-shooting-slimes.md)
