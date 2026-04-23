# Sprite Assets

- Status: accepted
- Created: 2026-04-23
- Updated: 2026-04-23

## Context

[arena-and-coordinates.md](arena-and-coordinates.md) фиксирует мир в world units (wu), запрещает gameplay-системам оперировать пикселями и закрепляет инвариант «без преимущества от железа»: видимая часть арены, FOV, спавн, скорости — не зависят от размера окна, DPR и render scale из 009. [render-scale.md](render-scale.md) разводит «policy backing-pixels» и «логические/css-размеры canvas» так, что пресет влияет только на пиксельную плотность. [content-archetypes.md](content-archetypes.md) фиксирует `EnemyArchetype.color`/`BossArchetype.color` как «плейсхолдер для рендера, контентное поле, не decision рендера», а [body-contact-boxes.md](body-contact-boxes.md) разводит visual sprite plane и gameplay body-contact для `player` / `enemy` / `boss`. [content-boundaries.md](content-boundaries.md) разводит `content library` и presentation. [main-ui-shell.md](main-ui-shell.md) фиксирует, что `Renderer` создаётся `UiShell` при `menu → running` и владеет canvas-пикселями. [content-authoring.md](content-authoring.md) задаёт правила пар `<area>.ts ↔ <area>.generated.ts` рядом с потребителем и атомарную генерацию.

Сегодня [src/main/render/Renderer.ts](../src/main/render/Renderer.ts) рисует `player`/`enemy`/`boss` цветными `THREE.CircleGeometry` с цветом из `EnemyArchetype.color`/`BossArchetype.color` и радиусом из соответствующего архетипа. Появление PNG-ассетов под `public/assets/**` (история 013) одновременно вводит:

- источник правды о том, **как** именно выглядит каждый archetype (картинка, её исходный размер в пикселях, world-размер в wu, точка крепления);
- правило конвертации «исходные пиксели спрайта → world units», иначе каждое будущее изменение арены или формата ассетов начнёт молча менять размер спрайтов на экране;
- запрет на silent-fallback на круги: ситуация «архетип есть, спрайт нет» должна падать на старте/в тесте, а не превращать арену в смесь PNG и кругов;
- набор готовых textures **до** меню, чтобы первое появление слайма не сопровождалось lazy-load миганием.

Без явного контракта 013 закрепил бы:

- хардкод scale-фактора внутри `Renderer.ensureEnemyMesh`/`ensureBossMesh`/player branch;
- правила «что сделать, если спрайт не загружен» в трёх разных местах кода;
- неявную зависимость размера спрайта от размера арены или от настройки `renderScalePreset`.

Решение фиксирует устойчивый presentation-контракт sprite-ассетов для player/enemy/boss и точку, где живёт reference scale.

## Decision

### Зона действия

- Решение касается визуального представления сущностей `kind: 'player'`, `kind: 'enemy'`, `kind: 'boss'` через PNG-спрайты. `projectile` и `drop` сохраняют текущий рендер (примитивы + цвет архетипа); их перевод на ассеты — отдельное решение.
- Решение не вводит атласов, animation frames, directional sprites, hit/death animation, шейдерных эффектов. Один archetype = один статический PNG.

### Visual spec

- Визуальное описание одной сущности — read-only объект следующей формы:
  ```ts
  type SpriteVisualSpec = Readonly<{
    archetypeId: string;                                  // совпадает с id в content library
    image: string;                                        // путь от корня public, например '/assets/hero.png'
    sourceSizePx: Readonly<{ width: number; height: number }>;  // фактический размер PNG в пикселях
    worldSize:    Readonly<{ width: number; height: number }>;  // sourceSizePx / PX_PER_WU
    anchor:       Readonly<{ x: number; y: number }>;          // нормированный pivot, 0..1; для MVP всегда { 0.5, 0.5 }
  }>;
  ```
- `sourceSizePx` — фактический размер PNG, читается генератором из IHDR (см. [content-authoring.md](content-authoring.md), правила derive-полей).
- `worldSize` — derived: `width = sourceSizePx.width / PX_PER_WU`, аналогично по `height`. В MD не пишется и руками не правится.
- `anchor` для MVP всегда `{ 0.5, 0.5 }` (центр спрайта). Поле объявлено сейчас, чтобы не делать новый контракт, когда понадобятся persistent-ноги/верхняя точка для боссов; конкретные значения для не-центрированных anchor-ов вводятся отдельным расширением этого решения.
- Отдельного `displaySizePx` нет: на горизонт MVP `displaySizePx ≡ sourceSizePx`. Когда понадобится override (ручное масштабирование без правки PNG), поле вводится отдельным расширением этого решения; иначе мы держим один набор пикселей.
- `color` из `EnemyArchetype`/`BossArchetype` (см. [content-archetypes.md](content-archetypes.md)) **не** входит в `SpriteVisualSpec`. После этого решения renderer не читает `color` для player/enemy/boss; поле остаётся как content-плейсхолдер для не-renderer сценариев (debug overlay, tooling, будущая мини-карта). Для `WeaponArchetype.color`/`DropArchetype.color` поведение не меняется.

### Reference scale

- Единственное число, переводящее «исходные пиксели PNG» в world units, — константа `PX_PER_WU = 70`. Живёт в `src/main/render/spriteScale.ts` как `export const PX_PER_WU = 70` и больше нигде не дублируется.
- Reference scale **не зависит** от `arena.width`, `arena.height`, `canvas.width`, `canvas.height`, `devicePixelRatio` и `renderScalePreset`. Если кто-то поменяет `SANDBOX_ARENA` с `32×18` на другой размер — мировой размер каждого спрайта останется тем же, на экране он займёт ту же долю арены ровно как любой другой объект с фиксированным `radius`.
- 70 выбрано так, чтобы 16:9 reference 2240×1260 px попадал в текущую `SANDBOX_ARENA` 32×18 wu без масштабирования (`2240 / 70 = 32`, `1260 / 70 = 18`). Это объяснение происхождения числа, не контракт: упоминаний `2240×1260` в коде, тестах и MD быть не должно — арена объявлена в [src/shared/content/arenas.ts](../src/shared/content/arenas.ts), и менять её через «reference arena» нельзя.
- Любая корректировка `PX_PER_WU` = правка этого решения и `spriteScale.ts`. Не «по месту» в renderer-е, не в области генератора, не в MD.

### Visual registries

- Три отдельных visual registry, по одному на presentation-area. Каждый registry — пара «рукописный потребитель ↔ generated литералы», по правилу [content-authoring.md](content-authoring.md):
  - player: `src/main/render/playerVisuals.ts` (рукописный, владеет типом, реестром, валидаторами) ↔ `src/main/render/playerVisuals.generated.ts` (литералы);
  - enemy:  `src/main/render/enemyVisuals.ts`  ↔ `src/main/render/enemyVisuals.generated.ts`;
  - boss:   `src/main/render/bossVisuals.ts`   ↔ `src/main/render/bossVisuals.generated.ts`.
- Объединённого `entitySprites.generated.ts` нет: правило «один MD-источник → пара рядом с потребителем» соблюдается так же, как для `enemies.generated.ts`/`enemyAudio.generated.ts` после 011/012.
- В каждом рукописном модуле:
  - публичный тип `SpriteVisualSpec` (живёт в одном общем месте `src/main/render/SpriteVisualSpec.ts` и реэкспортируется по необходимости — фактическое имя файла деталь реализации; контракт — один тип на проект, не три копии);
  - публичный реестр `Readonly<Record<string, SpriteVisualSpec>>`;
  - валидатор «каждый id из соответствующего content registry имеет visual spec, и наоборот»: `validatePlayerVisuals(playersRegistry)`, `validateEnemyVisuals(enemyRegistry)`, `validateBossVisuals(bossRegistry)`. Валидатор бросает на mismatch, не warn.
- Источник данных для генерации — соответствующая контентная область:
  - `content/players.md` → `playerVisuals.generated.ts` (новая area, см. [content-authoring.md](content-authoring.md));
  - `content/enemies.md` → `enemyVisuals.generated.ts` (расширение существующей area);
  - `content/bosses.md`  → `bossVisuals.generated.ts`  (расширение существующей area).
- Авторская колонка в MD — только `image` (путь от корня `public/`). Поля `sourceSizePx`/`worldSize`/`anchor` в MD запрещены: они либо derive-ятся (`sourceSizePx`, `worldSize`), либо фиксированы константой контракта (`anchor`). Запрет — частный случай правила «MD-колонка для derive-поля запрещена» из [content-authoring.md](content-authoring.md).

### Asset-only renderer

- В [src/main/render/Renderer.ts](../src/main/render/Renderer.ts) ветки для `player`/`enemy`/`boss` создают `THREE.Mesh` с `THREE.PlaneGeometry(worldSize.width, worldSize.height)` и `THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false })`. `THREE.CircleGeometry` для этих kinds не используется.
- Источник `map` — `THREE.Texture` из preloaded набора, ключ — `archetypeId`. Renderer **не** инициирует загрузку текстуры; если её нет — это hard error (см. ниже).
- Gameplay body-contact для `player` / `enemy` / `boss` не живёт в этом файле: после [body-contact-boxes.md](body-contact-boxes.md) его owner — derive `contactBox` в shared/runtime-слое. `worldSize` и `contactBox` на горизонте 013 совпадают по producer-правилу, но остаются разными контрактами: первый presentation-only, второй gameplay.
- Anchor `{0.5, 0.5}` для MVP означает, что центр PlaneGeometry совпадает с position сущности из снапшота. Если в будущем потребуется иная привязка (например, ноги вместо центра) — это правка `anchor` в visual spec и применение его в renderer; контракт `position` снапшота не трогается.
- Z-order не меняется: player/enemy/boss остаются на том же `z`, что сейчас (`ENEMY_Z` из renderer-а), projectile выше, drop ниже, zone overlay поверх.
- `transparent: true` нужен для PNG с альфа-каналом; `depthWrite: false` — чтобы прозрачные края не клипали друг друга при пересечении (спрайты лежат на одинаковом z-плоскости, порядок отрисовки задаётся z-координатой и `renderOrder`).

### Hard error policy

- Все следующие ситуации — `throw` на старте/в тесте, не silent fallback:
  1. Сущность с `kind` ∈ {`player`, `enemy`, `boss`} в снапшоте имеет `archetypeId`, для которого нет visual spec в соответствующем registry.
  2. Visual spec ссылается на `image`, который не вошёл в preloaded набор textures (см. ниже «Preload contract»).
  3. Visual spec ссылается на `archetypeId`, которого нет в content registry соответствующей области (orphan visual).
  4. Mismatch: content registry содержит `id`, для которого в visual registry нет записи (orphan archetype).
- Точки проверки:
  - Validator (`validatePlayerVisuals`/`validateEnemyVisuals`/`validateBossVisuals`) — на старте сессии, до первого тика. Случаи 3 и 4.
  - Preload (см. [main-ui-shell.md](main-ui-shell.md), фаза `loading`) — случай 2 ловится на этапе загрузки и переводит UiShell в `error('preload')` с явным сообщением. До `menu` игра не доходит.
  - Renderer — случай 1 ловится при первом обращении за mesh-ем и бросает; до этой точки доходит только если регистр визуалов и контента собран некорректно (валидатор пропустил), и это будет видно в тестах.
- Никаких `?? 0xffffff` цветов, `?? CircleGeometry`, `?? defaultTexture` для player/enemy/boss. Любой такой fallback — ошибка ревью.

### Preload contract

- Полный contract фазы `loading`, splash и lifecycle preload-а описывает [main-ui-shell.md](main-ui-shell.md). Здесь фиксируется только то, что относится к sprite-ассетам:
  - Список текстур для preload собирается как объединение `image` из трёх visual registries (`player`/`enemy`/`boss`), отсортированный для детерминизма.
  - До `loading → menu` каждый PNG из этого списка обязан быть успешно загружен **и декодирован**: загруженный, но не декодированный битмап не считается готовым (декодирование — самая дорогая фаза первого появления текстуры).
  - Во время сессии lazy-load спрайтов запрещён: renderer обращается только к ключам, гарантированно присутствующим в preloaded наборе.
  - Подгрузка ассетов под `projectile`/`drop` в этой фазе не рассматривается; они остаются на примитивах.

### Тесты

- Unit-тест на `PX_PER_WU`: значение равно 70, и оно — единственный source-of-truth (grep по `src/**` и `scripts/**` находит ровно одну инициализацию).
- `validateEnemyVisuals` / `validateBossVisuals` / `validatePlayerVisuals`: happy path проходит на live registries; mismatch (orphan visual / orphan archetype) бросает с понятным сообщением, в котором есть `archetypeId` и название области.
- Renderer hard-error: создание enemy mesh для `archetypeId`, отсутствующего в visual registry, → `throw`; отсутствие текстуры в preloaded наборе → `throw`. Регрессионный тест «`Renderer` для player/enemy/boss не создаёт `CircleGeometry`» (любой импорт `CircleGeometry` в этих ветках — ошибка).
- Тест «независимость от арены»: при изменении `arena.width`/`arena.height` `worldSize` любого spec остаётся прежним (фиксируется как unit-тест над `SpriteVisualSpec` структурой, не над renderer-ом).

## Consequences

- 013 получает компактный контракт: один общий тип `SpriteVisualSpec`, три раздельных registry, одна константа `PX_PER_WU = 70`, один путь к hard-error-у. Renderer перестаёт быть местом, где живут «магические» цвета и радиусы для рисования.
- Будущие истории «уникальный visual для босса», «directional frames», «atlas» расширяют именно этот файл (новые поля в `SpriteVisualSpec`, новое решение про atlas как отдельный слой), а не переоткрывают контракт «как описать спрайт» по месту.
- `EnemyArchetype.color`/`BossArchetype.color` теряют половину аудитории. Это сознательный долг: пока не появится consumer (debug overlay/мини-карта), поле — placeholder. Удаление — отдельное решение, когда появится фактический consumer или подтверждение, что его не будет.
- Generator получает право читать PNG-файлы для derive `sourceSizePx`. Это первый случай «MD не единственный физический вход генератора»; правила derive-полей зафиксированы в [content-authoring.md](content-authoring.md), здесь — конкретный потребитель.
- Преcеты render scale ([render-scale.md](render-scale.md)) и pixel-density (DPR) не влияют на визуальный размер спрайта в wu: пресет меняет backing-pixels canvas-а, спрайт остаётся того же мирового размера. Инвариант «без преимущества от железа» остаётся в силе.
- Цена: появляется три новых файла-пары (`*Visuals.ts` ↔ `*Visuals.generated.ts`), один общий тип `SpriteVisualSpec.ts`, одна константа `spriteScale.ts`, и удлиняется фаза старта приложения (preload). Ускорение при появлении спрайта в бою компенсирует это.

## Related

- [arena-and-coordinates.md](arena-and-coordinates.md)
- [render-scale.md](render-scale.md)
- [content-archetypes.md](content-archetypes.md)
- [content-authoring.md](content-authoring.md)
- [content-boundaries.md](content-boundaries.md)
- [body-contact-boxes.md](body-contact-boxes.md)
- [main-ui-shell.md](main-ui-shell.md)
- [web-stack.md](web-stack.md)
- [testing.md](testing.md)
- [../stories/013-sprite-assets-and-loader.md](../stories/013-sprite-assets-and-loader.md)
