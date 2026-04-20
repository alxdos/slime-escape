# Boss Encounter

- Status: in-progress
- Created: 2026-04-19
- Updated: 2026-04-20

## Player-facing

- Sees: после прохождения волн запускается финальный бой с боссом на полной арене без тёмной зоны; видны фазы поведения босса.
- Can do: сражаться с боссом, переживать смену фаз, побеждать (финальный win) или умирать.

## Technical

- Опоры: [boss-encounter.md](../design/boss-encounter.md), [spawn-plan.md](../design/spawn-plan.md) (`kind: 'boss'`), [content-archetypes.md](../design/content-archetypes.md) (`BossArchetype`, реестр `bosses`), [session-definition.md](../design/session-definition.md) (`EncounterDefinition.type: 'boss'`, `zoneBehavior: disabled`, `winCondition: bossDefeated`), [runtime-systems.md](../design/runtime-systems.md) (`BossPhaseSystem`), [snapshot-shape.md](../design/snapshot-shape.md), [health-and-death.md](../design/health-and-death.md), [enemy-contact.md](../design/enemy-contact.md), [projectiles-and-combat.md](../design/projectiles-and-combat.md), [zone.md](../design/zone.md). Продуктовые ожидания — [../docs/BOSS.md](../docs/BOSS.md).

## Out of scope

- Несколько боссов и арены под них.
- Кат-сцены, диалоги, анимированные intro.
- Реворк систем — `BossPhaseSystem` строится поверх существующих.

## Acceptance

- После последнего волнового encounter сразу начинается бой с боссом.
- Тёмная зона отключена на этом encounter.
- Босс проходит как минимум 2 фазы и меняет поведение между ними.
- Смерть босса завершает сессию победой; смерть игрока — поражением.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Расширить публичные контракты в `src/shared/**`: `SpawnPlan` (`kind: 'boss'`), типы босса и сущности `kind: 'boss'` в протоколах снапшота/событий (`bossHud`, `bossPhaseChange`, расширения `fire`/`hit`/`death`), `DamageIntent.source`, `Projectile.ownerKind`, `DeathContext.entityKind` — строго по обновлённым `design/*` без реализации симуляции в этой задаче. | опоры: `spawn-plan.md`, `snapshot-shape.md`, `health-and-death.md`, `projectiles-and-combat.md`, `boss-encounter.md` |
| T2 | [x] | Контент: реестр `BossArchetype` (`bosses.ts`), один профиль босса с ≥2 фазами и ≥2 атаками; расширение кампании / builder: цепочка после волновых encounter — boss-encounter с `spawnPlan: { kind: 'boss', … }`, `zoneBehavior: { kind: 'disabled' }`, `winCondition: { kind: 'bossDefeated' }` (не смешивать с `allEncountersComplete`). | `content-archetypes.md`, `session-definition.md`, `boss-encounter.md`, `BOSS.md` |
| T3 | [ ] | `SpawnSystem`: исполнение `'boss'` (один спавн при `encounterStart`, учёт `aliveFromThisPlan`, сброс на `encounterEnd`). | `spawn-plan.md`, `boss-encounter.md` |
| T4 | [ ] | `EntityStore` и движение: сущность `kind: 'boss'`, `HasHealth`, интеграция в `SpatialIndex`/коллизии; contact intents с боссом по [enemy-contact.md](../design/enemy-contact.md). | `health-and-death.md`, `enemy-contact.md`, `arena-and-coordinates.md` |
| T5 | [ ] | `CombatSystem`: попадание снарядов игрока по `boss`; при необходимости снаряды с `ownerKind: 'boss'`; без дублирования урона вне `HealthDeathSystem`. | `projectiles-and-combat.md`, `boss-encounter.md` |
| T6 | [ ] | `BossPhaseSystem`: пороги фаз по `BossArchetype.phases`, выбор/кулдауны атак, `DamageIntent` с `source.kind: 'boss'`; публикация `bossPhaseChange`. | `boss-encounter.md`, `runtime-systems.md`, `snapshot-shape.md` |
| T7 | [ ] | `SessionFlowSystem`: session-level death hook для `bossDefeated`; гарантия одного `win`; согласование с `transitionRules` boss-encounter без двойной победы. | `session-definition.md`, `boss-encounter.md`, `health-and-death.md` |
| T8 | [ ] | `SnapshotExportSystem` + минимальный рендер босса (отладочный/плейсхолдер): `BossSnapshot`, `bossHud`, сущность в списке entities. | `snapshot-shape.md`, `thread-model.md` |
| T9 | [ ] | Тесты: спавн босса, две фазы (переход по порогу HP), победа по смерти босса при `bossDefeated`, зона `disabled` на boss-encounter; закрытие истории по чек-листу `stories/README.md`. | `testing.md`, архитектор для мета-задачи закрытия |

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
