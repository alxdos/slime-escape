# Main UI Shell

- Status: accepted
- Created: 2026-04-20
- Updated: 2026-04-20

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
  - `menu` — стартовый экран и экран «между забегами»; ни одна сессия не активна (`SimWorkerHost.startSession` ещё не вызывался либо сессия уже корректно завершена);
  - `running` — активная сессия, симуляция тикает, рендер и HUD показаны;
  - `paused` — активная сессия, симуляция стоит (`SimWorkerHost.pause` вызван), HUD и сцена остаются видны и заморожены, поверх показан `PauseOverlay`;
  - `result(win | loss)` — последняя сессия завершилась автоматически (`win`/`loss` event) и ещё не сброшена пользователем; на экране отображается итог и единственное действие «в меню».
- Допустимые переходы (любой другой переход — баг оркестрации, не «свобода UX»):
  - `menu → running` через явное действие игрока (выбор режима);
  - `running ↔ paused` через `Esc`/потерю Pointer Lock/кнопки overlay-ев и через дев-хоткей (см. ниже);
  - `running → result(win|loss)` через `win`/`loss` event из sim;
  - `running → menu` через явный exit из паузы (кнопка «Выйти в меню»);
  - `paused → menu` через тот же exit (без промежуточного `running`);
  - `result → menu` через единственное действие «В меню»;
  - `result → running` напрямую запрещён: новый забег стартует только из `menu`.
- Переходы из `running`/`paused` в `menu` всегда явно вызывают `SimWorkerHost.stopSession()`. Переход `running → result` — наоборот, **не** вызывает `stopSession()`: симуляция уже сама выполнила teardown по контракту [session-definition.md](session-definition.md). Это исключает «no active session» warning и двойной сброс runtime state.
- Один экземпляр `simulation worker` живёт всю жизнь приложения и переиспользуется между сессиями ([thread-model.md](thread-model.md)). `UiShell` не пересоздаёт worker при переходах между фазами.
- Переход в любую фазу делает явный show/hide для всех overlay-ев и HUD по таблице ниже. Никакой компонент не имеет права самостоятельно показывать/скрывать себя «по событию мимо UiShell».

### Видимость overlay-ев и HUD по фазам

| Фаза | Menu overlay | HUD | Pause overlay | Result UI | Pointer Lock |
|------|--------------|-----|---------------|-----------|--------------|
| `menu` | visible | hidden | hidden | hidden | released |
| `running` | hidden | visible (live) | hidden | hidden | requested |
| `paused` | hidden | visible (frozen на последнем снапшоте) | visible | hidden | released |
| `result(win|loss)` | hidden | hidden | hidden | visible | released |

- HUD остаётся видимым в `paused` намеренно: игрок должен видеть текущие значения HP/таймера/волны/босса, на которых он поставил паузу. Pause overlay рисуется над ним.
- Result UI скрывает HUD: цифры забега, на котором всё закончилось, не должны конкурировать с финальным итогом. Если позже потребуется «итоговая сводка» — это расширение Result UI, не возвращение HUD.

### Стек слоёв (z-order)

- Слои сверху вниз: Result UI > Pause overlay > Menu overlay > HUD > canvas. Конкретные числовые `z-index` — деталь реализации; контракт — порядок и непересекающаяся видимость одновременных слоёв (по таблице фаз одновременно показано не более одного overlay-я плюс HUD).
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

### HUD-агрегаты «номер волны» и «таймер encounter»

- Номер волны и общее число волн **не** добавляются в snapshot. Они вычисляются на стороне HUD из:
  - `SessionDefinition.encounters` — фильтрация по `type === 'wave'`, индексация в порядке списка;
  - `snapshot.encounter.id` или `snapshot.encounter.index` — поиск активного encounter в этом списке.
- Это сохраняет принцип «снапшот несёт только меняющееся state, конфигурация уже у main» из [thread-model.md](thread-model.md) и не требует расширения [snapshot-shape.md](snapshot-shape.md).
- Таймер encounter в HUD = `snapshot.encounter.elapsedMs` (целое мс симуляции из [snapshot-shape.md](snapshot-shape.md)). Никаких параллельных wall-clock-таймеров на стороне HUD — это исключает рассинхрон с `pause`/`resume` ([simulation-timing.md](simulation-timing.md): `simTime` не догоняет wall-clock после resume).
- Прогресс волны (`dispatched`/`total`/`alive`) HUD читает из `snapshot.waveProgress` и не реконструирует его сам; для не-wave encounter поле `null` и блок прогресса HUD скрывает.
- HP игрока HUD читает из единственного `PlayerSnapshot` в `snapshot.entities` (поле `hp`/`maxHp` из [snapshot-shape.md](snapshot-shape.md)). Если `lossCondition.kind === 'none'`, HUD всё равно рендерит HP-блок: значения корректны (`hp = maxHp` весь run по контракту), и UX не должен «прыгать» между preset-ами с боем и без.
- Боссовый блок HUD читает из `snapshot.bossHud`. При `null` блок скрывается; имя фазы для отображения берётся из `BossArchetype` ([content-archetypes.md](content-archetypes.md)) по `bossArchetypeId` активного босса (HUD получает архетип через `SessionDefinition` + резолв либо через `snapshot.entities` сущности `kind: 'boss'`, у которой есть `archetypeId`). Конкретный путь резолва — деталь реализации; контракт — «боссовый блок виден ровно когда `bossHud !== null`».

### Меню и playable preset catalog

- Меню — data-driven: оно отображает список сущностей «выбираемый игроком режим» и для каждого вызывает builder сессии. Меню не знает о конкретных preset-id и не содержит «if/switch по id» для рендера.
- Список выбираемых режимов вводится как отдельный реестр в `src/shared/content/**` (фактическое имя файла — деталь реализации, например `playableModes.ts`):
  ```ts
  type PlayableModeEntry = Readonly<{
    presetId: ModePresetId;          // ссылка в содержимое presets.ts
    displayName: string;             // короткое имя кнопки в меню
    description: string;             // 1–2 строки player-facing описания
    order: number;                   // порядок в меню; меньше = выше
  }>;

  export const PLAYABLE_MODE_CATALOG: ReadonlyArray<PlayableModeEntry>;
  ```
- Реестр валидируется при сборке: каждый `presetId` обязан резолвиться в `ModePreset` и иметь живую ветку в `buildSessionDefinition` (`src/shared/content/buildSession.ts`); неизвестный `presetId` или preset без билдера — ошибка модуля, не runtime-фолбэк. Это правило тождественно правилу «неизвестный архетипный id — ошибка сборки/старта сессии» из [content-archetypes.md](content-archetypes.md).
- `ModePreset` ([session-definition.md](session-definition.md)) при этом остаётся минимальным authoritative объектом (`{ id }`); ему **не** добавляются поля `displayName`/`description`. Display-данные относятся к презентации и собираются в каталоге, а не «навешиваются» на authoritative preset. Это сохраняет правило «builder читает content library и опции, на выходе — `SessionDefinition`» ([content-boundaries.md](content-boundaries.md)).
- На горизонт 007 каталог содержит как минимум `campaign` (основной забег с боссом) и `training` (короткий тренировочный без босса). Sandbox-варианты (`sandbox`, `sandbox-with-combat`) остаются доступными как preset-id, но в каталоге **не** появляются: это bring-up для разработки, не player-facing режимы (см. [session-definition.md](session-definition.md), раздел про sandbox). Расширение каталога в будущем (например, `pistolOnly`) — добавление записи, не изменение этого решения.
- `BuildOptions` для меню в 007 минимальны: `seed` генерируется на стороне `UiShell` при выборе режима, никакие пользовательские опции (loadout, modifiers, кастомизация encounter) в этой истории не вводятся (Out of scope в [../stories/007-hud-and-menu.md](../stories/007-hud-and-menu.md)). Расширение `BuildOptions` — будущее решение в [session-definition.md](session-definition.md), не «по месту» в меню.

### Pause UX

- UX паузы уже зафиксирован в [input-commands.md](input-commands.md) (Esc открывает overlay, кнопка «Выйти в меню» вызывает `stopSession`, Pointer Lock корректно ходит между состояниями).
- `UiShell` — единственное место, которое реально вызывает `SimWorkerHost.pause()`/`.resume()`. Хоткеи Esc/Space и кнопки overlay-ев маршрутизируются через `UiShell`; прямые вызовы `pause/resume` из обработчиков событий вне `UiShell` запрещены. Это исключает «двойную паузу» и рассинхрон между `paused`-фазой UI и `isPaused()` симуляции.
- HUD остаётся видим и заморожен: `UiShell` пропускает вызов `Hud.update()` пока находится в `paused`. Pause overlay рисуется выше HUD по z-order.
- Кнопка «Выйти в меню» в `paused` инициирует переход `paused → menu`: `UiShell` вызывает `SimWorkerHost.stopSession()` и снимает HUD. Никаких promtов «вы уверены?» в 007 не вводится; экран результата сюда не подменяется (`stopSession` — не «поражение»).

### Result UX

- При получении `win`/`loss` от sim `UiShell` переходит в `result(win|loss)`. Это единственный санкционированный триггер `result`-фазы.
- Result UI — отдельный компонент в `src/main/ui/**` (фактическое имя — деталь реализации; намеренно не «пристёгнут» к `MenuOverlay`, чтобы overlay меню не нёс двойную ответственность за стартовый экран и за итог забега).
- В фазе `result` доступно ровно одно действие: «В меню» (переход `result → menu`). Никаких «retry», «stats», «share» в 007 не вводится. Они — расширения Result UI и будущих историй.
- При переходе `result → menu` `UiShell` сбрасывает внутреннее состояние «последний результат» и показывает чистый стартовый экран. История последних результатов не сохраняется (`client settings` под это место не используются — см. [content-boundaries.md](content-boundaries.md)).

### Жизненный цикл рендера и input в рамках фаз

- `Renderer` и `InputController` создаются `UiShell` при переходе `menu → running` и уничтожаются при переходе в `menu` (явный exit) или `result` (`win`/`loss`). Это сохраняет уже работающую модель `src/main/index.ts`, но переносит её в один owner.
- В фазе `paused` `Renderer` продолжает рендер каждый кадр (картинка не «замирает в моменте получения паузы», а отрисовывает последний интерполированный кадр), `InputController` остаётся подключён, но Pointer Lock снят браузером ([input-commands.md](input-commands.md)). HUD заморожен (см. выше).
- В фазе `result` `Renderer` и `InputController` уничтожаются: на экране только Result UI; canvas под ним может остаться пустым/чёрным. Это явно: после смерти игрока «арена сзади продолжает шевелиться» — нежелательный артефакт, и контракт его исключает.
- Смена render backend в 010 (main vs render worker через `OffscreenCanvas`) живёт внутри `Renderer` и не ломает фазовую модель `UiShell`.

### Пересечение с input-commands

- Esc и Pointer Lock — owner [input-commands.md](input-commands.md). Этот файл фиксирует только то, что **роутер** Esc/Pointer-Lock-loss/Space — `UiShell`, и что переходы `running ↔ paused` — единственный санкционированный эффект этих хоткеев на стороне UI.
- Поведение Space в 007 закрепляется в [input-commands.md](input-commands.md) (см. обновление этого файла под 007). UiShell обязан соблюдать это поведение и не вводить параллельных хоткеев под паузу.

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
- [web-stack.md](web-stack.md)
- [boss-encounter.md](boss-encounter.md)
- [zone.md](zone.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [../docs/VISION.md](../docs/VISION.md)
- [../stories/007-hud-and-menu.md](../stories/007-hud-and-menu.md)
