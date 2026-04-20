# Settings

- Status: in-progress
- Created: 2026-04-19
- Updated: 2026-04-20

## Player-facing

- Sees: экран настроек, доступный из меню и из паузы. Слайдер громкости и выбор разрешения арены: `low` / `medium` / `high`.
- Can do: менять громкость и разрешение на лету, видеть результат сразу; настройки сохраняются между запусками.

Семантика разрешения:

| Preset | Render scale |
|--------|--------------|
| low    | арена рендерится примерно в 1/4 пикселей по горизонтали и масштабируется на ширину экрана без сглаживания (`image-rendering: pixelated`); самый дешёвый режим |
| medium | один пиксель canvas = один пиксель браузера; `devicePixelRatio` игнорируется |
| high   | рендер 1:1 с учётом `devicePixelRatio` (retina-friendly) |

## Technical

- `ClientSettingsStore` под `src/main/settings/**`: поля `masterVolume` и `renderScalePreset`, `localStorage` со `schemaVersion`, валидация/clamp/миграции, subscriber-модель — контракт в [../design/client-settings.md](../design/client-settings.md).
- Громкость кнопит master gain аудио-графа через явный `Audio.setMasterGain` — расширение API в [../design/audio.md](../design/audio.md) (раздел «Settings integration (009)»). Per-bus громкость `sfx`/`music`/`ui` в 009 явно out of scope.
- Render scale policy в `src/main/render/**`: чистая `resolveRenderScale(preset, cssSize, dpr)` и `Renderer.applyScalePolicy(preset)` для переинициализации render target без перезапуска сессии — контракт в [../design/render-scale.md](../design/render-scale.md). Инвариант «без преимущества от железа» из [../design/arena-and-coordinates.md](../design/arena-and-coordinates.md) сохранён: пресет влияет только на пиксельную плотность.
- Settings overlay как sub-modal `UiShell`, доступный из `MenuOverlay` и из `PauseOverlay`, не меняет фазу `UiShell` — раздел «Settings overlay» в [../design/main-ui-shell.md](../design/main-ui-shell.md). Подписка `Audio` и `Renderer` на store оформляется на стороне `UiShell`, единственного оркестратора.
- `client settings` не утекает в `SessionDefinition`/snapshot/runtime events — это прямое следствие [../design/content-boundaries.md](../design/content-boundaries.md) и зафиксировано в [../design/client-settings.md](../design/client-settings.md).

## Out of scope

- Управление и rebinding клавиш.
- Языки и локализация.
- Отдельные шины sfx/music/ambient — пока хватает master gain.
- Межвкладочная синхронизация настроек (`window 'storage'`-event).

## Acceptance

- Настройки доступны из меню и из паузы, изменения применяются сразу.
- Громкость влияет на все игровые звуки.
- Каждый из трёх пресетов разрешения визуально и по нагрузке отличается ожидаемо: `low` — заметно пикселизованнее и быстрее, `medium` — нативные пиксели, `high` — резкая картинка на retina.
- Выбранные значения сохраняются между перезагрузками страницы.
- Дефолтный пресет разрешения подбирается разумно (например `medium`).

## Tasks

Полная декомпозиция (история в `in-progress`). Порядок задач отражает зависимости: опорные изменения в `Audio`/`Renderer` — раньше, store — следом, проводка в `UiShell` — затем, UI-overlay и точки входа — последними. Все опорные правки в `design/` уже сделаны на этапе подготовки, поэтому среди задач они не повторяются.

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | В `src/main/audio/Audio.ts` декомпозировать `effectiveGain` по узлам графа: `perSourceTrim.gain.value = sample.normalizedGain * sample.defaultGain * (perCallGainMul ?? 1)`; bus и master остаются полноценными узлами в графе. Обновить тесты `Audio.test.ts` (`calculateEffectiveGain` и трейсинг назначений по узлам) | Прерывает существующее двойное применение `bus*master`. По [../design/audio.md](../design/audio.md), разделы «Mixer graph» и «Двухслойная громкость». Не меняет аудио на baseline (`bus`/`master` стартуют с `1.0`). |
| T2 | [x] | Добавить `Audio.setMasterGain(value: number): void` в `src/main/audio/Audio.ts` и в публичный тип `Audio`: clamp `[0, 1]`, warning через `log` на out-of-range, no-op при равном значении, корректен в любом состоянии (до `unlock`, в `menu`/`paused`/`result`, до и после `attach`/`detach`). Тесты в `Audio.test.ts` | По [../design/audio.md](../design/audio.md), раздел «Settings integration (009)». Зависит от T1. |
| T3 | [x] | Чистая функция `resolveRenderScale` в `src/main/render/**` со всей таблицей пресетов из дизайна и тестами на каждый пресет (включая вырожденные `cssWidthPx ≤ 0`) | По [../design/render-scale.md](../design/render-scale.md), раздел «Семантика пресетов». Без правок `Renderer` — pure-функция. |
| T4 | [x] | Перевести `Renderer` с `pixelRatio: number` в `RendererInit` на `renderScalePreset: RenderScalePreset`; добавить `applyScalePolicy(preset)` (вызывает `setPixelRatio`/`setSize(_, _, false)` и обновляет `canvas.style.imageRendering`); `fitToWindow` повторно применяет текущий пресет. Обновить `src/main/index.ts` (передаёт начальный пресет вместо `Math.min(window.devicePixelRatio, 2)`) и `UiShell` (передаёт пресет при создании `Renderer`). Тесты в `Renderer`-suite через узкий API `WebGLRenderer`-подобной обёртки | По [../design/render-scale.md](../design/render-scale.md), раздел «Жизненный цикл и API `Renderer`». Зависит от T3. |
| T5 | [x] | Создать `src/main/settings/**` с `ClientSettingsStore`: типы `ClientSettings`/`RenderScalePreset`, `DEFAULT_CLIENT_SETTINGS` (`masterVolume = 1`, `renderScalePreset = 'medium'`), узкий `StorageApi` (`getItem`/`setItem`/`removeItem`) с browser-обёрткой и тест-fake; чтение/валидация/clamp/перезапись битого снимка по правилам дизайна; `setMasterVolume`/`setRenderScalePreset` (clamp + no-op при равном + синхронная запись + синхронные подписчики в порядке регистрации); `subscribe`/`dispose`. Тесты на все сценарии из раздела «Тесты» дизайна | По [../design/client-settings.md](../design/client-settings.md). Не зависит от T1–T4 (можно параллельно). |
| T6 | [x] | В `UiShell` создать `ClientSettingsStore` ровно один раз (рядом с `Audio`/`SimWorkerHost`/`Hud`); применить начальный `masterVolume` к `Audio` через `setMasterGain` и подписать `Audio` на изменения; в момент создания `Renderer` (`menu → running`) пробросить актуальный `renderScalePreset` в `RendererInit` и подписать `Renderer.applyScalePolicy` на изменения, отписать в `tearDownClientSession`; вызвать `store.dispose()` в `UiShell.dispose()`. Тесты в `UiShell.test.ts` | По [../design/client-settings.md](../design/client-settings.md), раздел «Применение настроек», и [../design/main-ui-shell.md](../design/main-ui-shell.md). Зависит от T2, T4, T5. |
| T7 | [x] | Реализовать `SettingsOverlay` в `src/main/ui/**`: слайдер `masterVolume → store.setMasterVolume`, селектор из трёх кнопок `low`/`medium`/`high → store.setRenderScalePreset`, кнопка «Закрыть». Overlay читает текущий снимок через `store.get()` и подписывается на изменения для синхронизации UI-состояния. Никаких прямых вызовов `Audio`/`Renderer`/`SimWorkerHost` из overlay-я. Тесты на разводку контролов, отписку при `dispose` | По [../design/main-ui-shell.md](../design/main-ui-shell.md), раздел «Settings overlay». Зависит от T5. |
| T8 | [x] | Точки входа и оркестрация: добавить кнопку «Настройки» в `MenuOverlay` и в `PauseOverlay`; в `UiShell` завести `openSettings()`/`closeSettings()`, которые показывают/прячут `SettingsOverlay` поверх текущей фазы (`menu` или `paused`), не меняют `UiShellPhase`, не трогают Pointer Lock и не дёргают `SimWorkerHost`; недоступно в `running`/`result`. На каждое нажатие («Настройки», «Закрыть» и кнопки внутри overlay-я) — `audio.playUi('buttonClick')`. Тесты в `UiShell.test.ts` (видимость по фазам, отсутствие фазового перехода, корректность z-order через DOM-проверку) | По [../design/main-ui-shell.md](../design/main-ui-shell.md), раздел «Settings overlay». Зависит от T7. |

## Related

- [../design/client-settings.md](../design/client-settings.md)
- [../design/render-scale.md](../design/render-scale.md)
- [../design/audio.md](../design/audio.md)
- [../design/main-ui-shell.md](../design/main-ui-shell.md)
- [../design/arena-and-coordinates.md](../design/arena-and-coordinates.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/thread-model.md](../design/thread-model.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/logging.md](../design/logging.md)
- [../docs/SCOPE.md](../docs/SCOPE.md)
