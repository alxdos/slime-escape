# Spawn Overrides

- Status: accepted
- Created: 2026-04-25
- Updated: 2026-04-26 (story 020 correction: clarified that `loadout` is the only override field whose effective value is **not copied onto the runtime `enemy` entity**. Runtime slime `WeaponInstance` state lives in `shooterWeapons: Map<EntityId, ShooterWeapons>` inside the `CombatSystem` closure, symmetric with player loadout; `SpawnSystem` calls `onEnemySpawned` in the worker wiring, which calls `combat.setEnemyLoadout`. Full contract: [non-player-firing.md](non-player-firing.md). Earlier 2026-04-25: the closed list gains a fourth field, `loadout?: Loadout`, which gives a slime a per-spawn weapon for the non-player firing path ([non-player-firing.md](non-player-firing.md)). Replace-or-`null` semantics, application time, and validation match the three existing fields. The third MD override table gains two columns, `loadoutWeaponIds | selectedWeaponIndex` (see [content-authoring.md](content-authoring.md), sessions override table section). The contract "extend only by appending new fields" is followed literally. Story 019 finalized on main; this design file fully accommodates the final implementation.)

## Context

[content-archetypes.md](content-archetypes.md) defines `EnemyArchetype` as the stable identity of a creature: body, HP, movement mode, contact physics, default probabilistic drop table `dropTable`, default `retaliation` policy, and, at the 018 horizon, the `carrierDrop` extension. [spawn-plan.md](spawn-plan.md) defines `StaticSpawn`/`WaveSpawn` as references by `archetypeId` only, plus `position` for `'static'`. [session-definition.md](session-definition.md) explicitly requires `EncounterDefinition.spawnPlan` to remain a stable top-level field that evolves only through new `kind` values and does not become a bag of local patches.

This created a gap. Game design needs to describe features of **a specific spawn in a specific wave**: "this carrier fissure in the third wave of set two always drops `multi-shot`", "these two slimes in the demo encounter retaliate for friendly fire", "this fissure in the boss fight replaces its drop table with empty". After 018, the only way to express this is to fork an archetype in `content/enemies.md`, such as `campaign-set-1-carrier-slime` or `demo-retaliator-slime`, because `carrierDrop` and `retaliation` are archetype fields, and drop tables are available only as archetype fields.

That lies about the level of truth:

- "Set 1 Carrier Slime" is **not a separate creature type**; it is `slime-X` with one contextual feature in one spawn;
- `content/enemies.md` starts containing entities that do not exist in the game as slime species;
- color, sprite, and sound set for the fork must be repeated or kept identical to the base archetype, increasing duplication;
- when a second feature of the same type is needed, such as the same carrier in the same wave dropping `fragment` instead of magnet, another fork is created and `enemies.md` grows quadratically with waves x features.

A related issue is **cross-area validation**: today "guaranteed drop exists in the drop registry" is checked inside `validateEnemyRegistry` through `assertCarrierDropsResolve`. But `enemies` is a single-file area ([content-authoring.md](content-authoring.md)); cross-area refs belong to the multi-file `sessions` area. The check is not where the source of truth lives.

Without an explicit decision, story 019 would either introduce local overrides inside `scripts/content-build/sessions/**` or spread the contract across several ways to say "no data": some fields on archetype, some in spawn plan, some in session rules.

## Decision

### Core separation

Two truth levels about what enters the arena are separated explicitly and identically for all runtime systems:

- **Archetype in `content/enemies.md` = creature identity.** Stable for `slime-X` everywhere: body (`radius`, `contactBox`), health (`maxHp`), movement (`behavior`, `maxSpeed`), contact physics (`contactDamage`, `contactCooldownMs`, `knockback*`), color/sprite/sound set, **default** probabilistic drop table `dropTable`, and **default** `retaliation` policy. `carrierDrop` from [content-archetypes.md](content-archetypes.md) is removed.
- **Spawn override = appearance context.** True for **this concrete spawn in this concrete wave**: guaranteed drop, full replacement of probabilistic drop table, locally enabled retaliation. Granularity is per `seq`: one spawn-table row equals one possible override.

`behavior` is **not overridable** at this horizon: "how this slime moves" is part of identity, not "what it brought with it". "Same slime, but stationary" is a new archetype, not a spawn modifier. The same applies to body, HP, contact model, and all other "how it is built" fields.

### SpawnOverride shape

`SpawnOverride` is a flat object with a **closed** list of optional fields. It may be extended only by appending fields. Changing an existing field's semantics is a new design decision and requires updating this file.

```ts
type SpawnOverride = Readonly<{
  /** List of DropArchetype.id values that this spawn always drops on death.
   *  Semantics: ADD on top of the probabilistic roll from dropTable.
   *  Missing field = no guaranteed drops. Empty list is forbidden
   *  to avoid two ways to say "no data". */
  guaranteedDrops?: ReadonlyArray<string>;

  /** Full probabilistic table for this spawn.
   *  Semantics: REPLACE the archetype table entirely.
   *  Missing field = use archetype table.
   *  Empty array [] is valid and means "this spawn has an empty dropTable";
   *  this differs from "no override" and is needed for migration. */
  dropTable?: ReadonlyArray<DropTableEntry>;

  /** Friendly-fire retaliation policy for this spawn.
   *  Semantics: REPLACE the archetype policy.
   *  Missing field = use archetype default. */
  retaliation?: RetaliationPolicy;

  /** Weapon loadout given to this spawn for the non-player firing path (story 020).
   *  Semantics: REPLACE-or-`null`. At this horizon `EnemyArchetype` has no
   *  archetype default loadout, so effective loadout = `override.loadout` if set, otherwise `null`.
   *  Missing field = this spawn has no weapon and does not shoot.
   *  Empty `weapons: []` is forbidden, expressed by the same missing field, to avoid
   *  two ways to say "no data".
   *  Full semantics for how this field creates runtime WeaponInstance state and slime firing live in
   *  [non-player-firing.md](non-player-firing.md). */
  loadout?: Loadout;
}>;
```

`DropTableEntry`, `RetaliationPolicy`, and `Loadout` are the same types used by `EnemyArchetype` and `SessionDefinition` ([content-archetypes.md](content-archetypes.md), [drops.md](drops.md), [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md), [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)). No new types or parallel copies are introduced. `Loadout.selectedIndex` must be `null` or in `[0, weapons.length)`; each `weapons[i]` must be an existing `WeaponArchetype.id` from `WEAPON_ARCHETYPES`. These invariants mirror session-level loadout validation and are required in the sessions-area validator.

### Where SpawnOverride lives in the plan

`SpawnOverride` belongs to each per-`seq` spawn-plan entry and attaches through optional field `override`:

```ts
type StaticSpawn = Readonly<{
  archetypeId: string;
  position: Vec2;
  override?: SpawnOverride;
}>;

type WaveSpawn = Readonly<{
  archetypeId: string;
  override?: SpawnOverride;
}>;
```

Exact definitions of `StaticSpawn`/`WaveSpawn` live in [spawn-plan.md](spawn-plan.md); this decision is the single source of truth for `SpawnOverride` shape and attachment.

`'empty'` and `'boss'` plans have **no** overrides at this horizon: `'empty'` has no spawns, and `'boss'` has one boss spawn described by the plan as a whole. Boss is not a slime fork; its characteristics live in `BossArchetype`/`BossPhaseSystem` ([boss-encounter.md](boss-encounter.md)). If "same boss but with a guaranteed drop" is ever needed, that is a separate decision.

### Field semantics: replace vs add

- `guaranteedDrops` is **additive** on top of `dropTable`. On each death hook ([drops.md](drops.md)), all `guaranteedDrops` spawn at the death position first, then the normal weighted-pick roll runs over the effective dropTable (see below). Guaranteed drops do **not** call session RNG: a fixed set is not random and must not shift reproducibility. [drops.md](drops.md) already defines this for the carrier mechanic; only the source of the id list changes here.
- `dropTable` **replaces** the archetype dropTable. If the field is set, including `[]`, `DropSystem` uses it as the effective dropTable for this spawn; the archetype table is **not read** for this spawn. If the field is omitted, the effective dropTable is the archetype table.
- `retaliation` **replaces** the archetype policy. If the field is set, `RetaliationSystem` ([combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)) uses exactly that policy; the archetype policy is not read. If omitted, the archetype policy is used.
- `loadout` is **replace-or-`null`** (story 020). `EnemyArchetype` has no archetype default loadout, so effective loadout is either a copy of `override.loadout` or `null`. If effective loadout is `null`, the runtime `enemy` entity does not receive `weapons`/`selectedWeaponIndex` fields, and firing decisions for that entity are a no-op. If effective loadout is an object, `SpawnSystem` materializes runtime `WeaponInstance[]` and `selectedWeaponIndex` symmetrically with player (see [non-player-firing.md](non-player-firing.md)).

"Effective dropTable", "effective retaliation", and "effective loadout" are internal terms in this decision. They describe what is placed into runtime state at spawn time. No `Map<seq, override>` is passed around at runtime.

### Application time

Override is applied **once** when `SpawnSystem` materializes the entity ([spawn-plan.md](spawn-plan.md)). After that, the runtime entity is indistinguishable from a normal spawn: there is no per-tick override logic, and no other system knows the word `SpawnOverride`.

This means runtime `enemy` state carries already **resolved** per-instance copies:

- `guaranteedDrops: ReadonlyArray<string>`: copy of `override.guaranteedDrops ?? []`. If non-empty, snapshot field `carrierDropMarker: 'reward'` is set (see [snapshot-shape.md](snapshot-shape.md)); this is the only way presentation learns about carrier fissures after 019.
- `dropTable: ReadonlyArray<DropTableEntry>`: copy of `override.dropTable` if set, otherwise copy of `archetype.dropTable`. `DropSystem` ([drops.md](drops.md)) reads **only** this entity field for weighted picks; the archetype `dropTable` remains the source of the **default copy**, not per-tick truth.
- `retaliation: RetaliationPolicy`: copy of `override.retaliation` if set, otherwise copy of `archetype.retaliation`. `RetaliationSystem` reads **only** this entity field.

`loadout` (story 020) is the exception: its effective value is **not copied onto the `enemy` entity**. Instead, when `SpawnSystem` materializes any `enemy` with effective `loadout !== null`, it calls callback `onEnemySpawned(enemyId, loadout, simTimeMs)`. Worker wiring forwards that to `combat.setEnemyLoadout(enemyId, loadout, simTimeMs)`. Runtime slime `WeaponInstance[]` and `selectedWeaponIndex` live in `shooterWeapons: Map<EntityId, ShooterWeapons>` inside the `CombatSystem` closure, symmetric with player loadout. Cleanup is `combat.removeShooter(enemyId)` from the existing death hook. Full contract: [non-player-firing.md](non-player-firing.md). The reason for this exception is that `WeaponInstance` is not "an archetype field delayed until spawn"; it is **runtime state with its own lifecycle** owned by `CombatSystem`. Player loadout in the 017 implementation already lives there, and slimes use the same structure.

The same field-copy rule for `guaranteedDrops`/`dropTable`/`retaliation` mirrors the existing rule for `Drop` ([drops.md](drops.md)): ticks do not depend on extra lookups, and runtime remains stable against future archetype mutations in editors/tests.

### Removing `EnemyArchetype.carrierDrop`

After this decision is accepted and migrated:

- `carrierDrop` is removed from `EnemyArchetype` ([content-archetypes.md](content-archetypes.md)), along with `CarrierDropMetadata` and `marker: 'reward'`; `EnemyArchetype.dropTable` and `EnemyArchetype.retaliation` **remain** as defaults;
- `assertCarrierDropsResolve` is removed from `validateEnemyRegistry` ([src/shared/content/enemies.ts](../src/shared/content/enemies.ts)); the cross-area check that "guaranteed drop exists in the `DropArchetype` registry" moves to the multi-file `sessions` validator (see below);
- `content/enemies.md` loses the `## Carrier Drops` partition and all seven fork archetypes (`campaign-set-1..5-carrier-slime`, `demo-carrier-slime`, `demo-retaliator-slime`); their members in the `## Members` partition of `# Sound sets` disappear as well;
- `scripts/content-build/enemies/**` no longer parses or renders `carrierDrop`;
- snapshot runtime field `carrierDropMarker` ([snapshot-shape.md](snapshot-shape.md)) keeps its shape, but its source changes from `EnemyArchetype.carrierDrop?.marker` to `guaranteedDrops.length > 0 ? 'reward' : null` derived by `SpawnSystem`/`EntityStore`. Renderer reads the same snapshot field and does not change.

The old and new models may not coexist. Migration is part of story 019, not a follow-up. After the story closes, there is no valid place for `EnemyArchetype.carrierDrop`.

### Validation

Checks are distributed across layers in the same way as other multi-file areas ([content-authoring.md](content-authoring.md)).

- **content-build, `sessions` area (`scripts/content-build/sessions/**`)**: static MD-side checks:
  - hard error on unknown override field name, anything outside `{guaranteedDrops, dropTable, retaliation}`;
  - hard error on override for missing `seq`, meaning no such row in the main spawn table for the same encounter;
  - hard error on duplicate `seq` in the override table;
  - hard error on unknown `dropArchetypeId` in any override field, using the same `requireDropRef` as cross-area refs from [content-authoring.md](content-authoring.md);
  - warning on `chance < 0`, `chance > 1`, and `sum(chance) > 1` in `override.dropTable`, matching warn rules in `validateEnemyRegistry` for archetype dropTable;
  - warning on `retaliation.enabled === true && retaliation.durationMs <= 0`;
  - hard error on an empty `guaranteedDrops` list in MD. Use `none`, not an empty cell, to express missing field;
  - hard error on unknown `weaponArchetypeId` in `override.loadout.weapons`, using cross-area ref into `weapons` through TS import `WEAPON_ARCHETYPES`, analogous to `requireDropRef`;
  - hard error on `override.loadout.selectedIndex` outside `[0, weapons.length)` and not equal to `null`;
  - hard error on empty `loadout.weapons: []`. Express no loadout as `none` in both `loadoutWeaponIds` and `selectedWeaponIndex`, following the same single "no data" rule as `guaranteedDrops`;
  - hard error on partially specified loadout: `loadoutWeaponIds = none` with non-`none` `selectedWeaponIndex`, or the reverse. Both columns define one `SpawnOverride.loadout` field.
- **session builder (`src/shared/content/buildSession.ts`)**: second pass over assembled `SessionDefinition`. The former `assertCarrierDropsResolve` moves here:
  - every `dropArchetypeId` mentioned in any `override.guaranteedDrops` and any `override.dropTable` across all encounters and presets must resolve in `DROP_ARCHETYPES`. This is duplicate safety against drift between MD and `drops.generated.ts`. The MD side already checks it, but runtime start keeps a protective layer, matching today's archetype rules.
  - every `weaponArchetypeId` mentioned in any `override.loadout.weapons` must resolve in `WEAPON_ARCHETYPES`; same duplicate safety against drift between MD and `weapons.generated.ts`.
- **runtime systems**: no new checks. By the time ticks run, everything is resolved into runtime entity fields; `SpawnSystem`/`DropSystem`/`RetaliationSystem` read only prepared entity fields.

### MD shape: reference to content-authoring

This file only fixes that designers describe overrides **inside the encounter section of a preset** in `content/sessions/<presetId>.md`, not in `content/enemies.md` and not in `content/sessions.md`. The exact shape of the third optional table (`seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex`) and allowed mini-syntaxes inside its cells live in [content-authoring.md](content-authoring.md), section "Multiple tables in one H2 section" for the `sessions` area. That section expands the area from two tables to three and defines the controlled exception to "narrow table: id + <=4 fields" for exactly six fields beyond `seq`. Duplicating that syntax here is forbidden by the "no two sources of truth" rule.

One additional scope rule belongs here, not only in authoring rules:

- **an override table in an encounter** is allowed only when `spawnKind in {wave, static}`. For `spawnKind in {empty, boss}`, the third table is forbidden (see "Where SpawnOverride lives in the plan").

### What must not be introduced locally

- stat multipliers such as `hpMultiplier`, `speedMultiplier`, `damageMultiplier` as overrides. That is a separate design decision and this file's scope must not expand silently;
- per-encounter override, one row for "all slimes of type X in this wave", in addition to per-`seq`. With per-`seq` it is redundant; if ever needed, it requires a new decision;
- a `modifiers: [{ kind, ... }]` array as the storage shape. The closed flat set of named fields is intentional: each field has its own semantics, add vs replace, and a discriminated union by `kind` does not simplify authoring or runtime;
- overriding `behavior` (per-spawn `chase <-> stationary`) or any other "how the creature is built" field. That is a new archetype, not a spawn modifier. Such tasks go through `content/enemies.md`, not overrides. In particular, the stationary turret in 020 is a new shared archetype `slime-idol` in `content/enemies.md` ([../stories/020-shooting-slimes.md](../stories/020-shooting-slimes.md)), not `behavior` override on an existing slime;
- per-archetype default loadout on `EnemyArchetype` ("slime-X always shoots"). This is intentionally out of scope for 020. 020 follows the principle "shooting is appearance context, not identity". If an archetype truly shoots everywhere, either duplicate `loadout` in each spawn override or add a separate design decision for an archetype field; then override semantics change to replace-or-archetype-default, not replace-or-`null`;
- coexistence of `EnemyArchetype.carrierDrop` and spawn override. Migration is strict; forks are removed in story 019;
- templates/inheritance between `content/sessions/<preset>.md` files. Each preset stands alone, already defined in [content-authoring.md](content-authoring.md); this file repeats it only as a "do not also do this";
- `loadout` for `spawnPlan.kind === 'boss'`. Boss firing remains with `BossPhaseSystem` ([boss-encounter.md](boss-encounter.md)), not with the non-player firing path. Override tables for `'boss'` plans are already forbidden by the rule "override table allowed only when `spawnKind in {wave, static}`"; `loadout` does not weaken that rule.

## Consequences

- `content/enemies.md` shrinks by seven forks (`campaign-set-1..5-carrier-slime`, `demo-carrier-slime`, `demo-retaliator-slime`); it contains only real slime species. The `## Carrier Drops` partition disappears.
- Contextual features of concrete waves, such as carrier fissures in sets and demo retaliators, stay exactly where designers edit them: in `content/sessions/<presetId>.md`. One file equals one preset; one row equals one feature.
- Runtime systems become simpler. `DropSystem` no longer reaches into `EnemyArchetype` for `dropTable`/`carrierDrop`; it reads resolved entity fields, matching the existing rule to copy archetype fields onto runtime entities from [drops.md](drops.md). `RetaliationSystem` already reads `target.retaliation`; only the source changes from archetype-only to override-or-archetype.
- `validateEnemyRegistry` shrinks to checks genuinely about archetypes: stationary invariants, tunneling, and archetype dropTable validity. The cross-area check "guaranteed drop exists" moves to the area where the reference lives: the sessions validator ([content-authoring.md](content-authoring.md), "Multi-file areas" and cross-area double validation).
- `DropSystem`/`SpawnSystem`/`RetaliationSystem` tests that currently rely on `EnemyArchetype.carrierDrop` are rewritten to provide override through the spawn plan, matching the production data path better.
- Extension in 020, `loadout` as an override field, fits the same closed flat field set: one `loadout?: Loadout` is added without structural `SpawnSystem` changes. There are no contract collisions: `Loadout` is already defined in [content-archetypes.md](content-archetypes.md) and [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md), and reuse in overrides is the natural extension of "appearance context, not identity".
- Migration preserves **contextual spawn features** (`guaranteedDrops`, `dropTable`, `retaliation`) and removes seven historical fork archetypes as identity records. If an old fork differed from the chosen visual base archetype in stats (`radius`, `maxHp`, movement/contact/knockback/color), those stat differences are intentionally not carried over: spawn override does not become stat override at the 019 horizon, and campaign balance is considered movable. Determinism by `seed` is preserved for the new model, but byte-for-byte identity with pre-019 simulation is not an architectural invariant.
- A new single source of truth appears for "appearance context": the next story that wants another spawn feature, such as alternate render color or temporary modifier, adds a new field to `SpawnOverride` rather than creating more archetype forks.
- `loadout` (story 020) validates the principle: adding a major mechanic ("slimes shoot") becomes one optional field in the closed set, without structural `SpawnSystem` changes and without new spawn-plan kinds. Cost: one validator rule and two new MD override-table columns. All runtime behavior, including firing path, tick phase, and cleanup, lives separately in [non-player-firing.md](non-player-firing.md). This is the intended "appearance context" design.

## Related

- [content-archetypes.md](content-archetypes.md)
- [spawn-plan.md](spawn-plan.md)
- [session-definition.md](session-definition.md)
- [drops.md](drops.md)
- [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)
- [content-authoring.md](content-authoring.md)
- [content-boundaries.md](content-boundaries.md)
- [snapshot-shape.md](snapshot-shape.md)
- [boss-encounter.md](boss-encounter.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [non-player-firing.md](non-player-firing.md)
- [../stories/019-spawn-overrides.md](../stories/019-spawn-overrides.md)
- [../stories/020-shooting-slimes.md](../stories/020-shooting-slimes.md)
