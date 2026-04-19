# Snapshot Shape

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-19

## Context

[thread-model.md](thread-model.md) фиксирует разделение между периодическим состоянием (`snapshot`) и точечными фактами (`runtime events`), а также правило: каждая сущность в снапшоте несёт стабильный дискриминатор `kind`. Конкретные поля per-kind и поля каждого runtime event там сознательно оставлены open «по мере появления систем».

В 002 этого хватало (только `kind: 'player'`, минимальные lifecycle events). История 003 одновременно вводит:

- два новых типа сущностей в снапшоте — `enemy` и `projectile`;
- три новых runtime events — `fire`, `hit`, `death`.

Без явного контракта эти формы будут зафиксированы по месту в 003, после чего 004 (волны), 005 (дроп), 006 (босс), 007 (HUD), 008 (audio) каждый раз будут расширять/переименовывать поля. Это решение задаёт базовую форму на весь горизонт MVP.

## Decision

### Общие правила

- Снапшот несёт только **меняющееся** state. Immutable конфигурация сессии (`arena`, исходные `player`, набор `encounters`) уже у `main` через `SessionDefinition` ([thread-model.md](thread-model.md)).
- Каждая сущность в `snapshot.entities` обязана иметь стабильный `id` (тот же между снапшотами, пока сущность жива) и `kind` из конечного union-а ниже.
- Поля сущностей — **только то, что нужно для рендера и HUD текущего поколения**. Поля для будущих систем добавляются вместе с историей, которой они нужны, и фиксируются здесь.
- Удалённая сущность (после `HealthDeathSystem.removeDead()` или `CombatSystem` despawn) в снапшоте отсутствует. Никаких «надгробий» в `entities`.
- Runtime events — **edge-факты**: каждое сообщение значимо, не обязано повторяться, и его поля выбираются так, чтобы потребитель (HUD/audio/render-эффект) мог среагировать без обращения к снапшоту того же тика.

### Per-kind поля сущности (на горизонт 003–006)

```ts
type EntitySnapshot =
  | PlayerSnapshot
  | EnemySnapshot
  | ProjectileSnapshot;
// kind 'drop' добавляется историей 005 расширением union;
// kind 'boss' добавляется 006 — отдельным расширением, не подменой enemy.
```

- `PlayerSnapshot`:
  ```ts
  {
    id: number;
    kind: 'player';
    x: number;
    y: number;
    // hp/maxHp добавляются историей, в которой игрок становится damageable
  }
  ```
- `EnemySnapshot`:
  ```ts
  {
    id: number;
    kind: 'enemy';
    archetypeId: string;   // для рендера и аудио по виду врага
    x: number;
    y: number;
    hp: number;
    maxHp: number;          // повторяется в каждом снапшоте; стоимость минимальна, упрощает HUD
  }
  ```
- `ProjectileSnapshot`:
  ```ts
  {
    id: number;
    kind: 'projectile';
    weaponArchetypeId: string;
    ownerKind: 'player' | 'enemy';
    x: number;
    y: number;
    // направление снаряда восстанавливается из соседних снапшотов (интерполяцией);
    // отдельное поле dir/angle вводится только если потребует контент с ориентированным спрайтом
  }
  ```

### Top-level snapshot

- Минимальная форма верхнего уровня снапшота на горизонт 003:
  ```ts
  type Snapshot = Readonly<{
    simTimeMs: number;
    entities: ReadonlyArray<EntitySnapshot>;
  }>;
  ```
- HUD-агрегаты уровня run (HP игрока, прогресс волны, состояние босса) добавляются как отдельные top-level поля в более поздних историях (007 HUD, 004 волны, 006 босс), а не складываются в `entities`. Каждое такое расширение фиксируется здесь.

### Runtime events: контракт kinds

- К существующим lifecycle kinds из [runtime-systems.md](runtime-systems.md) (`sessionStart`, `sessionStop`, `encounterStart`, `encounterEnd`, `pause`, `resume`, опциональные `win`/`loss`) этой историей добавляются три combat-kind:
  ```ts
  type RuntimeEvent =
    // lifecycle (см. runtime-systems.md)
    | { kind: 'sessionStart'; simTime: number }
    | { kind: 'sessionStop'; simTime: number }
    | { kind: 'encounterStart'; simTime: number }
    | { kind: 'encounterEnd'; simTime: number }
    | { kind: 'pause'; simTime: number }
    | { kind: 'resume'; simTime: number }
    // combat (этот файл)
    | {
        kind: 'fire';
        simTime: number;
        shooterId: number;
        ownerKind: 'player' | 'enemy';
        weaponArchetypeId: string;
        originX: number;
        originY: number;
        dirX: number;
        dirY: number;       // нормализованный вектор
      }
    | {
        kind: 'hit';
        simTime: number;
        projectileId: number;
        targetId: number;
        targetKind: 'enemy' | 'player';
        weaponArchetypeId: string;
        damage: number;
        x: number;
        y: number;
      }
    | {
        kind: 'death';
        simTime: number;
        entityId: number;
        entityKind: 'enemy' | 'player';
        archetypeId: string | null;
        x: number;
        y: number;
      };
  ```
- Owner-системы (см. [runtime-systems.md](runtime-systems.md)):
  - `fire`, `hit` публикует `CombatSystem` ([projectiles-and-combat.md](projectiles-and-combat.md));
  - `death` публикует `HealthDeathSystem` ([health-and-death.md](health-and-death.md)) сразу после фиксации смерти и до запуска death hooks.
- Никакая другая система не имеет права публиковать события `fire`/`hit`/`death`. `DropSystem` и `BossPhaseSystem` подписываются на death через death hook, а не публикуют альтернативное событие.

### Гарантии и приоритеты

- Снапшоты публикуются по расписанию из [simulation-timing.md](simulation-timing.md) (`SNAPSHOT_HZ = 30`).
- Runtime events публикуются по факту, без агрегации между тиками. Если поток перегружен, [thread-model.md](thread-model.md) уже фиксирует приоритет снапшотов — combat-events деградируют как и любые другие events.
- HUD/audio не должны восстанавливать authoritative state только из combat-events: между двумя `hit`-ами на одного врага HP читается из снапшота, а не из суммы damage в events.

### Расширение

- Новый `kind` сущности (`drop`, `boss`, `pickup`-эффект) добавляется здесь же отдельным разделом и оформляется как **новый член union**, без переоткрытия существующих.
- Новое поле в существующем `kind` допустимо только дописыванием. Удаление поля = `superseded` этого решения.
- Новый combat-kind runtime event (например, `parry`, `crit`, `pickup`) добавляется здесь же. Молчаливое расширение в `events.ts` без обновления этого файла — нарушение контракта.

## Consequences

- HUD, audio и рендер 007/008 получают стабильный набор полей и не вынуждены реверсить snapshot per story.
- `archetypeId` в снапшотах врагов и снарядов исключает «магические» цвета/спрайты, привязанные к `id` сущности; рендер выбирает визуал по архетипу из `content library`.
- `maxHp` дублируется в каждом enemy-снапшоте — это намеренный размен ради простоты HUD; стоимость в трафике незначительна на ожидаемом числе сущностей MVP.
- Новые combat-kinds событий выбраны достаточными для muzzle-flash, hit-spark, hit-sound и death-sound; их форма не потребует пересмотра в 008.
- Death hooks остаются единственным «межсистемным» способом среагировать на смерть; публикация `death` runtime event — отдельный путь, для main-thread-side потребителей.

## Related

- [thread-model.md](thread-model.md)
- [runtime-systems.md](runtime-systems.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [health-and-death.md](health-and-death.md)
- [content-archetypes.md](content-archetypes.md)
- [simulation-timing.md](simulation-timing.md)
