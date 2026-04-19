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
- Сетевой код, сохранения, сложный инвентарь, крафт и полноценная мод-система не входят в MVP runtime.
- Отдельный физический движок не использовать; коллизии и overlap-проверки остаются кастомными и 2D-ориентированными.
- Все системы должны быть управляемы через `SessionDefinition` и runtime state, а не через прямые условные ветки по названию режима.

## Consequences

- Есть чёткий минимальный объём ядра без преждевременного усложнения.
- Новые режимы добавляются в основном через данные и ограниченные расширения систем.
- Требуется заранее определить update-order и формат runtime-компонентов, чтобы системы были изолированы и предсказуемы.

## Related

- [../docs/SCOPE.md](../docs/SCOPE.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
- [../docs/BOSS.md](../docs/BOSS.md)
- [thread-model.md](thread-model.md)
- [session-definition.md](session-definition.md)
