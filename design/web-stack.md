# Web Stack

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-23 (для истории 011 явно зафиксировано, что buildtime-инструменты живут вне `src/**`; разрешение на корневой каталог `scripts/` оформлено отдельным решением — `content-authoring.md`)

## Context

Игра запускается в браузере и должна одновременно держать `main thread` с DOM/UI/audio/render и `simulation worker` (см. [thread-model.md](thread-model.md)). Стек сборки, язык и раскладка исходников должны быть выбраны один раз и оставаться стабильными на весь проект, потому что менять их позже означает трогать одновременно все истории, worker entry и контракты сообщений. Дополнительно проект open-source, и порог входа для жюри/контрибьюторов должен быть минимальным.

## Decision

- Сборщик: `Vite`.
  - Нативная поддержка TypeScript без отдельной сборки.
  - ESM-workers через `new Worker(new URL(...), { type: 'module' })` — это та же конструкция, которая нужна для `010` (render worker через `OffscreenCanvas`), без отдельного worker-bundler.
  - Простой dev-сервер с HMR для main и автоматическим ребилдом worker-ов.
  - Сборка в статику: `npm run build` → `dist/`, деплой как обычный статический сайт.
- Язык: `TypeScript` со `strict: true`.
  - Типизированный протокол `main ↔ sim` обязателен по [thread-model.md](thread-model.md); без статической типизации он деградирует в комментарии и теряет ценность.
  - `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess` включены.
- Менеджер пакетов: `npm`.
  - Открытый код для конкурса; npm есть у любого, кто поставил Node, без дополнительных шагов.
  - lockfile — `package-lock.json`, коммитим в репозиторий.
  - Миграция на `pnpm` или `yarn` возможна позже без изменения исходного кода.
- Раскладка исходников по слоям, а не по фичам:
  - `src/main/**` — всё, что живёт в `main thread`: бутстрап, render, DOM/HUD, audio, feature detection, host-обёртки worker-ов.
  - `src/sim/**` — содержимое `simulation worker`: clock, runtime-системы, world, worker entry.
  - `src/shared/**` — типы и чистые утилиты, разрешённые в обоих контекстах: протокол сообщений, snapshot-типы, общие константы и математика.
- Внутри `src/shared/**` зарезервированы две именованные подпапки с фиксированной ролью:
  - `src/shared/content/**` — `content library` ([content-boundaries.md](content-boundaries.md)): архетипы врагов и оружия, профили босса, параметры арены, таблицы дропа, стандартные `ModePreset`, builder-функции `ModePreset + options → SessionDefinition`. Внутри только данные и чистые функции, без runtime state и без DOM/three.js.
  - Остальные модули `src/shared/**` (протокол, snapshot, общие константы, математика) свободно соседствуют с `content/`.
- Правила импортов между слоями:
  - `src/sim/**` не имеет права импортировать из `src/main/**`.
  - `src/shared/**` не имеет права импортировать из `src/main/**` или `src/sim/**`.
  - `src/main/**` может импортировать из `src/shared/**`; `src/sim/**` может импортировать из `src/shared/**`.
  - Это даёт инвариант: `simulation worker` остаётся headless, общий контракт не утаскивает за собой DOM/three.js, и любой код в `src/shared/**` (включая `src/shared/content/**`) безопасен в любом контексте.
- `content library` физически живёт в `src/shared/content/**`, потому что его читают и `main` (для сборки `SessionDefinition` в UI и настройки камеры/рендера под арену), и `sim` (для исполнения `spawnPlan`, чтения параметров арены и т.п.). Размещение в `src/main/**` или `src/sim/**` потребовало бы дублирования или нарушения направлений импортов.
- Worker entry — единственный файл `src/sim/worker.ts`. Подключение из main:
  ```ts
  new Worker(new URL('../../sim/worker.ts', import.meta.url), { type: 'module' })
  ```
- Тестовый и debug-код, если появится, живёт рядом с модулем (`*.test.ts`) и не нарушает правила импортов между слоями. Конкретный test runner и команды зафиксированы в [testing.md](testing.md).
- Все runtime-критичные числовые константы тика, частот и т.п. живут в `src/shared/**` (см. [simulation-timing.md](simulation-timing.md)), а не дублируются по системам.

## Consequences

- Появляется единая точка правды для скаффолда; будущие истории добавляют файлы только внутри уже определённых слоёв.
- Контракт между потоками естественно ложится в `src/shared/**` и не зависит от выбранного render backend.
- Миграция стека (Vite → другой бандлер, npm → pnpm) возможна без переписывания gameplay-кода, но требует синхронного обновления этого решения.
- Истории не должны самостоятельно вводить новые корневые директории (`src/render`, `src/game` и т.п.) — расширения только внутри `main`, `sim`, `shared`.
- Зарезервированные подпапки `src/shared/content/**` (и их аналоги, если будут добавлены) фиксируются именно здесь, чтобы не создавать новые контракты «по месту» в отдельных историях.

## Related

- [thread-model.md](thread-model.md)
- [content-boundaries.md](content-boundaries.md)
- [simulation-timing.md](simulation-timing.md)
- [session-definition.md](session-definition.md)
- [testing.md](testing.md)
- [logging.md](logging.md)
- [content-authoring.md](content-authoring.md)
