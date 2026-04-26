# Spawn Overrides

- Status: accepted
- Created: 2026-04-25
- Updated: 2026-04-26 (story 020 correction: уточнено, что `loadout` — единственное override-поле, эффективное значение которого **не копируется в поле runtime-сущности `enemy`**. Runtime-`WeaponInstance` слайма живёт в `shooterWeapons: Map<EntityId, ShooterWeapons>` внутри closure `CombatSystem`, симметрично player loadout; SpawnSystem вызывает callback `onEnemySpawned` в worker-обвязку, которая зовёт `combat.setEnemyLoadout`. Полный контракт — [non-player-firing.md](non-player-firing.md). Earlier 2026-04-25: closed list расширен четвёртым полем `loadout?: Loadout` — выдача оружия слайму per spawn для firing path не-игрока ([non-player-firing.md](non-player-firing.md)). Семантика replace-or-`null`, момент применения и валидация — те же, что для трёх существующих полей. MD-форма третьей override-таблицы расширена двумя колонками `loadoutWeaponIds | selectedWeaponIndex` (см. [content-authoring.md](content-authoring.md), раздел про override-таблицу области `sessions`). Контракт «расширение допускается только дописыванием новых полей» соблюдается буквально.)

## Context

[content-archetypes.md](content-archetypes.md) фиксирует `EnemyArchetype` как стабильную «идентичность существа»: тело, HP, способ движения, физическая модель контакта, дефолтная вероятностная таблица дропа `dropTable`, дефолтная политика `retaliation` и (на горизонте 018) расширение `carrierDrop`. [spawn-plan.md](spawn-plan.md) фиксирует `StaticSpawn`/`WaveSpawn` как ссылки только на `archetypeId` (и `position` для `'static'`). [session-definition.md](session-definition.md) явно требует, чтобы `EncounterDefinition.spawnPlan` оставался стабильным верхнеуровневым полем, эволюционировал только через новые `kind` и не превращался в свалку точечных правок.

Получился разрыв. Геймдизайнер хочет описать особенности **конкретного спавна в конкретной волне**: «эта carrier-щель в третьей волне второго сета гарантированно роняет `multi-shot`», «эти два слайма в demo-encounter мстят за friendly fire», «у этой щели в боссфайте дроп-таблица заменена пустой». На сегодняшнем горизонте (после 018) единственный способ это выразить — завести **форк архетипа** в `content/enemies.md` (`campaign-set-1-carrier-slime`, `demo-retaliator-slime` и т. д.), потому что и `carrierDrop`, и `retaliation` — поля архетипа, а dropTable доступен только как поле архетипа.

Это лжёт об уровне правды:

- архетип «Set 1 Carrier Slime» — это **не отдельный вид существа**, это `slime-X` с одной поведенческой особенностью в конкретном спавне;
- `content/enemies.md` начинает содержать сущности, которых в игре как «вида слайма» нет;
- цвет/спрайт/звуковой set форка приходится либо повторять, либо делать одинаковым с базовым архетипом, что усиливает дублирование;
- как только понадобится вторая особенность того же типа («тот же carrier в той же волне, но не магнит, а fragment»), это новый форк, и `enemies.md` распухает квадратично от количества волн × особенностей.

Параллельная проблема — **кросс-областная валидация**: сегодня связь «гарантированный дроп существует в реестре дропов» проверяется внутри `validateEnemyRegistry` через `assertCarrierDropsResolve`. Но `enemies` — одно-файловая область ([content-authoring.md](content-authoring.md)); cross-area refs принадлежат multi-file области (`sessions`). Проверка живёт не там, где живёт источник правды.

Без явного решения история 019 либо неявно введёт переопределения «по месту» в `scripts/content-build/sessions/**`, либо растащит контракт на несколько разных «нет данных» (часть полей на архетипе, часть в spawn-плане, часть в session-rules).

## Decision

### Принципиальное разделение

Два уровня правды о том, что выйдет на арену, разделены явно и одинаково для всех runtime-систем:

- **Архетип в `content/enemies.md` = идентичность существа.** Стабильно для `slime-X` всегда и везде: тело (`radius`, `contactBox`), здоровье (`maxHp`), способ движения (`behavior`, `maxSpeed`), физическая модель контакта (`contactDamage`, `contactCooldownMs`, `knockback*`), цвет/спрайт/звуковой set, **дефолтная** вероятностная таблица дропа `dropTable`, **дефолтная** политика `retaliation`. Поле `carrierDrop` из [content-archetypes.md](content-archetypes.md) удаляется (см. ниже).
- **Spawn-override = контекст появления.** Верно про **этот конкретный спавн в этой конкретной волне**: гарантированный дроп, replace вероятностной таблицы дропа, точечно включённая retaliation. Гранулярность — per `seq` (одна строка таблицы спавнов = один потенциальный override).

`behavior` **не override-ится** на этом горизонте: «как этот слайм двигается» — часть его идентичности, а не «что у него с собой». «Такой же слайм, но стационарный» — это новый архетип, а не модификатор спавна. Тоже самое — для тела, HP, контактной модели и любых других «как он устроен»-полей.

### Форма SpawnOverride

`SpawnOverride` — плоский объект с **закрытым** списком optional-полей. Расширение допускается только дописыванием новых полей; смена семантики существующего поля = новое design-решение и обновление этого файла.

```ts
type SpawnOverride = Readonly<{
  /** Список DropArchetype.id, которые этот спавн гарантированно роняет при смерти.
   *  Семантика: ADD поверх результата вероятностного ролла из dropTable.
   *  Отсутствие поля = «гарантированных дропов нет». Пустой список запрещён,
   *  чтобы исключить «два разных нет данных». */
  guaranteedDrops?: ReadonlyArray<string>;

  /** Полная вероятностная таблица для этого спавна.
   *  Семантика: REPLACE архетипной таблицы целиком.
   *  Отсутствие поля = используется архетипная таблица.
   *  Пустой массив [] валиден и означает «у этого спавна dropTable пуст»,
   *  это отличается от «нет override» и нужно для миграции. */
  dropTable?: ReadonlyArray<DropTableEntry>;

  /** Политика friendly-fire retaliation для этого спавна.
   *  Семантика: REPLACE архетипной политики.
   *  Отсутствие поля = используется архетипный default. */
  retaliation?: RetaliationPolicy;

  /** Loadout оружия, выданный этому спавну для firing path не-игрока (story 020).
   *  Семантика: REPLACE-or-`null`. На этом горизонте у `EnemyArchetype` нет архетипного
   *  default-loadout, поэтому effective loadout = `override.loadout` если задан, иначе `null`.
   *  Отсутствие поля = «у этого спавна оружия нет, он не стреляет».
   *  Пустой `weapons: []` запрещён (выражается тем же отсутствием поля), чтобы исключить
   *  «два разных нет данных».
   *  Полная семантика «как из этого поля рождаются runtime WeaponInstance и как идёт
   *  стрельба слайма» — в [non-player-firing.md](non-player-firing.md). */
  loadout?: Loadout;
}>;
```

`DropTableEntry`, `RetaliationPolicy` и `Loadout` — те же типы, что у `EnemyArchetype` и `SessionDefinition` ([content-archetypes.md](content-archetypes.md), [drops.md](drops.md), [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md), [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)). Никаких новых типов и никаких параллельных копий не вводится. `Loadout.selectedIndex` обязан быть `null` или попадать в `[0, weapons.length)`; `weapons[i]` — существующий `WeaponArchetype.id` из `WEAPON_ARCHETYPES`. Эти три инварианта дублируют session-level loadout-валидацию и обязательны на стороне валидатора sessions-области.

### Где SpawnOverride живёт в плане

`SpawnOverride` принадлежит per-`seq` записи спавн-плана и присоединяется к ней optional-полем `override`:

```ts
type StaticSpawn = Readonly<{
  archetypeId: string;
  position: Vec2;
  override?: SpawnOverride;
}>;

type WaveSpawn = Readonly<{
  archetypeId: string;
  override?: SpawnOverride;
}>;
```

Точные определения `StaticSpawn`/`WaveSpawn` зафиксированы в [spawn-plan.md](spawn-plan.md); это решение — единственный источник правды о форме `SpawnOverride` и её присоединении.

`'empty'` и `'boss'` плана **не имеют** override на этом горизонте: у `'empty'` нет спавнов вообще, у `'boss'` — единственный спавн босса, описанный целиком в плане; босс — не слайм-форк, и его особенности фиксируются в `BossArchetype`/`BossPhaseSystem` ([boss-encounter.md](boss-encounter.md)). Если когда-нибудь понадобится «тот же босс, но с гарантированным дропом» — это будет отдельное решение, не «дописывание по месту».

### Семантика полей (replace vs add)

- `guaranteedDrops` — **add поверх** dropTable. На каждом срабатывании death hook ([drops.md](drops.md)) сначала спавнятся все элементы `guaranteedDrops` в позиции смерти, затем выполняется обычный weighted-pick ролл по эффективной dropTable (см. ниже). Гарантированные дропы **не дёргают** session RNG: фиксированный набор не зависит от случайности и не сбивает воспроизводимость. Это уже зафиксировано в [drops.md](drops.md) для существующего carrier-механизма; здесь правило сохраняется буквально, меняется только источник списка id.
- `dropTable` — **replace** dropTable архетипа. Если поле задано (включая `[]`), DropSystem использует именно его как «эффективную dropTable» этого спавна; архетипная таблица в этом случае **не читается** для этого спавна. Если поле опущено — эффективная dropTable равна архетипной.
- `retaliation` — **replace** архетипной политики. Если поле задано, RetaliationSystem ([combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)) реагирует именно на эту политику; архетипная не читается. Если поле опущено — используется архетипная.
- `loadout` — **replace-or-`null`** (story 020). У `EnemyArchetype` архетипного default-loadout нет, поэтому effective loadout — это либо копия `override.loadout`, либо `null`. Если effective loadout — `null`, runtime-сущность `enemy` не получает полей `weapons`/`selectedWeaponIndex` (или получает пустыми), и фаза firing decisions для этой сущности — no-op. Если effective loadout — объект, `SpawnSystem` материализует runtime `WeaponInstance[]` и `selectedWeaponIndex` симметрично игроку (см. [non-player-firing.md](non-player-firing.md)).

«Эффективная dropTable», «эффективная retaliation» и «эффективный loadout» — внутренние термины этого решения; они описывают, что именно положено в runtime-сущность на момент спавна. Никакой `Map<seq, override>` в runtime не передаётся.

### Момент применения

Override применяется **один раз** при материализации сущности в `SpawnSystem` ([spawn-plan.md](spawn-plan.md)). После этого runtime-сущность ничем не отличается от «обычного» спавна: per-tick override-логики не существует, ни одна другая система не знает слова `SpawnOverride`.

Это значит, что runtime-state сущности `enemy` несёт уже **резолвленные** per-instance копии:

- `guaranteedDrops: ReadonlyArray<string>` — копия `override.guaranteedDrops ?? []`. Если непустой, в snapshot выставляется `carrierDropMarker: 'reward'` (см. [snapshot-shape.md](snapshot-shape.md)); это единственный способ, которым presentation узнаёт о carrier-щели после 019.
- `dropTable: ReadonlyArray<DropTableEntry>` — копия `override.dropTable` если задано, иначе копия `archetype.dropTable`. DropSystem ([drops.md](drops.md)) для weighted-pick читает **только** это поле сущности; архетипный `dropTable` остаётся источником **default-копии**, не источником per-tick правды.
- `retaliation: RetaliationPolicy` — копия `override.retaliation` если задано, иначе копия `archetype.retaliation`. RetaliationSystem читает **только** это поле сущности.

`loadout` (story 020) — исключение из этого правила: его эффективное значение **не копируется в поле сущности `enemy`**. Вместо этого `SpawnSystem` при материализации каждой сущности `enemy` с effective `loadout !== null` вызывает callback `onEnemySpawned(enemyId, loadout, simTimeMs)`, который на уровне worker-обвязки переадресуется в `combat.setEnemyLoadout(enemyId, loadout, simTimeMs)`. Runtime-`WeaponInstance[]` и `selectedWeaponIndex` слайма живут в `shooterWeapons: Map<EntityId, ShooterWeapons>` внутри closure `CombatSystem`, симметрично player loadout. Cleanup — `combat.removeShooter(enemyId)` из существующего death hook. Полный контракт — [non-player-firing.md](non-player-firing.md). Смысл этого исключения: WeaponInstance — это не «поле архетипа, отсроченное до спавна», а **ranтайм-state со своим lifecycle**, которым владеет `CombatSystem`; player loadout в реализации 017 уже хранится там же, и слаймы используют ту же структуру.

То же правило (копирование полей с архетипа на runtime-сущность) для `guaranteedDrops`/`dropTable`/`retaliation` симметрично уже зафиксированному правилу для `Drop` ([drops.md](drops.md)): тик не зависит от лишних lookup-ов, и runtime устойчив к будущим мутациям архетипа в редакторе/тестах.

### Удаление поля `EnemyArchetype.carrierDrop`

После принятия этого решения и миграции на него:

- из `EnemyArchetype` ([content-archetypes.md](content-archetypes.md)) удаляется поле `carrierDrop` (с типами `CarrierDropMetadata` и `marker: 'reward'`); `EnemyArchetype.dropTable` и `EnemyArchetype.retaliation` **остаются** как defaults;
- из `validateEnemyRegistry` ([src/shared/content/enemies.ts](../src/shared/content/enemies.ts)) удаляется `assertCarrierDropsResolve`; cross-area проверка «гарантированный дроп существует в реестре `DropArchetype`» переезжает в валидатор multi-file области `sessions` (см. ниже);
- из MD-источника `content/enemies.md` исчезает партиция `## Carrier Drops` и все семь архетипов-форков (`campaign-set-1..5-carrier-slime`, `demo-carrier-slime`, `demo-retaliator-slime`); их члены в `## Members` партиции `# Sound sets` тоже исчезают;
- из `scripts/content-build/enemies/**` исчезает парсинг и рендер `carrierDrop`;
- runtime-поле снапшота `carrierDropMarker` ([snapshot-shape.md](snapshot-shape.md)) не меняет форму, но его источник переключается с `EnemyArchetype.carrierDrop?.marker` на derive `guaranteedDrops.length > 0 ? 'reward' : null` на стороне `SpawnSystem`/`EntityStore`. Renderer читает то же поле снапшота и не меняется.

Сосуществование старой и новой моделей запрещено: миграция — часть истории 019, а не follow-up. После закрытия истории нет ни одного места, где `EnemyArchetype.carrierDrop` ещё валиден.

### Валидация

Проверки распределены по слоям так же, как для остальных multi-file областей ([content-authoring.md](content-authoring.md)).

- **content-build, область `sessions` (`scripts/content-build/sessions/**`)** — статика на стороне MD:
  - hard-error на неизвестное имя поля override (всё, что не в `{guaranteedDrops, dropTable, retaliation}`);
  - hard-error на override на несуществующий `seq` (нет такой строки в основной таблице спавнов того же encounter);
  - hard-error на дубликат `seq` в override-таблице;
  - hard-error на ссылку на неизвестный `dropArchetypeId` в любом из полей override (используется тот же `requireDropRef`, что для cross-area refs из [content-authoring.md](content-authoring.md));
  - warn на `chance < 0`, `chance > 1` и `sum(chance) > 1` в `override.dropTable` — те же warn-правила, что в `validateEnemyRegistry` для архетипного dropTable;
  - warn на `retaliation.enabled === true && retaliation.durationMs <= 0`;
  - hard-error на пустой список `guaranteedDrops` в MD-ячейке (выражается значением `none`, а не пустой ячейкой; см. правило ниже);
  - hard-error на ссылку на неизвестный `weaponArchetypeId` в `override.loadout.weapons` (используется cross-area ref в область `weapons` через TS-импорт `WEAPON_ARCHETYPES`, аналогично `requireDropRef`);
  - hard-error на `override.loadout.selectedIndex`, не попадающий в `[0, weapons.length)` и не равный `null`;
  - hard-error на пустой список `loadout.weapons: []` (выражается значением `none` в обеих колонках `loadoutWeaponIds`/`selectedWeaponIndex`, а не пустой ячейкой; то же правило единственного «нет данных», что и для `guaranteedDrops`);
  - hard-error на частично заданный loadout: `loadoutWeaponIds = none` при не-`none` `selectedWeaponIndex` и наоборот — обе колонки задают одно поле `SpawnOverride.loadout` целиком.
- **builder сессии (`src/shared/content/buildSession.ts`)** — second-pass на собранном `SessionDefinition`. Сюда переезжает бывший `assertCarrierDropsResolve`:
  - все `dropArchetypeId`, упомянутые в любом `override.guaranteedDrops` и любом `override.dropTable` любого encounter всех presets, обязаны резолвиться в `DROP_ARCHETYPES`. Это duplicate-safety на случай drift между MD и `drops.generated.ts`. На MD-стороне это уже проверено генератором, но runtime-проверка на старте сессии остаётся как защитный слой по тому же правилу, что и сегодня для архетипов-врагов.
  - все `weaponArchetypeId`, упомянутые в любом `override.loadout.weapons`, обязаны резолвиться в `WEAPON_ARCHETYPES`; та же duplicate-safety на случай drift между MD и `weapons.generated.ts`.
- **runtime-системы** — никаких новых проверок. К моменту тика всё уже резолвлено в полях runtime-сущности; `SpawnSystem`/`DropSystem`/`RetaliationSystem` читают только готовые поля сущности.

### MD-форма (правило-ссылка на content-authoring)

Этот файл фиксирует только то, что геймдизайнер обязан описывать override **в encounter-секции preset-а** в `content/sessions/<presetId>.md`, а не в `content/enemies.md` и не в `content/sessions.md`. Конкретный формат третьей optional-таблицы (`seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex`) и допустимые мини-синтаксисы внутри её ячеек живут в [content-authoring.md](content-authoring.md), раздел «Несколько таблиц в одной H2-секции» (расширенный для области `sessions` с двух таблиц до трёх и контролируемое исключение из правила «узкая таблица: id + ≤4 поля» на 6 полей сверх `seq` ровно для override-таблицы). Здесь дублирование запрещено правилом «без двух источников правды».

Ровно одно дополнение, которое область обязана соблюсти и которое попадает в скоуп этого решения, а не authoring-правил:

- **присутствие override-таблицы в encounter** допустимо только при `spawnKind ∈ {wave, static}`. При `spawnKind ∈ {empty, boss}` третья таблица запрещена (см. «Где SpawnOverride живёт в плане»).

### Что запрещено вводить «по месту»

- множители статов (`hpMultiplier`, `speedMultiplier`, `damageMultiplier`, …) как override — отдельное design-решение, scope этого файла не расширяется молча;
- per-encounter override (одна запись на «все слаймы вида X в этой волне») в дополнение к per-`seq` — избыточно при наличии per-`seq`; если когда-нибудь понадобится, оформляется как новое решение;
- массив `modifiers: [{ kind, ... }]` как форма записи. Закрытый плоский набор именованных полей — намеренно: каждое поле имеет свою семантику (replace vs add), и discriminated union по `kind` не упрощает ни авторскую, ни runtime-сторону;
- override `behavior` (per-spawn смена `chase ↔ stationary`) и любых других «как существо устроено»-полей. Это «новый архетип», а не «модификатор спавна». Такие задачи должны идти через `content/enemies.md`, не через override. В частности, «стационарная турель» в 020 — это новый общий архетип `slime-idol` в `content/enemies.md` ([../stories/020-shooting-slimes.md](../stories/020-shooting-slimes.md)), а не override `behavior` существующего слайма;
- per-archetype default loadout на `EnemyArchetype` («слайм-X всегда стреляет») — сознательно вне 020. Решение 020 проходит по принципу «стрельба = контекст появления, не идентичность». Если архетип реально стреляет везде и всегда, это решается дублированием `loadout` в каждом spawn-override, либо отдельным design-решением о поле архетипа (тогда правило override меняется на replace-or-archetype-default, а не replace-or-`null`);
- сосуществование `EnemyArchetype.carrierDrop` и spawn-override параллельно. Миграция жёсткая, форки удаляются в истории 019;
- шаблоны/наследование между файлами `content/sessions/<preset>.md`. Каждый пресет живёт самостоятельно (это уже зафиксировано в [content-authoring.md](content-authoring.md), здесь повторяется только как след «не делать заодно»);
- `loadout` для `spawnPlan.kind === 'boss'`. Boss-стрельба остаётся за `BossPhaseSystem` ([boss-encounter.md](boss-encounter.md)), не за firing path не-игрока. Override-таблица для `'boss'` плана уже запрещена правилом «присутствие override-таблицы допустимо только при `spawnKind ∈ {wave, static}`» — поле `loadout` это правило не ослабляет.

## Consequences

- `content/enemies.md` сжимается на семь форков (`campaign-set-1..5-carrier-slime`, `demo-carrier-slime`, `demo-retaliator-slime`); в нём остаются только «настоящие» виды слаймов. Партиция `## Carrier Drops` исчезает целиком.
- Контекстные особенности конкретных волн (carrier-щели сетов, демо-retaliator) остаются ровно там, где их и редактирует геймдизайнер — в `content/sessions/<presetId>.md`. Один файл = один пресет; одна строка = одна особенность.
- Runtime-системы упрощаются: `DropSystem` больше не лезет в `EnemyArchetype` за `dropTable`/`carrierDrop` — он читает резолвленные поля сущности, что унифицирует обработку с уже существующим правилом «копировать поля архетипа на runtime-сущность» из [drops.md](drops.md). `RetaliationSystem` уже читает `target.retaliation`, и единственное изменение для него — источник этого поля (override-or-archetype, а не только archetype).
- `validateEnemyRegistry` сжимается до проверок, которые действительно про архетип (stationary invariants, tunneling, валидность архетипного dropTable). Cross-area проверка «гарантированный дроп существует» уезжает туда, где живёт ссылка — в валидатор сессий ([content-authoring.md](content-authoring.md), раздел «Multi-file области», правило двойной валидации cross-area refs).
- Тесты `DropSystem`/`SpawnSystem`/`RetaliationSystem`, которые сегодня опираются на `EnemyArchetype.carrierDrop`, переписываются на «подать override через спавн-план», что лучше отражает реальный путь данных в продакшне.
- Расширение в 020 (`loadout` как поле override) укладывается в этот же закрытый плоский набор полей: добавляется одно `loadout?: Loadout` без структурных изменений в SpawnSystem (firing path для не-игрока — отдельная история). Никаких контрактных коллизий не возникает: `Loadout` уже зафиксирован в [content-archetypes.md](content-archetypes.md) и [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md), и его пере-использование в override — естественное продолжение «контекст появления, а не идентичность».
- Кампания после миграции воспроизводится байт-в-байт на одном `seed`: `guaranteedDrops` спавнятся без RNG, dropTable replace для carrier-щелей сводится к `dropTable: []` (что эквивалентно сегодняшнему `[heal-orb | 0]` форка-карьера, у которого entry с `chance = 0` никогда не выигрывает), retaliation для одной демо-щели берётся из override и совпадает с сегодняшней архетипной политикой форка. Это конкретно покрывается detereministic regression-тестом из 019.
- Появляется новый ровно-одно-место-правды для «контекст появления»: следующая история, которой захочется добавить ещё одну особенность спавна (например, alternate цвет для рендера или временный modifier), будет вводить новое поле в `SpawnOverride`, а не плодить новые форки архетипов.
- Поле `loadout` (story 020) подтверждает работоспособность принципа: добавление крупной новой механики («слаймы стреляют») сводится к одному optional-полю в закрытом наборе, без структурных изменений в `SpawnSystem` и без новых kind спавн-плана. Стоимость — одно правило в валидаторе и две новые колонки в MD-таблице override; всё runtime-поведение (firing path, тик-фаза, cleanup) живёт отдельно в [non-player-firing.md](non-player-firing.md). Это иллюстрация дизайна «контекст появления»: даже стреляющий слайм описан тем же закрытым плоским набором.

## Related

- [content-archetypes.md](content-archetypes.md)
- [spawn-plan.md](spawn-plan.md)
- [session-definition.md](session-definition.md)
- [drops.md](drops.md)
- [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)
- [content-authoring.md](content-authoring.md)
- [content-boundaries.md](content-boundaries.md)
- [snapshot-shape.md](snapshot-shape.md)
- [boss-encounter.md](boss-encounter.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [non-player-firing.md](non-player-firing.md)
- [../stories/019-spawn-overrides.md](../stories/019-spawn-overrides.md)
- [../stories/020-shooting-slimes.md](../stories/020-shooting-slimes.md)
