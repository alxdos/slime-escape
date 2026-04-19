# Content Archetypes

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-19

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

- Минимальная форма для 003:
  ```ts
  type EnemyArchetype = Readonly<{
    id: string;
    displayName: string;
    radius: number;        // wu, для коллизий и рендера
    maxHp: number;         // целое > 0
    behavior: 'stationary'; // 003: только неподвижная мишень
    color: number;         // 0xRRGGBB, плейсхолдер для рендера
  }>;
  ```
- `behavior: 'stationary'` означает, что `MovementSystem` не двигает врага этого архетипа. Расширения (`'chase'`, `'wander'`, …) добавляются 004-й историей через дописывание `behavior` union, а не через ветви в `MovementSystem`.
- `color` — плейсхолдер до появления полноценных ассетов. Это контентное поле, не decision рендера.

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
  - в `index.ts` реестры реэкспортируются вместе с уже существующими аренами/preset-ами.
- В реестре допускается одна структура: словарь `Record<string, Archetype>` с ключом, равным `archetype.id`. Это исключает рассинхрон между ключом и `id`.

## Consequences

- 003 кладёт первое содержимое реестров (одна мишень, один пистолет) в готовую форму; 004–006 расширяют те же реестры данными, не меняя форму.
- `SpawnSystem` и `CombatSystem` остаются не зависящими от конкретного контента и работают через резолв по `id`.
- `Loadout` входит в стабильный контракт `SessionDefinition`; UI выбора оружия (007) сможет собирать его, не переопределяя форму.
- Возможный плагинный/моддинг-слой архетипов (вне MVP) ляжет на ту же модель «реестр + id», без переписывания историй.

## Related

- [content-boundaries.md](content-boundaries.md)
- [session-definition.md](session-definition.md)
- [spawn-plan.md](spawn-plan.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [web-stack.md](web-stack.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [simulation-timing.md](simulation-timing.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
