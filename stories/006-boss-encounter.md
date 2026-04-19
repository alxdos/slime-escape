# Boss Encounter

- Status: planned
- Created: 2026-04-19
- Updated: 2026-04-19

## Player-facing

- Sees: после прохождения волн запускается финальный бой с боссом на полной арене без тёмной зоны; видны фазы поведения босса.
- Can do: сражаться с боссом, переживать смену фаз, побеждать (финальный win) или умирать.

## Technical

- Профиль босса в `content library` (HP, фазы, атаки).
- `EncounterDefinition` типа `boss` в кампанийном `ModePreset`.
- `BossPhaseSystem`: переходы между фазами по HP/таймеру, выбор атак.
- `ZoneSystem` отключается на encounter босса (поведение `disabled`).
- Финальное win condition сессии при смерти босса; loss остаётся прежним.
- Расширение снапшотов: фаза босса, его HP, активные атаки.

## Out of scope

- Несколько боссов и арены под них.
- Кат-сцены, диалоги, анимированные intro.
- Реворк систем — `BossPhaseSystem` строится поверх существующих.

## Acceptance

- После последнего волнового encounter сразу начинается бой с боссом.
- Тёмная зона отключена на этом encounter.
- Босс проходит как минимум 2 фазы и меняет поведение между ними.
- Смерть босса завершает сессию победой; смерть игрока — поражением.

## Tasks

| ID | Task | Status | Note |
|----|------|--------|------|
| T1 | Профиль босса и `EncounterDefinition` типа `boss` | planned | |
| T2 | `BossPhaseSystem`: переходы фаз и атаки | planned | |
| T3 | Отключение зоны и финальный win condition | planned | |

## Related

- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../design/session-definition.md](../design/session-definition.md)
- [../docs/BOSS.md](../docs/BOSS.md)
