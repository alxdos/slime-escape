# Snapshot Shape

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-26 (story 024: terminal `win`/`loss` runtime events carry `SessionResultSummary`; authoritative result stats are defined in [session-result-summary.md](session-result-summary.md). Earlier story 022: `WeaponHudSnapshot` получает cooldown interval (`cooldownStartedAtSimMs`/`cooldownReadyAtSimMs`), permanent `modifiers` and active `timedEffects` for the weapon-slot HUD; presentation contract lives in [hud-presentation.md](hud-presentation.md). Earlier: 2026-04-25 story 020: `ProjectileSnapshot` получает обязательное поле `arcEnd: { x: number; y: number } | null` — fixed мировая позиция приземления для arc-снаряда в `state: 'flying'`, `null` для grounded и для linear/placed motion. Источник правды — `CombatSystem` в момент создания снаряда; `SnapshotExportSystem` копирует значение, не пересчитывает. Render-контракт landing-telegraph для in-flight arc от не-игрока — [landing-telegraph.md](landing-telegraph.md). Earlier: 2026-04-24 017 alignment: projectile snapshots and combat events support universal projectile state, owner `boss`, grounded/explosive presentation, selected weapon HUD and explosion events; see [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). 018 alignment: `fieldEffect` and status presentation fields are reserved for [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md). Earlier: 016 impact feedback, 006 boss, 005 drops.)

## Context

[thread-model.md](thread-model.md) фиксирует разделение между периодическим состоянием (`snapshot`) и точечными фактами (`runtime events`), а также правило: каждая сущность в снапшоте несёт стабильный дискриминатор `kind`. Конкретные поля per-kind и поля каждого runtime event там сознательно оставлены open «по мере появления систем».

В 002 этого хватало (только `kind: 'player'`, минимальные lifecycle events). История 003 одновременно вводит:

- два новых типа сущностей в снапшоте — `enemy` и `projectile`;
- три новых runtime events — `fire`, `hit`, `death`.

Без явного контракта эти формы будут зафиксированы по месту в 003, после чего 004 (волны), 005 (дроп), 006 (босс), 007 (HUD), 008 (audio) каждый раз будут расширять/переименовывать поля. Это решение задаёт базовую форму на весь горизонт MVP.

## Decision

### Общие правила

- Снапшот несёт только **меняющееся** state. Immutable конфигурация сессии (`arena`, исходные `player`, набор `encounters`) уже у `main` через `SessionDefinition` ([thread-model.md](thread-model.md)).
- Каждая сущность в `snapshot.entities` обязана иметь стабильный `id` (тот же между снапшотами, пока сущность жива) и `kind` из конечного union-а ниже.
- Поля сущностей — **только то, что нужно для рендера и HUD текущего поколения**. Поля для будущих систем добавляются вместе с историей, которой они нужны, и фиксируются здесь.
- Удалённая сущность (после `HealthDeathSystem.removeDead()` или `CombatSystem` despawn) в снапшоте отсутствует. Никаких «надгробий» в `entities`.
- Runtime events — **edge-факты**: каждое сообщение значимо, не обязано повторяться, и его поля выбираются так, чтобы потребитель (HUD/audio/render-эффект) мог среагировать без обращения к снапшоту того же тика.

### Per-kind поля сущности (на горизонт 003–006)

```ts
type EntitySnapshot =
  | PlayerSnapshot
  | EnemySnapshot
  | ProjectileSnapshot
  | DropSnapshot
  | BossSnapshot
  | FieldEffectSnapshot;
```

- `PlayerSnapshot`:
  ```ts
  {
    id: number;
    kind: 'player';
    x: number;
    y: number;
    hp: number;       // целое >= 0
    maxHp: number;    // целое > 0; повторяется в каждом снапшоте, как у enemy
  }
  ```
  Поля `hp`/`maxHp` присутствуют **всегда**, независимо от того, активна ли в текущей сессии `lossCondition: playerDeath`. Это устраняет два разных «нет данных» в HUD и упрощает рендер: для sandbox-сессии без боя `hp = maxHp` всё время.
- `EnemySnapshot`:
  ```ts
  {
    id: number;
    kind: 'enemy';
    archetypeId: string;   // для рендера и аудио по виду врага
    x: number;
    y: number;
    hp: number;
    maxHp: number;          // повторяется в каждом снапшоте; стоимость минимальна, упрощает HUD
  }
  ```
- `ProjectileSnapshot`:
  ```ts
  {
    id: number;
    kind: 'projectile';
    weaponArchetypeId: string;
    ownerKind: 'player' | 'enemy' | 'boss';
    x: number;
    y: number;
    state: 'flying' | 'grounded';
    visualState: {
      angleRadians: number;
      spinRadians: number;
      pulsePhase: number;
    };
    explosionRadius: number | null;
    detonateAtSimMs: number | null;
    arcEnd: { x: number; y: number } | null;
  }
  ```
- `state`, `visualState`, `explosionRadius` and `detonateAtSimMs` are required by story 017 presentation: sprite orientation/spin, grounded pulse and radius indicators must not be inferred from hidden sim state. `detonateAtSimMs` is presentation timing; gameplay detonation remains owned by `CombatSystem`.
- `arcEnd` (story 020) — fixed мировая позиция приземления arc-снаряда в `state: 'flying'`, копируется из runtime `Projectile` без пересчёта на каждом снапшоте; `null` для arc в `state: 'grounded'` (приземление уже произошло) и **всегда** `null` для linear/placed motion. Поле обязательное (значение `null` — единственный способ выразить «не применимо», без `undefined`/`?`-маркера). Полный render-контракт landing-telegraph (когда показывать, размер маркера, исключение для player-owned arc) живёт в [landing-telegraph.md](landing-telegraph.md); сам snapshot не несёт «нужен ли telegraph» — это derive renderer-а из `state + arcEnd + ownerKind`.
- `DropSnapshot` (история 005, см. [drops.md](drops.md)):
  ```ts
  {
    id: number;
    kind: 'drop';
    archetypeId: string;     // DropArchetype.id; рендер выбирает визуал по архетипу
    x: number;
    y: number;
  }
  ```
  `radius`, `effect`, `color`, `expireAtSimMs`, оставшееся время жизни в snapshot не уходят: gameplay-форма дропа (overlap-радиус, эффект) живёт только в `sim`, а render берёт визуал по `archetypeId` из `content library`. Если HUD когда-нибудь захочет «осталось N сек до исчезновения», это будет добавлением поля сюда, не вытаскиванием `expireAtSimMs` «по месту».

- `BossSnapshot` (006, [boss-encounter.md](boss-encounter.md), [content-archetypes.md](content-archetypes.md)):
  ```ts
  {
    id: number;
    kind: 'boss';
    archetypeId: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    phaseIndex: number;
    phaseId: string;
    activeAttackIds: ReadonlyArray<string>;
  }
  ```
- `FieldEffectSnapshot` (018, [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)):
  ```ts
  {
    id: number;
    kind: 'fieldEffect';
    archetypeId: string;
    x: number;
    y: number;
    radius: number;
    expiresAtSimMs: number;
  }
  ```
  Field effect snapshots expose presentation state only. Periodic damage/status application remains in `FieldEffectSystem`.

### Top-level snapshot

- Форма верхнего уровня снапшота на горизонт 004:
  ```ts
  type Snapshot = Readonly<{
    simTimeMs: number;
    entities: ReadonlyArray<EntitySnapshot>;
    encounter: EncounterSnapshot | null;
    zone: ZoneSnapshot;
    waveProgress: WaveProgressSnapshot | null;
    bossHud: BossHudSnapshot | null;
    weaponHud: WeaponHudSnapshot | null;
  }>;
  ```
- HUD-агрегаты уровня run (HP игрока, прогресс волны, состояние босса) живут как отдельные top-level поля, а не складываются в `entities`. Каждое такое расширение фиксируется здесь.
- `bossHud`:
  ```ts
  type BossHudSnapshot = Readonly<{
    entityId: number;
    phaseIndex: number;
    phaseId: string;
    hp: number;
    maxHp: number;
    activeAttackIds: ReadonlyArray<string>;
  }>;
  ```
  Для encounter, у которых `encounter.type !== 'boss'` или активного босса нет, поле **`null`**. Значения дублируют ключевые поля сущности босса для дешёвого чтения HUD без поиска по `entities`; консистентность с сущностью обеспечивает `SnapshotExportSystem`.
- `weaponHud` (017, extended by 022):
  ```ts
  type WeaponTimedEffectHudSnapshot =
    | Readonly<{
        kind: 'temporaryOverdrive';
        cooldownMultiplier: number;
        startedAtSimMs: number;
        expiresAtSimMs: number;
      }>;

  type WeaponHudSnapshot = Readonly<{
    selectedIndex: number | null;
    weapons: ReadonlyArray<Readonly<{
      index: number;
      weaponArchetypeId: string;
      cooldownStartedAtSimMs: number;
      cooldownReadyAtSimMs: number;
      modifiers: ReadonlyArray<WeaponModifier>;
      timedEffects: ReadonlyArray<WeaponTimedEffectHudSnapshot>;
    }>>;
  }>;
  ```
  `null` means the active session has no player loadout. HUD reads selected weapon, cooldown interval, permanent modifiers and active timed weapon effects from this field instead of inspecting runtime weapon instances directly. `cooldownStartedAtSimMs`/`cooldownReadyAtSimMs` define the current or most recent cooldown interval; HUD derives fill from those timestamps and `snapshot.simTimeMs`. `modifiers` contains permanent `WeaponModifier` values copied from the selected owner's weapon instance. `timedEffects` contains only active timed effects at snapshot time (`expiresAtSimMs > snapshot.simTimeMs`); on this horizon the only timed effect is `temporaryOverdrive`. Full render semantics are in [hud-presentation.md](hud-presentation.md).
- Поля 004:
  - `encounter`:
    ```ts
    type EncounterSnapshot = Readonly<{
      id: string;                                      // EncounterDefinition.id
      type: 'wave' | 'break' | 'boss' | 'survivalTimer' | 'sandbox';
      index: number;                                   // позиция в SessionDefinition.encounters
      elapsedMs: number;                               // с момента encounterStart, целое
    }>;
    ```
    `null` означает «активного encounter нет» — между `sessionStart` и активацией первого encounter (промежуток теоретически нулевой, но форма допускает) и после `sessionStop`/`win`/`loss`. До идеального состояния «снапшот всегда несёт encounter, если есть активная сессия» поле остаётся nullable как страховка от расхождения порядков активации.
  - `zone`:
    ```ts
    type ZoneSnapshot = Readonly<{
      mode: 'disabled' | 'shrink' | 'expand';
      margin: number; // wu, >= 0
    }>;
    ```
    Форма и семантика — в [zone.md](zone.md). Поле обязательное и не nullable: `disabled` — это всегда валидное значение для отсутствия активной зоны.
  - `waveProgress`:
    ```ts
    type WaveProgressSnapshot = Readonly<{
      dispatched: number;   // спавнов уже выпущено
      total: number;        // всего по плану
      alive: number;        // живых сущностей, заспавненных текущей волной
    }>;
    ```
    `null` для encounter, у которого `spawnPlan.kind !== 'wave'` (включая `'static'` из 003). Для `'wave'` поле заполняется на каждом тике и доступно HUD/тестам.

### Runtime events: контракт kinds

- К существующим lifecycle kinds из [runtime-systems.md](runtime-systems.md) (`sessionStart`, `sessionStop`, `encounterStart`, `encounterEnd`, `pause`, `resume`) этой историей добавляются три combat-kind, историей 004 — `win` и `loss`, а историей 005 — три drop-kind (`dropSpawn`, `dropPickup`, `dropExpire`):
  ```ts
  type RuntimeEvent =
    // lifecycle (см. runtime-systems.md)
    | { kind: 'sessionStart'; simTime: number }
    | { kind: 'sessionStop'; simTime: number }
    | { kind: 'encounterStart'; simTime: number }
    | { kind: 'encounterEnd'; simTime: number }
    | { kind: 'pause'; simTime: number }
    | { kind: 'resume'; simTime: number }
    // combat (этот файл)
    | {
        kind: 'fire';
        simTime: number;
        shooterId: number;
        ownerKind: 'player' | 'enemy' | 'boss';
        weaponArchetypeId: string;
        originX: number;
        originY: number;
        dirX: number;
        dirY: number;       // нормализованный вектор
      }
    | {
        kind: 'hit';
        simTime: number;
        projectileId: number;
        targetId: number;
        targetKind: 'enemy' | 'player' | 'boss';
        targetArchetypeId: string | null; // enemy/boss id; null for player
        weaponArchetypeId: string;
        damage: number;
        impactDirX: number;     // normalized projectile travel direction
        impactDirY: number;
        x: number;
        y: number;
      }
    | {
        kind: 'explosion';
        simTime: number;
        projectileId: number;
        ownerKind: 'player' | 'enemy' | 'boss';
        weaponArchetypeId: string;
        damage: number;
        radius: number;
        x: number;
        y: number;
      }
    | {
        kind: 'death';
        simTime: number;
        entityId: number;
        entityKind: 'enemy' | 'player' | 'boss';
        archetypeId: string | null;
        weaponArchetypeId: string | null; // final projectile weapon, if any
        impactDirX: number | null;        // normalized final projectile direction, if any
        impactDirY: number | null;
        x: number;
        y: number;
      }
    | {
        kind: 'bossPhaseChange';
        simTime: number;
        bossId: number;
        phaseIndex: number;
        phaseId: string;
      }
    // session lifecycle (этот файл, история 004; summary extension — session-result-summary.md)
    | { kind: 'win'; simTime: number; summary: SessionResultSummary }
    | { kind: 'loss'; simTime: number; summary: SessionResultSummary }
    // drops (этот файл, история 005; см. drops.md)
    | {
        kind: 'dropSpawn';
        simTime: number;
        entityId: number;       // Drop.id
        archetypeId: string;    // DropArchetype.id
        x: number;
        y: number;
      }
    | {
        kind: 'dropPickup';
        simTime: number;
        entityId: number;       // Drop.id
        archetypeId: string;    // DropArchetype.id
        pickerId: number;       // на 005 — всегда player.id, поле явное на будущее
        x: number;
        y: number;
      }
    | {
        kind: 'dropExpire';
        simTime: number;
        entityId: number;       // Drop.id
        archetypeId: string;    // DropArchetype.id
        x: number;
        y: number;
      };
  ```
- `win`/`loss` несут `simTime` и `summary`. Полная форма `SessionResultSummary`, владелец статистики и правила progress/kills/boss/defeat-cause зафиксированы в [session-result-summary.md](session-result-summary.md). `summary.outcome` должен совпадать с `event.kind`, а `summary.durationMs` должен совпадать с `event.simTime`.
- `hit.targetArchetypeId` и `death.weaponArchetypeId`/`impactDir*` существуют для main-thread presentation consumers ([impact-feedback.md](impact-feedback.md)): renderer не должен реконструировать цвет цели, направление пули или причину смерти из соседних snapshot-ов, потому что цель может быть удалена до следующего кадра. Для `targetKind: 'player'` target archetype отсутствует и поле равно `null`; для смерти не от projectile weapon/direction поля равны `null`.
- Owner-системы (см. [runtime-systems.md](runtime-systems.md)):
  - `fire`, `hit`, `explosion` публикует `CombatSystem` ([projectiles-and-combat.md](projectiles-and-combat.md));
  - `death` публикует `HealthDeathSystem` ([health-and-death.md](health-and-death.md)) сразу после фиксации смерти и до запуска death hooks;
  - `win`, `loss` публикует `SessionFlowSystem` ([runtime-systems.md](runtime-systems.md), [session-definition.md](session-definition.md)) ровно один раз за run;
  - `dropSpawn`, `dropPickup`, `dropExpire` публикует `DropSystem` ([drops.md](drops.md)): `dropSpawn` — внутри death hook, синхронно после `EntityStore.spawnDrop`; `dropPickup` и `dropExpire` — в фазе `DropSystem` тика, по правилам [drops.md](drops.md) (на один дроп — ровно одно из них).
- Никакая другая система не имеет права публиковать события `fire`/`hit`/`explosion`/`death`/`win`/`loss`/`dropSpawn`/`dropPickup`/`dropExpire`/`bossPhaseChange`. Исключение: `BossPhaseSystem` публикует только `bossPhaseChange`; `DropSystem` подписан на death hook для дропа и не подменяет `death`. Обе системы не публикуют альтернативное событие смерти или победы.

### Гарантии и приоритеты

- Снапшоты публикуются по расписанию из [simulation-timing.md](simulation-timing.md) (`SNAPSHOT_HZ = 30`).
- Runtime events публикуются по факту, без агрегации между тиками. Если поток перегружен, [thread-model.md](thread-model.md) уже фиксирует приоритет снапшотов — combat-events деградируют как и любые другие events.
- HUD/audio не должны восстанавливать authoritative state только из combat-events: между двумя `hit`-ами на одного врага HP читается из снапшота, а не из суммы damage в events.

## Related

- [thread-model.md](thread-model.md)
- [runtime-systems.md](runtime-systems.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)
- [drops.md](drops.md)
- [boss-encounter.md](boss-encounter.md)
- [impact-feedback.md](impact-feedback.md)
- [hud-presentation.md](hud-presentation.md)
- [session-result-summary.md](session-result-summary.md)

### Расширение

- Новый `kind` сущности (`drop`, `boss`, `pickup`-эффект) добавляется здесь же отдельным разделом и оформляется как **новый член union**, без переоткрытия существующих.
- Новое поле в существующем `kind` допустимо только дописыванием. Удаление поля = `superseded` этого решения.
- Новый combat-kind runtime event (например, `parry`, `crit`, `pickup`) добавляется здесь же. Молчаливое расширение в `events.ts` без обновления этого файла — нарушение контракта.

## Consequences

- HUD, audio и рендер 007/008 получают стабильный набор полей и не вынуждены реверсить snapshot per story.
- `archetypeId` в снапшотах врагов и снарядов исключает «магические» цвета/спрайты, привязанные к `id` сущности; рендер выбирает визуал по архетипу из `content library`.
- `maxHp` дублируется в каждом enemy-снапшоте — это намеренный размен ради простоты HUD; стоимость в трафике незначительна на ожидаемом числе сущностей MVP.
- Новые combat-kinds событий выбраны достаточными для muzzle-flash, hit-spark, hit-sound и death-sound; их форма не потребует пересмотра в 008.
- Death hooks остаются единственным «межсистемным» способом среагировать на смерть; публикация `death` runtime event — отдельный путь, для main-thread-side потребителей.

## Related

- [thread-model.md](thread-model.md)
- [runtime-systems.md](runtime-systems.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [health-and-death.md](health-and-death.md)
- [content-archetypes.md](content-archetypes.md)
- [session-definition.md](session-definition.md)
- [zone.md](zone.md)
- [spawn-plan.md](spawn-plan.md)
- [drops.md](drops.md)
- [boss-encounter.md](boss-encounter.md)
- [simulation-timing.md](simulation-timing.md)
- [impact-feedback.md](impact-feedback.md)
- [landing-telegraph.md](landing-telegraph.md)
- [non-player-firing.md](non-player-firing.md)
- [hud-presentation.md](hud-presentation.md)
