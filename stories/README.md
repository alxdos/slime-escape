# Stories

Вертикальные playable slice'ы проекта. Один файл = одна история. Каждая история должна давать игроку demoable фичу. Шаблон и формат — [_template.md](_template.md).

- Имя файла: `NNN-shortname.md`. Номер с шагом `+1`, не переиспользуется.
- Нумерация задаёт смысловой порядок чтения. Порядок исполнения может отличаться: историю можно перепрыгнуть и вернуться позже — это отражается через `Status`.
- Статусы: `planned` | `in-progress` | `done` | `blocked` | `deferred`.
- Маркеры в таблицах задач и в индексе историй: `[ ]` planned, `[/]` in-progress, `[x]` done, `[-]` blocked, `[~]` deferred. В шапке файла истории (`- Status:`) статус остаётся словом.
- `blocked` означает, что история не может двигаться из-за внешнего или технического препятствия; `deferred` — что мы сознательно откладываем её до появления триггера или приоритета.

## Процесс работы

Разделение ответственности:

- **История** отвечает на «что мы строим» (фича для игрока) и «что трогаем» (системы, протоколы, файлы). Держится короткой.
- **`design/`** отвечает на «как именно устроено» в данной области. Файлы сгруппированы по областям и эволюционируют между историями.

Поток:

1. Перед стартом истории прочитать все её `Related` файлы из `design/`.
2. Если по ходу работы возникает или меняется дизайн-решение:
   - найти подходящий файл `design/<area>.md` и обновить его, либо завести новый файл по новой области;
   - поднять поле `Updated`, при необходимости — `Status`;
   - сослаться на него в `Related` истории и кратко упомянуть в `Technical`.
3. Подробное обоснование, альтернативы, тонкости — только в `design/`. История на них ссылается, не дублирует.
4. Перед закрытием истории убедиться, что все затронутые файлы `design/` перечислены в `Related`, а индекс [../design/README.md](../design/README.md) актуален.

Правило: если решение влияет на будущие истории — оно обязательно должно осесть в `design/`, а не остаться только внутри одной истории.

## Истории

| Story | Status | Description | Tech |
|-------|--------|-------------|------|
| [001-engine-skeleton.md](001-engine-skeleton.md) | [x] | Открытая страница с плавно двигающимся тестовым объектом и FPS-индикатором; пауза/продолжение | Web-сборка, `three.js` в main, `simulation worker`, `SimulationClock`, протокол main↔sim, `SnapshotExportSystem`, интерполяция |
| [002-playable-arena.md](002-playable-arena.md) | [x] | Запуск пустой арены из заглушки меню, управляемый персонаж, выход в меню | Заглушка `content library`, `ModePreset`→`SessionDefinition`, `SessionFlowSystem`, input commands, `MovementSystem` |
| [003-combat-foundation.md](003-combat-foundation.md) | [x] | Стрельба по тренировочной мишени, урон и смерть врага | `EnemyArchetype`/`WeaponArchetype` + `Loadout`, `SpawnPlan` static, `SpawnSystem`, `CombatSystem`, `HealthDeathSystem`, `SpatialIndex`, расширение снапшота и `fire`/`hit`/`death` events |
| [004-waves-and-zone.md](004-waves-and-zone.md) | [x] | Тренировочный режим из 1–2 волн с передышками, тёмная зона сжимается в волне и расширяется в передышке, win/loss | `SpawnPlan` `'wave'`, `ZoneSystem`, encounter transitions и `win`/`loss` в `SessionFlowSystem`, contact damage и `HasHealth` у игрока, session RNG |
| [005-drops.md](005-drops.md) | [x] | С убитых врагов выпадает дроп, игрок подбирает и видит эффект | `Drop` как сущность, `DropArchetype`/`DropEffect`, `EnemyArchetype.dropTable`, `DropSystem` (death hook + ttl/pickup), `dropSpawn`/`dropPickup`/`dropExpire` events |
| [006-boss-encounter.md](006-boss-encounter.md) | [x] | Финальный бой с боссом без зоны, фазы поведения, финальный win/loss | `BossPhaseSystem`, профиль босса, `EncounterDefinition` типа `boss`, отключение `ZoneSystem` |
| [007-hud-and-menu.md](007-hud-and-menu.md) | [x] | Полноценное меню выбора режима, HUD с HP/таймером/волной, пауза, экран результата | `UiShell` (фазы `menu`/`running`/`paused`/`result`), data-driven меню из `playableModes`, HUD как пассивный потребитель `SnapshotPair`, единый owner pause/resume |
| [008-audio-baseline.md](008-audio-baseline.md) | [x] | Звуки выстрелов, попаданий, смерти, ambient слаймов, музыка с переключением на boss-track, UI-щелчки | Web Audio в `src/main/audio/**`, единый `AudioContext` + unlock, mixer (`master`+`sfx`/`music`/`ui`), двухслойная громкость sample-реестра, маппинги архетип/событие → sampleId, music selector, snapshot-driven ambient, фан-аут через `UiShell` |
| [009-settings.md](009-settings.md) | [x] | Экран настроек: громкость и разрешение арены `low` / `medium` / `high`, применяется на лету и сохраняется между запусками | `ClientSettingsStore` со `schemaVersion` и subscriber-моделью, `Audio.setMasterGain`, render scale policy (`resolveRenderScale` + `Renderer.applyScalePolicy`), Settings overlay как sub-modal `UiShell` |
| [010-render-pipeline-offscreen.md](010-render-pipeline-offscreen.md) | [~] | На поддерживаемых браузерах рендер плавнее под нагрузкой, на остальных — корректный fallback без визуальных регрессий | `OffscreenCanvas` render worker, переключение backend, fallback на main-рендер из `001`, проброс render scale из `009`, измерение FPS/frame-time |
| [011-content-from-md.md](011-content-from-md.md) | [x] | Геймдизайнер правит баланс слаймов в одном MD-файле и одной командой пересобирает конфиг; для игрока поведение не меняется до первого редактирования | `content/enemies.md` как источник правды, генератор в `scripts/content-build/`, пары `<area>.ts ↔ <area>.generated.ts` в `src/shared/content/**` и `src/main/audio/**`, атомарная запись + `content:check` в `npm run build` |
| [012-content-archetypes-from-md.md](012-content-archetypes-from-md.md) | [x] | Геймдизайнер правит баланс оружия, дропа и боссов в собственных MD-файлах по тому же конвейеру, что и слаймы; параллельно дозаполняется звук слаймов так, чтобы `hit`/`death`/`voice` ссылались на разные пулы сэмплов | `content/{weapons,drops,bosses}.md` как источники правды, новые area-модули в `scripts/content-build/`, пары `.generated.ts` в `src/shared/content/**` и `src/main/audio/**`, правило «дозаполнение, а не урезание» в `content-authoring.md` |
| [013-sprite-assets-and-loader.md](013-sprite-assets-and-loader.md) | [x] | Игра стартует с белой заставкой и preload-лоадером, затем показывает героя, всех слаймов и босса PNG-спрайтами без fallback-кругов | `design/sprite-assets.md` (`SpriteVisualSpec`, `PX_PER_WU = 240`, asset-only renderer, hard-error policy), `design/body-contact-boxes.md` (sprite-derived `contactBox` для body-contact и projectile hit), новые фазы `loading`/`error('preload')` в `UiShell`, новая область `players` (`hero-sandbox`/`hero-training`), `## Visual` в `enemies`/`bosses` |
| [014-md-inline-media.md](014-md-inline-media.md) | [x] | Геймдизайнер видит спрайты прямо в MD под `## <id>`, слышит звуки оружия по клику в MD; звуки слаймов перегруппированы в одну партицию `# Sound sets` с короткими сравнительными таблицами | inline `![](…)`/`[…](…)` как derive-источники в `content/**.md`, новая партиция «shared resource set с членами» в `content/enemies.md`, изменения только в `scripts/content-build/**`; runtime-контракты не меняются |
| [015-sessions-from-md.md](015-sessions-from-md.md) | [x] | Геймдизайнер правит пресеты сессий (волны, передышки, зону, состав, выбор босса, метаданные меню) в одной папке `content/sessions/` с одним MD-файлом на пресет; параметры encounter'ов и каталог режимов больше не в коде | новая multi-file область `sessions` в `scripts/content-build/`, cross-area refs в генераторе через прямые TS-импорты + `tsc`, две таблицы в encounter-секции (общие поля + опциональный список спавнов), `presets.ts`/`playableModes.ts` исчезают, `buildSession.ts` свернут до тонкой обёртки; runtime-контракты не меняются |
| [016-slime-impact-feedback.md](016-slime-impact-feedback.md) | [x] | Попадания в слаймов дают направленный брызг слизи, физический отскок от пули, короткую реакцию тела и быстрый fading-ghost при смерти | `design/impact-feedback.md`, расширение `hit`/`death` events, `WeaponArchetype.knockbackImpulse`, projectile knockback в `CombatSystem`, `Renderer.handleEvent`, render-only droplets/stains/death ghost |
| [017-universal-weapons-and-projectiles.md](017-universal-weapons-and-projectiles.md) | [x] | Игрок переключает и убирает оружие, а сессии могут выдавать те же оружия игроку, слаймам и боссу; пули, камни, гранаты, бомбы и огненные шары получают upgrades, взрывы, осколки, knockback и читаемые подсказки | `design/universal-weapons-and-projectiles.md`, ordered `Loadout`, owner-local `WeaponInstance`, fire patterns, linear/arc/placed projectiles, explosions/fragments, weapon modifier drops, `rules.slimeFriendlyFire`, slot/holster input, projectile presentation hints |
| [018-combat-modifiers-and-field-effects.md](018-combat-modifiers-and-field-effects.md) | [x] | Бой получает мины, опасные зоны, статусы, carrier-слаймов, магнит дропа, friendly-fire retaliation и мягкий aim assist как отдельный слой после универсального оружия | `design/combat-modifiers-and-field-effects.md`, `fieldEffect` entities, `StatusEffectSystem`, mine proximity triggers, carrier drops, drop magnet, aggro memory, aim-assist rules, deterministic tests |
| [019-spawn-overrides.md](019-spawn-overrides.md) | [ ] | Геймдизайнер описывает особенности конкретного спавна в конкретной волне (гарантированный дроп, replace-таблица дропа, retaliation) прямо в строке encounter’а; семь форков-архетипов (`campaign-set-1..5-carrier-slime`, `demo-carrier-slime`, `demo-retaliator-slime`) удаляются, баланс кампании не меняется | `design/spawn-overrides.md` (новый), вынос `carrierDrop` из `EnemyArchetype`, расширение `scripts/content-build/sessions/**` и формы encounter spawn entry, перенос `assertCarrierDropsResolve` в sessions-валидатор, hard-error на неизвестные id/поля/seq, детерминированный regression-тест |
| [020-shooting-slimes.md](020-shooting-slimes.md) | [ ] | В меню три отдельные кампании со своим pillar-ом каждая: easy = «я хозяин арены» (FF=true, aim-assist, полный арсенал, 3 сета), normal = текущая кампания байт-в-байт, hard = «читай поле боя» с per-set прогрессией угроз — linear shooters → arc throwers → стационарные турели → минное поле → fireball-staff во все стороны | поле `SpawnOverride.loadout` ([design/spawn-overrides.md](../design/spawn-overrides.md)), firing path для не-игрока ([design/non-player-firing.md](../design/non-player-firing.md)), render-only landing-telegraph ([design/landing-telegraph.md](../design/landing-telegraph.md)) + `ProjectileSnapshot.arcEnd`, единый `canDamageTarget` helper для impact и explosion, новый общий стационарный архетип `slime-idol`, миграция `campaign.md` → `campaign-normal.md`, зависит от 019 |
| [_template.md](_template.md) | — | Шаблон новой истории | — |
