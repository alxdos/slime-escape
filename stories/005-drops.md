# Drops

- Status: in-progress
- Created: 2026-04-19
- Updated: 2026-04-19 (архитектурная подготовка: новый `design/drops.md`, расширены `snapshot-shape.md`, `content-archetypes.md`, `content-boundaries.md`, `rng.md`, `health-and-death.md`, `runtime-systems.md`; полный Tasks-breakdown)

## Player-facing

- Sees: с убитых врагов с заметной вероятностью выпадает дроп; объект лежит на арене и подсвечен.
- Can do: подойти и подобрать дроп, увидеть применённый эффект (например, восстановление HP).

## Technical

- Новый `Drop` как runtime-сущность с `kind: 'drop'` в `EntityStore`; `DropSystem` владеет жизненным циклом — по [../design/drops.md](../design/drops.md), [../design/runtime-systems.md](../design/runtime-systems.md).
- `DropArchetype` и `DropEffect` (минимум — `{ kind: 'heal'; amount }`) живут в `content library`; `EnemyArchetype` получает обязательное поле `dropTable` — по [../design/content-archetypes.md](../design/content-archetypes.md), [../design/content-boundaries.md](../design/content-boundaries.md).
- Спавн дропа — внутри death hook от `HealthDeathSystem` (фильтр `entityKind === 'enemy'`, ровно один `nextFloat` через session RNG, weighted pick по `dropTable`); удаление и применение эффекта — в фазе `DropSystem` тика — по [../design/drops.md](../design/drops.md), [../design/health-and-death.md](../design/health-and-death.md), [../design/rng.md](../design/rng.md).
- Heal — единственная санкционированная мутация HP в плюс; идёт мимо `HealthDeathSystem` (тот остаётся владельцем decrement и death) — по [../design/health-and-death.md](../design/health-and-death.md), [../design/drops.md](../design/drops.md).
- Снапшот расширяется новым членом union `DropSnapshot` (`kind: 'drop'`, `archetypeId`, `x`, `y`) и тремя runtime events — `dropSpawn`, `dropPickup`, `dropExpire` (owner — `DropSystem`) — по [../design/snapshot-shape.md](../design/snapshot-shape.md).
- Пикап — circle-vs-circle overlap игрока с дропом по `player.radius + drop.radius` в фазе `DropSystem` (после `HealthDeathSystem.removeDead()`); ttl всегда выигрывает у pickup в случае однотиковой коллизии; на один дроп — ровно одно событие конца жизни — по [../design/drops.md](../design/drops.md).
- Контент: один `DropArchetype` (`heal-orb`) и непустые `dropTable` у `slime-fast`/`slime-tank`; `training-target` оставить с `dropTable: []`.

## Out of scope

- Дополнительные эффекты дропа (weapon swap, модификаторы, броня) — будущие истории, расширение union `DropEffect`.
- Магнит / авто-подбор на расстоянии больше суммы радиусов.
- Шаринг таблиц дропа между разными `EnemyArchetype` (общая `DropTableId`-ссылка).
- Несколько дропов с одного убийства (вторичные шансы, гарантированный дроп поверх таблицы).
- Зачистка дропа на `encounterEnd` — намеренно не делается, дроп живёт до своего ttl.
- HUD-отрисовка эффекта/иконки эффекта/таймера на дропе — будет частью `007-hud-and-menu.md`; в 005 достаточно того, что снапшот несёт нужные поля и события доходят до main.

## Acceptance

- При смерти врага дроп спавнится согласно таблице вероятностей.
- Дроп виден на арене и исчезает по таймауту, если не подобран.
- Контакт игрока с дропом подбирает его и применяет эффект ровно один раз.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [ ] | Расширить публичные контракты в `src/shared/**`: `snapshot.ts` (`DropSnapshot` с `kind: 'drop'`, `archetypeId`, `x`, `y`; включить в union `EntitySnapshot`), `events.ts` (`dropSpawn`, `dropPickup`, `dropExpire` с полями по `design/snapshot-shape.md`). Только формы и `assertNever`-готовые union-ы; реализация — отдельные задачи. | опоры: `design/snapshot-shape.md`, `design/drops.md` |
| T2 | [ ] | Контент: новый `src/shared/content/drops.ts` с типами `DropEffect` и `DropArchetype` и реестром `DROP_ARCHETYPES`. Минимальное содержимое — один архетип `heal-orb` с `effect: { kind: 'heal', amount: 1 }`, разумные `radius`/`ttlMs`/`color`. Реэкспорт через `src/shared/content/index.ts`. Без правок `EnemyArchetype` в этой задаче. | опоры: `design/content-archetypes.md`, `design/drops.md`, `design/content-boundaries.md`, `design/web-stack.md` |
| T3 | [ ] | Контент: `EnemyArchetype` получает обязательное поле `dropTable: ReadonlyArray<DropTableEntry>`; тип `DropTableEntry` (`archetypeId`, `chance`) экспортируется из `enemies.ts`. Заполнить `dropTable` у существующих архетипов: `training-target` — `[]`, `slime-fast` — заметный шанс `heal-orb`, `slime-tank` — выше шанс `heal-orb`. Добавить в `validateEnemyRegistry` (и/или `buildSession`) валидацию: `chance ∈ [0, 1]`, сумма `chance` по таблице `<= 1`, все `archetypeId` резолвятся в реестре `DropArchetype`; нарушения — `log.warn` через единый log-модуль. | опоры: `design/content-archetypes.md`, `design/drops.md`, `design/logging.md` |
| T4 | [ ] | `EntityStore`: добавить `Drop` (минимальная форма из `design/drops.md`: `id`, `kind: 'drop'`, `archetypeId`, `radius`, `effect`, `color`, `expireAtSimMs`, `position`), `DropSpawnSpec`, методы `spawnDrop`/`drops()`/`dropById`/`dropCount`/`removeDrop` и включить дроп в `clear()`. Без gameplay-логики; чистый container. | опоры: `design/drops.md`, `design/health-and-death.md`, `design/projectiles-and-combat.md` |
| T5 | [ ] | `DropSystem` как новый модуль `src/sim/DropSystem.ts` по `design/drops.md`. Конструктор принимает `EntityStore`, `Rng`, карту `Record<string, DropArchetype>`. Регистрация `DeathHook` через `HealthDeathSystem.registerHook` на старте симуляции/сессии: фильтр `entityKind === 'enemy'`, резолв `EnemyArchetype` по `archetypeId`, при пустой `dropTable` — без RNG-вызова, иначе один `rng.nextFloat()` и weighted pick; при выборе — `EntityStore.spawnDrop` в `ctx.position` с `expireAtSimMs = ctx.simTime + dropArchetype.ttlMs` и публикация `dropSpawn`. `tick(simTimeMs, store, emit)`: ttl expiry → `dropExpire` + remove; pickup detection (overlap player vs drop) → применить `DropEffect.kind: 'heal'` на player.hp с clamp по `maxHp`, опубликовать `dropPickup` + remove. Толерантность к `player === null`. `assertNever` на неизвестный `DropEffect.kind`. Сброс state на `sessionStart`/`sessionStop`. | опоры: `design/drops.md`, `design/runtime-systems.md`, `design/rng.md`, `design/health-and-death.md`, `design/snapshot-shape.md` |
| T6 | [ ] | `SessionFlowSystem`/worker entry: создать `DropSystem` в момент `startSession` рядом с `SpawnSystem`, передать ему session `Rng` и карту `DROP_ARCHETYPES` через DI; зарегистрировать его hook в той же точке регистрации hook-ов, что и сейчас (один раз на старте симуляции/сессии). Встроить `DropSystem.tick` в update order между `HealthDeathSystem.removeDead()` и `ZoneSystem.tick` по `design/runtime-systems.md`. На `stopSession`/`win`/`loss` — сброс runtime state, включая дропы (через общий `EntityStore.clear()` по существующему пути), без отдельных дополнительных правил. | опоры: `design/runtime-systems.md`, `design/drops.md`, `design/rng.md`, `design/health-and-death.md` |
| T7 | [ ] | `SnapshotExportSystem`: добавить экспорт дропов в `entities` как `DropSnapshot` (`id`, `kind: 'drop'`, `archetypeId`, `x`, `y`). Источник — `EntityStore.drops()`. Чистая агрегация, без gameplay-логики; никаких полей `expireAtSimMs`/`radius`/`effect` в snapshot. | опоры: `design/snapshot-shape.md`, `design/drops.md` |
| T8 | [ ] | `Renderer` (main): рендер `kind: 'drop'` в виде заметного объекта (цвет/радиус из `DropArchetype`, мягкий glow/pulse — деталь рендера, не контракт); подписка `worker → main` на новые события `dropSpawn`/`dropPickup`/`dropExpire` хотя бы в виде записей в отладочный HUD/лог (без аудио — это `008`). Player.hp в существующем отладочном HUD после хила обновляется автоматически (берётся из снапшота). Никаких новых полей в `content library` для рендера дропа. | опоры: `design/drops.md`, `design/snapshot-shape.md`, `design/thread-model.md`, `design/arena-and-coordinates.md` |
| T9 | [ ] | Тесты под контракт по `design/testing.md`: (а) drop-роллу даёт ровно один `nextFloat` на смерть с непустой `dropTable`, ноль вызовов на `[]`; (б) одинаковый `seed` + одинаковая последовательность смертей даёт идентичные `(archetypeId, position)` дропов; (в) `DropSystem` спавнит дроп строго в позиции `DeathContext.position`; (г) `dropExpire` публикуется и дроп удаляется, когда `simTime >= expireAtSimMs`; (д) overlap `player ↔ drop` по `player.radius + drop.radius` приводит к `dropPickup`, применению heal-эффекта (`hp = min(maxHp, hp + amount)`) и удалению дропа за один тик; (е) однотиковая коллизия ttl и pickup — выигрывает ttl (`dropExpire`, не `dropPickup`); (ж) толерантность к `player === null`: pickup-фаза — no-op, дропы продолжают истекать по ttl; (з) heal не порождает `death`-event и не запускает death hook (повторное применение не вызывает рекурсию). | опоры: `design/testing.md`, `design/drops.md`, `design/rng.md`, `design/health-and-death.md`, `design/snapshot-shape.md` |
| T10 | [ ] | Интеграционный тест training-сессии (или новый sandbox-with-drops): за фиксированный `seed` и сценарий — убийство нескольких врагов и нахождение игрока на пути дропов — проверить, что (а) последовательность `dropSpawn`/`dropPickup`/`dropExpire` детерминирована, (б) `player.hp` в финальном снапшоте отражает суммарный heal с clamp по `maxHp`, (в) количество дропов на арене в любом такте `>= 0` и не утекает после `stopSession`. | опоры: `design/testing.md`, `design/drops.md`, `design/runtime-systems.md`, `design/rng.md` |
| T11 | [ ] | Закрытие истории: чек-лист закрытия (см. `stories/README.md`); проверка, что `Index` в `design/README.md` остался актуальным; перевод `Status` истории в `done` и обновление таблицы в `stories/README.md`. | архитектор |

## Related

- [../design/drops.md](../design/drops.md)
- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../design/health-and-death.md](../design/health-and-death.md)
- [../design/snapshot-shape.md](../design/snapshot-shape.md)
- [../design/content-archetypes.md](../design/content-archetypes.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/rng.md](../design/rng.md)
- [../design/projectiles-and-combat.md](../design/projectiles-and-combat.md)
- [../design/session-definition.md](../design/session-definition.md)
- [../design/spawn-plan.md](../design/spawn-plan.md)
- [../design/zone.md](../design/zone.md)
- [../design/arena-and-coordinates.md](../design/arena-and-coordinates.md)
- [../design/simulation-timing.md](../design/simulation-timing.md)
- [../design/thread-model.md](../design/thread-model.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/logging.md](../design/logging.md)
- [../design/testing.md](../design/testing.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
