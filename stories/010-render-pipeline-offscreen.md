# Render Pipeline: OffscreenCanvas

- Status: deferred
- Created: 2026-04-19
- Updated: 2026-04-22

## Player-facing

- Sees: визуально та же картинка, что и до этой истории; на поддерживаемых браузерах рендер ощутимо плавнее и стабильнее под нагрузкой.
- Can do: играть на поддерживаемых браузерах с лучшей плавностью без действий с его стороны; на неподдерживаемых получает корректный fallback на режим из `001`. Выбранное в `009` разрешение продолжает работать в обоих режимах.

## Technical

- История отложена до появления подтверждённой проблемы производительности в текущем main-thread render pipeline.
- Render worker на базе `OffscreenCanvas` для поддерживаемых браузеров.
- Переключение render backend (`main` / `offscreen`) без переписывания симуляции.
- Fallback на main-thread рендер из `001` при отсутствии надёжной поддержки `OffscreenCanvas`.
- Проброс render scale policy из `009` в render worker.
- Измерение FPS / ms-per-frame в обоих режимах для подтверждения выигрыша и записи в acceptance.
- Корректная остановка/перезапуск render worker при смене разрешения и завершении сессии.

## Out of scope

- WebGPU backend.
- Перенос симуляции в shared memory / `SharedArrayBuffer`.
- Мобильные тач-контролы и адаптация UI.

## Acceptance

- Feature detection корректно выбирает offscreen или main backend без ошибок.
- На поддерживаемом браузере при нагрузке (большое число врагов/пуль) FPS / ms-per-frame в offscreen-режиме измеримо лучше, чем в main.
- На неподдерживаемом браузере игра запускается через fallback и визуально не отличается.
- Смена разрешения в `009` корректно работает в обоих backend.
- Симуляция (worker, протокол, снапшоты) не переписана: разница только в рендер-слое.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [ ] | Feature detection и абстракция render backend | |
| T2 | [ ] | Render worker через `OffscreenCanvas` | |
| T3 | [ ] | Проброс render scale из `009` в render worker | |
| T4 | [ ] | Замер FPS / frame-time и сравнение режимов | |

## Related

- [../design/thread-model.md](../design/thread-model.md)
- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../docs/SCOPE.md](../docs/SCOPE.md)
