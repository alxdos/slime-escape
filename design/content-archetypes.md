# Content Archetypes

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-24 (cleanup pass: legacy scalar `WeaponArchetype` and legacy `{ primaryWeaponArchetypeId }` `Loadout` removed; only the current 017 forms remain. `DropEffect` is no longer redefined here; the single source of truth is [drops.md](drops.md). `WeaponArchetype` carries no audio field by [audio.md](audio.md). 017 alignment: `WeaponArchetype` and `Loadout` follow [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). 018 alignment: optional field/status/drop-magnet/carrier extensions are owned by [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md). Earlier: story 016 impact feedback, story 013 sprite/contact boxes, story 012 MD-generated weapons/drops/bosses.)

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
    radius: number;                  // wu, legacy circle metric для не-мигрированных consumers; body-contact не читает его после body-contact-boxes.md
    contactBox: Readonly<{ width: number; height: number }>;  // wu, derive из sprite asset; owner body-contact и projectile target overlap для `player` / `enemy` / `boss`
    maxHp: number;                   // целое > 0
    behavior: EnemyBehavior;
    maxSpeed: number;                // wu/s, >= 0; для 'stationary' обязан быть 0
    contactDamage: number;           // целое >= 0; 0 = врага можно касаться без урона
    contactCooldownMs: number;       // целое > 0; интервал между двумя контактными ударами одного и того же врага
    knockbackBaseImpulse: number;    // wu/s, >= 0; базовая скорость отскока при нулевом сближении
    knockbackVelocityScale: number;  // безразмерный, >= 0; множитель добавки от approachSpeed
    knockbackDurationMs: number;     // целое > 0; длительность затухания knockback
    color: number;                   // 0xRRGGBB, slime material color for impact effects; base sprite remains PNG-driven
    dropTable: ReadonlyArray<DropTableEntry>;  // [] = враг ничего не дропает; правила выбора — drops.md
  }>;
  ```
- `behavior: 'stationary'` означает, что `MovementSystem` не двигает врага этого архетипа; `maxSpeed` для `'stationary'` обязан быть 0 — это правило валидируется на стороне content/builder, не runtime.
- `behavior: 'chase'` означает, что `MovementSystem` двигает врага к текущей позиции игрока с скоростью `maxSpeed`; конкретный alg (прямая линия / steering) — деталь реализации, контракт — «в среднем сокращает расстояние до игрока за тик». Дальнейшие поведения (`'wander'`, `'orbit'`, …) добавляются дописыванием в `EnemyBehavior` union, а не ветвями в `MovementSystem`.
- `contactBox` — axis-aligned footprint тела врага для body-contact и projectile hit detection по [body-contact-boxes.md](body-contact-boxes.md) и [projectiles-and-combat.md](projectiles-and-combat.md). На горизонте 013 не авторится руками в MD и derive-ится из sprite asset тем же scale pipeline, что и visual `worldSize`.
- `contactDamage` и `contactCooldownMs` — единственный источник правды для контактного урона; правила обработки — в [enemy-contact.md](enemy-contact.md). Если `contactDamage === 0`, кулдаун всё равно задаётся явно — отсутствие поля запрещено по тому же правилу единственности «нет данных».
- `knockbackBaseImpulse`, `knockbackVelocityScale`, `knockbackDurationMs` — параметры контактного knockback враг → от игрока; правила обработки — в [enemy-contact.md](enemy-contact.md), раздел `Knockback at contact`. Поля задаются всегда: «knockback'а нет» выражается явными нулями `knockbackBaseImpulse === 0 && knockbackVelocityScale === 0`, а не пропуском полей.
- `color` — slime material color for render-only impact effects ([impact-feedback.md](impact-feedback.md)): droplets/stains take their hue from the hit `enemy` / `boss`. Base sprite rendering still does not tint player/enemy/boss PNGs; visual identity remains the preloaded sprite from [sprite-assets.md](sprite-assets.md). Non-renderer consumers (debug overlay, мини-карта, tooling) may also use the field.
- Числовые ограничения, обязательные на стороне content/builder:
  - `maxSpeed * SIM_STEP_SEC <= min((contactBox.width + player.contactBox.width) / 2, (contactBox.height + player.contactBox.height) / 2)` ([enemy-contact.md](enemy-contact.md): запрет touring через игрока), warning через единый log-модуль ([logging.md](logging.md));
  - для `'stationary'` обязан быть `maxSpeed === 0`, `contactDamage === 0` и `knockbackBaseImpulse === 0 && knockbackVelocityScale === 0` (стационарная мишень не должна неявно бить и не должна прыгать); валидация на стороне content/builder.
- `dropTable` обязателен и задаётся всегда, даже если враг ничего не дропает: явное `[]` отличается от «забыли выставить» (см. правило «без двух разных «нет данных»). Дополнительные ограничения (каждый `chance ∈ [0, 1]`, сумма `chance` по таблице `<= 1`, все `archetypeId` резолвятся в реестре `DropArchetype`) — см. [drops.md](drops.md); их нарушение фиксируется warning через единый log-модуль на стороне content/builder и не доходит до runtime-фолбэка.

### WeaponArchetype

- Current shape:
  ```ts
  type WeaponArchetype = Readonly<{
    id: string;
    displayName: string;
    cooldownMs: number;
    firePattern: FirePattern;
    projectile: ProjectileArchetype;
  }>;
  ```
- Полные определения `FirePattern`, `ProjectileArchetype`, `ExplosionSpec`, `FragmentSpec`, projectile motion и связанных правил (in particular per-projectile `impactDamage`, `knockbackImpulse`, `hitRadius`, `pierceCount`, `groundOnImpact`, `explosion`, `visual`) — в [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). Здесь они не дублируются.
- `cooldownMs` — минимальный интервал между двумя последовательными выстрелами; конкретное использование через owner-local `WeaponInstance` — в [projectiles-and-combat.md](projectiles-and-combat.md) и [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md).
- Поле «бесконечный боезапас» из [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md) не выражается в архетипе: отсутствие поля `ammo` и есть его реализация. Когда (если) появится конечный боезапас, он добавится отдельным полем и отдельным design-решением.
- Builder validation проверяет вложенный `projectile` spec, включая no-tunneling constraints для каждого motion profile из [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md).
- `WeaponArchetype` не несёт аудио-поля. Связь оружия со звуком идёт по строковому `archetypeId` через `WEAPON_AUDIO_MAPPINGS` в `src/main/audio/**` ([audio.md](audio.md)); расширение `WeaponArchetype` аудио-полями запрещено.
- Миграция legacy одного-primary scalar weapon (`projectileSpeed`/`projectileRadius`/`projectileTtlMs`/`damage`/`knockbackImpulse`/`color`) — задача builder-а: scalar поля упаковываются в `firePattern: { kind: 'single', count: 1, spreadRadians: 0 }` и `projectile: { motion: { kind: 'linear', speed }, ... }` по правилам [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). Старая форма не остаётся валидной после 017.

### DropArchetype

- Минимальная форма:
  ```ts
  type DropArchetype = Readonly<{
    id: string;
    displayName: string;
    radius: number;          // wu, > 0; derive из PNG ([drops.md](drops.md), [sprite-assets.md](sprite-assets.md))
    ttlMs: number;           // целое > 0; время жизни на арене с момента спавна
    effect: DropEffect;
    color: number;           // 0xRRGGBB, плейсхолдер для рендера
  }>;
  ```
- `radius` — runtime-поле архетипа, но в content-pipeline это **derive**-значение из drop's PNG (полные правила — в [drops.md](drops.md)); MD-колонки для `radius` не существует.
- `DropEffect` (его union, `heal`, weapon-related kinds, pickup-modifier kind) — единственный источник правды [drops.md](drops.md). Здесь форма не дублируется.
- Полный контракт «как именно дроп спавнится, живёт и подбирается, и как применяется `DropEffect`» — в [drops.md](drops.md); здесь фиксируется только форма самого архетипа и его место в `content library`.

### BossArchetype

- Минимальная форма для 006:
  ```ts
  type BossArchetype = Readonly<{
    id: string;
    displayName: string;
    radius: number;                      // wu, legacy circle metric для не-мигрированных consumers
    contactBox: Readonly<{ width: number; height: number }>;  // wu, derive body footprint / projectile target shape
    maxHp: number;                       // целое > 0
    maxSpeed: number;                    // wu/s, >= 0; базовая скорость перемещения, если босс двигается
    color: number;                       // 0xRRGGBB, slime material color for impact effects; base sprite remains PNG-driven
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
- `contactBox` для босса следует тому же правилу, что и у `EnemyArchetype`: derive из sprite asset, owner body-contact и projectile target overlap.
- Минимум **две** записи в `phases` и минимум **два** различимых ключа в `attacks` для acceptance истории 006 ([../stories/006-boss-encounter.md](../stories/006-boss-encounter.md)); конкретный выбор атаки из `allowedAttackIds` и паттерна — `BossPhaseSystem` ([boss-encounter.md](boss-encounter.md)).
- `color` следует тому же правилу, что и `EnemyArchetype.color`: render-only slime impact effects читают его как цвет материала, base sprite renderer для `boss` его не читает, поле остаётся доступным и для non-renderer сценариев.

### PlayerArchetype

- Для content-area `players` (история 013) минимальная форма:
  ```ts
  type PlayerArchetype = Readonly<{
    id: string;
    displayName: string;
    radius: number;                                       // wu, legacy circle metric для не-мигрированных consumers
    contactBox: Readonly<{ width: number; height: number }>;  // wu, derive body footprint / projectile target shape
    maxSpeed: number;                                     // wu/s
    maxHp: number;                                        // целое > 0
  }>;
  ```
- `contactBox` у игрока следует тому же правилу, что и у `EnemyArchetype` / `BossArchetype`: derive из sprite asset по [body-contact-boxes.md](body-contact-boxes.md), используется для body-contact и projectile hit detection, без ручных MD-колонок на горизонте 013.
- `PlayerSpawn` в `SessionDefinition.player` собирается из `PlayerArchetype`, но остаётся отдельным контрактом уровня сессии, потому что хранит стартовую позицию и session-local форму.

### PlayerSpawn.maxHp

- `SessionDefinition.player` ([session-definition.md](session-definition.md)) расширяется обязательным полем `maxHp: number` (целое > 0). Это закрепляет источник правды для стартового HP игрока в данных сессии, а не в коде систем.
- `maxHp` задаётся **всегда**, даже для preset, в которых игрок не damageable (sandbox без боя). Это исключает «два разных нет данных» и упрощает HUD: для sandbox без боя `hp = maxHp` весь run.
- Конкретные значения (например, `5` для тренировочного preset) — содержимое `content library`. Расширение (`maxArmor`, регенерация и т. п.) — будущие решения.

### Loadout в SessionDefinition

- Current shape:
  ```ts
  type Loadout = Readonly<{
    weapons: ReadonlyArray<string>; // WeaponArchetype.id values
    selectedIndex: number | null;
  }>;
  ```
- Для sandbox-режима без боя `loadout` остаётся `null`; сборщик сессии явно различает «бой не предусмотрен» (`null`) и «есть оружие» (объект `Loadout`).
- `Loadout.weapons` is immutable session configuration. Runtime selection, cooldowns and upgrades live in owner-local weapon state ([universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)); slot switching does not mutate the session definition.
- Миграция legacy `{ primaryWeaponArchetypeId: string }` — задача builder-а: значение упаковывается в `{ weapons: [primaryWeaponArchetypeId], selectedIndex: 0 }`. Старая форма не остаётся валидной после 017.

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

- [body-contact-boxes.md](body-contact-boxes.md)
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
- [content-authoring.md](content-authoring.md)
- [sprite-assets.md](sprite-assets.md)
- [impact-feedback.md](impact-feedback.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)
