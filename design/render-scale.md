# Render Scale

- Status: accepted
- Created: 2026-04-20
- Updated: 2026-04-20

## Context

[arena-and-coordinates.md](arena-and-coordinates.md) фиксирует инвариант «без преимущества от железа»: видимая часть арены, FOV, спавн, радиус тёмной зоны и скорость движения **не зависят** от размера окна, DPR и render scale из 009. Размер и DPR окна влияют только на пиксельную плотность изображения. Само вписывание арены в viewport уже зафиксировано там же (letterbox/pillarbox через CSS, контейнер canvas получает aspect-ratio арены, чёрные полосы — пустое тело страницы). [thread-model.md](thread-model.md) фиксирует, что рендер — отдельный слой `main thread`-а, поддерживающий два backend-режима (main-thread и offscreen render worker), и что смена backend не должна менять контракт `simulation worker`. [client-settings.md](client-settings.md) ввёл `renderScalePreset: 'low' | 'medium' | 'high'` в client settings и subscriber-механизм; что **именно** делает каждый пресет с canvas — этим решением.

Что **не** зафиксировано до сих пор:

- Конкретная семантика пресетов `low`/`medium`/`high` в терминах «backing pixels canvas», «CSS-размер canvas», `image-rendering`.
- Где живёт policy (модуль, чистая функция от пресета и viewport → конкретные значения).
- Кто и как переинициализирует render target при смене пресета без перезапуска сессии.
- Какие инварианты обязаны соблюдаться при любом пресете (gameplay, прицел, fit).
- Как 010 (offscreen render worker) переиспользует тот же контракт.

Без явного контракта 009 закрепил бы правила пресетов внутри `Renderer`, 010 переоткрыл бы их «в worker-версии», а инвариант «без преимущества от железа» легко поломался бы любым неосторожным изменением (например, привязкой видимой области камеры к `canvas.width`).

Решение фиксирует render scale policy как отдельный концепт между client settings и render backend-ом.

## Decision

### Размещение

- Render scale policy и его применение живут под `src/main/render/**` (см. [web-stack.md](web-stack.md)). Новых корневых каталогов проект не получает.
- Никакой модуль `src/main/render/**` не имеет права импортировать из `src/main/settings/**`. Поток обратный: `UiShell` подписывает `Renderer` на `ClientSettingsStore` ([client-settings.md](client-settings.md)) и пробрасывает в `Renderer` уже вычисленную policy через явный API. Это сохраняет правило «render не знает про player UI» из [main-ui-shell.md](main-ui-shell.md).
- Чистая функция «пресет + viewport + fit → render target params» живёт рядом с `fitCanvasToViewport` (см. `src/main/render/**`); фактическое имя файла — деталь реализации, контракт — функция чистая, без сайд-эффектов и без обращения к `window`.

### Семантика пресетов

Пресеты задают **только** пиксельную плотность изображения. Логические размеры canvas, его CSS-размер по обеим осям и aspect-ratio задаются [arena-and-coordinates.md](arena-and-coordinates.md) и `fitCanvasToViewport`; пресет влияет на:

- `pixelRatio`, который передаётся в `WebGLRenderer.setPixelRatio` (т.е. фактическое число backing pixels на CSS-пиксель);
- значение CSS-свойства `image-rendering` для самого `<canvas>`.

Пусть `cssWidthPx` и `cssHeightPx` — размеры canvas в CSS-пикселях, уже вписанные в viewport через `fitCanvasToViewport` (см. [arena-and-coordinates.md](arena-and-coordinates.md)); `dpr` — `window.devicePixelRatio` (с верхней границей `2`, как сейчас в `src/main/index.ts`).

| Preset | Backing-pixels canvas | CSS-размер canvas | `image-rendering` | Пояснение |
|--------|------------------------|-------------------|--------------------|-----------|
| `low`    | `canvas.width = round(cssWidthPx / 4)`, `canvas.height = round(cssHeightPx / 4)` (минимум `1`); `setPixelRatio(1)` | `cssWidthPx × cssHeightPx` (без изменений) | `pixelated` | Самый дешёвый режим: меньше пикселей под рендер, браузер растягивает картинку без сглаживания. |
| `medium` | `cssWidthPx × cssHeightPx`, `setPixelRatio(1)` | `cssWidthPx × cssHeightPx` | `auto` (или не задаётся) | «Один пиксель canvas = один пиксель браузера», `devicePixelRatio` игнорируется. Нейтральный дефолт. |
| `high`   | `cssWidthPx × cssHeightPx`, `setPixelRatio(dpr)` | `cssWidthPx × cssHeightPx` | `auto` (или не задаётся) | Полноценный retina-рендер: backing-pixels = CSS-пиксели × DPR. |

Семантика пресетов выражена как чистая функция:

```ts
type RenderScalePreset = 'low' | 'medium' | 'high';

type RenderScaleResolution = Readonly<{
  cssWidthPx: number;       // ширина canvas в CSS-пикселях (от fitCanvasToViewport)
  cssHeightPx: number;      // высота canvas в CSS-пикселях (от fitCanvasToViewport)
  backingWidthPx: number;   // canvas.width после применения пресета
  backingHeightPx: number;  // canvas.height после применения пресета
  pixelRatio: number;       // аргумент WebGLRenderer.setPixelRatio
  imageRendering: 'auto' | 'pixelated';
}>;

function resolveRenderScale(input: Readonly<{
  preset: RenderScalePreset;
  cssWidthPx: number;
  cssHeightPx: number;
  devicePixelRatio: number;
}>): RenderScaleResolution;
```

Конкретные пороги (`/4` для `low`, `min(devicePixelRatio, 2)` для `high`) живут в этой функции, а не в `Renderer` или в overlay-е настроек. Любая корректировка значений = правка этого решения и `resolveRenderScale`.

### Инварианты, общие для всех пресетов

- Видимая часть арены **не меняется** между пресетами. Камера ортографическая, её frustum задан `arena.width × arena.height` ([arena-and-coordinates.md](arena-and-coordinates.md)); ни один пресет не меняет frustum.
- CSS-размер canvas, его aspect-ratio и letterbox/pillarbox-полосы **не меняются** между пресетами. Пресет влияет только на backing-pixels и на `image-rendering`.
- Маппинг указателя в мировые координаты опирается на CSS-размеры canvas (`clientHeight`/`clientWidth`), не на backing-pixels. Сейчас это видно по `pixelsPerWorldUnit: () => init.canvas.clientHeight / session.arena.height` в `UiShell`. Любая попытка читать `canvas.width`/`canvas.height` для расчёта прицела — нарушение этого решения.
- `fitCanvasToViewport` остаётся единственным источником CSS-размера canvas; render scale работает «после» него и не пересчитывает aspect/letterbox.
- Никакая gameplay-система ни в `src/sim/**`, ни в `src/shared/content/**` не имеет права читать `canvas.width`/`canvas.height`/`devicePixelRatio`/`renderScalePreset`. Render scale — чисто presentation-настройка.
- Изменение пресета **не** должно менять исход run с тем же `seed` (тот же инвариант, что и для всех client settings, см. [client-settings.md](client-settings.md), [content-boundaries.md](content-boundaries.md)).

### Жизненный цикл и API `Renderer`

- `Renderer` создаётся `UiShell` при `menu → running` и уничтожается при выходе из `running`/`paused` ([main-ui-shell.md](main-ui-shell.md)). На время своей жизни он — единственный owner свойств canvas, влияющих на пиксели:
  - `canvas.width` / `canvas.height` (backing pixels);
  - `canvas.style.width` / `canvas.style.height` (CSS-размеры);
  - `canvas.style.imageRendering`;
  - `WebGLRenderer.setPixelRatio` / `WebGLRenderer.setSize`.
- `Renderer` принимает текущий `RenderScalePreset` через `RendererInit` (заменяет/расширяет существующее поле `pixelRatio`), и поддерживает явный метод изменения на лету:
  ```ts
  type Renderer = Readonly<{
    render(): void;
    fitToWindow(): void;
    applyScalePolicy(preset: RenderScalePreset): void;
    dispose(): void;
  }>;
  ```
- `applyScalePolicy(preset)` обязан:
  1. Вычислить `RenderScaleResolution` через `resolveRenderScale`, опираясь на текущие CSS-размеры canvas (которые уже корректно вписаны через `fitCanvasToViewport`) и текущее `devicePixelRatio`.
  2. Применить `imageRendering` к `canvas.style`.
  3. Вызвать `WebGLRenderer.setPixelRatio(pixelRatio)`.
  4. Вызвать `WebGLRenderer.setSize(cssWidthPx, cssHeightPx, false)` (третий аргумент `false` сохраняет CSS-размеры неизменными — это критично для инварианта «CSS-размер canvas не меняется между пресетами»).
- `fitToWindow` после смены viewport также применяет текущий пресет (повторно вычисляет `RenderScaleResolution` от новых CSS-размеров и обновляет backing). Это даёт инвариант «после любого resize backing-плотность остаётся согласована с активным пресетом».
- Никакой полной пересборки `THREE.Scene`, мешей сущностей или шейдеров `applyScalePolicy` **не** требует. Web Audio-style «переинициализация target» здесь означает ровно «переразмерить backing canvas и пере-разметить pixel ratio на том же `WebGLRenderer`», что `WebGLRenderer.setPixelRatio` + `setSize` делают штатно. Сцена и uniform-ы (включая `uHalfSize` оверлея зоны) не зависят от backing-pixels и пересчёта не требуют.
- `applyScalePolicy(preset)` идемпотентен: повторный вызов с тем же пресетом и теми же CSS-размерами выполняет ту же последовательность шагов и не создаёт визуального артефакта. Дополнительно `ClientSettingsStore` уже не вызывает listener-а при «значение не изменилось» ([client-settings.md](client-settings.md)), так что повторных вызовов от store не будет, но `fitToWindow` имеет право дёргать применение каждый resize.

### Дефолт и старт

- При первом `menu → running` `Renderer` строится со значением `renderScalePreset` из `ClientSettingsStore.get()`. Если стора нет (тесты), `Renderer` принимает явно переданный пресет; зашитого в `Renderer` дефолта нет — единственный источник дефолта `'medium'` живёт в [client-settings.md](client-settings.md).
- Подписку `ClientSettingsStore.subscribe` на изменение `renderScalePreset` оформляет `UiShell`. На стороне `Renderer` подписки нет: `Renderer` headless относительно `ClientSettingsStore` и тестируется без него.
- В фазе `menu` `Renderer` не существует, и применять policy некуда. Это нормально: при создании следующего Renderer-а будет использован уже актуальный пресет из store. Никаких «отложенных применений» вне `Renderer` хранить не нужно.

### Совместимость с 010 (offscreen render worker)

- Контракт `Renderer` (`render`/`fitToWindow`/`applyScalePolicy`/`dispose`) не зависит от того, где физически идёт `three.js`: в `main thread` или в render worker через `OffscreenCanvas`.
- В offscreen-варианте `applyScalePolicy(preset)` пробрасывается в render worker сообщением; worker сам вызывает аналогичные `setPixelRatio` / `setSize` уже на стороне `OffscreenCanvas`. CSS-свойства (`style.width`/`style.height`/`style.imageRendering`) применяются на main, потому что DOM остаётся в main ([thread-model.md](thread-model.md)).
- `resolveRenderScale` остаётся чистой функцией в `src/main/render/**` и переиспользуется обоими backend-ами. 010 не вводит свою копию.
- Смена пресета в offscreen-варианте не требует пересоздания render worker. Если конкретный браузер всё-таки требует пересоздания `OffscreenCanvas` для смены backing-size — это будет конкретизировано внутри 010 как деталь реализации backend-а, не контракт policy.

### Тесты

- `resolveRenderScale` тестируется как чистая функция:
  - `low` при `cssWidthPx=800, cssHeightPx=600, dpr=2` → `backing=200×150`, `pixelRatio=1`, `imageRendering='pixelated'`;
  - `medium` при том же входе → `backing=800×600`, `pixelRatio=1`, `imageRendering='auto'`;
  - `high` при том же входе → `backing=800×600`, `pixelRatio=2`, `imageRendering='auto'`;
  - вырожденные `cssWidthPx ≤ 0` → backing-минимум `1×1`, без падения (симметрично текущему `fitCanvasToViewport`, который возвращает `0×0` и не падает).
- `Renderer.applyScalePolicy(preset)` тестируется без реального WebGL/DOM: `THREE.WebGLRenderer` обёрнут узким API в тестах, как уже сделано для аудио и input. Под тестом обязательно:
  - `setPixelRatio` вызван с `1` для `low` и `medium`, с `min(dpr, 2)` для `high`;
  - `setSize(cssW, cssH, false)` вызван (третий аргумент `false`);
  - `canvas.style.imageRendering = 'pixelated'` для `low`, `'auto'`/пусто для остальных;
  - `applyScalePolicy(samePreset)` повторно — даёт тот же визуальный итог (идемпотентность);
  - `fitToWindow` после resize применяет текущий пресет (вызовы `setPixelRatio`/`setSize` в правильном порядке).
- Регрессий [arena-and-coordinates.md](arena-and-coordinates.md) тестами не вводится: видимая часть арены и `fitCanvasToViewport` не меняются.

## Consequences

- 009 получает компактный контракт: «overlay настроек меняет `renderScalePreset` в store; `Renderer` принимает пресет через `applyScalePolicy`; `resolveRenderScale` — единственная точка правды о численных значениях».
- 010 (offscreen render worker) переиспользует тот же `applyScalePolicy` и ту же `resolveRenderScale`, не открывая параллельный контракт.
- Инвариант «без преимущества от железа» теперь имеет точку, где он проверяется тестами: ни один пресет не меняет frustum камеры, CSS-размеры canvas и mapping прицела.
- `Renderer` получает явный API `applyScalePolicy` вместо неявной зависимости от `pixelRatio` в init. Старый `pixelRatio: number` в `RendererInit` либо заменяется на `renderScalePreset: RenderScalePreset`, либо превращается в начальное значение, после которого настоящий источник правды — `applyScalePolicy`. Конкретный шаг — деталь реализации, контракт — единственный legitimate путь смены пресета.
- Цена: добавляется одна функция (`resolveRenderScale`) и один метод на `Renderer` (`applyScalePolicy`). Расширение списка пресетов или их семантики требует правки этого решения и `resolveRenderScale`, не «по месту» в overlay-е настроек.
- Решение явно отказывает от расщепления пресетов на отдельные оси («fxaa», «msaa», «постпроцессинг»). Они — расширения этого файла, не молчаливые добавления внутри `Renderer`.

## Related

- [arena-and-coordinates.md](arena-and-coordinates.md)
- [thread-model.md](thread-model.md)
- [main-ui-shell.md](main-ui-shell.md)
- [client-settings.md](client-settings.md)
- [web-stack.md](web-stack.md)
- [testing.md](testing.md)
- [../stories/009-settings.md](../stories/009-settings.md)
- [../stories/010-render-pipeline-offscreen.md](../stories/010-render-pipeline-offscreen.md)
