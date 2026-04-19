# Playable Arena

- Status: in-progress
- Created: 2026-04-19
- Updated: 2026-04-19

## Player-facing

- Sees: заглушка меню с одной кнопкой запуска; после старта — пустая арена с управляемым персонажем.
- Can do: запустить сессию, ходить по арене с клавиатуры/мыши, завершить сессию и вернуться в меню.

## Technical

- Заглушка `content library` с одной аренной и одним `ModePreset` типа `sandbox` живёт в `src/shared/content/**` (см. [../design/web-stack.md](../design/web-stack.md), [../design/content-boundaries.md](../design/content-boundaries.md)).
- Builder `ModePreset` + опции → `SessionDefinition` строит сессию по [../design/session-definition.md](../design/session-definition.md), включая `winCondition: none` / `lossCondition: none` для sandbox.
- `SessionFlowSystem`: idle по умолчанию, старт/стоп с активным encounter типа `sandbox`, lifecycle симуляции по [../design/runtime-systems.md](../design/runtime-systems.md).
- Передача `SessionDefinition` из `main` в `simulation worker` через типизованный `MainToSim.startSession` ([../design/thread-model.md](../design/thread-model.md)).
- Input commands `main → sim` (движение WASD, прицел в world-координатах, ЛКМ) — слой ввода в `src/main/input/**`, контракт по [../design/input-commands.md](../design/input-commands.md). В 002 `fire` в `sim` пока no-op, но протокольно валидна.
- `EntityStore` минимально под одну сущность игрока, создаваемую из `SessionDefinition.player`.
- `MovementSystem` для игрока внутри границ арены ([../design/arena-and-coordinates.md](../design/arena-and-coordinates.md)).
- Камера и canvas вписывают арену в viewport (fit / letterbox / pillarbox); рендер арены и игрока поверх 001; виртуальный прицел рисуется в `main` под Pointer Lock.
- Системный курсор скрыт во время сессии; Esc → overlay паузы с кнопкой «Выйти в меню».
- Базовая инфраструктура проекта приходит в этой истории: единый log-модуль ([../design/logging.md](../design/logging.md)) и test runner ([../design/testing.md](../design/testing.md)) — это первая история, где они реально нужны.

## Out of scope

- Враги, оружие, бой, дроп.
- Полноценное меню и HUD — это `007`.
- Тёмная зона, волны, encounter-переходы — это `004`.

## Acceptance

- Из заглушки меню запускается сессия.
- Игрок видит свой персонаж на пустой арене и управляет им.
- Персонаж не выходит за границы арены.
- Завершение сессии возвращает в меню без ошибок и утечек воркера.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [ ] | Базовая инфраструктура: `vitest` в `devDependencies` и `scripts.test`/`scripts.test:watch` в `package.json`; модуль `src/shared/log.ts` с API `log.info/warn/error` по `design/logging.md`. | опоры: `design/testing.md`, `design/logging.md` |
| T2 | [ ] | Типизировать публичные контракты в `src/shared/**`: `SessionDefinition` / `EncounterDefinition` / `WinCondition` / `LossCondition`, дискриминированный `InputCommand`, `EntitySnapshot.kind`, минимальный `RuntimeEvent` union по lifecycle kinds из `design/runtime-systems.md`. `MainToSim.startSession.session`, `MainToSim.input.command` и `SimToMain.event.event` перестают быть `unknown`. | опоры: `design/session-definition.md`, `design/input-commands.md`, `design/thread-model.md`, `design/runtime-systems.md` |
| T3 | [ ] | Скаффолд `content library` в `src/shared/content/**`: одна арена `{ width, height }`, один sandbox `ModePreset`, builder `buildSessionDefinition(preset, options) → SessionDefinition` с `winCondition/lossCondition: none` и стартовым `seed`. | опоры: `design/web-stack.md`, `design/content-boundaries.md`, `design/session-definition.md` |
| T4 | [ ] | Перевести `SimulationClock` и `worker.ts` в lifecycle по сессии: idle по умолчанию, обработка `startSession`/`stopSession` с инициализацией и сбросом runtime state, без `worker.terminate()`. Warning через `log` для команд вне сессии и `pause` без сессии. | опоры: `design/runtime-systems.md`, `design/thread-model.md`, `design/logging.md` |
| T5 | [ ] | `EntityStore` минимальный + создание сущности игрока из `SessionDefinition.player`; `SnapshotExportSystem` экспортирует игрока с `kind: 'player'`. Тестовая орбитальная сущность из 001 удаляется. | опоры: `design/runtime-systems.md`, `design/thread-model.md` |
| T6 | [ ] | Слой ввода `src/main/input/**`: WASD по `KeyboardEvent.code`, Pointer Lock на canvas, виртуальный прицел в world-координатах с зажимом по границам арены, ЛКМ → `fire start/stop`. Команды отправляются в `sim` по правилам частоты из `design/input-commands.md`. | опоры: `design/input-commands.md`, `design/arena-and-coordinates.md` |
| T7 | [ ] | `MovementSystem` для игрока: интеграция `move` команды по `player.maxSpeed` × `SIM_STEP_MS`, clamp по границам `arena`. Инвариант «персонаж не выходит за границы» закрыт unit-тестом по `design/testing.md`. | опоры: `design/runtime-systems.md`, `design/arena-and-coordinates.md`, `design/simulation-timing.md`, `design/testing.md` |
| T8 | [ ] | Рендер арены и игрока: ortho-камера на `arena.width × arena.height`, CSS-вписывание canvas (`aspect-ratio`), отрисовка прямоугольника арены, спрайта игрока и виртуального прицела. Системный курсор скрыт на canvas. | опоры: `design/arena-and-coordinates.md`, `design/thread-model.md` |
| T9 | [ ] | Заглушка меню (DOM overlay с кнопкой «Старт»); Esc → overlay паузы с кнопкой «Выйти в меню»; интеграция `startSession`/`stopSession`/`pause`/`resume`; повторный запрос Pointer Lock на resume. Проверка acceptance. | опоры: `design/input-commands.md`, `design/runtime-systems.md` |
| T10 | [ ] | Перевести историю в `done`, обновить таблицу в `stories/README.md`. | архитектор |

## Related

- [../design/session-definition.md](../design/session-definition.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../design/thread-model.md](../design/thread-model.md)
- [../design/arena-and-coordinates.md](../design/arena-and-coordinates.md)
- [../design/input-commands.md](../design/input-commands.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/simulation-timing.md](../design/simulation-timing.md)
- [../design/logging.md](../design/logging.md)
- [../design/testing.md](../design/testing.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
