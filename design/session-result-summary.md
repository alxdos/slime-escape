# Session Result Summary

- Status: accepted
- Created: 2026-04-26
- Updated: 2026-04-27 (story 026 prep: `portal` encounters are non-objective presentation encounters and do not contribute to result progress; the `/portal` flow normally redirects before any win result.)

## Context

[main-ui-shell.md](main-ui-shell.md) already fixes the `result(win|loss)` phase and says that `UiShell` enters it only after a `win`/`loss` runtime event. Before story 024 those events carry only `simTime`, so `ResultOverlay` can show only a title and a button.

Story 024 turns the result screen into a player-facing end-of-run report: progress percent, duration, kills by slime type, boss state and optional defeat cause. Main thread must not reconstruct authoritative run stats from a lossy edge-event stream: [thread-model.md](thread-model.md) and [snapshot-shape.md](snapshot-shape.md) already state that events are reactions, not a replacement for authoritative state. The summary therefore has to be produced inside the simulation worker before run teardown.

## Decision

### Shared result payload

- Introduce a shared type, for example `src/shared/sessionResult.ts`, owned by the shared protocol layer. `src/shared/events.ts` imports it and attaches it to terminal events.
- `win` and `loss` runtime events carry a `summary`:
  ```ts
  type RuntimeEvent =
    | { kind: 'win'; simTime: number; summary: SessionResultSummary }
    | { kind: 'loss'; simTime: number; summary: SessionResultSummary };
  ```
- `summary.outcome` must match event `kind`. A mismatch is a runtime bug and must be covered by tests.
- `summary.durationMs` equals the event `simTime` of the terminal event. The simulation clock resets on teardown, so the event is the only stable place where main can receive this value.

### SessionResultSummary shape

The current summary shape is:

```ts
type SessionResultSummary = Readonly<{
  outcome: 'win' | 'loss';
  durationMs: number;
  progress: ResultProgressSummary;
  kills: ResultKillSummary;
  drops: ResultDropSummary;
  boss: ResultBossSummary | null;
  defeat: ResultDefeatSummary | null;
}>;

type ResultProgressSummary = Readonly<{
  percent: number | null;          // integer 0..100; null when a mode has no meaningful run progress
  completedObjectiveEncounters: number;
  totalObjectiveEncounters: number;
  completedWaves: number;
  totalWaves: number;
  activeEncounterId: string | null;
  activeEncounterIndex: number | null;
}>;

type ResultKillSummary = Readonly<{
  total: number;
  byArchetype: ReadonlyArray<Readonly<{
    entityKind: 'enemy' | 'boss';
    archetypeId: string;
    count: number;
  }>>;
}>;

type ResultDropSummary = Readonly<{
  pickedUpTotal: number;
}>;

type ResultBossSummary = Readonly<{
  archetypeId: string;
  encountered: boolean;
  defeated: boolean;
  hp: number;
  maxHp: number;
  hpPercent: number;               // integer 0..100
}>;

type ResultDefeatSummary = Readonly<{
  cause: ResultDefeatCause;
}>;

type ResultDefeatCause =
  | Readonly<{ kind: 'projectile'; ownerKind: 'player' | 'enemy' | 'boss'; weaponArchetypeId: string }>
  | Readonly<{ kind: 'explosion'; ownerKind: 'player' | 'enemy' | 'boss'; weaponArchetypeId: string }>
  | Readonly<{ kind: 'enemyContact'; sourceEntityId: number; sourceEntityKind: 'enemy' | 'boss' | null; archetypeId: string | null }>
  | Readonly<{ kind: 'boss'; bossId: number; bossArchetypeId: string | null; attackId: string }>
  | Readonly<{ kind: 'fieldEffect'; fieldEffectId: number; archetypeId: string }>
  | Readonly<{ kind: 'statusEffect'; statusKind: string; sourceEntityId: number | null }>
  | Readonly<{ kind: 'environment'; tag: string }>;
```

- `kills.total` counts defeated `enemy` and `boss` entities. Player death is not a kill.
- `kills.byArchetype` includes only entries with `count > 0`. It is sorted by `count desc`, then `entityKind`, then `archetypeId` for deterministic UI/tests.
- `drops.pickedUpTotal` counts successful `dropPickup` events. Breakdown by drop archetype is intentionally not part of story 024.
- `defeat` is non-null only for `outcome: 'loss'` when the loss was caused by player death and a cause can be serialized from `DeathContext.cause`.

### Progress calculation

- Result progress is derived from player-facing objective encounters, not from every encounter. Objective encounters are `type === 'wave'` and `type === 'boss'`. `break`, `sandbox`, `portal`, and future non-objective presentation encounters do not add denominator weight.
- If a session has no objective encounters or has `winCondition.kind === 'none'` and `lossCondition.kind === 'none'`, `progress.percent` is `null`. Result UI then shows a mode-appropriate fallback instead of a fake percent.
- `win` always reports `progress.percent = 100`.
- `loss` reports `0..99`; even if the active objective is almost complete, a loss cannot show `100`.
- Completed objectives for a loss are objective encounters with index lower than the active encounter index. The active objective may contribute a fractional part:
  - active `wave`: `partial = clamp((waveProgress.dispatched - waveProgress.alive) / waveProgress.total, 0, 1)`. If `total === 0`, partial is `1`.
  - active `boss`: `partial = clamp(1 - boss.hp / boss.maxHp, 0, 1)` when an active or remembered boss is available; otherwise `0`.
  - active non-objective encounter: partial `0`.
- `percent = round(((completedObjectiveEncounters + activePartial) / totalObjectiveEncounters) * 100)`, then clamped according to outcome.
- `completedWaves` and `totalWaves` use only `type === 'wave'`; on loss, `completedWaves` is the number of wave encounters with index lower than the active encounter index. On win, it equals `totalWaves`.

### RunSummaryTracker

- Add a simulation-side `RunSummaryTracker` under `src/sim/**` or equivalent. It is a hook-driven tracker, not a gameplay system that mutates entities.
- It resets on `sessionStart`, `sessionStop`, and automatic terminal teardown.
- It observes:
  - death hooks for `enemy`, `boss` and `player`;
  - drop pickup facts from `DropSystem`;
  - current session/encounter context from `SessionFlowSystem`;
  - current wave progress from `SpawnSystem`;
  - current or remembered boss state from `EntityStore`/boss death context.
- Death tracking must happen before any death hook that can publish terminal `win`/`loss`. In the current architecture this means the worker-level death hook calls `RunSummaryTracker.onDeath(ctx, store)` before `SessionFlowSystem.onBossDeath(...)` or `SessionFlowSystem.onPlayerDeath(...)`.
- `RunSummaryTracker` does not publish runtime events by itself. `SessionFlowSystem` asks it to build a `SessionResultSummary` immediately before emitting `win` or `loss`, and attaches that summary to the terminal event.
- `RunSummaryTracker` must not depend on main-thread UI registries. It records IDs and counts only. Main-side presentation resolves `displayName` and sprite/icon URLs from content/visual registries.

### Defeat cause

- Defeat cause is best-effort presentation metadata derived from the player's terminal `DeathContext.cause`.
- It may include projectile/explosion weapon ids, boss attack ids, field/status/environment tags, or resolved enemy/boss contact source when available.
- If resolving an enemy-contact source archetype is not possible because the source entity is absent or not readable, `defeat` remains valid with a generic `enemyContact` cause. UI must have a generic copy fallback.
- Defeat cause never changes gameplay and never influences win/loss decisions.

### Main thread presentation

- `UiShell` keeps the existing phase machine. On `win`/`loss`, it stores the `SessionResultSummary` from the event and passes it to Result UI.
- Result UI still lives under `src/main/ui/**` and still has only one required action: back to menu. Story 024 enriches what it displays; it does not introduce retry/share/leaderboards.
- A main-side pure mapper may convert `SessionDefinition + SessionResultSummary + content registries + visual registries` into a `ResultViewModel`. `ResultOverlay` should render that view model and should not import from `src/sim/**`.
- Enemy/boss labels come from `EnemyArchetype.displayName` / `BossArchetype.displayName`. Icons use existing sprite visual registries (`enemyVisuals`, `bossVisuals`) and the preloaded/public image paths from [sprite-assets.md](sprite-assets.md). Missing visual/content mappings are hard errors under the existing sprite/content contracts, not silent fallback rows.
- Result rows with zero counts are omitted.

### Result effects

- Victory/defeat celebration effects are main-thread presentation only. They do not add snapshot fields or simulation events.
- Effects may be DOM/CSS elements inside Result UI. They must respect `prefers-reduced-motion: reduce`.
- To keep browser checks and tests stable, particle positions/counts should be deterministic from outcome and fixed indices rather than `Math.random`.
- In `result` phase the gameplay `Renderer` is still destroyed by [main-ui-shell.md](main-ui-shell.md). Result effects therefore belong to the UI overlay, not to the arena renderer.

## Consequences

- The result screen gets authoritative stats without teaching main UI to replay combat/drop events.
- `win`/`loss` event shape changes; every existing test/helper that expects terminal events must be updated to account for `summary`.
- `SessionFlowSystem` gains a dependency on a summary builder, but still owns the win/loss decision. The summary tracker observes and reports; it does not decide outcome.
- Progress percent is intentionally approximate but consistent and player-facing. It is not a save-game metric or balance input.
- UI remains decoupled from simulation internals: it receives IDs/counts and resolves presentation data in main/shared layers.

## Related

- [thread-model.md](thread-model.md)
- [runtime-systems.md](runtime-systems.md)
- [snapshot-shape.md](snapshot-shape.md)
- [main-ui-shell.md](main-ui-shell.md)
- [session-definition.md](session-definition.md)
- [health-and-death.md](health-and-death.md)
- [drops.md](drops.md)
- [boss-encounter.md](boss-encounter.md)
- [content-archetypes.md](content-archetypes.md)
- [sprite-assets.md](sprite-assets.md)
- [testing.md](testing.md)
- [../stories/024-session-end-results.md](../stories/024-session-end-results.md)
- [vibe-jam-portals.md](vibe-jam-portals.md)
