# Dark Zone

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-26 (story 021: intro delay — `ZoneSystem` does not advance internal `elapsedMs` and does not move `margin` while the active encounter intro is active (`encounter.elapsedMs < encounter.introDurationMs`); full contract in [encounter-presentation.md](encounter-presentation.md). `zoneBehavior` shape and snapshot export do not change. Earlier: 2026-04-23.)

## Context

[runtime-systems.md](runtime-systems.md) defines `ZoneSystem` ("dark zone and other visibility-limiting modes"), its place in update order (before `SnapshotExportSystem`), and the general rule that "`ZoneSystem` manages zone state and export, but does not end encounters by itself." The zone model itself is not described.

[../docs/GDD_CORE.md](../docs/GDD_CORE.md) and [../docs/WAVES_AND_SCALING.md](../docs/WAVES_AND_SCALING.md) define product rules:

- the zone **shrinks linearly** during a wave and **retracts** during a break;
- the zone **does not deal damage**; its role is to limit visibility;
- during a boss fight, the zone **is inactive**;
- spawning "from arena edges" uses arena edges, not the current zone boundary.

Without an explicit contract, story 004 (waves and zone) will implicitly define the zone shape, its snapshot representation, and renderer dependency on gameplay shape. Story 006 (boss with zone disabled) and 007 (HUD) will reopen the same questions.

## Decision

### Gameplay zone shape

- The gameplay zone shape is **one scalar `margin`** (in world units, see [arena-and-coordinates.md](arena-and-coordinates.md)). `margin` is an inset from all sides: the arena safe area is a rectangle centered at `(0, 0)` with half-size `(arena.width / 2 − margin, arena.height / 2 − margin)`.
- `margin = 0` means "the zone is fully retracted and the safe area equals the arena." This is the neutral state; it is used both for encounters with `zoneBehavior: { kind: 'disabled' }` and for the boss fight in 006.
- `margin` is clamped below by zero and above by the value where the safe area degenerates to a point. Concrete `fromMargin`/`toMargin` values are set in `EncounterDefinition.zoneBehavior` and validated by content/builder, not runtime.
- **Per-side margins, circles, and asymmetric shapes do not exist in the gameplay contract.** If needed, they are added by a separate decision; for now this is intentionally one scalar.

### No damage and no gameplay effect

- The zone **does not deal damage** under any condition. `ZoneSystem` does not produce `DamageIntent`, has no death hook, and does not kill entities.
- The zone **does not restrict movement** for player, enemies, or projectiles: `MovementSystem` and `CombatSystem` use arena bounds ([arena-and-coordinates.md](arena-and-coordinates.md), [projectiles-and-combat.md](projectiles-and-combat.md)), not `margin`.
- The zone **does not end encounters**: this is already fixed in [runtime-systems.md](runtime-systems.md). `SessionFlowSystem` looks only at `transitionRules`, not at `margin`.
- This is intentional: the zone is a visibility limiter, not a separate environment with its own enemies, per [../docs/GDD_CORE.md](../docs/GDD_CORE.md). Any future "zone damages the player" feature is a **different** system (for example, `EnvironmentHazardSystem` for gas clouds), not an extension of `ZoneSystem`.

### Encounter-level zone configuration

- `EncounterDefinition.zoneBehavior` is a discriminated union; concrete kinds are defined in [session-definition.md](session-definition.md). The zone has three kinds:
  - `{ kind: 'disabled' }` — the zone is fully retracted and does not move; `margin = 0` for the whole encounter;
  - `{ kind: 'shrinkLinear'; fromMargin; toMargin; durationMs }` — linear shrink toward `toMargin` over `durationMs`; `fromMargin` is the nominal authoring start;
  - `{ kind: 'expandLinear'; fromMargin; toMargin; durationMs }` — linear expansion toward `toMargin` over `durationMs`; `fromMargin` is the nominal authoring start.
- For `shrinkLinear`/`expandLinear`, both `fromMargin` and `toMargin` are in `[0, maxMargin]`; direction (shrink vs expand) is defined by `kind`, not by the sign of the difference. This avoids hidden "expand through shrink with a negative value".
- `fromMargin` describes the authoring-expected interpolation start and is used by the content/builder layer to validate setting continuity. Runtime does not have to jump to `fromMargin`: actual interpolation always starts from current `ZoneSystem.margin`, so encounter transitions remain smooth if the previous zone has not reached its `toMargin`.
- `durationMs > 0`. If `durationMs` is shorter than encounter duration, after reaching `toMargin`, `margin` stays at `toMargin` until `encounterEnd` (clamp, not cyclic interpolation).
- Concrete numeric values (`fromMargin`, `toMargin`, `durationMs` for `wave`/`break`) are set in the `content library` ([content-boundaries.md](content-boundaries.md)) while building `SessionDefinition`. They are content, not part of the design decision.

### `ZoneSystem` lifecycle

- On `encounterStart`, `ZoneSystem` initializes from `encounter.zoneBehavior` and current runtime state:
  - `disabled` -> `mode = 'disabled'`, `margin = 0`, internal `elapsedMs = 0`;
  - `shrinkLinear` -> `mode = 'shrink'`, `startMargin = current margin`, `margin = startMargin`, `elapsedMs = 0`, with `startMargin`/`toMargin`/`durationMs` remembered;
  - `expandLinear` -> `mode = 'expand'`, `startMargin = current margin`, `margin = startMargin`, `elapsedMs = 0`, similarly.
- On each tick (per [simulation-timing.md](simulation-timing.md), `SIM_STEP_MS`):
  - for `disabled`, no-op;
  - otherwise `t = clamp(elapsedMs / durationMs, 0, 1)`, `margin = lerp(startMargin, toMargin, t)`, then `elapsedMs += SIM_STEP_MS`. The first snapshot of the new encounter therefore remains at actual `startMargin`; after `t == 1`, there are no further changes (clamp remains).
- On `encounterEnd`, active interpolation stops (`mode = 'disabled'`), but current `margin` remains as the actual start for the next encounter. Full reset to `margin = 0` happens at session lifecycle boundaries (`sessionStart`/`sessionStop`) or when starting an encounter with `zoneBehavior: { kind: 'disabled' }`.
- `ZoneSystem` is part of update order per [runtime-systems.md](runtime-systems.md): it ticks every sim tick, after `HealthDeathSystem`/`DropSystem` and before `SnapshotExportSystem`. No other system depends on the current `margin`, so the exact "after `HealthDeathSystem`" placement is an order detail, not a gameplay dependency.

### Intro delay

- While the active encounter has `encounter.elapsedMs < encounter.introDurationMs` ([encounter-presentation.md](encounter-presentation.md)):
  - for `disabled`, still no-op;
  - for `shrinkLinear`/`expandLinear`, `ZoneSystem` does not advance internal `elapsedMs` and keeps `margin` equal to `startMargin`. The first tick after intro ends works like the first tick of a normal encounter: `t = 0`, `margin = startMargin`, `elapsedMs = 0`, then normal advancement.
- This guarantees that the wave title sits over the "zero" zone state: the player sees the zone as the previous encounter left it, and shrink/expand starts exactly when intro ends.
- Determinism is preserved: `ZoneSystem` remains a pure function of `zoneBehavior` plus accumulated `elapsedMs`; intro only shifts the `elapsedMs` base in simulation time.

### Snapshot export

- `ZoneSystem` exports its state to snapshot through one top-level field (field shape is defined in [snapshot-shape.md](snapshot-shape.md)):
  ```ts
  zone: {
    mode: 'disabled' | 'shrink' | 'expand';
    margin: number; // wu, >= 0
  };
  ```
- `mode` lets HUD/render distinguish "zone is static (disabled or reached toMargin)" from "zone is actively changing". `margin` is the only visualization number.
- No derived values (estimated time to "full collapse", `fromMargin`/`toMargin`, `durationMs`) enter the snapshot. If HUD hints need them, they are added through a separate [snapshot-shape.md](snapshot-shape.md) extension, not locally.

### Visualization (outside gameplay contract)

- Zone display geometry (rounded corners, soft edge gradient, color, blur) is a **render detail** on the `main thread` side ([thread-model.md](thread-model.md)) and not part of this decision. Numbers such as "corner radius = 0.25 × `arena.height`" or "gradient width" live in `Renderer`, not in `design/` or the `content library`.
- This is intentional: visual shape does not affect gameplay (the zone does not deal damage, movement and shooting use the arena), and tying its parameters to `margin` through the snapshot is enough.
- The "no hardware advantage" invariant from [arena-and-coordinates.md](arena-and-coordinates.md) is preserved automatically: gameplay sees the same `margin` regardless of render backend, resolution, or image quality.

## Consequences

- Story 004 gets a compact contract: one scalar `margin`, linear interpolation from the actual current margin to `toMargin` over `durationMs`, with no extra rules and no side effects.
- Story 006 (boss) is implemented through `zoneBehavior: { kind: 'disabled' }` without a special "zone disabled for boss" flag; `ZoneSystem` does not differ between modes.
- HUD from 007 and render from 010 can rely on stable `zone` shape in snapshots and do not need to negotiate with `sim` about "how exactly to draw darkness".
- Fast wave completion does not create visual zone jumps: the next active encounter continues interpolation from the actually visible `margin`, not from the nominal authored `fromMargin`.
- Any future "zone that damages the player" immediately identifies itself as a **different** system; this file and its "zone does not deal damage" invariant stay clear.
- Extension to per-side margin or circle touches snapshot shape and `ZoneBehavior`, but not the contract that "zone does not make gameplay decisions".

## Related

- [runtime-systems.md](runtime-systems.md)
- [session-definition.md](session-definition.md)
- [snapshot-shape.md](snapshot-shape.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [simulation-timing.md](simulation-timing.md)
- [thread-model.md](thread-model.md)
- [content-boundaries.md](content-boundaries.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [../docs/WAVES_AND_SCALING.md](../docs/WAVES_AND_SCALING.md)
- [../docs/BOSS.md](../docs/BOSS.md)
- [encounter-presentation.md](encounter-presentation.md)
