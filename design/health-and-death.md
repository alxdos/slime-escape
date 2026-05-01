# Health and Death

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-05-01 (story 037 review fix: corrected `'allPlayersDead'` `defeat.cause` semantics — earlier wording said "first player to fall" by analogy with `'playerDeath'`, but [session-result-summary.md](session-result-summary.md) records the canonical **last to fall** rule (the cause of the ghost transition that brought the live count to zero). The two files now agree. Also clarified ownership of the `firing`-flag cleanup: `HealthDeathSystem` does not directly mutate `RuntimeInputState`; the cleanup is performed by a registered death-hook consumer that owns `RuntimeInputState` (wired up by `SimulationCore`). The implementation already follows this layering. Earlier: 2026-05-01 story 037 prep: introduce the **player ghost state** path under `lossCondition: 'allPlayersDead'` ([session-definition.md](session-definition.md)). Player HP transitions from `> 0` to `0` no longer call `removeDead()` for the player; instead `HealthDeathSystem` flips `state: 'alive' → 'ghost'`, emits `playerDowned` ([snapshot-shape.md](snapshot-shape.md)) **and** `death` (so existing consumers — `RunSummaryTracker.defeat.cause`, audio, impact feedback — keep working without branching on lossCondition), runs death hooks once on the same `DeathContext`, and leaves the entity in `EntityStore` as a ghost. The actor's `RuntimeInputState` slot stays open with input filtered to `move` only ([input-commands.md](input-commands.md)). Ghost actors are invulnerable to further damage at the shared damage-helper ([projectiles-and-combat.md](projectiles-and-combat.md)), reusing the same primitive shape as `addPlayer.invulnerableUntilSimMs`. Ghost→removed is owned by the host (via `core.removePlayer` on disconnect/kick or `core.stop()`); the engine does **not** re-emit `death` for that edge. Revive (ghost → alive) is owned by the shared rescue handler in [runtime-systems.md](runtime-systems.md), not by `HealthDeathSystem`. The existing companion downed/rescue path is unchanged. Earlier: 2026-04-30 story 035 prep: extended the "Player and player death" section to cover multi-actor sessions. `entityKind === 'player'` covers every player in `SessionDefinition.players[]`; the death list and removal path apply per entity, the `'playerDeath'` lossCondition publishes `loss` exactly once on the first player death, and `MovementSystem`/`CombatSystem`/`SnapshotExportSystem` already tolerate "no living player" — extended to "any subset of players removed". Earlier: 2026-04-30 story 032 prep: added Related link for the public multiplayer arena. Earlier: 2026-04-29 story 030 prep: companion entities are damageable but use a downed ghost transition instead of the removable death path; projectile/explosion sources support `ownerKind: 'companion'`. Earlier: 2026-04-26 story 024: `RunSummaryTracker` becomes the explicit session-level stats/progression death hook consumer; see [session-result-summary.md](session-result-summary.md). Earlier: 2026-04-24 017 alignment: projectile and explosion damage both flow through `DamageIntent`; 018 alignment: field/status damage sources are added for future `FieldEffectSystem`/`StatusEffectSystem`. Earlier: 016 impact direction, 006 boss, 005 drops.)

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
- In 003, only `enemy` has `HasHealth`. Story 004 gives `HasHealth` to the player as well: every `Player` entity in `EntityStore` gets `hp`/`maxHp` fields initialized from its `PlayerConfig.maxHp` ([content-archetypes.md](content-archetypes.md), [session-definition.md](session-definition.md)) at session start; with story 035 there can be more than one `Player` per session, one per entry in `SessionDefinition.players[]`. Story 030 gives `HasHealth` to `companion` when `SessionDefinition.companion` is present; companion HP is initialized from `SessionDefinition.companion.maxHp` ([companion-combat.md](companion-combat.md)).
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

### Player ghost state (active from 037)

- Under `lossCondition: 'allPlayersDead'` ([session-definition.md](session-definition.md)), `HealthDeathSystem` does **not** route a player whose HP reaches zero through the normal removal path. Instead it performs a ghost transition that mirrors the companion downed path while remaining death-event-compatible:
  - clamps `hp` to `0`;
  - changes the player entity's `state` from `'alive'` to `'ghost'` ([snapshot-shape.md](snapshot-shape.md));
  - emits `playerDowned` ([snapshot-shape.md](snapshot-shape.md)) with the same impact metadata fields as `death`;
  - emits `death` exactly as it would for any other player death so that `RunSummaryTracker.defeat.cause`, audio, impact-feedback renderer, and any other death-listening consumer continue to work without branching on session lossCondition;
  - runs the standard death hooks once with the consistent `DeathContext` (`entityKind === 'player'`); under `'allPlayersDead'` `RunSummaryTracker` keeps a candidate `defeat.cause` keyed to the **last** player to fall (per [session-result-summary.md](session-result-summary.md)) — every ghost transition overwrites the candidate while at least one actor is still alive, and the candidate is committed as `defeat.cause` only when `SessionFlowSystem` fires `loss` after the live count reaches zero;
  - **does not** call `removeDead()` on the player entity; the entity remains in `EntityStore` and continues to appear in snapshots with `state: 'ghost'`;
  - **does not** despawn in-flight projectiles owned by this actor — they keep flying and may still land hits after the actor falls, matching the campaign expectation for fire-and-forget weapons.
- Per-actor `RuntimeInputState` mutation around the ghost transition is **not** owned by `HealthDeathSystem` (which has no direct access to the per-player input map). The actor's `firing` flag is cleared by a registered death-hook consumer that owns `RuntimeInputState` (`SimulationCore` wires this hook up alongside the existing death-hook fan-out described in [runtime-systems.md](runtime-systems.md)). The contract for [input-commands.md](input-commands.md) is unchanged: the per-actor input slot stays open across the ghost interval, only the input-kind filter (move-only on ghost) narrows new intents.
- After the ghost transition, every subsequent `DamageIntent` whose `targetId` is a player entity with `state in {'ghost', 'reviving'}` is dropped at the shared damage-helper ([projectiles-and-combat.md](projectiles-and-combat.md)) before HP application. This reuses the existing invulnerability-filter primitive shape established by `addPlayer.invulnerableUntilSimMs` ([sim-core-interface.md](sim-core-interface.md)) — ghost-state is a runtime field consulted at intake, not a status effect.
- Companions owned by a ghosted player (per per-actor `companion` ownership in [companion-combat.md](companion-combat.md)) continue to operate per their existing rules: they keep orbit/threat/engage and may themselves enter `companion: 'ghost'`. Ghost-state on the owner does not retarget the companion to a different actor.
- Removal of a ghost player from `EntityStore` happens only when the host calls `core.removePlayer(playerId)` (clean disconnect, unclean disconnect, kick) or when `core.stop()` clears the session. The engine does **not** emit a second `death` event on this edge; the actor disappears silently from the next snapshot. Consumers that need to know "this actor finally left the arena" derive it from snapshot diff (entity disappears) rather than from a separate event.
- Revive (transitioning a ghost player back to `'alive'`) is owned by the shared rescue handler ([runtime-systems.md](runtime-systems.md)), not by `HealthDeathSystem`. The handler reads `SessionDefinition.playerCoopRevive` ([session-definition.md](session-definition.md)) and, on success, writes new HP through the same path as a heal source (HP within `[0, maxHp]`) without producing a `death` event. `HealthDeathSystem` only owns the alive→ghost edge.
- This ghost path is gated by `lossCondition: 'allPlayersDead'`. For every other player-related lossCondition (`'playerDeath'`, `'respawnOnDeath'`, `'none'`) `HealthDeathSystem` keeps the existing remove-on-death behavior bit-for-bit.

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

- Every `Player` entity gets `HasHealth` (see above) and goes through the same path as an enemy: `DamageIntent` -> `applyDamage` -> possible death on this tick -> death events -> death hooks -> removal. With story 035, "the player" generalises to "any of the entities spawned from `SessionDefinition.players[]`"; each such entity has its own HP, its own damage flow, and its own removal.
- `lossCondition: { kind: 'playerDeath' }` ([session-definition.md](session-definition.md)) is implemented through a **session-level death hook**: `SessionFlowSystem` ([runtime-systems.md](runtime-systems.md)) registers the hook at simulation/session start, reacts to `entityKind === 'player'`, and initiates run completion (publish `loss` event and reset runtime state). The hook fires exactly once per run on the **first** player death (any of `players[]`); subsequent player deaths within the same tick or in following ticks are observed by other death-hook consumers (e.g. `RunSummaryTracker` for kill counts and `RetaliationSystem` for damage-hook follow-ups, when applicable) but do not republish `loss`. For sessions with `players.length === 1` this matches the previous single-player rule bit-for-bit. This is the only sanctioned loss-by-death path; no system may "preempt" this hook by publishing its own `loss`.
- `lossCondition: { kind: 'allPlayersDead' }` (story 037) reuses the same `DeathContext`/death-hook shape: `HealthDeathSystem` runs hooks once per ghost transition (see "Player ghost state" above) and `SessionFlowSystem` checks "is any actor still alive" after the transition; `loss` fires only when zero live actors remain (ghosts do not count as live). Players are not removed on the death tick under this kind; the entity persists as a ghost and may be revived. The session-level `'allPlayersDead'` hook does not preempt the standard death events or hooks — it observes the same per-death `DeathContext` and only changes the run-end decision.
- `lossCondition: { kind: 'respawnOnDeath' }` (story 036) is the only player-related kind that does not use `SessionFlowSystem` for run completion: death hooks still run once on each player death (so `RunSummaryTracker` continues to count kills if relevant), the entity is removed by `removeDead()`, but no `loss` is published; respawn is host policy via `core.addPlayer`. See `lossCondition` semantics in [session-definition.md](session-definition.md).
- Player removal from `EntityStore` follows the shared `removeDead()` rule: after `death` event publication and hooks. This means the session-level hook sees the player's position at death time. With multi-actor sessions, removal is per `EntityId`: only the dying player entity is removed; other live players continue to tick normally. After removal, `EntityStore` no longer returns that entity from `playerById(id)` and the entity is absent from the next snapshot. Callers that need "the only player" (e.g. main-side snapshot finders for local single-player UI) keep working because local play has `players: [<one>]`; in test code that drives multi-actor sessions, callers iterate `players()` or look up by `EntityId`.
- After publishing `loss`, `SimulationClock` moves to idle and no further ticks run. `SnapshotExportSystem` is not called for the next scheduled snapshot; the last valid snapshot is the one exported on the death tick (with the dying player already removed; surviving players in `'allPlayersDead'` / `'respawnOnDeath'` runs — once those are implemented — would still be present, but the `'playerDeath'` rule terminates the run before that matters in story 035). HUD reacts to the `loss` event, not to "player missing in snapshot".
- `MovementSystem` and `CombatSystem` must tolerate the absence of any specific player and the absence of all players: the contact intents phase, firing decisions phase, AI-targeting fallback ([runtime-systems.md](runtime-systems.md)), and companion follow ([companion-combat.md](companion-combat.md)) become no-ops when no living player exists. This is not a special 004 rule and not a special 035 rule, but the general contract that systems do not assume any player is always alive.

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
- [input-commands.md](input-commands.md)
- [../stories/030-companion-combat-and-rescue.md](../stories/030-companion-combat-and-rescue.md)
- [../stories/035-multi-actor-sessions.md](../stories/035-multi-actor-sessions.md)
- [../stories/037-coop-vs-slimes.md](../stories/037-coop-vs-slimes.md)
- [online-session-hosting.md](online-session-hosting.md)
- [online-lobby.md](online-lobby.md)
