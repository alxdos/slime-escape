# Landing Telegraph

- Status: accepted
- Created: 2026-04-25
- Updated: 2026-04-26 (correction: runtime `Projectile` **уже** несёт `arcEnd: Vec2 | null` в 017 ([src/sim/EntityStore.ts](../src/sim/EntityStore.ts)), никаких правок runtime для этого файла не требуется — только `SnapshotExportSystem` копирует поле в `ProjectileSnapshot` с принудительным `null` для `state !== 'flying'`. Прошлая формулировка «CombatSystem копирует arcEnd в runtime Projectile в момент создания» — описывала то, что уже реализовано в 017 при spawn arc-снаряда; для 020 это не новая работа.)

## Context

[universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md) фиксирует три типа projectile motion: `linear`, `arc` и `placed`. Arc-снаряды летят детерминированно от `originX/originY` к фиксированной точке приземления через `flightMs`. Уже зафиксированы три render-only аффорданса для arc/placed:

- `pulseWhenGrounded` — pulse уже приземлившегося grounded-снаряда;
- `explosionRadiusIndicator` — faint radius для grounded explosive;
- player-side **pre-shot** preview прицеливания (приближённая точка приземления, считается на main-thread из weapon archetype + текущего aim + текущих modifiers).

Этого хватало, пока единственный источник arc-снарядов был игрок: pre-shot preview даёт игроку информацию **до** выстрела, а само время полёта (`flightMs ∈ 550..700` для `rock-thrower`/`grenade-launcher`) короткое.

Story 020 разрешает не-игроку (слайму) бросать arc-снаряды через [non-player-firing.md](non-player-firing.md). Player pre-shot preview здесь не помогает: игрок не делал выстрел, ему нечего предсказать. Без in-flight аффорданса игрок видит только летящий снаряд (рисуется visual из `projectileVisuals[weaponArchetypeId]` per [sprite-assets.md](sprite-assets.md)) и не понимает, **куда** он упадёт. На частоте `SIM_HZ = 60` и `flightMs ≈ 600` это около 36 тиков; глазом траектория считывается плохо, особенно когда одновременно летят 2–3 arc-снаряда от разных слаймов.

Решение вводит новый render-only аффорданс — **landing telegraph**: пока arc-снаряд не-игрока в полёте, на земле в позиции его приземления отрисовывается заметный маркер.

## Decision

### Зона действия

- Этот файл фиксирует **только** in-flight landing telegraph для arc-снарядов от не-игрока.
- Player-owned arc-снаряды landing telegraph **не получают**: pre-shot preview из [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md) уже даёт игроку нужную информацию, дублирование сделало бы экран шумнее без выгоды.
- Linear-снаряды landing telegraph **не получают**: они читаемы по самой траектории и движутся со скоростью `≈ 12..28 wu/s`, что на типичном расстоянии 5–10 wu даёт окно реакции порядка 200–800 ms — этого достаточно. Расширение telegraph на linear (упреждающие маркеры на быструю пулю) — out of scope, отдельное решение, если когда-нибудь понадобится.
- Placed-снаряды (`bomb-placer`) landing telegraph **не получают**: они не летят, появляются сразу под владельцем. Их читаемость уже обеспечивается `pulseWhenGrounded` + `explosionRadiusIndicator` из [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md).
- Grounded состояние arc-снаряда (`state: 'grounded'`) telegraph **не использует**: после приземления у снаряда уже работают `pulseWhenGrounded` и `explosionRadiusIndicator` (если archetype их включает). Telegraph и grounded-pulse — два разных UX-аффорданса с непересекающимися окнами времени.

### Snapshot extension

- В `ProjectileSnapshot` ([snapshot-shape.md](snapshot-shape.md)) добавляется одно новое поле:
  ```ts
  arcEnd: { x: number; y: number } | null;
  ```
- Семантика:
  - для arc-снаряда в `state: 'flying'` — фиксированная мировая позиция приземления, вычисленная в `CombatSystem` в момент создания снаряда из `position + aim * range`. Не меняется между снапшотами, пока снаряд жив;
  - для arc-снаряда в `state: 'grounded'` — `null`. После приземления landing telegraph не показывается, и поле не несёт презентационного смысла;
  - для linear/placed motion — **всегда** `null` независимо от `state`. Никаких эвристик «угадать landing point по originX/originY» renderer не делает.
- Поле обязательно (не optional на типе `Readonly<{...}>`), значение `null` — единственный способ выразить «landing telegraph не применим». Это устраняет «два разных нет данных» (`undefined` vs `null`).
- Расширение допускается общим правилом «новое поле в существующем `kind` допустимо только дописыванием» из [snapshot-shape.md](snapshot-shape.md). Удаления полей не происходит, других потребителей `ProjectileSnapshot` контракт не ломает.
- Источник вычисления — `CombatSystem` в момент создания снаряда, по той же формуле, что определяет арку траектории (см. [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md), раздел «Projectile motion and state», правила `arc`). В реализации 017 это уже выставляется в `store.spawnProjectile({ motionKind: 'arc', arcEnd, … })`: поле `arcEnd` уже есть у runtime `Projectile` и заполнено корректно для arc-снарядов, `null` для linear/placed. Для story 020 никаких правок runtime по этой части не требуется.
- На каждом снапшоте `SnapshotExportSystem` копирует значение из runtime-сущности `Projectile`, **принудительно выставляя `null` при `state !== 'flying'`**: это единственное место, где семантика «после grounding arcEnd больше не несёт презентационного смысла» материализуется в данных snapshot. Конкретно — одна строка в projectile-экспорте `SnapshotExportSystem.ts`:
  ```ts
  arcEnd: projectile.state === 'flying' ? projectile.arcEnd : null,
  ```
  Этот подход держит renderer-фильтр чистым и не требует «эвристики arcEnd vs state» на стороне renderer-а. Runtime `Projectile.arcEnd` при этом продолжает жить до удаления снаряда; в runtime фазе explosion / fragments / cleanup поле доступно по необходимости для дальнейших систем (сегодня ни одна из них его не читает).

### Render contract

- Renderer определяет «нужен ли landing telegraph» по чистому условию на `ProjectileSnapshot`:
  ```ts
  shouldShowLandingTelegraph =
    state === 'flying'
    && arcEnd !== null
    && ownerKind !== 'player';
  ```
- Никаких lookup-ов в `WEAPON_ARCHETYPES` / `projectileVisuals` для самого решения «показывать или нет» renderer не делает. Lookup нужен только для **формы** маркера (см. ниже).
- Маркер рисуется на земле в позиции `arcEnd`. Это не «след за снарядом» и не trajectory line — это статичная отметка точки приземления.
- Размер и форма маркера:
  - если у соответствующего `WeaponArchetype.projectile.explosion !== null` — диаметр маркера ≈ `2 * explosion.radius`. Это даёт игроку честный preview опасной зоны (читается симметрично уже существующему `explosionRadiusIndicator` после приземления);
  - если `explosion === null` (например, `rock-thrower`) — фиксированный диаметр `0.4` wu. Маркер всё ещё виден, но не пытается обещать радиус, которого нет.
- Цвет/стиль/анимация — render-only константы в `src/main/render/landingTelegraph.ts` (фактическое имя файла — деталь реализации). Базовое предложение для polish:
  - тёплый красный (`#ff4444`) с pulse-анимацией от render time;
  - тонкая обводка + полупрозрачная заливка, чтобы маркер не закрывал спрайт под собой и оставался читаемым на любом фоне арены;
  - конкретные числа меняются как visual polish, не требуя правки этого файла.
- Z-order: **ниже** спрайтов player/enemy/boss/projectile, **выше** фоновой плитки и `explosionRadiusIndicator` для grounded-снарядов (если они оказались в одной точке). Конкретный `renderOrder` — деталь реализации.
- Жизненный цикл маркера в renderer-е:
  1. На каждом кадре renderer пробегает по `snapshot.entities`, фильтрует `kind: 'projectile'` и применяет условие выше.
  2. Если для projectile с данным `id` маркер ещё не существовал — создать (новая mesh / новый sprite в render scene).
  3. Если уже существовал — обновить позицию (`arcEnd` фиксирован, но при resize окна координаты пересчитываются как у любого мирового объекта).
  4. Если для projectile с данным `id` условие перестало быть истинным (snapshot не содержит projectile, или `arcEnd === null`, или `state === 'grounded'`) — удалить маркер (или начать render-only fade-out, см. ниже).
- Renderer **может** добавить короткий fade-out (≤ 100 ms) при удалении маркера как visual polish. Это не часть контракта; контракт — «маркер должен исчезнуть к моменту, когда снаряд приземлился или исчез». Простая мгновенная chistka — валидный и допустимый минимум.

### Презентация vs геймплей

- Landing telegraph — **render-only**. Он не меняет hit-радиусы, не наносит урон, не появляется как сущность в `EntityStore` и не уходит в snapshot как отдельный `kind`. Его state живёт только внутри renderer-а, и его присутствие/отсутствие нигде в gameplay не проверяется.
- Снапшот не несёт «нужен ли telegraph для конкретного projectile» — это derive renderer-а из `state + arcEnd + ownerKind`. Никаких флагов вроде `showTelegraph: boolean` в snapshot не вводится.
- Уничтожение mesh-а маркера в renderer-е происходит синхронно с потерей projectile из снапшота. На частоте `SNAPSHOT_HZ = 30` это даёт worst-case задержку до `33 ms` между фактическим приземлением и исчезновением маркера. Для UX это ниже порога восприятия и не является отдельным контрактом.

### Что этот файл намеренно не описывает

- Точные числа цвета, прозрачности, анимации pulse — это polish внутри renderer-а, меняется без правки этого файла, пока «нужен ли telegraph» не меняется.
- Landing telegraph для player-owned arc — out of scope (см. «Зона действия»). Если когда-нибудь захочется унифицировать pre-shot preview и in-flight маркер, это новое решение, а не расширение здесь.
- Telegraph для linear-снарядов («трассирующая пуля», «упреждающий маркер на быструю пулю») — out of scope.
- Trajectory line / arc-силуэт между origin и arcEnd — out of scope. Для UX hard-кампании 020 достаточно отметки **точки приземления**; trajectory line добавила бы визуальный шум.
- Per-archetype отключение telegraph («этот weapon archetype не телеграфирует») — out of scope. Все non-player arc-снаряды телеграфируют по одному правилу.

## Consequences

- `ProjectileSnapshot` получает одно новое поле `arcEnd: {x,y} | null`. Стоимость трафика — два числа на снаряд, для типичного числа одновременных снарядов в кампании (десятки) — пренебрежимо.
- Единственная реальная правка для 020 в этой части — добавить одну строку в `SnapshotExportSystem.ts` при конструировании `ProjectileSnapshot`-литерала. Runtime `Projectile.arcEnd` уже выставляется корректно в 017, в момент спавна arc-снаряда. Ни `CombatSystem`, ни `EntityStore`, ни spawn-path тут не трогаются.
- Renderer получает одну новую категорию object-pool (landing telegraph mesh-ы), управляемую по жизненному циклу projectile snapshot. Симметрично уже существующим pool-ам (droplets из [impact-feedback.md](impact-feedback.md), grounded pulse).
- UX-инвариант: игрок никогда не получает explosion-урон от arc-снаряда не-игрока без видимого telegraph-маркера в течение всего полёта. Это конкретно проверяется тестом story 020 («слайм бросает arc-снаряд → маркер виден на всё время полёта → исчезает при импакте»).
- Player pre-shot preview из [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md) и in-flight landing telegraph остаются **двумя разными аффордансами с непересекающимися окнами времени** (до выстрела vs после выстрела) и непересекающимися owner-ами (player vs non-player). Это два чистых UX-слоя без конфликта.
- Если позже решим показать in-flight telegraph и для player-owned arc — это extension этого файла, без правки [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md) и без изменения формы `ProjectileSnapshot.arcEnd` (поле уже есть для всех arc, фильтр `ownerKind !== 'player'` просто снимается).

## Related

- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [snapshot-shape.md](snapshot-shape.md)
- [non-player-firing.md](non-player-firing.md)
- [sprite-assets.md](sprite-assets.md)
- [impact-feedback.md](impact-feedback.md)
- [main-ui-shell.md](main-ui-shell.md)
- [../stories/020-shooting-slimes.md](../stories/020-shooting-slimes.md)
