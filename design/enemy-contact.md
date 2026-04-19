# Enemy Contact Damage

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-19 (добавлен раздел `Knockback at contact`: враг получает временный импульс от игрока, скорость зависит от взаимной скорости сближения; player не отталкивается)

## Context

[../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md) фиксирует, что **урон игроку наносят враги, их снаряды и отдельные опасные области**. История 003 ввела снарядную часть ([projectiles-and-combat.md](projectiles-and-combat.md), [health-and-death.md](health-and-death.md)), но контактный урон от врагов отложила. История 004 (волны, чейзеры, тёмная зона) первой требует, чтобы враги могли убить игрока: тёмная зона по [zone.md](zone.md) урона не наносит, AI-стрельба врагов появится только в 006.

Без явного контракта 004 неявно зафиксирует contact damage в случайной системе (`MovementSystem` / `CombatSystem` / отдельный «touch system»), и каждое следующее расширение (boss-touch в 006, hazard в более поздних историях) переоткроет тот же вопрос.

## Decision

### Где живёт contact damage

- Контактный урон от врагов реализуется внутри `CombatSystem` ([projectiles-and-combat.md](projectiles-and-combat.md), [runtime-systems.md](runtime-systems.md)). Отдельная система не вводится: `CombatSystem` уже владеет формированием всех `DamageIntent` и единственной точкой обмена с `HealthDeathSystem`. Дублирование этой ответственности (отдельный `EnemyContactSystem`) увеличило бы число владельцев damage intents без выгоды.
- Решение распространяется только на **контакт врага с игроком**. Контакт босса с игроком (006) использует ту же модель и тот же `source.kind`; конкретные числа задаёт boss-архетип, не этот файл.

### Per-enemy state

- У каждой damageable-сущности с `contactDamage > 0` есть runtime-поле `nextContactSimMs: number`. На спавне оно равно `0` (то есть «может ударить с первого тика контакта»). После каждого успешно сформированного контактного `DamageIntent` поле поднимается на `archetype.contactCooldownMs` от `simTime` текущего тика.
- `nextContactSimMs` хранится **на самой сущности** в `EntityStore` ([health-and-death.md](health-and-death.md): «HP хранится на самой runtime-сущности»). Отдельный реестр кулдаунов не вводим — это сделало бы lifecycle контакта зависимым от двух источников истины.
- При смерти сущности её `nextContactSimMs` удаляется вместе с ней; «зомби-кулдауны» по умершему врагу не возможны.

### Фаза тика и порядок внутри `CombatSystem`

- В `CombatSystem` появляется **новая фаза contact intents**, добавленная к пятифазной модели снарядов из [projectiles-and-combat.md](projectiles-and-combat.md). Полный порядок фаз тика становится:
  1. firing decisions: спавн новых снарядов в `EntityStore`;
  2. projectile movement: интеграция позиций существующих снарядов;
  3. lifetime cleanup: пометка просроченных и вышедших за арену снарядов;
  4. **contact intents**: формирование `DamageIntent` от врагов в контакте с игроком (см. ниже);
  5. hit detection: damage intents от снарядов;
  6. removal: удаление помеченных снарядов из `EntityStore`.
- Контактные intents и снарядные intents складываются в **один** список `DamageIntent` за тик и передаются в `HealthDeathSystem` единым вызовом, как и сейчас. Никакой отдельной шины contact-damage не вводится.
- Порядок «contact intents до hit detection» намеренный: если игрок на одном тике одновременно получает попадание и стоит в контакте с врагом, обе intents попадают в один `applyDamage`, и порядок их применения уже задан правилом «hp = max(0, hp − amount), повторные intents в умершую цель игнорируются» из [health-and-death.md](health-and-death.md). Ни одна из ситуаций «попал в врага и тут же умер от его контакта в тот же тик» при этом не требует особой обработки.

### Контракт фазы contact intents

- На фазе `CombatSystem`:
  1. Берёт текущего игрока из `EntityStore`. Если игрок отсутствует или не имеет `HasHealth` ([health-and-death.md](health-and-death.md)) — фаза no-op.
  2. Через `SpatialIndex` ([runtime-systems.md](runtime-systems.md)) запрашивает соседей игрока в радиусе `player.radius + maxEnemyContactRadius`, где `maxEnemyContactRadius` — оценочная верхняя граница `enemy.radius` среди живых врагов. Конкретный способ оценки — деталь реализации (например, поддерживать `EntityStore.maxEnemyRadius()` или просто пройтись по результатам и отфильтровать по фактическому `enemy.radius`).
  3. Для каждого кандидата `enemy`:
     - если `enemy.contactDamage <= 0` — пропустить;
     - проверить circle-vs-circle overlap: `dist(player.position, enemy.position) <= player.radius + enemy.radius`;
     - если перекрытия нет — пропустить;
     - если `simTime < enemy.nextContactSimMs` — пропустить (на кулдауне);
     - иначе сформировать `DamageIntent` с `source.kind: 'enemyContact', enemyId: enemy.id`, `amount: enemy.contactDamage`, `hitPosition: player.position`. Поднять `enemy.nextContactSimMs = simTime + enemy.contactCooldownMs`.
- Никаких runtime events на стороне contact damage `CombatSystem` не публикует. Событие `hit` из [snapshot-shape.md](snapshot-shape.md) намеренно зарезервировано под снаряды и несёт `projectileId` как обязательное поле; для контактного урона отдельное событие появится позже, когда HUD/audio (007/008) запросят отдельную аудио/визуальную реакцию. До этого факт контактного урона восстанавливается из снапшота (падение `player.hp`) и не нуждается в отдельном edge-факте.

### Knockback at contact

- Контактный удар инициирует **knockback враг → от игрока**: на каждом успешном формировании контактного `DamageIntent` (см. выше) `CombatSystem` помимо intent выставляет на враге временный импульс. Player не отталкивается — это сознательный выбор для MVP, чтобы не вводить «толкаемого игрока» через тот же путь.
- Условие срабатывания knockback и условие формирования `DamageIntent` — **одни и те же**. Knockback не возникает «отдельно от урона»: если контакт не дал intent (кулдаун, нулевой `contactDamage`, мёртвый игрок) — knockback тоже не выставляется. Это держит side effect в одной точке принятия решения.
- Направление импульса:
  - `normal = normalize(enemy.position − player.position)` — вектор «от игрока к врагу»;
  - если расстояние нулевое (`enemy.position == player.position`) — fallback на `normalize(enemy.velocity)`; если и она нулевая — `(1, 0)`. Это вырожденный случай, важен только для тестов.
- Скорость импульса:
  ```
  approachSpeed = max(0, dot(player.velocity − enemy.velocity, normal))
  impulseSpeed  = archetype.knockbackBaseImpulse
                + archetype.knockbackVelocityScale * approachSpeed
  ```
  Здесь `approachSpeed` — компонента «насколько игрок и враг сходятся вдоль `normal`» (положительная, когда они сближаются; отрицательная отбрасывается). Знак выбран так, чтобы knockback усиливался при «лобовом» столкновении и был минимальным при «скользящем». Velocity-источники: `MovementSystem` тикает раньше `CombatSystem` ([runtime-systems.md](runtime-systems.md), update order шаги 5/6), значит на момент фазы contact intents оба velocity уже актуальны для текущего тика.
- Velocity хранится как runtime-поле на сущностях `Player` и `Enemy` (в `EntityStore`), но **не уходит в snapshot и не порождает runtime events**. Это деталь реализации, не публичный контракт; HUD/render восстанавливают визуальное движение интерполяцией позиций, как и раньше.
- На враге выставляются:
  ```
  enemy.knockback = {
    vx, vy,                                 // = impulseSpeed * normal
    startSimMs:  simTime,
    endSimMs:    simTime + archetype.knockbackDurationMs,
  }
  ```
  Если knockback уже активен (повторный контакт после `contactCooldownMs`) — поля **переписываются**, не складываются. Это исключает накопление импульса при удержании в контакте и согласуется с правилом «один контакт — одно правило» из основного раздела.
- Поведение `MovementSystem` для враг под knockback:
  - пока `simTime < enemy.knockback.endSimMs`, штатное `behavior` (`'chase'` и т. п.) **не применяется**; вместо этого враг двигается по затухающему knockback velocity:
    ```
    t = (simTime − enemy.knockback.startSimMs) / archetype.knockbackDurationMs
    decay = clamp(1 − t, 0, 1)            // линейное затухание; иная monotonically non-increasing кривая допустима
    enemy.position += (enemy.knockback.vx * decay, enemy.knockback.vy * decay) * SIM_STEP_SEC
    ```
  - конкретная кривая затухания (линейная / smoothstep / quadratic) — деталь реализации; контракт — «monotonically non-increasing к нулю в `endSimMs`, без знака», и враг возвращается к штатному `behavior` сразу после `endSimMs`;
  - `MovementSystem` для knockback-движения **не клампит** позицию враг по границам арены — это согласовано с уже принятым правилом «границы арены применяются только к управляемым актёрам» ([arena-and-coordinates.md](arena-and-coordinates.md), [runtime-systems.md](runtime-systems.md)). Враг может на короткое время отскочить за границу арены и вернётся chase-логикой обратно.
- Knockback **не отменяет** контактный кулдаун: если враг отскочил, но кулдаун `contactCooldownMs` ещё не истёк, повторного intent не будет даже при немедленном повторном перекрытии. Это согласовано с правилом «один враг бьёт не чаще, чем раз в `contactCooldownMs`».
- Параметры knockback — поля `EnemyArchetype` ([content-archetypes.md](content-archetypes.md)). Это намеренно: разные враги отскакивают по-разному (мелкий слайм отлетает дальше, «танк» — слабее), и привязка живёт в content, не в коде системы.

### Симметрия и расширение

- Игрок не наносит контактный урон врагам. Поле `contactDamage` живёт только на `EnemyArchetype` ([content-archetypes.md](content-archetypes.md)); у игрока его нет. Если такая механика когда-нибудь появится, это будет новое решение, а не «дописывание» этого.
- Контракт расширяется на босса 006 без правок: `BossArchetype` (когда появится) получит те же поля `contactDamage`/`contactCooldownMs`, и `CombatSystem` не отличает источник по типу сущности — он смотрит на `contactDamage > 0`.
- Контактный урон между двумя врагами (friendly fire) не реализуется: фаза смотрит только на пару «враг ↔ игрок». Это соответствует общему правилу `ownerKind`-based friendly fire из [projectiles-and-combat.md](projectiles-and-combat.md).
- Sweep-collision (быстрый враг прошёл через игрока за один тик) не вводится. Аналогично снарядам ([projectiles-and-combat.md](projectiles-and-combat.md): «без туннелирования»), это **контракт контента**: `enemy.maxSpeed * SIM_STEP_SEC <= enemy.radius + player.radius` обязан соблюдаться автором архетипа. Превышение фиксируется warning через единый log-модуль ([logging.md](logging.md)) на стороне content/builder.

## Consequences

- 004 получает контактный урон и knockback без введения новой системы; список систем `core runtime` остаётся прежним.
- Knockback контракт сосредоточен в одной точке (фаза contact intents `CombatSystem`, плюс реакция `MovementSystem` на временный knockback velocity). Дополнительной шины «impulses» не возникает.
- Параметры knockback — контентные; геймдизайн настраивает «ощущение шлепка» данными, не правкой систем.
- `HealthDeathSystem` получает урон от контакта по тому же механизму, что и от снарядов; player death через session-level hook автоматически срабатывает на оба источника.
- Боссу из 006 не понадобится отдельная contact-механика: достаточно полей в `BossArchetype` и того же фазового кода.
- Запрет sweep-collision и требование «не туннелировать через игрока» становятся проверяемыми на стороне content/builder, а не runtime.
- Если позже появится «hit»-событие для контакта (для звука/визуала), это будет расширение [snapshot-shape.md](snapshot-shape.md), не пересмотр этого решения.

## Related

- [runtime-systems.md](runtime-systems.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [health-and-death.md](health-and-death.md)
- [content-archetypes.md](content-archetypes.md)
- [snapshot-shape.md](snapshot-shape.md)
- [logging.md](logging.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
