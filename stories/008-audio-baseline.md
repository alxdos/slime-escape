# Audio Baseline

- Status: in-progress
- Created: 2026-04-19
- Updated: 2026-04-20

## Player-facing

- Sees: ничего нового визуально (опционально мелкий индикатор «звук активен» при первом взаимодействии).
- Can do: слышать выстрелы, попадания и смерти врагов; фоновую музыку во время боя; ambient «голоса» слаймов; UI-щелчки в меню/паузе/итоге; во время боя с боссом музыка сменяется на боссовую тему.

## Technical

- Аудио-стек живёт в `src/main/audio/**`, не импортирует `src/sim/**`. Контакт с симуляцией — через `SimWorkerHost.onEvent`/`snapshotPair` с фан-аутом из `UiShell`.
- Опорное решение — [../design/audio.md](../design/audio.md): один `AudioContext` с unlock на жесте, mixer `master + sfx/music/ui buses`, двухслойная громкость в реестре сэмплов (`normalizedGain` для коррекции файла, `defaultGain` для gameplay-роли), маппинги «архетип → sampleId» и «событие → sampleId» рядом с реестром (не в `src/shared/content/**`), music selector с переключением на boss-track по `encounter.type`, ambient слайм-голоса по снапшоту с presentation RNG.
- Триггеры на 008: `fire`, `hit`, `death`, `dropPickup`, `bossPhaseChange`, плюс UI-overlay show и menu-button click. Игрок-`hit`/`death` и win/loss звуки осознанно пропускаются (нет файлов).
- Music regularPool на 008: `100-waves`, `101-clock-ticking`, `001-calm`, `005-forest`, `007-nature`, `009-windy-forest`. Boss-track: `boss/boss-music`. Ducking music на pause × 0.5.
- Явные поправки громкости в реестре: `weapons/shotgun.mp3` → `normalizedGain ≈ 0.35`; voice-сэмплы слаймов → `defaultGain ≈ 0.3`.

## Out of scope

- Музыкальные слои и динамическая аранжировка (одна одновременная music-track + опциональный ambient-loop в будущем).
- 3D / spatial audio, falloff по дистанции (`perCallGainMul` оставлен как точка расширения, но в 008 не используется).
- UI настроек громкости и сохранение preferences — это задача [009-settings.md](009-settings.md); 008 готовит точки в графе (`master`/`sfx`/`music`/`ui`), но не делает UI и не сохраняет значения.
- Озвучка `dropSpawn`/`dropExpire`, `encounterStart`/`encounterEnd`, `win`/`loss`, спавна слайма — расширения [../design/audio.md](../design/audio.md), не часть 008.
- Расширение [../design/snapshot-shape.md](../design/snapshot-shape.md) ради аудио (новые runtime events под slime movement и т. п.) запрещено: ambient покрывается snapshot-driven слоем на стороне main.

## Acceptance

- При первом клике/жесте `AudioContext` переходит в `running` без ошибок; до анлока попытки воспроизведения no-op с одним warning.
- Выстрел игрока (любым WeaponArchetype с маппингом — на 008 как минимум `pistol`) проигрывает соответствующий fire-сэмпл.
- Попадание и смерть врага-слайма проигрывают соответствующие hit/death-сэмплы; `training-target` без маппинга — без звука и без падения.
- Подбор дропа проигрывает универсальный pickup-сэмпл.
- Смена фазы босса проигрывает `boss-ahaha`; в encounter босса в качестве музыки играет `boss/boss-music`, в остальных running/paused — случайный трек из regularPool.
- В меню и на экране результата музыка молчит. В паузе music ducked, ambient слаймов не дёргает таймеры, уже играющие one-shot доигрываются.
- Показ pause/result-overlay сопровождается UI-звуком `open-*`, клик любой кнопки меню/паузы/итога — `switch-*` (рандом из набора).
- При повторных стартах и завершениях сессии (`startSession`/`stopSession`/`win`/`loss`) аудио-граф не накапливает узлы и таймеры; `Audio` остаётся одним инстансом на жизнь приложения.
- Тесты `Audio` проходят без реального `AudioContext` через инжектируемый `AudioApi` mock и покрывают расчёт effective gain, валидацию реестра, роутинг событий, переключение music selector и поведение ambient в `paused`.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Зафиксировать решение [../design/audio.md](../design/audio.md), обновить `Index` в [../design/README.md](../design/README.md) | архитектурная задача |
| T2 | [x] | `src/main/audio/**`: `AudioContext` owner, mixer graph (`master` + `sfx`/`music`/`ui` buses), идемпотентный `unlock()` | базовый каркас |
| T3 | [x] | Sample registry с двухслойным gain (`normalizedGain`/`defaultGain`), валидация на init (дубль `id`, clamp диапазонов), lazy-decode mp3 через инжектируемый `AudioApi` | реестр и валидация |
| T4 | [x] | Маппинги `weapons` / `enemies` / `bosses` / `events`, поддержка `SampleSpec` как `id` или `id[]` (рандомный выбор), warning «маппинга нет → пропуск» один раз на уникальный ключ | отдельный модуль внутри `src/main/audio/**` |
| T5 | [x] | `Audio.handleEvent`: роутинг `fire`/`hit`/`death`/`dropPickup`/`bossPhaseChange` в sampleId через маппинги; для `hit`/`death` — резолв `archetypeId` цели по текущему снапшоту | one-shot SFX |
| T6 | [x] | Music selector: regularPool ([6 треков](../design/audio.md#music-selector)), boss-track, переключение по `phase` и `encounter.type`, ducking на `paused` | snapshot/phase-driven |
| T7 | [x] | Ambient слайм-голоса: per-entity таймеры по `snapshot.entities[kind === 'enemy']`, presentation RNG (`Math.random`), пауза таймеров в `paused` | snapshot-driven |
| T8 | [x] | Wire в `UiShell`: создание `Audio` рядом с `Hud`, фан-аут `onEvent` в `audio.handleEvent`, `audio.update` в `onFrame` после `hud.update`, `attach`/`detach` на старте/завершении сессии, `audio.unlock()` на первом user-gesture, `audio.playUi('overlayShow')` на показе pause/result, `audio.playUi('buttonClick')` в кнопках overlay-ев | оркестрация |
| T9 | [ ] | Тесты `Audio` без реального `AudioContext` через `AudioApi` mock: effective gain, валидация реестра, роутинг событий и `targetKind`-ветки, переключение music selector по фазам/encounter, отсутствие тиков ambient в `paused`, drop-oldest при > 32 одновременных one-shot | testing |

## Related

- [../design/audio.md](../design/audio.md)
- [../design/thread-model.md](../design/thread-model.md)
- [../design/main-ui-shell.md](../design/main-ui-shell.md)
- [../design/snapshot-shape.md](../design/snapshot-shape.md)
- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/content-archetypes.md](../design/content-archetypes.md)
- [../design/session-definition.md](../design/session-definition.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/rng.md](../design/rng.md)
- [../design/logging.md](../design/logging.md)
- [../design/testing.md](../design/testing.md)
- [../docs/VISION.md](../docs/VISION.md)
