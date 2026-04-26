# Главное меню и startup UX

- Status: in-progress
- Created: 2026-04-26
- Updated: 2026-04-26

## Player-facing

- Видит: startup-заставка больше не растягивает реальную загрузку ассетов фейковыми счётчиками. После загрузки ассетов она продолжает короткий игровой ритуал подготовки мира: `Пробуждаем слизь`, `Замешиваем липкость`, `Спавним слаймов`, `Проектируем босса`, `Открываем путь побега`.
- Видит: заставка уходит через fade out в тёмный переходный фон, а главное меню появляется через fade in. Первый экран не моргает и не меняется резким hard-swap.
- Видит: главное меню как hand-drawn сцену по референсу [001-main.jpg](../mockups/001-main.jpg), собранную из `public/images/bg/bg-main.jpg` и нарезанных `public/images/menu/menu-main-*.png`.
- Видит: тексты меню и новые runtime-надписи в game/comic стиле: светлая или ярко-пастельная заливка, чёрная обводка, резкая чёрная тень.
- Может: выбрать `easy`, `normal` или `hard`; выбранный режим светится и мягко дышит.
- Может: запустить выбранную кампанию большой кнопкой Play.
- Может: запустить тренировочную сессию отдельной кнопкой Training, не смешанной с выбором сложности.
- Может: открыть настройки верхней правой кнопкой Settings и включить fullscreen верхней правой кнопкой Fullscreen.

## Product notes

- `normal` — выбранный режим по умолчанию. `easy` и `hard` читаются как переключатели сложности вокруг него.
- Training — отдельный вход, а не четвёртая сложность.
- Pets, Dungeon и Lab должны делать меню похожим на карту мира игры. В этой истории они могут быть teaser-блоками без перехода в отдельные экраны.
- Кандидат на основной UI-шрифт: `M PLUS Rounded 1c` в весах `800/900`, потому что он достаточно толстый под обводку и поддерживает кириллицу плюс широкий набор языков. Финальное закрепление шрифта — часть design-решения T1.

## Technical

История опирается на [menu-and-startup-presentation.md](../design/menu-and-startup-presentation.md): startup ritual timing, honest preload progress, required first-screen UI assets, phase transition curtain, stage-layout меню, image-button states, typography и reduced-motion behavior. `UiShell` остаётся owner фаз и transition barrier по [main-ui-shell.md](../design/main-ui-shell.md).

Технический срез:

- Обновить startup preload так, чтобы он включал gameplay textures из [sprite-assets.md](../design/sprite-assets.md) и required first-screen UI assets из нового menu/startup решения.
- Обновить `StartupOverlay`: asset progress честный; intentional delay живёт только в themed post-load steps.
- Добавить `UiShell`-owned phase transition curtain для `loading -> menu` и `menu -> running`: dark midpoint, commit phase switch while covered, fade in next screen, блокировка повторного input во время перехода.
- Пересобрать `MenuOverlay` из card-based DOM UI в fixed stage из image-ассетов:
  - background: `public/images/bg/bg-main.jpg`;
  - top-right buttons: `menu-main-settings.png`, `menu-main-soon.png`, `menu-main-fullscreen.png`;
  - difficulty buttons: `menu-main-mode-easy.png`, `menu-main-mode-normal.png`, `menu-main-mode-hard.png`;
  - launch buttons: `menu-main-play.png`, `menu-main-training.png`;
  - lower scene blocks: `menu-main-pets.png`, `menu-main-dungeon.png`, `menu-main-lab.png`.
- Default selected campaign mode: `campaign-normal`.
- Play запускает выбранный preset из `campaign-easy`, `campaign-normal`, `campaign-hard`.
- Training запускает preset `training` напрямую, даже если он остаётся скрытым из generic playable catalog.
- Hover, selected, disabled/soon, appear и reduced-motion states остаются presentation-only: они не меняют layout geometry и не мутируют session data.

## Out of scope

- Отдельные экраны Pets, Dungeon и Lab.
- Новый gameplay или persistence для Pets, Dungeon и Lab.
- Редизайн Pause, Result, Settings, combat HUD или wave title overlay, кроме общих правил типографики там, где они нужны.
- Сохранение последнего выбранного режима между перезагрузками страницы.
- XP/progression поведение для верхнего левого sketch-блока до отдельной истории прогрессии.
- Новые audio assets; история может только переиспользовать существующие UI click/overlay sounds.

## Acceptance

- На холодном старте прогресс загрузки ассетов отражает фактическое preload-состояние. После готовности ассетов любая оставшаяся задержка показывается только как themed game-prep steps, а не как fake asset counts.
- Завершение startup выполняет `splash fade out -> dark midpoint -> menu fade in` без белого/пустого мигания.
- При входе в меню все интерактивные menu assets появляются через opacity `0 -> 1` и scale `0.5 -> 1`.
- Hover любой активной кнопки добавляет читаемую подсветку через glow/brightness/drop-shadow и не меняет её layout footprint.
- Клик по `easy`, `normal` или `hard` обновляет selected state; одновременно выбран ровно один режим, он светится и мягко дышит.
- Play запускает текущий выбранный campaign preset.
- Training запускает preset `training`.
- Settings открывает существующий settings overlay.
- Fullscreen запрашивает fullscreen, если браузер разрешает, и gracefully fails, если запрос отклонён.
- Soon и нижние Pets/Dungeon/Lab scene blocks не запускают сессию; если они интерактивны, дают только мягкий `not yet` feedback.
- `prefers-reduced-motion` сохраняет fade, но отключает сильный zoom и breathing animation.
- Проверка на desktop landscape и узком viewport показывает, что элементы не перекрываются incoherent-образом: ключевые кнопки видны, кликабельны и layout узнаваемо следует mockup-референсу.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Architect: оформить [menu-and-startup-presentation.md](../design/menu-and-startup-presentation.md), обновить [main-ui-shell.md](../design/main-ui-shell.md), [design/README.md](../design/README.md), Related/Technical/Tasks этой истории и индекс [stories/README.md](README.md). | Закрывает contract для honest preload, post-load ritual, transition curtain, menu stage, typography и reduced-motion. |
| T2 | [x] | Расширить startup preload required asset set: gameplay textures + first-screen UI images (`slime-escape`, `bg-main`, `menu-main-*`), с hard-error через существующий startup error path. | UI images не становятся `SpriteVisualSpec`; список живёт в `src/main/ui/**`. |
| T3 | [x] | Переработать `StartupOverlay` view model/rendering: honest asset progress, отдельный themed post-load ritual, progress to `100%`, no fake asset counts. | Покрыть тестами различие actual asset progress vs ritual progress. |
| T4 | [x] | Добавить `UiShell` phase transition curtain для `loading -> menu` и `menu -> running`, включая input guard от повторного старта. | Commit phase switch while curtain is opaque; `StartupErrorOverlay` остаётся emergency top layer. |
| T5 | [x] | Пересобрать `MenuOverlay` stage layout по [001-main.jpg](../mockups/001-main.jpg): `bg-main`, top-right controls, difficulty buttons, Play, Training, Pets/Dungeon/Lab blocks. | Stable reference coordinates/aspect ratio; no card UI fallback. |
| T6 | [ ] | Реализовать menu behavior: default `campaign-normal`, difficulty selection, Play selected campaign, Training preset, Settings callback, Fullscreen callback, Soon/Pets/Dungeon/Lab teaser feedback. | `MenuOverlay` не обращается к sim/audio/settings/fullscreen напрямую; всё через callbacks from `UiShell`. |
| T7 | [ ] | Реализовать menu/startup visual states: appear opacity/scale, active hover/focus highlight, selected difficulty glow + breathing, disabled/soon state, comic text style and reduced-motion fallback. | Motion must not resize layout footprint; font loading is progressive enhancement. |
| T8 | [ ] | Финальная проверка: unit tests for startup/menu state, `npm test`, dev-server visual sanity on desktop and narrow viewport, plus start flows for easy/normal/hard/training. | Проверить no flashing, no overlap, clickable buttons, selected mode visibility, fullscreen graceful failure. |

## Related

- [main-ui-shell.md](../design/main-ui-shell.md)
- [menu-and-startup-presentation.md](../design/menu-and-startup-presentation.md)
- [sprite-assets.md](../design/sprite-assets.md)
- [audio.md](../design/audio.md)
- [client-settings.md](../design/client-settings.md)
- [hud-presentation.md](../design/hud-presentation.md)
- [001-main.jpg](../mockups/001-main.jpg)
- [022-combat-hud-redesign.md](022-combat-hud-redesign.md)
