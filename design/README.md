# Design Decisions

`design/` - слой инженерных решений проекта. Это обязательная точка входа для чтения технического дизайна: сначала читается этот `README`, затем конкретные решения по теме.

## Роль слоя design

Иерархия проекта:

- `docs/` фиксирует геймдизайн, продуктовые правила и ограничения мира.
- `stories/` режет работу на demoable вертикальные слайсы.
- `design/` фиксирует устойчивые инженерные правила и контракты, по которым эти истории должны реализовываться.

Главный принцип:

- `stories` отвечают на вопрос "что делаем следующим шагом";
- `design` отвечает на вопрос "по каким техническим правилам это должно быть устроено".

## Как читать папку

- Сначала читать этот `README`.
- Затем открыть решение по теме: например, `session-definition.md` для модели сессии или `thread-model.md` для потоков и рендера.
- Если история уходит глубже, чем уже описанный design, это считается пробелом в design, а не разрешением зафиксировать архитектуру внутри story.

## Правила решений

- Один файл = одно инженерное решение.
- Имя файла должно быть стабильным и семантическим: `session-definition.md`, `thread-model.md`.
- Дату не включать в имя файла.
- Каждый decision-файл должен иметь единый минимальный каркас:
  - `Status`
  - `Created`
  - `Updated`
  - `Context`
  - `Decision`
  - `Consequences`
  - `Related`
- При изменении действующего решения обновлять существующий файл и поле `Updated`.
- Если решение потеряло силу, менять `Status` на `superseded` и ссылаться на новое решение в `Related`.

## Как design эволюционирует через stories

- История может обнаружить недостающий инженерный контракт.
- История не должна молча становиться источником архитектурной истины.
- Если по ходу работы уточняется устойчивое техническое правило, сначала обновляется соответствующий файл в `design/`, а уже потом история опирается на него.
- Один design-документ может эволюционировать через несколько историй, сохраняя тему и стабильное имя файла.
- Design-документы не должны быть копией историй, acceptance criteria или task breakdown.

## Что сюда не попадает

- Пошаговый план выполнения истории.
- Acceptance criteria из `stories/*.md`.
- Литературный пересказ пользовательского сценария.
- Временные локальные решения, которые не стали устойчивым правилом уровня архитектуры.

## Index

| Decision | Status | Description |
|----------|--------|-------------|
| [session-definition.md](session-definition.md) | accepted | Структура `SessionDefinition`, `EncounterDefinition` и `ModePreset` |
| [thread-model.md](thread-model.md) | accepted | Граница между `main thread`, `simulation worker` и рендером |
| [runtime-systems.md](runtime-systems.md) | accepted | Минимальный набор систем `core runtime` и lifecycle симуляции |
| [content-boundaries.md](content-boundaries.md) | accepted | Разделение `content library`, конфигурации сессии и runtime state |
| [arena-and-coordinates.md](arena-and-coordinates.md) | accepted | Координатная система мира, форма арены и правило fit-to-viewport |
| [input-commands.md](input-commands.md) | accepted | Структура `InputCommand`, WASD/Pointer Lock/прицел/ЛКМ, Esc-пауза |
| [web-stack.md](web-stack.md) | accepted | Сборщик, язык, менеджер пакетов и раскладка `src/main`, `src/sim`, `src/shared` |
| [simulation-timing.md](simulation-timing.md) | accepted | Частоты `SimulationClock` и снапшотов, правила интерполяции и pause/resume |
| [logging.md](logging.md) | accepted | Единый log-модуль `src/shared/log.ts`, уровни и запрет прямых `console.*` |
| [testing.md](testing.md) | accepted | Test runner (`vitest`), команды, обязательные инварианты под тестом |
| [spawn-plan.md](spawn-plan.md) | accepted | Форма `SpawnPlan` (`empty`/`static` + расширения), ответственность `SpawnSystem` |
| [content-archetypes.md](content-archetypes.md) | accepted | Минимальные `EnemyArchetype`, `WeaponArchetype`, `Loadout` и резолв архетипов по `id` |
| [projectiles-and-combat.md](projectiles-and-combat.md) | accepted | `CombatSystem` ownership for universal weapon/projectile lifecycle, hit tests, damage rules, explosions and damage intents |
| [health-and-death.md](health-and-death.md) | accepted | HP на сущностях, damage intents, death hooks, удаление сущностей |
| [snapshot-shape.md](snapshot-shape.md) | accepted | Per-kind поля сущностей в снапшоте, top-level `encounter`/`zone`/`waveProgress`, форма combat и lifecycle runtime events |
| [zone.md](zone.md) | accepted | `ZoneSystem`: scalar `margin`, режимы `disabled`/`shrinkLinear`/`expandLinear`, экспорт в snapshot, разделение gameplay-формы и визуализации |
| [enemy-contact.md](enemy-contact.md) | accepted | Контактный урон от врагов: новая фаза `CombatSystem`, `DamageIntent.source: 'enemyContact'`, per-enemy кулдаун |
| [boss-encounter.md](boss-encounter.md) | accepted | Сущность `kind: 'boss'`, `SpawnPlan` `'boss'`, `BossArchetype`, `BossPhaseSystem`, `winCondition: bossDefeated`, снапшот/HUD босса |
| [drops.md](drops.md) | accepted | `DropArchetype`, `Drop` как сущность, `DropSystem` (spawn-on-death-hook + ttl/pickup), `dropTable` на `EnemyArchetype`, heal-эффект |
| [rng.md](rng.md) | accepted | Session RNG (`mulberry32` от `seed`) как единственный источник случайности в `sim` |
| [main-ui-shell.md](main-ui-shell.md) | accepted | `UiShell` (фазы `menu`/`running`/`paused`/`result`), HUD как пассивный потребитель снапшотов, playable preset catalog |
| [audio.md](audio.md) | accepted | Аудио-стек в `src/main/audio/**`: единый `AudioContext`, mixer (`master` + `sfx`/`music`/`ui` buses), двухслойная громкость sample-реестра, маппинги архетип/событие → sampleId, music selector, ambient слаймов и `setMasterGain` для 009 |
| [client-settings.md](client-settings.md) | accepted | `ClientSettingsStore` в `src/main/settings/**`: поля 009 (`masterVolume`, `renderScalePreset`), `localStorage` с `schemaVersion`, валидация/clamp, subscriber-модель, владение `UiShell` |
| [render-scale.md](render-scale.md) | accepted | Render scale policy в `src/main/render/**`: три пресета `low`/`medium`/`high`, чистая `resolveRenderScale`, `Renderer.applyScalePolicy`, инварианты «без преимущества от железа» |
| [decision-log-format.md](decision-log-format.md) | accepted | Вспомогательная выжимка формата решений; правила слоя задаются этим `README` |
| [content-authoring.md](content-authoring.md) | accepted | Авторская поверхность контента в Markdown: `content/<area>.md` как источник правды, генератор `scripts/content-build/`, пары `<area>.ts ↔ <area>.generated.ts` в потребляющих слоях, атомарная запись и CI-чек дрейфа |
| [sprite-assets.md](sprite-assets.md) | accepted | Sprite-визуал для `player`/`enemy`/`boss`: `SpriteVisualSpec`, три раздельных visual registry рядом с renderer, `PX_PER_WU = 240`, asset-only renderer без circle-fallback, render-only breathing для `enemy`/`boss`, hard-error policy, preload до меню |
| [body-contact-boxes.md](body-contact-boxes.md) | accepted | `contactBox` как derive shape для body-contact `player`/`enemy`/`boss`: box-vs-box overlap, broadphase через derived bounds radius, clamp игрока по box |
| [impact-feedback.md](impact-feedback.md) | accepted | Juicy projectile feedback: self-contained `hit`/`death` event payloads, projectile knockback from weapon force, renderer-owned slime droplets/stains, hit squash/flash and death ghost |
| [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md) | accepted | Universal weapon instances, ordered loadouts, fire patterns, projectile motion, explosions, fragments, session friendly-fire rules and weapon modifier drops |
| [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md) | accepted | Follow-up combat layer: field effects, status effects, mines, carrier drops, drop magnet, friendly-fire retaliation and aim assist |
| [spawn-overrides.md](spawn-overrides.md) | accepted | Per-`seq` `SpawnOverride` (`guaranteedDrops`/`dropTable`/`retaliation`/`loadout`) для `'static'`/`'wave'` плана; вынос `carrierDrop` из `EnemyArchetype`, момент применения, валидация и правило миграции |
| [non-player-firing.md](non-player-firing.md) | accepted | Firing path для `kind: 'enemy'`: `WeaponInstance` слайма живёт в `CombatSystem.shooterWeapons`, наивный aim в текущую позицию игрока, под-цикл фазы 1 `CombatSystem` в порядке EntityId, инициализация cooldown, cleanup на смерти, единый damage-rule helper для impact и explosion |
| [landing-telegraph.md](landing-telegraph.md) | accepted | Render-only маркер точки приземления для in-flight arc-снарядов от не-игрока: snapshot-расширение `ProjectileSnapshot.arcEnd`, render-контракт (когда показывать, размер, исключение для player-owned arc), презентация vs геймплей |
| [_template.md](_template.md) | template | Минимальный шаблон нового решения |
