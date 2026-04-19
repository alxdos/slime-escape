# Session Definition

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-19 (формализованы `ZoneBehavior` и `TransitionRules`; активированы `winCondition: allEncountersComplete` и `lossCondition: playerDeath`; preset `training` зафиксирован как режим истории 004; добавлено обязательное поле `maxHp` в `player`)

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
  - `player` — стартовое описание игрока в виде `{ position: { x, y }, radius, maxSpeed, maxHp }`, где координаты и радиус — в world-units, скорость — в world-units в секунду, `maxHp` — целое > 0 (источник `HasHealth` из [health-and-death.md](health-and-death.md)). Для preset, в которых игрок не damageable (sandbox без боя), `maxHp` всё равно задаётся явно — отсутствие поля запрещено по тому же правилу «без двух разных «нет данных», что и для других обязательных полей. Дополнительные поля (статус-эффекты, инвентарь) могут добавляться отдельными решениями без слома верхнеуровневой модели.
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

- `spawnPlan` описывает данные для `SpawnSystem`, а не конкретный код спавна. Форма `spawnPlan` (дискриминированный union, набор `kind`, правила расширения, `'empty'`/`'static'`/`'wave'`) фиксируется отдельным решением [spawn-plan.md](spawn-plan.md). Будущие категории (`'boss'` и т.п.) добавляются туда же новыми `kind`, без изменения этого файла.
- `zoneBehavior` — дискриминированный union по `kind`. Конкретная семантика и поведение `ZoneSystem` фиксируются в [zone.md](zone.md); этот файл закрепляет только форму поля и набор `kind`:
  - `{ kind: 'disabled' }` — зона отступлена и не двигается, `margin = 0` весь encounter;
  - `{ kind: 'shrinkLinear'; fromMargin: number; toMargin: number; durationMs: number }` — линейное сжатие за `durationMs`, `from`/`to` в `[0, maxMargin]`, `durationMs > 0`;
  - `{ kind: 'expandLinear'; fromMargin: number; toMargin: number; durationMs: number }` — линейное расширение, та же форма полей.
  Расширения (per-side, окружность, нелинейные кривые) — отдельные решения и новые `kind`, не «дописывание» существующих.
- `objectives` описывают, что должно быть достигнуто внутри encounter. На горизонт MVP `objectives` остаётся зарезервированным полем без обязательной формы; принятие решения о завершении encounter принадлежит `transitionRules`. Минимальные смысловые категории, ожидаемые в будущем: очистка врагов, выживание по таймеру, убийство босса, переход по внешнему условию.
- `transitionRules` описывают, когда encounter завершается и что происходит дальше. Дискриминированный union по `kind`; набор `kind` на горизонт MVP:
  - `{ kind: 'never' }` — encounter не завершается автоматически (sandbox);
  - `{ kind: 'allEnemiesCleared' }` — encounter завершается, когда `SpawnSystem` диспатчил все запланированные сущности и в `EntityStore` не осталось ни одной живой сущности из `aliveFromThisPlan` ([spawn-plan.md](spawn-plan.md)). Для `spawnPlan: { kind: 'empty' }` это правило срабатывает мгновенно — намеренно: пустые wave-encounter без спавна не должны блокировать flow;
  - `{ kind: 'timer'; durationMs: number }` — encounter завершается, когда `simTime − encounterStartSimMs >= durationMs`. Используется для `break`-encounter (передышек).
  Дополнительно у `transitionRules` есть стабильное поле `next: 'sequential' | { kind: 'byId'; id: string }`. По умолчанию `'sequential'` — следующий encounter берётся по индексу из `SessionDefinition.encounters`. Если следующего нет, encounter считается **последним**, и `SessionFlowSystem` инициирует завершение run согласно `winCondition` (см. ниже).
  Опциональные «передышка между encounter» и «runtime events на переходе» намеренно не вводятся в форму `transitionRules`: первая выражается отдельным `break`-encounter с `transitionRules: { kind: 'timer' }`, вторые покрываются уже зафиксированными lifecycle-events `encounterStart`/`encounterEnd` ([runtime-systems.md](runtime-systems.md)).
- `winCondition` и `lossCondition` задаются на уровне всей сессии, а не отдельных story-реализаций.
- Минимальные категории `winCondition`: `{ kind: 'allEncountersComplete' }`, `{ kind: 'bossDefeated' }`, `{ kind: 'scenarioCondition' }`, **`{ kind: 'none' }`** — у сессии в принципе нет автоматического условия победы (sandbox, free-roam, dev-режимы).
- Минимальные категории `lossCondition`: `{ kind: 'playerDeath' }`, `{ kind: 'timerOrScenarioFail' }`, `{ kind: 'forced' }`, **`{ kind: 'none' }`** — у сессии нет автоматического условия поражения (sandbox; завершение возможно только через `stopSession`).
- `winCondition` и `lossCondition` остаются обязательными полями `SessionDefinition`. Категория `none` задаётся явно, чтобы исключить «забыл выставить условие» от «осознанно условия нет». `SessionFlowSystem` ([runtime-systems.md](runtime-systems.md)) при категории `none` не должен генерировать соответствующее win/loss событие самостоятельно.
- Семантика активных категорий, реализуемая `SessionFlowSystem`:
  - `winCondition: { kind: 'allEncountersComplete' }` — `win` публикуется ровно один раз, после `encounterEnd` последнего encounter в `encounters` (когда `transitionRules.next` упирается в «следующего нет»);
  - `winCondition: { kind: 'bossDefeated' }` — оставлено зарезервированным для 006; конкретный путь (death hook на босса) фиксируется в истории/решении 006;
  - `lossCondition: { kind: 'playerDeath' }` — `SessionFlowSystem` регистрирует session-level death hook, реагирующий на `entityKind === 'player'` ([health-and-death.md](health-and-death.md)), и публикует `loss` ровно один раз;
  - после публикации `win` или `loss` `SessionFlowSystem` корректно завершает run: дальнейшие encounter transitions не выполняются, clock переводится в idle, runtime state сбрасывается тем же путём, что и при `stopSession`. Дальнейший запуск возможен только через новый `startSession`.
- `win`/`loss` события — единственный способ, которым `main` узнаёт об автоматическом завершении сессии. Параллельно с публикацией события `SessionFlowSystem` обязан вызвать тот же сброс runtime state, что и `stopSession`, чтобы `main` мог реагировать на событие без явного `stopSession` в ответ. Конкретная форма событий — в [snapshot-shape.md](snapshot-shape.md).
- `ModePreset` - это внешний preset, который готовит дефолтную сессию, но не исполняется сам по себе.
- Минимальные preset-режимы:
  - `campaign` - 3 волны, передышки, финальный босс;
  - `training` - короткий тренировочный забег без босса. На горизонт истории 004 фиксируется минимальная форма: ровно два wave-encounter с break-encounter между ними (`wave1 → break → wave2`), `loadout: { primaryWeaponArchetypeId }`, `winCondition: { kind: 'allEncountersComplete' }`, `lossCondition: { kind: 'playerDeath' }`. Конкретные числовые параметры волн (состав, темп, лимит, длительность break, числа `zoneBehavior`) — содержимое `content library` ([content-boundaries.md](content-boundaries.md)) и не часть этого решения. Расширение `training` на 3+ волн или другую структуру допустимо без правки этого файла, если форма preset-id остаётся прежней;
  - `pistolOnly` - стартовая экипировка ограничена пистолетом;
  - `sandbox` - один encounter типа `sandbox` без win/loss-условий и без встроенного оружия (`loadout: null`), используется для bring-up историй, не требующих боевого стека;
  - `sandbox-with-combat` - вариант sandbox, у которого есть `Loadout` (минимально — `{ primaryWeaponArchetypeId }`) и `spawnPlan: { kind: 'static' }` для bring-up боевых сущностей (например, тренировочной мишени из [../stories/003-combat-foundation.md](../stories/003-combat-foundation.md)). Соблюдает все правила sandbox-encounter ниже: `winCondition: none`, `lossCondition: none`, единственный способ выйти — внешний `stopSession`.
- Список «Минимальных preset-режимов» расширяется по мере появления историй; новые preset-режимы фиксируются в этом файле и не вводятся «по месту» в `src/shared/content/**`. Удаление существующего preset-id оформляется через `superseded`/обновление этого файла.
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
- [zone.md](zone.md)
- [health-and-death.md](health-and-death.md)
- [snapshot-shape.md](snapshot-shape.md)
