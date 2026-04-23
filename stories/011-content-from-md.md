# Content from Markdown

- Status: in-progress
- Created: 2026-04-23
- Updated: 2026-04-23 (T4: bootstrap `scripts/content-build/` добавлен, no-op CLI `build/--check` работает, parser/helper/atomicWrite подготовлены для enemies-области)

## Game designer

- Sees: один MD-файл, описывающий всех слаймов, с разделами `# Slimes` (определение каждого слайма) и `# Balance` (узкие сравнительные таблицы по группам параметров). Это единая точка правды для баланса слаймов; ходить в `.ts` и в код больше не нужно.
- Can do: открыть MD в любом текстовом редакторе, поправить параметр (например `slime-fast.maxSpeed`), запустить `npm run content:build`, поднять локальный билд и сразу увидеть изменения в игре. При опечатке генератор падает с понятным сообщением и не портит рабочий конфиг.

## Technical

- Авторская поверхность и конвейер генерации зафиксированы в [../design/content-authoring.md](../design/content-authoring.md): один MD на область (`content/<area>.md`), один или несколько `.generated.ts` рядом с потребителем, генератор в `scripts/content-build/`, атомарная запись, отсутствие отдельного валидатора (структуру держат helper-ы и `tsc`), интеграция с `build` через `content:check`.
- Для области enemies генератор пишет в **два** слоя: балансные/контентные литералы → `src/shared/content/enemies.generated.ts` (потребитель — рукописный `enemies.ts` с типами и `validateEnemyRegistry`), аудио-маппинг → `src/main/audio/enemyAudio.generated.ts` (потребитель — рукописный `AudioMappings.ts`). Граница sim/presentation — по [../design/content-boundaries.md](../design/content-boundaries.md).
- Формы `EnemyArchetype` и `EnemyAudioMapping` не меняются — соответственно [../design/content-archetypes.md](../design/content-archetypes.md) и [../design/audio.md](../design/audio.md). Генератор обязан укладываться в существующий контракт; любое поле, которое нельзя выразить через эти формы, — сигнал к новому решению, а не к расширению генератора по месту.
- Корневой каталог `scripts/` для buildtime-инструментов разрешён `content-authoring.md` (исключение из правила [../design/web-stack.md](../design/web-stack.md) о новых корневых директориях). Никаких импортов из `scripts/**` в `src/**` и обратно (кроме типов из `src/shared/**` в генератор).
- Существующие npm-скрипты сохраняются по форме; `build` расширяется композицией: `npm run content:check && tsc -p tsconfig.json && tsc -p tsconfig.worker.json && vite build`. Vercel-деплой использует тот же `build`, поэтому дрейф ловится на стороне CI без отдельной конфигурации.

## Out of scope

- Сессии и encounter-композиция (волны, передышки, босс-spawn) — отдельная история; в этой работаем только со слаймами.
- Боссы, оружие, арены, игрок, drop-архетипы как самостоятельные сущности — отдельные истории, когда понадобятся.
- Спрайты слаймов: поле картинки в MD может присутствовать, но рендер по-прежнему рисует слайма цветным кругом — рендер-сторону в этой истории не меняем.
- Горячая перезагрузка MD без перезапуска `npm run dev`: пересборка конфига — явный шаг геймдизайнера.
- UI/редактор поверх MD: авторинг идёт в обычном текстовом редакторе.
- Любые форматы кроме Markdown (YAML/TOML/JSON как первичный источник правды) — намеренно не рассматриваем в этой истории.

## Acceptance

- В репозитории есть один MD-файл, описывающий всех слаймов; его правка — единственный способ для геймдизайнера изменить параметры слайма.
- Структура MD: раздел первого уровня `# Slimes` — определения по слаймам (раздел второго уровня `## <id>`, опциональная картинка, маленькая таблица «field/value» для именной части). Раздел первого уровня `# Balance` — сравнительные таблицы по группам параметров (`## Body`, `## Movement`, `## Contact damage`, `## Knockback`, `## Drops`, `## Sounds`); каждая таблица узкая (4–5 колонок), первая колонка — `id`, ссылающийся на слайма из `# Slimes`. Все группы — настоящие, то есть значения из таблицы реально дочитываются игрой; полей-«заглушек» в формате нет (исключение — картинка, рендер которой выключен явно).
- Команда `npm run content:build` (или эквивалентная по имени) полностью перегенерирует data-модуль слаймов в `src/shared/content/**`; этот модуль импортируется кодом ровно как сейчас, без изменений на стороне потребителей.
- При любой ошибке в MD генератор падает с понятным сообщением (файл, секция, строка, поле, что ожидалось) и **не пишет ничего** в выходной файл — предыдущий сгенерированный файл остаётся валидным и игра продолжает работать.
- Поведение игры не меняется: после первой генерации сгенерированные данные эквивалентны текущим параметрам слаймов и текущему звуковому поведению (тот же набор `hit/death/voice` сэмплов, что играет сейчас).
- Рантайм-валидации (`validateEnemyRegistry`, проверки туннелирования, проверки drop-таблиц) продолжают работать поверх сгенерированных данных. Если для звуков понадобится своя проверка (например, что `sampleId` существует в реестре) — она оформляется в том же стиле и в том же слое.
- CI ловит дрейф: если кто-то правит MD и не пересобирает — сборка красная (одна команда сравнивает свежесгенерированное с тем, что в репозитории).
- `npm test` остаётся зелёным.
- Demo (баланс): геймдизайнер открывает MD, меняет `slime-fast.maxSpeed` с `4` на `6`, запускает `npm run content:build` и `npm run dev`, видит ускорившихся быстрых слаймов в режимах `Побег` и `Тренировка`.
- Demo (звук): геймдизайнер в таблице `## Sounds` подменяет у `slime-tank` колонку `hit` на другой набор `sampleId` из `SampleRegistry`, пересобирает конфиг, и при попадании по танку звучит выбранный сэмпл вместо прежнего.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Архитектор: оформить `design/content-authoring.md` — устойчивые правила формата MD, пары `<area>.ts ↔ <area>.generated.ts` рядом с потребителем, конвейер `parse → render → atomic write`, отсутствие отдельного валидатора (helper-ы + `tsc`), интеграция в `build`, разрешение на `scripts/`. Проставить back-refs в смежных design-файлах (`content-boundaries.md`, `content-archetypes.md`, `audio.md`, `web-stack.md`), обновить `Index` в `design/README.md`, перевести историю в `in-progress`. | архитектор |
| T2 | [x] | Refactor `src/shared/content/enemies.ts`: вынести литералы `TRAINING_TARGET`/`SLIME_FAST`/`SLIME_TANK` (и реестр-массив, если так удобнее шаблону) в новый рукописный `src/shared/content/enemies.generated.ts`, типизированный публичным `EnemyArchetype` из `enemies.ts`. В `enemies.ts` удалить inline-объявления и импортировать литералы. Реестр `ENEMY_ARCHETYPES`, типы и `validateEnemyRegistry` остаются в `enemies.ts`. Header нового файла на этом шаге — временный «seed for content-from-md (story 011), regenerated by `scripts/content-build` after T6». `npm test` зелёный, поведение байт-в-байт. | опоры: `design/content-authoring.md`, `design/content-archetypes.md` |
| T3 | [x] | Refactor `src/main/audio/AudioMappings.ts`: вынести `SLIME_VARIANTS` и `ENEMY_AUDIO_MAPPINGS` в новый рукописный `src/main/audio/enemyAudio.generated.ts`, типизированные `Readonly<Record<string, EnemyAudioMapping>>` (тип импортируется из `AudioMappings.ts`). В `AudioMappings.ts` удалить inline-объявления и импортировать. `WEAPON_AUDIO_MAPPINGS`/`BOSS_AUDIO_MAPPINGS`/`EVENT_AUDIO_MAPPINGS` **не трогаем** — они вне скоупа. `AudioMappings.test.ts` зелёный. Тот же временный header. | опоры: `design/content-authoring.md`, `design/content-boundaries.md`, `design/audio.md` |
| T4 | [x] | Bootstrap генератора: создать `scripts/content-build/index.ts` (CLI: без аргументов = `build`, `--check` = drift-режим), `scripts/content-build/parse/` (micromark + mdast → input structure: дерево секций по H1/H2 + GFM-таблицы как `{ header[], rows[] }` со ссылкой на line/col), `scripts/content-build/util/atomicWrite.ts` (буферизация + temp + rename для всего набора целевых файлов; на ошибке — ничего не пишется), `scripts/content-build/util/require.ts` (`requireSection`, `requireRow`, `requireCell`, `requireNumber`, `requireHexColor`, `requireSampleIdList` с человекочитаемыми сообщениями `content/<area>.md: section "## …" row "<id>" column "<name>": <ожидалось>`). Добавить в `devDependencies`: `tsx`, `micromark`, `mdast-util-from-markdown`, `micromark-extension-gfm-table`, `mdast-util-gfm-table`. Без area-логики, без целевых файлов: `tsx scripts/content-build/index.ts` отрабатывает no-op и завершается с кодом 0. | опоры: `design/content-authoring.md`, `design/web-stack.md` |
| T5 | [ ] | Реализовать область enemies в генераторе: `scripts/content-build/enemies/parse.ts` (input structure → промежуточный объект enemies-области, ловит reference-ошибки между `# Balance` и `# Enemies`, не делает кодогенерации), `scripts/content-build/enemies/renderContent.ts` (TS-tagged template → исходник `src/shared/content/enemies.generated.ts`, импорт типа `EnemyArchetype` из `../../../src/shared/content/enemies.ts`, AUTO-GENERATED-баннер), `scripts/content-build/enemies/renderAudio.ts` (то же → `src/main/audio/enemyAudio.generated.ts`, импорт типа `EnemyAudioMapping` из `../../../src/main/audio/AudioMappings.ts`). Зарегистрировать область в `index.ts`. На этом шаге MD ещё нет — генератор работает, но без `content/enemies.md` падает с явным сообщением «source not found». | опоры: `design/content-authoring.md`, `design/content-archetypes.md`, `design/audio.md` |
| T6 | [ ] | Авторинг `content/enemies.md` со всеми текущими данными: партиция `# Enemies` (`## training-target`, `## slime-fast`, `## slime-tank` — каждая с таблицей `field/value` для `displayName`/`color`); партиция `# Balance` с группами `## Body` (id/radius/maxHp/behavior), `## Movement` (id/maxSpeed), `## Contact damage` (id/contactDamage/contactCooldownMs), `## Knockback` (id/baseImpulse/velocityScale/durationMs), `## Drops` (id/dropArchetypeId/chance — без строк для `training-target`), `## Sounds` (id/hit/death — пустые ячейки у `training-target`), `## Voice` (id/sampleIds/intervalMinMs/intervalMaxMs — без строки для `training-target`). `npm run content:build` → сгенерированные файлы текстуально эквивалентны рукописным версиям из T2/T3 после нормализации (порядок ключей, отступы). При расхождениях — корректировать шаблоны T5, не данные. После сходимости временные header-ы из T2/T3 заменяются на финальный AUTO-GENERATED. `npm test` остаётся зелёным. | опоры: `design/content-authoring.md` |
| T7 | [ ] | Расширить `package.json`: добавить `content:build` (`tsx scripts/content-build/index.ts`), `content:check` (`tsx scripts/content-build/index.ts --check`), `predev` (`npm run content:build`); расширить `build` композицией: `npm run content:check && tsc -p tsconfig.json && tsc -p tsconfig.worker.json && vite build`. Существующие `dev`/`preview`/`typecheck`/`test`/`test:watch` — без изменений. Проверить: `npm run dev` (через `predev`) зелёный, `npm run build` зелёный. | опоры: `design/content-authoring.md`, `design/web-stack.md` |
| T8 | [ ] | Тесты на генератор (vitest, рядом с модулями `scripts/content-build/**` или в `__tests__/`): (а) happy path — парсинг текущего `content/enemies.md` даёт выход, идентичный закоммиченным `enemies.generated.ts` и `enemyAudio.generated.ts`; (б) отсутствующая обязательная ячейка → exit non-zero, целевые файлы не модифицированы; (в) ссылка на неизвестный `id` в `# Balance` → exit non-zero; (г) дрейф — синтетическая модификация ячейки в MD, `--check` падает с понятным diff'ом; (д) атомарность — симуляция ошибки рендера одной области не приводит к частичной перезаписи другой. Расширить vitest-конфиг при необходимости, чтобы тесты `scripts/**` подхватывались. | опоры: `design/content-authoring.md`, `design/testing.md` |
| T9 | [ ] | Demo проверка acceptance: (1) поменять `slime-fast.maxSpeed` `4 → 6` в MD, `npm run content:build` + `npm run dev`, наблюдать ускоренного слайма в `Побеге`/`Тренировке`; (2) подменить колонку `hit` у `slime-tank` в `## Sounds` на другой набор `sampleId` из `SampleRegistry`, пересобрать, наблюдать иной звук попадания. После проверки — откатить демо-правки. Зафиксировать факт прогона в `Updated` истории. | опоры: `design/content-authoring.md` |
| T10 | [ ] | Закрытие истории: чек-лист закрытия из `stories/README.md`; проверка `Index` в `design/README.md`; перевод `Status` истории в `done` и обновление таблицы в `stories/README.md`. | архитектор |

## Related

- [../design/content-authoring.md](../design/content-authoring.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/content-archetypes.md](../design/content-archetypes.md)
- [../design/audio.md](../design/audio.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/logging.md](../design/logging.md)
- [../design/testing.md](../design/testing.md)
