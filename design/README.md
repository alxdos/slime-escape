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
| [projectiles-and-combat.md](projectiles-and-combat.md) | accepted | Снаряды как сущности, кулдаун, движение/хит-тест, damage intents |
| [health-and-death.md](health-and-death.md) | accepted | HP на сущностях, damage intents, death hooks, удаление сущностей |
| [snapshot-shape.md](snapshot-shape.md) | accepted | Per-kind поля сущностей в снапшоте, top-level `encounter`/`zone`/`waveProgress`, форма combat и lifecycle runtime events |
| [zone.md](zone.md) | accepted | `ZoneSystem`: scalar `margin`, режимы `disabled`/`shrinkLinear`/`expandLinear`, экспорт в snapshot, разделение gameplay-формы и визуализации |
| [enemy-contact.md](enemy-contact.md) | accepted | Контактный урон от врагов: новая фаза `CombatSystem`, `DamageIntent.source: 'enemyContact'`, per-enemy кулдаун |
| [boss-encounter.md](boss-encounter.md) | accepted | Сущность `kind: 'boss'`, `SpawnPlan` `'boss'`, `BossArchetype`, `BossPhaseSystem`, `winCondition: bossDefeated`, снапшот/HUD босса |
| [drops.md](drops.md) | accepted | `DropArchetype`, `Drop` как сущность, `DropSystem` (spawn-on-death-hook + ttl/pickup), `dropTable` на `EnemyArchetype`, heal-эффект |
| [rng.md](rng.md) | accepted | Session RNG (`mulberry32` от `seed`) как единственный источник случайности в `sim` |
| [main-ui-shell.md](main-ui-shell.md) | accepted | `UiShell` (фазы `menu`/`running`/`paused`/`result`), HUD как пассивный потребитель снапшотов, playable preset catalog |
| [decision-log-format.md](decision-log-format.md) | accepted | Вспомогательная выжимка формата решений; правила слоя задаются этим `README` |
| [_template.md](_template.md) | template | Минимальный шаблон нового решения |
