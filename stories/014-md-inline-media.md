# MD Inline Media and Audio Sets

- Status: planned
- Created: 2026-04-23
- Updated: 2026-04-23

## Game designer

- Sees: открывая `content/enemies.md`, `content/bosses.md`, `content/players.md`, `content/weapons.md` в любом MD-viewer-е (GitHub PR, VS Code preview, IDE), геймдизайнер видит картинку каждого архетипа прямо под его `## <id>` заголовком — а у каждого оружия рядом видит кликабельную ссылку «послушать выстрел». Звуки слаймов больше не размазаны по 30 строкам с одинаковыми пулами: они собраны в одну новую партицию `# Sound sets` с узкими сравнительными таблицами (один пак — одна строка), где каждая ячейка — кликабельный сэмпл.
- Can do: добавить нового слайма/босса/оружие, явно вставив в его `## <id>` секцию `![](../public/assets/...)` (для изображения) или `[sample-id](../public/audio/...)` (для звука выстрела); добавить новый sound-set одной строкой в каждой таблице партиции `# Sound sets`; перевести слайма в другой sound-set, перенеся его `id` из одной строки `## Members` в другую. Опечатка в пути → картинка не рендерится в MD-viewer-е (видно сразу глазом) и `npm run content:build` падает с понятным сообщением.

## Technical

- Архитектор оформляет: расширение `design/content-authoring.md` (inline media-узлы как авторитетный источник для derive-полей, путь `../public/**` → runtime-key детерминированной функцией; новый класс «shared resource set с членами» как партиция внутри одной области); пометка `Updated` в `design/audio.md` (sound-sets как способ задавать enemy audio mappings без потери runtime-контракта).
- Изменения **только в генераторе** (`scripts/content-build/**`): рантайм-формы (`SpriteVisualSpec`, `EnemyAudioMapping`, `BOSS_AUDIO_MAPPINGS`, `WEAPON_AUDIO_MAPPINGS`, `SampleRegistry`, `AudioMappings.ts`, валидаторы) **не меняются**. Generator делает развёртку sound-set N→1 в `enemies/renderAudio.ts`; consumer-код продолжает получать `Record<enemyArchetypeId, EnemyAudioMapping>` байт-в-байт.
- Генератор остаётся read-only по отношению к MD: автор сам пишет `![](…)` и `[sample-id](../public/audio/…)`, генератор только парсит и достаёт нужное.

## Out of scope

- Inline `<audio>` HTML-теги — используем обычные markdown-link-и; на GitHub HTML-аудио вырезается, так что один формат на всех viewer-ов.
- Превью-генератор отдельным файлом (`*.preview.md`/HTML) — авторская поверхность остаётся в самом `content/<area>.md`.
- Расширение паттерна «shared resource set» на drops, weapons, players, sprite-палитры — только sound-sets для enemies. Остальное — будущие истории, когда появится боль.
- Cross-MD references (между `content/<area>.md` файлами) — sound-sets живут в той же области, что и enemies. Кросс-областные ссылки откладываются до отдельной истории.
- Любые изменения runtime-контрактов аудио и спрайтов — категорически вне scope. Если оказывается, что без правки runtime не сходится — это стоп-сигнал, а не повод расширить scope.

## Acceptance

- В `content/{enemies,bosses,players}.md` каждый `## <id>` содержит inline `![alt](../public/assets/<file>.png)` строкой между H2 и `field|value` таблицей. Раньше такого нет — добавить во все живые архетипы. Колонки/группы вида `## Visual` с `image` в `# Balance` исчезают: путь к спрайту берётся из inline-image-узла, не из таблицы.
- В `content/weapons.md` каждый `## <id>` содержит inline markdown-link `[sample-id](../public/audio/...)` строкой между H2 и `field|value` таблицей. Группа `## Sound` в `# Balance` исчезает: sample-id для `fire` берётся из inline-link-узла.
- В `content/enemies.md` появляется новая партиция `# Sound sets` с четырьмя узкими таблицами: `## Members` (`setId | slimes`), `## Hit` (`setId | s1 | s2 | s3 | s4`), `## Death` (то же), `## Voice` (то же). Группы `## Sounds` и `## Voice` из `# Balance` удалены. На MVP — один set `default`, перечисляющий всех 30 слаймов; runtime-mapping каждого слайма после генерации байт-в-байт совпадает с тем, что было до этой истории. Шаблон партиции:

  ```markdown
  # Sound sets

  ## Members

  | setId   | slimes |
  |---------|--------|
  | default | slime-one-eye, slime-hornling, slime-many-eye, … (всех 30) |

  ## Hit

  | setId   | s1                                                          | s2                                                          | s3                                                          | s4                                                          |
  |---------|-------------------------------------------------------------|-------------------------------------------------------------|-------------------------------------------------------------|-------------------------------------------------------------|
  | default | [slimes/hit-1](../public/audio/slimes/hit-1.mp3)            | [slimes/hit-2](../public/audio/slimes/hit-2.mp3)            | [slimes/hit-3](../public/audio/slimes/hit-3.mp3)            | [slimes/hit-4](../public/audio/slimes/hit-4.mp3)            |

  ## Death

  | setId   | s1                                                          | s2                                                          | s3                                                          | s4                                                          |
  |---------|-------------------------------------------------------------|-------------------------------------------------------------|-------------------------------------------------------------|-------------------------------------------------------------|
  | default | [slimes/death-1](../public/audio/slimes/death-1.mp3)        | [slimes/death-2](../public/audio/slimes/death-2.mp3)        | [slimes/death-3](../public/audio/slimes/death-3.mp3)        | [slimes/death-4](../public/audio/slimes/death-4.mp3)        |

  ## Voice

  | setId   | s1                                                          | s2                                                          | s3                                                          | s4                                                          |
  |---------|-------------------------------------------------------------|-------------------------------------------------------------|-------------------------------------------------------------|-------------------------------------------------------------|
  | default | [slimes/voice-1](../public/audio/slimes/voice-1.mp3)        | [slimes/voice-2](../public/audio/slimes/voice-2.mp3)        | [slimes/voice-3](../public/audio/slimes/voice-3.mp3)        | [slimes/voice-4](../public/audio/slimes/voice-4.mp3)        |
  ```

  Добавление второго пака — одна новая строка в каждой из четырёх таблиц с тем же `setId`. Перевод слайма в другой пак — перенос его `id` из строки `## Members` одного `setId` в строку другого.
- Генератор валидирует:
  - `id` из `## Members.slimes` существует в `# Enemies`;
  - каждый `id` из `# Enemies` принадлежит **ровно одному** sound-set'у (ни нулю, ни двум);
  - URL в любом media-узле начинается с `../public/` и резолвится в существующий файл на диске; абсолютные `/assets/...`, `http(s)://...` и любые другие префиксы — ошибка.
  - sample-id, извлечённый из URL, существует в `SampleRegistry`.
- При любой ошибке (битый путь, отсутствующий файл, slime в двух set'ах, slime ни в одном set'е, отсутствующий image-узел в H2 архетипа sprite-области, отсутствующий audio-link в H2 weapon) — `content:build` атомарно падает с сообщением `content/<area>.md: section "## …": <ожидалось>`, целевые файлы не модифицируются.
- Поведение игры **не меняется**: после `npm run content:build` все `.generated.ts` сохраняют тот же runtime-смысл, что и до истории. `npm test` зелёный, `npm run build` зелёный, gameplay-regression тесты зелёные.
- Demo (sprite preview): открыть `content/enemies.md` в GitHub PR-вьювере — каждый слайм виден картинкой между заголовком и таблицей. Поправить путь к sprite одного слайма на несуществующий — `content:build` падает с `cannot read PNG …`.
- Demo (sound listening): открыть `content/weapons.md` в VS Code/GitHub — клик по ссылке у `## pistol` запускает выстрел в внешнем плеере. Поправить путь — `content:build` падает с `unknown sample id …`.
- Demo (sound-set): открыть `content/enemies.md` партицию `# Sound sets` — клик по любому из 12 сэмплов в таблицах `## Hit`/`## Death`/`## Voice` запускает соответствующий звук. Перенести один slime id из строки `default` в новую вторую строку `## Members` (создать второй set с другим набором сэмплов) — после `content:build` именно этот слайм в игре звучит иначе, остальные 29 — без изменений.

## Tasks

Стартовая таблица. Полное дробление — за архитектором при взятии в работу.

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [ ] | Архитектор: оформить design-расширения (`content-authoring.md` — inline media как derive-источник, paths `../public/**`, новая партиция `# Sound sets` как класс «shared resource set с членами» внутри области; пометка `Updated` в `audio.md`); обновить `Related`/`Technical` истории и таблицу `stories/README.md`. | архитектор |

## Related

- [../design/content-authoring.md](../design/content-authoring.md)
- [../design/audio.md](../design/audio.md)
- [../design/sprite-assets.md](../design/sprite-assets.md)
- [011-content-from-md.md](011-content-from-md.md)
- [012-content-archetypes-from-md.md](012-content-archetypes-from-md.md)
- [013-sprite-assets-and-loader.md](013-sprite-assets-and-loader.md)
