# Audio

- Status: accepted
- Created: 2026-04-20
- Updated: 2026-04-26 (story 023: `AudioUiEventId` расширен на `buttonHover` и `modeSwitch`; `buttonHover` маппится на существующий `ui/open-1`, `modeSwitch` резервирует существующий `ui/switch-2`, а общий `buttonClick`-пул использует оставшиеся `ui/switch-1/3/4`. Оба новых UI-события вызываются через `UiShell`; новых audio assets не вводится. story 021: music selector больше не хранит `regularPool` внутри `Audio` — выбор обычной музыки переносится на session-level поле `SessionDefinition.musicSampleId` ([session-definition.md](session-definition.md)); boss override по `encounter.type === 'boss'` сохраняется без изменений, pause ducking тоже. `SampleRegistry`-инвариант: любой entry с `category: 'music'` обязан иметь `loop: true`, иначе ошибка модуля на инициализации `Audio`; валидатор музыки теперь явно проверяет category+loop. Для `musicSampleId: null` регулярная музыка молчит весь забег — это legitimate конфигурация. Earlier: 2026-04-23 story 014: авторская поверхность для `WEAPON_AUDIO_MAPPINGS[*].fire` переезжает на inline audio-link-узел под H2 weapon в `content/weapons.md`, для `ENEMY_AUDIO_MAPPINGS[*].hit/death/voice` — на новую партицию `# Sound sets` в `content/enemies.md` с `## Members` (`setId | slimes`) и узкими group-таблицами `## Hit`/`## Death`/`## Voice`, чьи `sampleId`-ячейки тоже допускают inline audio-link-форму (см. разделы «Inline media-узлы как derive-источники» и «Shared resource set partition» в [content-authoring.md](content-authoring.md)); рантайм-формы `EnemyAudioMapping`, `BOSS_AUDIO_MAPPINGS`, `WEAPON_AUDIO_MAPPINGS`, `SampleRegistry`, `createAudioMappings` и валидаторы — не меняются, генератор разворачивает sound-set N→1 в тот же `Record<enemyArchetypeId, EnemyAudioMapping>` байт-в-байт. story 013 расширяет `ENEMY_AUDIO_MAPPINGS` на все 30 slime-архетипов и `BOSS_AUDIO_MAPPINGS` на все 5 boss-архетипов через те же три пула `slimes/hit-*`/`slimes/death-*`/`slimes/voice-*` и существующие boss sample id; формы маппингов и `SampleRegistry` не меняются. story 012 покрывает MD-генерацией weapon/boss audio-маппинги и дозаполнение enemy sound по пулам из `SampleRegistry`; типы и валидации не меняются)

## Context

[thread-model.md](thread-model.md) фиксирует, что аудио живёт в `main thread`, что HUD и аудио опираются на снапшоты, а runtime events используют как триггеры реакции, и что master gain — будущая точка интеграции с настройками громкости. [snapshot-shape.md](snapshot-shape.md) задаёт per-kind поля сущностей в снапшоте (с обязательным `archetypeId` у `enemy`/`projectile`/`drop`/`boss`) и форму runtime events: `fire`, `hit`, `death`, `dropSpawn`/`dropPickup`/`dropExpire`, `bossPhaseChange`, `pause`/`resume`, `encounterStart`/`encounterEnd`, `win`/`loss`. [main-ui-shell.md](main-ui-shell.md) уже зафиксировал, что 008 «attaches к UI-фазам и runtime events», что HUD не подписывается на runtime events напрямую и что прямой доступ к `SimWorkerHost.onEvent` из компонентов запрещён — фан-аут идёт через `UiShell`. [content-boundaries.md](content-boundaries.md) делит данные на четыре уровня и помещает «громкость» в `client settings`. [content-archetypes.md](content-archetypes.md) фиксирует поле `color` как контентный плейсхолдер визуала, но не вводит аудио-полей в архетипы. [rng.md](rng.md) ограничивает session RNG только симуляцией; main вправе использовать `Math.random` для presentation, не уходящей в snapshot/события. [web-stack.md](web-stack.md) запрещает вводить новые корневые директории под презентацию; всё новое для main лежит внутри `src/main/**`.

История 008 одновременно вводит:

- Web Audio mixer и unlock на жесте;
- маппинг `weaponArchetypeId` / `enemyArchetypeId` / `bossArchetypeId` / события → сэмплы;
- ambient-голоса слаймов, у которых нет соответствующего runtime event в симе;
- фоновую музыку с переключением на boss-track и на UI-фазы (`menu`/`running`/`paused`/`result`);
- индивидуальные поправки громкости для исходных файлов (шотган громче, slime ambient тише), и одновременно
- задел под 009 (settings), который должен крутить master/per-bus volume поверх этих поправок, не перетирая их.

Без явного контракта 008 закрепит «магические» множители в коде систем, поправки громкости и gameplay-громкость смешаются в одной точке, маппинг архетипов утечёт в `src/shared/content/**`, а 009 будет вынуждена переоткрыть тот же контракт. Решение фиксирует общую модель аудио на горизонт MVP.

## Decision

### Размещение

- Весь аудио-стек живёт под `src/main/audio/**`. Новых корневых каталогов проект не получает (см. [web-stack.md](web-stack.md)).
- Никакой модуль `src/main/audio/**` не имеет права импортировать из `src/sim/**`. Контакт с симуляцией — только через уже зафиксированный API `SimWorkerHost` (`onEvent`/`snapshotPair`/`isPaused`); фан-аут к `Audio` выполняет `UiShell`, как для `Hud` ([main-ui-shell.md](main-ui-shell.md)).
- Маппинги «архетип → sampleId» и «событие → sampleId» живут в `src/main/audio/**`, **не** в `src/shared/content/**`. Это presentation-данные, не игровой контент: их читает только main, они не входят в `SessionDefinition` и не влияют на исход забега. `EnemyArchetype`/`WeaponArchetype`/`BossArchetype` в [content-archetypes.md](content-archetypes.md) **не** расширяются аудио-полями; связь идёт по строковому `archetypeId`, который уже есть в снапшоте/событиях.

### AudioContext и unlock

- На всё приложение — **один** `AudioContext`, создаётся при старте `UiShell` рядом с `Hud`/`SimWorkerHost` и живёт всю жизнь приложения. `stopSession` не приводит к пересозданию контекста, точно так же, как не приводит к `worker.terminate()` ([thread-model.md](thread-model.md)).
- До первого user-gesture браузеры держат `AudioContext` в `suspended`. `Audio.unlock()` идемпотентен и:
  - вызывается `UiShell` из захватывающего one-shot listener-а на `pointerdown`/`keydown`;
  - переводит `AudioContext` в `running` через `resume()`;
  - до первого успешного unlock-а любые попытки воспроизведения no-op с warning через единый log-модуль ([logging.md](logging.md)).
- `Audio.unlock()` не зависит от состояния сессии: он применим и в `menu`-фазе, и в любой другой. Это позволяет сразу проиграть UI-звуки на первом клике/кнопке.

### Mixer graph

- Граф соединений источника:
  ```
  source -> perSourceTrim -> categoryBus -> master -> destination
  ```
- Категории (`bus`) на горизонт 008–009: `sfx`, `music`, `ui`. Расширение (например, отдельный `voice`-bus для слайм-ambient или `ambience` для нелокальных шумов) допустимо отдельным расширением **этого** файла; вводить bus «по месту» в коде систем запрещено.
- На 008 baseline `master` и все `bus` начинаются со значения `1.0`. История 009 (settings) рулит ими через `client settings` ([content-boundaries.md](content-boundaries.md)) и не вводит собственного контракта громкости — она пишет в уже существующие точки этого графа.
- Граф полностью описывается на стороне `src/main/audio/**`; конкретные `GainNode`/`AudioBufferSourceNode` — деталь реализации.

### Двухслойная громкость (sample registry)

Источник «магических чисел» в аудио — две **разные** оси:

1. Поправка на громкость исходного файла (меняется, когда файл переписали или заменили).
2. Gameplay-роль звука (меняется, когда меняется его место в игре: шотган громче пистолета, ambient слаймов специально приглушён).

Эти оси разводятся на уровне реестра сэмплов и комбинируются по фиксированной формуле.

- Каждый сэмпл в реестре несёт минимум:
  ```ts
  type SampleCategory = 'sfx' | 'music' | 'ui';

  type SampleEntry = Readonly<{
    id: string;                     // стабильный, уникальный в реестре
    url: string;                    // путь относительно public/
    category: SampleCategory;
    normalizedGain: number;         // (0, 2], коррекция громкости файла
    defaultGain: number;            // [0, 2], gameplay-уровень громкости
    loop?: boolean;                 // true — для music/ambience
  }>;
  ```
- Для `category: 'music'` поле `loop` обязательно равно `true`. Это инвариант модуля: session music по контракту «один трек на всю сессию» ([session-definition.md](session-definition.md), поле `musicSampleId`), и `Audio` не полагается на «сам перезапущу при `onended`». Нарушение — ошибка модуля на инициализации `Audio` (см. «Бюджеты и инварианты»).
- Эффективный gain источника при воспроизведении:
  ```
  effectiveGain =
    sample.normalizedGain
    * sample.defaultGain
    * (perCallGainMul ?? 1)
    * busGain[sample.category]
    * masterGain
  ```
  где `perCallGainMul` — опциональный ситуативный множитель (например, falloff по дистанции в будущих расширениях), а `busGain`/`masterGain` — узлы графа.
- Формула описывает **итоговый** effective gain в точке `destination`. На уровне `Web Audio`-графа эти множители распределены по узлам так, что каждый множитель появляется ровно один раз:
  - `perSourceTrim.gain.value = sample.normalizedGain * sample.defaultGain * (perCallGainMul ?? 1)`;
  - `busGain[category].gain.value` — owned bus-узлом, меняется только через расширения этого файла (на горизонт 008 — статически `1.0`);
  - `masterGain.gain.value` — owned master-узлом, единственная точка для 009 (см. ниже «Settings integration»).
- Запрещено инлайнить значение `busGain`/`masterGain` внутрь `perSourceTrim`: это сломает live-изменение громкости у уже играющих источников и продублирует множитель для новых. Смена `gain.value` на bus/master-узле штатно (по семантике Web Audio) применяется ко всем подключённым источникам, включая уже играющие.
- Правила содержания полей:
  - `normalizedGain` подбирается «по уху/измерению» на стороне реестра, **не** в кодах систем-потребителей. Менять только при замене файла.
  - `defaultGain` отражает дизайн-намерение «как громко эта роль должна звучать в нейтральных условиях». Менять при изменении дизайнерской роли звука (например, «слайм-ambient слишком давит — снизить до 0.2»).
  - Конкретные явные точки на 008 baseline:
    - `weapons/shotgun.mp3` — `normalizedGain ≈ 0.35` (исходный файл сильно громче остальных оружий);
    - `slimes/slime-*` в роли ambient — `defaultGain ≈ 0.3` (приглушённый фон, не перебивает выстрелы и попадания).
- Запрещены:
  - Жёстко зашитые числовые множители громкости в коде систем-потребителей. Если конкретный звук «звучит не так», правка идёт в реестр, не в систему.
  - Реестр в `src/shared/content/**`. Аудио-данные не часть `content library` — они **не** влияют на симуляцию и не сериализуются как контракт сессии.

### Маппинг архетип/событие → sampleId

Аудио-слой держит явные карты, индексированные строковыми `archetypeId`, которые уже доступны в снапшоте и событиях:

- `weapons: Record<weaponArchetypeId, { fire: SampleSpec }>` — на 008 ровно один реальный потребитель (`pistol`); записи под `shotgun`/`smg`/`sniper`/`laser` могут существовать заранее, не дожидаясь WeaponArchetype-ов в `content/**`.
- `enemies: Record<enemyArchetypeId, { hit?: SampleSpec; death?: SampleSpec; voice?: SampleSpec }>` — для архетипов слаймов; стационарные «training-target» допускают пустую запись.
- `bosses: Record<bossArchetypeId, { fire?: SampleSpec; hit?: SampleSpec; death?: SampleSpec; phaseChange?: SampleSpec }>` — на 008 baseline для `slime-king`: `fire = boss-fireball`, `phaseChange = boss-ahaha`.
- `events: { dropPickup?: SampleSpec; dropSpawn?: SampleSpec; dropExpire?: SampleSpec; uiOverlayShow?: SampleSpec; uiButtonClick?: SampleSpec; uiButtonHover?: SampleSpec; uiModeSwitch?: SampleSpec }` — события без естественной привязки к архетипу. На 008 заполняются как минимум `dropPickup`, `uiOverlayShow`, `uiButtonClick`; история 023 добавляет `uiButtonHover` и `uiModeSwitch` как переиспользование существующих UI-сэмплов.
- `SampleSpec` допускает либо одиночный `sampleId`, либо набор `sampleId[]` — в этом случае воспроизводится случайный из набора (presentation RNG, см. ниже). Это нужно для коротких пулов вариаций (`slime-1..4` как варианты hit/voice).
- Отсутствие маппинга — **не** ошибка, а явный «звук пропускается»: `Audio` логирует один warning на уникальный `archetypeId`/`event` через единый log-модуль ([logging.md](logging.md)) и больше не дёргает на той же сессии. Это намеренно: новые архетипы не должны падать ран только из-за отсутствия аудио-маппинга.
- Маппинги валидируются на инициализации: каждый `sampleId` обязан резолвиться в `SampleEntry` реестра; неизвестный `sampleId` — ошибка модуля, не runtime-фолбэк (по аналогии с правилом «неизвестный архетипный id — ошибка сборки/старта сессии» из [content-archetypes.md](content-archetypes.md)).

### Источники триггеров

`Audio` подписан на три канала:

1. **Runtime events** (фан-аут от `UiShell`):
   - `fire` → один-шот по `weapons[event.weaponArchetypeId].fire`. Для `event.ownerKind === 'boss'` маппинг идёт через `bosses[bossArchetypeId].fire`; конкретный `bossArchetypeId` берётся из активного `SessionDefinition` (для MVP в encounter босса — единственный босс).
   - `hit` → `enemies[archetypeId].hit` или `bosses[archetypeId].hit`; `archetypeId` цели находится через текущий снапшот по `event.targetId`.
   - `death` → `enemies[archetypeId].death` / `bosses[archetypeId].death`. Для `entityKind === 'player'` на 008 маппинга нет — пропускается (нет файла).
   - `dropPickup` → `events.dropPickup`.
   - `bossPhaseChange` → `bosses[bossArchetypeId].phaseChange`.
   - Остальные kinds (`dropSpawn`/`dropExpire`/`encounterStart`/`encounterEnd`/`pause`/`resume`/`win`/`loss`/`sessionStart`/`sessionStop`) на 008 не озвучиваются. Их подключение — расширение этого файла.
2. **Snapshot pair** (вызов из `UiShell.onFrame`):
   - Music selector принимает решение о текущем треке по `phase` и `snapshot.encounter.type` (см. ниже).
   - Ambient слайм-голоса проходят по `snapshot.entities[kind === 'enemy']` и реагируют на per-archetype voice-таймеры (см. ниже).
3. **UI phase** (явный вызов из `UiShell` при изменении фазы):
   - `menu → running` → no-op (UI-звук уже сыграл на клик кнопки).
   - `running → paused` → проиграть `events.uiOverlayShow`.
   - `paused → running` → no-op.
   - `running → result(*)` → проиграть `events.uiOverlayShow`.
   - `* → menu` (явный exit) → no-op.

`Audio` ничего не отправляет в `SimWorkerHost`, не мутирует его и не подписывается на `onEvent` напрямую. Любая интеграция идёт через `UiShell`.

### Ambient слайм-голоса (без runtime event)

В симе нет события «слайм пошевелился», и вводить его специально под аудио в [snapshot-shape.md](snapshot-shape.md) — нарушение правила «runtime events — edge-факты». Слайм-ambient реализуется на стороне `Audio` без расширения контракта sim:

- На каждом `update(snapshotPair, ...)` `Audio` смотрит `snapshot.entities[kind === 'enemy']`.
- На каждый живой enemy ведётся per-entity таймер `nextVoiceAtMs`. По истечении выбирается случайный `sampleId` из `enemies[archetypeId].voice` (если задан), воспроизводится один-шот, таймер выставляется на `nextVoiceAtMs = now + randomBetween(intervalMinMs, intervalMaxMs)`. Параметры `intervalMinMs`/`intervalMaxMs` живут в `enemies[archetypeId].voice` рядом с sampleId.
- Удалённые между снапшотами enemies теряют свой таймер. Появившиеся — получают первый `nextVoiceAtMs = now + randomBetween(...)` (без мгновенного «всплеска» при волне).
- `defaultGain` voice-сэмплов специально занижен (см. выше).
- Источник случайности — `Math.random()` в main, **не** session RNG: ambient никак не должен влиять на authoritative state и допускает расхождение между двумя одинаковыми по `seed` забегами ([rng.md](rng.md)). Это явный исключённый случай.

### Music selector

- Источник обычного трека — **session-level поле** `SessionDefinition.musicSampleId` ([session-definition.md](session-definition.md)). Отдельного `regularPool`, которым владеет `Audio`, нет: история 021 убрала hard-coded пул в коде — выбор принадлежит геймдизайнеру в `content/sessions/*.md`.
- `bossTrack: sampleId` остаётся фиксированным — `boss/boss-music.mp3`. Per-boss custom music и per-wave music — out of scope этого решения.
- Правила выбора (определяют, что **должно** играть в данный момент):
  - `phase ∈ { menu, loading, result, error('preload') }` → music silent, независимо от `musicSampleId`.
  - `phase ∈ { running, paused }` и активный `snapshot.encounter` отсутствует или `encounter.type !== 'boss'` → играет `attachedSession.musicSampleId`. Если `musicSampleId === null`, regular music silent (legitimate конфигурация — sandbox/dev-режимы).
  - `phase ∈ { running, paused }` и `encounter.type === 'boss'` → играет `bossTrack`. При выходе из boss encounter регулярная музыка возвращается к `attachedSession.musicSampleId`.
  - В фазе `paused` музыка **ducked**: `musicBus` временно умножается на `0.5`. Music **не** останавливается и track не меняется. Это упрощает Web Audio (не нужен корректный pause/resume `AudioBufferSourceNode`) и даёт мягкий UX в паузе.
- `musicSampleId` на время активной сессии immutable (как и вся `SessionDefinition`). Новый session → новый `attach(session)` → music selector пересматривает выбор.
- Сам выбранный track не «ротируется»: один session — один обычный трек. Ротация между треками внутри одного забега была артефактом старого `regularPool` и устранена вместе с ним. Если в будущем потребуется per-encounter music, это расширение этого файла и `session-definition.md`, а не возврат к пулу в `Audio`.
- Конкретный способ смены track при переходе `running ↔ boss` (резкая смена / crossfade) — деталь реализации, контракт фиксирует только «что играет» и «когда».

### UI-звуки

- `events.uiOverlayShow` (например, `ui/open-1.mp3`) — на показе `PauseOverlay` и `ResultOverlay`. Один-шот при переходе фазы.
- `events.uiButtonClick` (например, рандомный из `ui/switch-1`, `ui/switch-3`, `ui/switch-4`) — на клик любой кнопки `MenuOverlay`, `PauseOverlay`, `ResultOverlay`, кроме переключения сложности. Привязка идёт через явный вызов `Audio.playUi('buttonClick')` из этих компонентов; компоненты не касаются `AudioContext` напрямую и не знают о `sampleId`.
- `events.uiButtonHover` (например, `ui/open-1.mp3`) — на hover/focus-like feedback кнопок меню. Привязка идёт через явный вызов `Audio.playUi('buttonHover')` из `UiShell`; `MenuOverlay` только сообщает о hover-событии кнопки и не знает о `sampleId`.
- `events.uiModeSwitch` (`ui/switch-2.mp3`) — только на фактическое переключение выбранного режима/сложности в `MenuOverlay`; повторный выбор уже активного режима не проигрывает звук.
- UI-звуки относятся к категории `ui` и проходят через `uiBus`, что позволит 009 регулировать их отдельно от sfx/music.

### Pause семантика

- Симуляция в `paused` не публикует события (см. [runtime-systems.md](runtime-systems.md), [thread-model.md](thread-model.md)) — новых SFX/boss/drop звуков сами по себе не возникает.
- Уже играющие one-shot источники доигрываются. Принудительно глушить их `Audio` не должен — это создавало бы рывки звука на коротких паузах.
- Music — duck (см. выше).
- Ambient слайм-голоса в `paused` **приостанавливаются**: `Audio` пропускает свою snapshot-driven фазу, пока `phase === 'paused'`, и не продвигает per-entity voice-таймеры. На `paused → running` таймеры продолжаются с прежнего значения; для упрощения допускается смещение базы wall-clock на длительность паузы — конкретика — деталь реализации.

### Жизненный цикл и API

- `UiShell` создаёт ровно один экземпляр `Audio` в `createUiShell` (рядом с `Hud`, `SimWorkerHost`).
- Минимальный API:
  ```ts
  type Audio = Readonly<{
    unlock(): void;
    handleEvent(event: RuntimeEvent): void;
    update(snapshotPair: SnapshotPair, phase: UiShellPhase, encounter: EncounterSnapshot | null): void;
    attach(session: SessionDefinition): void;
    detach(): void;
    playUi(eventId: 'overlayShow' | 'buttonClick' | 'buttonHover' | 'modeSwitch'): void;
    setMasterGain(value: number): void;
    dispose(): void;
  }>;
  ```
- `attach(session)` нужен для доступа к immutable данным сессии (например, `bossArchetypeId` активного encounter), без подписки на снапшоты в фазе `menu`.
- `UiShell` обязан:
  - вызвать `audio.unlock()` на первом user-gesture (один раз);
  - фан-аутить `SimWorkerHost.onEvent` в `audio.handleEvent` так же, как сейчас в `handleSimEvent`;
  - вызывать `audio.update(snapshotPair, phase, encounter)` ровно один раз за кадр в `onFrame`, после `hud.update`;
  - вызывать `audio.attach(session)` на старте сессии и `audio.detach()` на её завершении/выходе в меню (как сейчас для `hud`);
  - вызывать `audio.playUi('overlayShow')` на показе pause/result-overlay-ев, пробрасывать `audio.playUi('buttonClick')` в обработчики кликов overlay-ев, `audio.playUi('buttonHover')` в menu hover-feedback и `audio.playUi('modeSwitch')` при фактической смене режима.
- `Audio` ни при каких условиях не использует `SimWorkerHost.onEvent` напрямую и не разводит собственного listener-а на `pointerdown`/`keydown` — это гарантия инварианта «один owner оркестрации» из [main-ui-shell.md](main-ui-shell.md).

### Бюджеты и инварианты

- Одновременно активных one-shot источников ≤ **32**. При превышении — drop oldest (остановить самый старый источник). Этого с запасом хватит на ожидаемое число врагов и снарядов MVP, при этом исключает неограниченный рост узлов графа на спавн-всплесках.
- Реестр сэмплов и маппинги валидируются один раз на инициализации `Audio`:
  - дублирующиеся `sampleId` в реестре — ошибка модуля;
  - `sampleId` в маппинге без записи в реестре — ошибка модуля;
  - `normalizedGain ∈ (0, 2]`, `defaultGain ∈ [0, 2]`, иначе warning через единый log-модуль и значение **clamped** в допустимый диапазон;
  - любой entry с `category: 'music'` и `loop !== true` — ошибка модуля; это поддерживает контракт «один трек на всю сессию» (см. «Двухслойная громкость»);
  - URL не валидируется online — отсутствие файла фиксируется как warning в момент первой попытки воспроизведения.
- `attach(session)` дополнительно валидирует `session.musicSampleId`:
  - `null` — ок, regular music silent весь забег;
  - строка, которой нет в `SampleRegistry` — ошибка модуля (не warning): неизвестный id должен быть пойман content-build и builder-ом до старта сессии (см. [content-authoring.md](content-authoring.md), раздел `# Session`);
  - строка с `SampleRegistry[*].category !== 'music'` — ошибка модуля: session music обязана быть music-категории, чтобы попадать в `musicBus` и получать корректный ducking в паузе.
- `Audio` не должен иметь скрытого глобального state: все таймеры и решения хранятся в инстансе, создаваемом `UiShell`. Один экземпляр на жизнь приложения; повторная инициализация не предусмотрена в MVP.

### Тесты

- `Audio` тестируется без реального `AudioContext`: вводится узкий `AudioApi` (создание `GainNode`/`AudioBufferSource`, `decodeAudioData`, `currentTime`), который в тестах подменяется fake-реализацией. Это уже устоявшийся паттерн в `src/main/ui/**` (см. `UiShell.test.ts`).
- Под тестом обязательно:
  - расчёт effective gain для типового сэмпла (умножение всех слоёв);
  - валидация реестра (дубль `id`, неизвестный `sampleId` в маппинге, clamp `normalizedGain`/`defaultGain`);
  - роутинг runtime events в правильный sampleId (в т. ч. fallback «маппинга нет → пропуск + один warning»);
  - переключение music selector при смене `phase` и `encounter.type` (включая ducking в `paused`);
  - ambient slime voice не дёргает таймеры в `paused` и переинициализируется на новых entity.
- Регрессий [snapshot-shape.md](snapshot-shape.md) и [main-ui-shell.md](main-ui-shell.md) тестами не вводится: `Audio` стоит «ниже» этих контрактов.

### Settings integration (009)

- 009 управляет громкостью **только** через master gain. На горизонт 009 это единственная игровая ось громкости; per-bus громкость (отдельно `sfx`/`music`/`ui`) явно out of scope ([../stories/009-settings.md](../stories/009-settings.md)).
- `Audio.setMasterGain(value)`:
  - принимает число; clamp в `[0, 1]` перед применением, значение вне диапазона дополнительно логируется warning через единый log-модуль ([logging.md](logging.md));
  - присваивает `runtime.masterGain.gain.value` — это единственная legitimate точка изменения master gain снаружи модуля;
  - идемпотентен: повторный вызов с уже установленным значением выполняет присвоение, но не имеет наблюдаемого эффекта (Web Audio: `gain.value = same` — no-op);
  - корректен в любом состоянии: до `unlock()`, в `menu`, во время `running`/`paused`/`result`, до и после `attach`/`detach`. Он не зависит ни от активной сессии, ни от состояния `AudioContext`.
- `setMasterGain` **никогда** не пишет в persistent storage и не подписывается на `ClientSettingsStore`. Поток обратный: `UiShell` подписывает `Audio` на изменение `masterVolume` в [client-settings.md](client-settings.md) и вызывает `audio.setMasterGain(settings.masterVolume)` на каждое изменение и один раз при инициализации.
- Прямой доступ к `runtime.masterGain` или к `runtime.busGains[*]` извне модуля — запрещён. Любая будущая ось (per-bus volume, ducking из gameplay-эффектов и т. п.) добавляется как отдельный явный API на `Audio`, не как утечка `GainNode`-ов наружу.

### Расширение

- Добавление нового sample → запись в реестр + (при необходимости) запись в один из маппингов. Без правки этого файла.
- Добавление нового маппингового канала (например, `enemies[archetypeId].spawn` под звук появления) → расширение этого файла отдельным разделом плюс правила воспроизведения. По месту в коде систем — запрещено.
- Добавление нового bus (например, `voice` или `ambience`) → правка раздела «Mixer graph» этого файла плюс синхронное обновление 009 (settings).
- Если в будущем потребуется реактивный sample на runtime event, которого ещё нет (`pickup`-эффект, муз. stinger на `bossPhaseChange`), новый event сначала фиксируется в [snapshot-shape.md](snapshot-shape.md), и только потом — маппинг здесь.

## Consequences

- 008 и 009 опираются на единый граф микса и единую точку правды для громкости; «магические числа» громкости концентрируются в одном реестре.
- Поправки громкости файлов и gameplay-громкость становятся независимыми осями: замена файла не размывает игровой баланс, а изменение баланса не требует трогать поправки на файлы.
- `EnemyArchetype`/`WeaponArchetype`/`BossArchetype` в `src/shared/content/**` остаются «чистыми» от презентационных полей; новые враги/боссы добавляются без правки контрактов content library.
- Симуляция не получает дополнительных событий ради аудио: ambient слаймов сделан полностью на стороне main по снапшоту.
- `UiShell` остаётся единственным оркестратором; маршрутизация unlock/события/фазы централизована.
- Для 009 (settings) появляется готовая площадка: master/per-bus gain — это уже узлы графа, остаётся только слой `client settings`, который их крутит и сохраняет.
- Цена: маппинг архетип → sample должен поддерживаться при добавлении новых архетипов; решение явно делает это «warning, а не ошибка», чтобы не тормозить gameplay-истории.

## Related

- [thread-model.md](thread-model.md)
- [main-ui-shell.md](main-ui-shell.md)
- [snapshot-shape.md](snapshot-shape.md)
- [runtime-systems.md](runtime-systems.md)
- [content-boundaries.md](content-boundaries.md)
- [content-archetypes.md](content-archetypes.md)
- [session-definition.md](session-definition.md)
- [client-settings.md](client-settings.md)
- [web-stack.md](web-stack.md)
- [rng.md](rng.md)
- [logging.md](logging.md)
- [testing.md](testing.md)
- [../docs/VISION.md](../docs/VISION.md)
- [../stories/008-audio-baseline.md](../stories/008-audio-baseline.md)
- [../stories/009-settings.md](../stories/009-settings.md)
- [content-authoring.md](content-authoring.md)
