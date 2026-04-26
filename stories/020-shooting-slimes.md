# Три уровня сложности кампании

- Status: planned
- Created: 2026-04-24
- Updated: 2026-04-25 (architect: новые design-решения [non-player-firing.md](../design/non-player-firing.md) и [landing-telegraph.md](../design/landing-telegraph.md), правки [spawn-overrides.md](../design/spawn-overrides.md) с полем `loadout`, [snapshot-shape.md](../design/snapshot-shape.md) с `ProjectileSnapshot.arcEnd`, [content-authoring.md](../design/content-authoring.md) с двумя новыми колонками override-таблицы. Player-facing переписан вокруг трёх pillar-ов сложностей; Acceptance расширен per-set hard-прогрессией; Tasks полностью продроблены и готовы к взятию в работу после закрытия 019.)

## Player-facing

В меню вместо одной кампании — три пункта (`easy` / `normal` / `hard`). Все три доступны сразу, без условий разблокировки. Каждая читается как **другая игра** уже в первой волне. Нет «той же кампании на повышенной сложности»: цифры подкручены так, чтобы каждая сложность давала свой узнаваемый pillar.

### Easy — «Я хозяин арены»

- Видит: слаймы редкие, слабые, сами друг друга режут, прицел подтягивается. На земле в каждой второй волне выпадает hp-orb.
- Чувствует: разрядка, power-fantasy, удовольствие от стрельбы вообще без чтения боя.
- Pillar: `slimeFriendlyFire: true` — главный механический выразитель. Один выстрел в толпу — толпа сама поредела. Aim-assist + полный арсенал + слабые редкие враги — усилители того же pillar-а.
- Структура: 3 сета (set-1 / set-3 / set-5, по два сильных боссам), по 2 волны на сет, без последнего «бонусного» сета. Игрок проходит за ≈8–10 минут.

### Normal — «Тот же забег, что и сегодня»

- Видит: ровно текущую кампанию. Без новинок, без «упрощения», без «ускорения».
- Чувствует: знакомый плотный забег с честным балансом 5 сетов × 3 волны + 5 боссов.
- Pillar: миграция текущего `content/sessions/campaign.md` → `campaign-normal.md` без потери баланса (regression-тест на детерминизм по фиксированному `seed`). Точечно — 1 стрелок в финальной волне каждого сета как намёк на hard, но не game-changer.

### Hard — «Читай поле боя»

- Видит: первая же волна включает слаймов с пистолетом и SMG. К сету 2 — гранатомётчики с подсвеченной точкой приземления гранаты. К сету 3 — стационарные «турели»-слаймы по углам, которые не двигаются и стреляют лазером. К сету 4 — bomb-placer-турели расставляют минное поле. К сету 5 — fireball-staff во все стороны.
- Чувствует: позиционирование важнее DPS; ошибка стояния = урон; каждый сет учит читать новый тип угрозы.
- Pillar: каждый сет вводит **ровно одну новую категорию опасности**, и к концу кампании игрок одновременно держит в голове все пять. Накопление сложности — через **типы угроз**, не через «больше HP / больше слаймов».
- Стартовый набор: 3 пушки (`pistol` / `smg` / `rock-thrower`), стартовая — `pistol` (слабая). Aim-assist выключен. `slimeFriendlyFire: false` (слаймы помогают друг другу, в том числе их **взрывы** не убивают соседних слаймов). Дроп скуп: heal только с танков, carrier-щели роняют power-апы реже.

### Общее на все три

- Сложность выбирается перед стартом и не «прилипает» к сейву — это просто три разных preset-а. Можно перезапустить ту же или сменить через меню.
- Финальный босс каждого сета — общий между normal и hard (для easy — три из пяти). Никаких per-difficulty боссов и архетипов слаймов.
- HUD/меню/звук — без изменений в этой истории, кроме появления второго и третьего пункта в каталоге кампаний.

## Technical

История стоит на каталоге сессий из 015 ([content/sessions/](content/sessions/) — один MD = один пресет) и spawn-override-ах из 019. Никаких новых форм авторинга. Разница между сложностями строится из существующих ручек session-/encounter-уровня плюс одного нового поля override и одной новой firing path для не-игрока.

### Опорные design-решения

- [spawn-overrides.md](../design/spawn-overrides.md) — расширен полем `loadout?: Loadout` в `SpawnOverride` (replace-or-`null`); MD-форма третьей override-таблицы получает колонки `loadoutWeaponIds | selectedWeaponIndex`.
- [non-player-firing.md](../design/non-player-firing.md) — firing path для `kind: 'enemy'`: `WeaponInstance` живёт на сущности, aim — текущая позиция игрока, тик-фаза — та же фаза 1 `CombatSystem` (порядок player → enemy by EntityId → boss), `nextFireSimMs = simTime + cooldownMs` при спавне, cleanup автоматический через удаление сущности.
- [landing-telegraph.md](../design/landing-telegraph.md) — render-only маркер точки приземления для in-flight arc от не-игрока. Расширяет [snapshot-shape.md](../design/snapshot-shape.md) полем `ProjectileSnapshot.arcEnd: {x,y} | null`.
- [content-authoring.md](../design/content-authoring.md) — override-таблица области `sessions` получает контролируемое исключение из «id + ≤4 поля»: `seq` + 6 полей в фиксированном порядке.

### Пять категорий ручек, через которые выражены три сложности

1. **Состав и темп волн** (encounter-level, существующее, см. [spawn-plan.md](../design/spawn-plan.md)): какие архетипы в `seq`, длина `seq`, `spawnIntervalMs`, `maxAlive`, `zoneToMargin`/`zoneDurationMs`.
2. **Игрок** (session-level, существующее, см. [session-definition.md](../design/session-definition.md)): `loadoutWeaponIds`, `selectedWeaponIndex`, `slimeFriendlyFire`, `aimAssist*`.
3. **Структура кампании** (encounter-level, существующее): число сетов / encounter-ов; per-set boss reuse существующих архетипов.
4. **Spawn-override** (091): `guaranteedDrops`, `dropTable` replace, `retaliation`.
5. **Loadout** (новое, story 020): `SpawnOverride.loadout` для конкретного `seq` через два новых поля override-таблицы. Главный «крутящий момент» hard-pillar.

### Один общий стационарный архетип (расширение scope относительно исходного Out of scope)

- Hard pillar сета 3 («стационарные турели в углах») не выражается ни одной из пяти ручек выше: `behavior` явно запрещено override-ить ([spawn-overrides.md](../design/spawn-overrides.md), «Принципиальное разделение»), а ни один существующий архетип не имеет `behavior: 'stationary'` ([content/enemies.md](content/enemies.md)).
- Решение: ввести в `content/enemies.md` **новый общий архетип** `slime-idol` (рабочее имя, может быть пара `slime-idol-eye` / `slime-idol-stone` для визуального разнообразия) с `behavior: 'stationary'`, `maxSpeed: 0`, `contactDamage: 0`, `knockbackBaseImpulse: 0`, `knockbackVelocityScale: 0`, `maxHp ≈ 6`, `dropTable: []`. PNG-ассет — реюз одного из существующих slime-* спрайтов; новых ассетов под историю не вводим.
- Это **не** нарушает Out-of-scope-пункт «Новые архетипы слаймов или боссов под конкретную сложность». Архетип — общий: формально доступен любому пресету; фактически в этой истории его использует только hard-кампания. Если в будущем normal/easy/training/sandbox захотят его — просто берут.
- Решение зафиксировано здесь, а не отдельным файлом в `design/`, потому что это контентное расширение реестра, не новое архитектурное правило: правило «behavior — часть идентичности» уже зафиксировано в [spawn-overrides.md](../design/spawn-overrides.md), и `slime-idol` — обычный архетип под этим правилом.

### Миграция campaign

Текущий `content/sessions/campaign.md` переименовывается в `campaign-normal.md` без изменения баланса. `content/sessions/campaign-easy.md` и `content/sessions/campaign-hard.md` — два новых файла, каждый живёт самостоятельно (по правилу [content-authoring.md](../design/content-authoring.md), multi-file области, частичный дубль каркаса принимается осознанно). `visibleInMenu: true` для всех трёх; `order` фиксирует порядок `easy → normal → hard` в меню.

### Что не трогается этой историей

- HUD, меню (за исключением derived view над каталогом — `getPlayableModeCatalog` уже показывает все `visibleInMenu: true` пресеты), звук, рендер общих слаймов/игрока/босса.
- `BossPhaseSystem` — боссы остаются на нём; bossArchetypeId per encounter — реюз существующих.
- Player loadout с modifier-ами / overdrive — не для слаймов, только для игрока.

## Out of scope

- Новые архетипы слаймов или боссов **под конкретную сложность** (например, «жирный slime-spark на hard»). Различия выражаются составом, темпом, override-полями и `loadout`. Один общий стационарный архетип `slime-idol` — не difficulty-fork (см. Technical, раздел про него).
- Новый PNG/sprite-ассет под `slime-idol`. Реюз существующего slime-PNG.
- Множители статов как spawn-override (`hpMultiplier`, `speedMultiplier`, `damageMultiplier`, …). Если когда-нибудь понадобятся — отдельное design-решение и отдельная история.
- Per-archetype default `loadout` на `EnemyArchetype` («слайм-X стреляет везде и всегда»). Эта история проходит по принципу «стрельба = контекст появления». Если понадобится — отдельное решение, см. запреты в [spawn-overrides.md](../design/spawn-overrides.md).
- Per-difficulty персистентные ачивки, разблокировки, косметика, отдельные таблицы лидеров.
- Адаптивная/динамическая сложность внутри run-а; кастомная «ручная» сложность с UI-переключателями; шаблоны/наследование между файлами кампаний.
- Новое игроцкое оружие, новые апгрейды, новый HUD.
- Умный AI стрелков (line-of-sight, упреждение, кайтинг, переключение оружия по фазам слайма). Стрелок просто стреляет в текущую позицию игрока с детерминированным cooldown ([non-player-firing.md](../design/non-player-firing.md)).
- Боссовые атаки и их миграция на универсальную модель оружия — боссы остаются на `BossPhaseSystem`.
- Friendly-fire retaliation как механика — её правила уже принадлежат 018; здесь только используем уже принятые правила.
- **Landing telegraph для player-owned arc-снарядов**. Player pre-shot preview прицеливания **до** выстрела уже описан в 017; in-flight маркер вводится здесь только для incoming (не-игроцких) arc-снарядов.
- **Landing telegraph для linear-снарядов** (упреждающие маркеры на быструю пулю и т. п.). Linear-снаряды читаемы по траектории; расширение — отдельное решение.
- **Trajectory line / arc-силуэт** между origin и landing point. Достаточно отметки точки приземления.
- Слайм с modifier-ами / временным overdrive — слаймы не получают weapon modifier drops.

## Acceptance

### Меню и навигация

- В главном меню видно три пункта: «Кампания — easy», «Кампания — normal», «Кампания — hard» в этом порядке. Каждый запускается из меню и проходится до финального босса.
- Sandbox-/training-/demo-пресеты в меню не появляются (`visibleInMenu: false`); их поведение после миграции ничем не отличается от текущего.

### Normal — миграция без регресса

- На фиксированном `seed` сессия `campaign-normal` воспроизводит **байт-в-байт** ту же последовательность runtime events (`enemySpawn`/`death`/`fire`/`hit`/`explosion`/`dropSpawn`/`dropPickup`/`dropExpire` + позиции/архетипы), что и текущая `campaign` до этой истории. Покрыто детерминированным regression-тестом.
- На normal `slimeFriendlyFire = false`, aim-assist выключен.
- Точечный 1 стрелок в финальной волне каждого сета (slime-spark с `loadout: pistol`) — единственная новинка normal относительно сегодняшней кампании.

### Easy — «Я хозяин арены»

- На easy `slimeFriendlyFire = true`, aim-assist включён с щедрым конусом (`maxAngleRadians ≥ 0.3`, `strength > 0`).
- Стартовый `loadoutWeaponIds` содержит **все** 9 weapon-id; `selectedWeaponIndex` указывает на mass-clearer (предлагается `shotgun`).
- В первые ~30 секунд первой волны игрок **ни разу** не получает урон от снарядов слаймов — потому что стрелков на easy нет вовсе. Покрыто тестом «прокрутить sim 30 секунд с заглушкой-игроком на месте, ни одного `hit` event с `targetKind: 'player'`».
- При невнимательной игре (фиктивный игрок не двигается) easy-кампания доживает до второй волны: тест ассерт «player.hp > 0 на момент `encounterEnd` первой wave-encounter».
- Heal-orb выпадает в каждой второй волне (один guaranteed `heal-orb` carrier per second wave) — покрыто тестом по count `dropSpawn` events с `archetypeId: 'heal-orb'`.

### Hard — «Читай поле боя»

- На hard `slimeFriendlyFire = false`, aim-assist выключен.
- Стартовый `loadoutWeaponIds` — ровно 3 пушки; `selectedWeaponIndex` указывает на слабую стартовую (`pistol`).
- В первые ~30 секунд первой волны игрок может умереть **только** от снарядов слаймов, ни разу не коснувшись их (фиктивный игрок не двигается, никакого contact damage; единственный источник `targetKind: 'player'` `hit` events — projectile с `ownerKind: 'enemy'`). Покрыто тестом.
- Per-set прогрессия (минимальные ассерты, конкретные числа — у геймдизайнера; тест проверяет факт существования):
  - **Сет 1.** Хотя бы один `seq` несёт `loadout` с linear-оружием (`pistol`/`smg`).
  - **Сет 2.** Хотя бы один `seq` несёт `loadout` с arc-оружием (`rock-thrower` или `grenade-launcher`).
  - **Сет 3.** Хотя бы один `seq` использует архетип `slime-idol` (`behavior: 'stationary'`) **с** `loadout` (linear long-range — `laser`/`sniper`).
  - **Сет 4.** Хотя бы один `seq` использует `slime-idol` с `loadout: bomb-placer` (placed-оружие); хотя бы один `seq` несёт `retaliation: enabled=true`.
  - **Сет 5.** Хотя бы один `seq` несёт `loadout: fireball-staff` (multiDirection).
- Дроп: на hard ни один обычный (не-carrier) `seq` не имеет `heal-orb` в эффективной dropTable (override `dropTable: []` или explicit replace без heal). Carrier-щели hard-кампании роняют **только** power-апы, не heal. Покрыто тестом «`heal-orb` `dropSpawn` events на hard прогоне волн 1–3 каждого сета — ноль».

### Поведение firing path

- Снаряд слайма наносит игроку урон через обычный damage path; `hit` event имеет `ownerKind: 'enemy'` и `weaponArchetypeId` соответствующего оружия.
- Слайм никогда не наносит урон сам себе: фильтр `ownerId` исключает self-damage от любого собственного снаряда / собственной explosion.
- Убийство стреляющего слайма мгновенно прекращает его стрельбу: после `death` event с `entityKind: 'enemy'` для этой сущности больше **никогда** не публикуется `fire` event с `shooterId === deadEnemy.id`. Никаких утечек `WeaponInstance`-ов: отдельный leak-check тест на `removeDead()` сравнивает state до/после смерти стрелка.
- При `slimeFriendlyFire: false` снаряд слайма не наносит урон другому слайму (impact); explosion от слайм-гранаты тоже не наносит HP-урон соседнему слайму. Оба случая покрыты тестами; explosion-кейс — отдельный регрессионный тест на единый `canDamageTarget` helper.
- При `slimeFriendlyFire: true` (easy) то же самое в обратную сторону: и impact, и explosion слайм-снарядов наносят урон соседним слаймам. Покрыто симметричными тестами.
- Первый выстрел стреляющего слайма происходит ровно через `cooldownMs` его weapon archetype после спавна, не раньше и не позже. Покрыто детерминированным тестом для одного фиксированного weapon archetype.

### Landing telegraph

- Когда слайм бросает arc-снаряд (`weaponArchetypeId` с `motion.kind === 'arc'`), на земле в позиции `arcEnd` появляется landing-telegraph маркер на всё время полёта снаряда. Маркер исчезает при impact или grounding (не позднее одного кадра после `state` транзиции на `'grounded'`).
- Player-owned arc-снаряды landing-telegraph маркер **не показывают**. Покрыто render-тестом: спавн arc-снаряда с `ownerKind: 'player'` → нет landing-telegraph mesh в render scene.
- Размер маркера для weapon с `explosion !== null` ≈ диаметру взрыва; для weapon без explosion — фиксированный 0.4 wu. Покрыто render-тестом.

### Контент и валидация

- Все три файла кампании проходят `content:check` без warnings, кроме явно ожидаемых (no-tunneling по выданному оружию, если возникнут).
- `content:check` падает на: ссылке на неизвестный `weaponArchetypeId` в `override.loadout.weapons`; `selectedWeaponIndex` вне диапазона; частичной задаче loadout (одна колонка `none`, другая нет).
- Никакие пресеты вне трёх кампаний (sandbox, training, demo) не меняют поведения после миграции.

## Tasks

Полная декомпозиция: T1 — архитектурный PR (текущее ревью). T2–T22 — кодовый PR после merge архитектурного и закрытия 019, по правилу «не делать одним PR одновременно правки `design/` и кода».

Внутри T2–T22 порядок отражает зависимости: типы → snapshot-расширение → парсер/рендер `sessions` → builder-валидация → runtime (EntityStore/SpawnSystem/CombatSystem) → renderer landing-telegraph → новый архетип `slime-idol` → миграция и три кампании → тесты → верификация.

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [ ] | Архитектор: оформить четыре design-правки одним архитектурным PR — (1) [spawn-overrides.md](../design/spawn-overrides.md) (поле `loadout`, валидация, MD-расширение); (2) [non-player-firing.md](../design/non-player-firing.md) (где живёт WeaponInstance слайма, aim picking, тик-фаза, cleanup, единый damage-rule helper); (3) [landing-telegraph.md](../design/landing-telegraph.md) (snapshot extension `arcEnd`, render-контракт); (4) [content-authoring.md](../design/content-authoring.md) (override-таблица 6 полей, контролируемое исключение). Плюс правки [snapshot-shape.md](../design/snapshot-shape.md), [design/README.md](../design/README.md). И эта ревизия истории — Player-facing с пилларами, Acceptance с per-set hard, Tasks полная декомпозиция, Related расширен. | Готово к merge; код-PR (T2–T22) — отдельным PR. |
| T2 | [ ] | Расширить `src/shared/session.ts`: добавить optional `loadout?: Loadout` в `SpawnOverride`. Без изменения runtime-поведения. | Чисто типы; зависит от 019 (наличия типа `SpawnOverride`). |
| T3 | [ ] | Расширить `src/shared/snapshot.ts`: добавить обязательное поле `arcEnd: { x: number; y: number } | null` в `ProjectileSnapshot`. Обновить тесты типов и любые consumers, которые конструируют `ProjectileSnapshot`-литералы вручную (тестовые fixtures), на явное `arcEnd: null`. | Типы только. |
| T4 | [ ] | `scripts/content-build/sessions/parse.ts`: расширить парсер третьей override-таблицы — теперь сигнатура `seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex`. Hard-error на: неизвестный `weaponArchetypeId` в `loadoutWeaponIds` (через cross-area ref в область `weapons`); `selectedWeaponIndex` вне `[0, length)`; пустой `loadoutWeaponIds` в MD-ячейке (`none` для опущенного override, не `empty`); частичная задача (одна из колонок `loadoutWeaponIds`/`selectedWeaponIndex` равна `none`, вторая — нет). Расширить `ParsedSpawn`/`ParsedStaticSpawn` полем `loadout`. Запретить override-таблицу при `spawnKind ∈ {empty, boss}` (уже зафиксировано в 019, ничего не ослабевает). | Зависит от 019 (структуры парсера override). |
| T5 | [ ] | `scripts/content-build/sessions/renderContent.ts`: эмитить `loadout` в литералах `WaveSpawn`/`StaticSpawn` сгенерированного `sessions.generated.ts`. Пропускать поле, если override.loadout отсутствует. Импорт `WeaponArchetype.id`-строк через TS-import bucket `weapons`. | Зависит от T4. |
| T6 | [ ] | `src/shared/content/buildSession.ts`: cross-area validation. В `resolveSpawnPlanTemplate` пройти по всем `seq` всех presets; для `override.loadout`, если задан, проверить, что каждый `weaponArchetypeId ∈ WEAPON_ARCHETYPES`. Это runtime second-pass duplicate-safety, симметрично проверке `dropArchetypeId` из 019. | Зависит от T2/T5. |
| T7 | [ ] | `src/sim/EntityStore.ts`: добавить runtime-поля `weapons: WeaponInstance[]` и `selectedWeaponIndex: number | null` на entity `enemy`. Источник — `EnemySpawnSpec` (расширяется соответствующими полями). По умолчанию (нет loadout) — `weapons: []`, `selectedWeaponIndex: null`. Поля исчезают вместе с сущностью на удалении (никаких отдельных side-tables). | Snapshot-форма `EnemySnapshot` не меняется — `weapons` runtime-only. |
| T8 | [ ] | `src/sim/SpawnSystem.ts`: `makeEnemySpawnSpec` материализует `WeaponInstance`-ы из `override.loadout`, если задан, по правилам [non-player-firing.md](../design/non-player-firing.md): `archetypeId` копируется из `loadout.weapons[i]`, `nextFireSimMs = simTime + WEAPON_ARCHETYPES[archetypeId].cooldownMs`, `modifiers: []`, `overdriveUntilSimMs: null`. `selectedWeaponIndex` — копия `loadout.selectedIndex`. Применить и в `executeStatic`, и в `spawnNextWaveEnemy`. | Зависит от T6/T7. |
| T9 | [ ] | `src/sim/CombatSystem.ts`: добавить под-цикл «enemy firing decisions» в фазу 1, после player firing и до boss firing. Итерировать сущности `kind: 'enemy'` в порядке возрастания `EntityId`; пропускать сущности с `weapons.length === 0 \|\| selectedWeaponIndex === null \|\| !isAlive`; вычислять aim как нормализованную разницу `player.position - enemy.position` (skip при `player === null` или zero-length); вызывать тот же `fireWeaponProjectiles` helper, что player firing path, с `ownerId/ownerKind: 'enemy'`. После выстрела `weapon.nextFireSimMs = simTime + effectiveCooldownMs(weapon)`. | Полный контракт — [non-player-firing.md](../design/non-player-firing.md). |
| T10 | [ ] | `src/sim/CombatSystem.ts` / `src/sim/DamageRules.ts`: убедиться, что и **impact**-фаза, и **explosion**-фаза используют **один и тот же** `canDamageTarget(projectile, target, sessionRules)` helper. Если сегодня helper дублируется — устранить дубль (одна точка). Это — прямое подтверждение инварианта из [non-player-firing.md](../design/non-player-firing.md), раздел «Friendly-fire фильтр». | Регрессионный тест на explosion+slimeFriendlyFire — T18. |
| T11 | [ ] | `src/sim/CombatSystem.ts`: при создании arc-снаряда копировать `arcEnd: { x, y }` на runtime `Projectile` (одно умножение и сложение из `position + aim * range`). Для linear/placed — `arcEnd: null`. На `state: 'grounded'`-транзиции выставить `arcEnd: null` (или гарантировать, что snapshot читает его как `null` через `state`-флаг — конкретное место мутации деталь реализации). | Источник правды для landing telegraph. |
| T12 | [ ] | `src/sim/SnapshotExportSystem.ts`: копировать `arcEnd` из runtime `Projectile` в `ProjectileSnapshot` без пересчёта. | Тест: snapshot для arc-снаряда несёт `arcEnd !== null` в `flying`, `null` в `grounded`. |
| T13 | [ ] | `src/main/render/landingTelegraph.ts` (новый модуль): mesh pool по `projectileId`. На каждом render-кадре фильтровать `snapshot.entities` по условию `kind === 'projectile' && state === 'flying' && arcEnd !== null && ownerKind !== 'player'`; создать/обновить mesh для новых id, удалить mesh для исчезнувших. Размер — `2 * explosion.radius` если `WEAPON_ARCHETYPES[weaponArchetypeId].projectile.explosion !== null`, иначе фиксированный `0.4` wu. Стиль (цвет, pulse) — render-only константы внутри модуля. | Полный контракт — [landing-telegraph.md](../design/landing-telegraph.md). |
| T14 | [ ] | `src/main/render/Renderer.ts`: интегрировать `landingTelegraph.update(snapshot)` в render pass; z-order — ниже спрайтов player/enemy/boss/projectile, выше фоновой плитки. На `dispose()`/смене сессии — очистить mesh pool. | Зависит от T13. |
| T15 | [ ] | `content/enemies.md`: добавить новый общий архетип `slime-idol` (или `slime-idol-eye` / `slime-idol-stone`, на усмотрение): inline image-узел с реюзом существующего slime-PNG (предлагается `slime-04.png` или `slime-45.png`); строки во всех балансных партициях (`## Body`: `behavior: stationary`, `radius` derive, `maxHp: 6`; `## Movement`: `maxSpeed: 0`; `## Contact damage`: `0 / 1000`; `## Knockback`: `0 / 0 / 100`; `## Drops`: пустая или одна записи power-апа); строка в `# Sound sets / ## Members` — добавить в `default` set. После `npm run content:build` `enemies.generated.ts` содержит новый архетип; `validateEnemyRegistry` пропускает (stationary invariants соблюдены). | Не difficulty-fork; общий архетип, доступный любому пресету. |
| T16 | [ ] | Миграция: переименовать `content/sessions/campaign.md` → `content/sessions/campaign-normal.md`. Сохранить `displayName: "Кампания — normal"`, `order: 1`, `visibleInMenu: true`. Внутри файла — никаких изменений баланса, только смена `id`/`displayName` в первой таблице. | После этого regression-тест T20 продолжает проходить байт-в-байт. |
| T17 | [ ] | Создать `content/sessions/campaign-easy.md` по pillar-ам easy (см. Player-facing): 3 сета (set-1 / set-3 / set-5), по 2 волны на сет (без wave-3 каждого сета и без двух промежуточных сетов 2/4); `slimeFriendlyFire: true`; aim-assist включён со щедрым конусом; полный `loadoutWeaponIds`; `selectedWeaponIndex` указывает на shotgun (или по выбору геймдизайнера); никаких override `loadout` ни на одном спавне; в каждой второй волне один guaranteed `heal-orb` carrier через `override.guaranteedDrops`. Темп волн умягчён (`spawnIntervalMs ×1.4`, `maxAlive ×0.7`, `zoneToMargin ×0.6`, `zoneDurationMs ×1.4`). `displayName: "Кампания — easy"`, `order: 0`, `visibleInMenu: true`. | Конкретные числа — зона геймдизайнера; тесты T19–T21 проверяют только pillar-факты. |
| T18 | [ ] | Создать `content/sessions/campaign-hard.md` по pillar-ам hard: тот же каркас 5 сетов × 3 волны + boss + breaks, что normal. `slimeFriendlyFire: false`; aim-assist выключен; `loadoutWeaponIds: pistol, smg, rock-thrower`; `selectedWeaponIndex: 0`. Темп — плотнее (`spawnIntervalMs ×0.75`, `maxAlive ×1.3`, `zoneToMargin ×1.3`, `zoneDurationMs ×0.8`). Per-set угрозы через override.loadout: сет 1 — linear shooters (pistol/smg в 1–2 спавнах каждой волны); сет 2 — добавить arc throwers (rock-thrower/grenade-launcher); сет 3 — добавить `slime-idol` с laser/sniper в 2–4 углах каждой wave-encounter; сет 4 — добавить `slime-idol` с bomb-placer + retaliation на mech-крабах; сет 5 — добавить slime-obelisk с fireball-staff в финальной волне. Дроп скуп: heal-orb только на slime-fortress/door/kingling/shell; обычные спавны имеют `override.dropTable: []`. `displayName: "Кампания — hard"`, `order: 2`, `visibleInMenu: true`. | Конкретные числа — зона геймдизайнера; тесты T19–T22 проверяют pillar-факты. |
| T19 | [ ] | Тест: deterministic regression на `campaign-normal`. Подать тот же фиксированный `seed`, прокрутить sim до финального босса, snapshot последовательность runtime events (`enemySpawn`/`death`/`fire`/`hit`/`dropSpawn`/`dropPickup`/`dropExpire` + позиции/архетипы/weapon-id) — должна совпадать байт-в-байт с baseline (recorded до этой истории). | Гарантирует, что миграция normal не задела баланс. |
| T20 | [ ] | Тест: per-difficulty acceptance (см. Acceptance, секции «Easy/Hard»). На easy за 30s первой волны — нет ни одного `hit` event с `targetKind: 'player'`. На hard за 30s первой волны фиктивный игрок умирает только от projectile с `ownerKind: 'enemy'` (нет `hit` events с `source: 'enemyContact'` среди финальных). На easy heal-orb выпадает в каждой второй волне (count `dropSpawn` с `archetypeId: 'heal-orb'` ≥ ⌊wave_count / 2⌋). На hard count `dropSpawn` с `archetypeId: 'heal-orb'` от обычных (не carrier) спавнов = 0. | Тест запускается per-difficulty preset; общий harness. |
| T21 | [ ] | Тест: per-set hard прогрессия (см. Acceptance, «Hard», подсекция «Per-set прогрессия»). Парсит `campaign-hard.md`-derived `SessionDefinition` и ассертит наличие хотя бы одного override.loadout с linear-оружием в сете 1, с arc в сете 2, с placed в сете 4, fireball-staff в сете 5. Ассертит наличие хотя бы одного спавна `slime-idol` в сете 3 и сете 4. Ассертит наличие хотя бы одного `retaliation: enabled` в сете 4. На easy — ноль override.loadout ни на одном спавне. | Структурный тест содержания, не balance-тест. |
| T22 | [ ] | Тест: firing path и cleanup ([non-player-firing.md](../design/non-player-firing.md)). (a) Первый выстрел стреляющего слайма происходит ровно через `cooldownMs` после спавна (фиксированный seed/timing). (b) После `death` event стреляющего слайма больше нет `fire` events с `shooterId === deadEnemy.id`. (c) При `slimeFriendlyFire: false` impact и explosion от слайм-снаряда не снимают HP другому слайму. (d) При `slimeFriendlyFire: true` — снимают (симметричный case). (e) Слайм не наносит урон сам себе ни через impact, ни через explosion. | Все пять кейсов — отдельные unit-тесты. |
| T23 | [ ] | Тест: landing-telegraph ([landing-telegraph.md](../design/landing-telegraph.md)). (a) Спавн arc-снаряда с `ownerKind: 'enemy'` → `arcEnd !== null` во всех `state: 'flying'` snapshot-ах, `arcEnd === null` после grounding. (b) Спавн arc-снаряда с `ownerKind: 'player'` → renderer не создаёт landing-telegraph mesh для него (тест в jsdom + scene introspection или unit-тест над `landingTelegraph.update`). (c) Размер mesh ≈ `2 * explosion.radius` для grenade-launcher, фиксированный 0.4 для rock-thrower (без explosion). | Зависит от T11/T12/T13/T14. |
| T24 | [ ] | Финальная верификация: `npm run content:check && tsc -p tsconfig.scripts.json && npm run typecheck && npm test`. Прогнать `npm run dev` с тремя кампаниями: easy первая волна — ноль урона от снарядов; hard первая волна — реальный урон от снарядов в первые секунды; normal первая волна — визуально идентична до миграции. | Закрытие истории. |

## Related

- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [../docs/WAVES_AND_SCALING.md](../docs/WAVES_AND_SCALING.md)
- [spawn-overrides.md](../design/spawn-overrides.md)
- [non-player-firing.md](../design/non-player-firing.md)
- [landing-telegraph.md](../design/landing-telegraph.md)
- [universal-weapons-and-projectiles.md](../design/universal-weapons-and-projectiles.md)
- [projectiles-and-combat.md](../design/projectiles-and-combat.md)
- [combat-modifiers-and-field-effects.md](../design/combat-modifiers-and-field-effects.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [content-archetypes.md](../design/content-archetypes.md)
- [content-authoring.md](../design/content-authoring.md)
- [session-definition.md](../design/session-definition.md)
- [spawn-plan.md](../design/spawn-plan.md)
- [health-and-death.md](../design/health-and-death.md)
- [sprite-assets.md](../design/sprite-assets.md)
- [zone.md](../design/zone.md)
- [main-ui-shell.md](../design/main-ui-shell.md)
- [019-spawn-overrides.md](019-spawn-overrides.md)
