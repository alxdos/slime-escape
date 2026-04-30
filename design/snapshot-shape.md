# Snapshot Shape

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-30 (story 032 prep: added Related link for the public multiplayer arena. Earlier: 2026-04-29 story 030 follow-up: `dropPickup.pickerId` may now be the player or the companion; pickup eligibility remains defined in [drops.md](drops.md). Earlier story 030 prep: add `CompanionSnapshot`, `ownerKind: 'companion'`, `targetKind: 'companion'`, and companion boop/downed/rescued events; full behavior contract in [companion-combat.md](companion-combat.md). Earlier: 2026-04-28 story 028 prep: `EncounterSnapshot` adds `waveOrdinal: number | null` so Dungeon can show an increasing run-level wave number while looping authored encounter indices. Earlier: 2026-04-27 story 026 prep: `EncounterSnapshot.type` includes the new `portal` encounter type, but portals do not become entity snapshots or runtime events; main-thread portal descriptors are defined in [vibe-jam-portals.md](vibe-jam-portals.md). Earlier: projectile snapshots expose effective runtime `size` so render can show projectile-size modifiers without inferring weapon state on the main thread; existing `originX`/`originY` projectile fields are documented here as presentation data copied from runtime `Projectile.origin`). Earlier: 2026-04-26 story 024: terminal `win`/`loss` runtime events carry `SessionResultSummary`; authoritative result stats are defined in [session-result-summary.md](session-result-summary.md). Earlier story 022: `WeaponHudSnapshot` receives a cooldown interval (`cooldownStartedAtSimMs`/`cooldownReadyAtSimMs`), permanent `modifiers`, and active `timedEffects` for the weapon-slot HUD; the presentation contract lives in [hud-presentation.md](hud-presentation.md). Earlier: 2026-04-25 story 020: `ProjectileSnapshot` receives required field `arcEnd: { x: number; y: number } | null`, the fixed world landing position for an in-flight arc projectile; it is `null` for grounded projectiles and for linear/placed motion. Source of truth is `CombatSystem` at projectile creation; `SnapshotExportSystem` copies the value and does not recompute it. The render contract for landing telegraphs on non-player in-flight arcs is [landing-telegraph.md](landing-telegraph.md). Earlier: 2026-04-24 017 alignment: projectile snapshots and combat events support universal projectile state, owner `boss`, grounded/explosive presentation, selected weapon HUD, and explosion events; see [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). 018 alignment: `fieldEffect` and status presentation fields are reserved for [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md). Earlier: 016 impact feedback, 006 boss, 005 drops.)

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
    x: number;
    y: number;
    hp: number;       // integer >= 0
    maxHp: number;    // integer > 0; repeated in each snapshot, like enemy
  }
  ```
  `hp`/`maxHp` are present **always**, regardless of whether the current session has `lossCondition: playerDeath`. This avoids two ways to say "no data" in HUD and simplifies rendering: in a non-combat sandbox session, `hp = maxHp` for the whole run.
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
  }
  ```
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

- Top-level shape for the 004 horizon:
  ```ts
  type Snapshot = Readonly<{
    simTimeMs: number;
    entities: ReadonlyArray<EntitySnapshot>;
    encounter: EncounterSnapshot | null;
    zone: ZoneSnapshot;
    waveProgress: WaveProgressSnapshot | null;
    bossHud: BossHudSnapshot | null;
    weaponHud: WeaponHudSnapshot | null;
  }>;
  ```
- Run-level HUD aggregates, such as player HP, wave progress, and boss state, live as separate top-level fields rather than being folded into `entities`. Each such extension is recorded here.
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
- `weaponHud` (017, extended by 022):
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
  `null` means the active session has no player loadout. HUD reads selected weapon, cooldown interval, permanent modifiers, and active timed weapon effects from this field instead of inspecting runtime weapon instances directly. `cooldownStartedAtSimMs`/`cooldownReadyAtSimMs` define the current or most recent cooldown interval; HUD derives fill from those timestamps and `snapshot.simTimeMs`. `modifiers` contains permanent `WeaponModifier` values copied from the selected owner's weapon instance. `timedEffects` contains only active timed effects at snapshot time (`expiresAtSimMs > snapshot.simTimeMs`); on this horizon the only timed effect is `temporaryOverdrive`. Full render semantics are in [hud-presentation.md](hud-presentation.md).
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
- Owner systems (see [runtime-systems.md](runtime-systems.md)):
  - `fire`, `hit`, and `explosion` are published by `CombatSystem` ([projectiles-and-combat.md](projectiles-and-combat.md));
  - `death` is published by `HealthDeathSystem` ([health-and-death.md](health-and-death.md)) immediately after death is recorded and before death hooks run;
  - `companionDowned` is published by `HealthDeathSystem` when companion HP reaches zero without entering the normal death/removal path;
  - `companionBoop` and `companionRescued` are published by `CompanionSystem` ([companion-combat.md](companion-combat.md));
  - `win` and `loss` are published by `SessionFlowSystem` ([runtime-systems.md](runtime-systems.md), [session-definition.md](session-definition.md)) exactly once per run;
  - `dropSpawn`, `dropPickup`, and `dropExpire` are published by `DropSystem` ([drops.md](drops.md)): `dropSpawn` inside the death hook synchronously after `EntityStore.spawnDrop`; `dropPickup` and `dropExpire` during the `DropSystem` tick phase, by [drops.md](drops.md) rules, with exactly one of them for each drop.
- No other system may publish `fire`/`hit`/`explosion`/`death`/`companionBoop`/`companionDowned`/`companionRescued`/`win`/`loss`/`dropSpawn`/`dropPickup`/`dropExpire`/`bossPhaseChange`. Exception: `BossPhaseSystem` publishes only `bossPhaseChange`; `DropSystem` subscribes to death hooks for drops and does not replace `death`. Neither system publishes an alternate death or victory event.
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
- [public-multiplayer-arena.md](public-multiplayer-arena.md)
- [../stories/028-dungeon-mode.md](../stories/028-dungeon-mode.md)
- [../stories/030-companion-combat-and-rescue.md](../stories/030-companion-combat-and-rescue.md)
