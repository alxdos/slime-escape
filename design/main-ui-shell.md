# Main UI Shell

- Status: accepted
- Created: 2026-04-20
- Updated: 2026-04-26 (story 025: появляется отдельный UI-слой `Путь Побега` для compact/break progress path; его фазовая видимость, z-order и result integration зафиксированы в [escape-progress-path.md](escape-progress-path.md). Earlier story 024: Result UI consumes authoritative `SessionResultSummary` from terminal `win`/`loss` events and renders stats/effects without talking to sim; see [session-result-summary.md](session-result-summary.md). Earlier story 023: startup/menu presentation, post-load ritual, first-menu UI asset preload and phase transition curtain are split into [menu-and-startup-presentation.md](menu-and-startup-presentation.md); this file keeps phase ownership and visibility. Earlier story 022: детальный боевой HUD вынесен в [hud-presentation.md](hud-presentation.md); здесь остаются только фазовая видимость, пассивность HUD и `UiShell` ownership. Earlier story 021: появляется отдельный UI-слой «wave/break title overlay» — видимость по фазам, z-order, источники данных и глобальная нумерация волн фиксируются в [encounter-presentation.md](encounter-presentation.md). Earlier: 2026-04-24 017 terminology cleanup: session authoring references ordered `loadoutWeaponIds` instead of legacy singular `loadoutWeaponId`. story 016: `UiShell` fans simulation runtime events out to `Renderer.handleEvent` while keeping `UiShell` as the only `SimWorkerHost.onEvent` owner; see [impact-feedback.md](impact-feedback.md). Ранее: story 015 follow-up: `Renderer` получает immutable `SessionDefinition` при создании, читает `session.backgrounds` + `encounters[].backgroundId` и переключает фон арены по `snapshot.encounter.id`; snapshot не расширяется, потому что активный encounter уже присутствует. story 015: playable preset catalog становится derived view над `SESSION_PRESET_TEMPLATES` из `content library`; метаданные пресета (`displayName`/`description`/`visibleInMenu`/`order`) живут в партиции `# Session` каждого `content/sessions/<presetId>.md`, рядом с самим описанием пресета (см. [content-authoring.md](content-authoring.md), раздел «Multi-file области»); отдельный `playableModes.ts` исчезает; форма `PlayableModeEntry` сворачивается в derived view, без отдельного реестра. Story 013: для истории 013 добавлены стартовая фаза `loading` и финальная фаза `error('preload')`: видимый splash + sprite preload до меню, hard-error при провале загрузки, недоступность Renderer/InputController/Settings/SimWorkerHost в этих фазах.)

## Context

[thread-model.md](thread-model.md) фиксирует, что HUD, меню и любой DOM/UI живут в `main thread`, а `simulation worker` — единственный источник authoritative state и runtime events. [snapshot-shape.md](snapshot-shape.md) и [runtime-systems.md](runtime-systems.md) задают, **что** main получает из sim: периодические снапшоты с per-kind полями, top-level `encounter`/`zone`/`waveProgress`/`bossHud` и lifecycle/`win`/`loss` events. [session-definition.md](session-definition.md) фиксирует, что main владеет immutable `SessionDefinition` сразу после `startSession` и обязан собирать её из `ModePreset` через builder в `src/shared/content/**` ([content-boundaries.md](content-boundaries.md), [web-stack.md](web-stack.md)). [input-commands.md](input-commands.md) задаёт UX паузы (Esc, overlay, Pointer Lock).

В 001 main был «один canvas + dev-пауза». В 002–006 рядом появились `MenuOverlay`, `PauseOverlay`, `Renderer`, `InputController`, `SimWorkerHost`, и оркестрация фаз («показано меню», «идёт сессия», «пауза», «итог») фактически жила в `src/main/index.ts` через флаг `activeSession` и расставленные по месту `pause.show()`/`menu.setResult()`. История 007 одновременно вводит:

- настоящий выбор режима в меню;
- HUD с HP/таймером/волной/боссом;
- pause UX из UI и хоткея;
- экран результата с возвратом в меню.

Без явного контракта 007 закрепит расхождения по двум осям:

- **оркестрация фаз UI**: где живут переходы `menu ↔ running ↔ paused ↔ result`, кто владеет видимостью overlay-ев, как HUD сосуществует с pause overlay;
- **источник данных HUD**: что HUD читает из снапшотов и `SessionDefinition`, что — из runtime events, как считается «номер волны» и что является owner-ом «активного encounter» с точки зрения презентации.

008 (audio), 009 (settings) и 010 (render backend) опираются на ту же оркестрацию: audio attaches к UI-фазам и runtime events; settings UI открывается из меню; render backend инициализируется и пересоздаётся в рамках фазы `running`. Поэтому контракт фиксируется здесь, а не «по месту» в 007.

## Decision

### Размещение в репозитории

- Весь UI-шелл и HUD живут под `src/main/ui/**` (см. [web-stack.md](web-stack.md)). Новых корневых каталогов под презентацию не вводится.
- Каталог выбираемых игроком режимов — данные content library, лежит в `src/shared/content/**` (см. ниже «Playable preset catalog»).
- Никакой UI-модуль не имеет права импортировать из `src/sim/**`. Контакт с симуляцией — только через уже зафиксированный API `SimWorkerHost` (`src/main/sim/SimWorkerHost.ts`): `startSession` / `stopSession` / `pause` / `resume` / `sendInput` / `snapshotPair()` / `isPaused()` / подписка `onEvent`. Прямые `postMessage`/`new Worker` из UI запрещены.

### UI shell как явный оркестратор фаз

- Вводится единый компонент `UiShell` в `src/main/ui/**` (фактическое имя файла — деталь реализации). Он — единственный owner презентационной фазы приложения.
- Презентационная фаза — конечный автомат с состояниями:
  - `loading` — **стартовое** состояние приложения. До перехода в `menu` идёт обязательный startup preload (см. [sprite-assets.md](sprite-assets.md), раздел «Preload contract»). Никакая сессия не активна, `Renderer`/`InputController` не созданы, симуляция не тикает.
  - `menu` — стартовый экран и экран «между забегами»; ни одна сессия не активна (`SimWorkerHost.startSession` ещё не вызывался либо сессия уже корректно завершена);
  - `running` — активная сессия, симуляция тикает, рендер и HUD показаны;
  - `paused` — активная сессия, симуляция стоит (`SimWorkerHost.pause` вызван), HUD и сцена остаются видны и заморожены, поверх показан `PauseOverlay`;
  - `result(win | loss)` — последняя сессия завершилась автоматически (`win`/`loss` event) и ещё не сброшена пользователем; на экране отображается итог и единственное действие «в меню»;
  - `error('preload')` — **финальное** состояние, в которое попадаем, если хотя бы один обязательный ассет не загрузился во время `loading`. На экране — `StartupErrorOverlay` с явным сообщением и единственным действием «перезагрузить страницу». Ни одна другая фаза из `error('preload')` не достижима.
- Допустимые переходы (любой другой переход — баг оркестрации, не «свобода UX»):
  - `loading → menu` после успешного завершения startup preload;
  - `loading → error('preload')` при ошибке загрузки/декодирования хотя бы одного обязательного ассета;
  - `menu → running` через явное действие игрока (выбор режима);
  - `running ↔ paused` через `Esc`/`Space`/потерю Pointer Lock/кнопки overlay-ев и через `KeyP` dev-хоткей (см. ниже);
  - `running → result(win|loss)` через `win`/`loss` event из sim;
  - `running → menu` через явный exit из паузы (кнопка «Выйти в меню»);
  - `paused → menu` через тот же exit (без промежуточного `running`);
  - `result → menu` через единственное действие «В меню»;
  - `result → running` напрямую запрещён: новый забег стартует только из `menu`.
- Из `error('preload')` нет санкционированных переходов; единственный способ покинуть это состояние — `location.reload()`. Это исключает «частично-загруженный» режим, в котором renderer падает на missing texture в середине боя.
- Переходы из `running`/`paused` в `menu` всегда явно вызывают `SimWorkerHost.stopSession()`. Переход `running → result` — наоборот, **не** вызывает `stopSession()`: симуляция уже сама выполнила teardown по контракту [session-definition.md](session-definition.md). Это исключает «no active session» warning и двойной сброс runtime state.
- Один экземпляр `simulation worker` живёт всю жизнь приложения и переиспользуется между сессиями ([thread-model.md](thread-model.md)). `UiShell` не пересоздаёт worker при переходах между фазами.
- Переход в любую фазу делает явный show/hide для всех overlay-ев и HUD по таблице ниже. Никакой компонент не имеет права самостоятельно показывать/скрывать себя «по событию мимо UiShell».

### Видимость overlay-ев и HUD по фазам

| Фаза | Startup overlay | Menu overlay | HUD | Escape progress path | Title overlay | Pause overlay | Result UI | Startup error | Pointer Lock |
|------|-----------------|--------------|-----|----------------------|---------------|---------------|-----------|---------------|--------------|
| `loading` | visible | hidden | hidden | hidden | hidden | hidden | hidden | hidden | released |
| `menu` | hidden | visible | hidden | hidden | hidden | hidden | hidden | hidden | released |
| `running` | hidden | hidden | visible (live) | visible (см. [escape-progress-path.md](escape-progress-path.md)) | visible (см. [encounter-presentation.md](encounter-presentation.md)) | hidden | hidden | hidden | requested |
| `paused` | hidden | hidden | visible (frozen на последнем снапшоте) | visible (frozen) | visible (frozen) | visible | hidden | hidden | released |
| `result(win|loss)` | hidden | hidden | hidden | hidden (static path внутри Result UI) | hidden | hidden | visible | hidden | released |
| `error('preload')` | hidden | hidden | hidden | hidden | hidden | hidden | hidden | visible | released |

- `Startup overlay` в фазе `loading` показывает preload и post-load presentation ritual по [menu-and-startup-presentation.md](menu-and-startup-presentation.md). Никакого «между загрузкой» меню или HUD не показано: игрок видит либо splash, либо menu, либо явный startup error.
- `Startup error` в фазе `error('preload')` — отдельный overlay поверх пустого фона, с человекочитаемым описанием первой провалившейся загрузки и единственной кнопкой «Перезагрузить страницу» (вызывает `location.reload()`).
- HUD остаётся видимым в `paused` намеренно: игрок должен видеть текущие значения HP/таймера/волны/босса, на которых он поставил паузу. Pause overlay рисуется над ним.
- Result UI скрывает HUD: цифры забега, на котором всё закончилось, не должны конкурировать с финальным итогом. Если позже потребуется «итоговая сводка» — это расширение Result UI, не возвращение HUD.

### Стек слоёв (z-order)

- Слои сверху вниз: Startup error > Phase transition curtain > Startup overlay > Result UI > Settings overlay > Pause overlay > Menu overlay > Title overlay > Escape progress path > HUD > canvas. Конкретные числовые `z-index` — деталь реализации; контракт — порядок и непересекающаяся видимость одновременных слоёв (по таблице фаз одновременно показано не более одного modal-overlay-я плюс Title overlay, Escape progress path и HUD; в `loading` и `error('preload')` HUD, Title overlay и Escape progress path отсутствуют). Phase transition curtain принадлежит `UiShell` и описан в [menu-and-startup-presentation.md](menu-and-startup-presentation.md). Title overlay — отдельный презентационный слой из [encounter-presentation.md](encounter-presentation.md), рисуется поверх HUD/Escape progress path и под любым modal-overlay; его видимость внутри `running`/`paused` дополнительно обусловлена активным encounter (intro для wave, `text !== null` для break), а не только фазой `UiShell`. Escape progress path — отдельный слой из [escape-progress-path.md](escape-progress-path.md): live/break вариант рисуется выше HUD и ниже Title overlay, а result-вариант встраивается внутрь Result UI.
- HUD и overlay-и позиционированы относительно viewport (`position: fixed`), а не относительно canvas. Letterbox/pillarbox-полосы из [arena-and-coordinates.md](arena-and-coordinates.md) при этом не «прячут» HUD — он рисуется поверх любых пустых полос. Это даёт стабильное место HUD при нестандартных aspect ratio.

### HUD как пассивный потребитель

- HUD — компонент `src/main/ui/**`, не оркестратор. Он не знает о фазах `UiShell` за пределами того, что ему сказали `attach(session)` / `update(snapshotPair)` / `detach()`.
- Источники данных HUD:
  1. **`SessionDefinition`**, переданный при `attach`: `arena`, `player.maxHp`, `encounters` (для подсчёта «волн всего» и «номер активной волны»), `winCondition`/`lossCondition` (для решения, рендерить ли HP-блок и боссовый блок). `SessionDefinition` immutable на время сессии ([session-definition.md](session-definition.md)).
  2. **`SnapshotPair`** ([../src/main/sim/SimWorkerHost.ts](../src/main/sim/SimWorkerHost.ts)) — авторитетный per-frame источник `hp`/`maxHp` игрока, `encounter`, `waveProgress`, `bossHud`. HUD использует `curr` снапшот для текстовых полей; интерполяция между `prev`/`curr` — для рендера, не для HUD.
- HUD **не подписывается** на runtime events напрямую и не делает по ним authoritative-обновлений. Это правило уже зафиксировано в [snapshot-shape.md](snapshot-shape.md) («HUD не должен восстанавливать authoritative state только из combat-events») и [thread-model.md](thread-model.md) («HUD и аудио опираются на снапшоты, события — триггеры реакции»). Если в будущем HUD захочет короткую анимацию по событию (вспышка при `bossPhaseChange`), это разрешается отдельным контрактом и каналом подписки через `UiShell`, а не прямой утечкой `SimWorkerHost.onEvent` в HUD.
- HUD никогда не отправляет команды в `sim` и не мутирует `SimWorkerHost`. Все взаимодействия с симуляцией оркеструет `UiShell`.
- HUD обновляется в общем main rAF-цикле (тот же, что вызывает `Renderer.render()`): ровно один `update(snapshotPair)` за кадр. Отдельный таймер для HUD не вводится.
- В фазе `paused` `UiShell` перестаёт вызывать `update`, и HUD остаётся «как был». Это сохраняет инвариант «HUD заморожен», не требуя от HUD знать про паузу.
- Конкретная player-facing компоновка HUD после истории 022 (run timer, compact HP, boss strip, control hints, weapon slots, cooldown fill, upgrade badges) живёт в [hud-presentation.md](hud-presentation.md). Этот файл не дублирует layout-решения, чтобы `main-ui-shell.md` оставался контрактом оркестрации фаз.

### HUD data derivation

- Если HUD показывает номер волны или общее число волн, эти числа **не** добавляются в snapshot. Они вычисляются на стороне HUD из:
  - `SessionDefinition.encounters` — фильтрация по `type === 'wave'`, индексация в порядке списка (глобальная нумерация по всей сессии);
  - `snapshot.encounter.id` или `snapshot.encounter.index` — поиск активного encounter в этом списке.
- Это сохраняет принцип «снапшот несёт только меняющееся state, конфигурация уже у main» из [thread-model.md](thread-model.md) и не требует расширения [snapshot-shape.md](snapshot-shape.md).
- HUD-нумерация остаётся **глобальной** сознательно. Отдельный «wave title overlay» ([encounter-presentation.md](encounter-presentation.md)) использует тот же глобальный порядок wave encounter-ов, чтобы титр, HUD и Result UI не расходились в номере волны.
- Run timer для нового combat HUD = `snapshot.simTimeMs`, а не `snapshot.encounter.elapsedMs`; он показывает длительность текущего run и не сбрасывается между encounter-ами. Никаких параллельных wall-clock-таймеров на стороне HUD — это исключает рассинхрон с `pause`/`resume` ([simulation-timing.md](simulation-timing.md): `simTime` не догоняет wall-clock после resume).
- Если будущий HUD снова показывает прогресс волны (`dispatched`/`total`/`alive`), он читает его из `snapshot.waveProgress` и не реконструирует сам; для не-wave encounter поле `null`.
- HP игрока HUD читает из единственного `PlayerSnapshot` в `snapshot.entities` (поле `hp`/`maxHp` из [snapshot-shape.md](snapshot-shape.md)). Если `lossCondition.kind === 'none'`, HUD всё равно рендерит HP-блок: значения корректны (`hp = maxHp` весь run по контракту), и UX не должен «прыгать» между preset-ами с боем и без.
- Боссовый блок HUD читает из `snapshot.bossHud`. При `null` блок скрывается; имя фазы для отображения берётся из `BossArchetype` ([content-archetypes.md](content-archetypes.md)) по `bossArchetypeId` активного босса (HUD получает архетип через `SessionDefinition` + резолв либо через `snapshot.entities` сущности `kind: 'boss'`, у которой есть `archetypeId`). Конкретный путь резолва — деталь реализации; контракт — «боссовый блок виден ровно когда `bossHud !== null`».

### Меню и playable preset catalog

- Меню — data-driven: оно отображает список сущностей «выбираемый игроком режим» и для каждого вызывает builder сессии. Меню не знает о конкретных preset-id и не содержит «if/switch по id» для рендера.
- Источник правды о метаданных пресета (`displayName`, `description`, `visibleInMenu`, `order`) — партиция `# Session` каждого `content/sessions/<presetId>.md`, см. [content-authoring.md](content-authoring.md), раздел «Multi-file области». Эти поля хранятся рядом с самим описанием пресета (списком encounter'ов, `arenaId`/`playerId`/`loadoutWeaponIds` и т. п.), а не в отдельном UI-реестре. Отдельный файл `playableModes.ts` с собственным `PlayableModeEntry`-реестром — нет; он исчезает после миграции области `sessions` в MD-источник.
- Каталог собирается как **derived view** над генерируемым `SESSION_PRESET_TEMPLATES` (типизированным как `as const satisfies Record<presetId, SessionPresetTemplate>` из `content library`):
  ```ts
  // конкретное имя функции — деталь реализации
  function getPlayableModeCatalog(): ReadonlyArray<PlayableModeEntry> {
    return Object.values(SESSION_PRESET_TEMPLATES)
      .filter((preset) => preset.visibleInMenu)
      .sort((a, b) => a.order - b.order);
  }

  type PlayableModeEntry = Readonly<{
    presetId: keyof typeof SESSION_PRESET_TEMPLATES;
    displayName: string;
    description: string;
    order: number;
  }>;
  ```
  `PlayableModeEntry` остаётся типом презентации (что именно нужно меню), но его значения берутся из template-ов, а не дублируются в отдельном реестре. Это устраняет двойную точку правды «catalog vs preset».
- Валидация при сборке: каждый `presetId ∈ keyof SESSION_PRESET_TEMPLATES` обязан иметь поле `visibleInMenu: boolean` и `order: number` (правило «без двух разных нет данных» из [content-archetypes.md](content-archetypes.md): `order` обязателен даже для `visibleInMenu: false` пресетов). Неизвестный `presetId` в коде — `tsc`-ошибка, не runtime-фолбэк, благодаря derived `keyof typeof`.
- `ModePreset` остаётся минимальным authoritative объектом (`{ id }`); ему **не** добавляются поля `displayName`/`description`. Display-данные относятся к презентации и собираются как derived view над template-ами, а не «навешиваются» на authoritative preset. Это сохраняет правило «builder читает content library и опции, на выходе — `SessionDefinition`» ([content-boundaries.md](content-boundaries.md)).
- На момент этой ревизии каталог по `visibleInMenu: true` содержит `campaign` (основной забег с боссом) и `training` (короткий тренировочный без босса). Sandbox-варианты (`sandbox`, `sandbox-with-combat`) остаются доступными как preset-id, но имеют `visibleInMenu: false` и в меню не появляются: это bring-up для разработки, не player-facing режимы (см. [session-definition.md](session-definition.md), раздел про sandbox). Расширение каталога в будущем (например, новый пресет `training-hard`) — добавление файла `content/sessions/<id>.md` с `visibleInMenu: true`, не изменение этого решения и не правка кода UI.
- `BuildOptions` для меню минимальны: `seed` генерируется на стороне `UiShell` при выборе режима, никакие пользовательские опции (loadout, modifiers, кастомизация encounter) в этой истории не вводятся (Out of scope в [../stories/007-hud-and-menu.md](../stories/007-hud-and-menu.md)). Расширение `BuildOptions` — будущее решение в [session-definition.md](session-definition.md), не «по месту» в меню.

### Pause UX

- UX паузы уже зафиксирован в [input-commands.md](input-commands.md) (`Esc`/`Space` открывают overlay, `KeyP` остаётся dev-паузой без overlay, кнопка «Выйти в меню» вызывает `stopSession`, Pointer Lock корректно ходит между состояниями).
- `UiShell` — единственное место, которое реально вызывает `SimWorkerHost.pause()`/`.resume()`. Хоткеи `Esc`/`Space`/`KeyP` и кнопки overlay-ев маршрутизируются через `UiShell`; прямые вызовы `pause/resume` из обработчиков событий вне `UiShell` запрещены. Это исключает «двойную паузу» и рассинхрон между `paused`-фазой UI и `isPaused()` симуляции.
- HUD остаётся видим и заморожен: `UiShell` пропускает вызов `Hud.update()` пока находится в `paused`. Pause overlay рисуется выше HUD по z-order.
- Кнопка «Выйти в меню» в `paused` инициирует переход `paused → menu`: `UiShell` вызывает `SimWorkerHost.stopSession()` и снимает HUD. Никаких promtов «вы уверены?» в 007 не вводится; экран результата сюда не подменяется (`stopSession` — не «поражение»).

### Result UX

- При получении `win`/`loss` от sim `UiShell` переходит в `result(win|loss)`. Это единственный санкционированный триггер `result`-фазы.
- Result UI — отдельный компонент в `src/main/ui/**` (фактическое имя — деталь реализации; намеренно не «пристёгнут» к `MenuOverlay`, чтобы overlay меню не нёс двойную ответственность за стартовый экран и за итог забега).
- После story 024 terminal `win`/`loss` event обязан нести `SessionResultSummary` ([session-result-summary.md](session-result-summary.md)). `UiShell` хранит эту summary как часть result-фазы и передаёт её в Result UI. Result UI не восстанавливает статистику из цепочки `death`/`dropPickup` events и не читает `SnapshotPair` после завершения run.
- Presentation-слой результата может строить `ResultViewModel` из `SessionDefinition`, `SessionResultSummary`, shared content registries и visual registries. Это main-thread derive: Result UI не импортирует `src/sim/**` и не обращается к `SimWorkerHost`.
- Победные/проигрышные эффекты результата — DOM/CSS presentation-only внутри Result UI. Gameplay `Renderer` в фазе `result` по-прежнему уничтожен, поэтому салют/слизистые капли не являются arena-renderer эффектами и не требуют snapshot-полей.
- В фазе `result` доступно ровно одно действие: «В меню» (переход `result → menu`). Никаких «retry», «stats», «share» в 007 не вводится. Они — расширения Result UI и будущих историй.
- При переходе `result → menu` `UiShell` сбрасывает внутреннее состояние «последний результат» и показывает чистый стартовый экран. История последних результатов не сохраняется (`client settings` под это место не используются — см. [content-boundaries.md](content-boundaries.md)).

### Settings overlay

- Settings overlay — компонент `src/main/ui/**` (фактическое имя — деталь реализации). Он **не** становится отдельной фазой `UiShell` и **не** имеет права манипулировать `SimWorkerHost.pause/resume`, `startSession`/`stopSession` или видимостью HUD/Pause/Result/Menu overlay-ев. Это чистый sub-modal поверх текущей фазы.
- Доступен ровно из двух мест:
  1. Из `MenuOverlay` (фаза `menu`) — кнопкой «Настройки» рядом с выбором режима;
  2. Из `PauseOverlay` (фаза `paused`) — кнопкой «Настройки» рядом с «Продолжить»/«Выйти в меню».
  В фазах `running`, `result`, `loading` и `error('preload')` settings overlay недоступен. В `running` для открытия настроек игрок сначала входит в паузу штатным способом ([input-commands.md](input-commands.md)); это удерживает правило «overlay-и не появляются поверх живой сцены без явного pause». В `loading` нет ни Renderer-а, чтобы применять `renderScalePreset`, ни sample-плейбэка, чтобы услышать `masterVolume`; в `error('preload')` единственное санкционированное действие — reload страницы.
- Открытие/закрытие settings overlay — единственный orchestration-эффект: `UiShell` показывает/прячет соответствующий компонент. Никаких побочных переходов между фазами `menu`/`paused`/`running`/`result` это не вызывает: открыли в `paused` — после закрытия остаёмся в `paused` с тем же `Pause overlay` под спудом; открыли в `menu` — возвращаемся в `menu` к выбору режима.
- Параллельно с settings overlay не показывается **никакой** другой overlay поверх него. Z-order: Settings overlay выше Pause/Menu overlay-ев, ниже Result UI (Result UI и Settings overlay не сосуществуют по построению — settings недоступен в `result`). Конкретные `z-index` — деталь реализации.
- Pointer Lock в фазе `paused` уже снят браузером ([input-commands.md](input-commands.md)); открытие/закрытие settings overlay в `paused` его статус не меняет. В фазе `menu` Pointer Lock не запрашивается, и settings overlay тоже его не трогает.
- Источник правды о значениях, которые редактирует overlay — `ClientSettingsStore` ([client-settings.md](client-settings.md)). На каждое действие игрока (drag слайдера громкости, выбор пресета разрешения) overlay вызывает соответствующий `store.set*`; `UiShell` уже подписал на этот store `Audio` (для `masterVolume` через `audio.setMasterGain`, см. [audio.md](audio.md)) и `Renderer` (для `renderScalePreset` через `renderer.applyScalePolicy`, см. [render-scale.md](render-scale.md)). Таким образом изменения применяются «на лету» в той же фазе, без рестарта сессии и без специальной логики на стороне overlay-я.
- Settings overlay **не** имеет права обращаться к `SimWorkerHost`, `Audio`, `Renderer` напрямую. Это сохраняет инвариант «единственный owner оркестрации — `UiShell`» и держит overlay чистым presentation-компонентом.
- В фазе `menu` `Renderer` ещё не существует ([client-settings.md](client-settings.md), раздел «Применение настроек»); смена `renderScalePreset` в `menu` корректно: store сохраняет значение, ближайший новый `Renderer` его прочитает. Никаких «отложенных применений» вне store держать не нужно.
- Кнопки settings overlay (включая кнопки внутри overlay-я и точку входа из `MenuOverlay`/`PauseOverlay`) звучат через `audio.playUi('buttonClick')` тем же способом, что и остальные UI-кнопки ([audio.md](audio.md)). Открытие settings overlay само по себе **не** играет `events.uiOverlayShow` — этот звук закреплён за переходами в `paused` и `result(*)` ([audio.md](audio.md)) и не дублируется на каждом sub-modal.

### Жизненный цикл рендера и input в рамках фаз

- В фазах `loading` и `error('preload')` `Renderer` и `InputController` **не существуют**. Создание `THREE.WebGLRenderer` и подписка на input-события откладываются до первого `menu → running`. Это держит фазу `loading` максимально дешёвой и гарантирует, что preload не конкурирует за GPU/canvas ни с одной gameplay-системой.
- `Renderer` и `InputController` создаются `UiShell` при переходе `menu → running` и уничтожаются при переходе в `menu` (явный exit) или `result` (`win`/`loss`). Это сохраняет уже работающую модель `src/main/index.ts`, но переносит её в один owner.
- При создании `Renderer` `UiShell` передаёт тот же immutable `SessionDefinition`, который отдаётся в `SimWorkerHost.startSession()` и `Hud.attach()`. `Renderer` использует из него только presentation-конфиг: `backgrounds` и `encounters[].backgroundId`. Переключение фона идёт по `snapshot.encounter.id`; дополнительное поле в snapshot не вводится, потому что id активного encounter уже является authoritative runtime-state из [snapshot-shape.md](snapshot-shape.md), а mapping id→background принадлежит конфигурации сессии. Размер одной фоновой плитки в world-units выводится из фактических пикселей загруженного изображения через тот же `PX_PER_WU`, что и sprite-ассеты ([sprite-assets.md](sprite-assets.md)); renderer не растягивает картинку до размеров арены, а повторяет её как texture pattern по всей арене.
- Фон арены — presentation-only слой внутри render scene. Если у активного encounter нет background (`backgroundId: null`) или snapshot ещё не содержит encounter, renderer показывает нейтральный arena floor; неизвестные id должны быть отловлены на этапе `content:build`/builder, а не превращаться в runtime fallback.
- В фазе `paused` `Renderer` продолжает рендер каждый кадр (картинка не «замирает в моменте получения паузы», а отрисовывает последний интерполированный кадр), `InputController` остаётся подключён, но Pointer Lock снят браузером ([input-commands.md](input-commands.md)). HUD заморожен (см. выше).
- В фазе `result` `Renderer` и `InputController` уничтожаются: на экране только Result UI; canvas под ним может остаться пустым/чёрным. Это явно: после смерти игрока «арена сзади продолжает шевелиться» — нежелательный артефакт, и контракт его исключает.
- Смена render backend в 010 (main vs render worker через `OffscreenCanvas`) живёт внутри `Renderer` и не ломает фазовую модель `UiShell`.
- Runtime events из `SimWorkerHost.onEvent` остаются централизованы в `UiShell`. Для render-only impact feedback `UiShell` пробрасывает event в `renderer.handleEvent(event)`, если renderer существует, после audio routing и до shell-level transition handling. `Renderer` сам фильтрует интересующие его `kind` и не подписывается на `SimWorkerHost` напрямую. Полный контракт impact event fan-out — [impact-feedback.md](impact-feedback.md).

### Startup preload в фазе `loading`

- `UiShell` стартует с фазы `loading` и **до** перехода в `menu` обязан выполнить startup preload: sprite textures по контракту [sprite-assets.md](sprite-assets.md) и required first-screen UI assets по [menu-and-startup-presentation.md](menu-and-startup-presentation.md). Lazy-load этих обязательных ассетов в фазах `menu`/`running`/`paused`/`result` запрещён.
- Splash timing больше не должен подделывать asset progress. Намеренная минимальная presentation-пауза живёт как post-load ritual в [menu-and-startup-presentation.md](menu-and-startup-presentation.md), после успешной загрузки и декодирования ассетов.
- Источник sprite texture списка — visual registries в `src/main/render/**`; preload не знает про content registry напрямую и не парсит MD: `image` уже зафиксирован в generated данных. Источник first-screen UI asset списка — static presentation list from [menu-and-startup-presentation.md](menu-and-startup-presentation.md).
- Прогресс preload-а (количество загруженных / общее) пробрасывается callback-ом в `StartupOverlay`. Текстуры считаются «готовыми» только после успешного декодирования — частично декодированный bitmap не отдаётся renderer-у даже на короткое время.
- Любая ошибка загрузки или декодирования хотя бы одного обязательного ассета — единственный сан­кц­ио­ни­ро­ва­ный триггер `loading → error('preload')`. `UiShell` запоминает первое поражение (URL + браузерное сообщение) и передаёт его в `StartupErrorOverlay`. Параллельно идущие загрузки прерываются; partial-success-режима нет.
- `SimWorkerHost.startSession` в фазе `loading` не вызывается; сам worker может быть инициализирован пустым (без сессии) уже здесь, но это деталь реализации, не контракт.
- `Audio.unlock()` в фазе `loading` не вызывается: контекст по-прежнему ждёт первый user-gesture (`audio.md`). Splash без звука — ожидаемое поведение.
- В фазе `loading` `ClientSettingsStore` уже доступен: его создание не требует worker-а или Renderer-а. Изменения настроек в `loading` запрещены UI-ем (Settings overlay недоступен), но программное чтение допустимо — это используется при первом `menu → running`, см. [render-scale.md](render-scale.md).

### Пересечение с input-commands

- Pause hotkeys и Pointer Lock — owner [input-commands.md](input-commands.md). Этот файл фиксирует только то, что **роутер** `Esc`/`Space`/`KeyP`/Pointer-Lock-loss — `UiShell`, и что переходы `running ↔ paused` — единственный санкционированный эффект player-facing pause hotkeys на стороне UI.
- Поведение `Space` и `KeyP` закрепляется в [input-commands.md](input-commands.md). UiShell обязан соблюдать это поведение и не вводить параллельных хоткеев под паузу.

## Consequences

- 007 получает компактную и проверяемую схему: один оркестратор, четыре фазы, заранее заданные действия и видимости. Тесты легко привязываются к таблице фаз, а не к глобальному состоянию `index.ts`.
- HUD остаётся headless относительно симуляции: тестировать его можно, подавая чистые `SessionDefinition` + `SnapshotPair`, без worker-а и DOM-эмуляции событий.
- Снапшот не расширяется ради HUD-агрегатов «номер волны»/«всего волн»: они выводимы из `SessionDefinition.encounters` + `snapshot.encounter`. Это сохраняет минимальность контракта `snapshot-shape.md` для 008/009/010.
- Меню становится data-driven: добавление нового playable preset = одна запись в каталоге + ветка builder-а, без правки кода UI.
- Result UI обособлен от меню: 008 (audio) и 009 (settings) могут расширять стартовый экран меню, не задевая UX финального экрана.
- Pause UX перестаёт быть «обработчик в `index.ts`, который попутно вызывает sim»; единственная точка вызова `SimWorkerHost.pause/resume` облегчает дальнейший дебаг и аудит детерминизма.
- В каждом будущем расширении (audio events для HUD, settings overlay из меню, in-run notifications) видна стартовая точка интеграции — `UiShell`, а не разрозненные места в `src/main/index.ts`.

## Related

- [thread-model.md](thread-model.md)
- [session-definition.md](session-definition.md)
- [snapshot-shape.md](snapshot-shape.md)
- [runtime-systems.md](runtime-systems.md)
- [input-commands.md](input-commands.md)
- [content-boundaries.md](content-boundaries.md)
- [content-archetypes.md](content-archetypes.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [simulation-timing.md](simulation-timing.md)
- [client-settings.md](client-settings.md)
- [audio.md](audio.md)
- [render-scale.md](render-scale.md)
- [sprite-assets.md](sprite-assets.md)
- [web-stack.md](web-stack.md)
- [boss-encounter.md](boss-encounter.md)
- [zone.md](zone.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [../docs/VISION.md](../docs/VISION.md)
- [../stories/007-hud-and-menu.md](../stories/007-hud-and-menu.md)
- [../stories/009-settings.md](../stories/009-settings.md)
- [../stories/013-sprite-assets-and-loader.md](../stories/013-sprite-assets-and-loader.md)
- [../stories/015-sessions-from-md.md](../stories/015-sessions-from-md.md)
- [impact-feedback.md](impact-feedback.md)
- [encounter-presentation.md](encounter-presentation.md)
- [hud-presentation.md](hud-presentation.md)
- [menu-and-startup-presentation.md](menu-and-startup-presentation.md)
- [session-result-summary.md](session-result-summary.md)
- [escape-progress-path.md](escape-progress-path.md)
