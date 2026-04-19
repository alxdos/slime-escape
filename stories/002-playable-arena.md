# Playable Arena

- Status: planned
- Created: 2026-04-19
- Updated: 2026-04-19

## Player-facing

- Sees: заглушка меню с одной кнопкой запуска; после старта — пустая арена с управляемым персонажем.
- Can do: запустить сессию, ходить по арене с клавиатуры/мыши, завершить сессию и вернуться в меню.

## Technical

- Заглушка `content library` с одной аренной и одним `ModePreset` (пустая сессия).
- Builder `ModePreset` + опции → `SessionDefinition`.
- `SessionFlowSystem`: старт, активный encounter-заглушка типа `sandbox`, стоп.
- Передача `SessionDefinition` из `main` в `simulation worker`.
- Input commands `main → sim` (направление движения, прицел/курсор).
- `EntityStore` минимально под одну сущность игрока.
- `MovementSystem` для игрока внутри границ арены.
- Отрисовка игрока и арены через расширение `SnapshotExportSystem`.

## Out of scope

- Враги, оружие, бой, дроп.
- Полноценное меню и HUD — это `007`.
- Тёмная зона, волны, encounter-переходы — это `004`.

## Acceptance

- Из заглушки меню запускается сессия.
- Игрок видит свой персонаж на пустой арене и управляет им.
- Персонаж не выходит за границы арены.
- Завершение сессии возвращает в меню без ошибок и утечек воркера.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [ ] | Заглушка `content library` и сборка `SessionDefinition` из `ModePreset` | |
| T2 | [ ] | `SessionFlowSystem` старт/стоп + проброс в worker | |
| T3 | [ ] | Input commands и `MovementSystem` для игрока | |
| T4 | [ ] | Отрисовка игрока и арены поверх рендера из `001` | |

## Related

- [../design/session-definition.md](../design/session-definition.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
