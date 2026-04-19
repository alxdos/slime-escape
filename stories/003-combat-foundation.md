# Combat Foundation

- Status: planned
- Created: 2026-04-19
- Updated: 2026-04-19

## Player-facing

- Sees: на арене появляется тренировочная мишень-враг; при попадании отображается урон, мишень умирает и исчезает.
- Can do: стрелять из единственного оружия, попадать по мишени, убивать её.

## Technical

- Один архетип оружия и один архетип врага в `content library`.
- `SpatialIndex` для быстрого поиска целей и снарядов.
- `CombatSystem`: выстрел, кулдаун, проверка попаданий, урон.
- `HealthDeathSystem`: HP, смерть, удаление сущности, death hook.
- Ввод выстрела через input commands из `002`.
- Расширение снапшотов: пули, враги, события попаданий для рендера/HUD.

## Out of scope

- Несколько типов оружия, несколько типов врагов, бафы и модификаторы.
- Дроп с трупов — это `005`.
- Босс, волны, тёмная зона — `004`, `006`.

## Acceptance

- Враг-мишень спавнится в начале сессии (или по debug-команде).
- Выстрел расходует кулдаун, попадание уменьшает HP.
- При HP ≤ 0 враг умирает и исчезает в течение одного тика.
- При промахе пуля корректно завершает жизненный цикл.

## Tasks

| ID | Task | Status | Note |
|----|------|--------|------|
| T1 | `SpatialIndex` под пули и врагов | planned | |
| T2 | `CombatSystem`: выстрел, кулдаун, попадание, урон | planned | |
| T3 | `HealthDeathSystem` + удаление сущностей | planned | |
| T4 | Снапшоты пуль/врагов и базовая отрисовка | planned | |

## Related

- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
