# Модификаторы спавнов в волнах

- Status: in-progress
- Created: 2026-04-25
- Updated: 2026-04-26 (architect: T11 стоп-сигнал закрыт продуктовым решением сохранять чистую модель spawn-override вместо byte-for-byte stat-переноса старых fork-архетипов; design/spawn-overrides.md обновлён)

## Player-facing

- Видит: ничего нового на экране. Существующая кампания сохраняет те же волны, тех же боссов и те же контекстные дроп/retaliation-особенности. Мелкий сдвиг баланса от удаления старых stat-форков допустим: игра ещё находится на стадии балансировки. Это инфраструктурная история, видимая разница появится в следующих историях, которые на ней стоят.
- Получает геймдизайнер: одну прямую и читаемую возможность — описать особенности **конкретного спавна в конкретной волне** прямо в строке таблицы encounter’а в [content/sessions/](content/sessions/), не заводя для этого новый архетип врага. Сегодня под каждую такую особенность приходится форкать слайма (`campaign-set-1-carrier-slime`, `demo-retaliator-slime` и так далее); после этой истории в [content/enemies.md](content/enemies.md) остаются только «настоящие» виды слаймов.

## Technical

История фиксирует архитектурную грань между двумя уровнями правды и переносит существующие данные на правильный уровень.

### Принципиальное разделение

- **Архетип в [content/enemies.md](content/enemies.md) = идентичность существа.** Стабильно для `slime-X` всегда и везде: тело (`radius`, `contactBox`), здоровье (`maxHp`), способ движения (`behavior`, `maxSpeed`), физическая модель контакта (`contactDamage`, `contactCooldownMs`, `knockback*`), цвет/спрайт/звуковой set, дефолтная вероятностная таблица дропа `dropTable`, дефолтная политика `retaliation`.
- **Spawn-override в [content/sessions/<preset>.md](content/sessions/) = контекст появления.** Верно про **этот конкретный спавн в этой конкретной волне**: гарантированный дроп, replace вероятностной таблицы дропа, точечно включённая retaliation. Гранулярность — per `seq` (одна строка таблицы спавнов = один потенциальный override).
- `behavior` **не override-ится**: это «кто этот слайм», а не «что у него с собой». Если нужен «такой же слайм, но не двигается» — это новый архетип, а не модификатор спавна.

### Поля spawn-override (закрытый список на этом горизонте)

- `guaranteedDrops` — список `dropArchetypeId`, которые этот спавн гарантированно роняет при смерти. Семантика **add** поверх архетипного `dropTable`. Заменяет сегодняшнее поле `EnemyArchetype.carrierDrop.guaranteedDropArchetypeIds`.
- `dropTable` — полная вероятностная таблица для этого спавна. Семантика **replace** архетипной таблицы. Если поле опущено — работает архетипная.
- `retaliation` — `{ enabled, durationMs }` для этого спавна. Семантика **replace** архетипной политики. Если поле опущено — работает архетипная (которая по дефолту `{ enabled: false }`).
- `loadout` (выдача оружия слайму per spawn) **сознательно вне 019**: вводится в 020 вместе с runtime firing path. До 020 слайм всё равно не умеет стрелять — поле в 019 было бы «ничего не делающим».

### Поля, которые уезжают из `EnemyArchetype`

- `carrierDrop` (включая `guaranteedDropArchetypeIds`) — целиком уезжает. После миграции в [src/shared/content/enemies.ts](src/shared/content/enemies.ts) этого поля нет.
- `dropTable` — **остаётся** как архетипный дефолт; фактическая таблица для конкретного спавна вычисляется как «spawn-override, если задан, иначе архетипная».
- `retaliation` — **остаётся** как архетипный дефолт `{ enabled: false, durationMs: 0 }` (как сейчас у 99% слаймов).

### Применение и валидация

- Spawn-override применяется **один раз** при спавне сущности в `SpawnSystem`. После этого runtime-сущность ничем не отличается от «обычного» спавна; per-tick override’ов нет.
- Content-build (`scripts/content-build/sessions/**`): hard-error на неизвестный `dropArchetypeId`/неизвестное поле override/override на несуществующий `seq`; warn на `chance > 1` и `retaliation.enabled && durationMs <= 0` (как сегодня в `validateEnemyRegistry`).
- Builder сессии ([src/shared/content/buildSession.ts](src/shared/content/buildSession.ts)): cross-area проверки переезжают сюда. Бывший `assertCarrierDropsResolve` уезжает из `validateEnemyRegistry` в валидатор sessions-области, чтобы источник правды совпадал с местом проверки.
- Runtime: новых проверок не добавляется — к моменту тика всё уже резолвлено.

### Миграция (часть истории, не follow-up)

- Удаляются из [content/enemies.md](content/enemies.md) и из [src/shared/content/enemies.generated.ts](src/shared/content/enemies.generated.ts): `campaign-set-1-carrier-slime`, `campaign-set-2-carrier-slime`, `campaign-set-3-carrier-slime`, `campaign-set-4-carrier-slime`, `campaign-set-5-carrier-slime`, `demo-carrier-slime`, `demo-retaliator-slime` — итого семь форков.
- Каждый их `seq`-спавн в [content/sessions/](content/sessions/) переписывается на обычный архетип того же визуального семейства + соответствующий spawn-override (`guaranteedDrops` для carrier’ов, `retaliation` для retaliator’а). Старые stat-отличия fork-архетипов не переносятся: 019 сохраняет чистую модель, где override не меняет body/HP/movement/contact/knockback/color.
- После миграции `EnemyArchetype` теряет поле `carrierDrop`; сегодняшние тесты, опирающиеся на это поле, переписываются на тесты spawn-override’ов.

### Где это лежит в `design/`

- Новый файл `design/spawn-overrides.md` — единственный источник правды по контракту (форма, поля, семантика, момент применения, валидация, правило миграции).
- Точечные правки в смежных, чтобы устранить «два разных нет данных»: вынос `carrierDrop` из `EnemyArchetype` в [content-archetypes.md](design/content-archetypes.md); форма per-spawn записи в [spawn-plan.md](design/spawn-plan.md) и [session-definition.md](design/session-definition.md); перенаправление формулировок про «гарантированный дроп» в [drops.md](design/drops.md) и [combat-modifiers-and-field-effects.md](design/combat-modifiers-and-field-effects.md); запись в `Index` в [design/README.md](design/README.md).
- Архитектурный PR (правки `design/`) идёт **отдельно** от кодового PR этой истории, по правилу «не делать одним PR одновременно правки `design/` и кода».

## Out of scope

- `loadout` как поле spawn-override и любая стрельба слаймов в рантайме — это 020.
- Множители статов (`hpMultiplier`, `speedMultiplier`, `damageMultiplier`, …) как spawn-override — отдельное design-решение, не входит сюда.
- Per-encounter override (одна запись на «все слаймы вида X в этой волне») в дополнение к per-`seq`. Считаем избыточным; если когда-нибудь понадобится — отдельное решение.
- Массив `modifiers: [{ kind, ... }]` как форма записи. Закрытый плоский набор именованных полей — намеренно.
- Override `behavior` (per-spawn смена `chase ↔ stationary`). Намеренно запрещено.
- Сосуществование старого `EnemyArchetype.carrierDrop` и нового spawn-override параллельно. Миграция жёсткая, форки удаляются в этой же истории.
- Шаблоны/наследование между файлами `content/sessions/<preset>.md`. Каждый пресет живёт самостоятельно.
- UI/HUD-изменения. Игрок ничего нового на экране не получает.
- Любые изменения в `BossPhaseSystem`, `DropSystem` lifecycle, `HealthDeathSystem` lifecycle: HP всё так же снимает только `HealthDeathSystem`, дроп всё так же спавнит и подбирает только `DropSystem`.

## Acceptance

- В [content/enemies.md](content/enemies.md) больше нет архетипов `campaign-set-1..5-carrier-slime`, `demo-carrier-slime`, `demo-retaliator-slime`. Ни в одном файле в [content/sessions/](content/sessions/) на эти id ссылок не осталось.
- Сегодняшняя кампания ([content/sessions/campaign.md](content/sessions/campaign.md)) после миграции остаётся детерминированной на одном и том же `seed`; context-особенности carrier-спавнов сохраняются через `guaranteedDrops` + `dropTable: empty`. Byte-for-byte идентичность с pre-019 stat-форками не требуется.
- Демо-сценарии (sandbox/training/demo, если такие есть в `content/sessions/`) сохраняют context-особенности carrier/retaliator через spawn-override; byte-for-byte идентичность с pre-019 stat-форками не требуется.
- Поле `EnemyArchetype.carrierDrop` снято с типа в [src/shared/content/enemies.ts](src/shared/content/enemies.ts), валидатор `assertCarrierDropsResolve` перенесён в валидатор sessions-области.
- В [content/sessions/<preset>.md](content/sessions/) можно в строке `seq` задать любое из трёх полей `guaranteedDrops` / `dropTable` / `retaliation`, content-build их корректно парсит, и runtime применяет ровно как описано в `design/spawn-overrides.md`.
- `content:check` падает (атомарно, как сегодня) при: ссылке на неизвестный `dropArchetypeId` в любом из полей; неизвестном имени поля override; override на несуществующий `seq`. Каждый случай покрыт unit-тестом content-build.
- Warn’ы (без падения) корректно появляются на `chance > 1` в spawn-override `dropTable` и на `retaliation.enabled && durationMs <= 0` в spawn-override.
- Никакая runtime-система (`SpawnSystem`, `CombatSystem`, `DropSystem`, `RetaliationSystem`) не получает новых публичных полей; spawn-override превращается в обычные runtime-параметры сущности на момент спавна.
- Главное меню, HUD, рендер, аудио — без изменений. Сравнение скриншотов до/после миграции не показывает визуальной разницы для существующих сессий.

## Tasks

Полная декомпозиция: архитектурный PR (T1) подготовлен этим же ревью; код-PR (T2–T16) — отдельным PR после merge архитектурного, по правилу «не делать одним PR одновременно правки `design/` и кода». Внутри T2–T16 порядок отражает зависимости: типы → удаление `EnemyArchetype.carrierDrop` → парсер/рендер `sessions` → builder-валидация → runtime → миграция контента → тесты → верификация.

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Архитектор: `design/spawn-overrides.md` (форма `SpawnOverride`, поля `guaranteedDrops`/`dropTable`/`retaliation`, семантика replace/add, момент применения, валидация, правило миграции) + точечные правки в `content-archetypes.md` (вынос `carrierDrop`), `spawn-plan.md` (optional `override` в `StaticSpawn`/`WaveSpawn`), `session-definition.md`, `drops.md` (DropSystem читает per-entity `dropTable`/`guaranteedDrops`), `combat-modifiers-and-field-effects.md` (carrier/retaliation теперь per-spawn), `content-authoring.md` (третья override-таблица в encounter, контролируемое расширение list-in-cell), `design/README.md` Index. Полная декомпозиция этой истории. | Архитектурный PR — отдельным PR, без кода. Design accepted, code branch starts from T2. |
| T2 | [x] | Расширить `src/shared/session.ts`: добавить тип `SpawnOverride = Readonly<{ guaranteedDrops?, dropTable?, retaliation? }>`; добавить optional `override?: SpawnOverride` в `StaticSpawn` и `WaveSpawn`. Без изменения значения уже существующих полей. | Чисто типы; runtime-поведение пока не меняется. |
| T3 | [x] | Снять поле `carrierDrop` (включая `CarrierDropMetadata`/`marker: 'reward'`) с `EnemyArchetype` в `src/shared/content/enemies.ts`. Удалить `assertCarrierDropsResolve` из `validateEnemyRegistry`. Оставить `dropTable` и `retaliation` как defaults. | После этого шага сборка ломается до T4–T7; задачи идут одной серией. |
| T4 | [x] | `scripts/content-build/enemies/parse.ts` + `renderContent.ts`: убрать парсинг `## Carrier Drops` партиции из `content/enemies.md`; убрать выпуск поля `carrierDrop` в `enemies.generated.ts`. | Удаление самой партиции из MD-источника — часть T13 (после миграции `content/sessions/`). |
| T5 | [x] | `scripts/content-build/sessions/parse.ts`: парсить третью optional GFM-таблицу encounter-секции `seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs`. Hard-error на: неизвестное имя поля override, override на несуществующий `seq`, дубликат `seq`, неизвестный `dropArchetypeId` (через `requireDropRef`), `retaliationEnabled`/`retaliationDurationMs` заданы частично. Warn на `chance ∉ [0, 1]`/`sum > 1` в `dropTable` и на `enabled && durationMs <= 0`. Расширить `ParsedSpawn`/`ParsedStaticSpawn` полем `override`. | Запретить третью таблицу при `spawnKind ∈ {empty, boss}`. |
| T6 | [x] | `scripts/content-build/sessions/renderContent.ts`: эмитить `override` в литералах `WaveSpawn`/`StaticSpawn` сгенерированного `sessions.generated.ts` (пропускать поле, если override пуст; сохранять текущую форму без override). | Импорт `DropArchetype.id` для override.guaranteedDrops/dropTable идёт через тот же import bucket `drops`. |
| T7 | [x] | `src/shared/content/buildSession.ts`: в `resolveSpawnPlanTemplate` пройти по всем `seq` и проверить, что все `override.guaranteedDrops`/`override.dropTable[*].archetypeId` резолвятся в `DROP_ARCHETYPES`. Это runtime-second-pass, заменяющий бывший `assertCarrierDropsResolve`. | Проверка обязательная для всех `'static'` и `'wave'` планов. |
| T8 | [x] | `src/sim/EntityStore.ts`: добавить runtime-поля `guaranteedDrops: ReadonlyArray<string>` и `dropTable: ReadonlyArray<DropTableEntry>` на entity `enemy`. Источник `carrierDropMarker` сменить на derive `guaranteedDrops.length > 0 ? 'reward' : null`. `EnemySpawnSpec` принимает соответствующие поля. | Forma снапшота не меняется. |
| T9 | [x] | `src/sim/SpawnSystem.ts`: `makeEnemySpawnSpec` принимает second arg `override?: SpawnOverride` и резолвит `guaranteedDrops`/`dropTable`/`retaliation` через override-or-archetype-default. Применить в `executeStatic` и `spawnNextWaveEnemy`. | Никаких runtime-чтений `archetype.carrierDrop` после этого шага. |
| T10 | [x] | `src/sim/DropSystem.ts`: hook читает `enemy.dropTable` и `enemy.guaranteedDrops` с runtime-сущности через `EntityStore`, не из `EnemyArchetype`. Параметр `enemyRegistry` либо удаляется, либо сохраняется только для лога/неизвестного archetypeId. Порядок: гарантированные дропы → weighted-pick (см. design/drops.md, шаги hook 3 → 4 → 5). | После T8/T9 это рефактор без поведенческих изменений. |
| T11 | [x] | Миграция `content/sessions/*.md`: переписать каждый `seq`, ссылающийся на один из семи форков, на обычный архетип того же визуального семейства + соответствующий spawn-override. Конкретно (задачи на основе сегодняшнего состояния `enemies.md`/`sessions/`): `campaign-set-1-carrier-slime` → `slime-spark` + `guaranteedDrops: size-up`, `dropTable: empty`; `campaign-set-2-..` → `slime-stack` + `guaranteedDrops: multi-shot`, `dropTable: empty`; `campaign-set-3-..` → `slime-echo` + `guaranteedDrops: magnet`, `dropTable: empty`; `campaign-set-4-..` → `slime-prince` + `guaranteedDrops: fragment`, `dropTable: empty`; `campaign-set-5-..` → `slime-obelisk` + `guaranteedDrops: overdrive`, `dropTable: empty`; `demo-carrier-slime` → `slime-star` + `guaranteedDrops: magnet, heal-orb`, `dropTable: empty`; `demo-retaliator-slime` → `slime-saw` + `dropTable: heal-orb:0.20`, `retaliation: enabled=true, durationMs=2500`. Старые stat-отличия fork-архетипов не переносятся. | Runtime-детерминизм новой модели фиксируется тестом T15. |
| T12 | [x] | Удалить из `content/enemies.md` H2-секции семи форков и их строки во всех балансных партициях (`## Bodies`, `## Speed`, `## Hit points`, `## Contact`, `## Drops`, `## Carrier Drops`, `## Retaliation`) и в `# Sound sets / ## Members`. Удалить саму партицию `## Carrier Drops` целиком. Прогнать `npm run content:build` и убедиться, что `enemies.generated.ts` соответствует (forks исчезают; `carrierDrop`-поле исчезает у всех оставшихся). | Делается после T11, чтобы кампания не ссылалась на уже несуществующие архетипы. |
| T13 | [x] | `scripts/content-build/sessions/sessions.test.ts`: добавить unit-тесты на каждое hard-error правило T5 (override на несуществующий `seq`, дубликат `seq`, неизвестное имя поля, неизвестный `dropArchetypeId`, `empty` vs `none`, частично заданная `retaliation`) и на каждый warn (chance > 1, sum > 1, retaliation duration ≤ 0). | Покрытие на стороне content-build, как требует Acceptance. |
| T14 | [ ] | Переписать тесты, опирающиеся на `EnemyArchetype.carrierDrop`: `src/sim/DropSystem.test.ts` (carrier guaranteed drops), `src/sim/SpawnSystem.test.ts`, `src/sim/RetaliationSystem.test.ts`, `src/shared/content/enemies.test.ts`. Тестовые fixtures теперь подают override через спавн-план или через runtime spec, не через архетип. | Поведение тех же сценариев должно остаться идентичным. |
| T15 | [ ] | Детерминированный regression-тест: прогнать сессию `campaign` для одного фиксированного `seed` и зафиксировать стабильную post-migration последовательность runtime events (`enemySpawn`/`death`/`dropSpawn`/`dropPickup`/`dropExpire` + позиции/архетипы). Реализовать как vitest snapshot или явный equality на зафиксированный baseline новой модели. | Покрывает Acceptance-пункт «детерминированно после миграции» без требования pre-019 byte-for-byte. |
| T16 | [ ] | Прогнать `npm run content:check && tsc -p tsconfig.scripts.json && npm run typecheck && npm test`. Прогнать визуальный sanity-чек `npm run dev` для `campaign`/`combat-modifiers-demo` и убедиться, что HUD/рендер/звук без визуальной разницы. | Финальная верификация. |

## Related

- [spawn-overrides.md](../design/spawn-overrides.md)
- [content-archetypes.md](../design/content-archetypes.md)
- [spawn-plan.md](../design/spawn-plan.md)
- [session-definition.md](../design/session-definition.md)
- [drops.md](../design/drops.md)
- [combat-modifiers-and-field-effects.md](../design/combat-modifiers-and-field-effects.md)
- [content-authoring.md](../design/content-authoring.md)
- [content-boundaries.md](../design/content-boundaries.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [boss-encounter.md](../design/boss-encounter.md)
- [universal-weapons-and-projectiles.md](../design/universal-weapons-and-projectiles.md)
- [020-shooting-slimes.md](020-shooting-slimes.md)
