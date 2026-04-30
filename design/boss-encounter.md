# Boss Encounter

- Status: accepted
- Created: 2026-04-20
- Updated: 2026-04-30 (story 032 prep: added Related link for the public multiplayer arena. Earlier: 2026-04-26 story 024: boss defeat/result HP is summarized for Result UI by [session-result-summary.md](session-result-summary.md). Earlier: 2026-04-20.)

## Context

[runtime-systems.md](runtime-systems.md) already defines `BossPhaseSystem` and the owner runtime event for phase changes. [session-definition.md](session-definition.md) says that the concrete implementation path for `winCondition: { kind: 'bossDefeated' }` belongs to story 006. [spawn-plan.md](spawn-plan.md) leaves the `'boss'` kind for 006. [snapshot-shape.md](snapshot-shape.md) leaves the `kind: 'boss'` entity for 006. [health-and-death.md](health-and-death.md) activates only `DamageIntent.source.kind === 'projectile'` and `'enemyContact'`; the `'boss'` branch is reserved.

Without an explicit decision, story 006 may lock in divergence: boss as "large enemy", duplicate `win` publication, or mismatch between `SpawnSystem`, encounter transitions, and session-level victory.

Product constraints are in [../docs/BOSS.md](../docs/BOSS.md).

## Decision

### Boss entity in runtime

- Boss is a separate runtime entity `kind`, **`'boss'`**, not a replacement for `enemy`. Boss has `HasHealth` with the same `hp`/`maxHp` fields as `enemy` ([health-and-death.md](health-and-death.md)); `maxHp` comes from `BossArchetype` ([content-archetypes.md](content-archetypes.md)).
- Archetype resolution uses the stable `id` from the `bosses` registry in the `content library`; session data references it only by `id` ([content-boundaries.md](content-boundaries.md)).

### SpawnPlan kind `'boss'`

- Shape and semantics are defined in the "Boss spawn" section of [spawn-plan.md](spawn-plan.md): exactly one boss spawn at encounter start, with no repeated dispatch on ticks.
- `EncounterDefinition` for boss combat has `type: 'boss'` and `spawnPlan.kind: 'boss'`; `transitionRules` for ending the encounter after killing the boss are `{ kind: 'allEnemiesCleared' }` (same as a wave: the plan is exhausted and no live entity from the plan remains; see [spawn-plan.md](spawn-plan.md), [session-definition.md](session-definition.md)).

### Zone

- Boss encounters use `zoneBehavior: { kind: 'disabled' }` ([session-definition.md](session-definition.md), [zone.md](zone.md)): `margin = 0`, zone does not shrink.

### BossPhaseSystem

- `BossPhaseSystem` owns **phase transitions** using `BossArchetype.phases[].exitWhenHpFractionAtOrBelow` and `allowedAttackIds` lists ([content-archetypes.md](content-archetypes.md)), and also owns **boss attack selection and execution** in its update-order phase ([runtime-systems.md](runtime-systems.md)).
- Boss attack damage to the player is produced only through `DamageIntent` with `source: { kind: 'boss'; bossId: EntityId; attackId: string }` ([health-and-death.md](health-and-death.md)); cooldowns and `attackId` selection are `BossPhaseSystem` responsibility, with no duplicate HP subtraction outside `HealthDeathSystem`.
- Player contact with boss follows [enemy-contact.md](enemy-contact.md): the same contact-intents phase in `CombatSystem`, the same archetype damage and cooldown fields; `DamageIntent.source` uses `kind: 'enemyContact'` and `enemyId` equal to the boss entity id (the field name is historical). Collisions are handled for `kind: 'boss'` entities alongside `enemy`, with parameters taken from `BossArchetype`.

### `bossDefeated` victory

- If `SessionDefinition.winCondition.kind === 'bossDefeated'`, `SessionFlowSystem` registers a **session-level death hook** (same registration point as player death — [health-and-death.md](health-and-death.md)): when `ctx.entityKind === 'boss'` and `ctx.entityId` matches the current session boss id (the single `kind: 'boss'` entity spawned in the boss encounter, or an explicit runtime-state field `activeBossEntityId` set at spawn), **`win` is published exactly once**, followed by the same run teardown as other victories ([session-definition.md](session-definition.md)).
- A single `SessionDefinition` must **not combine** `winCondition: { kind: 'bossDefeated' }` with `{ kind: 'allEncountersComplete' }`: the "waves → boss" preset uses only **`bossDefeated`**. Victory is defined by boss death, not by a separate "last encounterEnd" as an alternative `win` trigger.

### Snapshot and events

- `BossSnapshot` shape, top-level snapshot extensions, and the phase-change runtime event are in [snapshot-shape.md](snapshot-shape.md). Publishing the phase-change event is owned by `BossPhaseSystem` ([runtime-systems.md](runtime-systems.md)).

## Consequences

- The player shoots the boss as a separate kind in hit detection; snapshots and events get explicit `'boss'` where only `'enemy'` existed before ([snapshot-shape.md](snapshot-shape.md), and [projectiles-and-combat.md](projectiles-and-combat.md) if needed).
- The campaign content preset must define its encounter chain and `winCondition: bossDefeated` consistently; build-time failure is preferred to runtime ambiguity.

## Related

- [../docs/BOSS.md](../docs/BOSS.md)
- [session-definition.md](session-definition.md)
- [spawn-plan.md](spawn-plan.md)
- [runtime-systems.md](runtime-systems.md)
- [zone.md](zone.md)
- [content-archetypes.md](content-archetypes.md)
- [health-and-death.md](health-and-death.md)
- [enemy-contact.md](enemy-contact.md)
- [snapshot-shape.md](snapshot-shape.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [../stories/006-boss-encounter.md](../stories/006-boss-encounter.md)
- [session-result-summary.md](session-result-summary.md)
- [public-multiplayer-arena.md](public-multiplayer-arena.md)
