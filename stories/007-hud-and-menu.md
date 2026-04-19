# HUD and Menu

- Status: planned
- Created: 2026-04-19
- Updated: 2026-04-19

## Player-facing

- Sees: полноценный экран выбора режима со списком пресетов; во время боя — HUD с HP, таймером, номером волны и состоянием босса; экран паузы.
- Can do: выбрать режим из меню и запустить сессию, на лету ставить паузу, видеть прогресс боя в HUD, вернуться в меню после конца сессии.

## Technical

- Меню как DOM/UI поверх canvas в `main thread`.
- Builder `ModePreset` + пользовательских опций → `SessionDefinition` (расширение `002`).
- HUD как DOM, подписан на runtime events и снапшоты из `simulation worker`.
- Pause UI: команда `main → sim`, оверлей паузы.
- Экран результата сессии (победа/поражение) с возвратом в меню.

## Out of scope

- Настройки громкости и разрешения — `009`.
- Аудио — `008`.
- Сложная кастомизация modifiers и подбор loadout.

## Acceptance

- Старт игры открывает меню, не сессию.
- Выбор режима запускает соответствующую сессию.
- HUD корректно показывает HP, активный encounter, прогресс волны и состояние босса.
- Пауза замораживает симуляцию и доступна и снимается из UI и хоткеем.
- Завершение сессии возвращает в меню без перезагрузки страницы.

## Tasks

| ID | Task | Status | Note |
|----|------|--------|------|
| T1 | Экран выбора режима, builder `SessionDefinition` | planned | |
| T2 | HUD: HP, таймер, волна, фаза босса | planned | |
| T3 | Pause UI и экран результата | planned | |

## Related

- [../design/session-definition.md](../design/session-definition.md)
- [../design/thread-model.md](../design/thread-model.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [../docs/VISION.md](../docs/VISION.md)
