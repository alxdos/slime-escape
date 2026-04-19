# Stories

Вертикальные playable slice'ы проекта. Один файл = одна история. Каждая история должна давать игроку demoable фичу. Шаблон и формат — [_template.md](_template.md).

- Имя файла: `NNN-shortname.md`. Номер с шагом `+1`, не переиспользуется.
- Нумерация задаёт смысловой порядок чтения. Порядок исполнения может отличаться: историю можно перепрыгнуть и вернуться позже — это отражается через `Status`.
- Статусы: `planned` | `in-progress` | `done` | `blocked`.
- Маркеры в таблицах задач и в индексе историй: `[ ]` planned, `[/]` in-progress, `[x]` done, `[-]` blocked. В шапке файла истории (`- Status:`) статус остаётся словом.

## Процесс работы

Разделение ответственности:

- **История** отвечает на «что мы строим» (фича для игрока) и «что трогаем» (системы, протоколы, файлы). Держится короткой.
- **`design/`** отвечает на «как именно устроено» в данной области. Файлы сгруппированы по областям и эволюционируют между историями.

Поток:

1. Перед стартом истории прочитать все её `Related` файлы из `design/`.
2. Если по ходу работы возникает или меняется дизайн-решение:
   - найти подходящий файл `design/<area>.md` и обновить его, либо завести новый файл по новой области;
   - поднять поле `Updated`, при необходимости — `Status`;
   - сослаться на него в `Related` истории и кратко упомянуть в `Technical`.
3. Подробное обоснование, альтернативы, тонкости — только в `design/`. История на них ссылается, не дублирует.
4. Перед закрытием истории убедиться, что все затронутые файлы `design/` перечислены в `Related`, а индекс [../design/README.md](../design/README.md) актуален.

Правило: если решение влияет на будущие истории — оно обязательно должно осесть в `design/`, а не остаться только внутри одной истории.

## Истории

| Story | Status | Description | Tech |
|-------|--------|-------------|------|
| [001-engine-skeleton.md](001-engine-skeleton.md) | [x] | Открытая страница с плавно двигающимся тестовым объектом и FPS-индикатором; пауза/продолжение | Web-сборка, `three.js` в main, `simulation worker`, `SimulationClock`, протокол main↔sim, `SnapshotExportSystem`, интерполяция |
| [002-playable-arena.md](002-playable-arena.md) | [ ] | Запуск пустой арены из заглушки меню, управляемый персонаж, выход в меню | Заглушка `content library`, `ModePreset`→`SessionDefinition`, `SessionFlowSystem`, input commands, `MovementSystem` |
| [003-combat-foundation.md](003-combat-foundation.md) | [ ] | Стрельба по тренировочной мишени, урон и смерть врага | Одно оружие, один враг, `CombatSystem`, `HealthDeathSystem`, `SpatialIndex` |
| [004-waves-and-zone.md](004-waves-and-zone.md) | [ ] | Тренировочный режим из 1–2 волн с передышками, тёмная зона сжимается в волне и расширяется в передышке, win/loss | `SpawnSystem`, `EncounterDefinition` (wave/break), переходы encounter, `ZoneSystem` линейного сжатия |
| [005-drops.md](005-drops.md) | [ ] | С убитых врагов выпадает дроп, игрок подбирает и видит эффект | `DropSystem`, drop tables, подбор по spatial overlap, death hooks |
| [006-boss-encounter.md](006-boss-encounter.md) | [ ] | Финальный бой с боссом без зоны, фазы поведения, финальный win/loss | `BossPhaseSystem`, профиль босса, `EncounterDefinition` типа `boss`, отключение `ZoneSystem` |
| [007-hud-and-menu.md](007-hud-and-menu.md) | [ ] | Полноценное меню выбора режима, HUD с HP/таймером/волной, пауза, экран результата | DOM UI, builder `SessionDefinition` из пресета+опций, runtime events → HUD, pause UI |
| [008-audio-baseline.md](008-audio-baseline.md) | [ ] | Звуки выстрелов, попаданий, смерти и фоновое напряжение | Web Audio в main, master gain, подписка на runtime events из worker, audio unlock на жесте |
| [009-settings.md](009-settings.md) | [ ] | Экран настроек: громкость и разрешение арены `low` / `medium` / `high`, применяется на лету и сохраняется между запусками | `localStorage` settings store, master gain, render scale policy (`canvas` size + CSS + `image-rendering`), переинициализация render target |
| [010-render-pipeline-offscreen.md](010-render-pipeline-offscreen.md) | [ ] | На поддерживаемых браузерах рендер плавнее под нагрузкой, на остальных — корректный fallback без визуальных регрессий | `OffscreenCanvas` render worker, переключение backend, fallback на main-рендер из `001`, проброс render scale из `009`, измерение FPS/frame-time |
| [_template.md](_template.md) | — | Шаблон новой истории | — |
