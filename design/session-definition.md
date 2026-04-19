# Session Definition

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-19 (формализация `Loadout`; вынос `spawnPlan` в `spawn-plan.md`; sandbox-encounter допускает `static`-план)

## Context

Игровой runtime должен запускать не один жёстко зашитый сценарий, а внешне заданную сессию. Это нужно для базовой кампании, тренировок, challenge-режимов и будущих вариаций без переписывания `core runtime`.

## Decision

- `core runtime` не знает о конкретном сценарии вроде "3 волны и затем босс".
- Каждый запуск описывается объектом `SessionDefinition`.
- `SessionDefinition` собирается снаружи из `ModePreset`, пользовательских опций и `content library`.
- `ModePreset` задаёт дефолтную форму режима, но не является authoritative runtime-объектом.
- Пользовательские опции и challenge-ограничения модифицируют preset на этапе сборки сессии, после чего runtime получает только итоговый `SessionDefinition`.
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
- `SessionDefinition` после старта сессии считается immutable runtime-контрактом.
- Стабильными частями контракта считаются имена верхнеуровневых полей, общий смысл `EncounterDefinition`, а также модели `winCondition` / `lossCondition`.
- Допускается эволюция внутренних структур вроде `spawnPlan`, `rewardRules` и `tuning`, если она не ломает верхнеуровневую модель сборки сессии.
- Минимальная форма обязательных полей:
  - `arena` — прямоугольник `{ width, height }` в world-units (см. [arena-and-coordinates.md](arena-and-coordinates.md)). Конкретные значения задаются в `content library` ([content-boundaries.md](content-boundaries.md)).
  - `player` — стартовое описание игрока в виде `{ position: { x, y }, radius, maxSpeed }`, где координаты и радиус — в world-units, скорость — в world-units в секунду. Дополнительные поля (HP, статус-эффекты, инвентарь) могут добавляться отдельными решениями без слома верхнеуровневой модели.
  - `seed` — целочисленное значение, единственный источник детерминизма для RNG в симуляции; источники недетерминированного времени/случайности вне `seed` запрещены.
  - `id` — стабильный строковый идентификатор сессии для логов и debug.
- Поля `loadout`, `modifiers`, `rules`, `uiMeta` остаются в контракте как стабильные имена; их внутренняя структура и обязательность зависят от preset и могут эволюционировать. Builder обязан явно выставить осмысленное значение или `null`/пустой объект — отсутствие поля как такового запрещено, чтобы потребители не разбирали два разных «нет данных».
- Минимальная форма `loadout`:
  - `null` — у preset-а нет встроенного оружия (sandbox без боя, чисто исследовательские bring-up);
  - `Loadout` — preset имеет хотя бы основное оружие; форма `Loadout` фиксируется в [content-archetypes.md](content-archetypes.md). На горизонт MVP это `{ primaryWeaponArchetypeId: string }`; расширения (вторичное оружие, granat-слот, пассивные модификаторы) добавляются дописыванием полей.
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

- `spawnPlan` описывает данные для `SpawnSystem`, а не конкретный код спавна. Форма `spawnPlan` (дискриминированный union, набор `kind`, правила расширения, минимальные `'empty'` и `'static'`) фиксируется отдельным решением [spawn-plan.md](spawn-plan.md). Будущие категории (групповые волны, лимиты одновременно живых, групповые залпы и т.п.) добавляются туда же новыми `kind`, без изменения этого файла.
- `zoneBehavior` задаётся как конфиг режима зоны: отключена, линейное сжатие, фиксированное окно, пользовательские параметры.
- `objectives` описывают, что должно быть достигнуто внутри encounter. Минимальный набор: очистка врагов, выживание по таймеру, убийство босса, переход по внешнему условию.
- `transitionRules` описывают, когда и как encounter завершается и что происходит дальше. На минимальном уровне они должны покрывать:
  - условие завершения encounter;
  - целевой следующий encounter или правило "следующий по списку";
  - опциональную задержку/передышку между encounter;
  - runtime events, которые должны быть сгенерированы при переходе.
- `winCondition` и `lossCondition` задаются на уровне всей сессии, а не отдельных story-реализаций.
- Минимальные категории `winCondition`: завершены все обязательные encounter, убит босс, выполнено цельное сценарное условие, **`none`** — у сессии в принципе нет автоматического условия победы (sandbox, free-roam, dev-режимы).
- Минимальные категории `lossCondition`: смерть игрока, провал по таймеру/сценарному условию, явное принудительное завершение run, **`none`** — у сессии нет автоматического условия поражения (sandbox; завершение возможно только через `stopSession`).
- `winCondition` и `lossCondition` остаются обязательными полями `SessionDefinition`. Категория `none` задаётся явно, чтобы исключить «забыл выставить условие» от «осознанно условия нет». `SessionFlowSystem` ([runtime-systems.md](runtime-systems.md)) при категории `none` не должен генерировать соответствующее win/loss событие самостоятельно.
- `ModePreset` - это внешний preset, который готовит дефолтную сессию, но не исполняется сам по себе.
- Минимальные preset-режимы:
  - `campaign` - 3 волны, передышки, финальный босс;
  - `training` - волны без босса, состав задаётся снаружи;
  - `pistolOnly` - стартовая экипировка ограничена пистолетом;
  - `sandbox` - один encounter типа `sandbox` без win/loss-условий, используется для bring-up историй и dev-режимов.
- Encounter типа `sandbox` имеет следующую минимальную форму:
  - `spawnPlan` — `{ kind: 'empty' }` или `{ kind: 'static' }` (см. [spawn-plan.md](spawn-plan.md)); другие `kind` (`'wave'`, `'boss'`, …) в sandbox-encounter запрещены, потому что подразумевают автоматические переходы и завершение, которые sandbox-семантика исключает.
  - `objectives` — пустой список или эквивалентный «целей нет».
  - `transitionRules` — правило «encounter не завершается автоматически»; единственный способ выйти из sandbox-сессии — внешний `stopSession`.
  - `zoneBehavior`, `rewardRules`, `tuning` могут быть пустыми/нейтральными.
  - Sandbox-сессия обязана иметь `winCondition: none` и `lossCondition: none`; иные комбинации с sandbox-encounter-ом запрещены, так как они недостижимы по семантике.
  - Static-спавн в sandbox-encounter оправдан как bring-up: тренировочные сущности для разработки систем (например, мишень в 003), а не игровой контент.
- Пользовательские challenge-ограничения добавлять через `modifiers`, а не отдельными ветками в runtime.
- Базовая кампания остаётся preset-режимом. Конкретная форма списка encounter-ов для кампании может эволюционировать, но должна описываться данными сессии, а не логикой `SessionFlowSystem`.

## Consequences

- Базовая кампания становится одним из preset-режимов, а не специальным режимом в коде.
- Тренировки и челленджи можно запускать без fork логики рантайма.
- Появляется единая точка входа для UI: экран выбора режима должен собирать `SessionDefinition`, а затем передавать её в runtime.
- Контроль сложности и контента переносится в данные и builder-функции.
- Истории больше не должны самостоятельно определять модель завершения run или структуру переходов, если это устойчивое правило уровня runtime.

## Related

- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [../docs/WAVES_AND_SCALING.md](../docs/WAVES_AND_SCALING.md)
- [../docs/BOSS.md](../docs/BOSS.md)
- [thread-model.md](thread-model.md)
- [content-boundaries.md](content-boundaries.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [runtime-systems.md](runtime-systems.md)
- [spawn-plan.md](spawn-plan.md)
- [content-archetypes.md](content-archetypes.md)
