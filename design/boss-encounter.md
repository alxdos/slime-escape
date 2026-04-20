# Boss Encounter

- Status: accepted
- Created: 2026-04-20
- Updated: 2026-04-20

## Context

В [runtime-systems.md](runtime-systems.md) уже зафиксированы `BossPhaseSystem` и owner runtime event «phase change». В [session-definition.md](session-definition.md) для `winCondition: { kind: 'bossDefeated' }` указано, что конкретный путь реализации остаётся для истории 006. В [spawn-plan.md](spawn-plan.md) вид `'boss'` отложен до 006. В [snapshot-shape.md](snapshot-shape.md) сущность с `kind: 'boss'` отложена до 006. В [health-and-death.md](health-and-death.md) активирован только `DamageIntent.source.kind === 'projectile'` и `'enemyContact'`; ветка `'boss'` зарезервирована.

Без явного решения история 006 закрепит расхождения: босс как «большой враг», двойная публикация `win`, или нестыковка `SpawnSystem` и encounter transitions с session-level победой.

Ограничения продукта — [../docs/BOSS.md](../docs/BOSS.md).

## Decision

### Сущность босса в runtime

- Босс — это отдельный `kind` runtime-сущности **`'boss'`**, не замена `enemy`. У босса есть `HasHealth` по тем же полям `hp`/`maxHp`, что у `enemy` ([health-and-death.md](health-and-death.md)); `maxHp` берётся из `BossArchetype` ([content-archetypes.md](content-archetypes.md)).
- Резолв архетипа — по стабильному `id` из реестра `bosses` в `content library`; ссылки в данных сессии только по `id` ([content-boundaries.md](content-boundaries.md)).

### SpawnPlan kind `'boss'`

- Форма и семантика зафиксированы в разделе «Boss spawn» в [spawn-plan.md](spawn-plan.md): ровно один спавн босса при старте encounter, без повторного диспатча по тикам.
- `EncounterDefinition` для боя с боссом имеет `type: 'boss'` и `spawnPlan.kind: 'boss'`; `transitionRules` для завершения encounter после убийства босса — `{ kind: 'allEnemiesCleared' }` (как для волны: план исчерпан и не осталось живых сущностей из плана — см. [spawn-plan.md](spawn-plan.md), [session-definition.md](session-definition.md)).

### Зона

- Для encounter с боссом выставляется `zoneBehavior: { kind: 'disabled' }` ([session-definition.md](session-definition.md), [zone.md](zone.md)): `margin = 0`, зона не сжимается.

### BossPhaseSystem

- `BossPhaseSystem` владеет **переходами фаз** по полям `BossArchetype.phases[].exitWhenHpFractionAtOrBelow` и спискам `allowedAttackIds` ([content-archetypes.md](content-archetypes.md)), а также **выбором и исполнением атак** босса в своей фазе update order ([runtime-systems.md](runtime-systems.md)).
- Урон от атак босса к игроку формируется только через `DamageIntent` с `source: { kind: 'boss'; bossId: EntityId; attackId: string }` ([health-and-death.md](health-and-death.md)); кулдауны и выбор `attackId` — ответственность `BossPhaseSystem`, без дублирования списания HP вне `HealthDeathSystem`.
- Контакт игрока с боссом следует [enemy-contact.md](enemy-contact.md): та же фаза contact intents в `CombatSystem`, те же поля урона и кулдауна на архетипе; в `DamageIntent.source` используется `kind: 'enemyContact'` и поле `enemyId`, равное `entityId` сущности босса (имя поля историческое). Коллизии обрабатываются для сущности `kind: 'boss'` параллельно `enemy`, параметры берутся из `BossArchetype`.

### Победа `bossDefeated`

- Если `SessionDefinition.winCondition.kind === 'bossDefeated'`, `SessionFlowSystem` регистрирует **session-level death hook** (та же точка регистрации, что и для смерти игрока — [health-and-death.md](health-and-death.md)): при `ctx.entityKind === 'boss'` и совпадении `ctx.entityId` с идентификатором босса текущей сессии (единственная сущность `kind: 'boss'`, заспавненная в boss-encounter, либо явное поле runtime state «activeBossEntityId», выставляемое при спавне) публикуется **`win` ровно один раз** и выполняется тот же teardown run, что и для прочих побед ([session-definition.md](session-definition.md)).
- В одном `SessionDefinition` **не комбинируют** `winCondition: { kind: 'bossDefeated' }` с `{ kind: 'allEncountersComplete' }`: для пресета «волны → босс» используется только **`bossDefeated`**. Победа определяется смертью босса, а не отдельным «последним encounterEnd» как альтернативным триггером `win`.

### Снапшот и события

- Форма `BossSnapshot`, расширения top-level снапшота и runtime event смены фазы — в [snapshot-shape.md](snapshot-shape.md). Публикация события смены фазы — владение `BossPhaseSystem` ([runtime-systems.md](runtime-systems.md)).

## Consequences

- Игрок стреляет по боссу как по отдельному kind в hit-detection; в снапшоте и событиях появляется явный `'boss'` там, где раньше был только `'enemy'` ([snapshot-shape.md](snapshot-shape.md), при необходимости [projectiles-and-combat.md](projectiles-and-combat.md)).
- Контентный пресет кампании обязан задать цепочку encounter-ов и `winCondition: bossDefeated` согласованно; ошибка сборки предпочтительнее двусмысленности на runtime.

## Related

- [../docs/BOSS.md](../docs/BOSS.md)
- [session-definition.md](session-definition.md)
- [spawn-plan.md](spawn-plan.md)
- [runtime-systems.md](runtime-systems.md)
- [zone.md](zone.md)
- [content-archetypes.md](content-archetypes.md)
- [health-and-death.md](health-and-death.md)
- [enemy-contact.md](enemy-contact.md)
- [snapshot-shape.md](snapshot-shape.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [../stories/006-boss-encounter.md](../stories/006-boss-encounter.md)
