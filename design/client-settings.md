# Client Settings

- Status: accepted
- Created: 2026-04-20
- Updated: 2026-04-20

## Context

[content-boundaries.md](content-boundaries.md) уже разделил данные на четыре уровня и поместил «громкость», «quality/render-scale policy» и UI-level preferences в `client settings`, явно зафиксировав, что они **не** часть `SessionDefinition`, **не** влияют на authoritative state и не меняют исход run с тем же `seed`. [thread-model.md](thread-model.md) фиксирует, что DOM/UI/audio/render живут в `main thread`. [audio.md](audio.md) уже описал master/per-bus gain как узлы графа и явно назвал 009 точкой, которая «крутит и сохраняет» эти значения, не вводя собственного контракта громкости. [arena-and-coordinates.md](arena-and-coordinates.md) фиксирует инвариант «без преимущества от железа»: размер окна, DPR и render scale из 009 влияют только на пиксельную плотность, **не** на видимую арену, спавн или баланс.

Что **не** зафиксировано до сих пор:

- Где физически живёт client settings store, его форма и форма `localStorage`-снимка.
- Кто его создаёт, кто читает, кто записывает.
- Как меняющиеся настройки доходят до подписчиков (Audio, Renderer) **на лету**, без перезапуска сессии.
- Как обрабатываются битые/устаревшие данные в `localStorage` (миграции, валидация, дефолты).
- Какие конкретные поля живут в client settings на горизонт 009.

Без этого решения 008 уже бы зафиксировал «магическую» точку громкости в коде, а 009 закрепил бы persistent storage «по месту» внутри overlay-я настроек. То же самое для render scale и для всех будущих presentation-настроек (доступность, чувствительность мыши, опции UI).

Решение фиксирует общий контракт client settings store на горизонт MVP. Оно **не** добавляет новых полей сверх тех, что нужны 009, и **не** покрывает per-bus громкость, rebinding и локализацию (см. [../stories/009-settings.md](../stories/009-settings.md), `Out of scope`).

## Decision

### Размещение

- Client settings store живёт под `src/main/settings/**`. Новых корневых каталогов проект не получает (см. [web-stack.md](web-stack.md)).
- Никакой модуль `src/main/settings/**` не имеет права импортировать из `src/sim/**` или из `src/shared/content/**`. Settings — presentation-данные main: они никогда не уходят в `SessionDefinition`, не сериализуются как контракт сессии, не участвуют в формировании snapshot/runtime events. Это прямое следствие [content-boundaries.md](content-boundaries.md).
- `src/sim/**` и `src/shared/**` **не** имеют права импортировать из `src/main/settings/**`. Если симу понадобится «настраиваемая» величина — это контентный параметр, и он живёт в `src/shared/content/**`, не в client settings.
- Реестр самих полей и их типов живёт в одном файле `src/main/settings/**` (фактическое имя — деталь реализации). Расширение реестра — добавление поля в этот файл и обновление этого решения; вводить «свой кусочек persistent storage» в коде overlay-ев или систем запрещено.

### Поля client settings на горизонт 009

На MVP в client settings ровно два поля:

```ts
type RenderScalePreset = 'low' | 'medium' | 'high';

type ClientSettings = Readonly<{
  masterVolume: number;            // [0, 1], где 0 — полная тишина, 1 — без аттенюации
  renderScalePreset: RenderScalePreset;
}>;
```

- `masterVolume` множит master gain аудио-графа ([audio.md](audio.md)). Значения вне диапазона `[0, 1]` clamped к границам перед применением и логируются как warning через единый log-модуль ([logging.md](logging.md)).
- `renderScalePreset` — единственная ось, по которой 009 управляет рендером. Семантика пресетов и переинициализация render target принадлежат [render-scale.md](render-scale.md); этот файл фиксирует только то, что значение хранится здесь и приходит к рендеру через этот же subscriber-механизм.
- Расширение поля (например, `sfxVolume`, `musicVolume`, отдельная чувствительность прицела) — отдельное решение, обновление этого файла, синхронное обновление [audio.md](audio.md)/[render-scale.md](render-scale.md) при необходимости. По месту в overlay-е настроек или в коде систем — запрещено.

### Дефолты

```ts
const DEFAULT_CLIENT_SETTINGS: ClientSettings = {
  masterVolume: 1,
  renderScalePreset: 'medium'
};
```

- `masterVolume = 1` совпадает с baseline аудио-графа из [audio.md](audio.md) (`master`/`bus` стартуют с `1.0`); без сохранённых данных игрок слышит ровно то, что был слышен в 008.
- `renderScalePreset = 'medium'` соответствует «один пиксель canvas = один пиксель браузера, `devicePixelRatio` игнорируется» ([../stories/009-settings.md](../stories/009-settings.md)). Это разумный нейтральный дефолт: не пикселизует картинку и не нагружает retina-устройства полным DPR.
- Дефолты применяются и при **первом** запуске (нет ключа в `localStorage`), и при **любой** ошибке чтения/валидации — см. ниже.

### Persistence: формат и миграции

- Persistence — `localStorage`. Для MVP этого достаточно: один пользователь на устройство, никакой синхронизации между устройствами; sandbox/iframe-сценариев в 009 не вводится.
- Один ключ `localStorage` хранит весь снимок client settings, JSON-сериализованный:
  ```
  key: 'slime-escape:client-settings'
  value: JSON.stringify({ schemaVersion: 1, masterVolume, renderScalePreset })
  ```
- Поле `schemaVersion` **обязательно**. Текущая версия — `1`.
- Алгоритм чтения при старте приложения:
  1. Прочитать строку по ключу. `null` или `localStorage` недоступен (Safari private mode и т.п.) → использовать `DEFAULT_CLIENT_SETTINGS`, **не** записывать ничего обратно (без записи store работает, persistence просто отключен).
  2. Распарсить JSON. Ошибка парсинга → warning в log, использовать дефолты, **перезаписать** ключ дефолтным снимком (битые данные не должны висеть бесконечно).
  3. Прочитать `schemaVersion`. Если `schemaVersion === 1` — провалидировать поля (см. ниже).
  4. Если `schemaVersion` неизвестен (новее или произвольный) → warning, использовать дефолты, перезаписать ключ дефолтным снимком. Это правило симметрично «неизвестный архетипный id — ошибка/перезапись», но без падения старта приложения: client settings не должны блокировать игру.
  5. Будущие миграции (`schemaVersion: 1 → 2` и т.п.) — отдельные таблицы преобразования в этом же файле; не добавлять до появления реальной потребности.
- Алгоритм валидации каждого поля:
  - `masterVolume` — число в `[0, 1]`. Не число / NaN / вне диапазона → clamp в `[0, 1]` для числа, иначе дефолт; warning в log.
  - `renderScalePreset` — одно из `'low' | 'medium' | 'high'`. Иное → дефолт; warning в log.
  - Лишние поля игнорируются молча (forward-compat для будущих расширений).
  - Отсутствующие поля заменяются дефолтами без warning (это «частично заполненный снимок», нормальный кейс при добавлении нового поля в существующую установку).
- Запись в `localStorage` — **синхронная** при каждом изменении через store. Это допустимо: изменения настроек редкие (drag слайдера громкости — десятки записей в секунду в худшем случае), и `JSON.stringify` крошечного объекта дешевле, чем городить debouncing с правилами потери последнего значения. Если когда-нибудь это станет узким местом — отдельное решение, не «по месту».
- Ошибка записи в `localStorage` (квота, отказ браузера) — warning в log, store продолжает работать в памяти; следующая успешная запись восстановит persistence.

### Store API

- Store создаётся ровно один раз при старте `UiShell` (рядом с `Audio`, `SimWorkerHost`, `Hud`). Повторная инициализация в MVP не предусмотрена.
- Минимальный API:
  ```ts
  type ClientSettingsStore = Readonly<{
    get(): ClientSettings;
    setMasterVolume(value: number): void;
    setRenderScalePreset(preset: RenderScalePreset): void;
    subscribe(listener: (settings: ClientSettings) => void): () => void;
    dispose(): void;
  }>;
  ```
- `get()` всегда возвращает уже валидный, clamped/нормализованный снимок — потребители не повторяют валидацию.
- `setMasterVolume`/`setRenderScalePreset`:
  - clamp/валидируют вход;
  - если значение **не** изменилось семантически (после clamp равно текущему) — **no-op**, listener-ы не вызываются и в `localStorage` ничего не пишется. Это критично для UX «слайдер по DPI генерит много событий с одинаковым результатом» и для render scale (повторное применение того же пресета не должно гонять renderer init).
  - если изменилось — обновляют in-memory, синхронно пишут весь снимок в `localStorage`, синхронно вызывают всех подписчиков.
- `subscribe(listener)` возвращает функцию отписки. Listener-ы вызываются **синхронно** в порядке регистрации. Это даёт детерминированный порядок «сначала Audio применил гейн, затем Renderer пересобрал target», когда оба слушают один store.
- `dispose()` снимает всех подписчиков и больше не пишет в `localStorage`. Используется в `UiShell.dispose()`.

Store **не** использует `window.addEventListener('storage', ...)`: межвкладочная синхронизация не нужна для MVP и привнесла бы нетривиальный edge case (перезапись настроек в фокусированной вкладке во время drag-а слайдера). Если она когда-нибудь понадобится, это отдельное решение.

### Применение настроек к Audio и Renderer

- Единственный legitimate путь от player UI до подписчиков — через store. Никакие компоненты UI не имеют права напрямую дергать `Audio.setMasterGain` или `Renderer.applyScalePolicy`; они изменяют значение в store, store оповещает подписчиков.
- `UiShell` — единственный owner подписок:
  - подписывает `Audio` на изменения `masterVolume`: `audio.setMasterGain(settings.masterVolume)` ([audio.md](audio.md));
  - подписывает `Renderer` на изменения `renderScalePreset`: `renderer.applyScalePolicy(...)` ([render-scale.md](render-scale.md));
  - на старте применяет текущие значения один раз, чтобы Audio и (если он есть) Renderer стартовали уже в выбранной конфигурации.
- Renderer в фазе `menu` ещё **не** существует (см. [main-ui-shell.md](main-ui-shell.md), раздел «Жизненный цикл рендера и input в рамках фаз»): он создаётся при `menu → running`. Поэтому подписка Renderer-а на store оформляется как «применить текущее значение при создании + подписаться + отписаться при `dispose()`». Это значит, что менять `renderScalePreset` в фазе `menu` корректно: store сохраняет значение, ближайший новый Renderer его прочитает; никаких отдельных «отложенных применений» не нужно.
- Audio существует на всю жизнь приложения, поэтому подписка Audio активна всегда. Изменение `masterVolume` в `menu`/`paused`/`result` принимается тем же путём.

### Boundaries и инварианты

- Client settings **никогда** не попадают в `SessionDefinition`. Builder в `src/shared/content/**` ничего не знает о client settings. Это закрепляет «builder читает content library и опции, на выходе — `SessionDefinition`» из [content-boundaries.md](content-boundaries.md): пользовательские опции — это `BuildOptions`, не presentation-настройки.
- Client settings **никогда** не попадают в snapshot или runtime events. `src/sim/**` остаётся headless относительно того, как игрок настроил клиент.
- Изменение `masterVolume` или `renderScalePreset` **никогда** не должно менять исход run с тем же `seed`. Это уже зафиксировано в [content-boundaries.md](content-boundaries.md) и здесь конкретизируется: ни одно поле, добавляемое в client settings в будущем, не имеет права нарушить этот инвариант.
- Единственный место правды о текущем значении — store; читать прямо из `localStorage` где-либо, кроме самого store, запрещено.

### Тесты

- Store тестируется без реального `localStorage`: вводится узкий `StorageApi` (минимум `getItem`/`setItem`/`removeItem`), который в тестах подменяется fake-реализацией. Это уже устоявшийся паттерн под `AudioApi`.
- Под тестом обязательно:
  - чтение пустого/отсутствующего ключа → дефолты, без записи;
  - чтение битого JSON → warning, дефолты, перезапись ключа;
  - чтение неизвестного `schemaVersion` → warning, дефолты, перезапись;
  - чтение валидного снимка с одним недопустимым полем → clamp/дефолт по этому полю, остальные сохранены;
  - `setMasterVolume(0.5)` → listener вызван один раз с новым значением; повторный `setMasterVolume(0.5)` → listener **не** вызван;
  - clamp `setMasterVolume(2)` → итоговое значение `1`, в snapshot и `localStorage` лежит `1`;
  - неизвестный `setRenderScalePreset(value as any)` (TypeScript pass-through) → no-op + warning;
  - порядок вызова listener-ов = порядку регистрации;
  - `dispose()` → последующие `set*` всё равно clamp/валидируют, но listener-ы не дёргаются и `localStorage` не пишется;
  - `setItem` бросает (квота) → warning, но in-memory снимок и listener-ы отрабатывают штатно.
- Регрессий [audio.md](audio.md) и [render-scale.md](render-scale.md) тестами не вводится: store стоит «выше» этих контрактов и вызывает их публичный API.

## Consequences

- 009 получает готовую площадку для UI настроек: overlay меняет значения через `store.set*`, дальше всё расходится по подписчикам автоматически.
- Audio и Renderer не растят persistence-логику внутри себя — они принимают текущие значения через явный API и через подписку. Тестирование Audio/Renderer не зависит от `localStorage`.
- Появляется единая ось для будущих presentation-настроек (доступность, чувствительность прицела, опции UI): добавление поля = правка одного файла в `src/main/settings/**` + миграция (если меняется форма) + регистрация подписчика.
- Persistence-формат под версией с `schemaVersion`: повторная установка игры не ломает данные предыдущей версии, а явная миграция оформляется как часть этого решения.
- Цена: для каждого нового поля нужно держать дефолт, валидацию и (при необходимости) миграцию. Это сознательный налог за то, чтобы settings не превращались в свалку «положили строку в localStorage и забыли».
- Решение явно отказывает в межвкладочной синхронизации, в отдельных `volume`-шинах внутри 009 и в `BuildOptions`-эффектах настроек. Это сужает 009 до зафиксированного scope; расширение каждого пункта — отдельное решение.

## Related

- [content-boundaries.md](content-boundaries.md)
- [audio.md](audio.md)
- [render-scale.md](render-scale.md)
- [main-ui-shell.md](main-ui-shell.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [thread-model.md](thread-model.md)
- [web-stack.md](web-stack.md)
- [logging.md](logging.md)
- [testing.md](testing.md)
- [../stories/009-settings.md](../stories/009-settings.md)
