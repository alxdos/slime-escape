# Боевой HUD без дебага

- Status: planned
- Created: 2026-04-26
- Updated: 2026-04-26

## Player-facing

- Видит: во время забега экран больше не занят debug-информацией. Остаётся только маленький FPS-индикатор справа сверху.
- Видит: слева сверху идёт время забега в формате `MM:SS`. Цифры моноширинные, поэтому таймер не прыгает при смене секунд.
- Видит: снизу слева полупрозрачные клавиши `WASD`, оформленные как физические кнопки управления. Они не объясняют механику длинным текстом, а просто закрепляют схему движения.
- Видит: снизу справа иконку мыши и короткую подпись `ЛКМ: выстрел`. Никаких технических слов про pointer lock, capture или захват мыши.
- Видит: снизу по центру ряд квадратных слотов оружия. В каждом слоте есть номер клавиши выбора и изображение пули/снаряда этого оружия.
- Видит: текущий выбранный слот явно выделен: рамкой, свечением или масштабом, но без дергания layout.
- Видит: после выстрела слот выбранного оружия показывает cooldown полупрозрачной заливкой. Заливка постепенно уходит, когда оружие снова готово.
- Видит: если у оружия есть улучшения, над слотом появляются маленькие квадратные badges. Badge использует визуал соответствующего дропа/улучшения.
- Видит: если временное улучшение активно, его badge показывает оставшееся время фоном-прогрессом.
- Видит: если на оружии несколько улучшений, badges складываются компактно над слотом. Одинаковые стаки читаются как стопка или маленький счётчик, но не превращают HUD в кашу.
- Чувствует: интерфейс стал игровым и спокойным. Нижний центр отвечает за боевое решение "чем стреляю и когда снова готово", а подсказки управления остаются вторичными.

### Product notes

- HUD должен ощущаться как player-facing интерфейс, а не как dev overlay.
- Нижний центр — главное место принятия решений: какое оружие выбрано, что на cooldown, какие усиления висят.
- Подсказки `WASD` и `ЛКМ` должны быть тихими по opacity, чтобы помогать новичку, но не спорить с боем.
- HP желательно сохранить, но вынести из старого нижнего HUD: например, компактно под таймером слева сверху или в виде небольшой полосы/сердец. Полностью убирать HP рискованно.
- Boss HP, если активен босс, лучше держать отдельной тонкой полосой сверху по центру, а не возвращать в нижний HUD.

## Technical

- Убрать renderer-level debug HUD с `encounter`/`wave`/`hp`/`zone`/`drops`, не трогая отдельный `FpsOverlay`.
- Пересобрать `src/main/ui/Hud.ts` вокруг новых зон: top-left run status, bottom-left movement hint, bottom-center weapon slots, bottom-right fire hint.
- Таймер забега должен считаться от session/runtime time, а не от `encounter.elapsedMs`, чтобы не сбрасываться между волнами.
- Weapon slots используют существующие projectile assets из `public/assets/projectiles/**`.
- Upgrade badges используют существующие drop assets из `public/assets/drops/**`.
- Для честного отображения cooldown progress и upgrade badges может потребоваться расширить `WeaponHudSnapshot`: длительность cooldown-а, список weapon modifiers и duration/start для временного overdrive. Это design-контракт первой задачи, а не локальная догадка в UI.

## Out of scope

- Новое оружие, новые апгрейды, новый баланс cooldown-ов.
- Изменение поведения стрельбы, выбора оружия или управления.
- Обучающий экран, туториал, длинные текстовые объяснения.
- Изменение меню, паузы, result overlay.
- Скрытие FPS. FPS остаётся справа сверху.
- Технические подсказки про захват мыши, pointer lock или capture.
- Переработка wave title overlay, session music или encounter presentation.

## Acceptance

- В running-фазе нет debug-панели слева сверху с `encounter`/`wave`/`hp`/`zone`/`drops`.
- FPS остаётся видимым справа сверху.
- Таймер забега слева сверху показывает `MM:SS`, использует моноширинные цифры и не сбрасывается между волнами.
- Нижний старый HUD-блок с HP/Weapon/Encounter/Wave/Boss больше не отображается в прежнем виде.
- Слева снизу видны полупрозрачные `WASD`-кнопки.
- Справа снизу видна иконка мыши и текст `ЛКМ: выстрел`.
- Снизу по центру отображаются все weapon slots из текущего loadout.
- Каждый weapon slot показывает номер клавиши и projectile-изображение соответствующего оружия.
- Выбранный weapon slot визуально отличается от остальных.
- После выстрела slot показывает cooldown progress и возвращается в ready-состояние без текстового шума.
- Постоянные weapon modifiers отображаются badge-ами над соответствующим weapon slot.
- Временный overdrive отображается badge-ом с progress-фоном оставшегося времени.
- Несколько modifiers на одном оружии не ломают layout на desktop и mobile.
- HUD не перекрывает важную область боя и не ловит pointer/mouse events.
- Визуальная проверка: run с несколькими оружиями и pickup-ами показывает cooldown, selected slot и upgrades читаемо.

## Tasks

Стартовая таблица держит только крупные шаги. Полная декомпозиция делается при переводе истории в `in-progress`.

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [ ] | Design update: зафиксировать HUD presentation contract и, если нужно, расширение `WeaponHudSnapshot` для cooldown duration, modifiers и temporary overdrive progress. | Вероятные файлы: `main-ui-shell.md`, `snapshot-shape.md`, `universal-weapons-and-projectiles.md`; при необходимости новый `hud-presentation.md`. |
| T2 | [ ] | Реализовать новый player-facing HUD: убрать renderer debug HUD, сохранить FPS, заменить старый нижний HUD на top-left timer/status, bottom-left `WASD`, bottom-center weapon slots, bottom-right `ЛКМ: выстрел`. | Использовать существующие projectile/drop assets; без изменения input behavior. |
| T3 | [ ] | Тесты и визуальная проверка: view-model/unit tests для HUD, snapshot/export tests для новых данных, dev-server sanity на desktop/mobile с несколькими оружиями и pickup-ами. | Проверить cooldown fill, selected slot, stacked badges, overdrive progress и отсутствие text/layout overlap. |

## Related

- [../design/main-ui-shell.md](../design/main-ui-shell.md)
- [../design/snapshot-shape.md](../design/snapshot-shape.md)
- [../design/input-commands.md](../design/input-commands.md)
- [../design/universal-weapons-and-projectiles.md](../design/universal-weapons-and-projectiles.md)
- [../design/combat-modifiers-and-field-effects.md](../design/combat-modifiers-and-field-effects.md)
- [../design/sprite-assets.md](../design/sprite-assets.md)
- [../design/web-stack.md](../design/web-stack.md)
- [007-hud-and-menu.md](007-hud-and-menu.md)
- [017-universal-weapons-and-projectiles.md](017-universal-weapons-and-projectiles.md)
- [018-combat-modifiers-and-field-effects.md](018-combat-modifiers-and-field-effects.md)
