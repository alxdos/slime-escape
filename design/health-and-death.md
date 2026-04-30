# Health and Death

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-30 (story 032 prep: added Related link for the public multiplayer arena. Earlier: 2026-04-29 story 030 prep: companion entities are damageable but use a downed ghost transition instead of the removable death path; projectile/explosion sources support `ownerKind: 'companion'`. Earlier: 2026-04-26 story 024: `RunSummaryTracker` becomes the explicit session-level stats/progression death hook consumer; see [session-result-summary.md](session-result-summary.md). Earlier: 2026-04-24 017 alignment: projectile and explosion damage both flow through `DamageIntent`; 018 alignment: field/status damage sources are added for future `FieldEffectSystem`/`StatusEffectSystem`. Earlier: 016 impact direction, 006 boss, 005 drops.)

## Context

[runtime-systems.md](runtime-systems.md) states that `HealthDeathSystem` is the only layer that applies final HP loss and records death, and that death hooks fire "after death, before snapshot export." It does not describe:

- where HP lives and how it relates to `EntityStore` entities;
- exactly how damage enters one tick and who submits it;
- exactly what death-hook consumers receive (`DropSystem` in 005, stats, runtime events);
- when and by whom a dead entity is removed from `EntityStore`.

Without this contract, story 003 will implicitly introduce "HP directly in `EntityStore`" or "damage applied inside `CombatSystem`", and 005/006 will later reopen death hooks.

## Decision

### HP as entity data

- HP is stored **on the runtime entity itself** in `EntityStore`, not in a separate HP registry. This keeps state local and makes entity removal atomic.
- Minimal HP fields on a damageable entity:
  ```ts
  type HasHealth = {
    hp: number;       // integer >= 0
    maxHp: number;    // integer > 0, copied from archetype
  };
  ```
- In 003, only `enemy` has `HasHealth`. Story 004 gives `HasHealth` to the player as well: `Player` in `EntityStore` gets `hp`/`maxHp` fields initialized from `SessionDefinition.player.maxHp` ([content-archetypes.md](content-archetypes.md), [session-definition.md](session-definition.md)) at session start. Story 030 gives `HasHealth` to `companion` when `SessionDefinition.companion` is present; companion HP is initialized from `SessionDefinition.companion.maxHp` ([companion-combat.md](companion-combat.md)).
- Projectiles (`projectile`) have no HP, and `HealthDeathSystem` does not touch them.

### Damage intents

- `CombatSystem` ([projectiles-and-combat.md](projectiles-and-combat.md)) produces a per-tick list of damage intents:
  ```ts
  type DamageIntent = Readonly<{
    targetId: EntityId;
    amount: number;     // integer > 0
    source:
      | { kind: 'projectile'; projectileId: EntityId; ownerKind: 'player' | 'enemy' | 'boss' | 'companion'; weaponArchetypeId: string; impactDirX: number; impactDirY: number }
      | { kind: 'explosion'; projectileId: EntityId; ownerKind: 'player' | 'enemy' | 'boss' | 'companion'; weaponArchetypeId: string }
      | { kind: 'enemyContact'; enemyId: EntityId }                  // active from 004; contract — enemy-contact.md
      | { kind: 'fieldEffect'; fieldEffectId: EntityId; archetypeId: string }
      | { kind: 'statusEffect'; statusKind: string; sourceEntityId: EntityId | null }
      | { kind: 'environment'; tag: string }                         // reserved: zone/scripted damage
      | { kind: 'boss'; bossId: EntityId; attackId: string };        // active from 006, [boss-encounter.md](boss-encounter.md)
    hitPosition: { x: number; y: number };
  }>;
  ```
- Active source kinds after story 017 are projectile impact and explosion from `CombatSystem`, enemy contact from [enemy-contact.md](enemy-contact.md), and boss attack damage from [boss-encounter.md](boss-encounter.md). Story 018 activates `fieldEffect` and `statusEffect` sources through dedicated systems. New sources must extend this union explicitly.
- Per-tick damage intents are passed to `HealthDeathSystem` as an explicit list (through a concrete method signature), without a separate global event bus: one tick, one list.
- `CombatSystem` must not read or mutate HP. Only `HealthDeathSystem` performs all subtraction.
- `HealthDeathSystem` owns **only HP decrement and death**. Heal (increasing `hp` within `[0, maxHp]`) is outside this contract: the only sanctioned heal source for the MVP horizon is `DropSystem` ([drops.md](drops.md)), which mutates `player.hp` directly during pickup, does not build `DamageIntent`, and does not call `HealthDeathSystem.applyDamage`. Heal cannot produce a `death` event, does not run death hooks, and does not enter the shared per-tick damage list. If a second heal source ever appears (regeneration, boss effect), a separate design decision introduces a shared heal channel, not a local bypass of this rule.

### Applying damage and recording death

- Within one tick, `HealthDeathSystem` processes intents in arrival order:
  1. for each intent: if the target is still alive, `target.hp = max(0, target.hp − amount)`;
  2. when `hp > 0 → hp == 0`, the entity is marked as "died on this tick";
  3. repeated intents to the same target later in the same tick after its death are **ignored**, preventing overkill and double death-hook execution.
- Entities marked as "died on this tick" form an ordered death event list for the current tick.
- `kind: 'companion'` is the only damageable entity that does not enter the normal death list. When companion HP transitions from `> 0` to `0`, `HealthDeathSystem` changes the companion to `state: 'ghost'`, publishes `companionDowned`, and leaves the entity in `EntityStore` for snapshots and rescue. The companion does not publish `death`, does not run death hooks, and is not removed by `removeDead()`.
- When publishing a `death` runtime event, `HealthDeathSystem` copies only presentation-safe impact metadata from the final `DamageIntent.source`: for projectile death, `weaponArchetypeId` and normalized `impactDirX/Y`; for explosion death, `weaponArchetypeId` without directional impact; for other sources, `null`. Full event shape is defined in [snapshot-shape.md](snapshot-shape.md), and consumer meaning in [impact-feedback.md](impact-feedback.md).

### Companion downed state

- Companion defeat is a downed transition, not a death-hook transition.
- `HealthDeathSystem` owns the HP-to-ghost edge because it is still the only system applying final HP loss.
- The downed transition:
  - clamps `hp` to `0`;
  - changes companion `state` to `ghost`;
  - clears active companion firing for the current ghost duration;
  - emits `companionDowned` with the companion id, `petArchetypeId`, position, and final impact metadata needed by presentation;
  - leaves the entity in snapshots as `CompanionSnapshot.state === 'ghost'`.
- `RunSummaryTracker`, `DropSystem`, `SessionFlowSystem`, XP rewards, and win/loss logic ignore `companionDowned`.
- Rescue and revived HP are owned by `CompanionSystem`, not by `HealthDeathSystem`; rescue is not a heal channel for arbitrary entities.

### Death hooks

- Death hooks are registered once at simulation start (or session start, in one place) and are not added during a tick. A registered hook stays alive between sessions; it resets its own internal state on `sessionStart`/`sessionStop`.
- Hook signature:
  ```ts
  type DeathContext = Readonly<{
    entityId: EntityId;
    entityKind: 'enemy' | 'player' | 'boss';
    archetypeId: string | null;          // for enemy/boss; null if there is no archetype
    position: { x: number; y: number }; // position at death time
    cause: DamageIntent['source'];       // source of the final blow
    simTime: number;                     // simulation ms
  }>;

  type DeathHook = (ctx: DeathContext) => void;
  ```
- Minimal death-hook consumers (fixed here as contract; implementation belongs to corresponding stories):
  - `DropSystem` ([drops.md](drops.md)) reacts to enemy deaths: filters by `entityKind === 'enemy'`, performs one `nextFloat` through session RNG when `dropTable` is non-empty, and spawns `Drop` through `EntityStore.spawnDrop` at `ctx.position` if a dropArchetype rolls. Full hook contract is in [drops.md](drops.md); `entityKind === 'boss'` death does not produce a drop unless content explicitly says so;
  - `SessionFlowSystem` — session-level hooks for `player` ([session-definition.md](session-definition.md)) and, when `winCondition: bossDefeated`, boss death ([boss-encounter.md](boss-encounter.md));
  - `RunSummaryTracker` ([session-result-summary.md](session-result-summary.md)) — session-level statistics and progression for results: kill counters, defeat cause, boss-defeated summary. Its hook must run before hooks that may complete the run through `SessionFlowSystem`;
  - runtime events for HUD/audio/debug — publishing the `death` event (see [snapshot-shape.md](snapshot-shape.md)).
- Hooks are called **synchronously**, in registration order, separately for each death. A hook must not:
  - deal new damage in the same tick (this would create death chains with unpredictable order and break reproducibility by `seed`);
  - mutate HP or `EntityStore` for **other** entities (creating new entities such as `Drop` is not considered mutating others; those are new ids);
  - read entities marked for removal on this tick as "alive".
- A hook **may** create new entities (for example, `DropSystem` spawns `Drop` in `EntityStore`), write to its own internal statistics, and publish runtime events (for example, `dropSpawn` from `DropSystem`; see [snapshot-shape.md](snapshot-shape.md)).

### Removal and order within a tick

- Marked entities are removed from `EntityStore` **after** all death hooks for the tick have run. This means:
  - while a hook runs, the entity is still available by `entityId`, and the hook can read its final position;
  - after removal, the entity `id` is no longer returned by `EntityStore` and does not enter snapshots.
- Final order within one tick:
  1. (external) `CombatSystem` produced damage intents;
  2. `HealthDeathSystem.applyDamage(intents)` — compute new HP, build death list;
  3. publish `death` runtime events for each death;
  4. `HealthDeathSystem.runDeathHooks(deaths)` — synchronous hooks in registration order;
  5. `HealthDeathSystem.removeDead()` — remove entities from `EntityStore`;
  6. later systems (`DropSystem`, `ZoneSystem`, etc.) run on a consistent `EntityStore`, then `SnapshotExportSystem`.
- `SnapshotExportSystem` ([snapshot-shape.md](snapshot-shape.md)) does not see an already removed entity, so the player does not see an extra frame of it.

### Player and player death (active from 004)

- Player gets `HasHealth` (see above) and goes through the same path as an enemy: `DamageIntent` -> `applyDamage` -> possible death on this tick -> death events -> death hooks -> removal.
- `lossCondition: { kind: 'playerDeath' }` ([session-definition.md](session-definition.md)) is implemented through a **session-level death hook**: `SessionFlowSystem` ([runtime-systems.md](runtime-systems.md)) registers the hook at simulation/session start, reacts to `entityKind === 'player'`, and initiates run completion (publish `loss` event and reset runtime state). This is the only sanctioned loss-by-death path; no system may "preempt" this hook by publishing its own `loss`.
- Player removal from `EntityStore` follows the shared `removeDead()` rule: after `death` event publication and hooks. This means the session-level hook sees the player's position at death time. After removal, `EntityStore.player()` returns `null`; `MovementSystem`/`CombatSystem`/`SnapshotExportSystem` must handle absence of player correctly (see below).
- After publishing `loss`, `SimulationClock` moves to idle and no further ticks run. `SnapshotExportSystem` is not called for the next scheduled snapshot; the last valid snapshot is the one exported on the death tick (with the player already removed). HUD reacts to the `loss` event, not to "player missing in snapshot".
- `MovementSystem` and `CombatSystem` must tolerate `player === null`: the contact intents phase and firing decisions phase become no-op. This is not a special 004 rule, but the general contract that systems do not assume player is always alive.

## Consequences

- HP and its mutation stay in one place; bugs like "-1 HP in `CombatSystem` and -1 HP in `BossPhaseSystem`" are structurally prevented.
- Death hooks define the exchange shape for 005/006 in advance; adding `DropSystem` does not require reopening tick order.
- The ban on "new damage inside hook" preserves determinism relative to `seed`: death chains within one tick are impossible.
- `EntityStore` remains the owner of entity lifecycle, but removal is initiated only by `HealthDeathSystem` for damageable entities; projectiles and drops are removed by their own systems ([projectiles-and-combat.md](projectiles-and-combat.md), [drops.md](drops.md)).
- When the player gets HP, no new architecture decision is needed; the same intents and hooks are reused.

## Related

- [runtime-systems.md](runtime-systems.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [enemy-contact.md](enemy-contact.md)
- [snapshot-shape.md](snapshot-shape.md)
- [content-archetypes.md](content-archetypes.md)
- [drops.md](drops.md)
- [session-definition.md](session-definition.md)
- [simulation-timing.md](simulation-timing.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
- [boss-encounter.md](boss-encounter.md)
- [impact-feedback.md](impact-feedback.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)
- [session-result-summary.md](session-result-summary.md)
- [companion-combat.md](companion-combat.md)
- [../stories/030-companion-combat-and-rescue.md](../stories/030-companion-combat-and-rescue.md)
- [public-multiplayer-arena.md](public-multiplayer-arena.md)
