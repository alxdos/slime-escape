# Sprite Assets and Loader

- Status: done
- Created: 2026-04-23
- Updated: 2026-04-24 (documentation follow-up: `PX_PER_WU` references aligned to the current shared value `240`. Previously closed: PR #12 merged into `main`. The architect pass introduced `design/sprite-assets.md`, `design/body-contact-boxes.md`, and the extensions to `content-authoring.md`/`main-ui-shell.md`/`spawn-plan.md`. Code review closed the blockers: `PX_PER_WU = 240` lives in shared (`src/shared/sprite/spriteScale.ts`), the generator no longer imports from `src/main/**`, the splash min-duration is locked into the contract, `players` is split into `hero-sandbox`/`hero-training` without `maxHp` drift, session spawn-fit moved to `contactBox`. Known follow-up tracked as a small separate story: call `validateEnemyVisuals`/`validateBossVisuals`/`validatePlayerVisuals` at session start (today an orphan archetype/visual is only caught lazily by the renderer).)

## Player-facing

- Sees: when the app starts, a white splash with `public/images/slime-escape.jpg` fitted via `contain` and a loader at the bottom of the screen. After loading, the game renders the hero, slimes, and the boss as PNG sprites from `public/assets`, with no circular fallback visuals.
- Can do: launch training or campaign and play as before, but see a real character, every active slime, and the boss as images. All 30 slimes and 5 bosses are wired into content so future waves can reference their `id`.

## Technical

- This is a vertical story: MD content, generator, preload, startup UI, and renderer must all converge on a demoable result. The story is not done if the assets are merely described while the game still draws circles.
- It builds on the completed 012: `scripts/content-build/` already knows the `enemies`/`weapons`/`drops`/`bosses` areas, the handwritten `<area>.ts ↔ <area>.generated.ts` pairs are alive. Story 013 extends the existing areas with a new balance group `## Visual` and introduces a new `players` area from scratch.
- The visual-layer architectural contract — [../design/sprite-assets.md](../design/sprite-assets.md): one shared `SpriteVisualSpec` type, three separate visual registries next to the renderer (`playerVisuals.{ts,generated.ts}`, `enemyVisuals.{ts,generated.ts}`, `bossVisuals.{ts,generated.ts}`), a single constant `PX_PER_WU = 240` in `src/shared/sprite/spriteScale.ts`.
- In MD the author only specifies `image` (a path from `public/`) and gameplay intent (`displayName`, gameplay numbers). PNG pixel size and derived `worldSize` are not written in MD: the rule "no MD column for a derive field" from [../design/content-authoring.md](../design/content-authoring.md), section "External assets as a source of derive fields". The generator reads the PNG via `scripts/content-build/util/pngSize.ts` and recomputes derive fields on every `content:build`.
- Simulation keeps working with gameplay fields (`radius`, `maxHp`, `speed`, damage) and does not read the visual registry directly. After [../design/body-contact-boxes.md](../design/body-contact-boxes.md) and [../design/projectiles-and-combat.md](../design/projectiles-and-combat.md), the `contactBox` for `player` / `enemy` / `boss` is used both for body contact and for projectile hit detection; `radius` only remains for unmigrated consumers.
- A manual visual QA revealed that circular body-contact does not match the rectangular sprite bodies. The follow-up contract — [../design/body-contact-boxes.md](../design/body-contact-boxes.md): for `player` / `enemy` / `boss` the shared content and the runtime gain a derived `contactBox` equal to the sprite's `worldSize`; `CombatSystem` switches body contact to box-vs-box and projectile hit detection to circle-vs-contactBox, while `MovementSystem` clamps the player by box, not by `radius`.
- The renderer for `player`/`enemy`/`boss` only uses preloaded textures. A missing texture, missing visual spec, or `archetypeId` mismatch with the visual registry is a hard error at start/in tests, not a fallback to `CircleGeometry`/`color`. After [../design/sprite-assets.md](../design/sprite-assets.md) the renderer no longer reads `EnemyArchetype.color`/`BossArchetype.color`; the field stays in the archetypes as a content placeholder.
- All PNGs listed in the generated visual registries are loaded and decoded before the menu is shown. Lifecycle is described in [../design/main-ui-shell.md](../design/main-ui-shell.md), the new starting phase `loading` (splash + progress) and the terminal `error('preload')` (explicit error + reload). Lazy loading during combat is forbidden.
- `content/enemies.md` extends from two combat slimes to all 30 assets. The current `slime-fast`/`slime-tank` are replaced by new meaningful archetype ids; training and campaign waves move to the new ids with similar difficulty; the campaign boss moves to `boss-scrap-king` (or an explicitly chosen replacement).
- `content/bosses.md` lists all 5 bosses. The campaign may keep using a single active boss, but the renderer and preload must be able to draw any boss from the registry.
- A new content area **players** is introduced with its own `content/players.md`: gameplay/visual archetypes `hero-sandbox` and `hero-training` (a shared PNG, different session gameplay fields like `maxHp`). This is the first inclusion of the `players` area in the MD pipeline; the other "session-composition" areas (`sessions`, `arenas`, `presets`) remain out of scope.
- The "Asset Authoring Baseline" section below is an illustration of the **values** for the game designer, not the format of the final MD. In the actual `content/{enemies,bosses,players}.md` the columns are split into narrow groups (`## Body`, `## Movement`, `## Contact damage`, `## Knockback`, `## Drops`, `## Sounds`, `## Voice`, `## Visual`) exactly as in the current `content/enemies.md` after 011/012, honouring the [../design/content-authoring.md](../design/content-authoring.md) rule "at most five columns (`id` + ≤4 fields)".
- `training-target` currently lives in `content/enemies.md` as a stationary stub from story 003 and is used in `sandbox-with-combat` plus in ~13 sim/audio unit/integration tests as a convenient "stationary, no damage, low HP" fixture. In this story it is fully removed: `ENEMY_BEHAVIOR === 'stationary'` stays in the type as an allowed value, but with no live archetypes. Tests that currently import `TRAINING_TARGET` move to local test fixtures (for example, `makeStationaryTestEnemy({ id })` next to the test) or to real chase archetypes where stationary is not essential. This decouples sim tests from production content.

### Asset Authoring Baseline

These rows fix the starting gameplay description for the MD. The tables intentionally do not include `sourceSizePx`, `displayWidthPx`, `displayHeightPx`, or `worldSize`: the generator must recompute them from the original PNGs on every `npm run content:build`.

#### Player

| id | image | displayName | radius | maxSpeed |
|----|-------|-------------|---:|---:|
| hero | `/assets/hero.png` | Hero | 0.5 | 6 |

#### Slimes

| id | image | displayName | radius | maxHp | maxSpeed | contactDamage | contactCooldownMs | dropChance |
|----|-------|-------------|---:|---:|---:|---:|---:|---:|
| slime-one-eye | `/assets/slime-01.png` | One-Eye Slime | 0.40 | 1 | 4.0 | 1 | 800 | 0.25 |
| slime-hornling | `/assets/slime-02.png` | Hornling Slime | 0.50 | 2 | 3.3 | 1 | 850 | 0.30 |
| slime-many-eye | `/assets/slime-03.png` | Many-Eye Slime | 0.60 | 3 | 2.2 | 2 | 950 | 0.35 |
| slime-stonehead | `/assets/slime-04.png` | Stonehead Slime | 0.72 | 6 | 1.5 | 2 | 1000 | 0.60 |
| slime-sleeper | `/assets/slime-05.png` | Sleeper Slime | 0.45 | 2 | 1.0 | 1 | 1000 | 0.20 |
| slime-spark | `/assets/slime-06.png` | Spark Slime | 0.35 | 1 | 5.2 | 1 | 700 | 0.18 |
| slime-wraith | `/assets/slime-11.png` | Wraith Slime | 0.48 | 2 | 3.5 | 1 | 800 | 0.25 |
| slime-shell | `/assets/slime-12.png` | Shell Slime | 0.65 | 5 | 1.7 | 2 | 1000 | 0.55 |
| slime-flame | `/assets/slime-13.png` | Flame Slime | 0.44 | 2 | 3.8 | 2 | 900 | 0.30 |
| slime-mech-crab | `/assets/slime-14.png` | Mech Crab Slime | 0.62 | 4 | 2.0 | 2 | 950 | 0.45 |
| slime-stack | `/assets/slime-15.png` | Stack Slime | 0.58 | 3 | 2.4 | 1 | 900 | 0.35 |
| slime-trickster | `/assets/slime-16.png` | Trickster Slime | 0.52 | 3 | 3.2 | 1 | 850 | 0.30 |
| slime-bug | `/assets/slime-21.png` | Bug Slime | 0.48 | 2 | 3.6 | 1 | 800 | 0.25 |
| slime-lifter | `/assets/slime-22.png` | Lifter Slime | 0.70 | 6 | 1.6 | 3 | 1100 | 0.60 |
| slime-saw | `/assets/slime-23.png` | Saw Slime | 0.55 | 3 | 3.0 | 2 | 900 | 0.40 |
| slime-drone | `/assets/slime-24.png` | Drone Slime | 0.42 | 1 | 4.8 | 1 | 750 | 0.20 |
| slime-star | `/assets/slime-25.png` | Star Slime | 0.38 | 1 | 5.0 | 1 | 700 | 0.18 |
| slime-echo | `/assets/slime-26.png` | Echo Slime | 0.36 | 1 | 4.4 | 1 | 750 | 0.15 |
| slime-splitter | `/assets/slime-31.png` | Splitter Slime | 0.56 | 3 | 2.8 | 1 | 900 | 0.35 |
| slime-prince | `/assets/slime-32.png` | Prince Slime | 0.66 | 4 | 2.2 | 2 | 950 | 0.45 |
| slime-kingling | `/assets/slime-33.png` | Kingling Slime | 0.74 | 7 | 1.7 | 3 | 1100 | 0.65 |
| slime-fortress | `/assets/slime-34.png` | Fortress Slime | 0.80 | 8 | 1.2 | 3 | 1200 | 0.70 |
| slime-dasher | `/assets/slime-35.png` | Dasher Slime | 0.46 | 2 | 4.6 | 2 | 850 | 0.25 |
| slime-tadpole | `/assets/slime-36.png` | Tadpole Slime | 0.34 | 1 | 4.2 | 1 | 750 | 0.15 |
| slime-door | `/assets/slime-41.png` | Door Slime | 0.76 | 7 | 1.1 | 2 | 1100 | 0.65 |
| slime-mech | `/assets/slime-42.png` | Mech Slime | 0.70 | 6 | 1.8 | 3 | 1050 | 0.55 |
| slime-clamper | `/assets/slime-43.png` | Clamper Slime | 0.52 | 3 | 3.0 | 2 | 900 | 0.35 |
| slime-candle | `/assets/slime-44.png` | Candle Slime | 0.46 | 2 | 3.4 | 1 | 850 | 0.25 |
| slime-obelisk | `/assets/slime-45.png` | Obelisk Slime | 0.50 | 4 | 2.0 | 2 | 1000 | 0.40 |
| slime-ninja | `/assets/slime-46.png` | Ninja Slime | 0.54 | 4 | 4.0 | 3 | 950 | 0.35 |

All slimes use `behavior: chase`. Knockback remains explicit in MD; starter values are `baseImpulse=8, velocityScale=1.5, durationMs=350` for speed `>= 4`, `baseImpulse=5, velocityScale=1.0, durationMs=280` for speed `2..3.9`, and `baseImpulse=3, velocityScale=0.5, durationMs=220` for speed `< 2`. The generated MD rows must contain the concrete numbers, not implicit defaults.

#### Bosses

| id | image | displayName | radius | maxHp | maxSpeed | contactDamage | contactCooldownMs |
|----|-------|-------------|---:|---:|---:|---:|---:|
| boss-gargoyle | `/assets/boss-01.png` | Gargoyle Slime | 1.15 | 35 | 3.2 | 2 | 800 |
| boss-saw-cyclops | `/assets/boss-02.png` | Saw Cyclops | 1.25 | 45 | 2.4 | 3 | 900 |
| boss-scrap-king | `/assets/boss-03.png` | Scrap King | 1.35 | 40 | 3.0 | 2 | 800 |
| boss-tower-sentinel | `/assets/boss-04.png` | Tower Sentinel | 1.30 | 50 | 1.8 | 3 | 1000 |
| boss-bubble-hog | `/assets/boss-05.png` | Bubble Hog | 1.20 | 42 | 2.6 | 2 | 850 |

Bosses reuse the existing boss phase/attack patterns for this story unless a boss-specific behavior story supersedes it. `boss-scrap-king` is the initial campaign boss replacement for the current `slime-king` behavior.

## Out of scope

- Animations, atlases/spritesheets, directional frames, hit/death animations, shader effects.
- New boss attack patterns and unique per-boss behaviour. The goal here is to register all boss archetypes and confirm the renderer can draw any of them.
- A wave editor and a full system for assembling wave sets out of all the new slimes. The story only registers all archetype ids and updates the current waves to the new ids.
- Replacing the audio pools with unique sounds per slime/boss.

## Acceptance

- `2240x1260` is explicitly fixed as the reference arena only for sprite-scale calculations; a test/generator check confirms the `16:9` aspect. `SANDBOX_ARENA` stays `32x18`, camera/frustum/physics/input mapping do not change.
- `content/enemies.md` contains all 30 slime archetypes from `public/assets/slime-*.png`. The `training-target` archetype is fully removed from MD and `ENEMY_ARCHETYPES`; `sandbox-with-combat` switches to `slime-bug` (id `slime-bug`, `radius 0.48`, `contactDamage 1`, `maxSpeed 3.6` — close in "ease of touch" to the current stationary dummy). The old combat `slime-fast`/`slime-tank` are no longer used in any active wave and also disappear from MD.
- `content/bosses.md` contains 5 boss archetypes from `public/assets/boss-*.png`; the campaign boss uses `boss-scrap-king` or an explicitly chosen replacement id.
- The player visual `hero` is described in MD and used by the renderer for the live player in every mode.
- The generator reads PNG dimensions from the files during `npm run content:build` and writes them into the generated visual registry. `sourceSizePx` matches the actual PNG size; `displaySizePx` for this story is recomputed from `sourceSizePx` without manual overrides; `worldSize = displaySizePx / 70`. If a PNG is removed, the path is wrong, the file is not a PNG, or the size cannot be read — generation fails before writing the output files.
- `content:check` catches drift if the PNG size or MD visual fields changed but `.generated.ts` was not updated. MD columns `sourceSizePx`, `displayWidthPx`, `displayHeightPx`, `displaySizePx`, `worldSize` are forbidden and must produce a generator error so dimensions never become a manual source of truth.
- The startup preloader loads and decodes every sprite image from the generated registry before the menu. During loading there is a white splash with `public/images/slime-escape.jpg` (`contain`) and a loader at the bottom. On a load error there is an explicit startup error; the game does not start with fallback graphics.
- The renderer for `player`, `enemy`, `boss` does not create circular fallback meshes. Tests verify that a missing visual spec/texture is an error, not `CircleGeometry`.
- In training the hero sprite and the new slime sprites are visible; in the campaign the boss sprite is visible. Existing firing, contact damage, HP, drops, win/loss, and pause/menu behaviour stay green in tests.
- `npm run content:build`, `npm run content:check`, `npm test`, and `npm run build` are green.

## Tasks

The architectural T1–T3 are already done in this very architect pass (introducing `design/sprite-assets.md`, extending `content-authoring.md`, extending `main-ui-shell.md`). They are marked `[x]` when the story moves to `in-progress` so we do not "redo what is already pinned in `design/`".

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Architect: new `design/sprite-assets.md` (visual registry, `SpriteVisualSpec`, `PX_PER_WU = 240`, asset-only renderer, hard-error policy, preload contract). Bump `Updated` in `design/content-archetypes.md` (`color` loses its renderer consumer for player/enemy/boss). Update `Index` in `design/README.md`. | architect |
| T2 | [x] | Architect: extend `design/content-authoring.md` — section "External assets as a source of derive fields", forbid MD columns for derive fields in "Forbidden patterns", include `players` in the list of known areas. Bump `Updated`. | architect |
| T3 | [x] | Architect: extend `design/main-ui-shell.md` — starting phase `loading`, terminal phase `error('preload')`, transitions, extended visibility table, restrictions "Renderer/InputController/Settings/SimWorkerHost do not exist in `loading`", section "Startup preload in the `loading` phase". Mark `Updated` in `design/audio.md` for the mappings extension. | architect |
| T4 | [x] | Generator utility: add `scripts/content-build/util/pngSize.ts` — a pure function `(absPath) → { width, height }` via a lightweight IHDR parser (the `image-size` dependency or a manual parser is an implementation detail). Error message `content/<area>.md row "<id>": cannot read PNG <path>: <reason>`. Unit tests for a good PNG, a corrupted PNG, a non-PNG. | basis: `design/content-authoring.md` |
| T5 | [x] | Common visual types and the constant: `src/main/render/SpriteVisualSpec.ts` (the `SpriteVisualSpec` type), `src/shared/sprite/spriteScale.ts` (`export const PX_PER_WU = 240` — the only scale source, enforced by a grep test). No area code. | basis: `design/sprite-assets.md` |
| T6 | [x] | Area `players` in the generator and content library: `scripts/content-build/players/{parse,renderContent,renderVisuals,index}.ts`; handwritten pair `src/shared/content/players.{ts,generated.ts}` (move `SANDBOX_PLAYER`/`TRAINING_PLAYER` into generated, keep types and the registry in `players.ts`); handwritten pair `src/main/render/playerVisuals.{ts,generated.ts}`. Header — temporary seed "regenerated by content-build after T9". At this step there is no MD yet — the generator fails with a clear "source not found". | basis: `design/content-authoring.md`, `design/sprite-assets.md` |
| T7 | [x] | Extend the `enemies` area in the generator for visuals: `scripts/content-build/enemies/renderVisuals.ts` → `src/main/render/enemyVisuals.generated.ts`, registration in `enemies/index.ts`, extension of `enemies/parse.ts` for the new `## Visual` balance group (`id | image`). Handwritten `src/main/render/enemyVisuals.ts` (type, registry, `validateEnemyVisuals`). Header — temporary seed. | basis: `design/content-authoring.md`, `design/sprite-assets.md` |
| T8 | [x] | Extend the `bosses` area in the generator for visuals: `scripts/content-build/bosses/renderVisuals.ts` → `src/main/render/bossVisuals.generated.ts`, registration, extension of `bosses/parse.ts` for `## Visual`. Handwritten `src/main/render/bossVisuals.ts` (type, registry, `validateBossVisuals`). Header — temporary seed. | basis: `design/content-authoring.md`, `design/sprite-assets.md` |
| T9 | [x] | Author `content/players.md`: `# Players` partition with `## hero-sandbox` and `## hero-training` (`field | value` for `displayName`); `# Balance` partition with `## Body` (`id | radius`), `## Movement` (`id | maxSpeed`), `## Health` (`id | maxHp`), `## Visual` (`id | image`). After convergence — final AUTO-GENERATED. | basis: `design/content-authoring.md`, `design/sprite-assets.md` |
| T10 | [x] | Author `content/enemies.md`: 30 slime archetypes from the story table (`slime-one-eye` … `slime-ninja`). `training-target`/`slime-fast`/`slime-tank` are fully removed from MD (no rows in Body/Movement/Contact/Knockback/Drops/Sounds/Voice/Visual). Groups: `## Body`, `## Movement`, `## Contact damage`, `## Knockback`, `## Drops`, `## Sounds`, `## Voice`, `## Visual` — all narrow (≤5 columns). Knockback follows the story's "speed-group" rule. `## Sounds` and `## Voice` reuse the existing `slimes/hit-*`/`slimes/death-*`/`slimes/voice-*` pools across all 30 ids. After convergence — final AUTO-GENERATED. | basis: `design/content-authoring.md`, `design/content-archetypes.md`, `design/audio.md` |
| T11 | [x] | Author `content/bosses.md`: 5 boss archetypes from the story table (`boss-gargoyle`…`boss-bubble-hog`). Groups: `## Body`, `## Movement`, `## Contact damage`, `## Knockback`, `## Phases`, `## Attacks`, `## Sounds`, `## Visual`. Phases/Attacks for the new bosses follow the contract from [../design/boss-encounter.md](../design/boss-encounter.md) and [../design/content-archetypes.md](../design/content-archetypes.md) (at least 2 phases and 2 distinct attack keys). For MVP all five may reuse the `slime-king` pattern keys (`coneBurst`/`spawnAdds`/`dashSlam`); `## Sounds` reuses the existing boss sample ids. After convergence — final AUTO-GENERATED. | basis: `design/content-authoring.md`, `design/content-archetypes.md`, `design/boss-encounter.md`, `design/audio.md` |
| T12 | [x] | Sessions migration: edits in [src/shared/content/buildSession.ts](../src/shared/content/buildSession.ts) — `sandbox-with-combat` switches from `TRAINING_TARGET` to `slime-bug`; training/campaign waves move from `slime-fast`/`slime-tank` to new ids of similar difficulty (the starting layout is a coder choice — match by `radius`/`maxHp`/`maxSpeed` from the story table); the campaign boss = `boss-scrap-king`. From [src/shared/content/enemies.ts](../src/shared/content/enemies.ts) drop the re-export of `TRAINING_TARGET`/`SLIME_FAST`/`SLIME_TANK` (after T10's regeneration, those literals no longer exist in `enemies.generated.ts`). The old → new mapping is fixed in a comment in `buildSession.ts`. Depends on T10/T11. | waves do not become an editor |
| T12a | [x] | Test fixtures off `TRAINING_TARGET`: ~13 files (`src/sim/*.test.ts`, `src/main/audio/AudioMappings.test.ts`, `src/main/audio/Audio.test.ts`, `src/shared/content/enemies.test.ts`, `src/shared/content/buildSession.test.ts`, `scripts/content-build/enemies/enemies.test.ts`) currently import `TRAINING_TARGET` as a convenient stationary fixture. Migration — to local test fixtures: either `makeStationaryTestEnemy({ id, ...overrides })` next to the test (preferred at unit level) or real chase archetypes where `behavior: 'stationary'` is not essential. Sim tests must not depend on production content. Depends on T10. | no production fixtures in tests |
| T13 | [x] | UiShell loading phase code: introduce the `loading` (initial) and `error('preload')` (terminal) phases in `src/main/ui/UiShell.ts` per the contract in [../design/main-ui-shell.md](../design/main-ui-shell.md). New `src/main/ui/StartupOverlay.ts` (white background + `public/images/slime-escape.jpg` `object-fit: contain` + bottom progress + status `Loading assets X/Y`). New `src/main/ui/StartupErrorOverlay.ts` with a reload button. `src/main/index.ts` is unchanged (UiShell starts with `loading` itself). | basis: `design/main-ui-shell.md` |
| T14 | [x] | Sprite preload code: new `src/main/render/spritePreload.ts` — function `preloadSprites(specs, onProgress) → Promise<TextureMap>`: loads and decodes all textures from the merged list of the three visual registries; the first error rejects the Promise with diagnostics. Called by `UiShell` in the `loading` phase. Lazy loading during combat is forbidden. | basis: `design/sprite-assets.md`, `design/main-ui-shell.md` |
| T15 | [x] | Renderer asset-only: edits in [src/main/render/Renderer.ts](../src/main/render/Renderer.ts) — for `player`/`enemy`/`boss` create `THREE.PlaneGeometry(worldSize.width, worldSize.height)` + `THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false })` from the preloaded `TextureMap`. Remove the `CircleGeometry`/`color` paths for these kinds. `projectile`/`drop`/zone overlay/crosshair are not touched. The renderer throws a hard error on a missing visual spec / missing texture. | basis: `design/sprite-assets.md` |
| T16 | [x] | Tests: PNG-size util tests (see T4); the drift scenario "PNG changed, MD not edited — `content:check` fails"; renderer hard-error tests (missing visual spec / missing texture); UiShell `loading`/`error('preload')` phase tests (transitions, visibility, no Renderer); `validateEnemyVisuals`/`validateBossVisuals`/`validatePlayerVisuals` tests; smoke tests for all 30 slime ids and 5 boss ids; migrate the existing snapshot tests to the new ids; the test "`PX_PER_WU = 240` is the only scale source". | basis: `design/sprite-assets.md`, `design/main-ui-shell.md`, `design/testing.md` |
| T16a | [x] | Architect: add `design/body-contact-boxes.md` and update `design/content-archetypes.md`, `design/session-definition.md`, `design/enemy-contact.md` for a derived `contactBox` for body-contact `player` / `enemy` / `boss`; update `design/README.md`, `stories/013` (`Technical`, `Tasks`, `Related`). | architect |
| T16b | [x] | Collision follow-up: derive `contactBox` in shared content for `players` / `enemies` / `bosses` from the same PNG scale pipeline as the visual registry; switch `CombatSystem` contact overlap to box-vs-box and projectile hit detection to circle-vs-contactBox; switch the player clamp in `MovementSystem` to `contactBox`; add/update tests for `content-build`, `CombatSystem`, `MovementSystem`, `buildSession`, and the live registries. | basis: `design/body-contact-boxes.md`, `design/content-archetypes.md`, `design/enemy-contact.md`, `design/projectiles-and-combat.md`, `design/session-definition.md` |
| T17 | [x] | Demo/closure: PR #12 merged into `main`. Splash + loader appear before the menu, hero/slime/boss sprites render, gameplay-regression tests are green (313/313). `Status` moved to `done`, the table in `stories/README.md` updated, `Index` in `design/README.md` includes `sprite-assets.md` and `body-contact-boxes.md`. | architect |

## Related

- [../design/sprite-assets.md](../design/sprite-assets.md)
- [../design/body-contact-boxes.md](../design/body-contact-boxes.md)
- [../design/content-authoring.md](../design/content-authoring.md)
- [../design/content-archetypes.md](../design/content-archetypes.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/main-ui-shell.md](../design/main-ui-shell.md)
- [../design/render-scale.md](../design/render-scale.md)
- [../design/arena-and-coordinates.md](../design/arena-and-coordinates.md)
- [../design/audio.md](../design/audio.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/testing.md](../design/testing.md)
- [011-content-from-md.md](011-content-from-md.md)
- [012-content-archetypes-from-md.md](012-content-archetypes-from-md.md)
