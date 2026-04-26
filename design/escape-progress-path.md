# Escape Progress Path

- Status: accepted
- Created: 2026-04-26
- Updated: 2026-04-26

## Context

История 025 добавляет player-facing `Путь Побега`: компактную дорожку волн в бою, расширенную карту прогресса в break и карту достигнутого пути в Result UI.

У проекта уже есть все authoritative данные, нужные для такого UI:

- `SessionDefinition.encounters` даёт полный порядок encounter-ов и глобальную нумерацию `type === 'wave'`;
- `Snapshot.encounter` сообщает активный encounter и его индекс во время run;
- `SessionResultSummary.progress` сообщает `completedWaves`, `totalWaves`, `activeEncounterId` и `activeEncounterIndex` на terminal result.

Поэтому история не должна расширять simulation worker, `Snapshot`, runtime events или session content. Это presentation-слой main thread, который должен оставаться согласованным с глобальной нумерацией из [encounter-presentation.md](encounter-presentation.md) и итоговой статистикой из [session-result-summary.md](session-result-summary.md).

## Decision

### Ownership

- `Путь Побега` живёт в `src/main/ui/**`.
- Он не импортирует из `src/sim/**`, не обращается к `SimWorkerHost` напрямую, не отправляет input commands и не подписывается на runtime events.
- Authoritative источники:
  - live/break: immutable `SessionDefinition` + текущий `SnapshotPair.curr`;
  - result: immutable `SessionDefinition` + terminal `SessionResultSummary`.
- Новые поля в `Snapshot`, `RuntimeEvent`, `SessionDefinition`, `EncounterDefinition` или `SessionResultSummary` не вводятся.
- Расчёт прогресса — pure main-side derivation. Его нужно держать в отдельном helper/view-model модуле рядом с UI, чтобы compact, break и result использовали одну формулу.

### Wave Path Model

Путь строится только по wave encounter-ам:

- `totalWaves` = количество encounter-ов с `type === 'wave'` в `session.encounters`;
- глобальный номер wave encounter-а = количество wave encounter-ов от начала сессии до текущего encounter-а включительно;
- boss, break, survivalTimer и sandbox encounter-ы не получают собственных точек на пути.

Если `totalWaves === 0`, `Путь Побега` скрыт: для sandbox/режимов без волн нет meaningful path.

Рекомендуемая форма internal view model:

```ts
type EscapeProgressPathViewModel = Readonly<{
  totalWaves: number;
  completedWaves: number;
  activeWaveIndex: number | null; // 1-based, только когда active encounter is wave
  stop:
    | Readonly<{ kind: 'none' }>
    | Readonly<{ kind: 'loss'; anchor: 'activeWave' | 'afterCompletedWaves' | 'beforeFlag' }>;
  flagState: 'pending' | 'reached';
}>;
```

Имена типов — деталь реализации, но семантика обязательна:

- `completedWaves` — число уже закрытых wave encounter-ов;
- `activeWaveIndex` — текущая wave, если игрок прямо сейчас внутри wave encounter-а;
- `stop` используется только для result/loss presentation;
- `flagState: 'reached'` допустим только при победе.

### Live / Break Derivation

Для live состояния используется `SessionDefinition + Snapshot`:

- Если snapshot отсутствует или active encounter не резолвится по `snapshot.encounter.index`/`id`, путь рендерит `completedWaves = 0`, `activeWaveIndex = null` или скрывается до первого валидного snapshot-а. Реализация должна выбрать один стабильный вариант и покрыть тестом; она не должна угадывать encounter по wall-clock.
- Для active wave encounter-а:
  - `completedWaves` = количество wave encounter-ов с индексом меньше active encounter index;
  - `activeWaveIndex` = `completedWaves + 1`;
  - точка active wave выделена, но не считается completed.
- Для active non-wave encounter-а:
  - `completedWaves` = количество wave encounter-ов с индексом меньше active encounter index;
  - `activeWaveIndex = null`;
  - все точки до `completedWaves` подсвечены как пройденные.
- During boss encounter путь остаётся wave-only: boss не получает marker, а флаг остаётся `pending`.

Presentation modes:

- `compact`: default в `running` для wave/boss/non-wave encounter-ов, кроме break;
- `expandedBreak`: active encounter `type === 'break'`; expanded path replaces compact path for the duration of break;
- `hidden`: no session, no valid path, `totalWaves === 0`, or UI phase hides the live component.

### Result Derivation

Для result состояния используется `SessionDefinition + SessionResultSummary`:

- `totalWaves` берётся из `summary.progress.totalWaves`;
- `completedWaves` берётся из `summary.progress.completedWaves`;
- `progress.percent` не используется для заполнения точек, потому что percent учитывает boss/objective partial progress, а путь показывает только wave path.

Outcome rules:

- `win`: `completedWaves = totalWaves`, `activeWaveIndex = null`, `stop.kind = 'none'`, `flagState = 'reached'`;
- `loss` during active wave: stop marker anchors on that active wave point; completed points remain only before it;
- `loss` during non-wave with `completedWaves < totalWaves`: stop marker anchors after the last completed wave and before the next wave point;
- `loss` after all waves but before victory, for example on final boss: all wave points may be completed, but `flagState` stays `pending`; stop marker anchors `beforeFlag`.

This rule prevents a final-boss loss from looking like a completed escape while still respecting the product decision that bosses are not path nodes.

### UiShell Integration

Live `Путь Побега` is a separate UI component, not part of `Renderer` and not a simulation system.

Recommended lifecycle mirrors `Hud` / `TitleOverlay`:

```ts
type EscapeProgressPath = Readonly<{
  attach(session: SessionDefinition): void;
  update(snapshotPair: SnapshotPair, phase: UiShellPhase): void;
  detach(): void;
  dispose(): void;
}>;
```

`UiShell` owns it:

- creates it once with the other overlays;
- attaches it when a client session starts;
- updates it during `running`;
- freezes it during `paused` using the last visible view model, matching `TitleOverlay` behavior;
- detaches it in `tearDownClientSession`;
- does not show the live component in `result`.

### Layering

Standalone live/break path visibility by phase:

| Phase | Escape progress path |
|---|---|
| `loading` | hidden |
| `menu` | hidden |
| `running` | visible when `totalWaves > 0` |
| `paused` | visible frozen when it was visible before pause |
| `result(win|loss)` | hidden; Result UI renders its own static path |
| `error('preload')` | hidden |

Z-order, top to bottom:

Startup error > Phase transition curtain > Startup overlay > Result UI > Settings overlay > Pause overlay > Menu overlay > Title overlay > **Escape progress path** > HUD > canvas.

The expanded break path must not cover title overlay text. If the break title text and expanded path are both visible, title overlay wins in z-order.

### Result UI Integration

`ResultViewModel` gains an optional escape path view model derived from `SessionDefinition + SessionResultSummary`.

`ResultOverlay` renders that static path inside the result card/stage. It does not reuse live snapshots, does not keep the live `EscapeProgressPath` component mounted, and does not query `SimWorkerHost` after terminal teardown.

The existing result stat tile `Волна N / M` may remain. The path augments the stat; it is not a replacement for all result stats.

### Tests

Implementation must cover:

- pure view-model derivation for active wave, break after wave, boss after wave, win, loss during wave, loss during non-wave, loss after all waves before flag, and zero-wave sessions;
- live component lifecycle: attach/update/detach, compact vs expanded break mode, freeze in `paused`, hide outside active session;
- `UiShell` wiring: component attaches/detaches with session and is not visible in result;
- ResultViewModel/ResultOverlay integration for win and loss maps;
- responsive presentation sanity for small widths and reduced motion fallback for path-fill animation.

## Consequences

- No simulation contract changes are needed; this keeps story 025 presentation-only from the worker perspective.
- A new UI layer appears in `UiShell`, so `main-ui-shell.md` must know its phase visibility and z-order.
- Result UI gets one more derived presentation block, but still depends only on terminal summary and registries.
- Final-boss losses require a distinct `beforeFlag` loss marker so a completed wave row does not falsely imply victory.
- The same pure path derivation becomes the single source of truth for compact, break and result variants.

## Related

- [main-ui-shell.md](main-ui-shell.md)
- [hud-presentation.md](hud-presentation.md)
- [encounter-presentation.md](encounter-presentation.md)
- [session-result-summary.md](session-result-summary.md)
- [snapshot-shape.md](snapshot-shape.md)
- [thread-model.md](thread-model.md)
- [testing.md](testing.md)
- [../stories/025-escape-progress-path.md](../stories/025-escape-progress-path.md)
