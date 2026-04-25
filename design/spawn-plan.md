# Spawn Plan

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-25 (story 019: per-`seq` записи `'static'` и `'wave'` получают optional `override?: SpawnOverride`; форма и семантика override — [spawn-overrides.md](spawn-overrides.md). Earlier: 2026-04-23 static/boss builder-fit уточнён до `contactBox` для `enemy` / `boss`; ранее: кампания: break перед боссом, спавн босса сверху по центру; `'boss'` kind для 006)

## Context

[session-definition.md](session-definition.md) фиксирует, что у каждого `EncounterDefinition` есть поле `spawnPlan`, которое исполняет `SpawnSystem` ([runtime-systems.md](runtime-systems.md)), но не задаёт ни форму `SpawnPlan`, ни правила его расширения. Без явного контракта:

- история 003 (тренировочная мишень) и история 004 (волны) переоткроют форму `spawnPlan` каждая по-своему;
- история 006 (босс) добавит ещё одну форму, не совместимую с предыдущими;
- `SpawnSystem` начнёт ветвиться по фактическим режимам, а не по данным;
- любая смена представления плана сломает несколько историй разом.

В `src/shared/session.ts` сейчас `SpawnPlan = { kind: 'empty' }` — это заглушка под sandbox из 002, не контракт.

## Decision

### Форма SpawnPlan

- `SpawnPlan` — дискриминированный union с полем `kind`. Расширение происходит **добавлением** новых `kind`, а не изменением существующих полей.
- Набор `kind` на момент 006:
  - `'empty'` — спавнов нет; `SpawnSystem` ничего не делает;
  - `'static'` — фиксированный список спавнов, исполняемый один раз при старте encounter;
  - `'wave'` — счётный «бюджет» спавнов с темпом и лимитом одновременно живых, исполняемый по тикам в течение encounter;
  - `'boss'` — один спавн одной сущности босса при старте encounter ([boss-encounter.md](boss-encounter.md)).
- Дальнейшие `kind` фиксируются в этом же файле по мере добавления историй.
- `kind` запрещено переиспользовать с изменённой семантикой; устаревшая форма проходит через `superseded` так же, как design-решения.

### Static spawn

- Форма:
  ```ts
  type StaticSpawnPlan = {
    kind: 'static';
    spawns: ReadonlyArray<{
      archetypeId: string;     // EnemyArchetype.id из content library
      position: { x: number; y: number };  // wu, центр сущности
      override?: SpawnOverride;            // см. spawn-overrides.md
    }>;
  };
  ```
- Семантика:
  - список выполняется **один раз** при старте encounter;
  - порядок исполнения соответствует порядку в массиве — это даёт стабильные `id` при детерминированной сборке `SessionDefinition`;
  - повторных спавнов и респавнов нет;
  - `position` обязан попадать внутрь арены ([arena-and-coordinates.md](arena-and-coordinates.md)); для `enemy` builder проверяет влезание по полному `contactBox`, а не по legacy `radius`, чтобы статический spawn не выпускал прямоугольное тело за границы арены;
  - архетипы резолвятся через `content library` ([content-archetypes.md](content-archetypes.md), [content-boundaries.md](content-boundaries.md));
  - `override` — optional «контекст появления» этого конкретного спавна (`guaranteedDrops`, `dropTable`, `retaliation`); форма, семантика replace/add, момент применения и валидация фиксируются в [spawn-overrides.md](spawn-overrides.md). `SpawnSystem` материализует override один раз в момент спавна, после чего runtime-сущность ничем не отличается от спавна без override.

### Wave spawn

- Форма:
  ```ts
  type WaveSpawnPlan = {
    kind: 'wave';
    spawns: ReadonlyArray<{
      archetypeId: string;     // EnemyArchetype.id из content library
      override?: SpawnOverride;             // см. spawn-overrides.md
    }>;
    spawnIntervalMs: number;   // > 0; минимальный интервал между двумя спавнами этого плана
    maxAlive: number;          // > 0; верхний предел одновременно живых сущностей, заспавненных этим планом
    edgeMargin?: number;       // wu, >= 0; отступ от внутренней кромки арены при выборе позиции; default 0
  };
  ```
- `override` per-`seq` — единственный способ, которым `WaveSpawnPlan` несёт «контекст появления» (`guaranteedDrops`, `dropTable`, `retaliation`); общих per-encounter override-полей у плана нет (см. [spawn-overrides.md](spawn-overrides.md), раздел «Что запрещено вводить «по месту» в 019»). Применяется при материализации сущности тем же `SpawnSystem`-механизмом, что и для `'static'`.
- Семантика:
  - `spawns` — упорядоченный счётный «бюджет» спавнов; план **завершает диспатч**, когда все элементы выпущены, и больше не спавнит;
  - на каждом тике `SpawnSystem` спавнит **не более одной** сущности из плана при выполнении всех условий:
    1. `dispatched < spawns.length`;
    2. `aliveFromThisPlan < maxAlive`;
    3. `simTime − lastSpawnSimMs >= spawnIntervalMs` (на старте encounter `lastSpawnSimMs = -∞`, то есть первый спавн возможен на первом же тике);
  - `aliveFromThisPlan` отслеживается `SpawnSystem` через death hook ([health-and-death.md](health-and-death.md)): при смерти сущности, которую спавнил этот план, счётчик уменьшается. Связь «сущность ↔ план» хранится во внутреннем state `SpawnSystem` (например, `Set<EntityId>`), а не как поле сущности — это деталь реализации;
  - порядок выборки архетипов из `spawns` — **строго по индексу**: первый тик-кандидат берёт `spawns[0]`, второй — `spawns[1]` и т. д. Это даёт воспроизводимость по `seed` и оставляет «состав волны» полностью контентным;
  - позиция каждого спавна выбирается на **периметре арены** через session RNG ([rng.md](rng.md)) детерминированно от `seed`. Алгоритм: одно `rng.nextFloat()` даёт нормированную координату вдоль периметра прямоугольника `arena` ([arena-and-coordinates.md](arena-and-coordinates.md)), сжатого внутрь на `edgeMargin + archetype.radius`, чтобы заспавненная сущность гарантированно влезала в безопасные границы. Это правило `SpawnSystem` соблюдает само; `WaveSpawnPlan` не содержит явных координат;
  - на `encounterEnd` весь wave-state (`dispatched`, `aliveFromThisPlan`, `lastSpawnSimMs`, индексы заспавненных сущностей) сбрасывается; «остатки бюджета» между encounter не переносятся.
- Wave-план **не определяет**, когда encounter завершается. Решение «волна закончилась» принимает `SessionFlowSystem` через `transitionRules` ([session-definition.md](session-definition.md)); правило `allEnemiesCleared` соблюдается как раз тогда, когда `dispatched == spawns.length && aliveFromThisPlan == 0`.
- `SpawnSystem` для `'wave'` детерминирован относительно `seed`: при одинаковом `seed` и одинаковой последовательности тиков порядок и позиции спавнов идентичны. Это явно покрывается тестом по [testing.md](testing.md).

### Boss spawn

- Форма:
  ```ts
  type BossSpawnPlan = Readonly<{
    kind: 'boss';
    bossArchetypeId: string;          // BossArchetype.id из реестра bosses в content library
    position: { x: number; y: number }; // wu, центр сущности босса
  }>;
  ```
- Семантика:
  - выполняется **один раз** при `encounterStart`;
  - создаётся **ровно одна** сущность `kind: 'boss'` с `HasHealth`, инициализированная из `BossArchetype` ([content-archetypes.md](content-archetypes.md), [boss-encounter.md](boss-encounter.md));
  - `SpawnSystem` ведёт учёт этой сущности для `aliveFromThisPlan` так же, как для `'wave'`/`'static'`: смерть босса уменьшает счётчик; при `allEnemiesCleared` encounter с `spawnPlan.kind: 'boss'` завершается, когда босс мёртв и план не ожидает дальнейших спавнов (для `'boss'` это эквивалентно «босс убит»);
  - `position` обязан попадать внутрь арены ([arena-and-coordinates.md](arena-and-coordinates.md)); builder проверяет fit по полному `contactBox` босса, а не по `radius`; для пресета кампании босс ставится **сверху по центру** (x = 0, y = верхняя полоса с inset как у `edgeMargin` волны), а не в геометрическом центре поля;
  - повторных спавнов по тикам нет.

### Ответственность SpawnSystem

- `SpawnSystem` исполняет `spawnPlan` активного encounter и больше ничего:
  - не принимает решений о `winCondition`/`lossCondition` ([session-definition.md](session-definition.md));
  - не управляет переходами encounter — это `SessionFlowSystem` ([runtime-systems.md](runtime-systems.md));
  - не владеет HP, кулдаунами, поведением врагов — это другие системы.
- Жизненный цикл:
  - на `encounterStart` `SpawnSystem` инициализируется под текущий `spawnPlan`;
  - дальнейшая логика спавна (для `'wave'` и т.п.) исполняется внутри обычного update-tick по [runtime-systems.md](runtime-systems.md);
  - на `encounterEnd` весь внутренний state `SpawnSystem` сбрасывается; «остатки плана» не переносятся между encounter.
- Все спавны проходят через `EntityStore` (см. [runtime-systems.md](runtime-systems.md)); `SpawnSystem` не создаёт сущности «в обход» store.
- `SpawnSystem` детерминирован относительно `seed` сессии: единственный источник случайности — session RNG ([rng.md](rng.md)). `Math.random` запрещён ([session-definition.md](session-definition.md)).

### Расширение и обратная совместимость

- Новый `kind` обязан задаваться отдельным разделом этого файла, со своим описанием полей и поведения.
- `SpawnSystem` обязан явно отвергать неизвестный `kind` через `assertNever` (см. [web-stack.md](web-stack.md), `src/shared/protocol.ts`); молчаливое игнорирование запрещено.
- При необходимости заменить существующую форму (например, упрощение `'wave'`) старый `kind` помечается как deprecated в этом файле и удаляется одним PR с обновлением всех использований в `content/`.

## Consequences

- `SpawnSystem` появляется уже в 003, но в минимальной форме «исполнить статический список»; история 004 расширяет систему `'wave'` kind, а не вводит новую.
- Содержимое волны (порядок и состав архетипов) полностью контентное; геймплейные числа волн (темп, лимит) — поля плана, а не константы в коде систем.
- Позиции спавнов на периметре полностью детерминированы по `seed`: тест на воспроизводимость выражается через равенство списков `(archetypeId, position)` для двух прогонов с одинаковым `seed`.
- `EncounterDefinition.spawnPlan` остаётся стабильным верхнеуровневым полем, эволюционирует только через новые `kind`.
- Sandbox-encounter перестаёт быть жёстко привязан к «нулевому контенту»: bring-up истории могут спавнить тренировочные сущности через `'static'`, не нарушая sandbox-семантики (см. обновление в [session-definition.md](session-definition.md)).
- Контент тренировочных и обучающих режимов выражается данными в `content library`, а не ветками в коде runtime.

## Related

- [session-definition.md](session-definition.md)
- [runtime-systems.md](runtime-systems.md)
- [content-archetypes.md](content-archetypes.md)
- [content-boundaries.md](content-boundaries.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [rng.md](rng.md)
- [health-and-death.md](health-and-death.md)
- [testing.md](testing.md)
- [web-stack.md](web-stack.md)
- [boss-encounter.md](boss-encounter.md)
- [spawn-overrides.md](spawn-overrides.md)
