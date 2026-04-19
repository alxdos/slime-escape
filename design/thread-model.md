# Thread Model

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-19

## Context

Игра должна работать в вебе, не блокировать UI и рендер, и при этом стремиться к плавному отображению на `90-120 Hz` экранах. Одновременно требуется надёжный путь для `mobile Safari`, где нельзя строить архитектуру вокруг единственного worker-render режима.

## Decision

- `main thread` отвечает за:
  - браузерный lifecycle;
  - ввод игрока;
  - HUD, меню и прочий DOM/UI;
  - аудио;
  - feature detection;
  - запуск и остановку worker-ов.
- `simulation worker` является authoritative-источником игрового состояния.
- В `simulation worker` живут:
  - фиксированный simulation tick;
  - AI;
  - спавн;
  - урон и смерть;
  - коллизии;
  - переходы между encounter-ами;
  - логика босса;
  - генерация снапшотов для рендера.
- Рендер должен поддерживать два backend-режима:
  - совместимый режим: `three.js` в `main thread`;
  - ускоренный режим: `three.js` в отдельном render worker через `OffscreenCanvas`, только где это стабильно поддерживается.
- Рендер не принимает gameplay-решения и не изменяет authoritative state.
- Связь между `main thread` и `simulation worker` строить на командах и снапшотах:
  - `main -> sim`: input commands, pause/resume, start session, debug commands;
  - `sim -> main/render`: state snapshots, runtime events, telemetry.
- Симуляция должна идти на фиксированном тике, рендер - на независимом кадре с интерполяцией между последними снапшотами.
- Межпоточное API проектировать так, чтобы render backend можно было сменить без переписывания симуляции.

## Consequences

- Долгая логика и всплески AI не должны напрямую блокировать UI и ввод.
- Появляется fallback-путь для браузеров без надёжного `OffscreenCanvas` pipeline.
- Рендер и симуляция можно оптимизировать независимо.
- Нужно заранее определить компактный формат снапшотов и явный протокол сообщений между потоками.

## Related

- [session-definition.md](session-definition.md)
- [runtime-systems.md](runtime-systems.md)
- [content-boundaries.md](content-boundaries.md)
