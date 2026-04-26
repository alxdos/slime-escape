# Non-Player Firing

- Status: accepted
- Created: 2026-04-25
- Updated: 2026-04-26 (correction: WeaponInstance слаймов живут **не на сущности `enemy`**, а в том же `shooterWeapons: Map<EntityId, ShooterWeapons>` внутри closure `CombatSystem`, что и player loadout. Реальность 017: `ShooterWeapons.ownerKind` уже поддерживает `'enemy'`/`'boss'`, `setPlayerLoadout(playerId, loadout, simTimeMs)` — единственный путь инициализации loadout в CombatSystem, cleanup только через `combat.clear()` на session start/stop. Для слаймов вводятся симметричные `setEnemyLoadout` / `removeShooter` APIs + callback от SpawnSystem для wiring. Прошлая формулировка «поля `weapons`/`selectedWeaponIndex` на runtime-сущности `enemy`, cleanup автоматический через удаление сущности» — неверна.)

## Context

[universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md) фиксирует общую модель оружия: `WeaponArchetype` + owner-local `WeaponInstance`, fire patterns, projectile motion, explosions, fragments, weapon modifier drops, `slimeFriendlyFire`. [projectiles-and-combat.md](projectiles-and-combat.md) фиксирует, что `CombatSystem` — единственный owner firing decisions, projectile motion, hit detection, explosion resolution и damage-intent production. На горизонте 017 фактическая firing path задействована только для **игрока**: `RuntimeInputState.firing` + `aimWorld` → выбранный `WeaponInstance` → `fireWeaponProjectiles`.

Story 019 ввела поле override `SpawnOverride` для per-spawn характеристик (`guaranteedDrops`/`dropTable`/`retaliation`). Story 020 расширяет этот закрытый набор четвёртым полем `loadout` ([spawn-overrides.md](spawn-overrides.md)) — выдача оружия конкретному спавну слайма. Поле само по себе ничего не делает: чтобы стрелял реальный снаряд, нужна **firing path для не-игрока**, которой сегодня нет.

Boss-стрельба отдельный случай и не входит в этот контракт: она остаётся за `BossPhaseSystem` ([boss-encounter.md](boss-encounter.md)), у которого собственный набор фаз и аттак-id. Решение здесь касается только `enemy`-сущностей, получивших effective `loadout` через spawn-override.

Без явного контракта story 020 неявно зафиксирует, где живёт state стреляющего слайма (на сущности? в side-table? в `CombatSystem` собственный `Map`?), как выбирается aim (умный? наивный?), в какой фазе тика стреляет (та же, что игрок? своя?) и как чистится после смерти. Каждый из этих вопросов — устойчивое архитектурное правило, влияющее на детерминизм, тестируемость и на любые будущие AI-расширения.

## Decision

### Зона действия

- Это решение касается firing path **только для `kind: 'enemy'`**, у которых effective `loadout` — не `null` после применения spawn-override.
- Boss firing (`kind: 'boss'`) — out of scope. Boss остаётся на `BossPhaseSystem`. Если когда-нибудь boss мигрирует на универсальную модель оружия, это будет отдельное решение, ссылающееся на этот файл.
- Player firing (`kind: 'player'`) — out of scope. Player firing path уже зафиксирована в [projectiles-and-combat.md](projectiles-and-combat.md) и [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md); этот файл её не переоткрывает.
- AI-таргетинг (line-of-sight, упреждение, кайтинг, выбор цели по приоритету, переключение оружия по фазам) — out of scope. На этом горизонте «стреляющий слайм» — наивный bot: смотрит в текущую позицию игрока, стреляет, когда cooldown готов.

### Где живёт WeaponInstance слайма

- `WeaponInstance` слаймов живёт **в том же `shooterWeapons: Map<EntityId, ShooterWeapons>` внутри closure `CombatSystem`**, что и player loadout. Никаких новых полей на runtime-сущности `enemy` не вводится.
- `ShooterWeapons` уже зафиксирован в реализации 017 со всеми нужными дискриминаторами:
  ```ts
  type ShooterWeapons = {
    ownerKind: 'player' | 'enemy' | 'boss';
    weapons: WeaponInstance[];
    selectedIndex: number | null;
  };
  ```
- Это не side-table «на будущее»: player loadout сегодня уже хранится именно здесь, `setPlayerLoadout(playerId, loadout, simTimeMs)` и `clear()` — единственные его мутаторы. Добавление слаймов расширяет использование той же структуры, а не вводит параллельную.
- Симметрично player API вводятся два новых метода `CombatSystem`:
  ```ts
  setEnemyLoadout(enemyId: EntityId, loadout: Loadout, simTimeMs: number): void;
  removeShooter(entityId: EntityId): void;
  ```
  `setEnemyLoadout` повторяет инвариант `setPlayerLoadout` дословно: валидация `selectedIndex` в `[0, weapons.length)` или `null`, резолв `weaponArchetypeId` в `weaponRegistry` (throw на unknown), вызов `createWeaponInstance` для каждого id, запись в `shooterWeapons.set(enemyId, { ownerKind: 'enemy', weapons, selectedIndex })`. Запрет пустого `weapons: []` у player-а переносится и сюда — если effective loadout — `null` (нет оружия), `setEnemyLoadout` просто **не вызывается** (см. ниже «Wiring»).
  `removeShooter(entityId)` — это `shooterWeapons.delete(entityId)`. Единственный мутатор per-entity cleanup-а для слайм-state-а.
- Инициализация `WeaponInstance[i]` в `setEnemyLoadout` идёт через тот же `createWeaponInstance(archetypeId, simTimeMs)`, что player: `nextFireSimMs = simTimeMs + archetype.cooldownMs`, `modifiers: []`, `overdriveUntilSimMs/overdriveCooldownMultiplier: null`. Это обеспечивает детерминированный first-shot delay (см. ниже) без дублирования правил инициализации.
- Слаймы **не получают** weapon modifier drops. `addWeaponModifierToSelectedWeapon`/`applyTemporaryOverdriveToSelectedWeapon` ([drops.md](drops.md), [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)) применяются только к player-owned `WeaponInstance`. Для слаймов нет canonical пути «передать modifier по ownerId», и 020 такого пути не вводит. Если позже понадобятся «бафнутые слаймы», это отдельное решение.

### Wiring (SpawnSystem → CombatSystem и death hook)

- `createSpawnSystem` получает опциональный параметр factory-options:
  ```ts
  type SpawnSystemOptions = {
    onEnemySpawned?: (enemyId: EntityId, loadout: Loadout, simTimeMs: number) => void;
  };
  ```
  При создании любой сущности `enemy` (в `executeStatic`, `spawnNextWaveEnemy` и любых будущих путях) — если effective `loadout` **не `null`** (resolve: `override.loadout ?? null` по [spawn-overrides.md](spawn-overrides.md)) — SpawnSystem вызывает callback с `(enemyId, loadout, simTimeMs)`. Если effective loadout — `null`, callback не вызывается, и слайм остаётся без записи в `shooterWeapons` (это и есть «у этого спавна оружия нет, он не стреляет»).
- Для static-спавнов `simTimeMs` в callback приходит из нового аргумента `SpawnSystem.onEncounterStart(encounter, store, arena, simTimeMs)` — точки вызова уже находятся в `SessionFlowSystem.onEncounterStart`, где `simTimeMs` доступен. Для wave-спавнов `simTimeMs` приходит из обычного `onTick(simTimeMs, entities)`. Расширение signature `onEncounterStart` — минимальная правка границы SpawnSystem, не новое правило.
- В worker (`src/sim/worker.ts`):
  - при создании SpawnSystem передаётся callback, обёрнутый над `combat`:
    ```ts
    const spawn = createSpawnSystem({
      onEnemySpawned(enemyId, loadout, simTimeMs) {
        combat.setEnemyLoadout(enemyId, loadout, simTimeMs);
      }
    });
    ```
  - в существующий death hook добавляется одна строка:
    ```ts
    healthDeath.registerHook((ctx) => {
      // ...существующие hooks...
      if (ctx.entityKind === 'enemy') combat.removeShooter(ctx.entityId);
    });
    ```
    Порядок в death hook не важен для корректности (все hooks синхронные и не мутируют HP), но условно ставится рядом с `drops.onDeathHook(...)` по той же теме «enemy-death consequences».
- На `sessionStart`/`sessionStop` (и при win/loss) `combat.clear()` продолжает делать ту же работу, что и сегодня — чистит **весь** `shooterWeapons`, включая любые записи слаймов. Никаких дополнительных правок lifecycle.

### Cooldown инициализация и first-shot delay

- `nextFireSimMs = simTimeMsAtSpawn + cooldownMs` для каждого `WeaponInstance` слайма. Значение инициализируется ровно в `createWeaponInstance(archetypeId, simTimeMsAtSpawn)` внутри `setEnemyLoadout` — тот же helper, что использует `setPlayerLoadout`. Слайм заряжает оружие ровно один полный cooldown до первого выстрела.
- Это даёт игроку детерминированное окно реакции (`cooldownMs` миллисекунд между «слайм появился» и «слайм выстрелил»), и одновременно не вводит новых конфигурационных полей. `cooldownMs` уже несёт `WeaponArchetype` ([content-archetypes.md](content-archetypes.md)).
- Никаких рандомных jitter-ов в стартовом cooldown. Deterministic regression-тест должен видеть один и тот же `simTime` первого `fire` event-а от слайма для одинакового `seed` и одинакового момента спавна.
- Если позже понадобится «слайм стреляет сразу» или «удлинённый warmup для турелей», это вводится либо новым полем `WeaponArchetype.firstShotDelayMs`, либо отдельным `loadout.firstShotDelayOverrideMs`. На этом горизонте оба отсутствуют сознательно.

### Aim picking

- Aim для слайма — наивный, без AI:
  ```ts
  const dx = player.position.x - enemy.position.x;
  const dy = player.position.y - enemy.position.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return /* пропустить выстрел этого тика */;
  const length = Math.sqrt(lengthSq);
  aim = { x: dx / length, y: dy / length };
  ```
- `player === null` (игрок мёртв и удалён) → фаза firing decisions для всех слаймов — no-op. Это уже общий контракт «системы толерантны к `player === null`» из [health-and-death.md](health-and-death.md). Применяется одинаково для всех слаймов: ни один выстрел не уходит на «последнюю известную позицию игрока».
- Zero-length aim (слайм встал вплотную на игрока, центр-в-центр) → выстрел этого тика пропущен. Это уже фиксировано общим правилом `single`/`multiDirection` из [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md): «requires a valid aim direction; if the aim direction has zero length, no shot is fired».
- Для `place`-fire-pattern (`bomb-placer`) aim не требуется: бомба ставится в позицию владельца. Слайм-бомбер с `bomb-placer` будет ставить бомбы вокруг себя независимо от позиции игрока. Это намеренно делает «минное поле» из стационарных bomb-placer-слаймов читаемым.
- Для `multiDirection` (`fireball-staff`) aim используется как «опорное направление» 4-х fireballs. Слайм-обелиск с `fireball-staff` отправляет четыре fireball: один в игрока + три по крестообразным offset-ам. Это уже описано в [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md), здесь — только напомнить, что слайм использует **тот же** механизм, что игрок.

### Тик-фаза

- Стрельба слайма выполняется в **той же фазе 1** «firing decisions» внутри `CombatSystem` ([projectiles-and-combat.md](projectiles-and-combat.md), раздел «Tick order inside CombatSystem»), что и стрельба игрока.
- Сегодняшняя приватная функция `runFiringDecisions(input, store, simTimeMs, shooterWeapons, weaponRegistry, emit)` в `CombatSystem.ts` разносится на две:
  - `runPlayerFiringDecisions(input, store, simTimeMs, shooterWeapons, weaponRegistry, emit)` — переименование текущего тела, поведение не меняется ни в одном байте; она и так уже читает `input.firing`/`input.aimWorld` и ищет `shooterWeapons.get(player.id)`;
  - `runEnemyFiringDecisions(store, simTimeMs, shooterWeapons, weaponRegistry, emit)` — новая. Не читает `input`; в реальной runtime-интеграции слаймы не знают про `RuntimeInputState`.
- Порядок вызова внутри фазы 1 (детерминированный, важен для replay и event-ordering теста):
  1. `runPlayerFiringDecisions(...)`;
  2. `runEnemyFiringDecisions(...)`;
  3. boss firing уже идёт отдельной фазой через `BossPhaseSystem` и в этот порядок не вклинивается: boss остаётся на своём контракте ([boss-encounter.md](boss-encounter.md)).
- Порядок итерации внутри `runEnemyFiringDecisions`:
  - пройти по `store.enemies()` в порядке возрастания `EntityId` (стабильный детерминированный порядок, который даёт `EntityStore`); для каждой живой сущности сделать `shooterWeapons.get(enemy.id)` и обработать запись с `ownerKind === 'enemy'`;
  - альтернатива «итерировать `shooterWeapons.entries()` с фильтром по ownerKind» допустима, если keys поддерживаются в детерминированном порядке insertion; на горизонте 020 первый путь проще и совпадает с контрактом broadphase/snapshot, который тоже идёт через `store.enemies()`.
- Per-enemy логика в `runEnemyFiringDecisions` (симметрично player-пути):
  - если `shooterWeapons.get(enemy.id)` — `undefined`, пропуск (слайм не получал loadout);
  - если `selectedIndex === null` — пропуск;
  - если сущность помечена мёртвой на этом тике (см. «Cleanup на смерти») — пропуск;
  - `weapon = weapons[selectedIndex]`; если `simTimeMs < weapon.nextFireSimMs` — пропуск;
  - вычислить aim (см. «Aim picking»), skip-правила для zero-length aim и `player === null` уже покрыты;
  - резолвить `archetype = weaponRegistry[weapon.archetypeId]`; вызвать **тот же** `fireWeaponProjectiles(store, archetype, weapon.modifiers, enemy.id, 'enemy', enemy.position, aim, simTimeMs)`, что использует player-путь;
  - `weapon.nextFireSimMs = simTimeMs + effectiveCooldownMs(archetype.cooldownMs, weapon, simTimeMs)` — тот же `effectiveCooldownMs`, что для player. `overdriveCooldownMultiplier` для слайма всегда `null`, но helper един;
  - публиковать `fire` event с `shooterId: enemy.id`, `ownerKind: 'enemy'`, `originX/Y: enemy.position.x/y`, `dirX/Y: result.eventDirection` — форма events уже зафиксирована в [snapshot-shape.md](snapshot-shape.md).

### Cleanup на смерти

- Главный инвариант: **мёртвый слайм не стреляет, в том числе на тике своей смерти.**
- Два уровня защиты, взаимно согласованные:
  1. **Per-entity removeShooter из death hook.** Worker регистрирует в death hook строку `if (ctx.entityKind === 'enemy') combat.removeShooter(ctx.entityId);` (см. «Wiring»). Это очищает запись в `shooterWeapons` синхронно в фазе 4 death-hooks ([health-and-death.md](health-and-death.md)). На любом последующем тике `runEnemyFiringDecisions` уже не найдёт этот id в `shooterWeapons.get(...)` и естественным образом пропустит сущность.
  2. **Same-tick guard в `runEnemyFiringDecisions`.** Фаза 1 «firing decisions» идёт на том же тике **раньше** фазы 5 «impact detection» и фазы `HealthDeathSystem`, которая и делает death hooks. Значит, на тике, когда слайм умирает, его запись в `shooterWeapons` ещё есть во время `runEnemyFiringDecisions`. Но сама сущность на этой точке уже **либо жива и её HP > 0** (death hook ещё не сработал), **либо** её нет в `store.enemies()` — оба случая покрыты тем, что итерация идёт через `store.enemies()`: удалённый enemy там не возвращается. Для добавочной страховки (смерть от же-тика-intent до фазы 1 в будущем) допустимо явно проверять `enemy.hp > 0` в per-enemy loop — это no-op на сегодняшнем порядке, но защита на случай будущих пересадок.
- Уже летящие снаряды (`Projectile.ownerId === deadEnemy.id`) **не отзываются** при смерти владельца. Они продолжают по своей траектории, наносят урон по обычным правилам, корректно ведут explosion-фазу. `ownerKind === 'enemy'` фильтрация в damage rules продолжает работать. `ownerId`-exclusion корректен даже после удаления владельца: `EntityStore.byId(ownerId)` после удаления возвращает `null`, snaphot не содержит мёртвую сущность, и фактическое пересечение со «своим» broadphase-целевым объектом невозможно.
- На `sessionStart`/`sessionStop`/win/loss вся очистка идёт через существующий `combat.clear()`, который обнуляет **весь** `shooterWeapons` целиком, включая записи слаймов. Дополнительных session-lifecycle-хуков не нужно.
- Death event (`kind: 'death'`, [snapshot-shape.md](snapshot-shape.md)) для слайма публикуется **до** runDeathHooks; никаких новых полей в death event для стреляющих слаймов не вводится. Если позже понадобится «знать, что умер именно стрелок», это решается потребителем через resolve `archetypeId` → loadout-наличие на стороне content (но контракт смерти не расширяется).

### Friendly-fire фильтр и единый damage-rule helper

- `slimeFriendlyFire: false` фильтрует enemy-to-enemy урон. Это уже зафиксировано в [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md) и [projectiles-and-combat.md](projectiles-and-combat.md), раздел «Damage rules», как «централизованный helper, используемый impact, explosion, proximity-trigger checks и future field effects».
- Story 020 не вводит новый damage rule. Она только закрепляет уже существующий **инвариант helper-а**: и **impact**-фаза, и **explosion**-фаза `CombatSystem` обязаны использовать **один и тот же** `canDamageTarget(projectile, target, sessionRules)` helper. Дублирующая ad-hoc проверка во второй фазе запрещена. Регрессионный тест: при `slimeFriendlyFire: false` другой слайм, попавший в радиус взрыва соседа-гранатомёта, не получает HP-урон и не публикует `hit`/`death` event-ов.
- Это явное напоминание ровно потому, что story 020 первой реально нагружает explosion-фазу слайм-снарядами в продакшн-кампании. Любая ад-хок ветка вида «ну для слайм-гранат проверим иначе» — нарушение этого инварианта.

### Audio

- Звук выстрела слайма идёт через те же `WEAPON_AUDIO_MAPPINGS` ([audio.md](audio.md)), что и для игрока. Связь `weaponArchetypeId → sampleId` едина для всех `ownerKind`. Никакого «второй sampleId для слайм-варианта пистолета» не вводится: тот же `weapons/pistol.mp3` звучит и из игрока, и из слайма.
- Если позже захочется акустически отличать «враждебный выстрел» (pitch-shift, alternate pool), это будет расширение [audio.md](audio.md), не правка этого файла.
- Сценарий «звук слайм-выстрелов читается как враждебный» из Acceptance story 020 покрывается визуальной парой «снаряд видим + landing-telegraph для arc + impact-направление от не-игрока», а не отдельным звуком.

### Что этот файл намеренно не описывает

- AI-таргетинг любого вида (LoS, упреждение, кайтинг).
- Переключение оружия слаймом по ходу боя или по фазам HP.
- Бафф/дебафф `WeaponInstance` слайма во время игры.
- Стрельбу босса (живёт в `BossPhaseSystem` / [boss-encounter.md](boss-encounter.md)).
- Pre-shot preview / muzzle-flash UX для слайм-выстрела на main-thread (если когда-нибудь захочется — это расширение [impact-feedback.md](impact-feedback.md), не этого файла).
- Per-archetype default loadout (см. запреты в [spawn-overrides.md](spawn-overrides.md)).

## Consequences

- `CombatSystem` остаётся единственным owner firing decisions для всех `ownerKind`. Расширение — две новые приватные функции (`runPlayerFiringDecisions` как переименование текущей + `runEnemyFiringDecisions` как новая) и два новых публичных API (`setEnemyLoadout`, `removeShooter`) на том же `ShooterWeapons`-реестре, что и player loadout. Никаких новых системных границ, никаких side-tables, параллельных существующим.
- `EntityStore` для сущности `enemy` **не получает** новых полей. Это устраняет проектную асимметрию с player-ом, у которого loadout тоже не на сущности.
- Детерминизм относительно `seed` сохраняется: aim — чистая функция текущих позиций, cooldown — целочисленные ms, порядок `runPlayerFiringDecisions → runEnemyFiringDecisions` внутри фазы 1 закреплён, итерация слаймов идёт по `store.enemies()` в порядке `EntityId`.
- Friendly-fire фильтр в explosion-фазе становится критичным для UX hard-кампании story 020 (минное поле сета 4): без него слаймы-бомберы зачищают сет сами. Закрепление инварианта «один helper на impact и explosion» (`canDamageTarget` из `src/sim/DamageRules.ts`) защищает от регрессии. В реализации 017 этот helper уже общий — задача ист 020 в этой части сводится к регрессионному тесту, не к рефакторингу.
- Расширение «слайм с временным overdrive» или «слайм с modifier-ами» на этом горизонте не нужно и не вводится: `addModifierToSelectedWeapon`/`applyTemporaryOverdriveToSelectedWeapon` — player-only, для слаймов не вызывать. Если нужно — новое decision.
- Тестируемость: unit-тест `CombatSystem.enemyFire` может напрямую вызвать `combat.setEnemyLoadout(enemyId, loadout, simTime)` и тиктать систему; ассерт — на `simTime + cooldownMs` появился `fire` event с `ownerKind: 'enemy'`, на следующем тике после `cooldownMs` — ещё один, после `removeShooter(enemyId)` — ни одного. Никаких worker-фикстур, никаких EntityStore-модификаций.
- Полная плата за «слаймы стреляют»: одно optional-поле в `SpawnOverride` ([spawn-overrides.md](spawn-overrides.md)), два новых публичных API на `CombatSystem`, одна новая приватная функция + переименование существующей, один новый callback в `createSpawnSystem`-options, одна строка в death hook worker-а, один новый аргумент `simTimeMs` в `SpawnSystem.onEncounterStart`. Ни новых kind в snapshot, ни новых runtime events, ни новых систем, ни новых полей на runtime-сущности `enemy`.

## Related

- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [spawn-overrides.md](spawn-overrides.md)
- [content-archetypes.md](content-archetypes.md)
- [health-and-death.md](health-and-death.md)
- [snapshot-shape.md](snapshot-shape.md)
- [boss-encounter.md](boss-encounter.md)
- [audio.md](audio.md)
- [rng.md](rng.md)
- [testing.md](testing.md)
- [landing-telegraph.md](landing-telegraph.md)
- [../stories/020-shooting-slimes.md](../stories/020-shooting-slimes.md)
