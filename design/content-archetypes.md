# Content Archetypes

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-20 (для истории 006 добавлен `BossArchetype`, реестр `bosses` и правила фаз; полный контекст босс-энкаунтера — [boss-encounter.md](boss-encounter.md))

## Context

[content-boundaries.md](content-boundaries.md) фиксирует, что архетипы врагов, оружия и босса живут в `content library` (`src/shared/content/**`, см. [web-stack.md](web-stack.md)), но не задаёт их форму. История 003 вводит первое реальное содержимое библиотеки за пределами арены и игрока: один архетип врага и один архетип оружия. Без явного контракта:

- история 003 неявно зафиксирует поля архетипов в коде `content/**`;
- история 004 (волны), 005 (дроп) и 006 (босс) каждый раз будут добавлять/переименовывать поля по месту;
- `SpawnSystem` ([spawn-plan.md](spawn-plan.md)) и `CombatSystem` ([projectiles-and-combat.md](projectiles-and-combat.md)) начнут «знать» архетипы по полю, а не по контракту.

Дополнительно: `SessionDefinition.loadout` ([session-definition.md](session-definition.md)) сейчас допускается как `null`. Когда в 003 у игрока появляется оружие, нужно зафиксировать минимальную форму loadout, а не вводить её «по месту» в `content/**`.

## Decision

### Общие правила архетипов

- Архетип — это **read-only описание** игрового элемента, не runtime state. Архетипы живут в `src/shared/content/**` и не мутируются во время сессии ([content-boundaries.md](content-boundaries.md)).
- Каждый архетип имеет стабильный строковый `id`. `id` уникален в пределах своего реестра (`enemies`, `weapons`, `bosses`, …) и не переиспользуется при удалении.
- Ссылки в `SessionDefinition`, `EncounterDefinition`, `SpawnPlan` и runtime state на архетипы — только по `id`, не по объекту. Резолв `id → archetype` выполняется один раз при старте сессии: builder сессии и/или `SpawnSystem`/`CombatSystem` строят локальные карты `Map<id, archetype>`. Это исключает «потерянные» ссылки на старый объект, если контент в библиотеке поменяется между сборками.
- Неизвестный `id` при резолве — ошибка сборки/старта сессии, не runtime-фолбэк.
- Расширение архетипа допускается только **дописыванием** новых полей. Переименование или смена семантики поля = новое design-решение и обновление этого файла.
- Все размерности — в world units / wu в секунду / миллисекундах симуляции, чтобы не зависеть от рендера ([arena-and-coordinates.md](arena-and-coordinates.md), [simulation-timing.md](simulation-timing.md)).

### EnemyArchetype

- Форма на горизонт 005:
  ```ts
  type EnemyBehavior = 'stationary' | 'chase';

  type DropTableEntry = Readonly<{
    archetypeId: string;             // DropArchetype.id из реестра drops в content library
    chance: number;                  // [0, 1]
  }>;

  type EnemyArchetype = Readonly<{
    id: string;
    displayName: string;
    radius: number;                  // wu, для коллизий и рендера
    maxHp: number;                   // целое > 0
    behavior: EnemyBehavior;
    maxSpeed: number;                // wu/s, >= 0; для 'stationary' обязан быть 0
    contactDamage: number;           // целое >= 0; 0 = врага можно касаться без урона
    contactCooldownMs: number;       // целое > 0; интервал между двумя контактными ударами одного и того же врага
    knockbackBaseImpulse: number;    // wu/s, >= 0; базовая скорость отскока при нулевом сближении
    knockbackVelocityScale: number;  // безразмерный, >= 0; множитель добавки от approachSpeed
    knockbackDurationMs: number;     // целое > 0; длительность затухания knockback
    color: number;                   // 0xRRGGBB, плейсхолдер для рендера
    dropTable: ReadonlyArray<DropTableEntry>;  // [] = враг ничего не дропает; правила выбора — drops.md
  }>;
  ```
- `behavior: 'stationary'` означает, что `MovementSystem` не двигает врага этого архетипа; `maxSpeed` для `'stationary'` обязан быть 0 — это правило валидируется на стороне content/builder, не runtime.
- `behavior: 'chase'` означает, что `MovementSystem` двигает врага к текущей позиции игрока с скоростью `maxSpeed`; конкретный alg (прямая линия / steering) — деталь реализации, контракт — «в среднем сокращает расстояние до игрока за тик». Дальнейшие поведения (`'wander'`, `'orbit'`, …) добавляются дописыванием в `EnemyBehavior` union, а не ветвями в `MovementSystem`.
- `contactDamage` и `contactCooldownMs` — единственный источник правды для контактного урона; правила обработки — в [enemy-contact.md](enemy-contact.md). Если `contactDamage === 0`, кулдаун всё равно задаётся явно — отсутствие поля запрещено по тому же правилу единственности «нет данных».
- `knockbackBaseImpulse`, `knockbackVelocityScale`, `knockbackDurationMs` — параметры контактного knockback враг → от игрока; правила обработки — в [enemy-contact.md](enemy-contact.md), раздел `Knockback at contact`. Поля задаются всегда: «knockback'а нет» выражается явными нулями `knockbackBaseImpulse === 0 && knockbackVelocityScale === 0`, а не пропуском полей.
- `color` — плейсхолдер до появления полноценных ассетов. Это контентное поле, не decision рендера.
- Числовые ограничения, обязательные на стороне content/builder:
  - `maxSpeed * SIM_STEP_SEC <= radius + minPlayerRadius` ([enemy-contact.md](enemy-contact.md): запрет touring через игрока), warning через единый log-модуль ([logging.md](logging.md));
  - для `'stationary'` обязан быть `maxSpeed === 0`, `contactDamage === 0` и `knockbackBaseImpulse === 0 && knockbackVelocityScale === 0` (стационарная мишень не должна неявно бить и не должна прыгать); валидация на стороне content/builder.
- `dropTable` обязателен и задаётся всегда, даже если враг ничего не дропает: явное `[]` отличается от «забыли выставить» (см. правило «без двух разных «нет данных»). Дополнительные ограничения (каждый `chance ∈ [0, 1]`, сумма `chance` по таблице `<= 1`, все `archetypeId` резолвятся в реестре `DropArchetype`) — см. [drops.md](drops.md); их нарушение фиксируется warning через единый log-модуль на стороне content/builder и не доходит до runtime-фолбэка.

### WeaponArchetype

- Минимальная форма для 003:
  ```ts
  type WeaponArchetype = Readonly<{
    id: string;
    displayName: string;
    cooldownMs: number;          // целое > 0, кратное SIM_STEP_MS не требуется
    projectileSpeed: number;      // wu/s, > 0
    projectileRadius: number;     // wu, > 0
    projectileTtlMs: number;      // ms, > 0; despawn по истечении
    damage: number;               // целое > 0
    color: number;                // 0xRRGGBB, плейсхолдер для рендера снаряда
  }>;
  ```
- `cooldownMs` — минимальный интервал между двумя последовательными выстрелами; конкретное использование (per-shooter timer) — в [projectiles-and-combat.md](projectiles-and-combat.md).
- Поле «бесконечный боезапас» из [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md) не выражается в архетипе: отсутствие поля `ammo` и есть его реализация. Когда (если) появится конечный боезапас, он добавится отдельным полем и отдельным design-решением.
- Скорости и радиусы должны соблюдать инвариант «без туннелирования» из [projectiles-and-combat.md](projectiles-and-combat.md); проверка — на стороне content/builder, не на стороне рантайма.

### DropArchetype

- Минимальная форма для 005:
  ```ts
  type DropEffect =
    | { kind: 'heal'; amount: number };   // amount > 0; future: weapon swap, modifier и т. п.

  type DropArchetype = Readonly<{
    id: string;
    displayName: string;
    radius: number;          // wu, > 0; для overlap-теста и рендера
    ttlMs: number;           // целое > 0; время жизни на арене с момента спавна
    effect: DropEffect;
    color: number;           // 0xRRGGBB, плейсхолдер для рендера
  }>;
  ```
- `DropEffect` — дискриминированный union по `kind`. Расширение происходит **добавлением** новых `kind` (новые слои силы и боеприпасов в будущем); переименование/смена семантики поля — новое решение и обновление этого файла, не «дописывание по месту».
- Полный контракт «как именно дроп спавнится, живёт и подбирается, и как применяется `DropEffect`» — в [drops.md](drops.md); здесь фиксируется только форма архетипа и его место в `content library`.

### BossArchetype

- Минимальная форма для 006:
  ```ts
  type BossArchetype = Readonly<{
    id: string;
    displayName: string;
    radius: number;                      // wu
    maxHp: number;                       // целое > 0
    maxSpeed: number;                    // wu/s, >= 0; базовая скорость перемещения, если босс двигается
    color: number;                       // 0xRRGGBB
    contactDamage: number;
    contactCooldownMs: number;
    knockbackBaseImpulse: number;
    knockbackVelocityScale: number;
    knockbackDurationMs: number;
    phases: ReadonlyArray<Readonly<{
      id: string;
      allowedAttackIds: ReadonlyArray<string>;  // не пусто; каждый id есть в `attacks`
      /** Покинуть фазу и перейти к следующей, когда `hp/maxHp <= exitWhenHpFractionAtOrBelow`. Для **последней** фазы значение не используется (перехода за пределы `phases` нет). Пороги задаёт content/builder (см. [../docs/BOSS.md](../docs/BOSS.md)). */
      exitWhenHpFractionAtOrBelow: number;
    }>>;
    attacks: Readonly<Record<string, Readonly<{ pattern: string; cooldownMs: number; damage: number }>>>;
  }>;
  ```
- Контакт с игроком и knockback следуют тем же правилам, что и `EnemyArchetype` ([enemy-contact.md](enemy-contact.md)); числа задаются в архетипе босса.
- Минимум **две** записи в `phases` и минимум **два** различимых ключа в `attacks` для acceptance истории 006 ([../stories/006-boss-encounter.md](../stories/006-boss-encounter.md)); конкретный выбор атаки из `allowedAttackIds` и паттерна — `BossPhaseSystem` ([boss-encounter.md](boss-encounter.md)).

### PlayerSpawn.maxHp

- `SessionDefinition.player` ([session-definition.md](session-definition.md)) расширяется обязательным полем `maxHp: number` (целое > 0). Это закрепляет источник правды для стартового HP игрока в данных сессии, а не в коде систем.
- `maxHp` задаётся **всегда**, даже для preset, в которых игрок не damageable (sandbox без боя). Это исключает «два разных нет данных» и упрощает HUD: для sandbox без боя `hp = maxHp` весь run.
- Конкретные значения (например, `5` для тренировочного preset) — содержимое `content library`. Расширение (`maxArmor`, регенерация и т. п.) — будущие решения.

### Loadout в SessionDefinition

- `SessionDefinition.loadout` для preset-режимов с боем имеет минимальную форму:
  ```ts
  type Loadout = Readonly<{
    primaryWeaponArchetypeId: string;  // ссылка в content library: weapons
  }>;
  ```
- Для sandbox-режима без боя `loadout` остаётся `null`; сборщик сессии явно различает «бой не предусмотрен» (`null`) и «есть оружие» (объект Loadout).
- Расширения (вторичное оружие, granat-слот, пассивные модификаторы) добавляются дописыванием полей. Удалять `primaryWeaponArchetypeId` нельзя без `superseded` этого решения.
- `Loadout` остаётся неизменным после старта сессии; смена оружия в run в MVP не предусмотрена.

### Реестры в content library

- Структура каталога `src/shared/content/**` дополняется реестрами по типам контента (фактическое имя файла — деталь реализации, не часть контракта):
  - реестр `EnemyArchetype` (например, `enemies.ts`);
  - реестр `WeaponArchetype` (например, `weapons.ts`);
  - реестр `DropArchetype` (например, `drops.ts`);
  - реестр `BossArchetype` (например, `bosses.ts`);
  - в `index.ts` реестры реэкспортируются вместе с уже существующими аренами/preset-ами.
- В реестре допускается одна структура: словарь `Record<string, Archetype>` с ключом, равным `archetype.id`. Это исключает рассинхрон между ключом и `id`.

## Consequences

- 003 кладёт первое содержимое реестров (одна мишень, один пистолет) в готовую форму; 004–006 расширяют те же реестры данными; 006 добавляет реестр `bosses` без ломки существующих форм.
- `SpawnSystem` и `CombatSystem` остаются не зависящими от конкретного контента и работают через резолв по `id`.
- `Loadout` входит в стабильный контракт `SessionDefinition`; UI выбора оружия (007) сможет собирать его, не переопределяя форму.
- Возможный плагинный/моддинг-слой архетипов (вне MVP) ляжет на ту же модель «реестр + id», без переписывания историй.

## Related

- [content-boundaries.md](content-boundaries.md)
- [session-definition.md](session-definition.md)
- [spawn-plan.md](spawn-plan.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [enemy-contact.md](enemy-contact.md)
- [health-and-death.md](health-and-death.md)
- [drops.md](drops.md)
- [logging.md](logging.md)
- [web-stack.md](web-stack.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [simulation-timing.md](simulation-timing.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
- [boss-encounter.md](boss-encounter.md)
