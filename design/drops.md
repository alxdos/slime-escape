# Drops

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-26 (story 024: `DropSystem` exposes successful pickup facts to `RunSummaryTracker` for `SessionResultSummary`; see [session-result-summary.md](session-result-summary.md). Earlier story 019: guaranteed drops and archetype `dropTable` replacement move from the archetype to [spawn-overrides.md](spawn-overrides.md); `DropSystem` reads per-spawn `dropTable` and `guaranteedDrops` from the runtime `enemy` entity, not from `EnemyArchetype`. Earlier: 2026-04-24 sprite extension: `Drop` rendering moves from primitives to PNG sprites by [sprite-assets.md](sprite-assets.md); the `dropVisuals` registry keyed by `dropArchetypeId` is added there and sourced from inline image nodes in `content/drops.md`. Cleanup pass: `DropEffect` is the single source of truth for the union; `kind: 'pickupModifier'` is added explicitly here as the binding point for the drop magnet from [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md). 017 alignment: `DropEffect` includes weapon modifier and temporary overdrive effects from [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). 018 alignment: drop magnet uses the new `pickupModifier` kind; carrier drops are defined by [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md).)

## Context

[runtime-systems.md](runtime-systems.md) already establishes `DropSystem`, its place in the update order (after `HealthDeathSystem`, before `ZoneSystem`/`SnapshotExportSystem`), the three expected runtime events (`spawn`/`pickup`/`expire`), and the rule that `DropSystem` reacts to death hooks and owns only the drop lifecycle. [health-and-death.md](health-and-death.md) lists `DropSystem` as the canonical consumer of `DeathHook`. [content-boundaries.md](content-boundaries.md) states that drop tables live in the `content library`. The following points were still unspecified:

- the shape of the `Drop` entity itself and where it lives;
- the shapes of `DropArchetype` and `DropEffect`;
- drop-table shape and selection semantics: one weighted pick vs independent rolls;
- how the effect applies to the player and where that sits relative to `HealthDeathSystem`;
- the internal order of spawn-on-death-hook, ttl, and pickup inside `DropSystem`;
- the randomness source: one `nextFloat` per death, through session RNG.

Story 005 is the first time drops become playable. Without an explicit contract, it would implicitly define the drop entity, the heal-effect owner, and the roll algorithm; 006 (boss) and future inventory/reward stories would reopen the same questions.

## Decision

### Drop as a runtime entity

- A drop is a separate runtime entity with its own `id` and `kind: 'drop'`. It is stored in `EntityStore` alongside the player, enemies, and projectiles. We do not introduce a separate drop pool outside the store, for the same reason as projectiles ([projectiles-and-combat.md](projectiles-and-combat.md)).
- Minimal runtime state:
  ```ts
  type Drop = {
    id: EntityId;
    kind: 'drop';
    archetypeId: string;            // DropArchetype.id from the content library
    radius: number;                  // wu, copied from DropArchetype.radius
    effect: DropEffect;              // copied from the archetype
    color: number;                   // copied from the archetype, renderer placeholder
    expireAtSimMs: number;           // despawn time by ttl
    position: { x: number; y: number };
  };
  ```
- `radius`, `effect`, `color`, and `expireAtSimMs` are copied from the archetype at creation time. The tick does not depend on extra lookups and remains stable if archetypes are later mutated in editors or tests. This mirrors `Projectile` ([projectiles-and-combat.md](projectiles-and-combat.md)).
- Drops do not have `hp` or `behavior`. Baseline drops do not move. Story 018 adds deterministic magnet attraction owned by `DropSystem`; that extension is defined in [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md) and does not change drop ownership.
- Drops are **not damageable**: they do not have `HasHealth` ([health-and-death.md](health-and-death.md)), and `HealthDeathSystem` ignores them. Only `DropSystem` removes drops, matching the accepted rule that projectiles and drops are removed by their own systems ([projectiles-and-combat.md](projectiles-and-combat.md)).
- Drops enter the snapshot under their own `kind` (see [snapshot-shape.md](snapshot-shape.md)). Render selects visuals by `archetypeId` through the `dropVisuals` registry ([sprite-assets.md](sprite-assets.md)), not by entity `id` and not by `color`. `color` remains in `DropArchetype` as a placeholder for non-renderer consumers; the base sprite renderer does not tint drop PNGs with it.

### DropArchetype and DropEffect

- `DropArchetype` lives in the `content library` (`src/shared/content/**`, [web-stack.md](web-stack.md)) and follows the general archetype rules from [content-archetypes.md](content-archetypes.md): read-only data, stable string `id`, references by `id` only, extension by appending only.
- The current full union is defined here as the single source of truth; other design files reference it instead of duplicating it:
  ```ts
  type DropEffect =
    // baseline (005)
    | { kind: 'heal'; amount: number }
    // weapon modifiers (017, see universal-weapons-and-projectiles.md for WeaponModifier)
    | { kind: 'addWeaponModifier'; modifier: WeaponModifier; target: 'selectedWeapon' }
    | { kind: 'temporaryOverdrive'; cooldownMultiplier: number; durationMs: number; target: 'selectedWeapon' }
    // pickup-comfort modifiers (018, see combat-modifiers-and-field-effects.md for PickupModifier)
    | { kind: 'pickupModifier'; modifier: PickupModifier };

  type DropArchetype = Readonly<{
    id: string;
    displayName: string;
    radius: number;          // wu, > 0; for overlap tests and rendering; derived from PNG, see below
    ttlMs: number;           // integer > 0; lifetime in the arena after spawn
    effect: DropEffect;
    color: number;           // 0xRRGGBB, renderer placeholder
  }>;
  ```
- `radius` is a runtime archetype field and also a **derived** content-pipeline value. `content-build` computes it as `min(worldSize.width, worldSize.height) / 2` for the corresponding `dropVisuals[dropArchetypeId]` entry, per [sprite-assets.md](sprite-assets.md). `content/drops.md` has no `radius` column: the drop PNG is the only source of truth for both visual size and pickup overlap. If visual size and pickup zone ever need to diverge, following the `projectile.size` vs `hitRadius` pattern, a separate `pickupRadius`/`pickupBox` field will be introduced by a separate design decision.
- `DropEffect` is a discriminated union by `kind`. It may be extended only by adding new `kind` values; renaming or changing field semantics is a new decision and requires updating this file.
- `DropEffect.kind: 'heal'` keeps the 005 healing semantics described below. `addWeaponModifier` and `temporaryOverdrive` semantics live in [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). `pickupModifier` semantics, including the drop magnet and future pickup-comfort modifiers, live in [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md); `DropSystem` owns mutation of owner-local pickup-related player state for this `kind`.
- The `DropArchetype` registry in the `content library` has the same shape as the `EnemyArchetype`/`WeaponArchetype` registries from [content-archetypes.md](content-archetypes.md): a `Record<string, DropArchetype>` keyed by `archetype.id`. The exact file, for example `src/shared/content/drops.ts`, is an implementation detail, not a contract.

### Drop table on EnemyArchetype

- The archetype default for "what this enemy drops by default" lives on `EnemyArchetype` ([content-archetypes.md](content-archetypes.md)) as `dropTable`:
  ```ts
  type DropTableEntry = Readonly<{
    archetypeId: string;     // DropArchetype.id from the content library
    chance: number;          // [0, 1]
  }>;

  // additional EnemyArchetype field:
  // dropTable: ReadonlyArray<DropTableEntry>
  ```
- There is no separate `DropTable` entity with its own `id`: one archetype table is one enemy-archetype field. This is intentional. Story 005 does not introduce table sharing between enemies. If sharing is needed later, it will be a separate decision such as a `dropTableId` reference layered on top of the existing field.
- The **effective dropTable for a concrete spawn** is a per-spawn copy resolved by `SpawnSystem` at spawn time. If that `seq` has `SpawnOverride.dropTable` ([spawn-overrides.md](spawn-overrides.md)), it replaces the archetype table entirely; otherwise the archetype table is copied. `DropSystem` reads **only** this runtime field from the entity for weighted picks. The archetype `dropTable` is the source of the default copy, not per-tick truth.
- Selection semantics are **one weighted pick per death**, not sequential independent rolls. Algorithm:
  1. `roll = rng.nextFloat()`; exactly one session RNG call for each hook invocation with a non-empty effective table ([rng.md](rng.md));
  2. walk the effective entity `dropTable` in index order, accumulating `chance`. The first entry where `accumulated > roll` wins;
  3. if the total table `chance` is less than one and `roll >= sum(chances)`, there is **no** weighted-pick drop for this death. This is how content expresses "nothing dropped".
- Baseline death processing gives **at most one weighted-pick drop** per death. Per-spawn `SpawnOverride.guaranteedDrops` ([spawn-overrides.md](spawn-overrides.md)) adds drops **on top of** the weighted pick: the listed `dropArchetypeId`s spawn at the death position **before** the weighted pick and do not call session RNG. Guaranteed drops and the weighted pick are independent sources; neither replaces the other.
- Numeric constraints, enforced by content/builders for both archetype `dropTable` and `SpawnOverride.dropTable`:
  - each entry `chance` is in `[0, 1]`;
  - total `chance` is `<= 1`. Violations are warnings through `log.warn` at build/session start ([logging.md](logging.md)); this is a content error, not a runtime fallback;
  - every `archetypeId` in a `dropTable` must resolve in the `DropArchetype` registry. Unknown `id` is a session-build error, not a runtime fallback, matching other archetype references in [content-archetypes.md](content-archetypes.md). Archetype tables are checked in `validateEnemyRegistry`; override tables are checked by the multi-file `sessions` validator (see [content-authoring.md](content-authoring.md) and [spawn-overrides.md](spawn-overrides.md), "Validation").
- An empty `dropTable` (`[]`) is valid and means "this enemy drops nothing" for an archetype or "this concrete spawn has an empty dropTable" for an override. The archetype field is required: explicit `[]` is different from "forgot to set it" and keeps the [content-archetypes.md](content-archetypes.md) rule that there must not be two ways to say "no data". For overrides, `[]` is different from "no override" (omitted field) and supports migration scenarios from [spawn-overrides.md](spawn-overrides.md).

### `DropSystem` lifecycle

- `DropSystem` has two entry points: a death hook outside the normal update tick, and its own tick in the update order ([runtime-systems.md](runtime-systems.md), `DropSystem` step).
- At simulation start, in the same registration point as other hooks from [health-and-death.md](health-and-death.md), `DropSystem` registers a `DeathHook` that reacts only to `entityKind === 'enemy'`.
- On `sessionStart`/`stopSession`, and on automatic run end by `win`/`loss` ([runtime-systems.md](runtime-systems.md)), internal `DropSystem` state is reset. Drops in `EntityStore` are removed together with the rest of runtime state at the shared reset point; `DropSystem` does not preserve drops between sessions.
- Drops are **not automatically cleared** at `encounterEnd`: a forgotten drop remains in `EntityStore` and can be picked up in the next encounter until its ttl expires. This is intentional. The GDD ([../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)) allows "drop after a wave as a reward in the dark", and deleting drops on `encounterEnd` would break that scenario. If the rule changes later, it will be changed here.

### Spawn on death hook

- The `DropSystem` hook runs synchronously in the `runDeathHooks` phase ([health-and-death.md](health-and-death.md), step 4 of the in-tick order).
- The hook receives `DeathContext`: `entityId`, `entityKind`, `archetypeId`, `position`, `cause`, `simTime`.
- Hook steps:
  1. if `entityKind !== 'enemy'`, return. The player, and any future kind, does not drop items even if it somehow gains a `dropTable`. For the 005 horizon `dropTable` exists only on `EnemyArchetype`, but the explicit filter protects future extensions.
  2. read the entity's **spawn-resolved** copy of `dropTable` and `guaranteedDrops`. `SpawnSystem` writes these fields from per-spawn `SpawnOverride` or archetype defaults (see [spawn-overrides.md](spawn-overrides.md), "Application time"). The hook **does not read** these two fields from the `enemyRegistry`; it trusts what `SpawnSystem` put on the runtime entity. If the runtime entity is unavailable, which would mean it died too early in the lifecycle, write `log.error` and return without spawning ([logging.md](logging.md)).
  3. for each `dropArchetypeId` in `guaranteedDrops`, in list order, resolve `DropArchetype` through the map built at session start ([content-archetypes.md](content-archetypes.md)) and spawn a drop at the death position. These spawns do **not** touch session RNG. Unknown `dropArchetypeId` here is a runtime violation of the session-build contract; the validator should have caught it. The hook writes `log.error` and skips that id instead of crashing.
  4. if the effective `dropTable` is empty, return without a weighted pick. RNG is **not called** in this case: an empty table is zero rolls, so the RNG sequence depends only on deaths where a weighted-pick drop could actually happen. This simplifies reproducibility and tests.
  5. otherwise make exactly one `rng.nextFloat()` call and choose a `DropArchetype` by the "Drop table" rule above. If the result is `null` because the roll landed above the sum of chances, return without spawning a weighted-pick drop.
  6. otherwise call `EntityStore.spawnDrop(spec)` with `position = ctx.position` and `expireAtSimMs = ctx.simTime + dropArchetype.ttlMs`. Publish runtime event `dropSpawn` ([snapshot-shape.md](snapshot-shape.md)).
  7. step order 3 -> 4 -> 5 is fixed: **guaranteed drops spawn before weighted-pick drops**, so the `dropSpawn` event stream is deterministic relative to `seed` and independent of runtime entity field iteration order.
- The hook **does not** deal damage, mutate HP on other entities, or trigger cascading deaths. This matches the hook rules in [health-and-death.md](health-and-death.md).
- During the hook, the dead enemy is still available in `EntityStore` because removal is step 5 of the in-tick order. `DropSystem` relies on `ctx.position` and does not read `EntityStore.enemyById(ctx.entityId)`. That keeps the hook independent of internal cleanup order.

### Per tick: ttl and pickup

- During the `DropSystem` tick phase, after `HealthDeathSystem.removeDead()` and before `ZoneSystem`, the system walks all drops in `EntityStore` and decides in a strict order:
  1. **ttl expiry**: if `simTime >= drop.expireAtSimMs`, mark the drop for removal and publish `dropExpire` first (see [snapshot-shape.md](snapshot-shape.md)). Pickup is no longer possible for this drop on the same step: one drop has exactly one end-of-life event, either `dropPickup` or `dropExpire`.
  2. **pickup detection**: for drops not marked by ttl, test overlap with the player: `dist(player.position, drop.position) <= player.radius + drop.radius`, where `player.radius` is derived from the player sprite (`max(contactBox.width, contactBox.height) / 2`) rather than from a manual field in `content/players.md`. If the player is absent (`store.player() === null`), pickup is a no-op for all drops. This matches the general systems tolerance for `player === null` from [health-and-death.md](health-and-death.md).
  3. on overlap: apply `drop.effect` (see below), report the pickup fact to `RunSummaryTracker` for final statistics ([session-result-summary.md](session-result-summary.md)), mark the drop for removal, and publish `dropPickup`.
  4. remove marked drops from `EntityStore`.
- "ttl before pickup" is intentional. On the tick where a drop expires exactly while overlapping the player, it counts as expired, not picked up. This removes a same-tick "did I make it?" ambiguity and makes behavior deterministic. With project tick rates (`SIM_HZ = 60`, [simulation-timing.md](simulation-timing.md)), the exact one-tick tie can happen only when `ttlMs` is exactly divisible by `SIM_STEP_MS`, and is not considered meaningful for UX.
- `SpatialIndex` ([runtime-systems.md](runtime-systems.md)) is not required for pickup at the 005 horizon: the number of drops in the arena is small, usually at most dozens, so a linear pass is cheaper. If profiling later shows pressure, using `SpatialIndex` inside `DropSystem` is an implementation detail, not a contract.
- `DropSystem` does not move drops or clamp them to arena bounds. A drop always spawns at the enemy death position, which is already inside the arena by [arena-and-coordinates.md](arena-and-coordinates.md). If a future mechanic allows drops outside the arena, it will be a separate decision.

### Applying the effect

- The effect is applied inside `DropSystem` during pickup, synchronously, before `dropPickup` is published. This means the state observed by HUD/audio alongside `dropPickup` already includes the applied effect: player HP has changed and the item is gone from `EntityStore`.
- In 005, the only implementation is `DropEffect.kind: 'heal'`:
  ```ts
  player.hp = min(player.maxHp, player.hp + effect.amount)
  ```
  - content guarantees `amount > 0`;
  - `min(player.maxHp, ...)` is the only clamp. Overheal is not introduced and will need a separate decision if required later;
  - healing a dead player is impossible by construction: pickup is a no-op when `player === null`, and the player has already been removed by this phase if they died on the same tick.
- `HealthDeathSystem` remains the **only owner of HP decrement** ([health-and-death.md](health-and-death.md): `CombatSystem` may not read or mutate HP; all subtractions are performed only by `HealthDeathSystem`). Heal is an **increment**, explicitly owned by `DropSystem`. The MVP does not introduce a separate buff/heal application system. There is one positive HP mutation point: `DropSystem`. If other heal sources appear later, such as regeneration over time or a boss effect, that will be a separate decision and the right time to discuss a shared effect bus.
- `DropSystem` **does not** create `DamageIntent`s and **does not** call `HealthDeathSystem`. Heal must not produce death events, run death hooks, or enter the shared `applyDamage` tick.
- No other system may apply `DropEffect`. `DropEffect` is the contract for what a drop does on pickup, not a general `EffectIntent` for arbitrary sources.
- Weapon modifier and overdrive effects mutate owner-local weapon state through the narrow runtime API defined by [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). `DropSystem` still owns pickup and removal; it does not spawn projectiles.
- `pickupModifier` effects mutate owner-local pickup-related player state owned by `DropSystem` itself (see [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)). `HealthDeathSystem` and `CombatSystem` do not touch that state.

### Allies, enemies, and ownership

- In 005, only the player picks up drops. Enemies do not pick up drops: pickup checks only the pair "player <-> drop" and does not iterate enemies. This matches the general `ownerKind`-based interaction model from [projectiles-and-combat.md](projectiles-and-combat.md). Drops do not have an owner because they do not belong to the shooter; they belong to the arena once spawned.
- If enemy collectors or allied NPCs are ever needed, this decision can extend the "who picks up" section, while preserving the contract that one pickup creates one event and applies one effect.

### Randomness source

- The only randomness source in `DropSystem` is session RNG ([rng.md](rng.md)). In 005 this is:
  - one `rng.nextFloat()` for each dropTable roll on enemy death with a non-empty table.
- `Math.random`, `Date.now`, and `performance.now` are forbidden in `DropSystem`, as in every other part of `src/sim/**` ([rng.md](rng.md)).
- Determinism: for the same `seed`, tick sequence, and death sequence, the drop sequence (what dropped and where) is identical. This is covered by tests per [testing.md](testing.md).
- Drop position is fully determined by enemy death position and needs no additional RNG call. Random drop-position jitter, if ever desired, must be added by a separate decision and at the end of the per-death RNG call sequence so existing recorded tests are not shifted.

## Consequences

- 005 gets a compact contract: "a drop is an entity with its own kind; a drop table is an enemy-archetype field; each death makes exactly one weighted pick; ttl and pickup live in `DropSystem`; heal mutates `player.hp` directly and publishes `dropPickup`."
- `HealthDeathSystem` remains the single point for HP decrement and death; adding heal does not blur that responsibility.
- `EntityStore` gains a third lifecycle-owned entity type after `Projectile`. The rule "drops and projectiles are removed by their own systems" becomes a general pattern that future short-lived entities, such as temporary effect visuals, can follow.
- Extensions such as a second effect, weapon pickups, magnet, or table sharing between enemies are expressed as union and reference extensions, not ad hoc shape changes.
- One-tick heal camping risk: if the player dies on the same tick while standing on a drop, heal applies **only on the next tick**, which never happens because the player is removed by `HealthDeathSystem`. At `SIM_HZ = 60` this is not noticeable and is deliberate; moving heal before damage would break the single HP-decrement owner. This edge is documented as acceptable.
- Drops **do not** interact with `ZoneSystem` ([zone.md](zone.md)): the zone does not deal damage, and drops under the dark zone remain present and pickable. This preserves the GDD scenario where the player may risk entering darkness for a reward.
- Drop archetypes physically live in the `content library`; adding new effects and archetypes does not require system edits beyond extending the `DropEffect` union.

## Related

- [runtime-systems.md](runtime-systems.md)
- [health-and-death.md](health-and-death.md)
- [snapshot-shape.md](snapshot-shape.md)
- [content-archetypes.md](content-archetypes.md)
- [content-boundaries.md](content-boundaries.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [rng.md](rng.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [simulation-timing.md](simulation-timing.md)
- [logging.md](logging.md)
- [testing.md](testing.md)
- [zone.md](zone.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)
- [spawn-overrides.md](spawn-overrides.md)
- [session-result-summary.md](session-result-summary.md)
