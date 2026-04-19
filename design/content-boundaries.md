# Content Boundaries

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-19 (для истории 005 добавлены `DropArchetype` в `content library`; «таблицы дропа» из общего перечня уточнены как поле `dropTable` на `EnemyArchetype`, см. `content-archetypes.md` и `drops.md`)

## Context

Нужно отделить код рантайма от игрового контента так, чтобы новые режимы, наборы врагов и ограничения экипировки задавались через данные, а не через условные ветки в логике. Дополнительно нужно развести игровые данные и persistent client settings, чтобы пользовательские настройки не смешивались с authoritative состоянием run.

## Decision

- Разделить четыре уровня данных:
  - `content library` - долговечные описания игровых элементов;
  - `session configuration` - описание конкретного запуска;
  - `runtime state` - текущее изменяемое состояние в симуляции;
  - `client settings` - постоянные пользовательские настройки клиента.
- В `content library` хранить:
  - архетипы врагов;
  - архетипы оружия;
  - архетипы дропа;
  - профили босса;
  - параметры арены;
  - стандартные `ModePreset`.
- Форма архетипов (поля `EnemyArchetype`, `WeaponArchetype`, `DropArchetype`, минимальный `Loadout`, правила резолва по стабильному `id`) фиксируется в [content-archetypes.md](content-archetypes.md). Ссылки в `SessionDefinition`, `EncounterDefinition`, `SpawnPlan` и runtime state идут только по `id`; резолв `id → archetype` выполняется один раз при сборке/старте сессии.
- «Таблицы дропа» не выделены в отдельную сущность с собственным `id`: одна таблица — поле `dropTable: ReadonlyArray<DropTableEntry>` на `EnemyArchetype` (см. [content-archetypes.md](content-archetypes.md)). Правила выбора и lifecycle дропа — в [drops.md](drops.md). Если в будущем понадобится шаринг таблиц между врагами, это будет отдельным решением (ссылка по `dropTableId` поверх существующего поля), не «дописыванием по месту».
- В `session configuration` хранить:
  - выбранный preset;
  - `SessionDefinition`;
  - пользовательские modifiers;
  - derived tuning для конкретного запуска.
- В `runtime state` хранить:
  - живые сущности;
  - текущие HP, кулдауны, позиции, таймеры;
  - активный `encounter`;
  - прогресс волны;
  - активные drop-объекты;
  - внутренние RNG-состояния и runtime-флаги.
- В `client settings` хранить:
  - громкость;
  - quality/render-scale policy;
  - UI-level preferences, не влияющие на правила симуляции;
  - сохранённые значения для следующего запуска приложения.
- `content library` должно быть read-only во время сессии.
- `SessionDefinition` после старта сессии тоже считать immutable.
- Любые изменения во время игры должны применяться только к `runtime state`.
- Builder-функции могут читать `content library` и пользовательские опции, но их выходом всегда должен быть новый `SessionDefinition`.
- `client settings` не являются частью `SessionDefinition`.
- `client settings` не влияют на authoritative simulation state и не должны менять исход run с тем же `seed`.
- `client settings` могут влиять на audio mix, render backend policy, render scale и другие клиентские presentation-решения.
- Применение `client settings` находится на стороне `main thread` и render/audio layers, а не в gameplay runtime.

## Consequences

- Проще дебажить, какие проблемы вызваны контентом, а какие логикой исполнения.
- Появляется чистая граница между режимом "что запускаем" и состоянием "что уже происходит в матче".
- Упрощается сериализация debug-состояния и повторяемость запуска через `seed`.
- Истории про настройки не должны встраивать persistent preferences в модель игровой сессии.

## Related

- [session-definition.md](session-definition.md)
- [runtime-systems.md](runtime-systems.md)
- [content-archetypes.md](content-archetypes.md)
- [spawn-plan.md](spawn-plan.md)
- [drops.md](drops.md)
