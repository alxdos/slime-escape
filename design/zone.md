# Dark Zone

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-23

## Context

[runtime-systems.md](runtime-systems.md) фиксирует существование `ZoneSystem` («тёмная зона и другие режимы ограничения видимости»), его место в update order (перед `SnapshotExportSystem`) и общее правило «`ZoneSystem` управляет состоянием зоны и её экспортом, но не завершает encounter самостоятельно». Сама модель зоны не описана.

[../docs/GDD_CORE.md](../docs/GDD_CORE.md) и [../docs/WAVES_AND_SCALING.md](../docs/WAVES_AND_SCALING.md) задают продуктовые правила:

- зона **линейно сжимается** во время волны и **отступает** в передышке;
- зона **не наносит урона**, её роль — ограничивать обзор;
- во время боя с боссом зона **не действует**;
- спавн «с краёв арены» опирается на края арены, а не на текущую границу зоны.

Без явного контракта история 004 (волны и зона) неявно зафиксирует и форму зоны, и способ её представления в snapshot, и зависимость рендера от gameplay-формы. История 006 (босс, зона отключена) и 007 (HUD) переоткроют те же вопросы.

## Decision

### Гейплейная форма зоны

- Гейплейная форма зоны — **один скаляр `margin`** (в world units, см. [arena-and-coordinates.md](arena-and-coordinates.md)). `margin` — это inset со всех сторон: безопасная область арены — прямоугольник с центром в `(0, 0)` и полуразмерами `(arena.width / 2 − margin, arena.height / 2 − margin)`.
- `margin = 0` означает «зона полностью отступила, безопасная область совпадает с ареной». Это нейтральное состояние; оно используется и для encounter с `zoneBehavior: { kind: 'disabled' }`, и для бой-с-боссом из 006.
- `margin` ограничен снизу нулём и сверху значением, при котором безопасная область вырождается в точку. Конкретные `fromMargin`/`toMargin` задаются в `EncounterDefinition.zoneBehavior` и валидируются на стороне content/builder, а не runtime.
- **Per-side margins, окружности и асимметричные формы в gameplay-контракте отсутствуют.** Если они потребуются, расширение оформляется отдельным решением; сейчас намеренно один scalar.

### Никакого урона и гейплей-влияния

- Зона **не наносит урон** ни при каких условиях. `ZoneSystem` не формирует `DamageIntent`, не имеет death hook, не убивает сущности.
- Зона **не ограничивает движение** ни игрока, ни врагов, ни снарядов: `MovementSystem` и `CombatSystem` опираются на границы арены ([arena-and-coordinates.md](arena-and-coordinates.md), [projectiles-and-combat.md](projectiles-and-combat.md)), а не на `margin`.
- Зона **не завершает encounter**: это уже зафиксировано в [runtime-systems.md](runtime-systems.md). `SessionFlowSystem` смотрит только на `transitionRules`, не на `margin`.
- Это правило сознательно: «зона — ограничитель видимости, не отдельная среда со своими врагами» из [../docs/GDD_CORE.md](../docs/GDD_CORE.md). Любое будущее «зона бьёт игрока» — это **другая** система (например, `EnvironmentHazardSystem` для газовых облаков), не расширение `ZoneSystem`.

### Конфигурация зоны на уровне encounter

- `EncounterDefinition.zoneBehavior` — дискриминированный union, конкретные kind фиксируются в [session-definition.md](session-definition.md). Для зоны определены три kind:
  - `{ kind: 'disabled' }` — зона полностью отступлена и не двигается; `margin = 0` весь encounter;
  - `{ kind: 'shrinkLinear'; fromMargin; toMargin; durationMs }` — линейное сжатие к `toMargin` за `durationMs`; `fromMargin` — номинальное авторское начало;
  - `{ kind: 'expandLinear'; fromMargin; toMargin; durationMs }` — линейное расширение к `toMargin` за `durationMs`; `fromMargin` — номинальное авторское начало.
- Для `shrinkLinear`/`expandLinear` `fromMargin` и `toMargin` — оба в `[0, maxMargin]`; направление (сжатие vs расширение) задаётся именно `kind`, а не знаком разности. Это исключает скрытое «расширение через shrink с отрицательным значением».
- `fromMargin` описывает авторское ожидаемое начало интерполяции и используется content/builder-слоем для проверки связности настроек. Runtime не обязан прыгать к `fromMargin`: фактическая интерполяция всегда стартует из текущего `ZoneSystem.margin`, чтобы переход между encounter оставался гладким, если предыдущая зона ещё не дошла до своего `toMargin`.
- `durationMs > 0`. Если `durationMs` меньше длительности encounter — после достижения `toMargin` `margin` остаётся равен `toMargin` до `encounterEnd` (clamp, не циклическая интерполяция).
- Конкретные числовые значения (`fromMargin`, `toMargin`, `durationMs` для `wave`/`break`) задаются в `content library` ([content-boundaries.md](content-boundaries.md)) при сборке `SessionDefinition`. Это контент, а не часть design-решения.

### Жизненный цикл `ZoneSystem`

- На `encounterStart` `ZoneSystem` инициализируется из `encounter.zoneBehavior` и текущего runtime-состояния:
  - `disabled` → `mode = 'disabled'`, `margin = 0`, внутренний `elapsedMs = 0`;
  - `shrinkLinear` → `mode = 'shrink'`, `startMargin = current margin`, `margin = startMargin`, `elapsedMs = 0`, запоминаются `startMargin`/`toMargin`/`durationMs`;
  - `expandLinear` → `mode = 'expand'`, `startMargin = current margin`, `margin = startMargin`, `elapsedMs = 0`, аналогично.
- На каждом тике (по [simulation-timing.md](simulation-timing.md), `SIM_STEP_MS`):
  - для `disabled` — no-op;
  - иначе `t = clamp(elapsedMs / durationMs, 0, 1)`, `margin = lerp(startMargin, toMargin, t)`, затем `elapsedMs += SIM_STEP_MS`. Первый snapshot нового encounter поэтому остаётся на фактическом `startMargin`; после `t == 1` дальнейших изменений нет (clamp сохраняется).
- На `encounterEnd` активная интерполяция останавливается (`mode = 'disabled'`), но текущий `margin` сохраняется как фактическое начало для следующего encounter. Полный сброс к `margin = 0` происходит на lifecycle-границе сессии (`sessionStart`/`sessionStop`) или при старте encounter с `zoneBehavior: { kind: 'disabled' }`.
- `ZoneSystem` встроен в update order по [runtime-systems.md](runtime-systems.md): тикает каждый sim tick, после `HealthDeathSystem`/`DropSystem` и до `SnapshotExportSystem`. Никакая другая система от текущего значения `margin` не зависит, поэтому конкретное место «после `HealthDeathSystem`» — деталь порядка, не gameplay-зависимость.

### Экспорт в snapshot

- `ZoneSystem` экспортирует своё состояние в snapshot одним top-level полем (форма поля фиксируется в [snapshot-shape.md](snapshot-shape.md)):
  ```ts
  zone: {
    mode: 'disabled' | 'shrink' | 'expand';
    margin: number; // wu, >= 0
  };
  ```
- `mode` нужен HUD/рендеру, чтобы различать «зона неподвижна (disabled или достигла toMargin)» и «зона активно меняется». `margin` — единственное число для визуализации.
- Никакие производные значения (предполагаемое время до «полного схлопывания», `fromMargin`/`toMargin`, `durationMs`) в snapshot не уходят. Если потребуются HUD-подсказкам — добавятся отдельным расширением `snapshot-shape.md`, не «по месту».

### Визуализация (вне gameplay-контракта)

- Геометрия отображения зоны (rounded corners, мягкий градиент по краю, цвет, blur) — **деталь рендера** на стороне `main thread` ([thread-model.md](thread-model.md)) и не часть этого решения. Любые числа вроде «радиус скругления = 0.25 × `arena.height`» или «ширина градиента» живут в `Renderer`, не в `design/` и не в `content library`.
- Это намеренно: визуальная форма не влияет на gameplay (зона не бьёт, движение и стрельба ориентируются на арену), и привязка её параметров к `margin` через snapshot достаточна.
- Инвариант «без преимущества от железа» из [arena-and-coordinates.md](arena-and-coordinates.md) сохраняется автоматически: gameplay видит ту же `margin` независимо от render backend, разрешения и качества картинки.

## Consequences

- История 004 получает компактный контракт: «один scalar `margin`, линейная интерполяция от фактического текущего margin к `toMargin` за `durationMs`», без дополнительных правил и без побочных эффектов.
- История 006 (босс) реализуется через `zoneBehavior: { kind: 'disabled' }` без специального флага «зона выключена в боссе»; `ZoneSystem` ничем не отличается между режимами.
- HUD из 007 и render из 010 могут полагаться на стабильную форму `zone` в snapshot и не вынуждены договариваться с `sim` о «как именно нарисовать тьму».
- Быстрые завершения волн не создают визуальных скачков зоны: следующий активный encounter продолжает интерполяцию от фактически видимого `margin`, а не от авторского номинального `fromMargin`.
- Любая будущая «зона, которая бьёт игрока» сразу обозначает себя как **другая** система; этот файл и его инвариант «zone не наносит урон» не размывается.
- Расширение до per-side margin или окружности затрагивает форму snapshot и `ZoneBehavior`, но не контракт «zone не делает gameplay-решений».

## Related

- [runtime-systems.md](runtime-systems.md)
- [session-definition.md](session-definition.md)
- [snapshot-shape.md](snapshot-shape.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [simulation-timing.md](simulation-timing.md)
- [thread-model.md](thread-model.md)
- [content-boundaries.md](content-boundaries.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [../docs/WAVES_AND_SCALING.md](../docs/WAVES_AND_SCALING.md)
- [../docs/BOSS.md](../docs/BOSS.md)
