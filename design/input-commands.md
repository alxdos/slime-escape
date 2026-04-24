# Input Commands

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-24 (017 alignment: weapon slot selection and holster commands are added for ordered loadouts; `Digit0` is the dedicated holster hotkey; see [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). Earlier: 007 finalized Space as dev-pause through `UiShell`.)

## Context

[thread-model.md](thread-model.md) фиксирует, что `main → sim` идут input commands игрока, но не задаёт их структуру, частоту, координатное пространство и привязку к клавиатуре/мыши. В `src/shared/protocol.ts` сейчас `InputCommand = unknown`. Без явного контракта:

- история 002 примет неявное решение по форме команд движения и прицела;
- история 003 (стрельба) переоткроет тот же вопрос для `fire`;
- история 007 (HUD/меню/пауза) переоткроет правила Esc/паузы;
- любой ввод поведёт за собой контракт между потоками, который потом дорого менять.

Дополнительно есть продуктовые требования:

- управление WASD не должно зависеть от текущей раскладки клавиатуры;
- системный курсор скрыт во время сессии, прицел рисуется самой игрой;
- ЛКМ — стрельба (поведение реализуется в 003, контракт нужен сейчас).

## Decision

### Слои ответственности

- Сбор сырого ввода (нажатия клавиш, события мыши, Pointer Lock) — `main thread`. Конкретно — модуль уровня `src/main/input/**` (расположение внутри `src/main` — деталь реализации, не фиксируется здесь).
- `sim` принимает только уже агрегированные `InputCommand` сообщения и не знает ни о клавиатуре, ни о мыши, ни о viewport.
- Прицел (визуальный crosshair) рисуется на стороне `main`, его позиция вычисляется в `main` и в `sim` не уходит как отдельная сущность.

### Клавиатура: WASD по физической клавише

- Команды движения строятся по `KeyboardEvent.code`: `KeyW`, `KeyA`, `KeyS`, `KeyD`. Поле `event.key` не используется для движения, чтобы поведение не зависело от текущей раскладки и от модификаторов.
- Стрелки `ArrowUp/Down/Left/Right` — допустимый эквивалентный ввод; mapping живёт в `src/main/input/**`.
- Никакая системная клавиша не отбирается у браузера без необходимости. Конкретно: `e.preventDefault()` вызывается только для тех `code`, которые игра реально использует.

### Клавиатура: слоты оружия

- `Digit1`..`Digit9` выбирают 0-based слот оружия `0..8` и отправляют `selectWeaponSlot`.
- `Digit0` — dedicated holster hotkey and sends `holsterWeapon`.
- Для этих команд используется `KeyboardEvent.code`, not `event.key`, по тем же причинам раскладки, что и для движения.
- `event.repeat` для slot/holster hotkeys игнорируется: это edge-команды, удержание клавиши не должно порождать повторный поток выбора.

### Команда движения

- Состояние нажатых WASD-клавиш агрегируется в **направление движения** как пара `(dx, dy)`:
  - `dx = (KeyD ? 1 : 0) - (KeyA ? 1 : 0)`;
  - `dy = (KeyW ? 1 : 0) - (KeyS ? 1 : 0)` (ось Y вверх, см. [arena-and-coordinates.md](arena-and-coordinates.md));
  - вектор **нормализуется**, если его длина больше 1; нулевой вектор означает «стоять».
- Это означает: при одновременном нажатии двух перпендикулярных клавиш игрок движется по диагонали с **той же** скоростью, что и по одной оси. «Сырой» вектор с `sqrt(2)`-бонусом по диагонали запрещён.
- Команда движения — **state-based**: `main` отправляет в `sim` текущее «желание двигаться», а не события «нажал/отпустил». Это упрощает обработку дребезга и не требует от `sim` хранить state клавиатуры.

### Мышь и прицел

- Во время активной сессии `main` запрашивает Pointer Lock на canvas. Пока Pointer Lock активен:
  - системного курсора не видно;
  - игра ведёт **виртуальную позицию прицела** в world-координатах, обновляя её на основе `movementX/Y` событий `mousemove`;
  - виртуальный прицел жёстко зажимается в границы арены ([arena-and-coordinates.md](arena-and-coordinates.md)); выйти прицелом за арену нельзя.
  - перевод `movementX/Y` (в пикселях canvas) в world-units выполняется по тому же mapping, что и весь рендер: `1 wu ≡ canvas.height / arena.height` пикселей. Это даёт одинаковую чувствительность прицела на любом размере окна и одинаковый «ощущаемый» аим на 4K и FullHD.
  - чувствительность прицела не вводится в этом решении; до появления настроек ([../stories/009-settings.md](../stories/009-settings.md)) считается равной `1.0` от mapping выше.
- Если Pointer Lock в данный момент не активен (браузер только что снял по Esc, лок ещё не запрошен заново и т.п.) — прицел остаётся в последней известной world-позиции, движение мыши его не двигает. Это исключает «прыжки» прицела при потере и восстановлении лока.
- Главный канал «прицела в `sim`» — поле `aim` в команде ввода (см. ниже), в world-координатах. Никакие screen-координаты в `sim` не передаются.

### Стрельба (ЛКМ)

- Левая кнопка мыши — единственная кнопка, отвечающая за основную атаку. Это контракт уровня дизайна, не настраиваемая горячая клавиша на этом этапе.
- ЛКМ порождает команду `fire` с состоянием `start | stop`:
  - `mousedown` → `fire: start`;
  - `mouseup` → `fire: stop`;
  - удержание ЛКМ не должно генерировать поток повторных команд; темп стрельбы — ответственность `CombatSystem` ([runtime-systems.md](runtime-systems.md)) и параметров оружия.
- В историях, где `CombatSystem` ещё не существует (002), `sim` принимает команду `fire` как валидную, но игнорирует её действие на gameplay-state. Молча отбрасывать неизвестные команды запрещено — иначе ошибка протокола станет невидимой.

### Esc, пауза и Pointer Lock

- `Esc` всегда означает «открыть паузу с overlay»; кнопка «Выйти в меню» внутри overlay вызывает `stopSession`.
- Браузер автоматически снимает Pointer Lock на `Esc` — это намеренно совпадает с открытием overlay паузы: системный курсор появляется, и им можно кликнуть кнопки.
- При выходе из паузы `main` повторно запрашивает Pointer Lock. Пока пользователь не сделал жест (клик), запрос может быть отказан браузером — это корректно и обрабатывается следующим mousedown.
- `Space` сохраняет роль из 001 как **dev-пауза**: переключает `SimWorkerHost.pause()`/`.resume()`, но **не** меняет фазу `UiShell` и **не** показывает `PauseOverlay`. Это намеренное расхождение со штатным UX и используется для дебага рендера/таймингов на стороне разработчика. Player-facing путь паузы — только `Esc` + overlay.
- Маршрутизация хоткеев в 007: и `Esc`, и `Space` обрабатывает единственный owner `UiShell` ([main-ui-shell.md](main-ui-shell.md)). Прямые вызовы `SimWorkerHost.pause()`/`.resume()` из обработчиков `keydown` вне `UiShell` запрещены — иначе фаза `UiShell` (`running`/`paused`) разъедется с `isPaused()` симуляции, и появится «двойная пауза» из дев-хоткея + overlay.
- В фазе `paused` (overlay поднят через `Esc`) `Space` дополнительно **не** действует: оркестратор игнорирует дев-хоткей, пока активна штатная пауза, чтобы не было сценария «снял дев-хоткеем, но overlay остался видим». В фазах `menu` и `result` оба хоткея игнорируются.

### Структура `InputCommand`

- Дискриминированный union, единственный источник всех команд `main → sim`:
  ```ts
  type InputCommand =
    | { kind: 'move'; dx: number; dy: number }       // нормализованный вектор, |v| ∈ [0, 1]
    | { kind: 'aim';  x: number;  y: number  }       // world-координаты
    | { kind: 'fire'; phase: 'start' | 'stop' }
    | { kind: 'selectWeaponSlot'; slotIndex: number } // 0-based slot for keyboard 1..9
    | { kind: 'holsterWeapon' };
  ```
- Семантика:
  - `move` и `aim` — **state**: последняя полученная команда отменяет предыдущую того же `kind`; `sim` хранит «текущее желание» игрока и применяет его на каждом тике.
  - `fire` — **edge**: каждое сообщение значимо, но дополнительные сообщения того же `phase` подряд не должны менять gameplay-state.
  - `selectWeaponSlot` and `holsterWeapon` are **edge** commands. `selectWeaponSlot` changes runtime selected weapon if the index exists in the current ordered loadout; invalid indices are ignored with warning and do not alter selection. `holsterWeapon` sets selected weapon to `null`.
- Команды `start/stop/pause/resume/debug` остаются на верхнем уровне `MainToSim` ([thread-model.md](thread-model.md)) и не входят в `InputCommand`.

### Частота отправки

- `move` и `aim` отправляются **по изменению** значения, а не каждый кадр. Если ничего не изменилось — `main` молчит.
- `aim` дополнительно ограничивается: при потоке `mousemove` `main` группирует события за один кадр `requestAnimationFrame` и отправляет максимум одну команду `aim` на кадр.
- `fire` отправляется по событию (не дросселируется на стороне `main`).
- Гарантий «команда обязательно дойдёт до конкретного тика» нет: связь `main → sim` асинхронная по контракту [thread-model.md](thread-model.md). `sim` применяет последнее полученное состояние на ближайшем тике.

### Обработка в sim

- `sim` хранит per-session «input state» как часть runtime state ([content-boundaries.md](content-boundaries.md)): `{ moveDir, aimWorld, firing }`.
- При `startSession` input state сбрасывается в нейтральное значение (`moveDir = (0,0)`, `aimWorld = player.position`, `firing = false`).
- При `stopSession` input state выбрасывается вместе с остальным runtime state.
- При `startSession` selected weapon state is initialized from `SessionDefinition.loadout.selectedIndex` when `loadout !== null`.
- Команды, пришедшие до `startSession` или после `stopSession`, отбрасываются с warning через единый log-модуль; молчаливое игнорирование запрещено.

## Consequences

- В `src/shared/protocol.ts` `InputCommand` перестаёт быть `unknown` и становится конкретным дискриминированным union; это **изменение контракта** `MainToSim`, оформляется в реализации сразу.
- `sim` остаётся headless: никаких упоминаний `KeyboardEvent`, `MouseEvent`, `clientX`, `viewport` внутри `src/sim/**`.
- Прицел и движение ощущаются одинаково на любом разрешении и aspect ratio окна (см. инвариант в [arena-and-coordinates.md](arena-and-coordinates.md)): mapping mouse delta → world делает одна и та же формула.
- Esc + Pointer Lock + overlay паузы образуют согласованный UX: один и тот же жест и снимает лок, и открывает меню, и даёт системный курсор для кликов.
- `fire` существует в контракте уже в 002 и игнорируется на уровне gameplay; 003 включает `CombatSystem` без расширения протокола.
- Настройки чувствительности (009) ложатся как множитель на единственный mapping mouse delta → world и не требуют пересмотра этого решения.
- Пересмотр клавиш (ремап, геймпад, тач) в будущем = расширение mapping в `src/main/input/**` без изменения формы `InputCommand`. Если потребуется новый `kind` — это уже изменение контракта и обновление этого файла.

## Related

- [thread-model.md](thread-model.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [runtime-systems.md](runtime-systems.md)
- [content-boundaries.md](content-boundaries.md)
- [main-ui-shell.md](main-ui-shell.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
