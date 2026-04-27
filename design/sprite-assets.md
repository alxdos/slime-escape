# Sprite Assets

- Status: accepted
- Created: 2026-04-23
- Updated: 2026-04-27 (projectile renderer uses `ProjectileSnapshot.size` as the per-entity effective visual size: mesh geometry stays at the base `projectileVisuals[weaponArchetypeId].worldSize`, and renderer scales that mesh by snapshot size divided by base world size, with render-only pulse layered on top). Earlier: 2026-04-24 story 017 extension: scope expanded to `projectile` and `drop`. The same `SpriteVisualSpec`, `PX_PER_WU = 240`, asset-only renderer, hard-error policy, and preload contract are reused. Two visual registries are added: `projectileVisuals` keyed by `weaponArchetypeId` and `dropVisuals` keyed by `dropArchetypeId`. Inline image nodes in `content/weapons.md` and `content/drops.md` are load-bearing sources by [content-authoring.md](content-authoring.md). `projectile.size` and `drop.radius` become **derived** fields from the corresponding PNG `worldSize`, like `contactBox` for enemy/player/boss; MD columns for them are forbidden. `projectile.hitRadius` remains a content field in MD as a separate gameplay parameter. Render-only projectile behavior (`spinSpeed`, `rotateWhileFlying`, `pulseWhenGrounded`, `explosionRadiusIndicator`) lives in `WeaponArchetype.projectile.visual` and is not part of this file; see [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). Story 016: render-only impact effects may create transient droplets and death ghost sprites from existing slime visuals without extending `SpriteVisualSpec`; see [impact-feedback.md](impact-feedback.md). Earlier render follow-up: `enemy` and `boss` receive render-only procedural breathing through squash/stretch `mesh.scale`, with phase from `entity.id` and no new snapshot/content fields. Story 014: the authoring surface for the PNG asset path moves from MD column `image` to an inline image node `![alt](../public/...)` under `## <id>` in `content/players.md` / `content/enemies.md` / `content/bosses.md`; see "Inline media nodes as derive sources" in [content-authoring.md](content-authoring.md). Runtime contract `SpriteVisualSpec` (`image`/`sourceSizePx`/`worldSize`/`anchor`), producer rule `worldSize = sourceSizePx / PX_PER_WU`, and hard-error policy are unchanged.)

## Context

[arena-and-coordinates.md](arena-and-coordinates.md) defines the world in world units (wu), forbids gameplay systems from operating in pixels, and preserves the "no hardware advantage" invariant: visible arena area, FOV, spawn, and speeds do not depend on window size, DPR, or render scale from 009. [render-scale.md](render-scale.md) separates backing-pixel policy from logical/css canvas size, so the preset affects only pixel density. [content-archetypes.md](content-archetypes.md) defines `EnemyArchetype.color`/`BossArchetype.color` as a content placeholder for rendering, not a renderer decision, while [body-contact-boxes.md](body-contact-boxes.md) separates the visual sprite plane from gameplay body contact for `player` / `enemy` / `boss`. [content-boundaries.md](content-boundaries.md) separates `content library` and presentation. [main-ui-shell.md](main-ui-shell.md) defines that `Renderer` is created by `UiShell` on `menu -> running` and owns canvas pixels. [content-authoring.md](content-authoring.md) defines the adjacent `<area>.ts <-> <area>.generated.ts` pairs and atomic generation.

Today [src/main/render/Renderer.ts](../src/main/render/Renderer.ts) draws `player`/`enemy`/`boss` as colored `THREE.CircleGeometry`, using color from `EnemyArchetype.color`/`BossArchetype.color` and radius from the matching archetype. Adding PNG assets under `public/assets/**` in story 013 introduces all of the following at once:

- a source of truth for **how** each archetype looks: image, original pixel size, world size in wu, and anchor point;
- a conversion rule from sprite source pixels to world units, so future arena or asset-format changes do not silently resize sprites on screen;
- a ban on silent circle fallback: "archetype exists but sprite does not" must fail at startup/test time instead of turning the arena into a mix of PNGs and circles;
- a ready texture set **before** the menu, so the first slime appearance does not lazy-load flicker.

Without an explicit contract, 013 would hard-code a scale factor inside `Renderer.ensureEnemyMesh` / `ensureBossMesh` / the player branch, define missing-sprite behavior in three different places, and create an implicit dependency between sprite size and arena size or `renderScalePreset`.

This decision defines the stable presentation contract for sprite assets for player/enemy/boss and the place where reference scale lives.

## Decision

### Scope

- The decision covers visual representation of entities `kind: 'player'`, `kind: 'enemy'`, `kind: 'boss'`, `kind: 'projectile'`, and `kind: 'drop'` through PNG sprites. All five kinds render through the same `SpriteVisualSpec` contract and the same reference scale `PX_PER_WU`.
- The decision does not introduce atlases, animation frames, directional sprites, hit/death animation, or shader effects. One archetype means one static PNG. Render-only behavior, such as projectile spin or grounded pulse, lives in archetype content fields for the relevant area ([universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)) and does not extend `SpriteVisualSpec`.
- For `projectile` and `drop`, the visual registry key is the **archetype** id (`weaponArchetypeId` for projectile, `dropArchetypeId` for drop), not runtime entity id. This matches the `enemy`/`boss` rule: renderer selects sprite by snapshot `archetypeId`, not by `entity.id`.
- For `projectile`, visual identity belongs to the **owning weapon**, not to a separate `ProjectileArchetype`. In content terms, a weapon always fires its own projectile. Sharing projectile sprites between weapons is out of scope at this horizon. If a separate projectile-visual registry is needed later, it will extend this decision.

### Visual spec

- Visual description for one entity is a read-only object:
  ```ts
  type SpriteVisualSpec = Readonly<{
    archetypeId: string;                                  // matches id in the content library
    image: string;                                        // path from public root, for example '/assets/hero.png'
    sourceSizePx: Readonly<{ width: number; height: number }>;  // actual PNG size in pixels
    worldSize:    Readonly<{ width: number; height: number }>;  // sourceSizePx / PX_PER_WU
    anchor:       Readonly<{ x: number; y: number }>;          // normalized pivot, 0..1; MVP is always { 0.5, 0.5 }
  }>;
  ```
- `sourceSizePx` is the actual PNG size read by the generator from IHDR (see [content-authoring.md](content-authoring.md), derived-field rules).
- `worldSize` is derived: `width = sourceSizePx.width / PX_PER_WU`, and the same for height. It is not written in MD and not edited manually.
- `anchor` is always `{ 0.5, 0.5 }` in the MVP, meaning sprite center. The field is declared now so persistent feet/top anchors for bosses later do not require a new shape. Non-centered anchor values are introduced by a separate extension of this decision.
- There is no separate `displaySizePx`: at the MVP horizon, `displaySizePx == sourceSizePx`. If manual scaling without editing PNG is ever needed, that field is introduced by a separate extension; until then there is only one pixel-size source.
- `color` from `EnemyArchetype`/`BossArchetype` (see [content-archetypes.md](content-archetypes.md)) **is not part** of `SpriteVisualSpec`. The base sprite renderer does not tint player/enemy/boss PNGs by `color`. After [impact-feedback.md](impact-feedback.md), renderer may read `color` only for render-only slime material effects such as droplets/stains. Behavior for `WeaponArchetype.color`/`DropArchetype.color` is unchanged.

### Reference scale

- The only number that converts "PNG source pixels" to world units is `PX_PER_WU = 240`. It lives in `src/shared/sprite/spriteScale.ts` as `export const PX_PER_WU = 240` and is not duplicated.
- Reference scale **does not depend** on `arena.width`, `arena.height`, `canvas.width`, `canvas.height`, `devicePixelRatio`, or `renderScalePreset`. If someone changes `SANDBOX_ARENA` from `32x18` to another size, each sprite keeps the same world size and occupies the same arena share as any other object with fixed `radius`.
- Any change to `PX_PER_WU` requires updating this decision and `spriteScale.ts`. It must not be adjusted locally in renderer, generator area code, or MD.

### Visual registries

- There are five separate visual registries, one per presentation area. Each is a pair of handwritten consumer and generated literals, by [content-authoring.md](content-authoring.md):
  - player: `src/main/render/playerVisuals.ts` <-> `src/main/render/playerVisuals.generated.ts`;
  - enemy: `src/main/render/enemyVisuals.ts` <-> `src/main/render/enemyVisuals.generated.ts`;
  - boss: `src/main/render/bossVisuals.ts` <-> `src/main/render/bossVisuals.generated.ts`;
  - projectile: `src/main/render/projectileVisuals.ts` <-> `src/main/render/projectileVisuals.generated.ts`;
  - drop: `src/main/render/dropVisuals.ts` <-> `src/main/render/dropVisuals.generated.ts`.
- There is no combined `entitySprites.generated.ts`: the rule "one MD source -> adjacent pair beside its consumer" is preserved, as with `enemies.generated.ts`/`enemyAudio.generated.ts` after 011/012.
- Each handwritten module contains:
  - public type `SpriteVisualSpec`, physically owned in one shared place such as `src/main/render/SpriteVisualSpec.ts` and re-exported as needed. The contract is one project-wide type, not five copies;
  - public registry `Readonly<Record<string, SpriteVisualSpec>>`;
  - validator that every id from the matching content registry has a visual spec and vice versa: `validatePlayerVisuals(playersRegistry)`, `validateEnemyVisuals(enemyRegistry)`, `validateBossVisuals(bossRegistry)`, `validateProjectileVisuals(weaponsRegistry)`, `validateDropVisuals(dropsRegistry)`. Mismatch throws; it is not a warning.
- Generation sources by content area:
  - `content/players.md` -> `playerVisuals.generated.ts`;
  - `content/enemies.md` -> `enemyVisuals.generated.ts`;
  - `content/bosses.md` -> `bossVisuals.generated.ts`;
  - `content/weapons.md` -> `projectileVisuals.generated.ts` (new output pair for `weapons`; key is `weaponArchetypeId` because projectile sprite belongs to the weapon by the "Scope" rule);
  - `content/drops.md` -> `dropVisuals.generated.ts` (new output pair for `drops`; key is `dropArchetypeId`).
- The authoring surface for the PNG asset path is an **inline image node `![alt](../public/<path>)` under the archetype H2** in `content/<area>.md` (see "Inline media nodes as derive sources" in [content-authoring.md](content-authoring.md)). MD column `image` is forbidden because it would be a second source of truth for the same derived field. The inline node URL is written to `.generated.ts` as a public-relative path after stripping the `../public/` prefix, per the same section. Fields `sourceSizePx`/`worldSize`/`anchor` are wholly forbidden in MD: they are either derived (`sourceSizePx`, `worldSize`) or fixed by contract (`anchor`). This is a specific case of the [content-authoring.md](content-authoring.md) rule that MD columns for derived fields are forbidden.
- In `weapons`, a weapon H2 section already carries an inline audio link for `fire` (story 014). From 017, the same section also carries a **required** inline image node for the projectile sprite. The two media kinds, audio link vs image, use distinct syntax and do not conflict. In `drops`, the inline image node becomes required for the first time.

### Asset-only renderer

- In [src/main/render/Renderer.ts](../src/main/render/Renderer.ts), branches for `player`/`enemy`/`boss`/`projectile`/`drop` create `THREE.Mesh` with `THREE.PlaneGeometry(worldSize.width, worldSize.height)` and `THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false })`. `THREE.CircleGeometry` is not used for these kinds.
- `map` comes from the preloaded `THREE.Texture` set, keyed by `archetypeId` (for projectile this is `weaponArchetypeId`; for drop this is `dropArchetypeId`). Renderer **does not** initiate texture loading; missing texture is a hard error (see below).
- Gameplay body contact for `player` / `enemy` / `boss` does not live in this file. After [body-contact-boxes.md](body-contact-boxes.md), its owner is derived `contactBox` in the shared/runtime layer. `worldSize` and `contactBox` are produced the same way at the 013 horizon, but they are separate contracts: the first is presentation-only, the second is gameplay.
- For `projectile`, visual size (`projectile.size`) is **derived** from `worldSize` in `projectileVisuals[weaponArchetypeId]`, following the same single-source-of-truth rule as `contactBox` for enemy/player/boss in [body-contact-boxes.md](body-contact-boxes.md). MD columns/fields for `projectile.size` are forbidden. `projectile.hitRadius` remains an explicit content field in MD: it is a **separate** gameplay parameter that may intentionally differ from the visual, such as a long laser visual with a narrow center hit.
- Runtime projectiles may have an effective visual `size` that differs from the base `worldSize`, for example after `projectileSizeMultiplier` applies at spawn time. Renderer reads that per-entity value from `ProjectileSnapshot.size` ([snapshot-shape.md](snapshot-shape.md)) and scales the projectile mesh by `snapshot.size / projectileVisuals[weaponArchetypeId].worldSize`. Renderer must not infer effective projectile size from `weaponHud.modifiers`, because already spawned projectiles, non-player projectiles, and weapon switching all make owner-local weapon state insufficient for per-projectile presentation. The base `PlaneGeometry` and `SpriteVisualSpec.worldSize` remain unchanged.
- For `drop`, visual and pickup radius (`drop.radius`) is **derived** from `worldSize` in `dropVisuals[dropArchetypeId]` by `radius = min(worldSize.width, worldSize.height) / 2`. MD columns/fields for `drop.radius` are forbidden. If visual size and pickup zone later need to diverge, like projectile `size`/`hitRadius`, a separate content field `pickupRadius` or `pickupBox` will be introduced. Until then, one PNG defines both.
- Anchor `{0.5, 0.5}` means the PlaneGeometry center coincides with entity position from the snapshot. If another anchor is needed later, such as feet instead of center, that changes `anchor` in the visual spec and renderer use of it; snapshot `position` does not change.
- Z-order is unchanged: player/enemy/boss remain on the same `z` as today (`ENEMY_Z` in renderer), projectile above, drop below, zone overlay above.
- `transparent: true` is needed for PNG alpha. `depthWrite: false` prevents transparent edges from clipping one another when sprites overlap on the same z plane; draw order is controlled by z coordinate and `renderOrder`.

### Procedural breathing

- Static PNG remains the source visual, but `Renderer` may apply a small presentation-only squash/stretch to the existing sprite mesh. This is intentionally a render pass, not a simulation system: it changes only `THREE.Mesh.scale` and never writes to snapshot state, archetypes, `SpriteVisualSpec`, `worldSize`, `contactBox`, movement, collision, projectile targeting, or spawn/balance values.
- On the current horizon the effect applies to `enemy` and `boss` sprites only. `player` stays unscaled so input feel and player silhouette remain stable; `projectile` carries its own render-only motion (spin, grounded pulse) governed by `WeaponArchetype.projectile.visual` in [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md), and `drop` may carry render-only pulse/bob driven by `DropArchetype` content fields when added. Neither uses the procedural breathing curve described below.
- The breathing curve is sinusoidal and deterministic from render time plus entity identity:
  ```ts
  breath = sin(nowMs * breathHz + entity.id * phaseStride)
  scaleX = 1 + amplitude * breath
  scaleY = 1 - amplitude * verticalRatio * breath
  ```
  Positive `breath` makes the slime wider and slightly lower; negative `breath` makes it narrower and taller. Different `entity.id` values provide phase offsets so a wave of slimes does not animate in lockstep.
- Amplitudes are deliberately small renderer-owned constants. Normal enemies may use a stronger amplitude than bosses; bosses should read as alive but heavier. Tuning these numbers is visual polish inside `src/main/render/**`, not content authoring.
- The effect must remain independent of `renderScalePreset`, DPR, canvas backing size, arena size, and simulation tick rate. It uses wall/render time for presentation, so it is allowed to be visually non-authoritative in the same way interpolation and drop pulsing are presentation-only.
- If future animation frames, skeletons, shader deformation, event impulses such as hit/landing squash, or per-archetype animation profiles are introduced, they extend this section. They must still preserve the core rule: sprite deformation cannot become gameplay geometry unless [body-contact-boxes.md](body-contact-boxes.md) is explicitly updated.

### Impact effects

- Render-only slime impact effects are owned by [impact-feedback.md](impact-feedback.md). They reuse existing visual registries and preloaded textures for death ghost sprites, and may generate droplet geometry at runtime.
- These effects do **not** add fields to `SpriteVisualSpec`: one static PNG remains the archetype visual source, while droplets/stains/ghosts are transient renderer state.
- Death ghost sprites use the same `image`, `worldSize`, and `anchor` as the live sprite, but their position, opacity, tint, and lifetime are renderer-owned presentation data.

### Hard error policy

- The following situations are `throw` on startup/test, not silent fallback:
  1. An entity with `kind` in {`player`, `enemy`, `boss`, `projectile`, `drop`} appears in a snapshot with an `archetypeId` (or `weaponArchetypeId`/`dropArchetypeId` for projectile/drop) that has no visual spec in the corresponding registry.
  2. A visual spec references an `image` that is not present in the preloaded texture set (see "Preload contract").
  3. A visual spec references an `archetypeId` missing from the corresponding content registry: orphan visual.
  4. The content registry contains an `id` that has no visual registry entry: orphan archetype.
- Checkpoints:
  - Validators (`validatePlayerVisuals`/`validateEnemyVisuals`/`validateBossVisuals`/`validateProjectileVisuals`/`validateDropVisuals`) run at session start, before the first tick, and catch cases 3 and 4.
  - Preload (see [main-ui-shell.md](main-ui-shell.md), `loading` phase) catches case 2 during loading and moves `UiShell` to `error('preload')` with a clear message. The app does not reach `menu`.
  - Renderer catches case 1 on first mesh lookup and throws. Reaching that point means visual/content registries were assembled incorrectly and a validator missed it; tests should expose that.
- No `?? 0xffffff` colors, `?? CircleGeometry`, or `?? defaultTexture` for any of the five kinds. Any such fallback is a review blocker.

### Preload contract

- The full `loading` phase, splash, and preload lifecycle are defined in [main-ui-shell.md](main-ui-shell.md). This file only records sprite-asset requirements:
  - The texture preload list is the union of `image` values from all five visual registries (`player`/`enemy`/`boss`/`projectile`/`drop`), sorted for determinism.
  - Before `loading -> menu`, every PNG in that list must be successfully loaded **and decoded**. A loaded but not decoded bitmap is not ready; decoding is the expensive part of first texture appearance.
  - Lazy-loading sprites during a session is forbidden. Renderer only reads keys guaranteed to exist in the preloaded set.

### Tests

- Unit test for `PX_PER_WU`: value is 240, and it is the single source of truth. Grepping `src/**` and `scripts/**` finds exactly one initialization.
- `validateEnemyVisuals` / `validateBossVisuals` / `validatePlayerVisuals` / `validateProjectileVisuals` / `validateDropVisuals`: live registries pass happy path; mismatch (orphan visual / orphan archetype) throws with a clear message containing `archetypeId` and area name.
- Renderer hard error: creating a mesh for an `archetypeId` missing from visual registry throws; missing texture in the preloaded set throws. Regression test: `Renderer` does not create `CircleGeometry` for any of the five kinds; any import/use of `CircleGeometry` in those branches is an error.
- Arena independence test: changing `arena.width`/`arena.height` does not change any spec `worldSize`. This is a unit test over `SpriteVisualSpec` data, not renderer.
- Renderer breathing: `enemy` receives render-only `mesh.scale` squash/stretch for a given `nowMs`, while `player` stays at `scale = 1`. `projectile` and `drop` do not receive the slime breathing curve; projectile scale may still come from `ProjectileSnapshot.size` and grounded pulse, and drop scale may come from renderer-owned pickup readability pulse.
- Content-build test: in `weapons.generated.ts`, each `projectile.size` is physically equal to the `worldSize` of the matching `projectileVisuals.generated.ts` entry. In `drops.generated.ts`, `radius` equals `min(worldSize.width, worldSize.height) / 2` for the matching `dropVisuals.generated.ts` entry. This is not a cross-check between two sources; it checks that the generator did not diverge a derived value across two outputs.

## Consequences

- 013 gets a compact contract: one shared `SpriteVisualSpec` type, three initial registries later extended to five, one `PX_PER_WU = 240` constant, and one hard-error path. Renderer stops being the place where magic drawing colors and radii live.
- Future stories such as unique boss visuals, directional frames, or atlases extend this file, by adding fields to `SpriteVisualSpec` or introducing an atlas layer, rather than reopening the local contract for "how to describe a sprite".
- Procedural breathing gives static PNGs minimal life without expanding content or snapshot contracts. The cost is one more renderer-owned polish pass and a need to keep amplitudes small enough that the visual contour does not promise different hitboxes.
- `EnemyArchetype.color`/`BossArchetype.color` lose part of their original audience. This is accepted debt: until a consumer exists, such as debug overlay or minimap, the field is a placeholder. Removing it is a separate decision after a real consumer appears or is explicitly ruled out.
- Generator may read PNG files to derive `sourceSizePx`. This is the first case where MD is not the generator's only physical input; general derived-field rules live in [content-authoring.md](content-authoring.md), and this file defines the concrete consumer.
- Render scale presets ([render-scale.md](render-scale.md)) and pixel density (DPR) do not affect sprite size in wu. The preset changes canvas backing pixels; the sprite remains the same world size. The "no hardware advantage" invariant remains intact.
- Cost: new visual file pairs (`*Visuals.ts` <-> `*Visuals.generated.ts`), one shared `SpriteVisualSpec.ts`, one `spriteScale.ts` constant, and a longer app startup preload. Faster first sprite appearance during combat offsets the startup cost.

## Related

- [arena-and-coordinates.md](arena-and-coordinates.md)
- [render-scale.md](render-scale.md)
- [content-archetypes.md](content-archetypes.md)
- [content-authoring.md](content-authoring.md)
- [content-boundaries.md](content-boundaries.md)
- [body-contact-boxes.md](body-contact-boxes.md)
- [main-ui-shell.md](main-ui-shell.md)
- [web-stack.md](web-stack.md)
- [testing.md](testing.md)
- [../stories/013-sprite-assets-and-loader.md](../stories/013-sprite-assets-and-loader.md)
- [impact-feedback.md](impact-feedback.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [drops.md](drops.md)
- [../stories/017-universal-weapons-and-projectiles.md](../stories/017-universal-weapons-and-projectiles.md)
