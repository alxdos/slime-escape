# Sprite Assets and Loader

- Status: done
- Created: 2026-04-23
- Updated: 2026-04-24 (documentation follow-up: `PX_PER_WU` references aligned to current shared value `240`. Previously closed: PR #12 merged в `main`. Architect pass завёл `design/sprite-assets.md`, `design/body-contact-boxes.md` и расширения `content-authoring.md`/`main-ui-shell.md`/`spawn-plan.md`. Code-review закрыл блокеры: `PX_PER_WU = 240` зафиксирован в shared (`src/shared/sprite/spriteScale.ts`), generator больше не импортирует из `src/main/**`, splash min-duration зафиксирован контрактом, `players` разведён на `hero-sandbox`/`hero-training` без drift `maxHp`, session spawn-fit переведён на `contactBox`. Известный follow-up на отдельную мелкую историю: вызовы `validateEnemyVisuals`/`validateBossVisuals`/`validatePlayerVisuals` на старте сессии (сейчас orphan archetype/visual ловится только лениво в renderer-е).)

## Player-facing

- Sees: при старте приложения белую заставку с `public/images/slime-escape.jpg`, вписанную через `contain`, и лоадер внизу экрана. После загрузки игра показывает героя, слаймов и босса PNG-спрайтами из `public/assets`, без круговых fallback-визуалов.
- Can do: запустить тренировку или кампанию и играть как раньше, но видеть реального персонажа, все активные слаймы и босса как картинки. Все 30 слаймов и 5 боссов заведены в контент так, чтобы будущие волны могли ссылаться на их `id`.

## Technical

- Это вертикальная история: MD-контент, генератор, preload, startup UI и renderer должны сойтись в demoable результате. История не считается готовой, если ассеты только описаны, но игра всё ещё рисует круги.
- Опирается на завершённую 012: `scripts/content-build/` уже знает области `enemies`/`weapons`/`drops`/`bosses`, рукописные пары `<area>.ts ↔ <area>.generated.ts` живы. История 013 расширяет уже живые области новой балансной группой `## Visual` и заводит новую область `players` с нуля.
- Архитектурный контракт visual-слоя — [../design/sprite-assets.md](../design/sprite-assets.md): один общий тип `SpriteVisualSpec`, три раздельных visual registry рядом с renderer (`playerVisuals.{ts,generated.ts}`, `enemyVisuals.{ts,generated.ts}`, `bossVisuals.{ts,generated.ts}`), единственная константа `PX_PER_WU = 240` в `src/shared/sprite/spriteScale.ts`.
- В MD автор указывает только `image` (путь от корня `public/`) и игровой intent (`displayName`, gameplay-числа). Размер PNG в пикселях и derived `worldSize` в MD не пишутся: правило «MD-колонка для derive-поля запрещена» из [../design/content-authoring.md](../design/content-authoring.md), раздел «Внешние ассеты как источник derive-полей». Генератор читает PNG через util `scripts/content-build/util/pngSize.ts` и пересчитывает derive-поля на каждом `content:build`.
- Симуляция продолжает работать с gameplay-полями (`radius`, `maxHp`, `speed`, damage) и не читает visual registry напрямую. После [../design/body-contact-boxes.md](../design/body-contact-boxes.md) и [../design/projectiles-and-combat.md](../design/projectiles-and-combat.md) `contactBox` для `player` / `enemy` / `boss` используется и для body-contact, и для projectile hit detection; `radius` остаётся только у не-мигрированных consumers.
- После ручной visual QA выяснилось, что circle body-contact не совпадает с прямоугольными sprite bodies. Follow-up контракт — [../design/body-contact-boxes.md](../design/body-contact-boxes.md): для `player` / `enemy` / `boss` в shared content и runtime появляется derive `contactBox`, равный sprite `worldSize`; `CombatSystem` переводит body-contact на box-vs-box и projectile hit detection на circle-vs-contactBox, а `MovementSystem` clamp-ит игрока по box, не по `radius`.
- Renderer для `player`/`enemy`/`boss` использует только preloaded textures. Missing texture, missing visual spec или несовпадение `archetypeId` с visual registry — hard error на старте/в тесте, не fallback на `CircleGeometry`/`color`. После [../design/sprite-assets.md](../design/sprite-assets.md) `EnemyArchetype.color`/`BossArchetype.color` renderer не читает; поле остаётся в архетипах как content-плейсхолдер.
- Все PNG, перечисленные в generated visual registries, загружаются и декодируются до показа меню. Lifecycle описан в [../design/main-ui-shell.md](../design/main-ui-shell.md), новой стартовой фазе `loading` (splash + progress) и финальной `error('preload')` (явная ошибка + reload). Lazy-load во время боя запрещён.
- `content/enemies.md` расширяется с двух игровых слаймов до всех 30 ассетов. Текущие `slime-fast`/`slime-tank` заменяются новыми смысловыми archetype id; тренировочные и campaign-волны переводятся на новые id с близкой сложностью; campaign boss переводится на `boss-scrap-king` (или явно выбранный replacement).
- `content/bosses.md` содержит все 5 боссов. Campaign может продолжать использовать одного активного босса, но renderer и preload обязаны уметь отрисовать любого босса из registry.
- Заводится новая контентная область **players** с собственным `content/players.md`: gameplay/visual archetypes `hero-sandbox` и `hero-training` (общий PNG, разные session gameplay-поля вроде `maxHp`). Это первое включение области `players` в MD-конвейер; остальные «session-композиционные» области (`sessions`, `arenas`, `presets`) — по-прежнему out-of-scope.
- Раздел «Asset Authoring Baseline» ниже — иллюстрация **значений** для геймдизайнера, не формат итогового MD. В реальных `content/{enemies,bosses,players}.md` колонки разводятся по узким группам (`## Body`, `## Movement`, `## Contact damage`, `## Knockback`, `## Drops`, `## Sounds`, `## Voice`, `## Visual`) ровно как в текущем `content/enemies.md` после 011/012, с соблюдением правила [../design/content-authoring.md](../design/content-authoring.md) «не более пяти колонок (`id` + ≤4 поля)».
- `training-target` сейчас живёт в `content/enemies.md` как stationary stub из истории 003 и используется в `sandbox-with-combat` плюс в ~13 unit/integration-тестах симуляции и аудио как удобная фикстура «стационарный, без damage, низкое HP». В этой истории он полностью удаляется: `ENEMY_BEHAVIOR === 'stationary'` остаётся в типе как разрешённое значение, но без живых архетипов. Тесты, которые сейчас импортируют `TRAINING_TARGET`, переходят на локальные test fixtures (например, `makeStationaryTestEnemy({ id })` рядом с тестом) либо на реальные chase-архетипы, где stationary не принципиален. Это снимает зависимость симуляционных тестов от production content.

### Asset Authoring Baseline

Эти строки фиксируют стартовое игровое описание для MD. Таблицы намеренно не содержат `sourceSizePx`, `displayWidthPx`, `displayHeightPx` или `worldSize`: генератор обязан пересчитать их из оригинальных PNG на каждом `npm run content:build`.

#### Player

| id | image | displayName | radius | maxSpeed |
|----|-------|-------------|---:|---:|
| hero | `/assets/hero.png` | Hero | 0.5 | 6 |

#### Slimes

| id | image | displayName | radius | maxHp | maxSpeed | contactDamage | contactCooldownMs | dropChance |
|----|-------|-------------|---:|---:|---:|---:|---:|---:|
| slime-one-eye | `/assets/slime-01.png` | One-Eye Slime | 0.40 | 1 | 4.0 | 1 | 800 | 0.25 |
| slime-hornling | `/assets/slime-02.png` | Hornling Slime | 0.50 | 2 | 3.3 | 1 | 850 | 0.30 |
| slime-many-eye | `/assets/slime-03.png` | Many-Eye Slime | 0.60 | 3 | 2.2 | 2 | 950 | 0.35 |
| slime-stonehead | `/assets/slime-04.png` | Stonehead Slime | 0.72 | 6 | 1.5 | 2 | 1000 | 0.60 |
| slime-sleeper | `/assets/slime-05.png` | Sleeper Slime | 0.45 | 2 | 1.0 | 1 | 1000 | 0.20 |
| slime-spark | `/assets/slime-06.png` | Spark Slime | 0.35 | 1 | 5.2 | 1 | 700 | 0.18 |
| slime-wraith | `/assets/slime-11.png` | Wraith Slime | 0.48 | 2 | 3.5 | 1 | 800 | 0.25 |
| slime-shell | `/assets/slime-12.png` | Shell Slime | 0.65 | 5 | 1.7 | 2 | 1000 | 0.55 |
| slime-flame | `/assets/slime-13.png` | Flame Slime | 0.44 | 2 | 3.8 | 2 | 900 | 0.30 |
| slime-mech-crab | `/assets/slime-14.png` | Mech Crab Slime | 0.62 | 4 | 2.0 | 2 | 950 | 0.45 |
| slime-stack | `/assets/slime-15.png` | Stack Slime | 0.58 | 3 | 2.4 | 1 | 900 | 0.35 |
| slime-trickster | `/assets/slime-16.png` | Trickster Slime | 0.52 | 3 | 3.2 | 1 | 850 | 0.30 |
| slime-bug | `/assets/slime-21.png` | Bug Slime | 0.48 | 2 | 3.6 | 1 | 800 | 0.25 |
| slime-lifter | `/assets/slime-22.png` | Lifter Slime | 0.70 | 6 | 1.6 | 3 | 1100 | 0.60 |
| slime-saw | `/assets/slime-23.png` | Saw Slime | 0.55 | 3 | 3.0 | 2 | 900 | 0.40 |
| slime-drone | `/assets/slime-24.png` | Drone Slime | 0.42 | 1 | 4.8 | 1 | 750 | 0.20 |
| slime-star | `/assets/slime-25.png` | Star Slime | 0.38 | 1 | 5.0 | 1 | 700 | 0.18 |
| slime-echo | `/assets/slime-26.png` | Echo Slime | 0.36 | 1 | 4.4 | 1 | 750 | 0.15 |
| slime-splitter | `/assets/slime-31.png` | Splitter Slime | 0.56 | 3 | 2.8 | 1 | 900 | 0.35 |
| slime-prince | `/assets/slime-32.png` | Prince Slime | 0.66 | 4 | 2.2 | 2 | 950 | 0.45 |
| slime-kingling | `/assets/slime-33.png` | Kingling Slime | 0.74 | 7 | 1.7 | 3 | 1100 | 0.65 |
| slime-fortress | `/assets/slime-34.png` | Fortress Slime | 0.80 | 8 | 1.2 | 3 | 1200 | 0.70 |
| slime-dasher | `/assets/slime-35.png` | Dasher Slime | 0.46 | 2 | 4.6 | 2 | 850 | 0.25 |
| slime-tadpole | `/assets/slime-36.png` | Tadpole Slime | 0.34 | 1 | 4.2 | 1 | 750 | 0.15 |
| slime-door | `/assets/slime-41.png` | Door Slime | 0.76 | 7 | 1.1 | 2 | 1100 | 0.65 |
| slime-mech | `/assets/slime-42.png` | Mech Slime | 0.70 | 6 | 1.8 | 3 | 1050 | 0.55 |
| slime-clamper | `/assets/slime-43.png` | Clamper Slime | 0.52 | 3 | 3.0 | 2 | 900 | 0.35 |
| slime-candle | `/assets/slime-44.png` | Candle Slime | 0.46 | 2 | 3.4 | 1 | 850 | 0.25 |
| slime-obelisk | `/assets/slime-45.png` | Obelisk Slime | 0.50 | 4 | 2.0 | 2 | 1000 | 0.40 |
| slime-ninja | `/assets/slime-46.png` | Ninja Slime | 0.54 | 4 | 4.0 | 3 | 950 | 0.35 |

All slimes use `behavior: chase`. Knockback remains explicit in MD; starter values are `baseImpulse=8, velocityScale=1.5, durationMs=350` for speed `>= 4`, `baseImpulse=5, velocityScale=1.0, durationMs=280` for speed `2..3.9`, and `baseImpulse=3, velocityScale=0.5, durationMs=220` for speed `< 2`. The generated MD rows must contain the concrete numbers, not implicit defaults.

#### Bosses

| id | image | displayName | radius | maxHp | maxSpeed | contactDamage | contactCooldownMs |
|----|-------|-------------|---:|---:|---:|---:|---:|
| boss-gargoyle | `/assets/boss-01.png` | Gargoyle Slime | 1.15 | 35 | 3.2 | 2 | 800 |
| boss-saw-cyclops | `/assets/boss-02.png` | Saw Cyclops | 1.25 | 45 | 2.4 | 3 | 900 |
| boss-scrap-king | `/assets/boss-03.png` | Scrap King | 1.35 | 40 | 3.0 | 2 | 800 |
| boss-tower-sentinel | `/assets/boss-04.png` | Tower Sentinel | 1.30 | 50 | 1.8 | 3 | 1000 |
| boss-bubble-hog | `/assets/boss-05.png` | Bubble Hog | 1.20 | 42 | 2.6 | 2 | 850 |

Bosses reuse the existing boss phase/attack patterns for this story unless a boss-specific behavior story supersedes it. `boss-scrap-king` is the initial campaign boss replacement for the current `slime-king` behavior.

## Out of scope

- Анимации, atlas/spritesheet, directional frames, hit/death animation, shader effects.
- Новые boss attack patterns и уникальное поведение каждого босса. Здесь цель — завести все boss archetypes и убедиться, что renderer умеет показать любой из них.
- Редактор волн и полноценная система составления wave sets из всех новых слаймов. История только заводит все archetype id и обновляет текущие волны на новые id.
- Замена аудио-пулов на уникальные звуки под каждого слайма/босса.

## Acceptance

- `2240x1260` явно зафиксирован как reference arena только для расчёта sprite scale; проверка в тесте/генераторе подтверждает aspect `16:9`. `SANDBOX_ARENA` остаётся `32x18`, camera/frustum/physics/input mapping не меняются.
- `content/enemies.md` содержит все 30 slime archetypes из `public/assets/slime-*.png`. Архетип `training-target` полностью удаляется из MD и `ENEMY_ARCHETYPES`; `sandbox-with-combat` переводится на `slime-bug` (id `slime-bug`, `radius 0.48`, `contactDamage 1`, `maxSpeed 3.6` — близко по «лёгкости касания» к нынешней stationary-мишени). Старые игровые `slime-fast`/`slime-tank` больше не используются ни в одной активной волне и тоже исчезают из MD.
- `content/bosses.md` содержит 5 boss archetypes из `public/assets/boss-*.png`; campaign boss использует `boss-scrap-king` или явно выбранный replacement id.
- Player visual `hero` описан в MD и используется renderer-ом для live player во всех режимах.
- Генератор читает PNG dimensions из файлов во время `npm run content:build` и пишет их в generated visual registry. `sourceSizePx` равен фактическому размеру PNG; `displaySizePx` для этой истории пересчитывается из `sourceSizePx` без ручных overrides; `worldSize = displaySizePx / 70`. Если PNG удалён, путь неверный, файл не PNG или размер не читается — генерация падает до записи выходных файлов.
- `content:check` ловит дрейф, если изменился PNG размер или MD visual fields, но `.generated.ts` не обновлён. MD-колонки `sourceSizePx`, `displayWidthPx`, `displayHeightPx`, `displaySizePx`, `worldSize` запрещены и должны приводить к ошибке генератора, чтобы размеры не становились ручным источником правды.
- Startup preloader загружает и декодирует все sprite images из generated registry до меню. Во время загрузки видна белая заставка с `public/images/slime-escape.jpg` (`contain`) и loader внизу. При ошибке загрузки показывается явная startup error, игра не стартует с fallback-графикой.
- Renderer для `player`, `enemy`, `boss` не создаёт круговые fallback-meshes. Тесты проверяют, что missing visual spec/texture приводит к ошибке, а не к `CircleGeometry`.
- В тренировке видны hero sprite и новые slime sprites; в campaign виден boss sprite. Существующая стрельба, контактный урон, HP, drops, win/loss и pause/menu поведение остаются зелёными по тестам.
- `npm run content:build`, `npm run content:check`, `npm test` и `npm run build` зелёные.

## Tasks

Архитектурные T1–T3 уже выполнены этим самым проходом архитектора (ввод `design/sprite-assets.md`, расширение `content-authoring.md`, расширение `main-ui-shell.md`). Они помечены `[x]` в момент перевода истории в `in-progress`, чтобы не «делать дважды то, что уже зафиксировано в `design/`».

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Архитектор: новый `design/sprite-assets.md` (visual registry, `SpriteVisualSpec`, `PX_PER_WU = 240`, asset-only renderer, hard-error policy, preload contract). Поднять `Updated` в `design/content-archetypes.md` (`color` теряет потребителя в renderer для player/enemy/boss). Обновить `Index` в `design/README.md`. | архитектор |
| T2 | [x] | Архитектор: расширить `design/content-authoring.md` — раздел «Внешние ассеты как источник derive-полей», запрет MD-колонок для derive-полей в «Запрещённые шаблоны», `players` включён в перечисление известных областей. Поднять `Updated`. | архитектор |
| T3 | [x] | Архитектор: расширить `design/main-ui-shell.md` — стартовая фаза `loading`, финальная `error('preload')`, переходы, расширенная таблица видимости, ограничения «Renderer/InputController/Settings/SimWorkerHost не существуют в `loading`», раздел «Startup preload в фазе `loading`». Пометка `Updated` в `design/audio.md` про расширение mappings. | архитектор |
| T4 | [x] | Generator-utility: добавить `scripts/content-build/util/pngSize.ts` — чистая функция `(absPath) → { width, height }` через лёгкий парсер IHDR (зависимость `image-size` или ручной парсинг — деталь реализации). Сообщение об ошибке `content/<area>.md row "<id>": cannot read PNG <path>: <reason>`. Unit-тест на хороший PNG, битый PNG, не-PNG. | опоры: `design/content-authoring.md` |
| T5 | [x] | Common visual типы и константа: `src/main/render/SpriteVisualSpec.ts` (тип `SpriteVisualSpec`), `src/shared/sprite/spriteScale.ts` (`export const PX_PER_WU = 240` — единственный источник scale, проверка grep-тестом). Без area-кода. | опоры: `design/sprite-assets.md` |
| T6 | [x] | Area `players` в генераторе и content library: `scripts/content-build/players/{parse,renderContent,renderVisuals,index}.ts`; рукописная пара `src/shared/content/players.{ts,generated.ts}` (вынести `SANDBOX_PLAYER`/`TRAINING_PLAYER` в generated, типы и реестр оставить в `players.ts`); рукописная пара `src/main/render/playerVisuals.{ts,generated.ts}`. Header — временный seed «regenerated by content-build после T9». На этом шаге MD ещё нет — генератор падает с явным сообщением «source not found». | опоры: `design/content-authoring.md`, `design/sprite-assets.md` |
| T7 | [x] | Расширение области `enemies` в генераторе под visual: `scripts/content-build/enemies/renderVisuals.ts` → `src/main/render/enemyVisuals.generated.ts`, регистрация в `enemies/index.ts`, расширение `enemies/parse.ts` под новую балансную группу `## Visual` (`id | image`). Рукописный `src/main/render/enemyVisuals.ts` (тип, реестр, `validateEnemyVisuals`). Header — временный seed. | опоры: `design/content-authoring.md`, `design/sprite-assets.md` |
| T8 | [x] | Расширение области `bosses` в генераторе под visual: `scripts/content-build/bosses/renderVisuals.ts` → `src/main/render/bossVisuals.generated.ts`, регистрация, расширение `bosses/parse.ts` под `## Visual`. Рукописный `src/main/render/bossVisuals.ts` (тип, реестр, `validateBossVisuals`). Header — временный seed. | опоры: `design/content-authoring.md`, `design/sprite-assets.md` |
| T9 | [x] | Авторинг `content/players.md`: партиция `# Players` с `## hero-sandbox` и `## hero-training` (`field | value` для `displayName`); партиция `# Balance` с `## Body` (`id | radius`), `## Movement` (`id | maxSpeed`), `## Health` (`id | maxHp`), `## Visual` (`id | image`). После сходимости — финальный AUTO-GENERATED. | опоры: `design/content-authoring.md`, `design/sprite-assets.md` |
| T10 | [x] | Авторинг `content/enemies.md`: 30 slime-архетипов из таблицы story (`slime-one-eye` … `slime-ninja`). `training-target`/`slime-fast`/`slime-tank` исключаются из MD полностью (ни одной строки в Body/Movement/Contact/Knockback/Drops/Sounds/Voice/Visual). Группы: `## Body`, `## Movement`, `## Contact damage`, `## Knockback`, `## Drops`, `## Sounds`, `## Voice`, `## Visual` — все группы узкие (≤5 колонок). Knockback по правилу истории «по группам speed». `## Sounds` и `## Voice` тиражируют существующие пулы `slimes/hit-*`/`slimes/death-*`/`slimes/voice-*` на все 30 id. После сходимости — финальный AUTO-GENERATED. | опоры: `design/content-authoring.md`, `design/content-archetypes.md`, `design/audio.md` |
| T11 | [x] | Авторинг `content/bosses.md`: 5 boss-архетипов из таблицы story (`boss-gargoyle`…`boss-bubble-hog`). Группы: `## Body`, `## Movement`, `## Contact damage`, `## Knockback`, `## Phases`, `## Attacks`, `## Sounds`, `## Visual`. Phases/Attacks для новых боссов — по контракту [../design/boss-encounter.md](../design/boss-encounter.md) и [../design/content-archetypes.md](../design/content-archetypes.md) (минимум 2 фазы и 2 различимых attack-key). На MVP можно переиспользовать pattern-ключи `slime-king` (`coneBurst`/`spawnAdds`/`dashSlam`) для всех пяти; `## Sounds` тиражирует существующие boss sample id. После сходимости — финальный AUTO-GENERATED. | опоры: `design/content-authoring.md`, `design/content-archetypes.md`, `design/boss-encounter.md`, `design/audio.md` |
| T12 | [x] | Sessions migration: правки в [src/shared/content/buildSession.ts](../src/shared/content/buildSession.ts) — `sandbox-with-combat` переходит с `TRAINING_TARGET` на `slime-bug`; training/campaign волны переведены с `slime-fast`/`slime-tank` на новые id с близкой сложностью (стартовая раскладка — кодерская: подбор по `radius`/`maxHp`/`maxSpeed` из таблицы story); campaign boss = `boss-scrap-king`. Из [src/shared/content/enemies.ts](../src/shared/content/enemies.ts) убрать re-export `TRAINING_TARGET`/`SLIME_FAST`/`SLIME_TANK` (после регенерации T10 этих литералов в `enemies.generated.ts` уже нет). Mapping старый → новый зафиксирован в комменте `buildSession.ts`. Зависит от T10/T11. | волны не становятся редактором |
| T12a | [x] | Test fixtures off `TRAINING_TARGET`: ~13 файлов (`src/sim/*.test.ts`, `src/main/audio/AudioMappings.test.ts`, `src/main/audio/Audio.test.ts`, `src/shared/content/enemies.test.ts`, `src/shared/content/buildSession.test.ts`, `scripts/content-build/enemies/enemies.test.ts`) сейчас импортируют `TRAINING_TARGET` как удобную stationary-фикстуру. Переход — на локальные test fixtures: либо `makeStationaryTestEnemy({ id, ...overrides })` рядом с тестом (предпочтительно для unit-уровня), либо реальные chase-архетипы там, где `behavior: 'stationary'` не принципиален. Симуляционные тесты не должны зависеть от production content. Зависит от T10. | без production-фикстур в тестах |
| T13 | [x] | UiShell loading phase code: ввести фазу `loading` (стартовая) и `error('preload')` (финальная) в `src/main/ui/UiShell.ts` по контракту [../design/main-ui-shell.md](../design/main-ui-shell.md). Новый `src/main/ui/StartupOverlay.ts` (белый фон + `public/images/slime-escape.jpg` `object-fit: contain` + нижний progress + статус `Loading assets X/Y`). Новый `src/main/ui/StartupErrorOverlay.ts` с кнопкой reload. `src/main/index.ts` не меняется (UiShell сам стартует с `loading`). | опоры: `design/main-ui-shell.md` |
| T14 | [x] | Sprite preload code: новый `src/main/render/spritePreload.ts` — функция `preloadSprites(specs, onProgress) → Promise<TextureMap>`: грузит и декодирует все textures из объединённого списка трёх visual registries; первая ошибка приводит к rejected Promise с диагностикой. Вызывается `UiShell` в фазе `loading`. Lazy-load во время боя запрещён. | опоры: `design/sprite-assets.md`, `design/main-ui-shell.md` |
| T15 | [x] | Renderer asset-only: правки [src/main/render/Renderer.ts](../src/main/render/Renderer.ts) — для `player`/`enemy`/`boss` создавать `THREE.PlaneGeometry(worldSize.width, worldSize.height)` + `THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false })` из preloaded `TextureMap`. Удалить `CircleGeometry`/`color` пути для этих kinds. `projectile`/`drop`/zone overlay/crosshair — не трогаем. Renderer бросает hard-error при missing visual spec / missing texture. | опоры: `design/sprite-assets.md` |
| T16 | [x] | Tests: PNG-size util tests (см. T4); drift-сценарий «PNG поменялся, MD не правлен — `content:check` падает»; renderer hard-error tests (missing visual spec / missing texture); UiShell `loading`/`error('preload')` phase tests (переходы, видимость, отсутствие Renderer); `validateEnemyVisuals`/`validateBossVisuals`/`validatePlayerVisuals` tests; smoke tests на все 30 slime ids и 5 boss ids; миграция существующих snapshot-тестов под новые id; тест «`PX_PER_WU = 240` единственный источник scale». | опоры: `design/sprite-assets.md`, `design/main-ui-shell.md`, `design/testing.md` |
| T16a | [x] | Архитектор: добавить `design/body-contact-boxes.md` и обновить `design/content-archetypes.md`, `design/session-definition.md`, `design/enemy-contact.md` под derive `contactBox` для body-contact `player` / `enemy` / `boss`; обновить `design/README.md`, `stories/013` (`Technical`, `Tasks`, `Related`). | архитектор |
| T16b | [x] | Collision follow-up: derive `contactBox` в shared content для `players` / `enemies` / `bosses` из того же PNG scale pipeline, что и visual registry; перенести `CombatSystem` contact overlap на box-vs-box и projectile hit detection на circle-vs-contactBox; player clamp в `MovementSystem` перевести на `contactBox`; добавить/обновить tests на `content-build`, `CombatSystem`, `MovementSystem`, `buildSession` и live registries. | опоры: `design/body-contact-boxes.md`, `design/content-archetypes.md`, `design/enemy-contact.md`, `design/projectiles-and-combat.md`, `design/session-definition.md` |
| T17 | [x] | Demo/closure: PR #12 merged в `main`. Splash + loader появляются до меню, hero/slime/boss спрайты отрисовываются, gameplay-regression тесты зелёные (313/313). `Status` переведён в `done`, таблица в `stories/README.md` обновлена, `Index` в `design/README.md` включает `sprite-assets.md` и `body-contact-boxes.md`. | архитектор |

## Related

- [../design/sprite-assets.md](../design/sprite-assets.md)
- [../design/body-contact-boxes.md](../design/body-contact-boxes.md)
- [../design/content-authoring.md](../design/content-authoring.md)
- [../design/content-archetypes.md](../design/content-archetypes.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/main-ui-shell.md](../design/main-ui-shell.md)
- [../design/render-scale.md](../design/render-scale.md)
- [../design/arena-and-coordinates.md](../design/arena-and-coordinates.md)
- [../design/audio.md](../design/audio.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/testing.md](../design/testing.md)
- [011-content-from-md.md](011-content-from-md.md)
- [012-content-archetypes-from-md.md](012-content-archetypes-from-md.md)
