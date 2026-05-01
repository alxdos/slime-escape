# Snapshot Shape

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-05-01 (story 038 prep: four additive fields for online client-side prediction ([online-client-prediction.md](online-client-prediction.md)). Top-level `Snapshot.lastInputSequence: { [playerId: string]: number }` records, per actor, the last `inputSequence` the **server** has applied for that actor before this snapshot was emitted ([input-commands.md](input-commands.md)). Produced by the Node arena host only ([online-session-hosting.md](online-session-hosting.md)); the browser worker host (local play) emits the field as an empty object so the snapshot type stays single-shape — local consumers ignore it. `ProjectileSnapshot.ownerId: number` carries the `EntityId` of the projectile's owner (mirrors existing `RuntimeEvent.hit.ownerId`/`explosion.ownerId` semantics) so client predictors can identify "my own projectiles" without ambiguity in multi-actor sessions; required, non-nullable. `ProjectileSnapshot.spawnInputSequence: number | null` carries the originating `inputSequence` of the `fire` intent that produced the projectile, when the owner is a connected player whose intent rode a sequenced envelope; `null` for slime/boss/fragment-cascade projectiles and for any projectile whose origin was not a sequenced fire intent. Echoed by `CombatSystem` from the runtime `Projectile.spawnInputSequence` field, which itself is populated from the `submitInput` call that produced the fire intent. `PlayerSnapshot.statusEffects: ReadonlyArray<PlayerStatusEffectSnapshot>` exposes the actor's currently active status effects (as a discriminated union shaped per the runtime `ActorStatusEffect` types, minus server-only damage timing) so the client predictor can apply movement-affecting status (e.g. `slow.speedMultiplier`) to local replay through the same shared `resolveMovementSpeedMultiplier` helper. Companions are intentionally excluded — `CompanionSnapshot.statusEffects` is **not** added; companion presentation does not need it on this horizon. Earlier: 2026-05-01 story 037 prep: `PlayerSnapshot` gains required field `state: 'alive' | 'ghost' | 'reviving'` so renderers and HUD can distinguish a downed-but-not-removed player from a live one and a player whose revive interaction is in progress; `'alive'` matches every existing single-player and PvP-respawn behavior bit-for-bit, `'ghost'` is the new co-op downed state defined in [health-and-death.md](health-and-death.md), `'reviving'` is the same ghost actor with an active revive interaction making progress (rendered with a fill-up affordance). New runtime events `playerDowned` and `playerRevived` are introduced for actor transitions into and out of the ghost state under `lossCondition: 'allPlayersDead'` ([session-definition.md](session-definition.md)), symmetric to `companionDowned`/`companionRescued`. The existing `death` runtime event is **still emitted** when an actor flips to ghost (the entity records "this damage instance ended this player's alive period"), so existing consumers (Result UI defeat cause, audio, impact feedback) keep working without branching on session lossCondition; `playerDowned` is the additional ghost-specific event for systems that need the new state semantics. `death` for a given actor entity fires at most once per session lifetime: when the host later calls `core.removePlayer` on a ghosted actor or `core.stop()` clears the session, the entity disappears silently from snapshots without a second `death` event. Earlier: 2026-05-01 story 036 T4 alignment: `RuntimeEvent.hit` and `RuntimeEvent.explosion` carry `ownerId` alongside `ownerKind` so the Node arena host can implement the accepted per-event delivery table in [online-session-hosting.md](online-session-hosting.md) without reconstructing projectile ownership from snapshots.)
- Updated: 2026-05-01 (story 036 prep: `PlayerSnapshot` gains `formArchetypeId: string | null` so a player entity can render as a slime/boss form (Public Arena PvP) without adding a new entity discriminator; `null` means canonical hero form. `WeaponHudSnapshot` migrates from a top-level `Snapshot.weaponHud` field into `PlayerSnapshot.weaponHud` so a fanned-out shared `Snapshot` carries per-player HUD without per-recipient construction; the field stays on the player kind only and is intentionally not added to `CompanionSnapshot`. `RuntimeEvent.death` gains `killerId: number | null` so PvP host policy can attribute kills without inspecting the snapshot stream. New `playerSpawn` runtime event is introduced for actor entry into the arena, emitted both for initial `players[]` at `start(session)` and for `core.addPlayer` mid-session ([sim-core-interface.md](sim-core-interface.md)). `levelUp` is intentionally **not** added to shared `RuntimeEvent`: it stays a host-emitted PvP event recorded separately in story 036's hosting decision. Earlier: 2026-04-30 story 035 prep: clarifying note on `PlayerSnapshot` — multiple `kind: 'player'` entries are valid for multi-actor sessions; no field changes, no new discriminator. Earlier: 2026-04-30 story 032 prep: added Related link for the public multiplayer arena. Earlier: 2026-04-29 story 030 follow-up: `dropPickup.pickerId` may now be the player or the companion; pickup eligibility remains defined in [drops.md](drops.md). Earlier story 030 prep: add `CompanionSnapshot`, `ownerKind: 'companion'`, `targetKind: 'companion'`, and companion boop/downed/rescued events; full behavior contract in [companion-combat.md](companion-combat.md). Earlier: 2026-04-28 story 028 prep: `EncounterSnapshot` adds `waveOrdinal: number | null` so Dungeon can show an increasing run-level wave number while looping authored encounter indices. Earlier: 2026-04-27 story 026 prep: `EncounterSnapshot.type` includes the new `portal` encounter type, but portals do not become entity snapshots or runtime events; main-thread portal descriptors are defined in [vibe-jam-portals.md](vibe-jam-portals.md). Earlier: projectile snapshots expose effective runtime `size` so render can show projectile-size modifiers without inferring weapon state on the main thread; existing `originX`/`originY` projectile fields are documented here as presentation data copied from runtime `Projectile.origin`). Earlier: 2026-04-26 story 024: terminal `win`/`loss` runtime events carry `SessionResultSummary`; authoritative result stats are defined in [session-result-summary.md](session-result-summary.md). Earlier story 022: `WeaponHudSnapshot` receives a cooldown interval (`cooldownStartedAtSimMs`/`cooldownReadyAtSimMs`), permanent `modifiers`, and active `timedEffects` for the weapon-slot HUD; the presentation contract lives in [hud-presentation.md](hud-presentation.md). Earlier: 2026-04-25 story 020: `ProjectileSnapshot` receives required field `arcEnd: { x: number; y: number } | null`, the fixed world landing position for an in-flight arc projectile; it is `null` for grounded projectiles and for linear/placed motion. Source of truth is `CombatSystem` at projectile creation; `SnapshotExportSystem` copies the value and does not recompute it. The render contract for landing telegraphs on non-player in-flight arcs is [landing-telegraph.md](landing-telegraph.md). Earlier: 2026-04-24 017 alignment: projectile snapshots and combat events support universal projectile state, owner `boss`, grounded/explosive presentation, selected weapon HUD, and explosion events; see [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). 018 alignment: `fieldEffect` and status presentation fields are reserved for [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md). Earlier: 016 impact feedback, 006 boss, 005 drops.)

## Context

[thread-model.md](thread-model.md) defines the split between periodic state (`snapshot`) and point-in-time facts (`runtime events`), and the rule that every entity in a snapshot carries a stable `kind` discriminator. Per-kind fields and each runtime event shape were intentionally left open there to evolve as systems appeared.

In 002 that was enough: only `kind: 'player'` and minimal lifecycle events existed. Story 003 introduces both:

- two new entity kinds in snapshots: `enemy` and `projectile`;
- three new runtime events: `fire`, `hit`, and `death`.

Without an explicit contract, those shapes would be defined locally in 003, then extended or renamed repeatedly by 004 (waves), 005 (drops), 006 (boss), 007 (HUD), and 008 (audio). This decision defines the base MVP shape.

## Decision

### General rules

- A snapshot carries only **changing** state. Immutable session configuration (`arena`, initial `player`, encounter list) is already available to `main` through `SessionDefinition` ([thread-model.md](thread-model.md)).
- Every entity in `snapshot.entities` must have a stable `id`, unchanged while the entity is alive, and a `kind` from the finite union below.
- Entity fields are **only what the current renderer/HUD generation needs**. Fields for future systems are added together with the story that needs them and are recorded here.
- Removed entities, after `HealthDeathSystem.removeDead()` or `CombatSystem` despawn, are absent from snapshots. There are no tombstones in `entities`.
- Runtime events are **edge facts**: every message is meaningful, does not have to repeat, and carries enough fields for a consumer such as HUD/audio/render effects to react without reading the same-tick snapshot.

### Per-kind entity fields for the 003-006 horizon

```ts
type EntitySnapshot =
  | PlayerSnapshot
  | EnemySnapshot
  | CompanionSnapshot
  | ProjectileSnapshot
  | DropSnapshot
  | BossSnapshot
  | FieldEffectSnapshot;
```

- `PlayerSnapshot`:
  ```ts
  {
    id: number;
    kind: 'player';
    playerId: string;            // PlayerConfig.id, stable across forms
    x: number;
    y: number;
    hp: number;                  // integer >= 0
    maxHp: number;               // integer > 0; repeated in each snapshot, like enemy
    state: 'alive' | 'ghost' | 'reviving';
    formArchetypeId: string | null;
    weaponHud: WeaponHudSnapshot | null;
    statusEffects: ReadonlyArray<PlayerStatusEffectSnapshot>;
  }
  ```
  ```ts
  type PlayerStatusEffectSnapshot =
    | Readonly<{ kind: 'slow';   speedMultiplier: number; expireAtSimMs: number }>
    | Readonly<{ kind: 'burn';   expireAtSimMs: number }>
    | Readonly<{ kind: 'poison'; expireAtSimMs: number }>;
  ```
  `hp`/`maxHp` are present **always**, regardless of whether the current session has `lossCondition: playerDeath`. This avoids two ways to say "no data" in HUD and simplifies rendering: in a non-combat sandbox session, `hp = maxHp` for the whole run.
  `playerId` is the cross-host actor identifier from `SessionDefinition.players[].id` ([session-definition.md](session-definition.md)). It is stable for the lifetime of the actor in the session, including across `setPlayerForm` form changes ([sim-core-interface.md](sim-core-interface.md)); `EntityId` (the `id` field) is the runtime handle and may change if the actor is removed and re-added. Online clients use `playerId` to locate "self" in `entities[]` against the value cached from the join handshake; local single-player UI continues to use `findPlayerSnapshot` (any `kind: 'player'`) because every local preset emits `players: [<one>]`. The field is required and must not be empty.
  `formArchetypeId` is the optional render-form override. `null` means the canonical hero form (used by every local preset today); a non-null string is an archetype id from `content/enemies.md` or `content/bosses.md` and tells the renderer to draw that form instead of the hero sprite. The field exists for online modes where a player wears a slime or boss form (Public Arena PvP, story 036). Stats (radius/contactBox/maxSpeed/maxHp/loadout) for the form are written into the player runtime state by `setPlayerForm` and reach this snapshot through the existing `radius`/`maxHp`/`weaponHud` fields; the renderer must not re-read enemy/boss content for those stats.
  `state` (story 037) is the actor's current liveness state, distinguishing alive, downed-but-still-present (`'ghost'`), and downed-with-active-revive (`'reviving'`). For sessions whose `lossCondition` is anything other than `'allPlayersDead'`, the value is always `'alive'` — the state machine simply never transitions, so existing single-player, PvP-respawn (level-1 fresh entity), and dungeon flows keep behaving identically. Under `'allPlayersDead'` ([session-definition.md](session-definition.md)), `'ghost'` indicates the actor is downed and waiting for a revive (HP is `0`, weapon HUD is `null`, the entity is invulnerable to further damage); `'reviving'` indicates a `playerCoopRevive` interaction is making progress on this actor (HP still `0`; renderer uses this for a fill-up affordance). Transition events are `playerDowned` (`'alive' → 'ghost'`) and `playerRevived` (`'ghost' | 'reviving' → 'alive'`); the in-and-out-of-`'reviving'` micro-transitions are not eventified because they are derivable from snapshot diffs and do not need atomic point-in-time reactions.
  `weaponHud` is the per-player weapon HUD. It moves into `PlayerSnapshot` from the previous top-level `Snapshot.weaponHud` field so a single shared `Snapshot` fanned out to many sockets carries each actor's HUD without per-recipient reconstruction. Local single-player consumers must read `players[0].weaponHud` (or whichever player they own); a regression test for the local HUD migration is required when this field moves. The field stays on the player kind only — it is intentionally **not** added to `CompanionSnapshot`. Companion HUD presentation, if it gains weapon-slot UI in the future, lives in a separate field tracked in [companion-combat.md](companion-combat.md).
  `statusEffects` (story 038) is the actor's currently active status effects exported as a discriminated union shaped per the runtime `ActorStatusEffect` types in `EntityStore` minus server-only damage timing fields (`damagePerTick`, `tickEveryMs`, `nextTickSimMs` are not exposed — those drive server-side damage application and have no consumer on the client). For `kind: 'slow'` the snapshot exposes `speedMultiplier` so the client predictor can apply the same `resolveMovementSpeedMultiplier` outcome through shared `StatusEffectSystem` ([combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)) on the local replay. `expireAtSimMs` is required on every entry; the renderer/HUD/predictor compare it against `snapshot.simTimeMs` to decide whether the effect is still active. Empty array means no active effects on the actor — required, no `null` form. The exporter reads from runtime `Player.statusEffects` and copies only effects that are still active at export time (`expireAtSimMs > snapshot.simTimeMs`), so the snapshot never carries already-expired entries. The field is on the player kind only; companions are intentionally excluded for this horizon.
  Multi-actor sessions ([session-definition.md](session-definition.md)) may produce multiple `kind: 'player'` entries in `snapshot.entities` — one per living player. Story 036 makes this routine for online play; local single-player remains a one-element list.
- `EnemySnapshot`:
  ```ts
  {
    id: number;
    kind: 'enemy';
    archetypeId: string;   // render/audio by enemy type
    x: number;
    y: number;
    hp: number;
    maxHp: number;          // repeated in each snapshot; small cost, simpler HUD
  }
  ```
- `ProjectileSnapshot`:
  ```ts
  {
    id: number;
    kind: 'projectile';
    weaponArchetypeId: string;
    ownerKind: 'player' | 'enemy' | 'boss' | 'companion';
    ownerId: number;
    originX: number;
    originY: number;
    x: number;
    y: number;
    size: { width: number; height: number };
    state: 'flying' | 'grounded';
    visualState: {
      angleRadians: number;
      spinRadians: number;
      pulsePhase: number;
    };
    explosionRadius: number | null;
    detonateAtSimMs: number | null;
    arcEnd: { x: number; y: number } | null;
    spawnInputSequence: number | null;
  }
  ```
- `ownerId` (story 038) is the `EntityId` of the projectile's owner — the player, enemy, boss, or companion that fired it. It mirrors the existing `RuntimeEvent.hit.ownerId` and `RuntimeEvent.explosion.ownerId` semantics ([online-session-hosting.md](online-session-hosting.md)) so the client-side predictor can identify "my own projectiles" by matching `(ownerKind === 'player', ownerId === selfEntityId)` against the local `PlayerSnapshot.id` for the predictor's player. Required and non-nullable: every projectile has an authoritative owner entity, including fragments cascaded from a parent projectile (in which case `ownerId` is the original shooter, identical to the parent's `ownerId`). Source of truth is `Projectile.ownerId` in runtime; `SnapshotExportSystem` copies it verbatim.
- `spawnInputSequence` (story 038) carries the `inputSequence` of the originating `fire` intent that produced this projectile, when the projectile owner is a connected player whose intent rode a sequenced envelope ([input-commands.md](input-commands.md)). `null` for slime/boss projectiles, fragment cascades whose origin is a parent projectile rather than a fire intent, and any projectile whose owner is not a connected player (local sim, AI fire). The runtime `Projectile.spawnInputSequence` field is populated by `CombatSystem.tickPlayerFiring` at projectile creation from the `submitInput` call's sequence number; `SnapshotExportSystem` copies it verbatim. Used by the client predictor to match its own predicted projectiles to authoritative ones during reconciliation; full reconciliation rules are in [online-client-prediction.md](online-client-prediction.md).
- `originX`/`originY` are the projectile spawn origin copied from runtime `Projectile.origin`. They are presentation data used by renderer rules such as hiding a newly spawned projectile while it overlaps the shooter; gameplay motion and hit tests still use runtime `Projectile.position` inside `CombatSystem`.
- `size` is the effective runtime visual size copied from runtime `Projectile.size`. It equals the base `WeaponArchetype.projectile.size` for unmodified shots and includes spawn-time `projectileSizeMultiplier` effects for modified shots. `SnapshotExportSystem` copies this value and does not recompute it from `weaponArchetypeId` or from `weaponHud.modifiers`. `size` is not `hitRadius`: projectile collision remains owned by `CombatSystem`, and `hitRadius` stays out of snapshots until a renderer/HUD/debug story needs it explicitly.
- `state`, `visualState`, `explosionRadius`, and `detonateAtSimMs` are required by story 017 presentation: sprite orientation/spin, grounded pulse, and radius indicators must not be inferred from hidden sim state. `detonateAtSimMs` is presentation timing; gameplay detonation remains owned by `CombatSystem`.
- `arcEnd` (story 020) is the fixed world landing position for an in-flight arc projectile. It is copied from runtime `Projectile` without recomputation on each snapshot; it is `null` for an arc projectile in `state: 'grounded'`, because landing already happened, and **always** `null` for linear/placed motion. The field is required, and `null` is the only way to say "not applicable"; there is no `undefined`/optional marker. The full render contract for landing telegraphs, including when to show them, marker size, and the player-owned arc exception, lives in [landing-telegraph.md](landing-telegraph.md). Snapshot itself does not carry "telegraph needed"; renderer derives that from `state + arcEnd + ownerKind`.
- `CompanionSnapshot` (030, [companion-combat.md](companion-combat.md)):
  ```ts
  {
    id: number;
    kind: 'companion';
    petArchetypeId: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    state: 'alive' | 'ghost';
    mode: 'rest' | 'guard' | 'alert' | 'engage' | 'rescue' | 'ghost';
    rescueProgress: number | null; // [0, 1] while rescue is active; null otherwise
    targetId: number | null;
  }
  ```
  Companion snapshots are exported only when `SessionDefinition.companion` is present. `petArchetypeId` is presentation identity; combat tuning stays in immutable session configuration and runtime state.
- `DropSnapshot` (story 005, see [drops.md](drops.md)):
  ```ts
  {
    id: number;
    kind: 'drop';
    archetypeId: string;     // DropArchetype.id; renderer chooses visual by archetype
    x: number;
    y: number;
  }
  ```
  `radius`, `effect`, `color`, `expireAtSimMs`, and remaining lifetime do not enter snapshots. Gameplay shape (overlap radius, effect) stays in `sim`; renderer gets visuals by `archetypeId` from the content library. If HUD later needs "N seconds until disappearance", that will add a field here rather than pulling `expireAtSimMs` locally.

- `BossSnapshot` (006, [boss-encounter.md](boss-encounter.md), [content-archetypes.md](content-archetypes.md)):
  ```ts
  {
    id: number;
    kind: 'boss';
    archetypeId: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    phaseIndex: number;
    phaseId: string;
    activeAttackIds: ReadonlyArray<string>;
  }
  ```
- `FieldEffectSnapshot` (018, [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)):
  ```ts
  {
    id: number;
    kind: 'fieldEffect';
    archetypeId: string;
    x: number;
    y: number;
    radius: number;
    expiresAtSimMs: number;
  }
  ```
  Field-effect snapshots expose presentation state only. Periodic damage/status application remains in `FieldEffectSystem`.

### Top-level snapshot

- Top-level shape:
  ```ts
  type Snapshot = Readonly<{
    simTimeMs: number;
    entities: ReadonlyArray<EntitySnapshot>;
    encounter: EncounterSnapshot | null;
    zone: ZoneSnapshot;
    waveProgress: WaveProgressSnapshot | null;
    bossHud: BossHudSnapshot | null;
    lastInputSequence: Readonly<Record<string, number>>;
  }>;
  ```
- `lastInputSequence` (story 038) records, per `playerId`, the last `inputSequence` the **server** has applied for that actor before this snapshot was emitted. Produced by the Node arena host ([online-session-hosting.md](online-session-hosting.md)); the browser worker host (local play) emits an empty object — local play has no predictor and the field is unused. The keys are `PlayerConfig.id` strings; values are non-decreasing per actor across consecutive snapshots. An actor with no input applied yet (just-joined, before its first input was processed) has no entry in the map. Used by the client-side predictor for input-buffer trim and reconciliation; the full contract is in [online-client-prediction.md](online-client-prediction.md). Required field on every snapshot; renderer/HUD/audio consumers ignore it.
- Run-level HUD aggregates that are session-global, such as wave progress and boss state, live as separate top-level fields rather than being folded into `entities`. Per-actor HUD aggregates (today: `weaponHud`) live on the actor's entity snapshot — see `PlayerSnapshot.weaponHud` above. Each top-level extension is recorded here.
- `bossHud`:
  ```ts
  type BossHudSnapshot = Readonly<{
    entityId: number;
    phaseIndex: number;
    phaseId: string;
    hp: number;
    maxHp: number;
    activeAttackIds: ReadonlyArray<string>;
  }>;
  ```
  For encounters where `encounter.type !== 'boss'`, or when there is no active boss, the field is **`null`**. Values duplicate key boss-entity fields so HUD can read cheaply without searching `entities`; `SnapshotExportSystem` guarantees consistency with the entity.
- `WeaponHudSnapshot` (017, extended by 022; relocation to `PlayerSnapshot.weaponHud` recorded in story 036):
  ```ts
  type WeaponTimedEffectHudSnapshot =
    | Readonly<{
        kind: 'temporaryOverdrive';
        cooldownMultiplier: number;
        startedAtSimMs: number;
        expiresAtSimMs: number;
      }>;

  type WeaponHudSnapshot = Readonly<{
    selectedIndex: number | null;
    weapons: ReadonlyArray<Readonly<{
      index: number;
      weaponArchetypeId: string;
      cooldownStartedAtSimMs: number;
      cooldownReadyAtSimMs: number;
      modifiers: ReadonlyArray<WeaponModifier>;
      timedEffects: ReadonlyArray<WeaponTimedEffectHudSnapshot>;
    }>>;
  }>;
  ```
  Lives on `PlayerSnapshot.weaponHud`. `null` means the actor has no loadout (sandbox without combat, or any other actor whose `PlayerConfig.loadout === null`). HUD reads selected weapon, cooldown interval, permanent modifiers, and active timed weapon effects from this field instead of inspecting runtime weapon instances directly. `cooldownStartedAtSimMs`/`cooldownReadyAtSimMs` define the current or most recent cooldown interval; HUD derives fill from those timestamps and `snapshot.simTimeMs`. `modifiers` contains permanent `WeaponModifier` values copied from the actor's selected weapon instance. `timedEffects` contains only active timed effects at snapshot time (`expiresAtSimMs > snapshot.simTimeMs`); on this horizon the only timed effect is `temporaryOverdrive`. Full render semantics are in [hud-presentation.md](hud-presentation.md). Companions are intentionally excluded — `CompanionSnapshot` does not gain `weaponHud` even when a companion has its own loadout.
- 004 fields:
  - `encounter`:
    ```ts
    type EncounterSnapshot = Readonly<{
      id: string;                                      // EncounterDefinition.id
      type: 'wave' | 'break' | 'boss' | 'survivalTimer' | 'sandbox' | 'portal';
      index: number;                                   // position in SessionDefinition.encounters
      elapsedMs: number;                               // since encounterStart, integer
      waveOrdinal: number | null;                      // run-level wave number; null outside wave encounters
    }>;
    ```
    `null` means there is no active encounter: between `sessionStart` and first encounter activation, which is theoretically zero-length but represented by the type, and after `sessionStop`/`win`/`loss`. Until the ideal invariant "snapshot always carries encounter when a session is active" is fully enforced, the field remains nullable as protection against activation-order mismatches.
    `waveOrdinal` is `null` for non-wave encounters. For finite sessions it equals the session-global wave number derived from `SessionDefinition.encounters`. For `winCondition: dungeon`, it is authoritative run state from `SessionFlowSystem` and keeps increasing across repeated passes through the same authored encounter.
  - `zone`:
    ```ts
    type ZoneSnapshot = Readonly<{
      mode: 'disabled' | 'shrink' | 'expand';
      margin: number; // wu, >= 0
    }>;
    ```
    Shape and semantics are in [zone.md](zone.md). The field is required and non-nullable: `disabled` is the valid value for no active zone.
  - `waveProgress`:
    ```ts
    type WaveProgressSnapshot = Readonly<{
      dispatched: number;   // spawns already released
      total: number;        // total planned
      alive: number;        // living entities spawned by the current wave
    }>;
    ```
    `null` for encounters where `spawnPlan.kind !== 'wave'`, including `'static'` from 003. For `'wave'`, the field is filled every tick and is available to HUD/tests.

### Runtime events: kind contract

- Combat, companion, and drop kinds extend the existing lifecycle kinds from [runtime-systems.md](runtime-systems.md) (`sessionStart`, `sessionStop`, `encounterStart`, `encounterEnd`, `pause`, `resume`). Story 004 adds `win` and `loss`; story 005 adds three drop kinds (`dropSpawn`, `dropPickup`, `dropExpire`):
  ```ts
  type RuntimeEvent =
    // lifecycle (see runtime-systems.md)
    | { kind: 'sessionStart'; simTime: number }
    | { kind: 'sessionStop'; simTime: number }
    | { kind: 'encounterStart'; simTime: number }
    | { kind: 'encounterEnd'; simTime: number }
    | { kind: 'pause'; simTime: number }
    | { kind: 'resume'; simTime: number }
    // combat (this file)
    | {
        kind: 'fire';
        simTime: number;
        shooterId: number;
        ownerKind: 'player' | 'enemy' | 'boss' | 'companion';
        weaponArchetypeId: string;
        originX: number;
        originY: number;
        dirX: number;
        dirY: number;       // normalized vector
      }
    | {
        kind: 'hit';
        simTime: number;
        projectileId: number;
        ownerId: number;
        ownerKind: 'player' | 'enemy' | 'boss' | 'companion';
        targetId: number;
        targetKind: 'enemy' | 'player' | 'boss' | 'companion';
        targetArchetypeId: string | null; // enemy/boss id or companion pet id; null for player
        weaponArchetypeId: string;
        damage: number;
        impactDirX: number;     // normalized projectile travel direction
        impactDirY: number;
        x: number;
        y: number;
      }
    | {
        kind: 'explosion';
        simTime: number;
        projectileId: number;
        ownerId: number;
        ownerKind: 'player' | 'enemy' | 'boss' | 'companion';
        weaponArchetypeId: string;
        damage: number;
        radius: number;
        x: number;
        y: number;
      }
    | {
        kind: 'death';
        simTime: number;
        entityId: number;
        entityKind: 'enemy' | 'player' | 'boss';
        archetypeId: string | null;
        weaponArchetypeId: string | null; // final projectile weapon, if any
        impactDirX: number | null;        // normalized final projectile direction, if any
        impactDirY: number | null;
        killerId: number | null;          // EntityId of the damage source's owner, if any
        x: number;
        y: number;
      }
    | {
        kind: 'bossPhaseChange';
        simTime: number;
        bossId: number;
        phaseIndex: number;
        phaseId: string;
      }
    // player roster (this file, stories 036 / 037)
    | {
        kind: 'playerSpawn';
        simTime: number;
        entityId: number;
        playerId: string;
        x: number;
        y: number;
        formArchetypeId: string | null;
      }
    | {
        kind: 'playerDowned';
        simTime: number;
        entityId: number;
        playerId: string;
        weaponArchetypeId: string | null;
        impactDirX: number | null;
        impactDirY: number | null;
        x: number;
        y: number;
      }
    | {
        kind: 'playerRevived';
        simTime: number;
        entityId: number;
        playerId: string;
        rescuerEntityId: number;
        rescuerPlayerId: string;
        hp: number;
        maxHp: number;
        x: number;
        y: number;
      }
    | {
        kind: 'companionBoop';
        simTime: number;
        companionId: number;
        targetId: number;
        targetKind: 'enemy' | 'boss';
        x: number;
        y: number;
        impulseDirX: number;
        impulseDirY: number;
      }
    | {
        kind: 'companionDowned';
        simTime: number;
        companionId: number;
        petArchetypeId: string;
        weaponArchetypeId: string | null;
        impactDirX: number | null;
        impactDirY: number | null;
        x: number;
        y: number;
      }
    | {
        kind: 'companionRescued';
        simTime: number;
        companionId: number;
        petArchetypeId: string;
        hp: number;
        maxHp: number;
        x: number;
        y: number;
      }
    // session lifecycle (this file, story 004; summary extension: session-result-summary.md)
    | { kind: 'win'; simTime: number; summary: SessionResultSummary }
    | { kind: 'loss'; simTime: number; summary: SessionResultSummary }
    // drops (this file, story 005; see drops.md)
    | {
        kind: 'dropSpawn';
        simTime: number;
        entityId: number;       // Drop.id
        archetypeId: string;    // DropArchetype.id
        x: number;
        y: number;
      }
    | {
        kind: 'dropPickup';
        simTime: number;
        entityId: number;       // Drop.id
        archetypeId: string;    // DropArchetype.id
        pickerId: number;       // Player.id or Companion.id, by drops.md pickup rules
        x: number;
        y: number;
      }
    | {
        kind: 'dropExpire';
        simTime: number;
        entityId: number;       // Drop.id
        archetypeId: string;    // DropArchetype.id
        x: number;
        y: number;
      };
  ```
- `win`/`loss` carry `simTime` and `summary`. The full `SessionResultSummary` shape, stats owner, and progress/kills/boss/defeat-cause rules are defined in [session-result-summary.md](session-result-summary.md). `summary.outcome` must match `event.kind`, and `summary.durationMs` must match `event.simTime`.
- `hit.targetArchetypeId` and `death.weaponArchetypeId`/`impactDir*` exist for main-thread presentation consumers ([impact-feedback.md](impact-feedback.md)): renderer must not reconstruct target color, bullet direction, or death cause from nearby snapshots, because the target may be removed before the next frame. For `targetKind: 'player'`, target archetype is absent and the field is `null`; for `targetKind: 'companion'`, the value is the companion `petArchetypeId`. For non-projectile deaths, weapon/direction fields are `null`.
- `death.killerId` (story 036) is the `EntityId` of the damage source's owner if attribution is well-defined, otherwise `null`. `null` for self-detonation (a player who triggers their own mine), suicide damage, environmental damage, and any other case without a distinct actor on the dealer side. For projectile damage the owner is `Projectile.ownerId` (regardless of `ownerKind`); for enemy contact the owner is the contacting enemy. Consumers (host PvP policy in story 036) must treat `killerId === entityId` and `killerId === null` identically — no level-up reward.
- `playerSpawn` (story 036) fires every time a player entity is created — once per `SessionDefinition.players[]` entry inside `start(session)` and once per `core.addPlayer` call ([sim-core-interface.md](sim-core-interface.md)) on the next tick boundary. After `stop()` followed by `start(session)` the events re-fire for the new initial roster: a session restart is observationally equivalent to a fresh session for any consumer subscribed to spawn cues. Local single-player gains the event for the canonical hero on every `startSession`; this is additive and does not change existing snapshot-driven HUD.
- `playerDowned` (story 037) fires when an `'alive'` player flips to `'ghost'` under `lossCondition: 'allPlayersDead'`. The event is emitted by `HealthDeathSystem` on the same tick the actor's HP would have reached zero under the standard removal path — not in a deferred phase. The existing `death` event also fires for the same instance (so `defeat.cause` and audio/feedback consumers keep working without branching on lossCondition), and `playerDowned` is the additional event ghost-aware consumers (online HUD, online result UI, rescue presentation) subscribe to. `weaponArchetypeId`/`impactDir*` mirror the same fields on `death` and `companionDowned` so the death-direction visual works identically on player ghost transitions.
- `playerRevived` (story 037) fires when a player transitions from `'ghost'` or `'reviving'` back to `'alive'` through the `playerCoopRevive` interaction in [session-definition.md](session-definition.md). `rescuerEntityId`/`rescuerPlayerId` carry the actor whose proximity completed the rescue (one of the actors in the rescuer pair if multiple were contributing). `hp` and `maxHp` reflect the post-revive runtime state (`hp = max(1, floor(maxHp * playerCoopRevive.reviveHpFraction))`). The event fires inside the shared rescue handler ([runtime-systems.md](runtime-systems.md)) immediately after the runtime state transition and before the next snapshot export.
- Owner systems (see [runtime-systems.md](runtime-systems.md)):
  - `fire`, `hit`, and `explosion` are published by `CombatSystem` ([projectiles-and-combat.md](projectiles-and-combat.md));
  - `death` is published by `HealthDeathSystem` ([health-and-death.md](health-and-death.md)) immediately after death is recorded and before death hooks run;
  - `companionDowned` is published by `HealthDeathSystem` when companion HP reaches zero without entering the normal death/removal path;
  - `companionBoop` and `companionRescued` are published by `CompanionSystem` ([companion-combat.md](companion-combat.md));
  - `win` and `loss` are published by `SessionFlowSystem` ([runtime-systems.md](runtime-systems.md), [session-definition.md](session-definition.md)) exactly once per run;
  - `dropSpawn`, `dropPickup`, and `dropExpire` are published by `DropSystem` ([drops.md](drops.md)): `dropSpawn` inside the death hook synchronously after `EntityStore.spawnDrop`; `dropPickup` and `dropExpire` during the `DropSystem` tick phase, by [drops.md](drops.md) rules, with exactly one of them for each drop;
  - `playerSpawn` is published by `EntityStore.spawnPlayer` (the same path used by `start(session)` and `core.addPlayer`); see [runtime-systems.md](runtime-systems.md).
  - `playerDowned` is published by `HealthDeathSystem` ([health-and-death.md](health-and-death.md)) at the same place that would have recorded a normal player death under any other lossCondition; the event is suppressed if the active session does not use `lossCondition: 'allPlayersDead'`.
  - `playerRevived` is published by the shared rescue handler ([runtime-systems.md](runtime-systems.md)) when a player transitions from `'ghost'`/`'reviving'` back to `'alive'`; the same handler publishes `companionRescued` for companion rescues to keep one ownership boundary for both rescues.
- No other system may publish `fire`/`hit`/`explosion`/`death`/`companionBoop`/`companionDowned`/`companionRescued`/`win`/`loss`/`dropSpawn`/`dropPickup`/`dropExpire`/`bossPhaseChange`/`playerSpawn`/`playerDowned`/`playerRevived`. Exception: `BossPhaseSystem` publishes only `bossPhaseChange`; `DropSystem` subscribes to death hooks for drops and does not replace `death`. Neither system publishes an alternate death or victory event.
- Story 036 deliberately does **not** add a `levelUp` (or equivalent form-change) kind to shared `RuntimeEvent`. Level chains are PvP policy with no current consumer in the shared sim; the host emits its own `levelUp` event on a parallel wire channel recorded in story 036's hosting decision. If a second consumer of form changes appears in the shared sim later, the event kind is added here at that time.
- Vibe Jam portals do not add snapshot entity kinds or runtime events in story 026. The main thread derives portal descriptors and redirect checks from `SessionDefinition`, `SnapshotPair.curr`, and browser URL context; see [vibe-jam-portals.md](vibe-jam-portals.md).

### Guarantees and priorities

- Snapshots are published on the schedule from [simulation-timing.md](simulation-timing.md) (`SNAPSHOT_HZ = 30`).
- Runtime events are published when they happen, without aggregation between ticks. If the stream is overloaded, [thread-model.md](thread-model.md) already defines snapshot priority; combat events degrade like any other events.
- HUD/audio must not reconstruct authoritative state only from combat events: between two `hit` events on one enemy, HP is read from the snapshot, not from summing damage in events.

### Extension

- A new entity `kind` (`drop`, `boss`, `pickup` effect) is added here as a **new union member**, without reopening existing members.
- A new field in an existing `kind` may only be appended. Removing a field supersedes this decision.
- A new combat runtime event kind, for example `parry`, `crit`, or `pickup`, is added here. Silently extending `events.ts` without updating this file violates the contract.

## Consequences

- HUD, audio, and render in 007/008 get a stable field set and do not have to reverse-engineer snapshots story by story.
- `archetypeId` in enemy and projectile snapshots prevents magic colors/sprites tied to entity `id`; renderer chooses visuals by archetype from the `content library`.
- `maxHp` is duplicated in every enemy snapshot. This is an intentional trade-off for HUD simplicity; traffic cost is negligible at expected MVP entity counts.
- New combat event kinds are sufficient for muzzle flash, hit spark, hit sound, and death sound; their shape should not need revision in 008.
- Death hooks remain the only inter-system way to react to death. Publishing a `death` runtime event is a separate path for main-thread consumers.

## Related

- [thread-model.md](thread-model.md)
- [runtime-systems.md](runtime-systems.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [health-and-death.md](health-and-death.md)
- [content-archetypes.md](content-archetypes.md)
- [session-definition.md](session-definition.md)
- [zone.md](zone.md)
- [spawn-plan.md](spawn-plan.md)
- [drops.md](drops.md)
- [boss-encounter.md](boss-encounter.md)
- [simulation-timing.md](simulation-timing.md)
- [impact-feedback.md](impact-feedback.md)
- [landing-telegraph.md](landing-telegraph.md)
- [non-player-firing.md](non-player-firing.md)
- [hud-presentation.md](hud-presentation.md)
- [session-result-summary.md](session-result-summary.md)
- [vibe-jam-portals.md](vibe-jam-portals.md)
- [companion-combat.md](companion-combat.md)
- [online-session-hosting.md](online-session-hosting.md)
- [online-lobby.md](online-lobby.md)
- [online-client-prediction.md](online-client-prediction.md)
- [input-commands.md](input-commands.md)
- [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)
- [../stories/028-dungeon-mode.md](../stories/028-dungeon-mode.md)
- [../stories/030-companion-combat-and-rescue.md](../stories/030-companion-combat-and-rescue.md)
- [../stories/035-multi-actor-sessions.md](../stories/035-multi-actor-sessions.md)
- [../stories/036-node-arena-host.md](../stories/036-node-arena-host.md)
- [../stories/037-coop-vs-slimes.md](../stories/037-coop-vs-slimes.md)
- [../stories/038-online-client-prediction.md](../stories/038-online-client-prediction.md)
