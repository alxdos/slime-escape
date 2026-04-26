# Титры волн и музыка сессии

- Status: in-progress
- Created: 2026-04-26
- Updated: 2026-04-26 (архитектурная подготовка: контракты вынесены в design/)

## Player-facing

- Видит: перед каждой волной на несколько секунд появляется большой титр поверх арены. Первая строка сообщает глобальный номер волны в сессии (`Волна 1`, `Волна 2`, `Волна 3`, ...), вторая строка, если задана в контенте, даёт художественное название волны (`Каменные взгляды`). Слаймы начинают выходить только после титра.
- Видит: в коротких break-окнах после босса может появляться переходный текст, например `Дальше: Индустриальные мутанты`. Это не меню и не карточка, а такая же яркая надпись поверх арены.
- Слышит: обычная музыка больше не выбирается случайно из захардкоженного пула. У каждой session есть свой трек, который играет во всех обычных волнах и break-ах. На boss encounter музыка временно переключается на текущий boss-track; после босса возвращается трек сессии.
- Чувствует: кампания становится читаемой как глава за главой: сет объявляется коротким break-текстом, волна объявляется номером и названием, а музыка сессии удерживает общий тон забега.

## Technical

История добавляет presentation-поля encounter (`introDurationMs`/`name`/`text`), session-level обычную музыку (`musicSampleId`) и отдельный UI-слой title overlay поверх существующей MD-системы из 015. Архитектурные контракты — в design/:

- Форма полей encounter, парные ограничения по `type`, intro delay для `SpawnSystem`/`ZoneSystem`/`SessionFlowSystem`, глобальная нумерация wave encounter-ов, render-контракт wave/break overlay — [encounter-presentation.md](../design/encounter-presentation.md).
- `SessionDefinition.musicSampleId: string | null` и ссылка на audio-валидацию — [session-definition.md](../design/session-definition.md).
- Source обычной музыки = `attachedSession.musicSampleId`, boss override сохраняется, `category: 'music'` ⇒ `loop: true`, `musicSampleId` обязан быть music-категории — [audio.md](../design/audio.md).
- Authoring: `# Session` получает поле `musicSampleId` (`none` → `null`), encounter field|value получает `introDurationMs`/`name`/`text` с hard-error на нарушение парных ограничений — [content-authoring.md](../design/content-authoring.md).

HUD-нумерация волн, overlay и итоговое окно используют глобальный порядок wave encounter-ов (по [main-ui-shell.md](../design/main-ui-shell.md) и [encounter-presentation.md](../design/encounter-presentation.md)). Снапшот не расширяется: intro-активность derive-ится из `snapshot.encounter.elapsedMs` и `SessionDefinition.encounters[i].introDurationMs`.

### Visual style

- Overlay не является карточкой и не блокирует вид арены декоративной панелью.
- Текст расположен по центру viewport/арены, поверх gameplay canvas/HUD.
- Буквы светлые и яркие, с чёрной обводкой и контрастной тенью. Ориентир:
  - первая строка (`Волна 3`) меньше, uppercase или small-caps допустимы;
  - вторая строка (`Каменные взгляды`) крупнее и выразительнее;
  - `-webkit-text-stroke`/эквивалентная обводка 2-3 px чёрным;
  - несколько слоёв `text-shadow` для читаемости на светлых фонах set-1/set-2/set-4/set-5;
  - fade in / hold / fade out без скачков layout.
- Текст должен помещаться на mobile и desktop. Длинные названия переносятся максимум на две строки subtitle, без отрицательного letter-spacing и без font-size от viewport width.

### Content naming

Прототипные комментарии не копируются дословно. Названия должны соответствовать текущим архетипам и PNG-спрайтам.

Текущая карта сетов:

| set | тема | текущие основные слаймы | boss |
|---|---|---|---|
| set-1 | Первые слаймы | One-Eye, Sleeper, Hornling, Spark, Many-Eye, Stonehead | Gargoyle Slime |
| set-2 | Хламные призраки | Trickster, Wraith, Shell, Stack, Mech Crab, Flame | Saw Cyclops |
| set-3 | Индустриальные мутанты | Echo, Bug, Star, Lifter, Drone, Saw, Idol на hard | Scrap King |
| set-4 | Королевство на войне | Tadpole, Fortress, Splitter, Prince, Dasher, Kingling, Idol/Mech Crab на hard | Tower Sentinel |
| set-5 | Техно-финал | Door, Candle, Mech, Clamper, Obelisk, Ninja, Idol на hard | Bubble Hog |

Предлагаемые названия волн для normal/hard:

| encounter pattern | name |
|---|---|
| campaign-set-1-wave-1 | Один глаз в темноте |
| campaign-set-1-wave-2 | Рога и искры |
| campaign-set-1-wave-3 | Каменные взгляды |
| campaign-set-2-wave-1 | Панцири и призраки |
| campaign-set-2-wave-2 | Хламная куча |
| campaign-set-2-wave-3 | Огненный скрап |
| campaign-set-3-wave-1 | Эхо в противогазах |
| campaign-set-3-wave-2 | Качки и дроны |
| campaign-set-3-wave-3 | Бензопильный цех |
| campaign-set-4-wave-1 | Бомбы у ворот |
| campaign-set-4-wave-2 | Принцы и сюрикены |
| campaign-set-4-wave-3 | Корона мёртвых |
| campaign-set-5-wave-1 | Дискеты и двигатели |
| campaign-set-5-wave-2 | Магниты и ниндзя |
| campaign-set-5-wave-3 | Идолы последнего сектора |

Easy использует только set-1 / set-3 / set-5 по две волны. Для easy можно использовать те же названия первых двух волн соответствующих сетов.

Предлагаемые after-boss break тексты:

| break | text |
|---|---|
| campaign-set-1-after-boss-break | Дальше: Хламные призраки |
| campaign-set-2-after-boss-break | Дальше: Индустриальные мутанты |
| campaign-set-3-after-boss-break | Дальше: Королевство на войне |
| campaign-set-4-after-boss-break | Дальше: Техно-финал |

Для финального boss после set-5 after-boss break сейчас нет, потому что кампания заканчивается на boss encounter. Финальный outro/result overlay не входит в эту историю.

## Out of scope

- Per-wave music, per-set music и crossfade между сетами. В этой истории обычный трек один на всю session.
- Per-boss custom music в content. Все boss encounter-ы используют текущий `boss/boss-music`.
- Новая музыка, новые mp3-файлы, нормализация/мастеринг треков. Можно только подключить уже лежащие файлы из `public/sfx/music/` в registry.
- Переименование enemy `displayName` / `id` ради художественных названий волн. Story добавляет player-facing тексты encounter-ов, не меняет архетипы.
- Локализация на несколько языков. Все новые campaign-тексты пишутся по-русски, как текущие `displayName` кампаний.
- Landing page, отдельные cutscene-экраны, иллюстрации сетов, портреты слаймов в титре.
- Сохранение/пропуск intro по кнопке. Игрок ждёт короткий фиксированный intro.
- Изменение HUD wave progress. Существующий HUD может продолжать показывать свою строку прогресса; overlay — отдельный слой.
- Изменение boss music поведения, кроме возврата к session track после boss.

## Acceptance

- В начале каждой wave с `introDurationMs > 0` появляется overlay. Во время overlay `waveProgress.dispatched` остаётся `0`, enemy count не увеличивается, зона остаётся на стартовом margin.
- После окончания intro первая волна начинает спавнить слаймов по существующим `spawnIntervalMs`, а зона начинает сжиматься с нулевой точки своего wave-таймера.
- Overlay показывает глобальный номер: `campaign-set-2-wave-1` отображается как `Волна 4`, не `Волна 1`.
- Overlay не показывает "Wave 1" из markdown: номер вычисляется из `session.encounters`.
- Если `name` задан, видны две строки; если `name` отсутствует, видна только строка номера.
- Break с `text` показывает этот текст в течение break encounter и исчезает при переходе к следующему encounter.
- Текст overlay читаем на всех текущих фонах (`bg-01`..`bg-05`): светлые яркие буквы, чёрная обводка, контрастная тень, без карточки.
- Все campaign session-файлы проходят `npm run content:check`: `name`, `introDurationMs`, `text`, `musicSampleId` парсятся и попадают в generated content.
- `content:check` падает, если `musicSampleId` неизвестен или указывает на sample не из категории `music`.
- Для session с `musicSampleId: none` обычная музыка не стартует.
- Для session с `musicSampleId: music/005-forest` обычные wave/break encounter-ы играют именно этот трек, без random pool.
- При входе в boss encounter включается `boss/boss-music`; при выходе из boss encounter возвращается `musicSampleId` текущей session.
- В `menu` / `result` / `loading` / `error` музыка останавливается, как до истории.
- Pause не меняет track, только duck-ит music gain, как до истории.
- `npm run content:check && tsc -p tsconfig.scripts.json && npm run typecheck && npm test` проходят.
- Визуальная проверка через dev server: старт normal campaign показывает `Волна 1 / Один глаз в темноте`, слаймы появляются только после титра; после первого босса появляется `Дальше: Хламные призраки`; boss music включается на боссе и возвращается к session music после него.

## Tasks

Архитектурная часть уже закрыта одним PR (`[021 architect]`) — все контракты в `design/` приняты. Кодовые задачи идут последовательно, каждая — отдельным коммитом на той же ветке.

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Архитектурная подготовка: новый [encounter-presentation.md](../design/encounter-presentation.md); обновления [session-definition.md](../design/session-definition.md), [audio.md](../design/audio.md), [content-authoring.md](../design/content-authoring.md), [spawn-plan.md](../design/spawn-plan.md), [zone.md](../design/zone.md), [main-ui-shell.md](../design/main-ui-shell.md), `design/README.md`; актуализация `Related`/`Technical`/`Tasks` истории. | Ветка архитектора, без правок `src/**` и `content/**`. |
| T2 | [x] | Расширить shared-типы в `src/shared/session.ts` и смежных: `SessionDefinition.musicSampleId: string \| null`; `EncounterDefinition` получает **обязательные** `introDurationMs: number`, `name: string \| null`, `text: string \| null` (плоская форма, без `?`). | Инвариант — пустой `name`/`text` запрещён, значение либо `null`, либо непустая строка. TS-fixtures в тестах дозаполняются явно, без backward-compat shim. |
| T3 | [x] | `scripts/content-build/sessions/**`: парсинг `musicSampleId` в первой `# Session` таблице (`none` → `null`, plain → cross-check через `SampleRegistry` + `category: 'music'`); парсинг `introDurationMs`/`name`/`text` в encounter field\|value (`none` → `null`/`0`); hard-error на нарушение парных ограничений из [encounter-presentation.md](../design/encounter-presentation.md). | Сообщения об ошибках с `file:line`; unit-тесты — в T8. |
| T4 | [x] | Обновить все `content/sessions/*.md` (все три кампании + `training`/`sandbox`/`sandbox-with-combat`/`combat-modifiers-demo`): добавить `musicSampleId` (`none` для sandbox-ов, явный трек для кампаний); campaign wave-ам добавить `introDurationMs: 2500` и `name` из раздела Content naming; after-boss break-ам добавить `text` и при необходимости поднять `transitionDurationMs`. | Контент, не код. Регенерация `sessions.generated.ts` через `content:build`. |
| T5 | [x] | `Audio`: убрать `REGULAR_MUSIC_POOL` и `lastRegularMusicSampleId`, источник regular music = `attachedSession.musicSampleId`; boss override и pause ducking не трогать; в `SampleRegistry` прописать `loop: true` для всех entries с `category: 'music'`; в `createAudio`/`attach` добавить валидации из [audio.md](../design/audio.md). | Дозаполнить `SampleRegistry` всеми уже лежащими `/sfx/music/*.mp3`, если они нужны контенту. |
| T6 | [x] | Реализовать intro delay в sim: `SpawnSystem`, `ZoneSystem` и `SessionFlowSystem` уважают `encounter.elapsedMs < encounter.introDurationMs` по правилам [encounter-presentation.md](../design/encounter-presentation.md); `'allEnemiesCleared'` подавляется во время intro. | `encounter.elapsedMs` уже в snapshot — дополнительные поля не нужны. |
| T7 | [x] | Реализовать wave/break title overlay в `src/main/ui/**`: отдельный компонент, подключённый `UiShell` параллельно `Hud`; данные — `SessionDefinition` + `snapshot.encounter`; глобальная нумерация по всем wave encounter-ам; condition показа и z-order — по [encounter-presentation.md](../design/encounter-presentation.md). | Не делать карточку. Стили (обводка, тень, fade) — раздел Visual style этой истории. |
| T8 | [x] | Тесты content-build: валидный `musicSampleId`, `none`, неизвестный sample, sample не music-category; `introDurationMs`/`name`/`text` с валидными комбинациями и hard-error на нарушение парных ограничений. | Поверх `scripts/content-build/sessions/**` unit-тесты. |
| T9 | [x] | Тесты sim/UI/audio: глобальный wave number поверх break/boss границ; delayed spawn и zone при intro; `allEnemiesCleared` не срабатывает во время intro, включая `spawnPlan: { kind: 'empty' }` wave; overlay lifecycle; session music → boss music → session music; `musicSampleId: null` = silent; `category: 'music'` && `!loop` = ошибка модуля. | `Hud.test.ts`, `Audio.test.ts`, `SessionFlowSystem` tests, новый overlay test. |
| T10 | [ ] | Финальная верификация: `npm run content:check && tsc -p tsconfig.scripts.json && npm run typecheck && npm test`; dev-server visual/audio sanity. | Проверить набор: set-1 wave-1 (intro + название + первый slime), set-1 pre-boss break, set-1 boss (musicSampleId → boss music), set-1 after-boss break (text), set-2 wave-1 (глобальная «Волна 4», не «Волна 1»). |

## Related

- [encounter-presentation.md](../design/encounter-presentation.md)
- [session-definition.md](../design/session-definition.md)
- [audio.md](../design/audio.md)
- [content-authoring.md](../design/content-authoring.md)
- [spawn-plan.md](../design/spawn-plan.md)
- [zone.md](../design/zone.md)
- [main-ui-shell.md](../design/main-ui-shell.md)
- [008-audio-baseline.md](008-audio-baseline.md)
- [015-sessions-from-md.md](015-sessions-from-md.md)
- [020-shooting-slimes.md](020-shooting-slimes.md)
