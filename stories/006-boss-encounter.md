# Boss Encounter

- Status: done
- Created: 2026-04-19
- Updated: 2026-04-20

## Player-facing

- Sees: after the waves are cleared, the final boss fight starts on the full arena with no dark zone; the boss's behaviour phases are visible.
- Can do: fight the boss, weather phase changes, win (the final win) or die.

## Technical

- Foundations: [boss-encounter.md](../design/boss-encounter.md), [spawn-plan.md](../design/spawn-plan.md) (`kind: 'boss'`), [content-archetypes.md](../design/content-archetypes.md) (`BossArchetype`, `bosses` registry), [session-definition.md](../design/session-definition.md) (`EncounterDefinition.type: 'boss'`, `zoneBehavior: disabled`, `winCondition: bossDefeated`), [runtime-systems.md](../design/runtime-systems.md) (`BossPhaseSystem`), [snapshot-shape.md](../design/snapshot-shape.md), [health-and-death.md](../design/health-and-death.md), [enemy-contact.md](../design/enemy-contact.md), [projectiles-and-combat.md](../design/projectiles-and-combat.md), [zone.md](../design/zone.md). Product expectations — [../docs/BOSS.md](../docs/BOSS.md).

## Out of scope

- Multiple bosses and dedicated arenas for them.
- Cutscenes, dialogue, animated intros.
- Reworking systems — `BossPhaseSystem` is built on top of the existing ones.

## Acceptance

- After the last wave encounter the boss fight starts immediately.
- The dark zone is disabled on this encounter.
- The boss goes through at least 2 phases and changes behaviour between them.
- The boss's death ends the session in victory; the player's death ends it in defeat.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Extend the public contracts in `src/shared/**`: `SpawnPlan` (`kind: 'boss'`), boss types and `kind: 'boss'` entity in the snapshot/event protocols (`bossHud`, `bossPhaseChange`, extensions of `fire`/`hit`/`death`), `DamageIntent.source`, `Projectile.ownerKind`, `DeathContext.entityKind` — strictly per the updated `design/*` without simulation implementation in this task. | basis: `spawn-plan.md`, `snapshot-shape.md`, `health-and-death.md`, `projectiles-and-combat.md`, `boss-encounter.md` |
| T2 | [x] | Content: a `BossArchetype` registry (`bosses.ts`), one boss profile with ≥2 phases and ≥2 attacks; campaign/builder extension: a chain after the wave encounters with a boss encounter using `spawnPlan: { kind: 'boss', … }`, `zoneBehavior: { kind: 'disabled' }`, `winCondition: { kind: 'bossDefeated' }` (not mixed with `allEncountersComplete`). | `content-archetypes.md`, `session-definition.md`, `boss-encounter.md`, `BOSS.md` |
| T3 | [x] | `SpawnSystem`: execute `'boss'` (one spawn at `encounterStart`, account for `aliveFromThisPlan`, reset on `encounterEnd`). | `spawn-plan.md`, `boss-encounter.md` |
| T4 | [x] | `EntityStore` and motion: a `kind: 'boss'` entity, `HasHealth`, integration with `SpatialIndex`/collisions; contact intents with the boss per [enemy-contact.md](../design/enemy-contact.md). | `health-and-death.md`, `enemy-contact.md`, `arena-and-coordinates.md` |
| T5 | [x] | `CombatSystem`: player projectiles hit `boss`; if needed, projectiles with `ownerKind: 'boss'`; no damage duplication outside `HealthDeathSystem`. | `projectiles-and-combat.md`, `boss-encounter.md` |
| T6 | [x] | `BossPhaseSystem`: phase thresholds from `BossArchetype.phases`, attack selection/cooldowns, `DamageIntent` with `source.kind: 'boss'`; publish `bossPhaseChange`. | `boss-encounter.md`, `runtime-systems.md`, `snapshot-shape.md` |
| T7 | [x] | `SessionFlowSystem`: a session-level death hook for `bossDefeated`; guarantee a single `win`; reconcile with the boss encounter's `transitionRules` to avoid a double victory. | `session-definition.md`, `boss-encounter.md`, `health-and-death.md` |
| T8 | [x] | `SnapshotExportSystem` + minimal boss rendering (debug/placeholder): `BossSnapshot`, `bossHud`, the entity in the entities list. | `snapshot-shape.md`, `thread-model.md` |
| T9 | [x] | Tests: boss spawn, two phases (transition by HP threshold), victory on boss death with `bossDefeated`, the zone is `disabled` on the boss encounter; close the story per the `stories/README.md` checklist. | `testing.md`, architect owns the meta closing task |

## Related

- [../design/boss-encounter.md](../design/boss-encounter.md)
- [../design/session-definition.md](../design/session-definition.md)
- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../design/spawn-plan.md](../design/spawn-plan.md)
- [../design/content-archetypes.md](../design/content-archetypes.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/snapshot-shape.md](../design/snapshot-shape.md)
- [../design/health-and-death.md](../design/health-and-death.md)
- [../design/enemy-contact.md](../design/enemy-contact.md)
- [../design/projectiles-and-combat.md](../design/projectiles-and-combat.md)
- [../design/zone.md](../design/zone.md)
- [../design/rng.md](../design/rng.md)
- [../design/arena-and-coordinates.md](../design/arena-and-coordinates.md)
- [../docs/BOSS.md](../docs/BOSS.md)
