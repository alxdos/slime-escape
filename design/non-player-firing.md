# Non-Player Firing

- Status: accepted
- Created: 2026-04-25
- Updated: 2026-04-29 (story 030 prep: companion firing reuses the same `CombatSystem.shooterWeapons` ownership model but has separate AI/aim/rescue rules in [companion-combat.md](companion-combat.md); this file remains enemy-specific. Earlier: 2026-04-26 correction: slime `WeaponInstance`s live **not on the `enemy` entity**, but in the same `shooterWeapons: Map<EntityId, ShooterWeapons>` inside the `CombatSystem` closure as the player loadout. Reality in 017: `ShooterWeapons.ownerKind` already supports `'enemy'`/`'boss'`; `setPlayerLoadout(playerId, loadout, simTimeMs)` is the only loadout initialization path in `CombatSystem`; cleanup happens only through `combat.clear()` on session start/stop. Slimes add symmetric `setEnemyLoadout` / `removeShooter` APIs plus a callback from `SpawnSystem` for wiring. The previous wording about `weapons`/`selectedWeaponIndex` fields on runtime `enemy` entities and automatic cleanup through entity removal was wrong.)

## Context

[universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md) defines the shared weapon model: `WeaponArchetype` plus owner-local `WeaponInstance`, fire patterns, projectile motion, explosions, fragments, weapon modifier drops, and `slimeFriendlyFire`. [projectiles-and-combat.md](projectiles-and-combat.md) defines `CombatSystem` as the single owner of firing decisions, projectile motion, hit detection, explosion resolution, and damage-intent production. At the 017 horizon, the actual firing path is used only by the **player**: `RuntimeInputState.firing` plus `aimWorld` -> selected `WeaponInstance` -> `fireWeaponProjectiles`.

Story 019 introduced `SpawnOverride` for per-spawn characteristics (`guaranteedDrops`, `dropTable`, `retaliation`). Story 020 extends that closed set with a fourth field, `loadout` ([spawn-overrides.md](spawn-overrides.md)), which gives a concrete slime spawn a weapon. The field alone does nothing: to fire real projectiles, the game needs a **non-player firing path**, which does not exist today.

Boss firing is a separate case and is not part of this contract. It remains owned by `BossPhaseSystem` ([boss-encounter.md](boss-encounter.md)), with its own phase set and attack ids. This decision applies only to `enemy` entities that receive an effective `loadout` through spawn overrides.

Without an explicit contract, story 020 would implicitly define where shooter state lives for a slime (on the entity, in a side table, or in a `CombatSystem` map), how aim is selected, which tick phase fires, and how cleanup after death works. Each of those is a durable architectural rule that affects determinism, testability, and future AI extensions.

## Decision

### Scope

- This decision covers the firing path **only for `kind: 'enemy'`** entities whose effective `loadout` is not `null` after spawn overrides are applied.
- Companion firing is out of scope for this file. It uses the universal owner-local weapon model, but mode selection, target acquisition, aim intent, ghost weapon disable, and rescue restore are owned by [companion-combat.md](companion-combat.md).
- Boss firing (`kind: 'boss'`) is out of scope. Boss remains on `BossPhaseSystem`. If a boss ever moves to the universal weapon model, that will be a separate decision that references this file.
- Player firing (`kind: 'player'`) is out of scope. It is already defined by [projectiles-and-combat.md](projectiles-and-combat.md) and [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md); this file does not reopen it.
- AI targeting, such as line of sight, leading shots, kiting, target priority, and phase-based weapon switching, is out of scope. For this horizon, a shooting slime is a naive bot: it aims at the player's current position and fires when cooldown is ready.

### Where slime WeaponInstances live

- Slime `WeaponInstance`s live **in the same `shooterWeapons: Map<EntityId, ShooterWeapons>` inside the `CombatSystem` closure** as player loadout. No new fields are added to runtime `enemy` entities.
- `ShooterWeapons` is already established by the 017 implementation with the needed discriminators:
  ```ts
  type ShooterWeapons = {
    ownerKind: 'player' | 'enemy' | 'boss' | 'companion';
    weapons: WeaponInstance[];
    selectedIndex: number | null;
  };
  ```
- This is not a speculative side table. Player loadout already lives here today, and `setPlayerLoadout(playerId, loadout, simTimeMs)` plus `clear()` are its only mutators. Adding slimes and later companions extends the same structure instead of creating a parallel one.
- Two new `CombatSystem` methods mirror the player API:
  ```ts
  setEnemyLoadout(enemyId: EntityId, loadout: Loadout, simTimeMs: number): void;
  removeShooter(entityId: EntityId): void;
  ```
  `setEnemyLoadout` repeats the `setPlayerLoadout` invariant exactly: validate `selectedIndex` in `[0, weapons.length)` or `null`, resolve `weaponArchetypeId` in `weaponRegistry` and throw on unknown id, call `createWeaponInstance` for each id, then write `shooterWeapons.set(enemyId, { ownerKind: 'enemy', weapons, selectedIndex })`. The player ban on empty `weapons: []` applies here too. If effective loadout is `null`, meaning no weapon, `setEnemyLoadout` is simply **not called** (see "Wiring" below).
  `removeShooter(entityId)` is `shooterWeapons.delete(entityId)`, the single per-entity cleanup mutator for slime shooter state.
- Each `WeaponInstance[i]` in `setEnemyLoadout` is initialized through the same `createWeaponInstance(archetypeId, ownerKind, simTimeMs)` helper as the player: `cooldownStartedAtSimMs = simTimeMs`, `nextFireSimMs = simTimeMs + initialFireDelayMs(archetype.cooldownMs, ownerKind)`, and `modifiers`, `overdriveStartedAtSimMs`, `overdriveUntilSimMs`, `overdriveCooldownMultiplier` start empty/null. This gives deterministic first-shot delay (see below) without duplicating initialization rules.
- Slimes **do not receive** weapon modifier drops. `addWeaponModifierToSelectedWeapon` and `applyTemporaryOverdriveToSelectedWeapon` ([drops.md](drops.md), [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)) apply only to player-owned `WeaponInstance`s. There is no canonical "apply modifier by ownerId" path for slimes, and 020 does not introduce one. Buffed slimes, if needed later, are a separate decision.

### Wiring: SpawnSystem -> CombatSystem and death hook

- `createSpawnSystem` receives an optional factory option:
  ```ts
  type SpawnSystemOptions = {
    onEnemySpawned?: (enemyId: EntityId, loadout: Loadout, simTimeMs: number) => void;
  };
  ```
  Whenever an `enemy` entity is created, in `executeStatic`, `spawnNextWaveEnemy`, or any future path, `SpawnSystem` calls the callback with `(enemyId, loadout, simTimeMs)` if effective `loadout` is **not `null`**. Resolution is `override.loadout ?? null` per [spawn-overrides.md](spawn-overrides.md). If effective loadout is `null`, the callback is not called and the slime has no `shooterWeapons` entry; this is how a spawn says "this slime has no weapon and does not shoot".
- For static spawns, `simTimeMs` comes from a new argument to `SpawnSystem.onEncounterStart(encounter, store, arena, simTimeMs)`. The call sites already sit in `SessionFlowSystem.onEncounterStart`, where `simTimeMs` is available. For wave spawns, `simTimeMs` comes from the normal `onTick(simTimeMs, entities)`. Extending the `onEncounterStart` signature is a small boundary change, not a new rule.
- In the worker (`src/sim/worker.ts`):
  - `SpawnSystem` is created with a callback wrapped around `combat`:
    ```ts
    const spawn = createSpawnSystem({
      onEnemySpawned(enemyId, loadout, simTimeMs) {
        combat.setEnemyLoadout(enemyId, loadout, simTimeMs);
      }
    });
    ```
  - the existing death hook gets one additional line:
    ```ts
    healthDeath.registerHook((ctx) => {
      // ...existing hooks...
      if (ctx.entityKind === 'enemy') combat.removeShooter(ctx.entityId);
    });
    ```
    Hook order is not important for correctness because hooks are synchronous and do not mutate HP, but by convention this line sits next to `drops.onDeathHook(...)` as another enemy-death consequence.
- On `sessionStart`/`sessionStop`, and on win/loss, `combat.clear()` continues to do the same work it does today: it clears **all** `shooterWeapons`, including slime entries. No extra lifecycle hooks are needed.

### Cooldown initialization and first-shot delay

- `nextFireSimMs = simTimeMsAtSpawn + cooldownMs` for each slime `WeaponInstance`. The value is initialized exactly in `createWeaponInstance(archetypeId, simTimeMsAtSpawn)` inside `setEnemyLoadout`, using the same helper as `setPlayerLoadout`. A slime charges for one full cooldown before its first shot.
- This gives the player a deterministic reaction window: `cooldownMs` milliseconds between "slime appeared" and "slime fired". It also avoids new configuration fields. `cooldownMs` already belongs to `WeaponArchetype` ([content-archetypes.md](content-archetypes.md)).
- There is no random jitter in starting cooldown. A deterministic regression test must see the same first `fire` event `simTime` for the same `seed` and same spawn time.
- If "slime fires immediately" or "turret has a longer warmup" is needed later, it should be introduced as `WeaponArchetype.firstShotDelayMs` or `loadout.firstShotDelayOverrideMs`. Both are intentionally absent at this horizon.

### Aim picking

- Slime aim is naive and non-AI:
  ```ts
  const dx = player.position.x - enemy.position.x;
  const dy = player.position.y - enemy.position.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return /* skip this tick's shot */;
  const length = Math.sqrt(lengthSq);
  aim = { x: dx / length, y: dy / length };
  ```
- `player === null`, meaning the player is dead and removed, makes the firing-decisions phase for all slimes a no-op. This is the shared "systems tolerate `player === null`" contract from [health-and-death.md](health-and-death.md). It applies equally to all slimes: no shot targets the player's last known position.
- Zero-length aim, where a slime stands center-to-center on the player, skips the shot for that tick. This is already the shared rule for `single`/`multiDirection` in [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md): a valid aim direction is required, and zero-length aim fires no shot.
- For the `place` fire pattern (`bomb-placer`), aim is not needed: the bomb is placed at the owner's position. A slime bomber with `bomb-placer` places bombs around itself independently of the player's position. This intentionally makes a minefield from stationary bomb-placer slimes readable.
- For `multiDirection` (`fireball-staff`), aim is used as the four-fireball reference direction. A slime obelisk with `fireball-staff` fires one fireball at the player plus three at cross offsets. This is already described in [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md); this file only states that the slime uses **the same** mechanism as the player.

### Tick phase

- Slime firing runs in **the same phase 1**, "firing decisions", inside `CombatSystem` ([projectiles-and-combat.md](projectiles-and-combat.md), "Tick order inside CombatSystem") as player firing.
- The current private `CombatSystem.ts` function `runFiringDecisions(input, store, simTimeMs, shooterWeapons, weaponRegistry, emit)` is split into two:
  - `runPlayerFiringDecisions(input, store, simTimeMs, shooterWeapons, weaponRegistry, emit)`, a rename of the current body with unchanged behavior. It already reads `input.firing`/`input.aimWorld` and looks up `shooterWeapons.get(player.id)`;
  - `runEnemyFiringDecisions(store, simTimeMs, shooterWeapons, weaponRegistry, emit)`, new. It does not read `input`; in real runtime integration, slimes know nothing about `RuntimeInputState`.
- Deterministic call order inside phase 1, important for replay and event-ordering tests:
  1. `runPlayerFiringDecisions(...)`;
  2. `runEnemyFiringDecisions(...)`;
  3. boss firing is already a separate phase through `BossPhaseSystem` and does not insert itself here. Boss stays on its own contract ([boss-encounter.md](boss-encounter.md)).
- Iteration order inside `runEnemyFiringDecisions`:
  - walk `store.enemies()` in ascending `EntityId` order, which is the stable deterministic order provided by `EntityStore`; for each living entity, call `shooterWeapons.get(enemy.id)` and process entries with `ownerKind === 'enemy'`;
  - iterating `shooterWeapons.entries()` and filtering by `ownerKind` is acceptable only if keys preserve deterministic insertion order. At the 020 horizon, the first path is simpler and matches broadphase/snapshot contracts that also go through `store.enemies()`.
- Per-enemy logic in `runEnemyFiringDecisions`, symmetric to the player path:
  - skip if `shooterWeapons.get(enemy.id)` is `undefined`; this slime has no loadout;
  - skip if `selectedIndex === null`;
  - skip if the entity is marked dead on this tick (see "Death cleanup");
  - `weapon = weapons[selectedIndex]`; skip if `simTimeMs < weapon.nextFireSimMs`;
  - compute aim (see "Aim picking"); zero-length aim and `player === null` skip rules are covered there;
  - resolve `archetype = weaponRegistry[weapon.archetypeId]`; call the **same** `fireWeaponProjectiles(store, archetype, weapon.modifiers, enemy.id, 'enemy', enemy.position, aim, simTimeMs)` used by the player path;
  - set `weapon.nextFireSimMs = simTimeMs + effectiveCooldownMs(archetype.cooldownMs, weapon, simTimeMs)`, using the same `effectiveCooldownMs` helper as player. `overdriveCooldownMultiplier` is always `null` for slimes, but the helper is shared;
  - publish a `fire` event with `shooterId: enemy.id`, `ownerKind: 'enemy'`, `originX/Y: enemy.position.x/y`, and `dirX/Y: result.eventDirection`, using the event shape already defined by [snapshot-shape.md](snapshot-shape.md).

### Death cleanup

- Primary invariant: **a dead slime does not fire, including on the tick when it dies.**
- Two defenses support the invariant:
  1. **Per-entity `removeShooter` from death hook.** The worker registers `if (ctx.entityKind === 'enemy') combat.removeShooter(ctx.entityId);` in the death hook (see "Wiring"). This clears the `shooterWeapons` entry synchronously in death-hook phase 4 ([health-and-death.md](health-and-death.md)). On any later tick, `runEnemyFiringDecisions` cannot find the id and naturally skips it.
  2. **Same-tick guard in `runEnemyFiringDecisions`.** Phase 1, "firing decisions", happens earlier in the same tick than phase 5, "impact detection", and the `HealthDeathSystem` phase that runs death hooks. Therefore, on the tick where a slime dies, its `shooterWeapons` entry still exists during `runEnemyFiringDecisions`. At that point the entity is either still alive with `hp > 0`, because the death hook has not run, or it is absent from `store.enemies()`. Iterating through `store.enemies()` covers both cases. An explicit `enemy.hp > 0` check in the per-enemy loop is also allowed as future-proofing if order changes; it is a no-op for today's order.
- Already flying projectiles (`Projectile.ownerId === deadEnemy.id`) are **not recalled** when the owner dies. They continue on their trajectories, deal damage by the usual rules, and correctly participate in explosion resolution. `ownerKind === 'enemy'` filtering continues to work. `ownerId` exclusion remains correct after owner removal: `EntityStore.byId(ownerId)` returns `null`, the snapshot does not contain the dead entity, and overlap with the former owner is impossible.
- On `sessionStart`/`sessionStop`/win/loss, all cleanup goes through existing `combat.clear()`, which clears **all** `shooterWeapons`, including slime entries. No additional session-lifecycle hooks are needed.
- The slime `death` event (`kind: 'death'`, [snapshot-shape.md](snapshot-shape.md)) is published **before** `runDeathHooks`; no new fields are added for shooting slimes. If consumers later need to know that the dead entity was a shooter, they can resolve `archetypeId` to content/loadout information. The death event contract does not expand for this.

### Friendly-fire filter and shared damage-rule helper

- `slimeFriendlyFire: false` filters enemy-to-enemy damage. This is already defined in [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md) and [projectiles-and-combat.md](projectiles-and-combat.md), "Damage rules", as a centralized helper used by impact, explosion, proximity-trigger checks, and future field effects.
- Story 020 does not introduce a new damage rule. It reinforces the existing **helper invariant**: both the **impact** phase and the **explosion** phase in `CombatSystem` must use the **same** `canDamageTarget(projectile, target, sessionRules)` helper. Duplicated ad hoc checks in the second phase are forbidden. Regression test: with `slimeFriendlyFire: false`, another slime inside the blast radius of a neighbor's grenade takes no HP damage and emits no `hit`/`death` events.
- This reminder is explicit because story 020 is the first time production campaign content materially exercises the explosion phase with slime projectiles. Any ad hoc branch such as "check slime grenades differently" violates this invariant.

### Audio

- Slime shot sounds use the same `WEAPON_AUDIO_MAPPINGS` ([audio.md](audio.md)) as player shots. The `weaponArchetypeId -> sampleId` mapping is shared across all `ownerKind` values. There is no second sample id for an enemy version of the pistol; the same `weapons/pistol.mp3` is heard from both player and slime.
- If hostile shots later need an acoustic distinction, such as pitch shifting or an alternate pool, that will extend [audio.md](audio.md), not this file.
- The story 020 acceptance scenario "slime shot sounds read as hostile" is covered by the visual pair: visible projectile plus landing telegraph for arcs plus impact direction from a non-player source. It is not covered by a separate sound.

### Intentionally not described here

- Any AI targeting: line of sight, leading, kiting.
- Slime weapon switching during combat or by HP phase.
- Runtime buffs/debuffs for slime `WeaponInstance`.
- Boss firing, which lives in `BossPhaseSystem` / [boss-encounter.md](boss-encounter.md).
- Main-thread pre-shot preview or muzzle-flash UX for slime shots; if needed, that extends [impact-feedback.md](impact-feedback.md), not this file.
- Per-archetype default loadout; see the explicit ban in [spawn-overrides.md](spawn-overrides.md).

## Consequences

- `CombatSystem` remains the single owner of firing decisions for all `ownerKind` values. The extension consists of two private functions (`runPlayerFiringDecisions` as a rename and `runEnemyFiringDecisions` as new) and two public APIs (`setEnemyLoadout`, `removeShooter`) on the same `ShooterWeapons` registry as player loadout. There are no new system boundaries, side tables, or parallel structures.
- Runtime `enemy` entities receive **no** new fields. This removes a design asymmetry with the player, whose loadout is also not stored on the entity.
- Determinism relative to `seed` is preserved: aim is a pure function of current positions, cooldown uses integer milliseconds, the phase-1 order `runPlayerFiringDecisions -> runEnemyFiringDecisions` is fixed, and slime iteration follows `store.enemies()` by `EntityId`.
- The friendly-fire filter in explosion resolution becomes critical for the hard-campaign UX in story 020 (minefield set 4): without it, bomber slimes clear the set themselves. Pinning the invariant "one helper for impact and explosion" (`canDamageTarget` from `src/sim/DamageRules.ts`) protects against regression. In the 017 implementation this helper is already shared, so story 020 needs a regression test rather than a refactor for this piece.
- "Slime with temporary overdrive" or "slime with modifiers" is not needed at this horizon and is not introduced: `addModifierToSelectedWeapon` and `applyTemporaryOverdriveToSelectedWeapon` are player-only and must not be called for slimes. If needed, that is a new decision.
- Testability: a unit test `CombatSystem.enemyFire` can call `combat.setEnemyLoadout(enemyId, loadout, simTime)` directly and tick the system. Assertions: at `simTime + cooldownMs`, a `fire` event appears with `ownerKind: 'enemy'`; after another cooldown, another event appears; after `removeShooter(enemyId)`, none appear. No worker fixtures and no `EntityStore` shape changes are needed.
- Full cost of "slimes can shoot": one optional field in `SpawnOverride` ([spawn-overrides.md](spawn-overrides.md)), two public APIs on `CombatSystem`, one new private function plus one rename, one callback in `createSpawnSystem` options, one line in the worker death hook, and one new `simTimeMs` argument to `SpawnSystem.onEncounterStart`. No new snapshot kind, runtime event, system, or runtime `enemy` field.

## Related

- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [spawn-overrides.md](spawn-overrides.md)
- [content-archetypes.md](content-archetypes.md)
- [health-and-death.md](health-and-death.md)
- [snapshot-shape.md](snapshot-shape.md)
- [boss-encounter.md](boss-encounter.md)
- [audio.md](audio.md)
- [rng.md](rng.md)
- [testing.md](testing.md)
- [landing-telegraph.md](landing-telegraph.md)
- [companion-combat.md](companion-combat.md)
- [../stories/020-shooting-slimes.md](../stories/020-shooting-slimes.md)
- [../stories/030-companion-combat-and-rescue.md](../stories/030-companion-combat-and-rescue.md)
