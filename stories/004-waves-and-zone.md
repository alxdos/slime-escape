# Waves and Dark Zone

- Status: planned
- Created: 2026-04-19
- Updated: 2026-04-19

## Player-facing

- Sees: тренировочный режим из 1–2 волн с передышками; во время волны видимая область арены линейно сжимается тёмной зоной, в передышке — расширяется обратно.
- Can do: пройти волны и выжить (победа) либо погибнуть (поражение); видеть переходы между encounter-ами.

## Technical

- `EncounterDefinition` типа `wave` и `break` в `SessionDefinition`.
- `SpawnSystem`: исполнение `spawnPlan` (типы врагов, группы, интервалы, лимиты).
- `SessionFlowSystem` доращивается до переходов encounter → encounter.
- `ZoneSystem`: режим линейного сжатия в `wave`, расширение в `break`.
- Win condition: пройдены все encounter-ы; loss condition: смерть игрока.
- Расширение снапшотов: текущий encounter, прогресс волны, границы зоны.

## Out of scope

- Финальный бой с боссом — `006`.
- Дроп — `005`.
- Полноценный HUD волн/таймеров (только отладочный) — `007`.

## Acceptance

- Запуск тренировочного `ModePreset` стартует первую волну.
- Враги спавнятся согласно `spawnPlan`, не больше лимита одновременно.
- Тёмная зона линейно сжимается в волне и расширяется в передышке.
- По завершении всех encounter-ов фиксируется победа.
- При смерти игрока фиксируется поражение.

## Tasks

| ID | Task | Status | Note |
|----|------|--------|------|
| T1 | `SpawnSystem` и формат `spawnPlan` | planned | |
| T2 | Переходы encounter в `SessionFlowSystem` (wave/break) | planned | |
| T3 | `ZoneSystem` линейное сжатие/расширение | planned | |
| T4 | Win/loss conditions и завершение сессии | planned | |

## Related

- [../design/session-definition.md](../design/session-definition.md)
- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../docs/WAVES_AND_SCALING.md](../docs/WAVES_AND_SCALING.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
