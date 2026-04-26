# Три уровня сложности кампании

- Status: in-progress
- Created: 2026-04-24
- Updated: 2026-04-26 (architect: финальная реализация 019 смерджена в main и подтянута в ветку — ревью показало, что design-контракт 020 остаётся валидным: финальный override-парсер имеет ровно те 5 колонок, которые 020 расширит до 7; `ParsedSpawnOverride` — тип, расширяемый полем `loadout`; `parseLoadout` helper уже есть для session-level loadout и реюзится для override; интеграционный тест `spawnOverrides.integration.test.ts` + snapshot-baseline — готовая модель для T15. Правки в Tasks: T3 уточнён на `ParsedSpawnOverride` (а не `ParsedSpawn`), T15 ссылается на `spawnOverrides.integration.test.ts` как образец. Earlier 2026-04-26: Tasks ужаты до T1..T16 после prep-коммитов в этой же ветке — `createSpawnSystem` на options-bag, helper `buildShooterWeapons` в `CombatSystem`, rename `runFiringDecisions` → `runPlayerFiringDecisions`, `ProjectileSnapshot.arcEnd` + проброс в `SnapshotExportSystem`. T3 и T11 прошлой таблицы исключены как полностью выполненные prep-ами; T6/T7/T8 (старые T7/T8/T9) сокращены до одной-двух строк поверх готовой подложки. Earlier 2026-04-26: architect correction после сверки с merged кодом 017/019: (a) WeaponInstance слаймов живёт не на runtime-сущности `enemy`, а в `shooterWeapons: Map` внутри `CombatSystem` — симметрично player loadout, через новые `setEnemyLoadout`/`removeShooter` API и wiring через callback от SpawnSystem + строку в death hook; (b) `Projectile.arcEnd` уже есть в runtime с 017, для 020 правится только SnapshotExportSystem; (c) единый `canDamageTarget` helper уже реализован в 017, в 020 — только regression-тест. Переписан `design/non-player-firing.md` (разделы «Где живёт WeaponInstance слайма», «Wiring», «Тик-фаза», «Cleanup на смерти», «Consequences»), уточнены `design/spawn-overrides.md` и `design/landing-telegraph.md`. Tasks перенумерованы компактно: T7/T10/T11 исключены как «уже сделано», T8/T9/T12 переформулированы под реальные API 017. Earlier 2026-04-25: новые design-решения [non-player-firing.md](../design/non-player-firing.md) и [landing-telegraph.md](../design/landing-telegraph.md), правки [spawn-overrides.md](../design/spawn-overrides.md) с полем `loadout`, [snapshot-shape.md](../design/snapshot-shape.md) с `ProjectileSnapshot.arcEnd`, [content-authoring.md](../design/content-authoring.md) с двумя новыми колонками override-таблицы. Player-facing переписан вокруг трёх pillar-ов сложностей; Acceptance расширен per-set hard-прогрессией.)

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
- [non-player-firing.md](../design/non-player-firing.md) — firing path для `kind: 'enemy'`: `WeaponInstance` слаймов живёт в том же `shooterWeapons` Map внутри `CombatSystem`, что и player loadout (симметрично player API); инициализация — через новые `setEnemyLoadout`/`removeShooter` API + callback `onEnemySpawned` от SpawnSystem + строка `combat.removeShooter(ctx.entityId)` в death hook; aim — текущая позиция игрока; тик-фаза — та же фаза 1 `CombatSystem`, `runFiringDecisions` разнесён на `runPlayerFiringDecisions` и `runEnemyFiringDecisions`; `nextFireSimMs = simTime + cooldownMs` через `createWeaponInstance`.
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

T1 — архитектурный PR (уже merged в этой ветке). Prep-коммиты (тоже уже в ветке) подготовили существующий код: `createSpawnSystem` на options-bag, helper `buildShooterWeapons` в `CombatSystem`, rename `runFiringDecisions` → `runPlayerFiringDecisions`, `ProjectileSnapshot.arcEnd` + проброс в `SnapshotExportSystem`. После этого T2–T16 — кодовый PR по правилу «не делать одним PR одновременно правки `design/` и кода».

Внутри T2–T16 порядок отражает зависимости: типы → парсер/рендер `sessions` → builder-валидация → `CombatSystem` API (`setEnemyLoadout`/`removeShooter`) → новая `runEnemyFiringDecisions` → `SpawnSystem` callback + `onEncounterStart(simTimeMs)` → worker wiring → renderer landing-telegraph → новый архетип `slime-idol` → миграция и три кампании → тесты → верификация.

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Архитектор: оформить design-правки одним архитектурным PR — (1) [non-player-firing.md](../design/non-player-firing.md) (хранение WeaponInstance слайма в `shooterWeapons` Map симметрично player, `setEnemyLoadout`/`removeShooter` APIs, wiring через callback SpawnSystem + строку death hook, split `runFiringDecisions`); (2) [landing-telegraph.md](../design/landing-telegraph.md) (runtime `Projectile.arcEnd` уже есть в 017; правится только SnapshotExport; render-контракт); (3) [spawn-overrides.md](../design/spawn-overrides.md) (поле `loadout`, уточнение «loadout не копируется в поле сущности», валидация, MD-расширение); (4) [content-authoring.md](../design/content-authoring.md) (override-таблица до 6 полей, контролируемое исключение, колонки `loadoutWeaponIds`/`selectedWeaponIndex`); правки [snapshot-shape.md](../design/snapshot-shape.md) (`ProjectileSnapshot.arcEnd`), [design/README.md](../design/README.md) (индекс). Плюс эта ревизия истории. | Готово к merge; код-PR (T2–T16) — отдельным PR. |
| T2 | [x] | Расширить `src/shared/session.ts`: добавить optional `loadout?: Loadout` в `SpawnOverride`. Без изменения runtime-поведения. | Чисто типы; зависит от 019 (наличия типа `SpawnOverride`). |
| T3 | [x] | `scripts/content-build/sessions/parse.ts`: расширить `SPAWN_OVERRIDE_HEADER` и `parseSpawnOverrideRow` на две новые колонки — финальная сигнатура `seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex`. Новая вспомогательная `parseLoadoutOverride(section, table, row)` возвращает `Pick<ParsedSpawnOverride, 'loadout'>` по тому же паттерну, что существующие `parseGuaranteedDropsOverride`/`parseRetaliationOverride`; внутри реюзит логику session-level `parseLoadout` (резолв через `WEAPON_ARCHETYPES`, валидация `selectedIndex` в `[0, length) \| null`). Hard-error-ы: неизвестный `weaponArchetypeId` в `loadoutWeaponIds`; `selectedWeaponIndex` вне диапазона; частичная задача — одна из колонок `loadoutWeaponIds`/`selectedWeaponIndex` равна `none`, вторая нет (по аналогии с парным `retaliationEnabled`/`retaliationDurationMs`). Расширить тип `ParsedSpawnOverride` полем `loadout?: ParsedLoadout`. Обновить `isSpawnOverrideEmpty` новым полем. Override-таблица для `spawnKind ∈ {empty, boss}` остаётся запрещённой (проверка из 019 не ослабевает). | Зависит от 019 — переиспользуется `parseLoadout` и скелет `parseSpawnOverrideRow`. |
| T4 | [x] | `scripts/content-build/sessions/renderContent.ts`: эмитить `loadout` в литералах `WaveSpawn`/`StaticSpawn` сгенерированного `sessions.generated.ts`. Пропускать поле, если override.loadout отсутствует. Импорт `WeaponArchetype.id`-строк через TS-import bucket `weapons`. | Зависит от T3. |
| T5 | [x] | `src/shared/content/buildSession.ts`: cross-area validation. В `resolveSpawnPlanTemplate` пройти по всем `seq` всех presets; для `override.loadout`, если задан, проверить, что каждый `weaponArchetypeId ∈ WEAPON_ARCHETYPES`. Это runtime second-pass duplicate-safety, симметрично проверке `dropArchetypeId` из 019. | Зависит от T2/T4. |
| T6 | [x] | `src/sim/CombatSystem.ts`: добавить два публичных API — `setEnemyLoadout(enemyId, loadout, simTimeMs)` и `removeShooter(entityId)`. `setEnemyLoadout` — одна строка вызова `shooterWeapons.set(enemyId, buildShooterWeapons(loadout, 'enemy', weaponRegistry, simTimeMs))` поверх helper-а, выделенного prep-коммитом. `removeShooter(entityId)` — `shooterWeapons.delete(entityId)`. Расширить readonly-тип `CombatSystem`. | Зависит от T2 (тип `Loadout`). `buildShooterWeapons` уже есть в коде. |
| T7 | [x] | `src/sim/CombatSystem.ts`: добавить приватную функцию `runEnemyFiringDecisions(store, simTimeMs, shooterWeapons, weaponRegistry, emit)` рядом с уже переименованной `runPlayerFiringDecisions` (prep-коммит). Вызывается из `tick()` сразу после `runPlayerFiringDecisions`. Итерирует `store.enemies()` в порядке `EntityId`, для каждой живой (`enemy.hp > 0`) сущности ищет запись в `shooterWeapons`, считает aim как `normalize(player.position - enemy.position)` (skip при `player === null` или zero-length), вызывает **тот же** `fireWeaponProjectiles` helper с `ownerKind: 'enemy'`, обновляет `weapon.nextFireSimMs` через существующий `effectiveCooldownMs`, публикует `fire` event. | Полный контракт — [non-player-firing.md](../design/non-player-firing.md). Единый `canDamageTarget` helper для impact и explosion уже реализован в 017 — регрессия покрывается T15. |
| T8 | [x] | `src/sim/SpawnSystem.ts`: расширить `SpawnSystemOptions` (уже существует после prep) новым полем `onEnemySpawned?: (enemyId, loadout, simTimeMs) => void`. Расширить signature `onEncounterStart(encounter, store, arena, simTimeMs)` новым параметром `simTimeMs`. При создании любой сущности `enemy` (в `executeStatic` и `spawnNextWaveEnemy`) — если effective `loadout` (из `override.loadout`) не `null`, вызвать callback с `(enemyId, loadout, simTimeMs)`. Без callback-а (текущее поведение) — no-op. | Зависит от T2. `simTimeMs` для static-спавнов приходит из расширенной signature; для wave — из уже существующего `onTick`. |
| T9 | [x] | `src/sim/worker.ts`: wiring. (a) `createSpawnSystem({ onEnemySpawned(enemyId, loadout, simTimeMs) { combat.setEnemyLoadout(enemyId, loadout, simTimeMs); } })`. (b) В `onEncounterStart` worker-а: пробросить `clock.simTimeMs()` в `spawn.onEncounterStart(encounter, entities, session.arena, clock.simTimeMs())`. (c) В death hook добавить строку: `if (ctx.entityKind === 'enemy') combat.removeShooter(ctx.entityId);` рядом с существующими `spawn.onEnemyDeath` и `drops.onDeathHook`. | Зависит от T6/T8. Никаких новых полей/систем, только три точки wiring. |
| T10 | [x] | `src/main/render/landingTelegraph.ts` (новый модуль): mesh pool по `projectileId`. На каждом render-кадре фильтровать `snapshot.entities` по условию `kind === 'projectile' && state === 'flying' && arcEnd !== null && ownerKind !== 'player'`; создать/обновить mesh для новых id, удалить mesh для исчезнувших. Размер — `2 * explosion.radius` если `WEAPON_ARCHETYPES[weaponArchetypeId].projectile.explosion !== null`, иначе фиксированный `0.4` wu. Стиль (цвет, pulse) — render-only константы внутри модуля. | Полный контракт — [landing-telegraph.md](../design/landing-telegraph.md). `ProjectileSnapshot.arcEnd` уже есть в снапшоте после prep. |
| T11 | [x] | `src/main/render/Renderer.ts`: интегрировать `landingTelegraph.update(snapshot)` в render pass; z-order — ниже спрайтов player/enemy/boss/projectile, выше фоновой плитки. На `dispose()`/смене сессии — очистить mesh pool. | Зависит от T10. |
| T12 | [x] | `content/enemies.md`: добавить новый общий архетип `slime-idol` (или пара `slime-idol-eye` / `slime-idol-stone`): inline image-узел с реюзом существующего slime-PNG (предлагается `slime-04.png` или `slime-45.png`); строки во всех балансных партициях (`## Body`: `behavior: stationary`, `maxHp: 6`; `## Movement`: `maxSpeed: 0`; `## Contact damage`: `0 / 1000`; `## Knockback`: `0 / 0 / 100`; `## Drops`: пустая или одна запись power-апа); строка в `# Sound sets / ## Members` — добавить в `default` set. После `npm run content:build` `enemies.generated.ts` содержит новый архетип; `validateEnemyRegistry` пропускает (stationary invariants соблюдены). | Не difficulty-fork; общий архетип, доступный любому пресету. |
| T13 | [x] | Миграция: переименовать `content/sessions/campaign.md` → `content/sessions/campaign-normal.md`. Сохранить `displayName: "Кампания — normal"`, `order: 1`, `visibleInMenu: true`. Внутри файла — никаких изменений баланса, только смена `id`/`displayName` в первой таблице. | После этого regression-тест T14 продолжает проходить байт-в-байт. |
| T14 | [x] | Создать `content/sessions/campaign-easy.md` по pillar-ам easy (см. Player-facing): 3 сета (set-1 / set-3 / set-5), по 2 волны на сет; `slimeFriendlyFire: true`; aim-assist включён со щедрым конусом; полный `loadoutWeaponIds`; `selectedWeaponIndex` указывает на shotgun (или по выбору геймдизайнера); никаких `override.loadout` ни на одном спавне; в каждой второй волне один guaranteed `heal-orb` carrier через `override.guaranteedDrops`. Темп волн умягчён (`spawnIntervalMs ×1.4`, `maxAlive ×0.7`, `zoneToMargin ×0.6`, `zoneDurationMs ×1.4`). `displayName: "Кампания — easy"`, `order: 0`, `visibleInMenu: true`. Плюс создать `content/sessions/campaign-hard.md` по pillar-ам hard: тот же каркас 5 сетов × 3 волны + boss + breaks, что normal. `slimeFriendlyFire: false`; aim-assist выключен; `loadoutWeaponIds: pistol, smg, rock-thrower`; `selectedWeaponIndex: 0`. Темп — плотнее (`spawnIntervalMs ×0.75`, `maxAlive ×1.3`, `zoneToMargin ×1.3`, `zoneDurationMs ×0.8`). Per-set `override.loadout`: сет 1 — linear shooters (pistol/smg в 1–2 спавнах каждой волны); сет 2 — добавить arc throwers (rock-thrower/grenade-launcher); сет 3 — добавить `slime-idol` с laser/sniper в 2–4 углах каждой wave-encounter; сет 4 — добавить `slime-idol` с bomb-placer + retaliation на mech-крабах; сет 5 — добавить `slime-idol` с fireball-staff в финальной волне. Дроп скуп: heal-orb только на slime-fortress/door/kingling/shell; обычные спавны имеют `override.dropTable: []`. `displayName: "Кампания — hard"`, `order: 2`, `visibleInMenu: true`. | Конкретные числа — зона геймдизайнера; тесты T15/T16 проверяют только pillar-факты. |
| T15 | [x] | Тест: deterministic regression на `campaign-normal`. Использовать паттерн `src/sim/spawnOverrides.integration.test.ts` (мини-мир с fake clock, подпиской на `emitEvent`, snapshot-baseline через vitest `__snapshots__/`). Прокрутить sim до финального босса, snapshot последовательность runtime events (`enemySpawn`/`death`/`fire`/`hit`/`explosion`/`dropSpawn`/`dropPickup`/`dropExpire` + позиции/архетипы/weapon-id) — должна совпадать с baseline, который снят уже **на пост-019 состоянии** `campaign.md` (до переименования в `campaign-normal.md`). Плюс в этом же файле — тест firing path и cleanup ([non-player-firing.md](../design/non-player-firing.md)): (a) после `combat.setEnemyLoadout(enemyId, {weapons: ['pistol'], selectedIndex: 0}, 0)` и расстановки фиктивного игрока, первый `fire` event с `shooterId === enemyId, ownerKind: 'enemy'` происходит ровно на `simTimeMs === PISTOL.cooldownMs`; (b) после `combat.removeShooter(enemyId)` больше нет `fire` events для этого id; (c) при `slimeFriendlyFire: false` impact и explosion от слайм-снаряда не снимают HP другому слайму (regression на единый `canDamageTarget` helper); (d) при `slimeFriendlyFire: true` — снимают; (e) слайм не наносит урон сам себе. | Все пять firing-кейсов — отдельные unit-тесты на уровне `CombatSystem`. |
| T16 | [ ] | Тест: per-difficulty acceptance + landing-telegraph + per-set hard прогрессия. (a) Easy за 30s первой волны — ни одного `hit` event с `targetKind: 'player'`. (b) Hard за 30s первой волны фиктивный игрок умирает только от projectile с `ownerKind: 'enemy'` (нет `hit` events с `source: 'enemyContact'` среди финальных). (c) Easy: count `dropSpawn` с `archetypeId: 'heal-orb'` ≥ ⌊wave_count / 2⌋. (d) Hard: count `dropSpawn` с `archetypeId: 'heal-orb'` от обычных (не carrier) спавнов = 0. (e) Structural assert над `campaign-hard` `SessionDefinition`: наличие хотя бы одного `override.loadout` с linear-оружием в сете 1, с arc в сете 2, с placed в сете 4, fireball-staff в сете 5; хотя бы один spawn `slime-idol` в сете 3 и сете 4; хотя бы один `retaliation: enabled` в сете 4. На easy — ноль `override.loadout` ни на одном спавне. (f) Landing-telegraph: спавн arc-снаряда с `ownerKind: 'enemy'` даёт `arcEnd !== null` во всех `state: 'flying'` snapshot-ах, `null` после grounding; спавн с `ownerKind: 'player'` → renderer не создаёт mesh; размер mesh ≈ `2 * explosion.radius` для grenade-launcher vs фиксированный 0.4 для rock-thrower. Плюс финальная верификация: `npm run content:check && tsc -p tsconfig.scripts.json && npm run typecheck && npm test`. Прогнать `npm run dev` с тремя кампаниями: easy первая волна — ноль урона от снарядов; hard первая волна — реальный урон от снарядов в первые секунды; normal первая волна — визуально идентична до миграции. | Тест запускается per-difficulty preset; общий harness + unit-тест над `landingTelegraph.update`. Закрытие истории. |

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
