# Encounter Presentation

- Status: accepted
- Created: 2026-04-26
- Updated: 2026-04-26

## Context

[session-definition.md](session-definition.md) фиксирует форму `EncounterDefinition` (поля `id`/`type`/`backgroundId`/`spawnPlan`/`zoneBehavior`/`objectives`/`rewardRules`/`transitionRules`/`tuning`). Этот контракт достаточен, чтобы симуляция исполнила encounter, но ничего не говорит о том, как `main thread` объявляет encounter игроку: появление большого титра «Волна N + название» перед волной, текст-переход в break-е между сетами, задержка spawn/zone на время титра. Пока этого не было, кампания состояла из потока encounter-ов без визуального членения.

История 021 одновременно вводит:

- двухстрочный overlay для wave с глобальным номером волны в сессии и художественным названием;
- однострочный break-overlay с переходным текстом;
- задержку `SpawnSystem` и `ZoneSystem` на intro, чтобы гарантировать обещание «титр закончился — волна началась»;
- глобальную нумерацию волн, при которой `campaign-set-2-wave-1` на overlay выглядит как «Волна 4» и совпадает с итоговым окном.

Без явного контракта:

- поля `name`/`introDurationMs`/`text` заведут «по месту» либо в `EncounterDefinition`, либо в `tuning`, и authoring-форма в `content-authoring.md` разойдётся с runtime;
- «wave не должна завершиться во время intro» растечётся между `SpawnSystem` (не спавнит), `ZoneSystem` (не двигает margin) и `SessionFlowSystem` (проверяет `transitionRules`) разными способами;
- правило нумерации волн в overlay окажется завязано на `backgroundId` (presentation-поле) или на имя encounter-id (текст), и любая будущая кампания, в которой сет разделяет background с другим, сломает счёт молча;
- main-ui-shell зафиксирует overlay как «ещё один HUD» и смешает его с HUD wave progress, хотя overlay остаётся отдельным presentation-слоем.

Этот файл закрывает все четыре пункта одним решением.

## Decision

### Поля EncounterDefinition

`EncounterDefinition` получает три presentation-поля. Все три **обязательны** (плоская форма, без `?`), значение `null`/`0` — явный способ выразить «для этого типа encounter поле не задано». Это то же правило «без двух разных нет данных», что уже действует в [session-definition.md](session-definition.md).

```ts
type EncounterDefinition = Readonly<{
  // ...existing fields из session-definition.md
  introDurationMs: number;   // целое >= 0
  name: string | null;       // null или непустая строка
  text: string | null;       // null или непустая строка
}>;
```

Парные ограничения по `type` (нарушение — hard-error на стороне content-build и builder-а сессии):

| type | introDurationMs | name | text |
|---|---|---|---|
| `wave` | `>= 0`; `0` — intro не показывается | `null` или непустая строка | `null` |
| `break` | ровно `0` | `null` | `null` или непустая строка |
| `boss` | ровно `0` | `null` | `null` |
| `survivalTimer` | ровно `0` | `null` | `null` |
| `sandbox` | ровно `0` | `null` | `null` |

- `name` и `text` — непустая строка, если не `null`: пустая строка запрещена (иначе overlay нарисует пустую вторую строку). Валидируется content-build и builder-ом.
- «intro не показывается при `introDurationMs: 0`» — контракт overlay, не sim: при нуле UI-условие показа overlay ложно мгновенно, и `SpawnSystem`/`ZoneSystem` не ждут (см. «Intro delay» ниже).
- Поля присутствуют в любом `EncounterDefinition`, включая sandbox/bring-up. Builder `SessionDefinition` не имеет права пропустить их по умолчанию.

### Intro delay для sim

Во время intro симуляция обязана удерживать обещание «до окончания intro ничего нового не происходит». Единый инвариант:

- Intro **активен** в encounter, когда `encounter.elapsedMs < encounter.introDurationMs`. Для `introDurationMs: 0` intro неактивен на первом же тике.
- `encounter.elapsedMs` продолжает тикать по обычным правилам [simulation-timing.md](simulation-timing.md). Поле в snapshot не расширяется — достаточно уже существующих `encounter.elapsedMs` + `encounter.introDurationMs` из `SessionDefinition`.
- `SpawnSystem` во время intro не материализует сущности и не продвигает внутренний state плана ([spawn-plan.md](spawn-plan.md), раздел «Intro delay»). После окончания intro план стартует с нулевой точки wave/static-таймеров.
- `ZoneSystem` во время intro не продвигает внутренний `elapsedMs` и оставляет `margin` равным `startMargin` ([zone.md](zone.md), раздел «Intro delay»). После окончания intro линейная интерполяция начинается с той же нулевой точки.
- `SessionFlowSystem` не завершает encounter, пока intro активен — **для любого** `transitionRules.kind`. Это закрывает race, при котором `'allEnemiesCleared'` срабатывает мгновенно на `spawnPlan.kind === 'empty'` или на wave, у которой первый spawn ещё не произошёл. Формально: проверка правила завершения происходит только при `encounter.elapsedMs >= encounter.introDurationMs`. Для `'timer'` сам таймер отсчитывается от `encounterStart`; тем не менее завершение до конца intro всё равно подавлено. Практика: авторы контента не должны задавать `introDurationMs` больше, чем `transitionRules.durationMs` для `'timer'` encounter-ов; это hard-error на content-build.

Другие runtime-системы (`MovementSystem`, `CombatSystem`, `InputCommand` handling) во время intro работают штатно: игрок может двигаться, целиться и стрелять — это ожидаемое поведение.

### Global Wave Numbering

Номер волны в overlay считается **глобально по всем `type === 'wave'` encounters** в рамках текущей `SessionDefinition`:

- Для активного wave encounter с индексом `i` в `session.encounters`:
  - `waveTotal` = количество всех encounter-ов с `type === 'wave'` в сессии;
  - `waveIndex` = количество wave encounter-ов на отрезке `session.encounters[0..i]` (1-based).
- Для отображения overlay используется `waveIndex`; `waveTotal` вычисляется тем же правилом и доступен, если overlay захочет показывать «Волна waveIndex / waveTotal» (в стартовой реализации не используется — см. «Render contract» ниже).

Алгоритм стабилен, детерминирован по содержимому `session.encounters` и не зависит ни от `backgroundId`, ни от текстовой формы `encounter.id`. Для текущих кампаний после первого босса номер продолжает расти: `campaign-set-2-wave-1` отображается как «Волна 4», а не как «Волна 1».

HUD-нумерация волн (`main-ui-shell.md`, «HUD data derivation») и итоговое окно используют тот же глобальный смысл номера. Overlay не вводит отдельную локальную формулу, чтобы игрок видел один и тот же порядок волн во всех UI-слоях.

### Render contract (main UI)

Wave/break title overlay — отдельный UI-слой в `src/main/ui/**`, независимый от `Hud`. Он подчиняется общим правилам `UiShell` ([main-ui-shell.md](main-ui-shell.md)).

- **Видимость по фазам**: виден в `running` и `paused` (в `paused` — заморожен на текущем состоянии); скрыт в `menu`, `loading`, `result`, `error('preload')`. Поведение в `paused` аналогично HUD: overlay остаётся, его условия не пересчитываются новыми снапшотами.
- **Условие показа wave overlay**: активный encounter `type === 'wave'`, `introDurationMs > 0` и `encounter.elapsedMs < introDurationMs`. Во всех остальных случаях wave overlay скрыт.
- **Содержимое wave overlay**:
  - первая строка: `Волна {waveIndex}` (см. «Global Wave Numbering»);
  - вторая строка: `encounter.name`, если `name !== null`; иначе вторая строка не рисуется.
- **Условие показа break overlay**: активный encounter `type === 'break'` и `text !== null`. Виден весь период encounter, без отдельного intro-окна.
- **Содержимое break overlay**: одна строка — `encounter.text`.
- **Z-order** (дополняет таблицу в `main-ui-shell.md`): Startup error > Startup overlay > Result UI > Pause overlay > Menu overlay > Settings overlay > **Title overlay** > HUD > canvas. Title overlay ниже любого modal-overlay и выше HUD, чтобы modal-диалоги не конкурировали с титром.
- Стили (шрифт, обводка, тень, fade) — деталь реализации и принадлежат продуктовому слою (`## Player-facing` / `## Visual style` истории), этим решением не фиксируются.
- Overlay не подписывается на runtime events и не трогает `SimWorkerHost`: источники данных — `SessionDefinition` (immutable на время сессии) и `snapshot.encounter` (`id`/`type`/`elapsedMs`), пробрасываемые `UiShell` тем же путём, что и `Hud.update` ([main-ui-shell.md](main-ui-shell.md)).

### Runtime events

Intro и overlay не вводят новых `runtime events`. `encounterStart`/`encounterEnd` уже публикуются `SessionFlowSystem` ([runtime-systems.md](runtime-systems.md), [snapshot-shape.md](snapshot-shape.md)) и достаточны: overlay опирается только на снапшот, audio/HUD не нуждаются в отдельном сигнале «intro закончилось».

### Authoring

Форма MD-источника для `name`/`introDurationMs`/`text` фиксируется в [content-authoring.md](content-authoring.md), раздел «Несколько таблиц в одной H2-секции» и partition `# Session` — см. отдельное обновление этого файла под 021. Правило парных ограничений по `type` из раздела «Поля EncounterDefinition» обязан проверять content-build парсер области `sessions` на стадии render (hard-error с привязкой `file:line`).

## Consequences

- `EncounterDefinition` получает три устойчивых presentation-поля, авторская поверхность расширяется предсказуемо в `content/sessions/*.md`.
- Intro delay выражается одним инвариантом `encounter.elapsedMs < encounter.introDurationMs`, который применяется локально в `SpawnSystem`, `ZoneSystem` и `SessionFlowSystem`; снапшот и runtime events не расширяются.
- Глобальная нумерация overlay не зависит от `backgroundId` и от текста id-а encounter, поэтому не ломается при будущих кампаниях, где сеты называются без `set-N-` префикса.
- HUD, overlay и Result UI говорят об одном глобальном порядке волн, поэтому итоговый прогресс не спорит с титром последней увиденной волны.
- Пустой wave (`spawnPlan: { kind: 'empty' }`) с `introDurationMs > 0` теперь ведёт себя корректно: SessionFlowSystem держит encounter до конца intro, потом `allEnemiesCleared` срабатывает мгновенно. Content-build не обязан запрещать такую комбинацию, потому что runtime её переживает.
- Будущие расширения overlay (fade-in/out параметры, per-set сцены) — дополнения этого файла или новые файлы `design/`, а не правки содержимого `EncounterDefinition`.

## Related

- [session-definition.md](session-definition.md)
- [spawn-plan.md](spawn-plan.md)
- [zone.md](zone.md)
- [main-ui-shell.md](main-ui-shell.md)
- [audio.md](audio.md)
- [content-authoring.md](content-authoring.md)
- [snapshot-shape.md](snapshot-shape.md)
- [runtime-systems.md](runtime-systems.md)
- [simulation-timing.md](simulation-timing.md)
- [../stories/021-wave-titles-and-session-music.md](../stories/021-wave-titles-and-session-music.md)
