# Sessions from Markdown

- Status: in-progress
- Created: 2026-04-23
- Updated: 2026-04-23 (T1: оформлены design-расширения — `content-authoring.md` (новые разделы «Multi-file области» и «Несколько таблиц в одной H2-секции» с явным перечислением областей и сигнатур, расширены «Запрещённые шаблоны» и «Consequences», добавлен story 015 в `Related`); пометка `Updated` в `session-definition.md` (метаданные пресета переезжают в `content library`, форма `SessionDefinition` не меняется); пометка `Updated` в `main-ui-shell.md` (playable preset catalog становится derived view над `SESSION_PRESET_TEMPLATES`, отдельный `playableModes.ts`/`PlayableModeEntry`-реестр исчезает, раздел «Меню и playable preset catalog» переписан под новый источник правды); декомпозиция T2–T10 в `Tasks`, `Status` истории переведён в `in-progress`, таблица в `stories/README.md` обновлена)

## Game designer

- Sees: новая папка `content/sessions/` с одним MD-файлом на пресет (`campaign.md`, `training.md`, `sandbox.md`, `sandbox-with-combat.md`). Каждый файл — единая точка правды для одного пресета: метаинформация (`displayName`, `description`, `order`, `arenaId`, `playerId`, `loadoutWeaponId`, `winCondition`, `lossCondition`) + полный список encounter'ов в порядке их появления, со всеми параметрами волн, передышек, зон и босса видно прямо в файле. Ходить в `src/shared/content/buildSession.ts` и `playableModes.ts` за этими числами больше не нужно.
- Can do: открыть `content/sessions/campaign.md`, поправить любой балансный параметр одного encounter'а (темп волны `spawnIntervalMs`, лимит одновременно живых `maxAlive`, состав волны в таблице `seq | archetypeId`, длительность зоны `zoneDurationMs`, длительность передышки `transitionDurationMs`, выбор босса `bossArchetypeId`), запустить `npm run content:build` и `npm run dev`, сразу увидеть изменение в игре. Добавить новый пресет — создать `content/sessions/<id>.md` по тому же шаблону; ничего другого трогать не нужно. Спрятать пресет из меню — `visibleInMenu | false` в `# Session`. Опечатка в любом id (`arenaId`, `playerId`, `loadoutWeaponId`, `bossArchetypeId`, `archetypeId` в спавне) — генератор падает с понятным сообщением `content/sessions/<file>.md:<line>:<col>: …`, ни один `.generated.ts` не модифицируется.

## Technical

- Архитектор оформляет: расширение [../design/content-authoring.md](../design/content-authoring.md) — два новых раздела: «Multi-file области» (filename без расширения = id единицы; отсортированный обход для стабильного diff; кросс-файловая уникальность id; явный список multi-file областей сейчас содержит только `sessions`) и «Несколько таблиц в одной H2-секции» (точечное правило для области `sessions`: encounter-секция допускает первую `field | value` таблицу + опциональную вторую `seq | archetypeId [| x | y]` со специальной сигнатурой; для `spawnKind ∈ {wave, static}` вторая таблица обязательна, для `spawnKind ∈ {empty, boss}` — запрещена). Пометка `Updated` в [../design/session-definition.md](../design/session-definition.md) (метаданные пресета — `displayName`/`description`/`visibleInMenu`/`order` — переезжают в `content library`, раньше жили в `playableModes.ts`; форма `SessionDefinition` не меняется). Пометка `Updated` в [../design/main-ui-shell.md](../design/main-ui-shell.md) (playable preset catalog derived из `SESSION_PRESET_TEMPLATES.filter(visibleInMenu).sort(byOrder)`; `PLAYABLE_MODE_CATALOG` как отдельная сущность исчезает).
- Изменения **только** в `scripts/content-build/**` (новая area `sessions/`), `src/shared/content/sessions.generated.ts` (новый файл), `src/shared/content/buildSession.ts` (свёрнут до тонкой обёртки). Удаляются: `src/shared/content/presets.ts` и `src/shared/content/playableModes.ts`. Runtime-формы (`SessionDefinition`, `EncounterDefinition`, `SpawnPlan`, `ZoneBehavior`, `TransitionRules`, `Loadout`, `WinCondition`, `LossCondition`) **не меняются** — вне scope этой истории, без расширений per [content-archetypes.md](../design/content-archetypes.md) и [session-definition.md](../design/session-definition.md).
- Cross-area references (`arenaId`, `playerId`, `loadoutWeaponId`, `bossArchetypeId`, `archetypeId` в спавнах) валидируются area-парсером через импорт уже сгенерированных `arenas/players/weapons/bosses/enemies.generated.ts`; `sessions.generated.ts` пишется как **прямые TS-импорты** констант (`SANDBOX_ARENA`, `HERO`, `PISTOL`, `BOSS_SCRAP_KING`, `SLIME_ONE_EYE`, …), drift между MD и реестрами после этого ловит `tsc` поверх сгенерированного. Это первая область с cross-area refs; принцип фиксируется как часть «Multi-file области» в `content-authoring.md`.
- `bossSpawnPosition: top-center` остаётся **вычислением на стороне builder** (`bossTopCenterSpawnInArena(arena, bossRadius, bossEdgeMargin)` уже есть в `buildSession.ts:367-375`); форма `BossSpawnPlan.position: Vec2` (`spawn-plan.md`) не меняется. Дополнительные символьные позиции добавляются по факту появления потребителя, отдельным расширением `spawn-plan.md`.
- Тип `ModePresetId` становится derived: `as const satisfies` на литерале `SESSION_PRESET_TEMPLATES` + `keyof typeof`; отдельной декларации в `presets.ts` нет (файл удаляется). Это устраняет дублирование «ключи объекта vs альтернативы типа».

## Out of scope

- Любые изменения **значений** балансных чисел в текущих пресетах: задача — перенос 1:1, поведение игры остаётся байт-в-байт прежним до первой правки геймдизайнером.
- Расширение `EncounterDefinition` новыми полями (новые `kind` для `spawnPlan`/`zoneBehavior`/`transitionRules`, новые поля метаинформации сессии). Если оказывается, что без расширения runtime-контракта не сходится — это стоп-сигнал, а не повод расширить scope.
- Новые пресеты сверх существующих четырёх (`campaign`, `training`, `sandbox`, `sandbox-with-combat`). Добавление пресета — отдельная история, когда появится дизайнерская задача.
- Перенос `arenas`/`players` в полноценные multi-сущность области (сейчас в каждой по одному элементу — `SANDBOX_ARENA`, `HERO`). Cross-area refs из sessions ссылаются на уже существующие `arenas.generated.ts`/`players.generated.ts`/`weapons.generated.ts`; правка форм этих областей — будущие истории.
- Новые позиционирования босса сверх `top-center` (например, `arena-center`, произвольные координаты). Добавляются по факту появления потребителя, отдельным расширением `spawn-plan.md`.
- Audio/visuals области (например, `content/audio.md` для `SampleRegistry`/music pool) — отдельные истории.
- Горячая перезагрузка MD без перезапуска `npm run dev` и UI-редактор поверх MD: авторинг идёт в обычном текстовом редакторе, пересборка конфига — явный шаг.

## Acceptance

- В репозитории появляется папка `content/sessions/` с четырьмя файлами: `campaign.md`, `training.md`, `sandbox.md`, `sandbox-with-combat.md`. Это **единственный** способ для геймдизайнера править параметры пресета сессии. Файл `src/shared/content/buildSession.ts` сворачивается до тонкой обёртки (читает template из `sessions.generated.ts`, докладывает `seed`/`id` из `BuildOptions`, разрешает символьные позиции вроде `top-center` и собирает финальный `SessionDefinition`). Файлы `src/shared/content/presets.ts` и `src/shared/content/playableModes.ts` исчезают — вся метаинформация пресета (`displayName`, `description`, `order`, `visibleInMenu`) живёт в `# Session` каждого MD.
- Структура каждого MD: партиция `# Session` с одной таблицей `field | value` (метаинформация пресета). Партиция `# Encounters` с H2 на каждый encounter в порядке появления; внутри каждой H2 — одна таблица `field | value` с общими параметрами encounter'а (с префиксами `spawn*`, `zone*`, `transition*`, `boss*` для группировки) и опционально вторая таблица `seq | archetypeId [| x | y]` для волн (`spawnKind = wave`) и статических спавнов (`spawnKind = static`). Для `spawnKind ∈ {empty, boss}` второй таблицы быть не должно. Все поля — настоящие, то есть значения из таблиц реально дочитываются игрой; полей-«заглушек» нет.
- Команда `npm run content:build` полностью перегенерирует `src/shared/content/sessions.generated.ts`; этот модуль импортируется существующим builder-кодом так же, как сейчас импортируются `enemies.generated.ts`/`weapons.generated.ts`/`bosses.generated.ts`/`drops.generated.ts`/`players.generated.ts` — без runtime-изменений на стороне потребителей (`UiShell`, `MenuOverlay`, тестов).
- Cross-area references валидируются на этапе генерации: `arenaId`, `playerId`, `loadoutWeaponId`, `bossArchetypeId`, `archetypeId` в спавнах должны существовать в соответствующих закоммиченных `*.generated.ts`. Неизвестный id — `content:build` падает с сообщением `content/sessions/<file>.md:<line>:<col>: section "## …": unknown <field> "<value>"`. На уровне сгенерированного `sessions.generated.ts` те же ссылки выражены как прямые TS-импорты констант (`SANDBOX_ARENA`, `HERO`, `PISTOL`, `BOSS_SCRAP_KING`, `SLIME_ONE_EYE`, …) — drift между MD и реестрами поймает `tsc` поверх сгенерированного.
- При любой ошибке в MD (отсутствующая обязательная ячейка, опечатка в `spawnKind`/`zoneKind`/`transitionKind`, незнакомый id, вторая таблица там, где запрещена, обратное — отсутствие там, где обязательна) генератор падает с понятным сообщением и **не пишет ничего** в выходной файл — предыдущий `sessions.generated.ts` остаётся валидным, игра продолжает работать.
- Шаблон MD одного пресета (на примере `training`, по которому видны все пять форм encounter'а: wave с второй таблицей, break с timer-transition, sandbox-encounter без второй таблицы, boss-encounter с символьной позицией, static-encounter с координатами):

  ```markdown
  # Session

  | field | value |
  |---|---|
  | displayName | Тренировка |
  | description | Короткая сессия без босса, чтобы размяться и проверить сборку. |
  | visibleInMenu | true |
  | order | 1 |
  | arenaId | sandbox |
  | playerId | hero |
  | loadoutWeaponId | pistol |
  | winCondition | allEncountersComplete |
  | lossCondition | playerDeath |

  # Encounters

  ## training-wave-1

  | field | value |
  |---|---|
  | type | wave |
  | spawnKind | wave |
  | spawnIntervalMs | 1500 |
  | maxAlive | 4 |
  | edgeMargin | 0.5 |
  | zoneKind | shrinkLinear |
  | zoneFromMargin | 0 |
  | zoneToMargin | 4 |
  | zoneDurationMs | 8000 |
  | transitionKind | allEnemiesCleared |
  | next | sequential |

  | seq | archetypeId |
  |---:|---|
  | 1 | slime-one-eye |
  | 2 | slime-one-eye |
  | 3 | slime-shell |
  | 4 | slime-one-eye |
  | 5 | slime-one-eye |
  | 6 | slime-shell |

  ## training-break

  | field | value |
  |---|---|
  | type | break |
  | spawnKind | empty |
  | zoneKind | expandLinear |
  | zoneFromMargin | 4 |
  | zoneToMargin | 0 |
  | zoneDurationMs | 2500 |
  | transitionKind | timer |
  | transitionDurationMs | 3000 |
  | next | sequential |

  ## training-wave-2

  | field | value |
  |---|---|
  | type | wave |
  | spawnKind | wave |
  | spawnIntervalMs | 1200 |
  | maxAlive | 5 |
  | edgeMargin | 0.5 |
  | zoneKind | shrinkLinear |
  | zoneFromMargin | 0 |
  | zoneToMargin | 5 |
  | zoneDurationMs | 10000 |
  | transitionKind | allEnemiesCleared |
  | next | sequential |

  | seq | archetypeId |
  |---:|---|
  | 1  | slime-one-eye |
  | 2  | slime-one-eye |
  | 3  | slime-one-eye |
  | 4  | slime-shell |
  | 5  | slime-one-eye |
  | 6  | slime-one-eye |
  | 7  | slime-shell |
  | 8  | slime-one-eye |
  | 9  | slime-shell |
  | 10 | slime-one-eye |
  ```

  Дополнительные формы encounter'ов (используются в `campaign.md`/`sandbox.md`/`sandbox-with-combat.md`):

  ```markdown
  ## campaign-boss

  | field | value |
  |---|---|
  | type | boss |
  | spawnKind | boss |
  | bossArchetypeId | boss-scrap-king |
  | bossSpawnPosition | top-center |
  | bossEdgeMargin | 0.5 |
  | zoneKind | disabled |
  | transitionKind | allEnemiesCleared |
  | next | sequential |

  ## sandbox-encounter

  | field | value |
  |---|---|
  | type | sandbox |
  | spawnKind | empty |
  | zoneKind | disabled |
  | transitionKind | never |
  | next | sequential |

  ## sandbox-with-combat-encounter

  | field | value |
  |---|---|
  | type | sandbox |
  | spawnKind | static |
  | zoneKind | disabled |
  | transitionKind | never |
  | next | sequential |

  | seq | archetypeId | x | y |
  |---:|---|---:|---:|
  | 1 | slime-bug | 5 | 0 |
  ```

  Для скрытого пресета (`sandbox.md`/`sandbox-with-combat.md`) `# Session` отличается двумя строками: `| visibleInMenu | false |` и `| order | 0 |` (значение `order` всё равно обязательно по правилу «без двух разных нет данных»; в каталог UI пресет не попадает из-за `visibleInMenu`).
- Поведение игры **не меняется**: для каждого presetId со seed=0 (и любым другим стабильным seed) текущий и новый `buildSessionDefinition` возвращают deep-equal `SessionDefinition`. Acceptance-тест сравнения добавлен и зелёный. Все существующие гейм-плей и интеграционные тесты (`SessionFlowSystem.test.ts`, `boss.integration.test.ts`, `combat.integration.test.ts`, `drops.integration.test.ts`, `training.integration.test.ts`, `playableModes.test.ts`) — зелёные без изменения числовых ожиданий.
- Каталог режимов в UI (меню) после миграции собирается из `Object.values(SESSION_PRESET_TEMPLATES).filter(p => p.visibleInMenu).sort(byOrder)`. Состав каталога и порядок элементов байт-в-байт совпадают с текущим `PLAYABLE_MODE_CATALOG`: `campaign` (`order: 0`), `training` (`order: 1`); `sandbox` и `sandbox-with-combat` присутствуют как пресеты, но `visibleInMenu: false`.
- `npm run content:check` ловит drift: правка любого `content/sessions/*.md` без `npm run content:build` — сборка красная. `npm run build` зелёный. `npm test` зелёный.
- Demo (баланс): геймдизайнер открывает `content/sessions/campaign.md`, в encounter `## campaign-wave-3` меняет `spawnIntervalMs` с `1000` на `400`, запускает `npm run content:build` + `npm run dev`, видит заметно более частые спавны в третьей волне кампании; `training` остаётся прежним.
- Demo (состав волны): геймдизайнер в `## training-wave-1` второй таблицы заменяет один `slime-one-eye` на `slime-shell`, пересобирает, видит другой состав первой тренировочной волны.
- Demo (новый пресет): геймдизайнер копирует `content/sessions/training.md` в `content/sessions/training-hard.md`, меняет `displayName`, `order`, понижает `spawnIntervalMs` всех волн вдвое, оставляет `visibleInMenu: true`, пересобирает — в меню появляется третий пункт `Тренировка (хард)`, играбельный, без правок кода.
- Demo (опечатка): геймдизайнер пишет `arenaId | sndbox` (опечатка), `npm run content:build` падает с `content/sessions/campaign.md:7:3: section "# Session": unknown arenaId "sndbox"`, файл `sessions.generated.ts` остаётся прежним, игра продолжает работать.

## Tasks

T1 — архитектурный шаг (design-расширения + декомпозиция T2–T8 + перевод `Status` в `in-progress`); выполняется этим самым проходом архитектора в момент взятия истории в работу. T2 — подготовительный refactor (вынос template-литералов в рукописный `sessions.generated.ts` с временным header), позволяющий безопасно мерджить в `main` до готовности генератора. T3–T4 — расширения buildtime-инфраструктуры (area-парсер sessions + cross-area refs helper). T5 — авторинг `content/sessions/*.md` и регистрация в `AREAS`; на этом шаге сгенерированный `sessions.generated.ts` обязан быть **байт-в-байт** идентичен рукописному из T2 (точка сходимости). T6 — gameplay acceptance (deep-equal `SessionDefinition` со seed=0). T7 — чистка dead code. T8 — тесты на парсер-ошибки. T9 — demo + закрытие.

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Архитектор: оформить design-расширения — `design/content-authoring.md` (новые разделы «Multi-file области» и «Несколько таблиц в H2-секции» с явным перечислением областей и сигнатур; обновить «Запрещённые шаблоны» — запрет multi-file без явного попадания в перечень и запрет N таблиц в H2 без явного попадания в перечень); пометка `Updated` в `design/session-definition.md` (метаданные пресета — `displayName`/`description`/`visibleInMenu`/`order` — переезжают в `content library`); пометка `Updated` в `design/main-ui-shell.md` (playable preset catalog derived из `SESSION_PRESET_TEMPLATES`); добавить запись в `Index` `design/README.md` при необходимости; декомпозиция T2–T9, перевод `Status` истории в `in-progress`, обновление таблицы в `stories/README.md`. | архитектор |
| T2 | [x] | Refactor `src/shared/content/buildSession.ts` в подготовку: ввести тип `SessionPresetTemplate` в новом рукописном `src/shared/content/sessions.ts` (Readonly<{ presetId, displayName, description, visibleInMenu, order, arena, player, loadout, winCondition, lossCondition, encounters }>); вынести литералы encounter'ов и метаданные четырёх пресетов (`campaign`/`training`/`sandbox`/`sandbox-with-combat`) в новый рукописный `src/shared/content/sessions.generated.ts`, объявленный как `as const satisfies Record<string, SessionPresetTemplate>`; экспортировать `SESSION_PRESET_TEMPLATES` и derived `type ModePresetId = keyof typeof SESSION_PRESET_TEMPLATES`. Свернуть `buildSession.ts` до тонкой обёртки: читает template, разрешает символьную позицию `top-center` через уже существующую `bossTopCenterSpawnInArena`, добавляет `seed`/`id` из `BuildOptions`, валидирует через существующие `validateEnemyRegistry`/`warnIfWeaponMayTunnel`, возвращает `SessionDefinition`. Header нового файла на этом шаге — временный «seed for sessions-from-md (story 015), regenerated by `scripts/content-build` after T5». `playableModes.ts` обновляется: каталог режимов = `Object.values(SESSION_PRESET_TEMPLATES).filter(p => p.visibleInMenu).sort(byOrder)`. `presets.ts` пока **не удаляется** (используется в SwitchOverlay/тестах) — остаётся реэкспорт `ModePresetId`. `npm test` зелёный, поведение байт-в-байт. | опоры: `design/session-definition.md`, `design/main-ui-shell.md` |
| T3 | [x] | Bootstrap area-парсера sessions: `scripts/content-build/sessions/{index,parse,renderContent}.ts`. `index.ts` глобит `content/sessions/*.md` (sorted), parse каждого файла. `parse.ts` использует `parseMarkdownFile`, требует партиции `# Session` и `# Encounters`, валидирует общие поля (enum'ы `winCondition`/`lossCondition`/`spawnKind`/`zoneKind`/`transitionKind`), читает encounter'ы. Helper `requireEncounterTables(section, spawnKind)` поверх существующего парсера: возвращает `{ fields: MarkdownTable, spawns: MarkdownTable | null }`; кидает ошибку, если `spawnKind ∈ {wave, static}` и второй таблицы нет, либо `spawnKind ∈ {empty, boss}` и вторая таблица есть. `renderContent.ts` рендерит `sessions.generated.ts` через те же `util/render.ts` хелперы; ссылки на arenas/players/weapons/bosses/enemies — как прямые TS-импорты констант, не строки. Без `content/sessions/` область падает с явным «source directory not found» — тут пока ОК, генератор просто сообщает об отсутствии. Регистрация `SESSIONS_AREA` в `index.ts` (последней в `AREAS`). | опоры: `design/content-authoring.md` (T1) |
| T4 | [x] | Cross-area refs helper: `scripts/content-build/sessions/crossAreaRefs.ts` — импортирует уже сгенерированные `src/shared/content/{arenas,players,weapons,bosses,enemies,drops}.generated.ts` через обычный TS-import, экспонирует множества known id (`ARENA_IDS`, `PLAYER_IDS`, `WEAPON_IDS`, `BOSS_IDS`, `ENEMY_IDS`, `DROP_IDS`) и map'ы id→constName для `renderContent.ts`. Парсер sessions использует эти множества для валидации `arenaId`/`playerId`/`loadoutWeaponId`/`bossArchetypeId`/`archetypeId` со строкой и колонкой ошибки в MD. На этом шаге sessions area уже работает в режиме «MD есть → генерим, MD нет → сообщение». | опоры: T3, `design/content-authoring.md` |
| T5 | [x] | Авторинг `content/sessions/{campaign,training,sandbox,sandbox-with-combat}.md` со всеми текущими данными из `buildSession.ts:117-365` ровно 1:1 (числа волн, длительности зон, состав спавнов, edgeMargin, zone behaviors, transition rules — всё). `npm run content:build` → сгенерированный `sessions.generated.ts` **байт-в-байт** идентичен рукописному из T2 после нормализации (порядок ключей, отступы). При расхождениях — корректировать рендеринг T3, не данные MD. После сходимости временный header из T2 заменяется на финальный AUTO-GENERATED. `npm test` остаётся зелёным. | опоры: T2, T3, T4 |
| T6 | [ ] | Gameplay acceptance: `src/shared/content/buildSession.test.ts` — для каждого `presetId ∈ keyof SESSION_PRESET_TEMPLATES` со seed=0 (и с парой стабильных seed'ов: 1, 42) сравнить `buildSessionDefinition(resolveModePreset(presetId), { seed })` deep-equal с зафиксированным snapshot (через `expect(...).toMatchSnapshot()` или эквивалентный механизм vitest). Snapshot создаётся **до** перехода на MD-источник (запустить тест на коммите T2, сохранить snapshot), затем тот же тест на коммите T5 — должен проходить без обновления snapshot. Это формальный гарант 1:1-переноса. Все существующие гейм-плей тесты (`SessionFlowSystem.test.ts`, `boss.integration.test.ts`, `combat.integration.test.ts`, `drops.integration.test.ts`, `training.integration.test.ts`, `playableModes.test.ts`) — зелёные без правки числовых ожиданий. | опоры: `design/testing.md` |
| T7 | [ ] | Чистка: удалить `src/shared/content/presets.ts` (форма `ModePreset` свёрнута; `ModePresetId` импортируется из `sessions.ts`); удалить `src/shared/content/playableModes.ts` (заменён на одну функцию `getPlayableModeCatalog()` рядом с `SESSION_PRESET_TEMPLATES` или прямо в `sessions.ts`); удалить из `buildSession.ts` всё, что осталось от `makeCampaignRunEncounters`/`makeTrainingRunEncounters`/`buildCampaignSession`/`buildTrainingSession`/`buildSandboxSession`/`buildSandboxWithCombatSession` (их тела сворачиваются в одну generic-функцию). Обновить импортёров: `MenuOverlay`, `UiShell`, тесты. `npm test` зелёный, `npm run build` зелёный. | опоры: T6 |
| T8 | [ ] | Тесты на парсер sessions (vitest, рядом с модулями `scripts/content-build/sessions/**`): (а) happy path — парсинг закоммиченных `content/sessions/*.md` даёт выход, идентичный закоммиченному `sessions.generated.ts`; (б) отсутствующая обязательная ячейка в `# Session` → exit non-zero, целевые файлы не модифицированы; (в) опечатка в `spawnKind`/`zoneKind`/`transitionKind` → exit non-zero с указанием допустимых значений; (г) неизвестный `arenaId`/`playerId`/`loadoutWeaponId`/`bossArchetypeId`/`archetypeId` → exit non-zero со строкой и колонкой; (д) вторая таблица `seq | archetypeId` для encounter с `spawnKind = empty` или `boss` → exit non-zero; (е) отсутствие второй таблицы для `spawnKind = wave` или `static` → exit non-zero; (ж) дублирующийся presetId по двум файлам в `content/sessions/` → exit non-zero; (з) drift — синтетическая модификация ячейки в MD, `--check` падает с понятным diff'ом; (и) cross-area drift — синтетическая модификация id в `arenas.generated.ts` без обновления MD → ошибка генератора (валидация против реестра в момент `content:build`). | опоры: `design/content-authoring.md`, `design/testing.md` |
| T9 | [ ] | Demo проверка acceptance: (1) поменять `spawnIntervalMs` `1000 → 400` в `## campaign-wave-3` `content/sessions/campaign.md`, `npm run content:build` + `npm run dev`, наблюдать заметно более частые спавны в третьей волне `Побега`; (2) заменить один `slime-one-eye` на `slime-shell` в `## training-wave-1`, пересобрать, наблюдать другой состав первой волны `Тренировки`; (3) скопировать `training.md` в `training-hard.md`, поменять `displayName`, `order`, `spawnIntervalMs` всех волн вдвое, оставить `visibleInMenu: true`, пересобрать — в меню появляется третий пункт `Тренировка (хард)`, играбельный; (4) умышленно опечатать `arenaId | sndbox` — `npm run content:build` падает с понятным сообщением, ни один `.generated.ts` не модифицирован. После проверки — откатить демо-правки. Зафиксировать факт прогона в `Updated` истории. | опоры: T5 |
| T10 | [ ] | Закрытие истории: чек-лист закрытия из `stories/README.md`; проверка `Index` в `design/README.md`; перевод `Status` истории в `done` и обновление таблицы в `stories/README.md`. | архитектор |

## Related

- [../design/content-authoring.md](../design/content-authoring.md)
- [../design/session-definition.md](../design/session-definition.md)
- [../design/main-ui-shell.md](../design/main-ui-shell.md)
- [../design/spawn-plan.md](../design/spawn-plan.md)
- [../design/zone.md](../design/zone.md)
- [../design/boss-encounter.md](../design/boss-encounter.md)
- [../design/content-archetypes.md](../design/content-archetypes.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/testing.md](../design/testing.md)
- [011-content-from-md.md](011-content-from-md.md)
- [012-content-archetypes-from-md.md](012-content-archetypes-from-md.md)
- [013-sprite-assets-and-loader.md](013-sprite-assets-and-loader.md)
- [014-md-inline-media.md](014-md-inline-media.md)
