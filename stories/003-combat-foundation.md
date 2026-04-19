# Combat Foundation

- Status: done
- Created: 2026-04-19
- Updated: 2026-04-19

## Player-facing

- Sees: на арене появляется тренировочная мишень-враг; при попадании отображается урон, мишень умирает и исчезает.
- Can do: стрелять из единственного оружия, попадать по мишени, убивать её.

## Technical

- Контент: один `EnemyArchetype` (стационарная мишень) и один `WeaponArchetype` (пистолет) в `content library` по [../design/content-archetypes.md](../design/content-archetypes.md); ссылки в сессию — по `id`.
- `Loadout` в `SessionDefinition` получает минимальную форму `{ primaryWeaponArchetypeId }` ([../design/session-definition.md](../design/session-definition.md), [../design/content-archetypes.md](../design/content-archetypes.md)); sandbox-encounter с боем теперь несёт `loadout` объектом, а не `null`.
- `SpawnPlan` расширяется до union `{ empty | static }` по [../design/spawn-plan.md](../design/spawn-plan.md); `SpawnSystem` появляется в минимальной форме «исполнить static-список на encounter start».
- `CombatSystem` (выстрел/кулдаун/движение снарядов/хит-тест/damage intents) и `HealthDeathSystem` (HP на сущностях, применение damage intents, death hooks, удаление) — по [../design/projectiles-and-combat.md](../design/projectiles-and-combat.md) и [../design/health-and-death.md](../design/health-and-death.md). `MovementSystem` снаряды не двигает.
- `SpatialIndex` появляется как минимальный per-tick rebuild с двумя запросами (radius/box), внутренний помощник `CombatSystem`; контракт — в [../design/runtime-systems.md](../design/runtime-systems.md).
- Снапшот расширяется новыми `EntitySnapshot` для `enemy` и `projectile`, runtime events — `fire`/`hit`/`death` по [../design/snapshot-shape.md](../design/snapshot-shape.md). Owner: `CombatSystem` (`fire`/`hit`), `HealthDeathSystem` (`death`).
- Ввод выстрела использует уже существующий `fire start/stop` из 002 ([../design/input-commands.md](../design/input-commands.md)); `aim` берётся из `RuntimeInputState`.
- Рендер на стороне `main` получает мишень и снаряды как обычные сущности по `kind` ([../design/thread-model.md](../design/thread-model.md), [../design/snapshot-shape.md](../design/snapshot-shape.md)); цвет берётся из архетипа.
- Sandbox-encounter переходит со `spawnPlan: { kind: 'empty' }` на `{ kind: 'static', spawns: [{ archetypeId, position }] }` для тренировочной мишени; `winCondition`/`lossCondition` остаются `none` (см. правила sandbox в [../design/session-definition.md](../design/session-definition.md)).

## Out of scope

- Несколько типов оружия, несколько типов врагов, бафы и модификаторы.
- Поведение врагов сложнее `stationary` (chase, wander, эскорт, AI-стрельба) — это 004 и далее.
- HP игрока и реакция на смерть игрока (`lossCondition: playerDeath`) — играем за пределами 003; путь зафиксирован в [../design/health-and-death.md](../design/health-and-death.md), реализация — в более поздней истории.
- Дроп с трупов — это `005` (работает через death hook, оставленный в [../design/health-and-death.md](../design/health-and-death.md)).
- Босс, волны, тёмная зона — `004`, `006`.
- Полноценный HUD урона/HP, эффекты попаданий и звуки — это `007`/`008`. В 003 достаточно того, что значения `hp` идут в снапшоте, а события `hit`/`death` доходят до main.
- Sweep-collision снарядов и регулируемый muzzle-offset — отложенные улучшения, фиксируются как «не в 003» в [../design/projectiles-and-combat.md](../design/projectiles-and-combat.md).

## Acceptance

- При старте sandbox-сессии тренировочная мишень спавнится в позиции, заданной `spawnPlan` контента, и видна на арене.
- При нажатии ЛКМ игрок выпускает снаряд по направлению `aim`; повторные выстрелы возможны не чаще, чем раз в `cooldownMs` оружия.
- Попадание снаряда в мишень уменьшает её `hp` ровно на `damage` оружия; снаряд исчезает в том же тике, попадание сопровождается runtime event `hit`.
- При `hp == 0` мишень исчезает в **том же** тике, в котором приняла финальный урон; публикуется runtime event `death`.
- Промах: снаряд исчезает по истечении `projectileTtlMs` или при выходе за границы арены, не оставаясь в `EntityStore` и в снапшотах.
- Удержание ЛКМ даёт серию выстрелов с темпом `cooldownMs` без отдельных «авто-фаер» ускорений; отпускание ЛКМ останавливает огонь без задержки.
- Все combat-системы и SpawnSystem работают только при активной сессии; `stopSession` сбрасывает их state и не оставляет утечек сущностей.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Расширить публичные контракты в `src/shared/**` под боевую модель: новые члены `EntitySnapshot` (`enemy`, `projectile`) и три combat-`RuntimeEvent` (`fire`/`hit`/`death`) по `design/snapshot-shape.md`; `SpawnPlan` union до `{ empty \| static }` в `src/shared/session.ts` по `design/spawn-plan.md`; тип `Loadout = { primaryWeaponArchetypeId }` по `design/content-archetypes.md`. Никаких реализаций систем в этой задаче — только формы и `assertNever`-готовые union-ы. | опоры: `design/snapshot-shape.md`, `design/spawn-plan.md`, `design/content-archetypes.md`, `design/session-definition.md`, `design/thread-model.md` |
| T2 | [x] | Контент-library: реестры `EnemyArchetype` и `WeaponArchetype` в `src/shared/content/**` (`Record<string, Archetype>` с ключом = `archetype.id`), одна тренировочная мишень (`behavior: 'stationary'`) и один пистолет; sandbox-with-combat `ModePreset`/builder, который кладёт `loadout: { primaryWeaponArchetypeId }` и `spawnPlan: { kind: 'static', spawns: [{ archetypeId, position }] }` в `SessionDefinition`. Старый sandbox без боя сохраняется. | опоры: `design/content-archetypes.md`, `design/content-boundaries.md`, `design/web-stack.md`, `design/session-definition.md`, `design/spawn-plan.md` |
| T3 | [x] | `EntityStore`: добавить kinds `enemy` (с `HasHealth = { hp, maxHp }` по `design/health-and-death.md`) и `projectile` (поля по `design/projectiles-and-combat.md`). `MovementSystem` обязан не двигать `projectile` и не двигать `enemy` с `behavior: 'stationary'`; границы арены продолжают применяться только к управляемым актёрам. | опоры: `design/runtime-systems.md`, `design/projectiles-and-combat.md`, `design/health-and-death.md`, `design/arena-and-coordinates.md` |
| T4 | [x] | `SpatialIndex` как внутренний помощник: per-tick rebuild из текущего `EntityStore` после фаз, меняющих позиции; минимальный API «соседи в радиусе» и «соседи в осевом прямоугольнике»; без публикации events и без мутаций сущностей. Встроить в update-order по `design/runtime-systems.md` (после `MovementSystem` и фазы движения снарядов внутри `CombatSystem`). | опоры: `design/runtime-systems.md` |
| T5 | [x] | `SpawnSystem`: исполнение `spawnPlan` активного encounter — для `'static'` один раз на `encounterStart` через `EntityStore` (без обхода store), для `'empty'` no-op; внутренний state сбрасывается на `encounterEnd`; неизвестный `kind` отвергается через `assertNever`. Sandbox-encounter с мишенью спавнит её через `SpawnSystem`, а не «вшивает» в инициализацию. | опоры: `design/spawn-plan.md`, `design/runtime-systems.md`, `design/session-definition.md` |
| T6 | [x] | `CombatSystem` по `design/projectiles-and-combat.md`: per-shooter cooldown в runtime state стрелка; пять фаз тика (firing decisions → projectile movement → lifetime cleanup → hit detection → removal); хит-тест через `SpatialIndex`; формирование списка `DamageIntent` для `HealthDeathSystem`; публикация runtime events `fire` и `hit` по `design/snapshot-shape.md`. `MovementSystem` снаряды не двигает. | опоры: `design/projectiles-and-combat.md`, `design/snapshot-shape.md`, `design/input-commands.md`, `design/simulation-timing.md`, `design/runtime-systems.md` |
| T7 | [x] | `HealthDeathSystem` по `design/health-and-death.md`: применение damage intents (`hp = max(0, hp − amount)`), фиксация смерти на текущем тике, публикация runtime event `death` до запуска hooks; синхронные `DeathHook`-и в порядке регистрации с зафиксированными запретами; удаление помеченных сущностей **до** `SnapshotExportSystem`. Повторный intent в уже мёртвую на этом тике цель — игнорируется. | опоры: `design/health-and-death.md`, `design/snapshot-shape.md`, `design/runtime-systems.md` |
| T8 | [x] | `SnapshotExportSystem` и main-render: экспорт `enemy`/`projectile` в `snapshot.entities` ровно теми полями, что зафиксированы в `design/snapshot-shape.md`; удалённые сущности в снапшоте отсутствуют. Renderer в `main` рисует `enemy` (цвет из `EnemyArchetype.color`) и `projectile` (цвет из `WeaponArchetype.color`); интерполяция позиций по уже существующим правилам без изменений. | опоры: `design/snapshot-shape.md`, `design/thread-model.md` |
| T9 | [x] | Тесты под боевой контракт по `design/testing.md`: per-shooter cooldown между двумя последовательными выстрелами; цепочка `hit → damage → death` происходит в один тик; despawn снаряда по `projectileTtlMs` и по выходу за границы арены; повторный damage intent в уже мёртвую на этом тике цель не запускает death hook второй раз; инвариант «снаряды не двигаются `MovementSystem`»; неизвестный `SpawnPlan.kind` вызывает `assertNever`. | опоры: `design/testing.md`, `design/projectiles-and-combat.md`, `design/health-and-death.md`, `design/spawn-plan.md` |
| T10 | [x] | Закрытие истории: чек-лист закрытия (см. `stories/README.md`), перевод `Status` истории в `done`, обновление таблицы в `stories/README.md`; проверка, что `Index` в `design/README.md` остался актуален. | архитектор |

## Related

- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../design/projectiles-and-combat.md](../design/projectiles-and-combat.md)
- [../design/health-and-death.md](../design/health-and-death.md)
- [../design/spawn-plan.md](../design/spawn-plan.md)
- [../design/content-archetypes.md](../design/content-archetypes.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/session-definition.md](../design/session-definition.md)
- [../design/snapshot-shape.md](../design/snapshot-shape.md)
- [../design/thread-model.md](../design/thread-model.md)
- [../design/input-commands.md](../design/input-commands.md)
- [../design/arena-and-coordinates.md](../design/arena-and-coordinates.md)
- [../design/simulation-timing.md](../design/simulation-timing.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/logging.md](../design/logging.md)
- [../design/testing.md](../design/testing.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)

