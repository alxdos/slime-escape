# Three Campaign Difficulties

- Status: done
- Created: 2026-04-24
- Updated: 2026-04-26 (architect: the final implementation of 019 was merged into main and pulled into this branch — the review showed that the design contract for 020 stays valid: the final override parser has exactly the 5 columns that 020 will extend to 7; `ParsedSpawnOverride` is a type extensible with `loadout`; the `parseLoadout` helper already exists for session-level loadouts and is reused for the override; the integration test `spawnOverrides.integration.test.ts` + a snapshot baseline form the ready model for T15. Tasks updates: T3 narrowed to `ParsedSpawnOverride` (not `ParsedSpawn`), T15 references `spawnOverrides.integration.test.ts` as a model. Earlier 2026-04-26: Tasks compressed to T1..T16 after prep commits in this same branch — `createSpawnSystem` on an options-bag, the `buildShooterWeapons` helper in `CombatSystem`, rename `runFiringDecisions` → `runPlayerFiringDecisions`, `ProjectileSnapshot.arcEnd` + propagation in `SnapshotExportSystem`. The previous T3 and T11 are excluded as fully completed by prep; T6/T7/T8 (former T7/T8/T9) are shortened to one or two lines on top of the prepared baseline. Earlier 2026-04-26: architect correction after diffing against merged 017/019 code: (a) the slime `WeaponInstance` lives not on the runtime `enemy` entity but in `shooterWeapons: Map` inside `CombatSystem` — symmetric to the player loadout, via the new `setEnemyLoadout`/`removeShooter` API and wiring through a SpawnSystem callback + a line in the death hook; (b) `Projectile.arcEnd` already exists in runtime since 017, in 020 only `SnapshotExportSystem` is updated; (c) the unified `canDamageTarget` helper is already implemented in 017, 020 only adds a regression test. `design/non-player-firing.md` was rewritten (sections "Where the slime's WeaponInstance lives", "Wiring", "Tick phase", "Cleanup on death", "Consequences"); `design/spawn-overrides.md` and `design/landing-telegraph.md` were clarified. Tasks renumbered compactly: T7/T10/T11 excluded as "already done", T8/T9/T12 reformulated for the real 017 APIs. Earlier 2026-04-25: new design decisions [non-player-firing.md](../design/non-player-firing.md) and [landing-telegraph.md](../design/landing-telegraph.md), updates to [spawn-overrides.md](../design/spawn-overrides.md) with a `loadout` field, [snapshot-shape.md](../design/snapshot-shape.md) with `ProjectileSnapshot.arcEnd`, [content-authoring.md](../design/content-authoring.md) with two new override-table columns. Player-facing rewritten around the three difficulty pillars; Acceptance extended with per-set hard progression.)

## Player-facing

In the menu, instead of one campaign — three entries (`easy` / `normal` / `hard`). All three are available immediately, with no unlock conditions. Each reads as **a different game** as early as the first wave. There is no "the same campaign at higher difficulty": the numbers are tuned so each difficulty delivers its own recognisable pillar.

### Easy — "I own the arena"

- Sees: slimes are rare and weak, they cut each other up, the aim pulls in. An hp-orb drops in every second wave.
- Feels: relaxed, power fantasy, fun shooting without having to read the battle.
- Pillar: `slimeFriendlyFire: true` — the main mechanical expression. One shot into a crowd — the crowd thins itself out. Aim assist + a full arsenal + weak rare enemies amplify the same pillar.
- Structure: 3 sets (set-1 / set-3 / set-5, with two strong bosses), 2 waves per set, no extra "bonus" set. The player completes it in ~8–10 minutes.

### Normal — "The same run as today"

- Sees: exactly the current campaign. No additions, no "easing", no "speed-up".
- Feels: the familiar dense run with a fair balance of 5 sets × 3 waves + 5 bosses.
- Pillar: migration of the current `content/sessions/campaign.md` → `campaign-normal.md` without losing balance (a regression test for determinism on a fixed `seed`). Lightly — 1 shooter in the final wave of every set as a hint of hard, but not a game-changer.

### Hard — "Read the battlefield"

- Sees: the very first wave includes slimes with a pistol and an SMG. By set 2 — grenadiers with a highlighted grenade landing point. By set 3 — stationary "turret" slimes at the corners, motionless, firing a laser. By set 4 — bomb-placer turrets lay out a minefield. By set 5 — fireball-staff in every direction.
- Feels: positioning matters more than DPS; standing still = damage; every set teaches you to read a new kind of threat.
- Pillar: every set adds **exactly one new threat category**, and by the end of the campaign the player keeps all five in mind at once. Difficulty grows through **threat types**, not "more HP / more slimes".
- Starter kit: 3 weapons (`pistol` / `smg` / `rock-thrower`), starting weapon — `pistol` (weak). Aim assist off. `slimeFriendlyFire: false` (slimes help each other; their **explosions** also do not kill neighbouring slimes). Drops are stingy: heal only from tanks, carrier slots drop power-ups less often.

### Common across all three

- Difficulty is chosen before the start and does not "stick" to a save — it is just three different presets. You can restart the same one or switch via the menu.
- The final boss of each set is shared between normal and hard (for easy — three of the five). No per-difficulty bosses or slime archetypes.
- HUD/menu/audio — unchanged in this story, except that the second and third entries appear in the campaign catalog.

## Technical

This story builds on the session catalog from 015 ([content/sessions/](content/sessions/) — one MD = one preset) and the spawn-overrides from 019. No new authoring shapes. The differences between difficulties are built from existing session/encounter knobs plus one new override field and one new firing path for non-player owners.

### Foundational design decisions

- [spawn-overrides.md](../design/spawn-overrides.md) — extended with `loadout?: Loadout` in `SpawnOverride` (replace-or-`null`); the third override-table MD form gains the columns `loadoutWeaponIds | selectedWeaponIndex`.
- [non-player-firing.md](../design/non-player-firing.md) — firing path for `kind: 'enemy'`: the slime's `WeaponInstance` lives in the same `shooterWeapons` Map inside `CombatSystem` as the player loadout (symmetric to the player API); initialisation is via the new `setEnemyLoadout`/`removeShooter` APIs + an `onEnemySpawned` callback from SpawnSystem + the line `combat.removeShooter(ctx.entityId)` in the death hook; aim is the player's current position; the tick phase is the same Phase 1 of `CombatSystem`, with `runFiringDecisions` split into `runPlayerFiringDecisions` and `runEnemyFiringDecisions`; `nextFireSimMs = simTime + cooldownMs` via `createWeaponInstance`.
- [landing-telegraph.md](../design/landing-telegraph.md) — a render-only landing-point marker for an in-flight arc from a non-player owner. Extends [snapshot-shape.md](../design/snapshot-shape.md) with `ProjectileSnapshot.arcEnd: {x,y} | null`.
- [content-authoring.md](../design/content-authoring.md) — the override table in the `sessions` area gets a controlled exception to "id + ≤4 fields": `seq` + 6 fields in a fixed order.

### Five categories of knobs that express the three difficulties

1. **Wave composition and pace** (encounter-level, existing, see [spawn-plan.md](../design/spawn-plan.md)): which archetypes are in `seq`, the length of `seq`, `spawnIntervalMs`, `maxAlive`, `zoneToMargin`/`zoneDurationMs`.
2. **Player** (session-level, existing, see [session-definition.md](../design/session-definition.md)): `loadoutWeaponIds`, `selectedWeaponIndex`, `slimeFriendlyFire`, `aimAssist*`.
3. **Campaign structure** (encounter-level, existing): the number of sets / encounters; per-set boss reuse of existing archetypes.
4. **Spawn-override** (019): `guaranteedDrops`, `dropTable` replace, `retaliation`.
5. **Loadout** (new, story 020): `SpawnOverride.loadout` for a specific `seq` via two new override-table fields. The main "torque" of the hard pillar.

### One shared stationary archetype (a scope extension over the original Out of scope)

- The hard set 3 pillar ("stationary turrets in the corners") cannot be expressed by any of the five knobs above: `behavior` is explicitly forbidden as an override ([spawn-overrides.md](../design/spawn-overrides.md), "The principled split"), and no existing archetype has `behavior: 'stationary'` ([content/enemies.md](content/enemies.md)).
- Decision: introduce in `content/enemies.md` a **new shared archetype** `slime-idol` (a working name, possibly the pair `slime-idol-eye` / `slime-idol-stone` for visual variety) with `behavior: 'stationary'`, `maxSpeed: 0`, `contactDamage: 0`, `knockbackBaseImpulse: 0`, `knockbackVelocityScale: 0`, `maxHp ≈ 6`, `dropTable: []`. PNG asset — reuse one of the existing slime-* sprites; no new assets are introduced for this story.
- This **does not** violate the Out-of-scope item "New slime or boss archetypes for a specific difficulty". The archetype is shared: formally available to any preset; in this story it is used only by the hard campaign. If normal/easy/training/sandbox want it later, they just take it.
- The decision is recorded here, not in a separate `design/` file, because it is a content extension of the registry, not a new architectural rule: the rule "behavior is part of identity" is already pinned in [spawn-overrides.md](../design/spawn-overrides.md), and `slime-idol` is a regular archetype under that rule.

### Campaign migration

The current `content/sessions/campaign.md` is renamed to `campaign-normal.md` without changing its balance. `content/sessions/campaign-easy.md` and `content/sessions/campaign-hard.md` are two new files, each standing on its own (per the [content-authoring.md](../design/content-authoring.md) rule for multi-file areas, partial duplication of the skeleton is accepted on purpose). `visibleInMenu: true` for all three; `order` fixes the menu sequence `easy → normal → hard`.

### What this story does not touch

- HUD, menu (except the derived view over the catalog — `getPlayableModeCatalog` already shows every `visibleInMenu: true` preset), audio, rendering of regular slimes/player/boss.
- `BossPhaseSystem` — bosses stay on it; per-encounter `bossArchetypeId` reuses existing ones.
- Player loadout with modifiers / overdrive — only for the player, not for slimes.

## Out of scope

- New slime or boss archetypes **for a specific difficulty** (for example, "a fat slime-spark on hard"). Differences are expressed by composition, pace, override fields, and `loadout`. The single shared stationary archetype `slime-idol` is not a difficulty fork (see Technical, the section about it).
- A new PNG/sprite asset for `slime-idol`. Reuse an existing slime PNG.
- Stat multipliers as spawn-overrides (`hpMultiplier`, `speedMultiplier`, `damageMultiplier`, …). If ever needed — a separate design decision and a separate story.
- A per-archetype default `loadout` on `EnemyArchetype` ("slime-X fires everywhere and always"). This story follows the principle "firing = context of appearance". If needed — a separate decision; see the prohibitions in [spawn-overrides.md](../design/spawn-overrides.md).
- Per-difficulty persistent achievements, unlocks, cosmetics, separate leaderboards.
- Adaptive/dynamic difficulty inside a run; a custom "manual" difficulty with UI toggles; templates/inheritance between campaign files.
- New player weapons, new upgrades, a new HUD.
- Smart shooter AI (line of sight, leading the target, kiting, switching weapons by slime phase). A shooter simply fires at the player's current position with a deterministic cooldown ([non-player-firing.md](../design/non-player-firing.md)).
- Boss attacks and their migration to the universal weapon model — bosses stay on `BossPhaseSystem`.
- Friendly-fire retaliation as a mechanic — its rules already belong to 018; here we only use the rules that have already been accepted.
- **Landing telegraph for player-owned arc projectiles**. The pre-shot aim preview **before** firing is already described in 017; the in-flight marker is introduced here only for incoming (non-player) arc projectiles.
- **Landing telegraph for linear projectiles** (lead markers for fast bullets, etc.). Linear projectiles are readable by their trajectory; an extension is a separate decision.
- **Trajectory line / arc silhouette** between origin and landing point. Marking the landing point is enough.
- A slime with modifiers / temporary overdrive — slimes do not get weapon modifier drops.

## Acceptance

### Menu and navigation

- The main menu shows three entries: "Campaign — easy", "Campaign — normal", "Campaign — hard" in that order. Each launches from the menu and runs through to the final boss.
- Sandbox/training/demo presets do not appear in the menu (`visibleInMenu: false`); their behaviour after migration is identical to today.

### Normal — migration without regression

- On a fixed `seed` the `campaign-normal` session reproduces **byte-for-byte** the same sequence of runtime events (`enemySpawn`/`death`/`fire`/`hit`/`explosion`/`dropSpawn`/`dropPickup`/`dropExpire` + positions/archetypes) as the current `campaign` before this story. Covered by a deterministic regression test.
- On normal `slimeFriendlyFire = false`, aim assist off.
- A single shooter in the final wave of every set (slime-spark with `loadout: pistol`) is the only normal-only addition vs today's campaign.

### Easy — "I own the arena"

- On easy `slimeFriendlyFire = true`, aim assist on with a generous cone (`maxAngleRadians ≥ 0.3`, `strength > 0`).
- The starting `loadoutWeaponIds` contains **all** 9 weapon ids; `selectedWeaponIndex` points at a mass-clearer (suggestion: `shotgun`).
- In the first ~30 seconds of the first wave the player **never** takes projectile damage from slimes — because there are no shooters on easy at all. Covered by the test "tick sim 30 s with a stub player standing still, no `hit` event with `targetKind: 'player'`".
- With careless play (the dummy player does not move) the easy campaign survives until the second wave: assert "player.hp > 0 at `encounterEnd` of the first wave encounter".
- A heal-orb drops in every second wave (one guaranteed `heal-orb` carrier per second wave) — covered by counting `dropSpawn` events with `archetypeId: 'heal-orb'`.

### Hard — "Read the battlefield"

- On hard `slimeFriendlyFire = false`, aim assist off.
- The starting `loadoutWeaponIds` is exactly 3 weapons; `selectedWeaponIndex` points at the weak starter (`pistol`).
- In the first ~30 seconds of the first wave the player can die **only** from slime projectiles, never touching them (the dummy player stands still, no contact damage; the only source of `targetKind: 'player'` `hit` events is a projectile with `ownerKind: 'enemy'`). Covered by a test.
- Per-set progression (minimum asserts; concrete numbers belong to the game designer; the test only checks existence):
  - **Set 1.** At least one `seq` carries `loadout` with linear weaponry (`pistol`/`smg`).
  - **Set 2.** At least one `seq` carries `loadout` with arc weaponry (`rock-thrower` or `grenade-launcher`).
  - **Set 3.** At least one `seq` uses the archetype `slime-idol` (`behavior: 'stationary'`) **with** `loadout` (linear long-range — `laser`/`sniper`).
  - **Set 4.** At least one `seq` uses `slime-idol` with `loadout: bomb-placer` (placed weapon); at least one `seq` carries `retaliation: enabled=true`.
  - **Set 5.** At least one `seq` carries `loadout: fireball-staff` (multiDirection).
- Drops: on hard, no regular (non-carrier) `seq` has `heal-orb` in its effective dropTable (override `dropTable: []` or an explicit replace without heal). Carrier slots in the hard campaign drop **only** power-ups, not heal. Covered by the test "`heal-orb` `dropSpawn` events on a hard run of waves 1–3 of every set — zero".

### Firing-path behaviour

- A slime projectile damages the player through the regular damage path; the `hit` event has `ownerKind: 'enemy'` and `weaponArchetypeId` of the corresponding weapon.
- A slime never damages itself: the `ownerId` filter excludes self-damage from any of its own projectile / its own explosion.
- Killing a firing slime stops its firing immediately: after a `death` event with `entityKind: 'enemy'` for that entity, no further `fire` event is ever published with `shooterId === deadEnemy.id`. No `WeaponInstance` leaks: a separate leak-check test on `removeDead()` compares state before/after the shooter's death.
- With `slimeFriendlyFire: false` a slime projectile does not damage another slime (impact); an explosion from a slime grenade also does not deal HP damage to a neighbouring slime. Both cases are covered by tests; the explosion case is a separate regression test on the unified `canDamageTarget` helper.
- With `slimeFriendlyFire: true` (easy) the same in reverse: both impact and explosion of slime projectiles damage neighbouring slimes. Covered by symmetric tests.
- The first shot of a firing slime happens exactly `cooldownMs` of its weapon archetype after spawn, no earlier and no later. Covered by a deterministic test for one fixed weapon archetype.

### Landing telegraph

- When a slime throws an arc projectile (`weaponArchetypeId` with `motion.kind === 'arc'`), a landing-telegraph marker appears on the ground at `arcEnd` for the entire flight time. The marker disappears on impact or grounding (no later than one frame after the `state` transition to `'grounded'`).
- Player-owned arc projectiles do **not** show a landing-telegraph marker. Covered by a render test: spawning an arc projectile with `ownerKind: 'player'` → no landing-telegraph mesh in the render scene.
- The marker size for a weapon with `explosion !== null` ≈ the explosion diameter; for a weapon without explosion — a fixed 0.4 wu. Covered by a render test.

### Content and validation

- All three campaign files pass `content:check` without warnings, except those explicitly expected (no-tunneling for the granted weapon, if any arise).
- `content:check` fails on: a reference to an unknown `weaponArchetypeId` in `override.loadout.weapons`; `selectedWeaponIndex` out of range; a partially set loadout (one column `none`, the other not).
- No presets outside the three campaigns (sandbox, training, demo) change behaviour after migration.

## Tasks

T1 is the architecture PR (already merged in this branch). The prep commits (also already in the branch) prepared existing code: `createSpawnSystem` on options-bag, the `buildShooterWeapons` helper in `CombatSystem`, the rename `runFiringDecisions` → `runPlayerFiringDecisions`, `ProjectileSnapshot.arcEnd` + propagation in `SnapshotExportSystem`. After that T2–T16 form the code PR per the rule "do not mix `design/` edits and code in one PR".

Inside T2–T16 the order reflects dependencies: types → parser/renderer for `sessions` → builder validation → `CombatSystem` API (`setEnemyLoadout`/`removeShooter`) → the new `runEnemyFiringDecisions` → SpawnSystem callback + `onEncounterStart(simTimeMs)` → worker wiring → renderer landing telegraph → the new archetype `slime-idol` → migration and the three campaigns → tests → verification.

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Architect: prepare the design edits as one architecture PR — (1) [non-player-firing.md](../design/non-player-firing.md) (storing the slime WeaponInstance in `shooterWeapons` Map symmetric to the player, `setEnemyLoadout`/`removeShooter` APIs, wiring through a SpawnSystem callback + a death-hook line, splitting `runFiringDecisions`); (2) [landing-telegraph.md](../design/landing-telegraph.md) (the runtime `Projectile.arcEnd` already exists since 017; only `SnapshotExport` is updated; the render contract); (3) [spawn-overrides.md](../design/spawn-overrides.md) (the `loadout` field, the clarification "loadout is not copied into an entity field", validation, MD extension); (4) [content-authoring.md](../design/content-authoring.md) (override table up to 6 fields, controlled exception, columns `loadoutWeaponIds`/`selectedWeaponIndex`); updates to [snapshot-shape.md](../design/snapshot-shape.md) (`ProjectileSnapshot.arcEnd`), [design/README.md](../design/README.md) (index). Plus this revision of the story. | Ready to merge; the code PR (T2–T16) is a separate PR. |
| T2 | [x] | Extend `src/shared/session.ts`: add an optional `loadout?: Loadout` to `SpawnOverride`. No runtime behaviour change. | Pure types; depends on 019 (the `SpawnOverride` type exists). |
| T3 | [x] | `scripts/content-build/sessions/parse.ts`: extend `SPAWN_OVERRIDE_HEADER` and `parseSpawnOverrideRow` with two new columns — the final signature is `seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex`. A new helper `parseLoadoutOverride(section, table, row)` returns `Pick<ParsedSpawnOverride, 'loadout'>` in the same pattern as the existing `parseGuaranteedDropsOverride`/`parseRetaliationOverride`; internally it reuses the session-level `parseLoadout` logic (resolution via `WEAPON_ARCHETYPES`, validation of `selectedIndex` in `[0, length) \| null`). Hard errors: an unknown `weaponArchetypeId` in `loadoutWeaponIds`; `selectedWeaponIndex` out of range; a partial set — one column `loadoutWeaponIds`/`selectedWeaponIndex` is `none`, the other is not (analogous to the paired `retaliationEnabled`/`retaliationDurationMs`). Extend the type `ParsedSpawnOverride` with `loadout?: ParsedLoadout`. Update `isSpawnOverrideEmpty` for the new field. The override table for `spawnKind ∈ {empty, boss}` stays forbidden (the 019 check is not relaxed). | Depends on 019 — `parseLoadout` and the skeleton of `parseSpawnOverrideRow` are reused. |
| T4 | [x] | `scripts/content-build/sessions/renderContent.ts`: emit `loadout` in the `WaveSpawn`/`StaticSpawn` literals of the generated `sessions.generated.ts`. Skip the field if `override.loadout` is absent. Import `WeaponArchetype.id` strings via the TS-import bucket `weapons`. | Depends on T3. |
| T5 | [x] | `src/shared/content/buildSession.ts`: cross-area validation. In `resolveSpawnPlanTemplate` walk every `seq` of every preset; for `override.loadout`, if set, verify that every `weaponArchetypeId ∈ WEAPON_ARCHETYPES`. This is a runtime second-pass duplicate-safety, symmetric to the `dropArchetypeId` check from 019. | Depends on T2/T4. |
| T6 | [x] | `src/sim/CombatSystem.ts`: add two public APIs — `setEnemyLoadout(enemyId, loadout, simTimeMs)` and `removeShooter(entityId)`. `setEnemyLoadout` is one line: `shooterWeapons.set(enemyId, buildShooterWeapons(loadout, 'enemy', weaponRegistry, simTimeMs))` on top of the helper extracted by the prep commit. `removeShooter(entityId)` is `shooterWeapons.delete(entityId)`. Extend the `CombatSystem` readonly type. | Depends on T2 (the `Loadout` type). `buildShooterWeapons` already exists in code. |
| T7 | [x] | `src/sim/CombatSystem.ts`: add a private function `runEnemyFiringDecisions(store, simTimeMs, shooterWeapons, weaponRegistry, emit)` next to the already-renamed `runPlayerFiringDecisions` (prep commit). It is called from `tick()` immediately after `runPlayerFiringDecisions`. It iterates `store.enemies()` in `EntityId` order; for each live (`enemy.hp > 0`) entity it looks up an entry in `shooterWeapons`, computes aim as `normalize(player.position - enemy.position)` (skip if `player === null` or zero length), calls **the same** `fireWeaponProjectiles` helper with `ownerKind: 'enemy'`, updates `weapon.nextFireSimMs` via the existing `effectiveCooldownMs`, and publishes a `fire` event. | Full contract — [non-player-firing.md](../design/non-player-firing.md). The unified `canDamageTarget` helper for impact and explosion is already implemented in 017 — regression is covered by T15. |
| T8 | [x] | `src/sim/SpawnSystem.ts`: extend `SpawnSystemOptions` (already exists after prep) with a new `onEnemySpawned?: (enemyId, loadout, simTimeMs) => void`. Extend the `onEncounterStart(encounter, store, arena, simTimeMs)` signature with a new parameter `simTimeMs`. When creating any `enemy` entity (in `executeStatic` and `spawnNextWaveEnemy`) — if the effective `loadout` (from `override.loadout`) is not `null`, call the callback with `(enemyId, loadout, simTimeMs)`. Without a callback (today's behaviour) — no-op. | Depends on T2. `simTimeMs` for static spawns comes from the extended signature; for waves — from the existing `onTick`. |
| T9 | [x] | `src/sim/worker.ts`: wiring. (a) `createSpawnSystem({ onEnemySpawned(enemyId, loadout, simTimeMs) { combat.setEnemyLoadout(enemyId, loadout, simTimeMs); } })`. (b) In the worker's `onEncounterStart`: pass `clock.simTimeMs()` into `spawn.onEncounterStart(encounter, entities, session.arena, clock.simTimeMs())`. (c) In the death hook add: `if (ctx.entityKind === 'enemy') combat.removeShooter(ctx.entityId);` next to the existing `spawn.onEnemyDeath` and `drops.onDeathHook`. | Depends on T6/T8. No new fields/systems, just three wiring points. |
| T10 | [x] | `src/main/render/landingTelegraph.ts` (a new module): a mesh pool keyed by `projectileId`. Each render frame filters `snapshot.entities` by `kind === 'projectile' && state === 'flying' && arcEnd !== null && ownerKind !== 'player'`; create/update a mesh for new ids, remove the mesh for ids that disappeared. Size — `2 * explosion.radius` if `WEAPON_ARCHETYPES[weaponArchetypeId].projectile.explosion !== null`, otherwise a fixed `0.4` wu. Style (colour, pulse) — render-only constants inside the module. | Full contract — [landing-telegraph.md](../design/landing-telegraph.md). `ProjectileSnapshot.arcEnd` already exists in the snapshot after prep. |
| T11 | [x] | `src/main/render/Renderer.ts`: integrate `landingTelegraph.update(snapshot)` into the render pass; z-order — below the player/enemy/boss/projectile sprites, above the background tile. On `dispose()`/session change — clear the mesh pool. | Depends on T10. |
| T12 | [x] | `content/enemies.md`: add a new shared archetype `slime-idol` (or the pair `slime-idol-eye` / `slime-idol-stone`): an inline image node reusing an existing slime PNG (suggestion: `slime-04.png` or `slime-45.png`); rows in every balance partition (`## Body`: `behavior: stationary`, `maxHp: 6`; `## Movement`: `maxSpeed: 0`; `## Contact damage`: `0 / 1000`; `## Knockback`: `0 / 0 / 100`; `## Drops`: empty or one power-up entry); a row in `# Sound sets / ## Members` — added to the `default` set. After `npm run content:build` `enemies.generated.ts` contains the new archetype; `validateEnemyRegistry` passes (stationary invariants are honoured). | Not a difficulty fork; a shared archetype available to any preset. |
| T13 | [x] | Migration: rename `content/sessions/campaign.md` → `content/sessions/campaign-normal.md`. Keep `displayName: "Campaign — normal"`, `order: 1`, `visibleInMenu: true`. Inside the file no balance changes, only updating `id`/`displayName` in the first table. | After this the regression test T14 keeps passing byte-for-byte. |
| T14 | [x] | Create `content/sessions/campaign-easy.md` per the easy pillars (see Player-facing): 3 sets (set-1 / set-3 / set-5), 2 waves per set; `slimeFriendlyFire: true`; aim assist on with a generous cone; full `loadoutWeaponIds`; `selectedWeaponIndex` points at a shotgun (or as the game designer prefers); no `override.loadout` on any spawn; in every second wave one guaranteed `heal-orb` carrier via `override.guaranteedDrops`. Wave pace softened (`spawnIntervalMs ×1.4`, `maxAlive ×0.7`, `zoneToMargin ×0.6`, `zoneDurationMs ×1.4`). `displayName: "Campaign — easy"`, `order: 0`, `visibleInMenu: true`. Plus create `content/sessions/campaign-hard.md` per the hard pillars: the same 5 sets × 3 waves + boss + breaks skeleton as normal. `slimeFriendlyFire: false`; aim assist off; `loadoutWeaponIds: pistol, smg, rock-thrower`; `selectedWeaponIndex: 0`. Pace tighter (`spawnIntervalMs ×0.75`, `maxAlive ×1.3`, `zoneToMargin ×1.3`, `zoneDurationMs ×0.8`). Per-set `override.loadout`: set 1 — linear shooters (pistol/smg in 1–2 spawns of every wave); set 2 — add arc throwers (rock-thrower/grenade-launcher); set 3 — add `slime-idol` with laser/sniper in 2–4 corners of every wave encounter; set 4 — add `slime-idol` with bomb-placer + retaliation on mech crabs; set 5 — add `slime-idol` with fireball-staff in the final wave. Drops are stingy: heal-orb only on slime-fortress/door/kingling/shell; regular spawns have `override.dropTable: []`. `displayName: "Campaign — hard"`, `order: 2`, `visibleInMenu: true`. | Concrete numbers are the game designer's territory; T15/T16 only check pillar facts. |
| T15 | [x] | Test: deterministic regression on `campaign-normal`. Use the `src/sim/spawnOverrides.integration.test.ts` pattern (a mini-world with a fake clock, subscribing to `emitEvent`, a snapshot baseline via vitest `__snapshots__/`). Tick sim until the final boss; the snapshot of the runtime-event sequence (`enemySpawn`/`death`/`fire`/`hit`/`explosion`/`dropSpawn`/`dropPickup`/`dropExpire` + positions/archetypes/weapon-id) must match the baseline taken **on the post-019 state** of `campaign.md` (before the rename to `campaign-normal.md`). Plus in the same file — firing path and cleanup tests ([non-player-firing.md](../design/non-player-firing.md)): (a) after `combat.setEnemyLoadout(enemyId, {weapons: ['pistol'], selectedIndex: 0}, 0)` and a stub player placed, the first `fire` event with `shooterId === enemyId, ownerKind: 'enemy'` happens exactly at `simTimeMs === PISTOL.cooldownMs`; (b) after `combat.removeShooter(enemyId)` no more `fire` events for that id; (c) with `slimeFriendlyFire: false` impact and explosion of a slime projectile do not remove HP from another slime (regression on the unified `canDamageTarget` helper); (d) with `slimeFriendlyFire: true` — they do; (e) a slime never damages itself. | All five firing cases are separate unit tests at the `CombatSystem` level. |
| T16 | [x] | Test: per-difficulty acceptance + landing-telegraph + per-set hard progression. (a) Easy in 30 s of the first wave — no `hit` event with `targetKind: 'player'`. (b) Hard in 30 s of the first wave a stub player dies only from a projectile with `ownerKind: 'enemy'` (no `hit` events with `source: 'enemyContact'` among the final ones). (c) Easy: count `dropSpawn` with `archetypeId: 'heal-orb'` ≥ ⌊wave_count / 2⌋. (d) Hard: count `dropSpawn` with `archetypeId: 'heal-orb'` from regular (non-carrier) spawns = 0. (e) A structural assert over the `campaign-hard` `SessionDefinition`: at least one `override.loadout` with linear weapons in set 1, with arc in set 2, with placed in set 4, with fireball-staff in set 5; at least one `slime-idol` spawn in set 3 and set 4; at least one `retaliation: enabled` in set 4. On easy — zero `override.loadout` on any spawn. (f) Landing telegraph: spawning an arc projectile with `ownerKind: 'enemy'` gives `arcEnd !== null` in every `state: 'flying'` snapshot, `null` after grounding; spawning with `ownerKind: 'player'` → the renderer creates no mesh; mesh size ≈ `2 * explosion.radius` for grenade-launcher vs a fixed 0.4 for rock-thrower. Plus the final verification: `npm run content:check && tsc -p tsconfig.scripts.json && npm run typecheck && npm test`. Run `npm run dev` with the three campaigns: easy first wave — zero projectile damage; hard first wave — real projectile damage in the first seconds; normal first wave — visually identical to before the migration. | The test runs per-difficulty preset; a shared harness + a unit test on `landingTelegraph.update`. Story closing. |

## Related

- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [../docs/WAVES_AND_SCALING.md](../docs/WAVES_AND_SCALING.md)
- [spawn-overrides.md](../design/spawn-overrides.md)
- [non-player-firing.md](../design/non-player-firing.md)
- [landing-telegraph.md](../design/landing-telegraph.md)
- [universal-weapons-and-projectiles.md](../design/universal-weapons-and-projectiles.md)
- [projectiles-and-combat.md](../design/projectiles-and-combat.md)
- [combat-modifiers-and-field-effects.md](../design/combat-modifiers-and-field-effects.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [content-archetypes.md](../design/content-archetypes.md)
- [content-authoring.md](../design/content-authoring.md)
- [session-definition.md](../design/session-definition.md)
- [spawn-plan.md](../design/spawn-plan.md)
- [health-and-death.md](../design/health-and-death.md)
- [sprite-assets.md](../design/sprite-assets.md)
- [zone.md](../design/zone.md)
- [main-ui-shell.md](../design/main-ui-shell.md)
- [019-spawn-overrides.md](019-spawn-overrides.md)
