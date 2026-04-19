# Runtime Systems

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-19 (уточнён `SpatialIndex`, явные ссылки на `spawn-plan.md`, `projectiles-and-combat.md`, `health-and-death.md`)

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
  - `DropSystem` - спавн, время жизни и подбор дропа;
  - `BossPhaseSystem` - переходы фаз и атаки босса;
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
  8. `DropSystem`;
  9. `ZoneSystem`;
  10. `SnapshotExportSystem`.
- Допускается локальная перестройка порядка при прототипировании, но только если сохраняется общий принцип: сначала управляющие правила encounter, затем симуляция действия, затем последствия смерти/дропа, затем экспорт состояния.
- Сетевой код, сохранения, сложный инвентарь, крафт и полноценная мод-система не входят в MVP runtime.
- Отдельный физический движок не использовать; коллизии и overlap-проверки остаются кастомными и 2D-ориентированными.
- Все системы должны быть управляемы через `SessionDefinition` и runtime state, а не через прямые условные ветки по названию режима.
- Границы ответственности систем:
  - `SessionFlowSystem` решает, какой encounter активен, когда run завершается и какие session-level events публикуются; владеет lifecycle сессии (см. ниже);
  - `SpawnSystem` только исполняет `spawnPlan` и не принимает решений о победе или поражении; форма `spawnPlan` и его исполнение — в [spawn-plan.md](spawn-plan.md);
  - `MovementSystem` меняет позиции и базовую кинематику **управляемых актёров** (игрок, враги с поведением), но не применяет урон; владеет инвариантом «сущность не выходит за границы арены» ([arena-and-coordinates.md](arena-and-coordinates.md)) и читает границы из активного `SessionDefinition.arena`, а не из глобальной константы; снаряды живут вне `MovementSystem` (см. [projectiles-and-combat.md](projectiles-and-combat.md));
  - `CombatSystem` создаёт выстрелы, двигает снаряды, вычисляет попадания и формирует damage intents; полный контракт — [projectiles-and-combat.md](projectiles-and-combat.md);
  - `HealthDeathSystem` единственный слой, который применяет финальную потерю HP, фиксирует смерть и удаляет damageable-сущности; полный контракт — [health-and-death.md](health-and-death.md);
  - `SpatialIndex` — внутренний помощник систем (`CombatSystem`, `DropSystem`, при необходимости `BossPhaseSystem`); см. ниже минимальный контракт;
  - `DropSystem` реагирует на death hooks и управляет только жизненным циклом дропа;
  - `ZoneSystem` управляет состоянием зоны и её экспортом, но не завершает encounter самостоятельно;
  - `BossPhaseSystem` управляет фазами и boss-specific attack rules, не подменяя `SessionFlowSystem`.
- `SpatialIndex` — минимальный контракт уровня архитектуры:
  - используется как акселератор соседских запросов и не является источником истины: исходное состояние сущностей живёт в `EntityStore`;
  - перестраивается каждый тик из текущего `EntityStore` после фаз, которые могут менять позиции (`MovementSystem`, фаза движения снарядов в `CombatSystem`);
  - минимальный API — два запроса: «соседи в радиусе вокруг точки» и «соседи в осевом прямоугольнике»;
  - гранулярность — единый индекс на тик с фильтрацией по `kind` на стороне вызова; раздельные индексы по `kind` — деталь реализации, не контракт;
  - `SpatialIndex` не публикует runtime events и не мутирует сущности.
- `death hooks` должны срабатывать после того, как `HealthDeathSystem` зафиксировал смерть сущности, но до финального экспорта снапшота. Минимальные потребители death hooks:
  - `DropSystem`;
  - session-level статистика и progression;
  - runtime events для HUD/аудио/debug.
- Runtime events должны порождаться системами, которые владеют фактом события:
  - `SessionFlowSystem` - pause/resume, encounter start/end, win/loss;
  - `CombatSystem` - fire/hit;
  - `HealthDeathSystem` - death;
  - `DropSystem` - spawn/pickup/expire;
  - `BossPhaseSystem` - phase change.
- `SnapshotExportSystem` не создаёт новую gameplay-логику; он только агрегирует уже рассчитанное состояние и нужные HUD-поля.
- Lifecycle симуляции относительно сессии:
  - `simulation worker` создаётся один раз при старте приложения и переиспользуется между сессиями ([thread-model.md](thread-model.md)); `stopSession` не приводит к `worker.terminate()`.
  - `SimulationClock` стартует в режиме **idle**: пока нет активной сессии, он не продвигает `simTime` и не вызывает обновление систем. В idle-режиме pump может выполняться, но его единственное действие — стабилизировать аккумулятор и не «копить» wall-clock-время. Никаких снапшотов и runtime events в idle не публикуется.
  - При получении `startSession` `SessionFlowSystem` инициализирует `runtime state` из `SessionDefinition`, активирует первый encounter и переводит `SimulationClock` в **running**. С этого момента системы тикают по обычному update order.
  - При получении `stopSession` `SessionFlowSystem` сбрасывает `runtime state` (включая входной state из [input-commands.md](input-commands.md)) и возвращает `SimulationClock` в idle. После этого приходящие input commands отбрасываются с warning через единый log-модуль.
  - `pause`/`resume` действуют только когда сессия активна; `pause` без активной сессии — no-op с warning. Семантика `pause`/`resume` для running-состояния не меняется и описана в [simulation-timing.md](simulation-timing.md).
  - `SessionFlowSystem` обязан публиковать runtime events lifecycle: `sessionStart`, `sessionStop`, `encounterStart`, `encounterEnd`, `pause`, `resume`, и при наличии — `win`/`loss`. Конкретный набор полей этих events фиксируется по мере появления потребителей (HUD из 007, audio из 008); до этого допускается публиковать минимальную форму `{ kind, simTime }`. При `winCondition`/`lossCondition` категории `none` ([session-definition.md](session-definition.md)) `win`/`loss` события не генерируются автоматически.

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
