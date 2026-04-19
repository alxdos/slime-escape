# Spawn Plan

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-19

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
- Минимальный набор `kind` на момент 003:
  - `'empty'` — спавнов нет; `SpawnSystem` ничего не делает;
  - `'static'` — фиксированный список спавнов, исполняемый один раз при старте encounter.
- Будущие `kind` (`'wave'` для 004, `'boss'` для 006 и т.п.) фиксируются в этом же файле по мере добавления историй.
- `kind` запрещено переиспользовать с изменённой семантикой; устаревшая форма проходит через `superseded` так же, как design-решения.

### Static spawn

- Форма:
  ```ts
  type StaticSpawnPlan = {
    kind: 'static';
    spawns: ReadonlyArray<{
      archetypeId: string;     // EnemyArchetype.id из content library
      position: { x: number; y: number };  // wu, центр сущности
    }>;
  };
  ```
- Семантика:
  - список выполняется **один раз** при старте encounter;
  - порядок исполнения соответствует порядку в массиве — это даёт стабильные `id` при детерминированной сборке `SessionDefinition`;
  - повторных спавнов и респавнов нет;
  - `position` обязан попадать внутрь арены ([arena-and-coordinates.md](arena-and-coordinates.md)); за пределами арены — ошибка сборки сессии, а не runtime-поведение;
  - архетипы резолвятся через `content library` ([content-archetypes.md](content-archetypes.md), [content-boundaries.md](content-boundaries.md)).

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
- `SpawnSystem` детерминирован относительно `seed` сессии: если в плане появится случайный выбор архетипа или позиции, источником случайности обязан быть session RNG, а не `Math.random` ([session-definition.md](session-definition.md)).

### Расширение и обратная совместимость

- Новый `kind` обязан задаваться отдельным разделом этого файла, со своим описанием полей и поведения.
- `SpawnSystem` обязан явно отвергать неизвестный `kind` через `assertNever` (см. [web-stack.md](web-stack.md), `src/shared/protocol.ts`); молчаливое игнорирование запрещено.
- При необходимости заменить существующую форму (например, упрощение `'wave'`) старый `kind` помечается как deprecated в этом файле и удаляется одним PR с обновлением всех использований в `content/`.

## Consequences

- `SpawnSystem` появляется уже в 003, но в минимальной форме «исполнить статический список»; история 004 расширяет систему, а не вводит новую.
- `EncounterDefinition.spawnPlan` остаётся стабильным верхнеуровневым полем, эволюционирует только через новые `kind`.
- Sandbox-encounter перестаёт быть жёстко привязан к «нулевому контенту»: bring-up истории могут спавнить тренировочные сущности через `'static'`, не нарушая sandbox-семантики (см. обновление в [session-definition.md](session-definition.md)).
- Контент тренировочных и обучающих режимов выражается данными в `content library`, а не ветками в коде runtime.

## Related

- [session-definition.md](session-definition.md)
- [runtime-systems.md](runtime-systems.md)
- [content-archetypes.md](content-archetypes.md)
- [content-boundaries.md](content-boundaries.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [web-stack.md](web-stack.md)
