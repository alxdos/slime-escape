# Runtime Systems

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-26 (story 024: `RunSummaryTracker` observes deaths/drop pickups/progress and provides `SessionResultSummary` for terminal `win`/`loss` events; see [session-result-summary.md](session-result-summary.md). Earlier: 2026-04-24 017 alignment: `CombatSystem` owns universal weapon/projectile lifecycle from [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). 018 alignment: `FieldEffectSystem` and `StatusEffectSystem` are added after health/death and before drops; see [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md). Earlier: boss encounter, bossPhaseChange, drops.)

## Context

Для MVP нужен компактный `core runtime`, который поддерживает кампанию, тренировки и challenge-режимы, но не разрастается в общий "движок на все случаи". Системы должны покрывать текущий дизайн из `docs/` и работать внутри `simulation worker`.

## Decision

- Минимальный набор систем `core runtime`:
  - `SimulationClock` - фиксированный тик, пауза, timescale;
  - `SessionFlowSystem` - старт сессии, смена `encounter`, победа, поражение;
  - `EntityStore` - хранение и жизненный цикл runtime-сущностей;
  - `SpatialIndex` - быстрый поиск соседей для врагов, пуль и дропа;
  - `MovementSystem` - перемещение управляемых актёров (игрок, враги с поведением); движение снарядов — внутри `CombatSystem`, см. [projectiles-and-combat.md](projectiles-and-combat.md);
  - `CombatSystem` - выстрелы, попадания, урон, кулдауны;
  - `HealthDeathSystem` - HP, смерть, удаление сущностей, death hooks;
  - `SpawnSystem` - исполнение `spawnPlan`;
  - `ZoneSystem` - тёмная зона и другие режимы ограничения видимости;
  - `FieldEffectSystem` - lifetime and periodic application for puddles/temporary area effects;
  - `StatusEffectSystem` - actor-local status ticks, expiry and movement-affecting status resolution;
  - `DropSystem` - спавн, время жизни и подбор дропа;
  - `BossPhaseSystem` - переходы фаз и атаки босса;
  - `RunSummaryTracker` - hook-driven aggregation for terminal run summary; it observes deaths/drop pickups/progress and does not mutate gameplay state;
  - `SnapshotExportSystem` - сбор данных для рендера и HUD.
- Системы должны работать на простых runtime-структурах и явном update-order.
- Минимальный update order на тике:
  1. чтение входных команд и session-level control;
  2. `SessionFlowSystem` и encounter transitions;
  3. `SpawnSystem`;
  4. `BossPhaseSystem` и прочие высокоуровневые encounter-правила;
  5. `MovementSystem`;
  6. `CombatSystem`;
  7. `HealthDeathSystem`;
  8. `FieldEffectSystem`;
  9. `StatusEffectSystem`;
  10. `DropSystem`;
  11. `ZoneSystem`;
  12. `SnapshotExportSystem`.
- Допускается локальная перестройка порядка при прототипировании, но только если сохраняется общий принцип: сначала управляющие правила encounter, затем симуляция действия, затем последствия смерти/дропа, затем экспорт состояния.
- Сетевой код, сохранения, сложный инвентарь, крафт и полноценная мод-система не входят в MVP runtime.
- Отдельный физический движок не использовать; коллизии и overlap-проверки остаются кастомными и 2D-ориентированными.
- Все системы должны быть управляемы через `SessionDefinition` и runtime state, а не через прямые условные ветки по названию режима.
- Границы ответственности систем:
  - `SessionFlowSystem` решает, какой encounter активен, когда run завершается и какие session-level events публикуются; владеет lifecycle сессии и encounter transitions (см. ниже);
  - `SpawnSystem` только исполняет `spawnPlan` и не принимает решений о победе или поражении; форма `spawnPlan` и его исполнение — в [spawn-plan.md](spawn-plan.md);
  - `MovementSystem` меняет позиции и базовую кинематику **управляемых актёров** (игрок, враги с поведением), но не применяет урон; владеет инвариантом «сущность не выходит за границы арены» ([arena-and-coordinates.md](arena-and-coordinates.md)) и читает границы из активного `SessionDefinition.arena`, а не из глобальной константы; снаряды живут вне `MovementSystem` (см. [projectiles-and-combat.md](projectiles-and-combat.md));
  - `CombatSystem` создаёт выстрелы, двигает снаряды, вычисляет попадания, взрывы и формирует damage intents; полный контракт — [projectiles-and-combat.md](projectiles-and-combat.md) and [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md);
  - `HealthDeathSystem` единственный слой, который применяет финальную потерю HP, фиксирует смерть и удаляет damageable-сущности; полный контракт — [health-and-death.md](health-and-death.md);
  - `FieldEffectSystem` owns `fieldEffect` entity lifetime and periodic damage/status applications; it produces intents/applications, does not mutate HP directly, and follows [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md);
  - `StatusEffectSystem` owns status ticking, expiry and resolved actor status state; it produces damage intents and exposes movement modifiers, but does not move actors directly;
  - `SpatialIndex` — внутренний помощник систем (`CombatSystem`, `DropSystem`, при необходимости `BossPhaseSystem`); см. ниже минимальный контракт;
  - `DropSystem` реагирует на death hooks (спавн `Drop` в `EntityStore`) и в собственной фазе тика управляет только жизненным циклом дропа (ttl, pickup, удаление); полный контракт — [drops.md](drops.md);
  - `ZoneSystem` управляет состоянием зоны и её экспортом, но не завершает encounter самостоятельно и не наносит урона; полный контракт зоны (форма `margin`, режимы, lifecycle, экспорт) — в [zone.md](zone.md);
  - `BossPhaseSystem` управляет фазами и boss-specific attack rules, не подменяя `SessionFlowSystem`.
  - `RunSummaryTracker` наблюдает уже случившиеся факты (`DeathContext`, pickup дропа, текущий encounter/wave/boss state) и строит `SessionResultSummary` по запросу `SessionFlowSystem` перед публикацией `win`/`loss`; он не публикует events самостоятельно, не принимает решений о победе/поражении и не влияет на update order.
- `SpatialIndex` — минимальный контракт уровня архитектуры:
  - используется как акселератор соседских запросов и не является источником истины: исходное состояние сущностей живёт в `EntityStore`;
  - перестраивается каждый тик из текущего `EntityStore` после фаз, которые могут менять позиции (`MovementSystem`, фаза движения снарядов в `CombatSystem`);
  - минимальный API — два запроса: «соседи в радиусе вокруг точки» и «соседи в осевом прямоугольнике»;
  - гранулярность — единый индекс на тик с фильтрацией по `kind` на стороне вызова; раздельные индексы по `kind` — деталь реализации, не контракт;
  - `SpatialIndex` не публикует runtime events и не мутирует сущности.
- `death hooks` должны срабатывать после того, как `HealthDeathSystem` зафиксировал смерть сущности, но до финального экспорта снапшота. Минимальные потребители death hooks:
  - `DropSystem`;
  - session-level статистика и progression;
  - `RunSummaryTracker` для `kills`, `defeat.cause` и boss-defeated summary; этот hook должен отработать до death hook-а, который вызывает `SessionFlowSystem.onPlayerDeath` / `onBossDeath`;
  - runtime events для HUD/аудио/debug.
- Runtime events должны порождаться системами, которые владеют фактом события:
  - `SessionFlowSystem` - pause/resume, encounter start/end, win/loss;
  - `CombatSystem` - fire/hit/explosion;
  - `HealthDeathSystem` - death;
  - `DropSystem` - dropSpawn/dropPickup/dropExpire (полный контракт kinds и owner-а — [snapshot-shape.md](snapshot-shape.md), [drops.md](drops.md));
  - `BossPhaseSystem` — `bossPhaseChange` ([snapshot-shape.md](snapshot-shape.md)).
  `FieldEffectSystem` and `StatusEffectSystem` may publish future presentation events only after [snapshot-shape.md](snapshot-shape.md) defines their exact kinds.
- `SnapshotExportSystem` не создаёт новую gameplay-логику; он только агрегирует уже рассчитанное состояние и нужные HUD-поля.
- Lifecycle симуляции относительно сессии:
  - `simulation worker` создаётся один раз при старте приложения и переиспользуется между сессиями ([thread-model.md](thread-model.md)); `stopSession` не приводит к `worker.terminate()`.
  - `SimulationClock` стартует в режиме **idle**: пока нет активной сессии, он не продвигает `simTime` и не вызывает обновление систем. В idle-режиме pump может выполняться, но его единственное действие — стабилизировать аккумулятор и не «копить» wall-clock-время. Никаких снапшотов и runtime events в idle не публикуется.
  - При получении `startSession` `SessionFlowSystem` инициализирует `runtime state` из `SessionDefinition`, активирует первый encounter и переводит `SimulationClock` в **running**. С этого момента системы тикают по обычному update order.
  - При получении `stopSession` `SessionFlowSystem` сбрасывает `runtime state` (включая входной state из [input-commands.md](input-commands.md)) и возвращает `SimulationClock` в idle. После этого приходящие input commands отбрасываются с warning через единый log-модуль.
  - `pause`/`resume` действуют только когда сессия активна; `pause` без активной сессии — no-op с warning. Семантика `pause`/`resume` для running-состояния не меняется и описана в [simulation-timing.md](simulation-timing.md).
  - `SessionFlowSystem` обязан публиковать runtime events lifecycle: `sessionStart`, `sessionStop`, `encounterStart`, `encounterEnd`, `pause`, `resume`, и при наличии — `win`/`loss`. Для `win`/`loss` после story 024 обязательна форма `{ kind, simTime, summary }` из [session-result-summary.md](session-result-summary.md); остальные lifecycle events остаются в минимальной форме `{ kind, simTime }` до появления потребителей. При `winCondition`/`lossCondition` категории `none` ([session-definition.md](session-definition.md)) `win`/`loss` события не генерируются автоматически.

- Encounter transitions владеет `SessionFlowSystem` (это уточнение для зоны ответственности; форма `transitionRules` — в [session-definition.md](session-definition.md)):
  - проверка `transitionRules` активного encounter выполняется **один раз за тик**, после `HealthDeathSystem` (когда мёртвые сущности уже удалены и `aliveFromThisPlan` в `SpawnSystem` отражает реальность) и **до** `SnapshotExportSystem` (чтобы транзиция и связанные lifecycle-events успели до экспорта);
  - конкретное место в update order: after `DropSystem` and before `ZoneSystem` — переименование шагов не требуется, поскольку `SessionFlowSystem` уже фигурирует на шаге 2; запрет «дважды на тике» сохраняется: шаг 2 владеет `startSession`/encounter activation, отдельная фаза проверки transitions — это та же `SessionFlowSystem`, не новая система;
  - при срабатывании transition: `SessionFlowSystem` публикует `encounterEnd` для текущего encounter, выбирает следующий по `transitionRules.next` (по умолчанию sequential), активирует его (`SpawnSystem.onEncounterStart`, `ZoneSystem` инициализация, публикация `encounterStart`). Если следующего encounter нет, run завершается по `winCondition`;
  - смена encounter происходит **в одном и том же тике**: между двумя последовательными снапшотами `main` видит либо старый encounter, либо новый, без промежуточного «никакого». Это сохраняет контракт «снапшот несёт консистентное state».
- Завершение run (win/loss) владеет тем же `SessionFlowSystem`:
  - при `winCondition: { kind: 'allEncountersComplete' }` после `encounterEnd` последнего encounter `SessionFlowSystem` строит `SessionResultSummary` через `RunSummaryTracker` и публикует `win` ровно один раз;
  - при `lossCondition: { kind: 'playerDeath' }` `SessionFlowSystem` регистрирует session-level death hook на `entityKind === 'player'` ([health-and-death.md](health-and-death.md)) на старте симуляции (или сессии, в одной точке). Hook на смерть игрока публикует `loss` ровно один раз и инициирует завершение run;
  - при `winCondition: { kind: 'bossDefeated' }` death hook на босса строит `SessionResultSummary` через `RunSummaryTracker` перед публикацией terminal `win`;
  - `win`/`loss` event payload includes `summary` by [session-result-summary.md](session-result-summary.md); terminal event without summary is invalid after story 024;
  - после публикации `win` или `loss` `SessionFlowSystem` выполняет тот же сброс runtime state и перевод clock в idle, что и `stopSession`. Дальнейшие encounter transitions не выполняются. Повторное `pause`/`resume`/`input` отбрасываются с warning через единый log-модуль ([logging.md](logging.md)).

## Consequences

- Есть чёткий минимальный объём ядра без преждевременного усложнения.
- Новые режимы добавляются в основном через данные и ограниченные расширения систем.
- Требуется заранее определить update-order и формат runtime-компонентов, чтобы системы были изолированы и предсказуемы.
- Истории про бой, дроп и босса должны расширять существующие границы систем, а не размывать их под локальную задачу.

## Related

- [../docs/SCOPE.md](../docs/SCOPE.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
- [../docs/BOSS.md](../docs/BOSS.md)
- [thread-model.md](thread-model.md)
- [session-definition.md](session-definition.md)
- [simulation-timing.md](simulation-timing.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [input-commands.md](input-commands.md)
- [spawn-plan.md](spawn-plan.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [health-and-death.md](health-and-death.md)
- [snapshot-shape.md](snapshot-shape.md)
- [zone.md](zone.md)
- [enemy-contact.md](enemy-contact.md)
- [drops.md](drops.md)
- [rng.md](rng.md)
- [logging.md](logging.md)
- [boss-encounter.md](boss-encounter.md)
- [impact-feedback.md](impact-feedback.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)
- [session-result-summary.md](session-result-summary.md)
