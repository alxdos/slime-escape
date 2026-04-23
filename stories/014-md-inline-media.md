# MD Inline Media and Audio Sets

- Status: in-progress
- Created: 2026-04-23
- Updated: 2026-04-23 (T6: `players` переведены на H2 inline image для sprite PNG, legacy `## Visual` запрещён, generated visuals остались без diff; T5: `weapons` переведены на H2 inline audio-link для `fire`, legacy `## Sound` запрещён, generated audio остался без diff; T4: добавлен helper `sharedResourceSet` для `# Sound sets`-подобных партиций, membership-инвариантов и единой формы sampleId-ячеек; T3: добавлены helpers `inlineMedia` для inline image/audio-link и URL↔SampleRegistry cross-check; T2: parser-слой `inputStructure` экспонирует H2 `mediaNodes` и `MarkdownCell.inlineLink`; T1: оформлены design-расширения — `content-authoring.md` (inline media-узлы как derive-источник, shared resource set partition), пометки `Updated` в `audio.md` и `sprite-assets.md`; история декомпозирована и переведена в `in-progress`)

## Game designer

- Sees: открывая `content/enemies.md`, `content/bosses.md`, `content/players.md`, `content/weapons.md` в любом MD-viewer-е (GitHub PR, VS Code preview, IDE), геймдизайнер видит картинку каждого архетипа прямо под его `## <id>` заголовком — а у каждого оружия рядом видит кликабельную ссылку «послушать выстрел». Звуки слаймов больше не размазаны по 30 строкам с одинаковыми пулами: они собраны в одну новую партицию `# Sound sets` с узкими сравнительными таблицами (один пак — одна строка), где каждая ячейка — кликабельный сэмпл.
- Can do: добавить нового слайма/босса/оружие, явно вставив в его `## <id>` секцию `![](../public/assets/...)` (для изображения) или `[sample-id](../public/audio/...)` (для звука выстрела); добавить новый sound-set одной строкой в каждой таблице партиции `# Sound sets`; перевести слайма в другой sound-set, перенеся его `id` из одной строки `## Members` в другую. Опечатка в пути → картинка не рендерится в MD-viewer-е (видно сразу глазом) и `npm run content:build` падает с понятным сообщением.

## Technical

- Архитектор оформляет: расширение `design/content-authoring.md` (inline media-узлы как авторитетный источник для derive-полей, путь `../public/**` → public-relative URL через strip единственного префикса; новый класс «shared resource set с членами» как партиция внутри одной области); пометка `Updated` в `design/audio.md` (sound-sets как способ задавать enemy audio mappings без потери runtime-контракта); пометка `Updated` в `design/sprite-assets.md` (авторская поверхность для пути к PNG переезжает с MD-колонки `image` на inline image-узел; `SpriteVisualSpec` и producer-правило `worldSize` не меняются).
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

T1 уже выполнен этим самым проходом архитектора (расширение `design/content-authoring.md`, пометки `Updated` в `design/audio.md` и `design/sprite-assets.md`); помечен `[x]` в момент перевода истории в `in-progress`. T2–T4 — расширения buildtime-инфраструктуры; T5–T9 — миграция конкретных областей (каждая = bytes-equal `.generated.ts` + правка соответствующего `content/<area>.md`); T10 — закрытие.

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Архитектор: оформить design-расширения — `design/content-authoring.md` (разделы «Inline media-узлы как derive-источники» и «Shared resource set partition», уточнение роли inline-узлов в партиции определений, новые пункты в «Запрещённые шаблоны»); пометка `Updated` в `design/audio.md` (sound-sets как способ задавать enemy audio mappings без изменения runtime-форм); пометка `Updated` + правка правила «MD-колонка `image`» в `design/sprite-assets.md` (авторская поверхность — inline image-узел; рантайм-контракт `SpriteVisualSpec` не меняется); декомпозиция T2–T10, перевод `Status` в `in-progress`, обновление таблицы в `stories/README.md`. | архитектор |
| T2 | [x] | Расширить parser-слой `scripts/content-build/parse/inputStructure.ts`: для каждого `MarkdownSection` экспонировать `mediaNodes: ReadonlyArray<{ kind: 'image' \| 'link'; alt?: string; label?: string; url: string; position: SourcePosition }>`, собранные из `paragraph`-узлов под H2 (вне таблиц). Параллельно для `MarkdownCell` сохранять `inlineLink: { label: string; url: string } \| null`, если ячейка состоит ровно из одного link-узла без посторонего текста (для shared resource set partition cells). Парсер не валидирует семантику — только форму. Unit-тесты в `scripts/content-build/parse/inputStructure.test.ts`: image-узел и link-узел под H2; ячейка-link; ячейка-plain; ячейка с миксом текста и link → `inlineLink === null`. | опоры: `design/content-authoring.md` |
| T3 | [x] | Helpers `scripts/content-build/util/inlineMedia.ts`: `requireInlineImage(section, opts)` → `{ url: publicRelativePath, absolutePath }` (валидирует префикс `../public/` со strip и существование файла; bubbling сообщение `content/<area>.md: section "## <id>": expected ![…](../public/…) under H2`); `requireInlineAudioLink(section, sampleRegistry)` → `{ sampleId, url, absolutePath }` (валидирует «ровно один audio-link под H2», link-text ∈ `SampleRegistry`, URL после strip байт-в-байт == `SampleRegistry[sampleId].url`); `requireInlineAudioLinkCell(cell, sampleRegistry)` для использования внутри group-таблиц shared resource set partition (та же дуальная валидация, без требования наличия). Все helpers — чистые, без скрытого state. Unit-тесты в `util/inlineMedia.test.ts`: happy path (image), happy path (audio-link H2), happy path (audio-link cell), битый префикс, несуществующий файл, неизвестный sampleId, mismatch URL/registry, отсутствие узла там, где требуется. | опоры: `design/content-authoring.md` |
| T4 | [x] | Helper `scripts/content-build/util/sharedResourceSet.ts`: `parseSharedResourceSetPartition(partition, opts)` → `{ members: ReadonlyMap<archetypeId, setId>; groups: ReadonlyMap<groupName, ReadonlyMap<setId, ReadonlyArray<MarkdownCell>>> }`. Валидирует общие инварианты («ровно один set на архетип», «незнакомый setId», «незнакомый archetypeId в `## Members`»); проверка обязательных групп — параметр опций `requiredGroups: ReadonlyArray<string>`. Helper `expandSetToMembers(members, perSetValue)` → `ReadonlyMap<archetypeId, value>` (чистая N→1 развёртка). Helper для `sampleId`-ячеек с обнаружением единой формы таблицы (plain vs inline audio-link, проверка отсутствия миксования в одной group-таблице). Unit-тесты в `util/sharedResourceSet.test.ts`: happy path с одним и двумя set'ами; archetype в двух set'ах; archetype ни в одном set'е; незнакомый setId в group-таблице; пропущена обязательная группа; mix форм cell в одной group-таблице. | опоры: `design/content-authoring.md` |
| T5 | [x] | Миграция области `weapons`: правка `scripts/content-build/weapons/parse.ts` — `fire` для каждого weapon-архетипа читается через `requireInlineAudioLink` из H2; группа `## Sound` в `# Balance` запрещена (генератор падает при её появлении). Правка `content/weapons.md`: под каждый `## <id>` добавить inline `[<sample-id>](../public/audio/...)`, удалить группу `## Sound`. После `npm run content:build` файл `src/main/audio/weaponAudio.generated.ts` остаётся **байт-в-байт** прежним; `content:check` зелёный. | опоры: T2, T3 |
| T6 | [x] | Миграция области `players`: правка `scripts/content-build/players/parse.ts` — путь к PNG для каждого player-архетипа читается через `requireInlineImage` из H2; группа `## Visual` в `# Balance` запрещена. Правка `content/players.md`: под каждый `## <id>` добавить inline `![alt](../public/assets/...)`, удалить группу `## Visual`. `src/main/render/playerVisuals.generated.ts` — байт-в-байт прежний; `content:check` зелёный. | опоры: T2, T3 |
| T7 | [ ] | Миграция области `bosses`: правка `scripts/content-build/bosses/parse.ts` — путь к PNG читается через `requireInlineImage`; группа `## Visual` запрещена. Правка `content/bosses.md`: inline image-узел под каждым `## <id>`, удаление `## Visual`. `src/main/render/bossVisuals.generated.ts` — байт-в-байт прежний. | опоры: T2, T3 |
| T8 | [ ] | Миграция enemies — image: правка `scripts/content-build/enemies/parse.ts` — путь к PNG читается через `requireInlineImage`; группа `## Visual` в `# Balance` запрещена. Правка `content/enemies.md`: inline image-узел под каждым из 30 `## <id>`, удаление `## Visual`. `src/main/render/enemyVisuals.generated.ts` — байт-в-байт прежний. (Изменения по sound-sets — отдельной задачей T9, чтобы две независимые миграции внутри одного MD-файла можно было ревьюить раздельно.) | опоры: T2, T3 |
| T9 | [ ] | Миграция enemies — sound sets: правка `scripts/content-build/enemies/parse.ts` под чтение партиции `# Sound sets` через `parseSharedResourceSetPartition` (`## Members` с шапкой `setId | slimes`; обязательные группы `## Hit`, `## Death`, `## Voice`, у каждой шапка `setId | s1 | s2 | s3 | s4`); группы `## Sounds` и `## Voice` в `# Balance` запрещены. Парсер делает N→1 развёртку и кормит `enemies/renderAudio.ts` тем же per-enemy `{ hit, death, voice.sampleIds }`, что и раньше — итоговый `src/main/audio/enemyAudio.generated.ts` остаётся **байт-в-байт** прежним (на MVP — один set `default`, перечисляющий всех 30 слаймов; ячейки в форме inline audio-link). Правка `content/enemies.md`: добавить новую партицию `# Sound sets` по шаблону из `Acceptance`, удалить `## Sounds` и `## Voice` из `# Balance`. Тесты на инварианты партиции (slime в нуле/двух set'ах, незнакомый setId, пропуск обязательной группы) живут на уровне T4; здесь — area-уровень `scripts/content-build/enemies/enemies.test.ts` (smoke + bytes-equal). | опоры: T2, T3, T4 |
| T10 | [ ] | Закрытие: `npm run content:build` (атомарный успех на чистом дереве), `npm run content:check` (zero diff против закоммиченного), `npm test` и `npm run build` зелёные; gameplay-regression тесты не отвалились. Manual demos из `Acceptance`: (1) PR-вьювер показывает sprite preview под H2 каждого слайма/босса/героя; (2) клик по `[…](…)` в `## pistol` открывает MP3 в плеере; (3) клики по 12 ячейкам в `# Sound sets` играют ожидаемые сэмплы; (4) умышленно сломанный путь к PNG/MP3 — `content:build` падает с понятным сообщением, ни один `.generated.ts` не модифицирован. Архитектор переводит `Status` истории в `done` и обновляет таблицу в `stories/README.md`. | архитектор |

## Related

- [../design/content-authoring.md](../design/content-authoring.md)
- [../design/audio.md](../design/audio.md)
- [../design/sprite-assets.md](../design/sprite-assets.md)
- [011-content-from-md.md](011-content-from-md.md)
- [012-content-archetypes-from-md.md](012-content-archetypes-from-md.md)
- [013-sprite-assets-and-loader.md](013-sprite-assets-and-loader.md)
