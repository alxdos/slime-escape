# Runtime Systems

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-19

## Context

Для MVP нужен компактный `core runtime`, который поддерживает кампанию, тренировки и challenge-режимы, но не разрастается в общий "движок на все случаи". Системы должны покрывать текущий дизайн из `docs/` и работать внутри `simulation worker`.

## Decision

- Минимальный набор систем `core runtime`:
  - `SimulationClock` - фиксированный тик, пауза, timescale;
  - `SessionFlowSystem` - старт сессии, смена `encounter`, победа, поражение;
  - `EntityStore` - хранение и жизненный цикл runtime-сущностей;
  - `SpatialIndex` - быстрый поиск соседей для врагов, пуль и дропа;
  - `MovementSystem` - перемещение игрока, врагов, снарядов;
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
  - `SessionFlowSystem` решает, какой encounter активен, когда run завершается и какие session-level events публикуются;
  - `SpawnSystem` только исполняет `spawnPlan` и не принимает решений о победе или поражении;
  - `MovementSystem` меняет позиции и базовую кинематику, но не применяет урон;
  - `CombatSystem` создаёт выстрелы, вычисляет попадания и формирует damage intents;
  - `HealthDeathSystem` единственный слой, который применяет финальную потерю HP, фиксирует смерть и удаляет сущности;
  - `DropSystem` реагирует на death hooks и управляет только жизненным циклом дропа;
  - `ZoneSystem` управляет состоянием зоны и её экспортом, но не завершает encounter самостоятельно;
  - `BossPhaseSystem` управляет фазами и boss-specific attack rules, не подменяя `SessionFlowSystem`.
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
