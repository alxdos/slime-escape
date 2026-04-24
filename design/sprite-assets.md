# Sprite Assets

- Status: accepted
- Created: 2026-04-23
- Updated: 2026-04-24 (story 017 extension: scope расширен на `projectile` и `drop`. Те же `SpriteVisualSpec`, `PX_PER_WU = 240`, asset-only renderer, hard-error policy и preload contract переиспользуются. Добавлены два новых visual registry — `projectileVisuals` (ключ — `weaponArchetypeId`) и `dropVisuals` (ключ — `dropArchetypeId`). Inline image-узлы в `content/weapons.md` и `content/drops.md` — load-bearing source по правилам [content-authoring.md](content-authoring.md). Render-only behavior projectile (`spinSpeed`, `rotateWhileFlying`, `pulseWhenGrounded`, `explosionRadiusIndicator`) живёт в `WeaponArchetype.projectile.visual` и не относится к этому файлу — см. [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). story 016: render-only impact effects may create transient droplets and death ghost sprites from existing slime visuals without extending `SpriteVisualSpec`; see [impact-feedback.md](impact-feedback.md). Earlier render follow-up: `enemy` и `boss` получают render-only procedural breathing через squash/stretch `mesh.scale`, с фазой от `entity.id` и без новых snapshot/content-полей; story 014: авторская поверхность для пути к PNG-ассету переезжает с MD-колонки `image` на inline image-узел `![alt](../public/...)` под `## <id>` в `content/players.md` / `content/enemies.md` / `content/bosses.md` — см. раздел «Inline media-узлы как derive-источники» в [content-authoring.md](content-authoring.md). Рантайм-контракт `SpriteVisualSpec` (`image`/`sourceSizePx`/`worldSize`/`anchor`), правило producer-а `worldSize = sourceSizePx / PX_PER_WU` и hard-error policy — не меняются.)

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

- Решение касается визуального представления сущностей `kind: 'player'`, `kind: 'enemy'`, `kind: 'boss'`, `kind: 'projectile'`, `kind: 'drop'` через PNG-спрайты. Все пять kind рендерятся через один и тот же контракт `SpriteVisualSpec` и одну и ту же reference scale `PX_PER_WU`.
- Решение не вводит атласов, animation frames, directional sprites, hit/death animation, шейдерных эффектов. Один archetype = один статический PNG. Render-only behavior (например, projectile spin или grounded pulse) живёт в архетипных контентных полях соответствующей области ([universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)) и не расширяет `SpriteVisualSpec`.
- Для `projectile` и `drop` ключ visual registry — **архетипный** id (`weaponArchetypeId` для projectile, `dropArchetypeId` для drop), не runtime entity id. Это совпадает с правилом для `enemy`/`boss`: render выбирает спрайт по `archetypeId` снапшота, не по `entity.id`.
- Для `projectile` визуальная идентичность принадлежит **оружию-владельцу**, а не отдельному `ProjectileArchetype`. Содержательно: один и тот же weapon всегда стреляет «своим» снарядом; шаринга projectile sprite между weapon-ами на этом горизонте нет. Если позже понадобится отдельный реестр projectile-визуалов, это будет расширение этого решения, не «по месту».

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
- `color` из `EnemyArchetype`/`BossArchetype` (см. [content-archetypes.md](content-archetypes.md)) **не** входит в `SpriteVisualSpec`. Base sprite renderer не tint-ит player/enemy/boss PNG по `color`; после [impact-feedback.md](impact-feedback.md) renderer может читать `color` только для render-only slime material effects (droplets/stains). Для `WeaponArchetype.color`/`DropArchetype.color` поведение не меняется.

### Reference scale

- Единственное число, переводящее «исходные пиксели PNG» в world units, — константа `PX_PER_WU = 240`. Живёт в `src/shared/sprite/spriteScale.ts` как `export const PX_PER_WU = 240` и больше нигде не дублируется.
- Reference scale **не зависит** от `arena.width`, `arena.height`, `canvas.width`, `canvas.height`, `devicePixelRatio` и `renderScalePreset`. Если кто-то поменяет `SANDBOX_ARENA` с `32×18` на другой размер — мировой размер каждого спрайта останется тем же, на экране он займёт ту же долю арены ровно как любой другой объект с фиксированным `radius`.
- Любая корректировка `PX_PER_WU` = правка этого решения и `spriteScale.ts`. Не «по месту» в renderer-е, не в области генератора, не в MD.

### Visual registries

- Пять отдельных visual registry, по одному на presentation-area. Каждый registry — пара «рукописный потребитель ↔ generated литералы», по правилу [content-authoring.md](content-authoring.md):
  - player:     `src/main/render/playerVisuals.ts` ↔ `src/main/render/playerVisuals.generated.ts`;
  - enemy:      `src/main/render/enemyVisuals.ts`  ↔ `src/main/render/enemyVisuals.generated.ts`;
  - boss:       `src/main/render/bossVisuals.ts`   ↔ `src/main/render/bossVisuals.generated.ts`;
  - projectile: `src/main/render/projectileVisuals.ts` ↔ `src/main/render/projectileVisuals.generated.ts`;
  - drop:       `src/main/render/dropVisuals.ts`       ↔ `src/main/render/dropVisuals.generated.ts`.
- Объединённого `entitySprites.generated.ts` нет: правило «один MD-источник → пара рядом с потребителем» соблюдается так же, как для `enemies.generated.ts`/`enemyAudio.generated.ts` после 011/012.
- В каждом рукописном модуле:
  - публичный тип `SpriteVisualSpec` (живёт в одном общем месте `src/main/render/SpriteVisualSpec.ts` и реэкспортируется по необходимости — фактическое имя файла деталь реализации; контракт — один тип на проект, не пять копий);
  - публичный реестр `Readonly<Record<string, SpriteVisualSpec>>`;
  - валидатор «каждый id из соответствующего content registry имеет visual spec, и наоборот»: `validatePlayerVisuals(playersRegistry)`, `validateEnemyVisuals(enemyRegistry)`, `validateBossVisuals(bossRegistry)`, `validateProjectileVisuals(weaponsRegistry)`, `validateDropVisuals(dropsRegistry)`. Валидатор бросает на mismatch, не warn.
- Источник данных для генерации — соответствующая контентная область:
  - `content/players.md` → `playerVisuals.generated.ts`;
  - `content/enemies.md` → `enemyVisuals.generated.ts`;
  - `content/bosses.md`  → `bossVisuals.generated.ts`;
  - `content/weapons.md` → `projectileVisuals.generated.ts` (новая выходная пара для области `weapons`; ключ записи — `weaponArchetypeId`, потому что projectile sprite принадлежит оружию по правилу из «Зона действия»);
  - `content/drops.md`   → `dropVisuals.generated.ts` (новая выходная пара для области `drops`; ключ записи — `dropArchetypeId`).
- Авторская поверхность для пути к PNG-ассету — **inline image-узел `![alt](../public/<path>)` под H2 архетипа** в `content/<area>.md` (см. раздел «Inline media-узлы как derive-источники» в [content-authoring.md](content-authoring.md)). MD-колонка `image` — запрещена: она была бы вторым источником правды для того же derive-поля. URL inline-узла в `.generated.ts` записывается как public-relative path после strip префикса `../public/`, по правилу из того же раздела. Поля `sourceSizePx`/`worldSize`/`anchor` в MD запрещены целиком: они либо derive-ятся (`sourceSizePx`, `worldSize`), либо фиксированы константой контракта (`anchor`). Запрет — частный случай правила «MD-колонка для derive-поля запрещена» из [content-authoring.md](content-authoring.md).
- В области `weapons` H2-секция weapon-а уже несёт inline audio-link для `fire` (история 014). Со 017 та же секция дополнительно несёт **обязательный** inline image-узел для projectile sprite. Два разных вида inline media (audio-link vs image) различаются по синтаксису и не конфликтуют. В области `drops` inline image-узел вводится как обязательный впервые.

### Asset-only renderer

- В [src/main/render/Renderer.ts](../src/main/render/Renderer.ts) ветки для `player`/`enemy`/`boss`/`projectile`/`drop` создают `THREE.Mesh` с `THREE.PlaneGeometry(worldSize.width, worldSize.height)` и `THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false })`. `THREE.CircleGeometry` для этих kinds не используется.
- Источник `map` — `THREE.Texture` из preloaded набора, ключ — `archetypeId` (для projectile это `weaponArchetypeId`, для drop — `dropArchetypeId`). Renderer **не** инициирует загрузку текстуры; если её нет — это hard error (см. ниже).
- Gameplay body-contact для `player` / `enemy` / `boss` не живёт в этом файле: после [body-contact-boxes.md](body-contact-boxes.md) его owner — derive `contactBox` в shared/runtime-слое. `worldSize` и `contactBox` на горизонте 013 совпадают по producer-правилу, но остаются разными контрактами: первый presentation-only, второй gameplay.
- Для `projectile` gameplay-форма (`hitRadius`, `size`) задаётся `ProjectileArchetype` в [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md) и authoritative для столкновений. `worldSize` projectile sprite — render-only; контент обязан держать его согласованным с `size`/`hitRadius`, валидатор области (см. ниже) проверяет совпадение `worldSize == size` в пределах допуска (детали — в `weapons.md` content-build).
- Для `drop` gameplay-форма (`radius`) задаётся `DropArchetype` в [drops.md](drops.md) и authoritative для pickup overlap. `worldSize` drop sprite — render-only; та же согласованность валидируется на стороне content-build для области `drops`.
- Anchor `{0.5, 0.5}` для MVP означает, что центр PlaneGeometry совпадает с position сущности из снапшота. Если в будущем потребуется иная привязка (например, ноги вместо центра) — это правка `anchor` в visual spec и применение его в renderer; контракт `position` снапшота не трогается.
- Z-order не меняется: player/enemy/boss остаются на том же `z`, что сейчас (`ENEMY_Z` из renderer-а), projectile выше, drop ниже, zone overlay поверх.
- `transparent: true` нужен для PNG с альфа-каналом; `depthWrite: false` — чтобы прозрачные края не клипали друг друга при пересечении (спрайты лежат на одинаковом z-плоскости, порядок отрисовки задаётся z-координатой и `renderOrder`).

### Procedural breathing

- Static PNG remains the source visual, but `Renderer` may apply a small presentation-only squash/stretch to the existing sprite mesh. This is intentionally a render pass, not a simulation system: it changes only `THREE.Mesh.scale` and never writes to snapshot state, archetypes, `SpriteVisualSpec`, `worldSize`, `contactBox`, movement, collision, projectile targeting, or spawn/balance values.
- On the current horizon the effect applies to `enemy` and `boss` sprites only. `player` stays unscaled so input feel and player silhouette remain stable; `projectile` carries its own render-only motion (spin, grounded pulse) governed by `WeaponArchetype.projectile.visual` in [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md), and `drop` may carry render-only pulse/bob driven by `DropArchetype` content fields when added — but neither uses the procedural breathing curve described below.
- The breathing curve is sinusoidal and deterministic from render time plus entity identity:
  ```ts
  breath = sin(nowMs * breathHz + entity.id * phaseStride)
  scaleX = 1 + amplitude * breath
  scaleY = 1 - amplitude * verticalRatio * breath
  ```
  Positive `breath` makes the slime wider and slightly lower; negative `breath` makes it narrower and taller. Different `entity.id` values provide phase offsets so a wave of slimes does not animate in lockstep.
- Amplitudes are deliberately small and renderer-owned constants. Normal enemies may use a stronger amplitude than bosses; bosses should read as alive but heavier. Tuning these numbers is a visual polish change inside `src/main/render/**`, not content authoring.
- The effect must remain independent of `renderScalePreset`, DPR, canvas backing size, arena size, and simulation tick rate. It uses wall/render time for presentation, so it is allowed to be visually non-authoritative in the same way interpolation and drop pulsing are presentation-only.
- If future animation frames, skeletons, shader deformation, event impulses (hit/landing squash), or per-archetype animation profiles are introduced, they extend this section. They must still preserve the core rule: sprite deformation cannot become a source of gameplay geometry unless [body-contact-boxes.md](body-contact-boxes.md) is explicitly updated.

### Impact effects

- Render-only slime impact effects are owned by [impact-feedback.md](impact-feedback.md). They reuse existing visual registries and preloaded textures for death ghost sprites, and may generate droplet geometry at runtime.
- These effects do **not** add fields to `SpriteVisualSpec`: one static PNG remains the archetype visual source, while droplets/stains/ghosts are transient renderer state.
- Death ghost sprites use the same `image`, `worldSize` and `anchor` as the live sprite, but their position, opacity, tint and lifetime are renderer-owned presentation data.

### Hard error policy

- Все следующие ситуации — `throw` на старте/в тесте, не silent fallback:
  1. Сущность с `kind` ∈ {`player`, `enemy`, `boss`, `projectile`, `drop`} в снапшоте имеет `archetypeId` (или `weaponArchetypeId`/`dropArchetypeId` для projectile/drop), для которого нет visual spec в соответствующем registry.
  2. Visual spec ссылается на `image`, который не вошёл в preloaded набор textures (см. ниже «Preload contract»).
  3. Visual spec ссылается на `archetypeId`, которого нет в content registry соответствующей области (orphan visual).
  4. Mismatch: content registry содержит `id`, для которого в visual registry нет записи (orphan archetype).
- Точки проверки:
  - Validators (`validatePlayerVisuals`/`validateEnemyVisuals`/`validateBossVisuals`/`validateProjectileVisuals`/`validateDropVisuals`) — на старте сессии, до первого тика. Случаи 3 и 4.
  - Preload (см. [main-ui-shell.md](main-ui-shell.md), фаза `loading`) — случай 2 ловится на этапе загрузки и переводит UiShell в `error('preload')` с явным сообщением. До `menu` игра не доходит.
  - Renderer — случай 1 ловится при первом обращении за mesh-ем и бросает; до этой точки доходит только если регистр визуалов и контента собран некорректно (валидатор пропустил), и это будет видно в тестах.
- Никаких `?? 0xffffff` цветов, `?? CircleGeometry`, `?? defaultTexture` для любого из пяти kinds. Любой такой fallback — ошибка ревью.

### Preload contract

- Полный contract фазы `loading`, splash и lifecycle preload-а описывает [main-ui-shell.md](main-ui-shell.md). Здесь фиксируется только то, что относится к sprite-ассетам:
  - Список текстур для preload собирается как объединение `image` из пяти visual registries (`player`/`enemy`/`boss`/`projectile`/`drop`), отсортированный для детерминизма.
  - До `loading → menu` каждый PNG из этого списка обязан быть успешно загружен **и декодирован**: загруженный, но не декодированный битмап не считается готовым (декодирование — самая дорогая фаза первого появления текстуры).
  - Во время сессии lazy-load спрайтов запрещён: renderer обращается только к ключам, гарантированно присутствующим в preloaded наборе.

### Тесты

- Unit-тест на `PX_PER_WU`: значение равно 240, и оно — единственный source-of-truth (grep по `src/**` и `scripts/**` находит ровно одну инициализацию).
- `validateEnemyVisuals` / `validateBossVisuals` / `validatePlayerVisuals` / `validateProjectileVisuals` / `validateDropVisuals`: happy path проходит на live registries; mismatch (orphan visual / orphan archetype) бросает с понятным сообщением, в котором есть `archetypeId` и название области.
- Renderer hard-error: создание mesh для `archetypeId`, отсутствующего в visual registry, → `throw`; отсутствие текстуры в preloaded наборе → `throw`. Регрессионный тест «`Renderer` ни для одного из пяти kinds не создаёт `CircleGeometry`» (любой импорт `CircleGeometry` в этих ветках — ошибка).
- Тест «независимость от арены»: при изменении `arena.width`/`arena.height` `worldSize` любого spec остаётся прежним (фиксируется как unit-тест над `SpriteVisualSpec` структурой, не над renderer-ом).
- Renderer breathing: `enemy` получает render-only `mesh.scale` squash/stretch на заданном `nowMs`, а `player`/`projectile`/`drop` остаются с `scale = 1` (для projectile spin/grounded pulse — отдельная render-only логика по [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md), не путать с breathing).
- Content-build тест: для каждой записи `weapons.generated.ts` `projectile.size` совпадает с `worldSize` соответствующей записи `projectileVisuals.generated.ts` в пределах допуска; то же для `drops.generated.ts.radius` и `dropVisuals.generated.ts.worldSize` (диаметр). Несовпадение — `atomic fail` content-build.

## Consequences

- 013 получает компактный контракт: один общий тип `SpriteVisualSpec`, три раздельных registry, одна константа `PX_PER_WU = 240`, один путь к hard-error-у. Renderer перестаёт быть местом, где живут «магические» цвета и радиусы для рисования.
- Будущие истории «уникальный visual для босса», «directional frames», «atlas» расширяют именно этот файл (новые поля в `SpriteVisualSpec`, новое решение про atlas как отдельный слой), а не переоткрывают контракт «как описать спрайт» по месту.
- Procedural breathing даёт статическим PNG минимальную жизнь без расширения content/snapshot контракта. Цена — ещё один renderer-owned polish pass и необходимость держать амплитуды достаточно малыми, чтобы визуальный контур не обещал игроку другие хитбоксы.
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
- [impact-feedback.md](impact-feedback.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [drops.md](drops.md)
- [../stories/017-universal-weapons-and-projectiles.md](../stories/017-universal-weapons-and-projectiles.md)
