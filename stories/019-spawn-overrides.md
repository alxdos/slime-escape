# Модификаторы спавнов в волнах

- Status: planned
- Created: 2026-04-25
- Updated: 2026-04-25

## Player-facing

- Видит: ничего нового на экране. Существующая кампания играется **ровно как раньше** — те же волны, те же боссы, тот же баланс, та же сложность. Это инфраструктурная история, видимая разница появится в следующих историях, которые на ней стоят.
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
- Каждый их `seq`-спавн в [content/sessions/](content/sessions/) переписывается на обычный архетип того же визуального семейства + соответствующий spawn-override (`guaranteedDrops` для carrier’ов, `retaliation` для retaliator’а).
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
- Сегодняшняя кампания ([content/sessions/campaign.md](content/sessions/campaign.md)) после миграции ведёт себя **байт-в-байт** идентично до этой истории на одном и том же `seed`: те же события, те же дропы, те же смерти. Покрыто детерминированным тестом.
- Демо-сценарии (sandbox/training/demo, если такие есть в `content/sessions/`) после миграции ведут себя идентично до истории.
- Поле `EnemyArchetype.carrierDrop` снято с типа в [src/shared/content/enemies.ts](src/shared/content/enemies.ts), валидатор `assertCarrierDropsResolve` перенесён в валидатор sessions-области.
- В [content/sessions/<preset>.md](content/sessions/) можно в строке `seq` задать любое из трёх полей `guaranteedDrops` / `dropTable` / `retaliation`, content-build их корректно парсит, и runtime применяет ровно как описано в `design/spawn-overrides.md`.
- `content:check` падает (атомарно, как сегодня) при: ссылке на неизвестный `dropArchetypeId` в любом из полей; неизвестном имени поля override; override на несуществующий `seq`. Каждый случай покрыт unit-тестом content-build.
- Warn’ы (без падения) корректно появляются на `chance > 1` в spawn-override `dropTable` и на `retaliation.enabled && durationMs <= 0` в spawn-override.
- Никакая runtime-система (`SpawnSystem`, `CombatSystem`, `DropSystem`, `RetaliationSystem`) не получает новых публичных полей; spawn-override превращается в обычные runtime-параметры сущности на момент спавна.
- Главное меню, HUD, рендер, аудио — без изменений. Сравнение скриншотов до/после миграции не показывает визуальной разницы для существующих сессий.

## Tasks

Стартовая таблица — полное дробление делает архитектор при переводе истории `planned → in-progress`.

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [ ] | Архитектор: оформить решение в `design/spawn-overrides.md` (форма, поля `guaranteedDrops`/`dropTable`/`retaliation`, семантика replace/add, момент применения, валидация, правило миграции) и точечные правки в `content-archetypes.md`/`spawn-plan.md`/`session-definition.md`/`drops.md`/`combat-modifiers-and-field-effects.md`/`design/README.md`. Декомпозировать историю на задачи. | Архитектурный PR — отдельным PR, без кода, до взятия истории в работу. |

## Related

- [content-archetypes.md](../design/content-archetypes.md)
- [spawn-plan.md](../design/spawn-plan.md)
- [session-definition.md](../design/session-definition.md)
- [drops.md](../design/drops.md)
- [combat-modifiers-and-field-effects.md](../design/combat-modifiers-and-field-effects.md)
- [content-authoring.md](../design/content-authoring.md)
- [content-boundaries.md](../design/content-boundaries.md)
- [020-shooting-slimes.md](020-shooting-slimes.md)
