# HUD and Menu

- Status: in-progress
- Created: 2026-04-19
- Updated: 2026-04-20

## Player-facing

- Sees: полноценный экран выбора режима со списком пресетов; во время боя — HUD с HP, таймером, номером волны и состоянием босса; экран паузы.
- Can do: выбрать режим из меню и запустить сессию, на лету ставить паузу, видеть прогресс боя в HUD, вернуться в меню после конца сессии.

## Technical

- Презентация на `main thread` оркеструется единым `UiShell` с явными фазами `menu` / `running` / `paused` / `result(win|loss)`; видимости overlay-ев и HUD заданы по фазам — см. [../design/main-ui-shell.md](../design/main-ui-shell.md).
- HUD — пассивный потребитель: читает `SessionDefinition` один раз и `SnapshotPair` в общем main rAF-цикле; не подписывается на runtime events ради authoritative state и не отправляет команд в `sim`. Контракт полей — [../design/snapshot-shape.md](../design/snapshot-shape.md), [../design/main-ui-shell.md](../design/main-ui-shell.md).
- Меню — data-driven: список playable preset'ов лежит в `src/shared/content/**` отдельным реестром (display-данные не висят на authoritative `ModePreset`); резолв в builder сессии — [../design/main-ui-shell.md](../design/main-ui-shell.md), [../design/session-definition.md](../design/session-definition.md), [../design/content-boundaries.md](../design/content-boundaries.md).
- Pause UX: единственный owner вызовов `SimWorkerHost.pause/resume` — `UiShell`; маршрутизация Esc и dev-хоткея Space, поведение Pointer Lock — [../design/input-commands.md](../design/input-commands.md), [../design/main-ui-shell.md](../design/main-ui-shell.md).
- Result UX: переход в `result` инициируется только `win`/`loss` от sim; единственное действие — «В меню»; `stopSession` повторно не вызывается (sim уже выполнила teardown по [../design/session-definition.md](../design/session-definition.md)).
- Номер волны / «всего волн» / таймер encounter HUD выводит из `SessionDefinition.encounters` + `snapshot.encounter`/`snapshot.waveProgress`; новых полей в snapshot эта история не вводит ([../design/snapshot-shape.md](../design/snapshot-shape.md)).

## Out of scope

- Настройки громкости и разрешения — `009`.
- Аудио — `008`.
- Сложная кастомизация modifiers и подбор loadout.

## Acceptance

- Старт игры открывает меню, не сессию.
- Выбор режима запускает соответствующую сессию.
- HUD корректно показывает HP, активный encounter, прогресс волны и состояние босса.
- Пауза замораживает симуляцию и доступна и снимается из UI и хоткеем.
- Завершение сессии возвращает в меню без перезагрузки страницы.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [ ] | `playableModes.ts` в `src/shared/content/**`: реестр `PLAYABLE_MODE_CATALOG` с записями `campaign` и `training`, валидация резолва каждого `presetId` через `buildSessionDefinition` при загрузке модуля. | data-only; sandbox-id'ы в каталог не входят |
| T2 | [ ] | `src/main/ui/UiShell.ts`: оркестратор фаз `menu`/`running`/`paused`/`result`, единственный owner вызовов `SimWorkerHost.startSession/stopSession/pause/resume`, единая таблица видимости overlay-ев и HUD. Перенос текущей оркестрации из `src/main/index.ts`, поведение сессии не меняется. | контракт переходов и видимости — `design/main-ui-shell.md` |
| T3 | [ ] | `MenuOverlay`: рендер списка режимов из `PLAYABLE_MODE_CATALOG` (одна карточка на запись с `displayName`/`description`); клик по «Старт» вызывает переход `menu → running` через `UiShell`; стартовая кнопка по умолчанию убрана. | без поля «seed»: seed генерирует `UiShell` |
| T4 | [ ] | `Hud.ts` (`src/main/ui/**`): блок HP игрока (из `PlayerSnapshot.hp`/`maxHp`), блок encounter (id/тип/таймер `elapsedMs`), блок волны (`waveProgress` + «волна N из M», N/M из `SessionDefinition.encounters`); обновление через `update(snapshotPair)` из main rAF. | HUD не подписан на runtime events |
| T5 | [ ] | Расширение `Hud`: блок босса (HP-бар, индекс/идентификатор фазы) поверх `snapshot.bossHud`; блок виден ровно при `bossHud !== null`; имя/визуал фазы резолвится через `BossArchetype` из `content library`. | контракт поля — `snapshot-shape.md`, `boss-encounter.md` |
| T6 | [ ] | Pause UX интеграция: `UiShell` — единственный вызывающий `SimWorkerHost.pause/resume`; обработчики Esc / `pointerlockchange` / Space переехали в `UiShell`; в `paused` HUD заморожен (нет вызова `Hud.update`), pause overlay над HUD; в фазах `menu`/`result` хоткеи паузы игнорируются. | соответствие `input-commands.md` (обновлено под 007) |
| T7 | [ ] | Result UX: новый компонент `ResultOverlay` в `src/main/ui/**` (или эквивалент), `UiShell` входит в `result(win|loss)` только по событиям `win`/`loss` и **не** вызывает `stopSession` (sim уже сбросилась); единственное действие — «В меню» (`result → menu`); HUD скрыт. | разделение с `MenuOverlay`: меню перестаёт держать `setResult` |
| T8 | [ ] | Юнит/поведенческие тесты: валидация `PLAYABLE_MODE_CATALOG`, переходы `UiShell` (включая `running → result` без `stopSession` и `paused → menu` через exit), HUD деривации (`«волна N из M»`, видимость boss-блока, отсутствие `waveProgress` в не-wave encounter), Esc/Space-маршрутизация в `UiShell`. | jsdom + ручные `SnapshotPair`/`SessionDefinition`-фикстуры |

## Related

- [../design/main-ui-shell.md](../design/main-ui-shell.md)
- [../design/session-definition.md](../design/session-definition.md)
- [../design/snapshot-shape.md](../design/snapshot-shape.md)
- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../design/thread-model.md](../design/thread-model.md)
- [../design/input-commands.md](../design/input-commands.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/content-archetypes.md](../design/content-archetypes.md)
- [../design/boss-encounter.md](../design/boss-encounter.md)
- [../design/zone.md](../design/zone.md)
- [../design/arena-and-coordinates.md](../design/arena-and-coordinates.md)
- [../design/simulation-timing.md](../design/simulation-timing.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [../docs/VISION.md](../docs/VISION.md)
