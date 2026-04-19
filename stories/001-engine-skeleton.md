# Engine Skeleton

- Status: planned
- Created: 2026-04-19
- Updated: 2026-04-19

## Player-facing

- Sees: открытая в браузере страница с тестовым объектом, который плавно двигается по сцене; FPS-индикатор в углу.
- Can do: поставить паузу и продолжить, увидеть, что движение действительно остановилось и возобновилось.

## Technical

- Web-сборка и HTML точка входа.
- `three.js` рендер пустой сцены в `main thread`.
- `simulation worker` с фиксированным `SimulationClock`, тиком и pause/resume.
- Протокол сообщений `main ↔ simulation worker`: команды и снапшоты.
- Минимальный `SnapshotExportSystem`: позиция тестового объекта в снапшоте.
- Интерполяция между двумя последними снапшотами на стороне рендера.
- Feature detection (для будущего offscreen-пути в `010`).

## Out of scope

- Игрок, ввод, бой, враги, сессии, меню, аудио.
- `OffscreenCanvas` render worker — отдельная история `010`.
- Любая физика и коллизии.

## Acceptance

- Страница открывается без ошибок в консоли.
- На сцене видно один тестовый объект, который двигается равномерно.
- На разных FPS экрана движение остаётся плавным (визуально без рывков).
- Pause останавливает движение, resume — продолжает с того же места.
- В углу виден текущий FPS.

## Tasks

| ID | Task | Status | Note |
|----|------|--------|------|
| T1 | Скелет проекта и точка запуска в браузере | planned | |
| T2 | `simulation worker` с фиксированным тиком, pause/resume | planned | |
| T3 | Рендер `three.js` в main + интерполяция снапшотов + FPS-индикатор | planned | |

## Related

- [../design/thread-model.md](../design/thread-model.md)
- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../docs/SCOPE.md](../docs/SCOPE.md)
