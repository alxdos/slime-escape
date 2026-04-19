# Health and Death

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-19

## Context

[runtime-systems.md](runtime-systems.md) фиксирует, что `HealthDeathSystem` — единственный слой, который применяет финальную потерю HP и фиксирует смерть, а death hooks срабатывают «после смерти, до экспорта снапшота». Но не описано:

- где живёт HP и как он связан с сущностями `EntityStore`;
- как именно в один тик попадает damage и кто его подаёт;
- что именно получают потребители death hooks (`DropSystem` в 005, статистика, runtime events);
- когда и кем удаляется погибшая сущность из `EntityStore`.

Без этого контракта история 003 неявно введёт «HP в `EntityStore` напрямую» или «damage применяется внутри `CombatSystem`», а 005/006 потом будут переоткрывать death hooks.

## Decision

### HP как описание сущности

- HP хранится **на самой runtime-сущности** в `EntityStore`, не в отдельном HP-реестре. Это держит state локально и делает удаление сущности атомарным.
- Минимальная форма HP-полей у damageable-сущности:
  ```ts
  type HasHealth = {
    hp: number;       // целое >= 0
    maxHp: number;    // целое > 0, копия из архетипа
  };
  ```
- На 003 `HasHealth` есть только у `enemy`. Игрок добавит `HasHealth` в более поздних историях (зона/босс) — это сделает соответствующая история, не 003.
- Снаряды (`projectile`) HP не имеют и `HealthDeathSystem` их не трогает.

### Damage intents

- `CombatSystem` ([projectiles-and-combat.md](projectiles-and-combat.md)) формирует за тик список damage intents:
  ```ts
  type DamageIntent = Readonly<{
    targetId: EntityId;
    amount: number;     // целое > 0
    source:
      | { kind: 'projectile'; projectileId: EntityId; ownerKind: 'player' | 'enemy'; weaponArchetypeId: string }
      | { kind: 'environment'; tag: string }   // зарезервировано: газ, поджог и т.п.
      | { kind: 'boss'; bossId: EntityId; attackId: string };  // зарезервировано под 006
    hitPosition: { x: number; y: number };
  }>;
  ```
- Минимально на 003 единственный реальный `source.kind` — `'projectile'`. Остальные перечислены, чтобы будущие истории добавлялись расширением union, а не переименованием поля.
- Damage intents за тик передаются в `HealthDeathSystem` явным списком (по конкретному signature метода), без отдельной глобальной шины событий: один тик — один список.
- `CombatSystem` не имеет права читать или мутировать HP. Все вычитания выполняет только `HealthDeathSystem`.

### Применение урона и фиксация смерти

- За один тик `HealthDeathSystem` обрабатывает intents в порядке поступления:
  1. для каждой intent: если цель ещё жива, `target.hp = max(0, target.hp − amount)`;
  2. при переходе `hp > 0 → hp == 0` сущность помечается как «умерла на этом тике»;
  3. повторные intents в ту же цель в том же тике, пришедшие после её смерти, **игнорируются** — это исключает «пере-убийство» и двойной запуск death hooks.
- Сущности, помеченные как «умерла на этом тике», образуют упорядоченный список death events для текущего тика.

### Death hooks

- Death hooks регистрируются один раз на старте симуляции (или на старте сессии — в одной точке), не появляются по ходу тика. Зарегистрированный hook остаётся живым между сессиями; своё внутреннее состояние он сбрасывает на `sessionStart`/`sessionStop`.
- Сигнатура hook:
  ```ts
  type DeathContext = Readonly<{
    entityId: EntityId;
    entityKind: 'enemy' | 'player';     // расширяется по мере появления damageable-kind-ов
    archetypeId: string | null;          // для enemy/boss; null если архетипа нет
    position: { x: number; y: number }; // позиция на момент смерти
    cause: DamageIntent['source'];       // что нанесло финальный удар
    simTime: number;                     // ms симуляции
  }>;

  type DeathHook = (ctx: DeathContext) => void;
  ```
- Минимальные потребители death hooks (зафиксированы здесь как контракт; реализация — по соответствующим историям):
  - `DropSystem` ([../stories/005-drops.md](../stories/005-drops.md)) — реагирует на смерти врагов;
  - session-level статистика и progression — счётчики убитых, прогресс волны и т.п.;
  - runtime events для HUD/audio/debug — публикация события `death` (см. [snapshot-shape.md](snapshot-shape.md)).
- Hooks вызываются **синхронно**, в порядке регистрации, для каждой смерти отдельно. Hook не имеет права:
  - наносить новый урон в том же тике (это создаст цепочку смертей с непредсказуемым порядком и сломает воспроизводимость по `seed`);
  - модифицировать HP и `EntityStore` для **других** сущностей;
  - читать состояние сущностей, помеченных к удалению на этом тике, как «живых».
- Hook **может**: создать новые сущности (например, `DropSystem` спавнит дроп), записать в свою внутреннюю статистику, опубликовать runtime event.

### Удаление и порядок внутри тика

- Удаление помеченных сущностей из `EntityStore` выполняется **после** того, как все death hooks для этого тика отработали. Это значит:
  - на момент работы hook сущность ещё доступна по `entityId`, и hook может прочитать её последнюю позицию;
  - после удаления сущности её `id` больше не возвращается из `EntityStore` и не попадает в снапшот.
- Финальный порядок внутри одного тика:
  1. (внешнее) `CombatSystem` сформировал damage intents;
  2. `HealthDeathSystem.applyDamage(intents)` — вычисление новых HP, формирование списка смертей;
  3. публикация runtime events `death` для каждой смерти;
  4. `HealthDeathSystem.runDeathHooks(deaths)` — синхронные hooks в порядке регистрации;
  5. `HealthDeathSystem.removeDead()` — удаление сущностей из `EntityStore`;
  6. дальнейшие системы (`DropSystem`, `ZoneSystem` и т.п.) работают уже на консистентном `EntityStore`, потом — `SnapshotExportSystem`.
- `SnapshotExportSystem` ([snapshot-shape.md](snapshot-shape.md)) не видит уже удалённую сущность — игрок не успевает увидеть её «лишний кадр».

### Игрок (forward-compat)

- Когда у игрока появится `HasHealth`, его смерть пойдёт через тот же путь, что и смерть врага.
- `lossCondition: { kind: 'playerDeath' }` ([session-definition.md](session-definition.md)) реализуется через death hook session-level: hook регистрируется `SessionFlowSystem`, реагирует на `entityKind === 'player'` и переводит run в loss. Это решение здесь только зафиксировано как **направление**; конкретная реализация — в соответствующей истории, не в 003.

## Consequences

- HP и его мутация остаются в одной точке; багов вида «-1 HP в `CombatSystem` и -1 HP в `BossPhaseSystem`» по построению быть не может.
- Death hooks фиксируют форму обмена для 005/006 заранее; добавление `DropSystem` не потребует переоткрывать порядок тика.
- Запрет на «новый урон внутри hook» сохраняет детерминизм относительно `seed`: цепочка смертей в один тик невозможна.
- `EntityStore` остаётся owner-ом lifecycle сущностей, но удаление инициируется только `HealthDeathSystem` для damageable-сущностей; для снарядов и дропа удалением владеют их собственные системы (см. [projectiles-and-combat.md](projectiles-and-combat.md)).
- Когда у игрока появится HP, новых архитектурных решений не потребуется — переиспользуются те же intents и hooks.

## Related

- [runtime-systems.md](runtime-systems.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [snapshot-shape.md](snapshot-shape.md)
- [content-archetypes.md](content-archetypes.md)
- [session-definition.md](session-definition.md)
- [simulation-timing.md](simulation-timing.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
