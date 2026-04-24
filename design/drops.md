# Drops

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-24 (sprite extension: `Drop` rendering moves from primitives to PNG sprites by [sprite-assets.md](sprite-assets.md); `dropVisuals` registry keyed by `dropArchetypeId` is added there, sourced from inline image-узлов в `content/drops.md`. cleanup pass: `DropEffect` is the single source of truth for the union; `kind: 'pickupModifier'` is added explicitly here as the binding point for drop magnet from [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md). 017 alignment: `DropEffect` includes weapon modifier and temporary overdrive effects from [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). 018 alignment: drop magnet uses the new `pickupModifier` kind; carrier drops are defined by [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md).)

## Context

[runtime-systems.md](runtime-systems.md) уже фиксирует существование `DropSystem`, его место в update order (после `HealthDeathSystem`, до `ZoneSystem`/`SnapshotExportSystem`), три ожидаемых runtime events (`spawn`/`pickup`/`expire`) и правило «`DropSystem` реагирует на death hooks и управляет только жизненным циклом дропа». [health-and-death.md](health-and-death.md) перечисляет `DropSystem` как канонического потребителя `DeathHook`. [content-boundaries.md](content-boundaries.md) фиксирует, что таблицы дропа живут в `content library`. Но не описано:

- форма самой сущности `Drop` и где она живёт;
- форма `DropArchetype` и `DropEffect`;
- форма drop table и правило выбора (one weighted pick vs независимые роллы);
- правило применения эффекта к игроку и его место относительно `HealthDeathSystem`;
- порядок «спавн-на-death-hook → ttl/pickup на тике» внутри `DropSystem`;
- источник случайности (одна `nextFloat` на смерть, через session RNG).

История 005 первой делает дроп играбельным. Без явного контракта 005 неявно зафиксирует и форму drop-сущности, и место heal-эффекта, и алгоритм ролла; 006 (boss) и будущие истории про инвентарь/реворды переоткроют те же вопросы.

## Decision

### Drop как runtime-сущность

- Drop — отдельная runtime-сущность с собственным `id` и `kind: 'drop'`. Хранится в `EntityStore` рядом с игроком, врагами и снарядами; собственного «пула дропа» в обход store не вводим, по той же причине, что и для снарядов ([projectiles-and-combat.md](projectiles-and-combat.md)).
- Минимальный runtime state дропа:
  ```ts
  type Drop = {
    id: EntityId;
    kind: 'drop';
    archetypeId: string;            // DropArchetype.id из content library
    radius: number;                  // wu, копия из DropArchetype.radius
    effect: DropEffect;              // копия из архетипа
    color: number;                   // копия из архетипа, плейсхолдер для рендера
    expireAtSimMs: number;           // момент despawn по ttl
    position: { x: number; y: number };
  };
  ```
- Поля `radius`, `effect`, `color`, `expireAtSimMs` копируются из архетипа в момент создания, чтобы tick не зависел от лишних lookup-ов и оставался стабильным даже при будущих мутациях архетипа в редакторе/тестах. Это та же модель, что у `Projectile` ([projectiles-and-combat.md](projectiles-and-combat.md)).
- Drop не имеет `hp` или `behavior`. Baseline drops do not move. Story 018 adds deterministic magnet attraction owned by `DropSystem`; that extension is defined in [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md) and does not change drop ownership.
- Drop **не damageable**: `HasHealth` ([health-and-death.md](health-and-death.md)) у дропа нет, `HealthDeathSystem` дроп не трогает. Удалением дропа владеет только `DropSystem` — это согласовано с уже принятым правилом «для снарядов и дропа удалением владеют их собственные системы» ([projectiles-and-combat.md](projectiles-and-combat.md)).
- Drop попадает в snapshot отдельным `kind` (см. [snapshot-shape.md](snapshot-shape.md)). Рендер выбирает визуал по `archetypeId` через `dropVisuals` registry ([sprite-assets.md](sprite-assets.md)), а не по `id` сущности и не по `color`. Поле `color` остаётся в `DropArchetype` как placeholder для не-renderer consumer-ов; base sprite renderer drop-PNG им не tint-ит.

### DropArchetype и DropEffect

- `DropArchetype` живёт в `content library` (`src/shared/content/**`, [web-stack.md](web-stack.md)) и подчиняется общим правилам архетипов из [content-archetypes.md](content-archetypes.md): read-only, стабильный строковый `id`, ссылки только по `id`, расширение только дописыванием.
- Полный текущий union (этот файл — единственный источник правды; другие design-файлы ссылаются сюда, не дублируют):
  ```ts
  type DropEffect =
    // baseline (005)
    | { kind: 'heal'; amount: number }
    // weapon modifiers (017, see universal-weapons-and-projectiles.md for WeaponModifier)
    | { kind: 'addWeaponModifier'; modifier: WeaponModifier; target: 'selectedWeapon' }
    | { kind: 'temporaryOverdrive'; cooldownMultiplier: number; durationMs: number; target: 'selectedWeapon' }
    // pickup-comfort modifiers (018, see combat-modifiers-and-field-effects.md for PickupModifier)
    | { kind: 'pickupModifier'; modifier: PickupModifier };

  type DropArchetype = Readonly<{
    id: string;
    displayName: string;
    radius: number;          // wu, > 0; для overlap-теста и рендера; derive из PNG, см. ниже
    ttlMs: number;           // целое > 0; время жизни на арене с момента спавна
    effect: DropEffect;
    color: number;           // 0xRRGGBB, плейсхолдер для рендера
  }>;
  ```
- `radius` — runtime-поле архетипа и одновременно **derive**-значение в content-pipeline: content-build считает его как `min(worldSize.width, worldSize.height) / 2` соответствующей записи `dropVisuals[dropArchetypeId]` per [sprite-assets.md](sprite-assets.md). В `content/drops.md` колонки `radius` нет — drop's PNG является единственным источником правды и для визуала, и для pickup overlap. Если в будущем понадобится разнести «визуал» и «pickup zone» (по аналогии с `projectile.size` vs `hitRadius`), вводится отдельное поле `pickupRadius`/`pickupBox` отдельным design-решением.
- `DropEffect` — дискриминированный union по `kind`. Расширение только добавлением новых `kind`; переименование/смена семантики поля = новое решение и обновление этого файла.
- `DropEffect.kind: 'heal'` keeps the 005 healing semantics described below. `addWeaponModifier`/`temporaryOverdrive` semantics live in [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). `pickupModifier` semantics (drop magnet и будущие pickup-comfort modifier-ы) живут в [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md); `DropSystem` владеет mutating owner-local pickup-related player state по этому `kind`.
- Реестр `DropArchetype` в `content library` имеет ту же форму, что и реестры `EnemyArchetype`/`WeaponArchetype` из [content-archetypes.md](content-archetypes.md): словарь `Record<string, DropArchetype>` с ключом, равным `archetype.id`. Конкретный файл (например, `src/shared/content/drops.ts`) — деталь реализации, не контракт.

### Drop table на EnemyArchetype

- Связь «какой враг что дропает» живёт на `EnemyArchetype` ([content-archetypes.md](content-archetypes.md)) полем `dropTable`:
  ```ts
  type DropTableEntry = Readonly<{
    archetypeId: string;     // DropArchetype.id из content library
    chance: number;          // [0, 1]
  }>;

  // у EnemyArchetype дополнительное поле:
  // dropTable: ReadonlyArray<DropTableEntry>
  ```
- Отдельной сущности «DropTable» с собственным `id` нет: одна таблица — одно поле архетипа врага. Это сознательно: 005 не вводит шаринг таблиц между врагами, и если он понадобится позже, это будет отдельным решением (ссылка по `dropTableId` поверх существующего поля), не «дописыванием по месту».
- Семантика выбора — **один weighted pick на смерть**, не последовательные независимые роллы. Алгоритм:
  1. `roll = rng.nextFloat()` — ровно один вызов session RNG на каждое срабатывание hook ([rng.md](rng.md));
  2. идём по `dropTable` в порядке индексов, аккумулируя `chance`. Первый entry, у которого `accumulated > roll`, выигрывает;
  3. если суммарный `chance` в таблице меньше единицы и `roll >= sum(chances)`, дропа на этой смерти **нет** — это и есть способ выразить «ничего не выпало».
- Baseline death processing gives **не более одного weighted-pick дропа** за смерть. Story 018 may add explicit guaranteed carrier rewards; those must still be spawned by `DropSystem` from death hooks and must not replace the baseline weighted-pick rule silently.
- Числовые ограничения, обязательные на стороне content/builder:
  - `chance` каждого entry в `[0, 1]`;
  - суммарный `chance` по таблице `<= 1` (нарушение — warning через `log.warn` при сборке/старте сессии, [logging.md](logging.md); это контентная ошибка, а не runtime-фолбэк);
  - все `archetypeId` из `dropTable` обязаны резолвиться в реестре `DropArchetype` — неизвестный `id` = ошибка сборки сессии, не runtime-фолбэк (то же правило, что и для других архетипов в [content-archetypes.md](content-archetypes.md)).
- Пустой `dropTable` (`[]`) — валидное значение и означает «этот враг ничего не дропает». Поле `dropTable` обязательно: явное `[]` отличается от «забыли выставить» и держит правило «без двух разных «нет данных» из [content-archetypes.md](content-archetypes.md).

### Жизненный цикл `DropSystem`

- `DropSystem` имеет две точки входа: hook на смерть (вне обычного update tick) и собственный tick в update order ([runtime-systems.md](runtime-systems.md), шаг `DropSystem`).
- На старте симуляции (в одной точке регистрации, наравне с другими hook-ами по [health-and-death.md](health-and-death.md)) `DropSystem` регистрирует `DeathHook`, реагирующий только на `entityKind === 'enemy'` (см. ниже).
- На `sessionStart`/`stopSession` (а также при автоматическом завершении run по `win`/`loss`, [runtime-systems.md](runtime-systems.md)) внутренний state `DropSystem` сбрасывается. Дропы в `EntityStore` удаляются вместе с остальным runtime state в общей точке сброса; `DropSystem` сам не несёт «сохранения дропа между сессиями».
- На `encounterEnd` дропы **не зачищаются автоматически**: «забытый» дроп сохраняется в `EntityStore` и доступен в следующем encounter-е до своего ttl. Это намеренно: GDD ([../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)) допускает «дроп после волны как награда из тьмы», и удаление по `encounterEnd` нарушит этот сценарий. Если позже это правило поменяется, оно фиксируется здесь, не «по месту».

### Spawn on death hook

- Hook `DropSystem` срабатывает синхронно в фазе `runDeathHooks` ([health-and-death.md](health-and-death.md), шаг 4 порядка внутри тика).
- Hook видит `DeathContext`: `entityId`, `entityKind`, `archetypeId`, `position`, `cause`, `simTime`.
- Шаги hook:
  1. если `entityKind !== 'enemy'` — выйти. Дроп не падает с игрока (или будущего kind), даже если у него технически появится `dropTable`. На горизонт 005 `dropTable` живёт только на `EnemyArchetype`, но фильтр в hook оставлен явным как защита от расширений.
  2. резолвить `EnemyArchetype` по `archetypeId` через карту, построенную при старте сессии ([content-archetypes.md](content-archetypes.md): «резолв `id → archetype` выполняется один раз при старте сессии»). Если `archetype` — `null`/`undefined`, это нарушение контракта сборки сессии: hook не пытается «починить» данные, а пишет `log.error` и выходит без спавна ([logging.md](logging.md)).
  3. если `archetype.dropTable` пуст — выйти без спавна. RNG в этом случае **не дёргается**: пустая таблица — это ноль роллов, и порядок последовательности RNG зависит только от случаев, в которых дроп реально может выпасть. Это упрощает воспроизводимость и тесты.
  4. иначе сделать ровно один `rng.nextFloat()` и выбрать `DropArchetype` по правилу из «Drop table» выше. Если выбран `null` (roll промахнулся мимо суммы chances) — выйти без спавна.
  5. иначе вызвать `EntityStore.spawnDrop(spec)` с `position = ctx.position` и `expireAtSimMs = ctx.simTime + dropArchetype.ttlMs`. Опубликовать runtime event `dropSpawn` ([snapshot-shape.md](snapshot-shape.md)).
- Hook **не** наносит урон, не модифицирует HP других сущностей и не запускает каскадных смертей — это согласовано с правилами hook из [health-and-death.md](health-and-death.md).
- На момент работы hook мёртвый враг ещё доступен в `EntityStore` (его удаление — шаг 5 порядка внутри тика). `DropSystem` опирается только на `ctx.position`, не читает `EntityStore.enemyById(ctx.entityId)`. Это держит hook независимым от внутреннего порядка чистки.

### Per-tick: ttl и pickup

- В фазе `DropSystem` тика (после `HealthDeathSystem.removeDead()`, до `ZoneSystem`) система проходит по всем дропам в `EntityStore` и принимает решения в строго заданном порядке:
  1. **ttl expiry**: если `simTime >= drop.expireAtSimMs` — пометить на удаление и **сначала** опубликовать `dropExpire` (см. [snapshot-shape.md](snapshot-shape.md)). Pickup в этот же шаг для этого дропа уже невозможен: один дроп = одно событие конца жизни (`dropPickup` или `dropExpire`, не оба).
  2. **pickup detection**: для дропов, не помеченных на удаление по ttl, проверить overlap с игроком: `dist(player.position, drop.position) <= player.radius + drop.radius`. Если игрок отсутствует (`store.player() === null`) — фаза pickup для всех дропов no-op (это согласовано с общей толерантностью систем к `player === null` из [health-and-death.md](health-and-death.md)).
  3. при overlap: применить `drop.effect` (см. ниже), пометить дроп на удаление, опубликовать `dropPickup`.
  4. удалить помеченные дропы из `EntityStore`.
- Порядок «ttl до pickup» намеренный: на тике, в котором дроп истёк ровно одновременно с overlap-ом, он считается expired, а не picked-up. Это устраняет неоднозначность «успел/не успел» в одном тике и делает поведение детерминированным. Для частот тика проекта (`SIM_HZ = 60`, [simulation-timing.md](simulation-timing.md)) ситуация «однотиковое совпадение» возможна только при `ttlMs`, точно кратном `SIM_STEP_MS`, и не считается значимой для UX.
- `SpatialIndex` ([runtime-systems.md](runtime-systems.md)) для pickup на горизонт 005 не обязателен: число дропов на арене мало (десятки максимум), линейный проход дешевле. Если в будущем профайлинг покажет нагрузку, использование `SpatialIndex` в фазе `DropSystem` — деталь реализации, не контракт.
- `DropSystem` не двигает дропы и не клампит их к границам арены: дроп всегда спавнится в позиции смерти врага, которая по контракту [arena-and-coordinates.md](arena-and-coordinates.md) уже находится внутри арены (враг не может быть за границами в момент смерти). Если будущая механика разрешит «дроп за пределами арены», это будет отдельное решение.

### Применение эффекта

- Эффект применяется внутри `DropSystem` в фазе pickup, синхронно, до публикации `dropPickup`. Это значит, что состояние, в котором HUD/audio увидят `dropPickup` event, уже отражает применённый эффект (HP игрока поднят, предмет ушёл из `EntityStore`).
- На 005 единственная реализация — `DropEffect.kind: 'heal'`:
  ```
  player.hp = min(player.maxHp, player.hp + effect.amount)
  ```
  - `amount > 0` обеспечивает контент;
  - `min(player.maxHp, ...)` — единственный кламп; «overheal» не вводится и потребует отдельного решения, если когда-нибудь понадобится;
  - heal на мёртвом игроке невозможен по построению: фаза pickup no-op при `player === null`, а игрок уже удалён к этому моменту, если умер на этом тике.
- `HealthDeathSystem` остаётся **единственным владельцем decrement HP** ([health-and-death.md](health-and-death.md): «`CombatSystem` не имеет права читать или мутировать HP. Все вычитания выполняет только `HealthDeathSystem`.»). Heal — это **increment**, и его явно владеет `DropSystem`. Отдельной системы «buff/heal application» в MVP не вводим: одна точка «положительной мутации HP» — `DropSystem`. Если появятся другие источники heal (например, регенерация со временем или эффект от босса), это будет отдельное решение, и тогда же обсуждается общая «эффект-шина».
- `DropSystem` **не** формирует `DamageIntent` и **не** вызывает `HealthDeathSystem`. Heal не должен порождать death event, не должен запускать death hook и не должен попадать в общий `applyDamage`-тик.
- Никакая другая система не имеет права применять `DropEffect`. `DropEffect` — это контракт «что делает дроп при подборе», а не общий `EffectIntent` для произвольных источников.
- Weapon modifier and overdrive effects mutate owner-local weapon state through the narrow runtime API defined by [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). `DropSystem` still owns pickup and removal; it does not spawn projectiles.
- `pickupModifier` effects mutate owner-local pickup-related player state owned by `DropSystem` itself (см. [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)). `HealthDeathSystem` и `CombatSystem` этой части state не касаются.

### Друг-враг и ownership

- На 005 дроп подбирает только игрок. Враги дроп не подбирают: фаза pickup смотрит только на пару «player ↔ drop», не итерирует по врагам. Это согласовано с общим правилом `ownerKind`-based взаимодействий из [projectiles-and-combat.md](projectiles-and-combat.md): у дропа owner-а нет, потому что он не «принадлежит» стрелку — он принадлежит арене с момента спавна.
- Если когда-нибудь понадобятся враги-сборщики или союзные NPC, это решение расширяется в части «who picks up», но контракт «один pickup = одно событие, один эффект» сохраняется.

### Источник случайности

- Единственный источник случайности в `DropSystem` — session RNG ([rng.md](rng.md)). На 005 это:
  - один `rng.nextFloat()` на каждый dropTable-роллу при смерти врага с непустой таблицей.
- `Math.random`/`Date.now`/`performance.now` в `DropSystem` запрещены, как и в любой другой части `src/sim/**` ([rng.md](rng.md)).
- Детерминизм: при одинаковом `seed` и одинаковой последовательности тиков и смертей последовательность дропов (что и где выпало) идентична. Это явно покрывается тестом по [testing.md](testing.md).
- Позиция дропа полностью определяется позицией смерти врага и не требует отдельного RNG-вызова. «Случайный jitter позиции при выпадении» (если когда-нибудь захочется) добавится отдельным решением и в конце последовательности RNG-вызовов на смерть, чтобы не сбивать существующие записанные тесты.

## Consequences

- 005 получает компактный контракт: «дроп — сущность с своим kind, drop table — поле архетипа врага, ровно один weighted pick на смерть, ttl и pickup живут в `DropSystem`, heal мутирует `player.hp` напрямую и публикует `dropPickup`».
- `HealthDeathSystem` остаётся единственной точкой decrement HP и death; добавление heal не размывает его ответственность.
- `EntityStore` получает третью сущность с собственным lifecycle (после `Projectile`); правило «удаление дропов и снарядов — за их собственными системами» закрепляется как общий паттерн, к которому естественно подключатся будущие short-lived сущности (например, временные effect-визуализации).
- Расширения «второй эффект, weapon-pickup, magnet, шаринг таблиц между врагами» закладываются как точки расширения union-ов и ссылок, не «дописывание форм по месту».
- Риск 1-тикового лагерства heal: если игрок умирает в том же тике, в котором стоит на дропе, heal применится **только в следующем тике**, которого не будет (player удалён в `HealthDeathSystem`). На частоте `SIM_HZ = 60` это незаметно и сознательно: альтернатива «heal до damage» сломала бы единственность точки decrement HP. Документировано здесь как допустимый край.
- Drop **не** взаимодействует с `ZoneSystem` ([zone.md](zone.md)): зона не наносит урона, и дроп под тёмной зоной по-прежнему лежит и подбирается. Это сохраняет gdd-вариант «риск идти в тьму за дропом».
- Архетип дропа физически живёт в `content library`; добавление новых эффектов и архетипов не требует правок систем за пределами расширения union-а `DropEffect`.

## Related

- [runtime-systems.md](runtime-systems.md)
- [health-and-death.md](health-and-death.md)
- [snapshot-shape.md](snapshot-shape.md)
- [content-archetypes.md](content-archetypes.md)
- [content-boundaries.md](content-boundaries.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [rng.md](rng.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [simulation-timing.md](simulation-timing.md)
- [logging.md](logging.md)
- [testing.md](testing.md)
- [zone.md](zone.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)
