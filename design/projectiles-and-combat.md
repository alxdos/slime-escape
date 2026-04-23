# Projectiles and Combat

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-23 (013 follow-up: hit detection по `target.contactBox` для `player` / `enemy` / `boss`, broadphase по derived bounds radius; ранее: 006 `projectile.ownerKind` и `fire`/`hit` — см. [boss-encounter.md](boss-encounter.md), [snapshot-shape.md](snapshot-shape.md); friendly fire с сущностью `kind: 'boss'`; ранее: contact intents)

## Context

[runtime-systems.md](runtime-systems.md) фиксирует существование `CombatSystem`, его соседство с `HealthDeathSystem`, `SpatialIndex` и `SnapshotExportSystem`, но не задаёт ни модель снарядов, ни правила кулдауна, ни форму обмена с `HealthDeathSystem`. История 003 вводит первый бой в проекте: одно оружие, один враг-мишень. Без явного контракта:

- история 003 неявно зафиксирует «снаряд = что-то внутри `CombatSystem`», без чёткой границы с `EntityStore` и снапшотами;
- история 004 (волны) и 005 (дроп) переоткроют те же вопросы для большего количества врагов;
- история 006 (босс) добавит второй источник снарядов (босс стреляет в игрока) и потребует переосмыслить ownership и friendly fire;
- runtime events `fire`/`hit` появятся в нескольких местах с разной формой.

`SnapshotExportSystem` уже несёт обязательство публиковать сущности с дискриминатором `kind` ([thread-model.md](thread-model.md)), так что снаряды как сущности — самый прямой путь, но это нужно зафиксировать.

## Decision

### Снаряд как runtime-сущность

- Снаряд — отдельная runtime-сущность с собственным `id` и `kind: 'projectile'`. Хранится в `EntityStore` рядом с игроком и врагами; собственного «пула снарядов» в обход store не вводим.
- Минимальный runtime state снаряда:
  ```ts
  type Projectile = {
    id: EntityId;
    kind: 'projectile';
    weaponArchetypeId: string;        // ссылка в content library
    ownerKind: 'player' | 'enemy' | 'boss';   // кто стреляет (см. friendly fire)
    position: { x: number; y: number };
    velocity: { vx: number; vy: number }; // wu/s
    radius: number;                   // wu, копия из WeaponArchetype.projectileRadius
    damage: number;                   // целое > 0, копия из WeaponArchetype.damage
    expireAtSimMs: number;            // момент снятия с арены
  };
  ```
- Поля `radius`, `damage`, `expireAtSimMs` копируются из архетипа в момент создания, чтобы tick не зависел от лишних lookup-ов и оставался стабильным даже при будущих мутациях архетипа в редакторе/тестах.
- `velocity` фиксируется в момент выстрела и далее не меняется. Гравитации, наведения и эффектов «тянет к цели» нет.
- Снаряды визуализируются по `kind: 'projectile'` (см. [snapshot-shape.md](snapshot-shape.md)); рендер не знает про их тип оружия дальше, чем по `weaponArchetypeId`.

### Оружие и кулдаун

- Стрельбой владеет `CombatSystem`. Кулдаун хранится **per-shooter**, в runtime state стрелка, например для игрока:
  ```ts
  type PlayerWeapons = {
    primary: { archetypeId: string; nextFireSimMs: number };
  };
  ```
- На каждом тике для активного стрелка `CombatSystem` проверяет:
  1. есть ли намерение стрелять (для игрока — `input.firing` из [input-commands.md](input-commands.md));
  2. `simTime >= nextFireSimMs`;
  3. валиден ли вектор прицела: `aimWorld − shooterPos` ненулевой; иначе выстрел пропускается без снижения кулдауна и без runtime event.
- При успешной проверке:
  1. выбирается архетип оружия по `archetypeId`;
  2. позиция спавна снаряда — текущая позиция стрелка (без muzzle-offset; внести позже отдельным решением, если потребуется);
  3. направление — единичный вектор `(aim − pos)`;
  4. `velocity = direction * archetype.projectileSpeed`;
  5. `expireAtSimMs = simTime + archetype.projectileTtlMs`;
  6. `nextFireSimMs = simTime + archetype.cooldownMs`;
  7. публикуется runtime event `fire` (поля — в [snapshot-shape.md](snapshot-shape.md)).
- Удержание `firing: true` приводит к серии выстрелов с темпом `cooldownMs`. Никаких отдельных «авто-фаер таймеров» сверх per-shooter `nextFireSimMs` нет.
- Темп стрельбы — единственный лимитер; конечного боезапаса в MVP нет ([../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)).

### Движение снаряда и границы арены

- Перемещение снарядов выполняется внутри `CombatSystem`, а не `MovementSystem`:
  - `MovementSystem` владеет инвариантом «сущность не выходит за границы арены» только для **управляемых актёров** (игрок, враги с поведением). Снаряды наоборот должны иметь право выйти за арену и быть удалены.
  - Это сохраняет границу ответственности: `MovementSystem` не делает ветку «если это снаряд — не клампать».
- На каждом тике для каждого снаряда:
  1. `position += velocity * SIM_STEP_SEC`;
  2. если `position` вышла за границы арены ([arena-and-coordinates.md](arena-and-coordinates.md)) — пометить на удаление;
  3. если `simTime >= expireAtSimMs` — пометить на удаление.
- Помеченные снаряды удаляются в той же фазе `CombatSystem` до следующего шага хит-теста, чтобы они не успели нанести урон после фактического исчерпания.

### Хит-тест и damage intents

- Хит-тест выполняется после движения снарядов, в той же фазе `CombatSystem`:
  - кандидаты — соседи снаряда из `SpatialIndex` ([runtime-systems.md](runtime-systems.md)) в радиусе `projectile.radius + maxTargetBoundsRadius`, где `maxTargetBoundsRadius` derive-ится как circumscribed circle для `target.contactBox` по [body-contact-boxes.md](body-contact-boxes.md);
  - проверка коллизии для `player` / `enemy` / `boss` — circle-vs-axis-aligned-box между текущей позицией снаряда и `target.contactBox`, центрированным в `target.position`.
- Friendly fire:
  - снаряд с `ownerKind: 'player'` поражает сущности с `kind: 'enemy'` и `kind: 'boss'` (урон со стороны игрока);
  - снаряд с `ownerKind: 'enemy'` поражает только игрока;
  - снаряд с `ownerKind: 'boss'` поражает только игрока (атаки босса через снаряд — [boss-encounter.md](boss-encounter.md));
  - проверка реализована как фильтр по `target.kind` относительно `projectile.ownerKind`; отдельных team-id в MVP не вводим.
- При попадании:
  1. формируется damage intent `{ targetId, amount: projectile.damage, source: { kind: 'projectile', projectileId, ownerKind, weaponArchetypeId }, hitPosition }`;
  2. снаряд **сразу** помечается на удаление (один снаряд = одно попадание);
  3. публикуется runtime event `hit` (поля — в [snapshot-shape.md](snapshot-shape.md)).
- Damage intents этой фазы передаются в `HealthDeathSystem` ([health-and-death.md](health-and-death.md)) как явный список; общая шина damage не вводится — один кадр, один набор intents.

### Туннелирование и ограничение скорости

- Хит-тест по текущей позиции снаряда корректен только при условии:
  ```
  projectile.projectileSpeed * SIM_STEP_SEC <= projectile.radius + minTargetInsetRadius
  ```
  где `minTargetInsetRadius = min(contactBox.width, contactBox.height) / 2` для самой узкой сущности, которую этот снаряд может поразить.
- Это **контракт контента**: автор `WeaponArchetype` обязан соблюдать ограничение относительно ожидаемых целей. Превышение фиксируется warning через единый log-модуль ([logging.md](logging.md)) при сборке/старте сессии и не должно поддерживаться в content review.
- Свёрнутый sweep-тест (segment vs circle) — будущее улучшение и оформляется отдельным design-решением, если контент перестанет влезать в ограничение.

### Порядок внутри тика

- В рамках общего update-order из [runtime-systems.md](runtime-systems.md) `CombatSystem` за один тик выполняет фазы строго в этом порядке:
  1. firing decisions: для каждого активного стрелка — спавн новых снарядов в `EntityStore`;
  2. projectile movement: интеграция позиций существующих снарядов;
  3. lifetime cleanup: пометка просроченных и вышедших за арену;
  4. contact intents: формирование `DamageIntent` от врагов в контакте с игроком; полный контракт — [enemy-contact.md](enemy-contact.md);
  5. hit detection: damage intents от снарядов и пометка снарядов-поражений;
  6. removal: удаление помеченных снарядов из `EntityStore`.
- Контактные и снарядные intents складываются в **один** список `DamageIntent` за тик и передаются в `HealthDeathSystem` единым вызовом ([health-and-death.md](health-and-death.md)). Отдельной шины contact-damage нет.
- `HealthDeathSystem` запускается **после** `CombatSystem` и применяет полученные damage intents (см. [health-and-death.md](health-and-death.md)). Снапшот публикует уже консистентное состояние: умершие сущности в нём отсутствуют, а runtime event `death` уже сгенерирован.

### Интеграция с input

- На 003 единственный стрелок — игрок; источник `firing`/`aimWorld` — `RuntimeInputState`, который наполняется через `InputCommand` ([input-commands.md](input-commands.md)).
- В историях с врагами-стрелками (006) ownership смещается от input к AI, но контракт «firing decision → spawn → movement → hit» не меняется.

## Consequences

- Снаряды попадают в общий контракт `EntityStore` и снапшотов; рендер и HUD получают их как обычные сущности по `kind`.
- `CombatSystem` владеет полным жизненным циклом снаряда; `MovementSystem` остаётся системой «управляемых актёров» и сохраняет инвариант границ арены без специальных веток.
- Друг-враг-разделение реализуется через `ownerKind`, а не через team-id; это масштабируется до 006 без переписывания типов.
- Численная корректность хит-теста сводится к одному явному ограничению на контент; текущая модель выдерживает все weapon-archetype-ы из 003–005 без sweep-теста.
- HP, смерть и death hooks остаются за пределами этого решения и описаны в [health-and-death.md](health-and-death.md); `CombatSystem` ничего не знает про HP цели.

## Related

- [runtime-systems.md](runtime-systems.md)
- [health-and-death.md](health-and-death.md)
- [enemy-contact.md](enemy-contact.md)
- [content-archetypes.md](content-archetypes.md)
- [snapshot-shape.md](snapshot-shape.md)
- [input-commands.md](input-commands.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [boss-encounter.md](boss-encounter.md)
- [simulation-timing.md](simulation-timing.md)
- [logging.md](logging.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
