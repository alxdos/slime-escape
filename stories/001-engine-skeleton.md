# Engine Skeleton

- Status: in-progress
- Created: 2026-04-19
- Updated: 2026-04-19

## Player-facing

- Sees: открытая в браузере страница с тестовым объектом, который плавно двигается по сцене; FPS-индикатор в углу.
- Can do: поставить паузу и продолжить, увидеть, что движение действительно остановилось и возобновилось.

## Technical

- Web-сборка и HTML точка входа; стек и раскладка исходников зафиксированы в [../design/web-stack.md](../design/web-stack.md).
- `three.js` рендер пустой сцены в `main thread`.
- `simulation worker` с фиксированным `SimulationClock`, тиком и pause/resume; конкретные частоты и правила интерполяции — в [../design/simulation-timing.md](../design/simulation-timing.md).
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
| T1 | Зафиксировать `design/web-stack.md` (Vite + TS + npm, layout `src/main`/`src/sim`/`src/shared`, правила импортов) | done | plan: `design-web-stack` |
| T2 | Зафиксировать `design/simulation-timing.md` (`SIM_HZ=60`, `SNAPSHOT_HZ=30`, правила интерполяции и pause/resume) | done | plan: `design-sim-timing` |
| T3 | Обновить `design/README.md` Index и `Related` истории под новые решения | done | plan: `design-index` |
| T4 | Скелет проекта (Vite + TS + npm, `index.html`, пустая `three.js` сцена в `main`, `featureDetection`, `src/shared/timing.ts` с константами) | done | plan: `scaffold` |
| T5 | `simulation worker`: `SimulationClock` 60 Hz, world c testEntity, pause/resume, протокол в `src/shared` | planned | plan: `sim-worker` |
| T6 | `SnapshotExportSystem` 30 Hz и публикация снапшотов в main | planned | plan: `snapshot-export` |
| T7 | `Renderer`: буфер из 2 снапшотов, интерполяция позиции с задержкой `SNAPSHOT_INTERVAL_MS` | planned | plan: `render-interp` |
| T8 | `FpsOverlay` + hotkey `Space` для pause/resume + проверка acceptance | planned | plan: `fps-pause` |
| T9 | Перевести историю в `done`, обновить `stories/README.md`, добавить в корневой README секцию How to run | planned | plan: `story-status` |

## Related

- [../design/thread-model.md](../design/thread-model.md)
- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/simulation-timing.md](../design/simulation-timing.md)
- [../docs/SCOPE.md](../docs/SCOPE.md)
