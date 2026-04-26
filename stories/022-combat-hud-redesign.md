# Боевой HUD без дебага

- Status: in-progress
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

История опирается на новый контракт [hud-presentation.md](../design/hud-presentation.md): HUD остаётся пассивным `src/main/ui/**` компонентом под управлением `UiShell`, но его player-facing layout меняется на top-left run status, top-center boss strip, bottom-left `WASD`, bottom-center weapon slots и bottom-right `ЛКМ: выстрел`.

Технический срез:

- `WeaponHudSnapshot` расширяется по [snapshot-shape.md](../design/snapshot-shape.md): `cooldownStartedAtSimMs`/`cooldownReadyAtSimMs`, permanent `modifiers`, active `timedEffects`.
- `CombatSystem` хранит дополнительные поля owner-local `WeaponInstance` из [universal-weapons-and-projectiles.md](../design/universal-weapons-and-projectiles.md), чтобы snapshot export не угадывал cooldown/overdrive progress.
- Renderer-level debug HUD с `encounter`/`wave`/`hp`/`zone`/`drops` удаляется или становится no-op по умолчанию. `FpsOverlay` остаётся отдельным overlay справа сверху.
- `Hud.ts` перестаёт рендерить старые нижние блоки `HP`/`Weapon`/`Encounter`/`Wave`/`Boss`; run timer берётся из `snapshot.simTimeMs`, HP из `PlayerSnapshot`, boss strip из `bossHud`.
- Weapon slots используют `PROJECTILE_VISUALS[weaponArchetypeId].image`, а upgrade badges — явный mapping modifier/effect → `DROP_VISUALS[dropArchetypeId].image`.
- Input behavior не меняется: `WASD`, `Digit1..9`, `Digit0` и `ЛКМ` остаются контрактом [input-commands.md](../design/input-commands.md); HUD только показывает подсказки и не ловит события.

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

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Architect: оформить [hud-presentation.md](../design/hud-presentation.md), обновить [snapshot-shape.md](../design/snapshot-shape.md), [universal-weapons-and-projectiles.md](../design/universal-weapons-and-projectiles.md), [main-ui-shell.md](../design/main-ui-shell.md), смежные ссылки, [design/README.md](../design/README.md) и эту историю. | Закрывает контракт cooldown interval, modifiers, timed overdrive, HUD layout и debug removal boundary. |
| T2 | [x] | Расширить shared/runtime форму weapon HUD: `src/shared/snapshot.ts`, `CombatSystem.WeaponInstance`, `weaponHudFor(playerId, simTimeMs)`, `SnapshotExportSystem` и связанные тесты. | Поля: `cooldownStartedAtSimMs`, `cooldownReadyAtSimMs`, `modifiers`, `timedEffects`; expired overdrive не экспортируется. |
| T3 | [x] | Убрать renderer-level debug HUD по умолчанию из `Renderer.ts`, сохранив `FpsOverlay` в `src/main/index.ts`; обновить renderer tests, которые инжектят `createDebugHud`. | На странице не должно появляться DOM-панели `encounter/wave/hp/zone/drops`. |
| T4 | [x] | Пересобрать HUD view model в `src/main/ui/Hud.ts`: run timer из `snapshot.simTimeMs`, compact HP, boss strip, weapon slot descriptors, cooldown ratio, timed-effect ratio, badge grouping. | Сохранить пассивный lifecycle `attach/update/detach`; обновить `Hud.test.ts`. |
| T5 | [ ] | Реализовать новый DOM/CSS HUD layout: top-left status, top-center boss strip, bottom-left `WASD`, bottom-center weapon bar, bottom-right mouse hint. | `pointer-events:none`, viewport-fixed positioning, stable square slots, monospace/tabular timer, responsive desktop/mobile constraints. |
| T6 | [ ] | Подключить visual assets and badge mapping: projectile images from `PROJECTILE_VISUALS`, modifier/effect badges from `DROP_VISUALS`, selected-slot highlight, cooldown fill and timed overdrive fill. | Missing visual for known weapon/modifier is a test failure, not silent text fallback. |
| T7 | [ ] | Финальная проверка: unit/integration tests for snapshot + HUD, `npm test`, and dev-server visual sanity on desktop/mobile with multiple weapons, active cooldown, stacked modifiers and overdrive. | Проверить отсутствие overlap, отсутствие старой debug-панели, FPS справа сверху, `ЛКМ: выстрел` без pointer-lock текста. |

## Related

- [../design/hud-presentation.md](../design/hud-presentation.md)
- [../design/main-ui-shell.md](../design/main-ui-shell.md)
- [../design/snapshot-shape.md](../design/snapshot-shape.md)
- [../design/input-commands.md](../design/input-commands.md)
- [../design/universal-weapons-and-projectiles.md](../design/universal-weapons-and-projectiles.md)
- [../design/combat-modifiers-and-field-effects.md](../design/combat-modifiers-and-field-effects.md)
- [../design/sprite-assets.md](../design/sprite-assets.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/testing.md](../design/testing.md)
- [007-hud-and-menu.md](007-hud-and-menu.md)
- [017-universal-weapons-and-projectiles.md](017-universal-weapons-and-projectiles.md)
- [018-combat-modifiers-and-field-effects.md](018-combat-modifiers-and-field-effects.md)
