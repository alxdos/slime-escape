# Session End Results

- Status: done
- Created: 2026-04-26
- Updated: 2026-04-26

## Product intent

Конец забега должен ощущаться не как системная модалка, а как финальный кадр игровой сессии.

Игрок должен за 3-5 секунд понять:

- чем закончился забег;
- насколько далеко он дошёл;
- сколько хаоса он устроил;
- что хочется сделать дальше.

Победа должна быть праздником побега из мира слаймов. Поражение должно быть не ошибкой, а понятным итогом попытки: игрок видит прогресс, добытые убийства и получает желание попробовать ещё раз.

## Player-facing

- Sees: после победы экран результата появляется как яркий comic-финал: крупная надпись `Победа!`, праздничный салют/конфетти/слизистые вспышки, итоговая карточка забега и статистика. После поражения экран результата появляется как comic-катастрофа: крупная надпись `Забег окончен`, приглушённый ударный эффект, слизистые брызги/капли/заливка, итоговая карточка прогресса и статистика. В обоих случаях игрок видит процент прохождения, время забега, общее число убитых слаймов и разбивку убийств по типам слаймов с маленькими иконками. Если забег дошёл до босса, экран отдельно подсвечивает состояние босса: побеждён при победе, оставшийся HP при поражении.
- Can do: вернуться в меню; считать результат без знания внутренних систем; на поражении понять, насколько близко он был к победе; на победе почувствовать завершение забега как награду, а не просто переход состояния.

## Ideal Session Ending

### Victory

Победа начинается с короткого визуального взрыва: несколько салютных вспышек вокруг центра экрана, цветные частицы и слизистые `pop`-брызги вместо обычного конфетти. Экран не должен превращаться в тяжёлую анимационную сцену; это 1-2 секунды радости поверх текущего comic UI.

Карточка результата появляется с лёгким `bounce-in`.

Главный текст:

- `Победа!`
- `Ты выбрался из мира слаймов`

Главные итоги:

- `Прогресс: 100%`
- `Время: 04:18`
- `Убито слаймов: 143`
- `Собрано усилений: 12`

Трофеи забега:

- обычный слайм x80
- быстрый слайм x22
- стреляющий слайм x16
- большой слайм x8
- босс x1

Если босс был финалом, отдельная плашка сообщает: `Босс повержен`.

Тон: игрок не просто прошёл уровень, он прорвался наружу.

### Defeat

Поражение не должно быть унылой чёрной плашкой. Это comic-сцена: игрока снова залили слизью. Визуально: короткая ударная вспышка, чуть более тяжёлый цвет, слизистые капли или пятна вокруг карточки, меньше движения, чем на победе.

Главный текст:

- `Забег окончен`
- `Побег почти удался` или `Слизни снова сомкнули ловушку`

Главный фокус поражения - прогресс:

- `Прогресс: 73%`
- `Волна: 4 / 5`
- `Время: 03:12`
- `Убито слаймов: 96`

Если игрок дошёл до босса:

- `Босс: осталось 28% HP`

Если доступна причина смерти:

- `Добил: Прыгающий слайм`
- или `Причина: контактный урон`

Ниже такая же трофейная разбивка убийств по слаймам. Это важно: даже проигрыш должен показывать, что попытка была насыщенной и небесполезной.

Тон: `ты проиграл` заменяется на `вот насколько далеко ты забрался`.

## Result Stats

Экран результата должен показывать только статистику, которая помогает игроку эмоционально оценить забег.

Обязательные данные:

- outcome: victory / defeat
- progress percent
- run duration
- total kills
- kills by slime type
- completed waves / total waves, если применимо
- boss result, если применимо

Желательные данные:

- collected drops / upgrades
- death cause
- final boss HP percent on defeat
- most killed slime type

Не показывать:

- debug IDs
- внутренние названия encounter'ов
- технические timestamps
- слишком много чисел, которые спорят за внимание

## Progress Rules

Для игрока процент должен быть понятным, даже если внутри сессия состоит из разных encounter'ов.

- Победа всегда показывает `100%`.
- До босса прогресс примерно соответствует пройденным волнам/encounter'ам.
- Если игрок умер на боссе, прогресс должен выглядеть высоким, но не `100%`; например, учитывать оставшийся HP босса.
- В training/sandbox режимах, где нет настоящего финала, процент прохождения можно не показывать или заменить на режимный итог.

Важно: процент не должен ощущаться как ложь. Если игрок умер на последней фазе босса, экран должен честно сказать, что он был очень близко.

## Visual Direction

Общий стиль:

- та же comic-card система, что у pause/settings/menu;
- толстые чёрные контуры;
- кремовая/светлая карточка;
- цветные плашки статистики;
- маленькие иконки слаймов вместо голой таблицы;
- без тёмной generic web modal.

Victory palette:

- жёлтый, зелёный, голубой;
- яркие `pop`-вспышки;
- ощущение салюта и освобождения.

Defeat palette:

- розовый, красный, мутно-зелёный;
- слизистые пятна/капли;
- ощущение `поймали`, но без хоррора и без наказания игрока.

## Technical

- Новый shared-контракт `SessionResultSummary` и расширение terminal runtime events `win`/`loss` полем `summary` по [session-result-summary.md](../design/session-result-summary.md).
- Simulation-side `RunSummaryTracker`: hook-driven агрегатор смертей, pickup-ов, boss/progress state; `SessionFlowSystem` прикладывает summary к `win`/`loss` до teardown.
- `UiShell` хранит summary в `result` фазе и передаёт Result UI; Result UI строит main-side view model из summary, `SessionDefinition`, content registries и visual registries, без импортов из `src/sim/**`.
- Result overlay получает outcome-specific stats layout и presentation-only victory/defeat effects; gameplay renderer в `result` фазе остаётся уничтоженным по [main-ui-shell.md](../design/main-ui-shell.md). Victory fanfare идёт через `Audio.handleEvent(win)` по [audio.md](../design/audio.md), не из Result UI.

## Out of scope

- Leaderboards.
- Best run / personal records.
- Restart button, если текущий session flow не поддерживает быстрый restart безопасно.
- Детальная damage breakdown.
- Экран прокачки после забега.
- Постоянная история прошлых забегов.
- Новые игровые награды или unlock-и.
- Балансировка волн ради красивой статистики.

## Acceptance

- После победы игрок видит праздничный экран результата с анимацией салюта/конфетти и итоговой статистикой забега.
- После поражения игрок видит отдельный визуальный вариант результата с прогрессом, временем, убийствами и менее праздничным, но всё ещё игровым эффектом.
- В обоих outcomes есть outcome title, progress percent or equivalent session progress, run duration, total kills, kills by slime type with readable labels/icons, button back to menu.
- Победный и проигрышный экраны выглядят как часть Slime Escape, а не как generic web modal.
- На мобильном/маленьком viewport текст не налезает друг на друга, статистика остаётся читаемой.
- Если статистика по конкретному типу отсутствует, экран не показывает пустые/нулевые шумные строки.
- Demo-сценарий: запустить забег, вызвать победу, увидеть victory result; запустить забег, умереть, увидеть defeat result; сравнить, что эффекты, заголовки и статистика отличаются.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Shared protocol: ввести `SessionResultSummary`, расширить `RuntimeEvent.win/loss` полем `summary`, обновить типы, тест-хелперы и существующие ожидания terminal events. | Опора: [session-result-summary.md](../design/session-result-summary.md), [snapshot-shape.md](../design/snapshot-shape.md). |
| T2 | [x] | Simulation summary: добавить `RunSummaryTracker`, сброс lifecycle, death/drop pickup hooks, kill counts, defeat cause, boss state, progress percent; подключить к `SessionFlowSystem` так, чтобы `win/loss` публиковались с authoritative summary до teardown. | Summary hook должен отработать до terminal death hooks. Покрыть unit/integration tests для win, loss, boss loss/win и sandbox/no-progress. |
| T3 | [x] | Main result data flow: обновить `UiShell` и Result UI API на `outcome + summary`; построить pure view model для labels/icons/stats из summary + session/content/visual registries. | Result UI не импортирует `src/sim/**`; zero-count rows omit. |
| T4 | [x] | Result presentation: реализовать production-style victory/defeat result screen с progress, duration, total kills, kills by slime type, boss block, optional defeat cause, responsive layout and single back-to-menu action. | Визуально продолжает comic-card стиль pause/settings/menu. |
| T5 | [x] | Outcome effects and verification: добавить deterministic presentation-only victory fireworks/confetti and defeat slime splash/drip effects with `prefers-reduced-motion` fallback; покрыть DOM/unit tests where practical and run player demo checks for win/loss. | Эффекты живут в Result UI, не в gameplay Renderer. |

## Related

- [session-result-summary.md](../design/session-result-summary.md)
- [main-ui-shell.md](../design/main-ui-shell.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [runtime-systems.md](../design/runtime-systems.md)
- [health-and-death.md](../design/health-and-death.md)
- [drops.md](../design/drops.md)
- [boss-encounter.md](../design/boss-encounter.md)
- [session-definition.md](../design/session-definition.md)
- [audio.md](../design/audio.md)
- [thread-model.md](../design/thread-model.md)
- [content-archetypes.md](../design/content-archetypes.md)
- [sprite-assets.md](../design/sprite-assets.md)
- [testing.md](../design/testing.md)
- [../docs/VISION.md](../docs/VISION.md)
