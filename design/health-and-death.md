# Health and Death

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-26 (story 024: `RunSummaryTracker` becomes the explicit session-level stats/progression death hook consumer; see [session-result-summary.md](session-result-summary.md). Earlier: 2026-04-24 017 alignment: projectile and explosion damage both flow through `DamageIntent`; 018 alignment: field/status damage sources are added for future `FieldEffectSystem`/`StatusEffectSystem`. Earlier: 016 impact direction, 006 boss, 005 drops.)

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
- На 003 `HasHealth` есть только у `enemy`. История 004 даёт `HasHealth` и игроку: `Player` в `EntityStore` получает поля `hp`/`maxHp`, инициализируемые из `SessionDefinition.player.maxHp` ([content-archetypes.md](content-archetypes.md), [session-definition.md](session-definition.md)) на старте сессии. Никаких новых kind не вводится; контракт «HP на сущности» одинаков для `enemy` и `player`.
- Снаряды (`projectile`) HP не имеют и `HealthDeathSystem` их не трогает.

### Damage intents

- `CombatSystem` ([projectiles-and-combat.md](projectiles-and-combat.md)) формирует за тик список damage intents:
  ```ts
  type DamageIntent = Readonly<{
    targetId: EntityId;
    amount: number;     // целое > 0
    source:
      | { kind: 'projectile'; projectileId: EntityId; ownerKind: 'player' | 'enemy' | 'boss'; weaponArchetypeId: string; impactDirX: number; impactDirY: number }
      | { kind: 'explosion'; projectileId: EntityId; ownerKind: 'player' | 'enemy' | 'boss'; weaponArchetypeId: string }
      | { kind: 'enemyContact'; enemyId: EntityId }                  // активен с 004; контракт — enemy-contact.md
      | { kind: 'fieldEffect'; fieldEffectId: EntityId; archetypeId: string }
      | { kind: 'statusEffect'; statusKind: string; sourceEntityId: EntityId | null }
      | { kind: 'environment'; tag: string }                         // зарезервировано: зона/скриптовый урон
      | { kind: 'boss'; bossId: EntityId; attackId: string };        // активен с 006, [boss-encounter.md](boss-encounter.md)
    hitPosition: { x: number; y: number };
  }>;
  ```
- Active source kinds after story 017 are projectile impact and explosion from `CombatSystem`, enemy contact from [enemy-contact.md](enemy-contact.md), and boss attack damage from [boss-encounter.md](boss-encounter.md). Story 018 activates `fieldEffect` and `statusEffect` sources through dedicated systems. New sources must extend this union explicitly.
- Damage intents за тик передаются в `HealthDeathSystem` явным списком (по конкретному signature метода), без отдельной глобальной шины событий: один тик — один список.
- `CombatSystem` не имеет права читать или мутировать HP. Все вычитания выполняет только `HealthDeathSystem`.
- `HealthDeathSystem` владеет **только decrement HP и death**. Heal (увеличение `hp` в пределах `[0, maxHp]`) под этот контракт не подпадает: единственный санкционированный источник heal на горизонт MVP — `DropSystem` ([drops.md](drops.md)), который мутирует `player.hp` напрямую в фазе pickup, не строит `DamageIntent` и не вызывает `HealthDeathSystem.applyDamage`. Heal не может породить `death`-event, не запускает death hooks и не попадает в общий per-tick damage-список. Если когда-нибудь появится второй источник heal (регенерация, эффект босса), вводится отдельное design-решение об общем heal-канале — но не обходом этого правила «по месту».

### Применение урона и фиксация смерти

- За один тик `HealthDeathSystem` обрабатывает intents в порядке поступления:
  1. для каждой intent: если цель ещё жива, `target.hp = max(0, target.hp − amount)`;
  2. при переходе `hp > 0 → hp == 0` сущность помечается как «умерла на этом тике»;
  3. повторные intents в ту же цель в том же тике, пришедшие после её смерти, **игнорируются** — это исключает «пере-убийство» и двойной запуск death hooks.
- Сущности, помеченные как «умерла на этом тике», образуют упорядоченный список death events для текущего тика.
- При публикации `death` runtime event `HealthDeathSystem` копирует из финальной `DamageIntent.source` только presentation-safe impact metadata: для projectile-смерти `weaponArchetypeId` и normalized `impactDirX/Y`, для explosion-смерти `weaponArchetypeId` без directional impact, для остальных источников — `null`. Полная форма события зафиксирована в [snapshot-shape.md](snapshot-shape.md), а потребительский смысл — в [impact-feedback.md](impact-feedback.md).

### Death hooks

- Death hooks регистрируются один раз на старте симуляции (или на старте сессии — в одной точке), не появляются по ходу тика. Зарегистрированный hook остаётся живым между сессиями; своё внутреннее состояние он сбрасывает на `sessionStart`/`sessionStop`.
- Сигнатура hook:
  ```ts
  type DeathContext = Readonly<{
    entityId: EntityId;
    entityKind: 'enemy' | 'player' | 'boss';
    archetypeId: string | null;          // для enemy/boss; null если архетипа нет
    position: { x: number; y: number }; // позиция на момент смерти
    cause: DamageIntent['source'];       // что нанесло финальный удар
    simTime: number;                     // ms симуляции
  }>;

  type DeathHook = (ctx: DeathContext) => void;
  ```
- Минимальные потребители death hooks (зафиксированы здесь как контракт; реализация — по соответствующим историям):
  - `DropSystem` ([drops.md](drops.md)) — реагирует на смерти врагов: фильтрует по `entityKind === 'enemy'`, при непустой `dropTable` делает один `nextFloat` через session RNG и при выпавшем dropArchetype спавнит `Drop` через `EntityStore.spawnDrop` в позиции `ctx.position`. Полный контракт hook'a — в [drops.md](drops.md); смерть `entityKind === 'boss'` дроп не порождает, если отдельно не оговорено контентом;
  - `SessionFlowSystem` — session-level hooks на `player` ([session-definition.md](session-definition.md)) и, при `winCondition: bossDefeated`, на смерть босса ([boss-encounter.md](boss-encounter.md));
  - `RunSummaryTracker` ([session-result-summary.md](session-result-summary.md)) — session-level статистика и progression для результата: счётчики убитых, причина поражения, boss-defeated summary. Его hook должен отработать до hook-ов, которые могут завершить run через `SessionFlowSystem`;
  - runtime events для HUD/audio/debug — публикация события `death` (см. [snapshot-shape.md](snapshot-shape.md)).
- Hooks вызываются **синхронно**, в порядке регистрации, для каждой смерти отдельно. Hook не имеет права:
  - наносить новый урон в том же тике (это создаст цепочку смертей с непредсказуемым порядком и сломает воспроизводимость по `seed`);
  - модифицировать HP и `EntityStore` для **других** сущностей (создание новых сущностей вроде `Drop` не считается мутацией других — это новые id);
  - читать состояние сущностей, помеченных к удалению на этом тике, как «живых».
- Hook **может**: создать новые сущности (например, `DropSystem` спавнит `Drop` в `EntityStore`), записать в свою внутреннюю статистику, опубликовать runtime event (например, `dropSpawn` от `DropSystem`, см. [snapshot-shape.md](snapshot-shape.md)).

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

### Игрок и player-death (активно с 004)

- Игрок получает `HasHealth` (см. выше) и проходит через тот же путь, что и враг: `DamageIntent` → `applyDamage` → возможная смерть на этом тике → death events → death hooks → удаление.
- `lossCondition: { kind: 'playerDeath' }` ([session-definition.md](session-definition.md)) реализуется через **session-level death hook**: hook регистрируется `SessionFlowSystem` ([runtime-systems.md](runtime-systems.md)) на старте симуляции/сессии, реагирует на `entityKind === 'player'` и инициирует завершение run (публикация `loss`-event и сброс runtime state). Это единственный санкционированный путь loss-by-death; никакая система не имеет права «опережать» этот hook собственной публикацией `loss`.
- Удаление игрока из `EntityStore` происходит по общему правилу `removeDead()`: после публикации `death`-event и hooks. Это значит, что hook session-level видит позицию игрока на момент смерти. Поведение `EntityStore.player()` после удаления — `null`; `MovementSystem`/`CombatSystem`/`SnapshotExportSystem` обязаны корректно обрабатывать отсутствие игрока (см. ниже).
- После публикации `loss` `SimulationClock` переводится в idle, дальнейшие тики не выполняются. `SnapshotExportSystem` для следующего расписанного снапшота уже не вызывается; последний валидный снапшот — тот, который был экспортирован в тике смерти (с уже удалённым игроком). HUD реагирует на `loss`-event, а не на «отсутствие игрока в снапшоте».
- `MovementSystem` и `CombatSystem` обязаны быть толерантны к `player === null`: фаза contact intents и фаза firing decisions становятся no-op. Это не специальное правило 004, а общий контракт «системы не предполагают, что player всегда жив».

## Consequences

- HP и его мутация остаются в одной точке; багов вида «-1 HP в `CombatSystem` и -1 HP в `BossPhaseSystem`» по построению быть не может.
- Death hooks фиксируют форму обмена для 005/006 заранее; добавление `DropSystem` не потребует переоткрывать порядок тика.
- Запрет на «новый урон внутри hook» сохраняет детерминизм относительно `seed`: цепочка смертей в один тик невозможна.
- `EntityStore` остаётся owner-ом lifecycle сущностей, но удаление инициируется только `HealthDeathSystem` для damageable-сущностей; для снарядов и дропа удалением владеют их собственные системы ([projectiles-and-combat.md](projectiles-and-combat.md), [drops.md](drops.md)).
- Когда у игрока появится HP, новых архитектурных решений не потребуется — переиспользуются те же intents и hooks.

## Related

- [runtime-systems.md](runtime-systems.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [enemy-contact.md](enemy-contact.md)
- [snapshot-shape.md](snapshot-shape.md)
- [content-archetypes.md](content-archetypes.md)
- [drops.md](drops.md)
- [session-definition.md](session-definition.md)
- [simulation-timing.md](simulation-timing.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
- [boss-encounter.md](boss-encounter.md)
- [impact-feedback.md](impact-feedback.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)
- [session-result-summary.md](session-result-summary.md)
