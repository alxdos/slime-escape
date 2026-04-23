# Sprite Assets and Loader

- Status: planned
- Created: 2026-04-23
- Updated: 2026-04-23

## Player-facing

- Sees: при старте приложения белую заставку с `public/images/slime-escape.jpg`, вписанную через `contain`, и лоадер внизу экрана. После загрузки игра показывает героя, слаймов и босса PNG-спрайтами из `public/assets`, без круговых fallback-визуалов.
- Can do: запустить тренировку или кампанию и играть как раньше, но видеть реального персонажа, все активные слаймы и босса как картинки. Все 30 слаймов и 5 боссов заведены в контент так, чтобы будущие волны могли ссылаться на их `id`.

## Technical

- Это вертикальная история: MD-контент, генератор, preload, startup UI и renderer должны сойтись в demoable результате. История не считается готовой, если ассеты только описаны, но игра всё ещё рисует круги.
- `2240x1260` используется только как reference arena для расчёта визуального масштаба ассетов. Это `16:9` (`2240 / 140 = 16`, `1260 / 140 = 9`). Текущая игровая арена `32x18` не меняется; для неё reference scale равен `70 px / wu`.
- В MD автор указывает только `image` и игровой/визуальный intent (`displayName`, описание, gameplay-числа). Размерные поля `sourceSizePx`, `displayWidthPx`, `displayHeightPx`, `displaySizePx`, `worldSize` в MD руками не пишутся: `scripts/content-build` читает оригинальный PNG во время генерации и пересчитывает эти значения сам.
- Для player/enemy/boss появляется presentation-контракт рядом с renderer-слоем, например `src/main/render/entitySprites.generated.ts`: `image`, `sourceSizePx`, `displaySizePx`, `worldSize`, `anchor`, `kind`. `displaySizePx` выводится из фактического размера PNG; `worldSize` выводится через reference scale `70 px / wu` (`2240x1260` ↔ `32x18`). Симуляция продолжает работать с gameplay-полями (`radius`, `maxHp`, `speed`, damage) и не читает PNG.
- Renderer для `player`, `enemy`, `boss` использует только заранее загруженные textures. Missing texture, missing visual spec или несовпадение `archetypeId` с visual registry — hard error на старте/в тесте, не fallback на `CircleGeometry`/`color`.
- Все PNG, перечисленные в generated sprite registry, загружаются и декодируются до показа меню. На время загрузки показывается startup screen: белый фон, `public/images/slime-escape.jpg` с `object-fit: contain`, внизу progress bar и короткий статус (`Loading assets 12/36`). Lazy-load во время боя запрещён.
- `content/enemies.md` расширяется с двух игровых слаймов до всех 30 ассетов. Текущие `slime-fast`/`slime-tank` заменяются новыми смысловыми archetype id; тренировочные и campaign-волны переводятся на новые id с близкой сложностью.
- `content/bosses.md` содержит все 5 боссов. Campaign может продолжать использовать одного активного босса, но renderer и preload обязаны уметь отрисовать любого босса из registry.
- `content/players.md` или отдельная player-visual секция вводит единственный visual id `hero` для `public/assets/hero.png`. Эта история не вводит выбор скина игрока.

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
- `content/enemies.md` содержит все 30 slime archetypes из `public/assets/slime-*.png`. Если `training-target` остаётся для sandbox tests, у него тоже должен быть явный sprite visual; иначе sandbox-with-combat переводится на реальный slime id. Старые игровые `slime-fast`/`slime-tank` больше не являются единственными боевыми слаймами.
- `content/bosses.md` содержит 5 boss archetypes из `public/assets/boss-*.png`; campaign boss использует `boss-scrap-king` или явно выбранный replacement id.
- Player visual `hero` описан в MD и используется renderer-ом для live player во всех режимах.
- Генератор читает PNG dimensions из файлов во время `npm run content:build` и пишет их в generated visual registry. `sourceSizePx` равен фактическому размеру PNG; `displaySizePx` для этой истории пересчитывается из `sourceSizePx` без ручных overrides; `worldSize = displaySizePx / 70`. Если PNG удалён, путь неверный, файл не PNG или размер не читается — генерация падает до записи выходных файлов.
- `content:check` ловит дрейф, если изменился PNG размер или MD visual fields, но `.generated.ts` не обновлён. MD-колонки `sourceSizePx`, `displayWidthPx`, `displayHeightPx`, `displaySizePx`, `worldSize` запрещены и должны приводить к ошибке генератора, чтобы размеры не становились ручным источником правды.
- Startup preloader загружает и декодирует все sprite images из generated registry до меню. Во время загрузки видна белая заставка с `public/images/slime-escape.jpg` (`contain`) и loader внизу. При ошибке загрузки показывается явная startup error, игра не стартует с fallback-графикой.
- Renderer для `player`, `enemy`, `boss` не создаёт круговые fallback-meshes. Тесты проверяют, что missing visual spec/texture приводит к ошибке, а не к `CircleGeometry`.
- В тренировке видны hero sprite и новые slime sprites; в campaign виден boss sprite. Существующая стрельба, контактный урон, HP, drops, win/loss и pause/menu поведение остаются зелёными по тестам.
- `npm run content:build`, `npm run content:check`, `npm test` и `npm run build` зелёные.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [ ] | Архитектор: обновить `design/content-authoring.md`, `design/content-archetypes.md`, `design/render-scale.md` или завести `design/sprite-assets.md`: зафиксировать asset-only renderer для player/enemy/boss, reference arena `2240x1260`, generated `sourceSizePx`, startup preload и запрет fallback-кругов. | Перед кодом |
| T2 | [ ] | Generator: добавить чтение PNG dimensions из `public/assets` в `scripts/content-build`; расширить enemies/bosses/player visual authoring так, чтобы generated presentation registry содержал `image`, `sourceSizePx`, `displaySizePx`, `worldSize`, `anchor`. `displaySizePx` и `worldSize` пересчитываются из оригинального PNG при каждой генерации; ручные size-колонки в MD запрещены. Ошибки файлов — атомарный fail без записи. | Опора: `design/content-authoring.md` |
| T3 | [ ] | Content: переписать `content/enemies.md` на все 30 слаймов из таблицы story; завести/расширить `content/bosses.md` на 5 боссов; завести player visual `hero`. Все gameplay-поля записать явно, но не добавлять `sourceSizePx`/`displayHeightPx`/`worldSize` в MD. | Текущие два слайма заменить |
| T4 | [ ] | Sessions: обновить sandbox-with-combat/training/campaign references с `training-target`/`slime-fast`/`slime-tank` на ids с явными sprite visuals так, чтобы сложность осталась близкой текущей; campaign boss перевести на выбранный boss id. | Волны не становятся редактором |
| T5 | [ ] | Startup UI: до создания меню запустить asset preload; показать белую заставку с `public/images/slime-escape.jpg` (`contain`) и нижним progress loader; при ошибке показать startup error и не запускать игру. | Все sprite images loaded upfront |
| T6 | [ ] | Renderer: заменить player/enemy/boss circle meshes на texture sprites/planes из preloaded registry; убрать color/radius fallback для visuals; сохранить radius только как gameplay/collision source. | Без fallback-кругов |
| T7 | [ ] | Tests: generator PNG-size tests, drift tests, preload success/failure tests, renderer missing visual hard-error tests, smoke tests на все 30 slime ids и 5 boss ids. | `npm test` зелёный |
| T8 | [ ] | Demo/closure: пройти startup → training → campaign, зафиксировать в истории, что видны hero/slime/boss sprites, loader появляется до меню, а gameplay-regression тесты зелёные. | Закрытие по `stories/README.md` |

## Related

- [../design/content-authoring.md](../design/content-authoring.md)
- [../design/content-archetypes.md](../design/content-archetypes.md)
- [../design/render-scale.md](../design/render-scale.md)
- [../design/arena-and-coordinates.md](../design/arena-and-coordinates.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/main-ui-shell.md](../design/main-ui-shell.md)
- [011-content-from-md.md](011-content-from-md.md)
- [012-content-archetypes-from-md.md](012-content-archetypes-from-md.md)
