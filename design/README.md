# Design Decisions

`design/` is the project's engineering decision layer. This is the required entry point for technical design: read this `README` first, then open the topic-specific decision files.

## Role of the design layer

Project hierarchy:

- `docs/` records game design, product rules, and world constraints.
- `stories/` breaks work into demoable vertical slices.
- `design/` records stable engineering rules and contracts that stories must implement against.

Main principle:

- `stories` answer "what do we build next?";
- `design` answers "what technical rules should this follow?".

## How to read this folder

- Read this `README` first.
- Then open the decision for the topic: for example, `session-definition.md` for the session model or `thread-model.md` for threading and rendering.
- If a story needs more detail than the current design provides, that is a gap in `design`, not permission to define architecture inside the story.

## Decision rules

- One file equals one engineering decision.
- File names must be stable and semantic: `session-definition.md`, `thread-model.md`.
- Do not include dates in file names.
- Every decision file must use the same minimal structure:
  - `Status`
  - `Created`
  - `Updated`
  - `Context`
  - `Decision`
  - `Consequences`
  - `Related`
- When an active decision changes, update the existing file and its `Updated` field.
- If a decision is no longer valid, set `Status` to `superseded` and link to the replacement in `Related`.

## How design evolves through stories

- A story may reveal a missing engineering contract.
- A story must not quietly become the source of architectural truth.
- If work clarifies a stable technical rule, update the relevant file in `design/` first, then let the story rely on it.
- A single design document may evolve across several stories while keeping its topic and stable file name.
- Design documents must not duplicate stories, acceptance criteria, or task breakdowns.

## What does not belong here

- Step-by-step story execution plans.
- Acceptance criteria from `stories/*.md`.
- Narrative retellings of user scenarios.
- Temporary local choices that did not become stable architecture-level rules.

## Index

| Decision | Status | Description |
|----------|--------|-------------|
| [session-definition.md](session-definition.md) | accepted | Shape of `SessionDefinition`, `EncounterDefinition`, and `ModePreset` |
| [thread-model.md](thread-model.md) | accepted | Boundary between the `main thread`, `simulation worker`, and rendering |
| [runtime-systems.md](runtime-systems.md) | accepted | Minimal `core runtime` systems and the simulation lifecycle |
| [content-boundaries.md](content-boundaries.md) | accepted | Separation between the `content library`, session configuration, runtime state, client progression, and client settings |
| [companion-combat.md](companion-combat.md) | accepted | Runtime companion contract: session-owned pet config, companion system, weapon/boop/rescue behavior, ghost state, and snapshots |
| [arena-and-coordinates.md](arena-and-coordinates.md) | accepted | World coordinate system, arena shape, and fit-to-viewport rule |
| [input-commands.md](input-commands.md) | accepted | `InputCommand` shape, WASD, Pointer Lock, aiming, left mouse button, and Esc pause |
| [mobile-web-support.md](mobile-web-support.md) | accepted | Mobile device profile, rotated game root, mobile arena aspect, touch zones, and mobile HUD/control presentation |
| [web-stack.md](web-stack.md) | accepted | Bundler, language, package manager, and the `src/main`, `src/sim`, `src/shared` layout |
| [simulation-timing.md](simulation-timing.md) | accepted | `SimulationClock` and snapshot frequencies, interpolation rules, and pause/resume |
| [logging.md](logging.md) | accepted | Shared `src/shared/log.ts` module, log levels, and the ban on direct `console.*` calls |
| [testing.md](testing.md) | accepted | Test runner (`vitest`), commands, and required invariants under test |
| [spawn-plan.md](spawn-plan.md) | accepted | `SpawnPlan` shape (`empty`/`static` plus extensions) and `SpawnSystem` ownership |
| [content-archetypes.md](content-archetypes.md) | accepted | Minimal content archetypes (`EnemyArchetype`, `WeaponArchetype`, `DropArchetype`, `PetArchetype`, `Loadout`) and lookup by `id` |
| [projectiles-and-combat.md](projectiles-and-combat.md) | accepted | `CombatSystem` ownership for universal weapon/projectile lifecycle, hit tests, damage rules, explosions and damage intents |
| [health-and-death.md](health-and-death.md) | accepted | HP on entities, damage intents, death hooks, and entity removal |
| [snapshot-shape.md](snapshot-shape.md) | accepted | Per-kind entity fields in snapshots, top-level `encounter`/`zone`/`waveProgress`, combat shape, and lifecycle runtime events |
| [zone.md](zone.md) | accepted | `ZoneSystem`: scalar `margin`, `disabled`/`shrinkLinear`/`expandLinear` modes, snapshot export, and separation between gameplay shape and visualization |
| [enemy-contact.md](enemy-contact.md) | accepted | Enemy contact damage: new `CombatSystem` phase, `DamageIntent.source: 'enemyContact'`, and per-enemy cooldown |
| [boss-encounter.md](boss-encounter.md) | accepted | `kind: 'boss'` entity, `'boss'` `SpawnPlan`, `BossArchetype`, `BossPhaseSystem`, `winCondition: bossDefeated`, and boss snapshot/HUD |
| [drops.md](drops.md) | accepted | `DropArchetype`, `Drop` as an entity, `DropSystem` (spawn-on-death hook plus ttl/pickup), `dropTable` on `EnemyArchetype`, and heal effect |
| [rng.md](rng.md) | accepted | Session RNG (`mulberry32` from `seed`) as the only source of randomness in `sim`, plus explicit random-source boundaries for committed main-thread state |
| [main-ui-shell.md](main-ui-shell.md) | accepted | `UiShell` phases, HUD as a passive snapshot consumer, playable preset catalog, local progression, Result rewards, and menu sub-screens |
| [menu-and-startup-presentation.md](menu-and-startup-presentation.md) | accepted | Startup ritual, phase transition curtain, hand-drawn main menu presentation, and Pets/Lab sub-screens |
| [audio.md](audio.md) | accepted | Audio stack in `src/main/audio/**`: one `AudioContext`, mixer (`master` plus `sfx`/`music`/`ui` buses), two-layer sample registry volume, archetype/event to sampleId mappings, music selector, slime ambient, and `setMasterGain` for 009 |
| [client-settings.md](client-settings.md) | accepted | `ClientSettingsStore` in `src/main/settings/**`: 009 fields (`masterVolume`, `renderScalePreset`), `localStorage` with `schemaVersion`, validation/clamping, subscriber model, and `UiShell` ownership |
| [render-scale.md](render-scale.md) | accepted | Render scale policy in `src/main/render/**`: three presets `low`/`medium`/`high`, pure `resolveRenderScale`, `Renderer.applyScalePolicy`, and "no hardware advantage" invariants |
| [decision-log-format.md](decision-log-format.md) | accepted | Short companion summary of the decision format; this `README` defines the layer rules |
| [content-authoring.md](content-authoring.md) | accepted | Markdown content authoring surface: `content/<area>.md` as the source of truth, `scripts/content-build/` generator, generated pairs in consuming layers, atomic writes, and CI drift check |
| [sprite-assets.md](sprite-assets.md) | accepted | Sprite visuals for `player`/`enemy`/`boss`/`projectile`/`drop`/`pet`: `SpriteVisualSpec`, `PX_PER_WU = 240`, asset-only renderer, render-only breathing, hard-error policy, and pre-menu preload |
| [body-contact-boxes.md](body-contact-boxes.md) | accepted | `contactBox` as the derived shape for `player`/`enemy`/`boss` body contact: box-vs-box overlap, broadphase through derived bounds radius, and player clamp by box |
| [impact-feedback.md](impact-feedback.md) | accepted | Juicy projectile feedback: self-contained `hit`/`death` event payloads, projectile knockback from weapon force, renderer-owned slime droplets/stains, hit squash/flash and death ghost |
| [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md) | accepted | Universal weapon instances, ordered loadouts, fire patterns, projectile motion, explosions, fragments, session friendly-fire rules and weapon modifier drops |
| [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md) | accepted | Follow-up combat layer: field effects, status effects, mines, carrier drops, drop magnet, friendly-fire retaliation and aim assist |
| [spawn-overrides.md](spawn-overrides.md) | accepted | Per-`seq` `SpawnOverride` (`guaranteedDrops`/`dropTable`/`retaliation`/`loadout`) for `'static'`/`'wave'` plans; moving `carrierDrop` out of `EnemyArchetype`, application timing, validation, and migration rule |
| [non-player-firing.md](non-player-firing.md) | accepted | Firing path for `kind: 'enemy'`: slime `WeaponInstance` lives in `CombatSystem.shooterWeapons`, naive aim at the current player position, phase-1 `CombatSystem` sub-loop in EntityId order, cooldown initialization, death cleanup, and one shared damage-rule helper for impact and explosion |
| [landing-telegraph.md](landing-telegraph.md) | accepted | Render-only landing marker for in-flight arc projectiles from non-player shooters: `ProjectileSnapshot.arcEnd` snapshot extension, render contract (when to show it, size, exception for player-owned arc projectiles), and presentation vs gameplay |
| [encounter-presentation.md](encounter-presentation.md) | accepted | Presentation fields on `EncounterDefinition` (`introDurationMs`/`name`/`text`), intro delay contract for `SpawnSystem`/`ZoneSystem`/`SessionFlowSystem`, global wave numbering, and render contract for wave/break title overlays |
| [hud-presentation.md](hud-presentation.md) | accepted | Player-facing combat HUD: viewport regions, run timer, compact HP/boss state, control hints, weapon slots, cooldown interval, modifier badges and timed overdrive progress |
| [session-result-summary.md](session-result-summary.md) | accepted | Terminal run summary for `win`/`loss`: progress, duration, kills, drops, boss state, defeat cause, Dungeon summary, and Result UI ownership |
| [escape-progress-path.md](escape-progress-path.md) | accepted | Main-thread Escape Path: wave-only progress path for compact HUD, break map, and Result UI, derived from `SessionDefinition`, snapshots, and result summary without sim contract changes |
| [vibe-jam-portals.md](vibe-jam-portals.md) | accepted | Vibe Jam portal entrypoint, inbound return context, opening exit portal, normal post-boss completion, and redirect contracts |
| [_template.md](_template.md) | template | Minimal template for a new decision |

---

© 2026 Wertakull
