# Session Definition

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-19

## Context

Игровой runtime должен запускать не один жёстко зашитый сценарий, а внешне заданную сессию. Это нужно для базовой кампании, тренировок, challenge-режимов и будущих вариаций без переписывания `core runtime`.

## Decision

- `core runtime` не знает о конкретном сценарии вроде "3 волны и затем босс".
- Каждый запуск описывается объектом `SessionDefinition`.
- `SessionDefinition` собирается снаружи из `ModePreset`, пользовательских опций и `content library`.
- Базовый набор полей `SessionDefinition`:

```js
{
  id,
  seed,
  arena,
  player,
  loadout,
  modifiers,
  encounters,
  rules,
  winCondition,
  lossCondition,
  uiMeta
}
```

- `encounters` - это упорядоченный список `EncounterDefinition`.
- Базовый набор полей `EncounterDefinition`:

```js
{
  id,
  type,          // wave | break | boss | survivalTimer | sandbox
  spawnPlan,
  zoneBehavior,
  objectives,
  rewardRules,
  transitionRules,
  tuning
}
```

- `spawnPlan` описывает допустимые типы врагов, группы спавна, интервалы и лимиты, а не конкретный код спавна.
- `zoneBehavior` задаётся как конфиг режима зоны: отключена, линейное сжатие, фиксированное окно, пользовательские параметры.
- `objectives` должны покрывать как минимум: очистка врагов, выживание по таймеру, убийство босса, переход по внешнему условию.
- `ModePreset` - это внешний preset, который готовит дефолтную сессию, но не исполняется сам по себе.
- Минимальные preset-режимы:
  - `campaign` - 3 волны, передышки, финальный босс;
  - `training` - волны без босса, состав задаётся снаружи;
  - `pistolOnly` - стартовая экипировка ограничена пистолетом.
- Пользовательские challenge-ограничения добавлять через `modifiers`, а не отдельными ветками в runtime.

## Consequences

- Базовая кампания становится одним из preset-режимов, а не специальным режимом в коде.
- Тренировки и челленджи можно запускать без fork логики рантайма.
- Появляется единая точка входа для UI: экран выбора режима должен собирать `SessionDefinition`, а затем передавать её в runtime.
- Контроль сложности и контента переносится в данные и builder-функции.

## Related

- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [../docs/WAVES_AND_SCALING.md](../docs/WAVES_AND_SCALING.md)
- [../docs/BOSS.md](../docs/BOSS.md)
- [thread-model.md](thread-model.md)
- [content-boundaries.md](content-boundaries.md)
