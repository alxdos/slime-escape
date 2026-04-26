# Non-Player Firing

- Status: accepted
- Created: 2026-04-25
- Updated: 2026-04-25

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

- `WeaponInstance` для слайма живёт **на самой runtime-сущности `enemy`** в `EntityStore`, симметрично игроку.
- Минимальные новые поля сущности:
  ```ts
  type EnemyRuntimeFields = {
    // существующие поля из 019
    guaranteedDrops: ReadonlyArray<string>;
    dropTable: ReadonlyArray<DropTableEntry>;
    retaliation: RetaliationPolicy;
    // новые поля 020
    weapons: WeaponInstance[];                 // пустой массив = нет оружия
    selectedWeaponIndex: number | null;        // null = нет оружия или holstered
  };
  ```
- Если `override.loadout` не задан, `SpawnSystem` материализует `weapons: []` и `selectedWeaponIndex: null`. Никаких внутренних `Map<EntityId, WeaponInstance[]>` или side-tables в `CombatSystem` не вводится: state живёт строго рядом с сущностью. Это устраняет второй источник правды и автоматически чистит state на смерти (см. ниже).
- Инициализация `WeaponInstance` при материализации:
  ```ts
  weapons[i] = {
    archetypeId: loadout.weapons[i],
    nextFireSimMs: simTimeAtSpawn + WEAPON_ARCHETYPES[loadout.weapons[i]].cooldownMs,
    modifiers: [],
    overdriveUntilSimMs: null,
  };
  selectedWeaponIndex = loadout.selectedIndex;
  ```
- Слаймы **не получают** weapon modifier drops. Apparat `addWeaponModifier`/`temporaryOverdrive` ([drops.md](drops.md), [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)) применяется только к player-owned `WeaponInstance`. Если позже понадобятся «бафнутые слаймы», это отдельное решение.

### Cooldown инициализация и first-shot delay

- `nextFireSimMs = simTimeAtSpawn + cooldownMs` для каждого `WeaponInstance` слайма. Слайм заряжает оружие ровно один полный cooldown до первого выстрела.
- Это даёт игроку детерминированное окно реакции (`cooldownMs` миллисекунд между «слайм появился» и «слайм выстрелил»), и одновременно не вводит новых конфигурационных полей. `cooldownMs` уже несёт `WeaponArchetype` ([content-archetypes.md](content-archetypes.md)).
- Никаких рандомных jitter-ов в стартовом cooldown. Detereministic regression-тест должен видеть один и тот же `simTime` первого `fire` event-а от слайма для одинакового `seed` и одинакового момента спавна.
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
- Порядок внутри фазы 1 (детерминированный, важен для replay и для теста, фиксирующего `fire`-event ordering):
  1. **Player firing decisions.** `CombatSystem` пытается выстрелить из выбранного игрового `WeaponInstance` с учётом `RuntimeInputState.firing` и `aimWorld`.
  2. **Enemy firing decisions.** `CombatSystem` итерирует по сущностям `kind: 'enemy'` в порядке возрастания `EntityId` (стабильный детерминированный порядок). Для каждой:
     - если `selectedWeaponIndex === null` или `weapons.length === 0` — пропуск;
     - если на этом тике сущность помечена «умерла» (см. ниже) — пропуск;
     - выбрать `weapon = weapons[selectedWeaponIndex]`;
     - если `simTime < weapon.nextFireSimMs` — пропуск;
     - вычислить aim (см. выше);
     - вызвать `fireWeaponProjectiles({ ownerId: enemy.id, ownerKind: 'enemy', weaponInstance: weapon, position: enemy.position, aim })` через тот же helper, что использует player firing path;
     - `weapon.nextFireSimMs = simTime + effectiveCooldownMs(weapon)` (тот же `effectiveCooldownMs`, что для игрока — учитывает `temporaryOverdrive`, который для слайма всегда `null` на этом горизонте, но helper един).
  3. **Boss firing decisions.** Уже зафиксировано: `BossPhaseSystem` сам решает, когда стрелять, и при необходимости использует тот же `fireWeaponProjectiles`-helper. Сюда не вмешивается.
- Порядок «player → enemy → boss» — это контракт. Тест на event ordering на одном `seed` обязан видеть одну и ту же последовательность `fire` events.

### Cleanup на смерти

- Главный инвариант: **мёртвый слайм не стреляет, в том числе на тике своей смерти.**
- Реализация — единственным правилом «target жив» в начале фазы 2 («Enemy firing decisions», см. выше). Источник правды — `EntityStore.isAlive(enemyId)` или эквивалентный флаг «сущность не помечена к удалению на этом тике». Это согласовано с шагом 1 из [health-and-death.md](health-and-death.md), раздел «Применение урона и фиксация смерти», и с уже существующей «толерантностью систем к `player === null`».
- Уже летящие снаряды (`Projectile.ownerId === deadEnemy.id`) **не отзываются** при смерти владельца. Они продолжают по своей траектории, наносят урон по обычным правилам, корректно ведут explosion-фазу. `ownerKind === 'enemy'` фильтрация в damage rules продолжает работать. Это совпадает с общим правилом из [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md) («The projectile owner is excluded from damage by default» — ownerId-exclusion остаётся валидным даже после удаления владельца, потому что `EntityStore.byId(ownerId)` после удаления вернёт `null` и broadphase его не вернёт).
- `weapons[]` и `selectedWeaponIndex` — поля сущности. На `HealthDeathSystem.removeDead()` сущность исчезает из `EntityStore`, instance-state уходит вместе с ней. Никакого отдельного «cleanup hook»-а не нужно.
- Death event (`kind: 'death'`, [snapshot-shape.md](snapshot-shape.md)) для слайма публикуется до runDeathHooks; никаких новых полей в death event для стреляющих слаймов не вводится. Если позже понадобится «знать, что умер именно стрелок», это решается потребителем через resolve `archetypeId` → loadout-наличие на стороне content (но контракт смерти не расширяется).

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

- `CombatSystem` остаётся единственным owner firing decisions для всех `ownerKind`. Внутри фазы 1 добавляется один новый под-цикл по сущностям `enemy` с непустым loadout — без новых системных границ.
- `EntityStore` получает два новых поля на сущности `enemy`. Это симметрично игроку и не требует side-tables, что упрощает cleanup и serialization.
- Детерминизм относительно `seed` сохраняется: aim — чистая функция текущих позиций, cooldown — целочисленные ms, порядок «player → enemy in EntityId order → boss» закреплён.
- Friendly-fire фильтр в explosion-фазе становится критичным для UX hard-кампании story 020 (минное поле сета 4): без него слаймы-бомберы зачищают сет сами. Закрепление инварианта «один helper на impact и explosion» защищает от регрессии.
- Расширение «слайм с временным overdrive» или «слайм с modifier-ами» на этом горизонте не нужно и не вводится. Если нужно — это новое decision.
- Тестируемость: unit-тест `CombatSystem.enemyFire` подаёт сущность с `loadout: { weapons: ['pistol'], selectedIndex: 0 }`, ставит игрока на расстоянии и тиктает; ассерт — на `simTime + cooldownMs` появился `fire` event с `ownerKind: 'enemy'`, на следующем `cooldownMs` ещё один. Никаких worker-фикстур.
- Полная плата за «слаймы стреляют»: одно optional-поле в `SpawnOverride`, два новых поля на `enemy`-сущности, один под-цикл в фазе 1 `CombatSystem`. Ни новых kind в snapshot, ни новых runtime events, ни новых систем.

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
