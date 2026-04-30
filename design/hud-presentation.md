# HUD Presentation

- Status: accepted
- Created: 2026-04-26
- Updated: 2026-04-30 (story 031 prep: desktop control hints are hidden in mobile `running`; mobile sticks and bullet affordances belong to mobile web support.)

## Context

[main-ui-shell.md](main-ui-shell.md) already fixes that HUD is a `main thread` component owned by `UiShell`: it is attached to an immutable `SessionDefinition`, updated from `SnapshotPair`, hidden/shown by phase, and never sends commands to `sim`. That contract was enough for the original 007 HUD: HP, active encounter, global wave progress, selected weapon summary and boss state.

Story 022 replaces that old block HUD with a combat-first HUD:

- all renderer debug panels disappear except the existing FPS overlay;
- top-left shows run time and compact combat status;
- bottom-left and bottom-right show lightweight control hints (`WASD`, `LMB: Fire`);
- bottom-center shows weapon slots, selected slot, cooldown fill and upgrade badges;
- temporary overdrive needs a progress fill, and permanent weapon modifiers need stable badge visuals.

The old `WeaponHudSnapshot` only carries `cooldownReadyAtSimMs` and `overdriveUntilSimMs`. That is not enough to render a correct cooldown fill or timed-upgrade progress without guessing from content. This file defines the missing presentation contract while keeping authoritative gameplay state in `sim`.

## Decision

### Ownership

- HUD remains a component under `src/main/ui/**` and keeps the `attach(session)` / `update(snapshotPair)` / `detach()` / `dispose()` lifecycle from [main-ui-shell.md](main-ui-shell.md).
- HUD remains passive: no direct `SimWorkerHost` access, no `postMessage`, no runtime event subscription for authoritative state, and no input commands.
- `UiShell` remains the only owner of HUD phase visibility. In `paused`, HUD is frozen because `UiShell` stops calling `update`, exactly as in [main-ui-shell.md](main-ui-shell.md).
- The FPS overlay is not part of HUD. It remains the separate `FpsOverlay` created by the app entrypoint and is the only player-visible/debug-style performance panel that survives story 022.
- The renderer-level debug HUD that prints `encounter`/`wave`/`hp`/`zone`/`drops` is removed or replaced with a no-op behind test injection. It is not moved into the new HUD.

### Layout

The combat HUD has five fixed viewport regions:

| Region | Content | Source |
|---|---|---|
| Top-left | run timer `MM:SS`, compact player HP | `snapshot.simTimeMs`, `PlayerSnapshot.hp/maxHp` |
| Top-center | boss HP strip when `bossHud !== null` | `snapshot.bossHud` + boss content for label if needed |
| Bottom-left | translucent `WASD` keycap cluster | static presentation, from [input-commands.md](input-commands.md) |
| Bottom-center | weapon slot bar with cooldown and upgrade badges | `snapshot.weaponHud` + visual registries |
| Bottom-right | mouse icon + `LMB: Fire` | static presentation, from [input-commands.md](input-commands.md) |

- HUD regions use `position: fixed` viewport placement, not canvas-relative placement. Letterbox/pillarbox areas may sit behind HUD; this follows [main-ui-shell.md](main-ui-shell.md).
- HUD uses `pointer-events: none`. It must never catch mouse input or affect Pointer Lock recovery.
- Controls are visual hints only. They do not imply new input behavior and do not mention Pointer Lock, capture or mouse grabbing.
- On mobile `running`, the desktop bottom-left `WASD` and bottom-right `LMB: Fire` hints are hidden. The mobile movement stick, aim stick, bullet silhouettes, and pause/menu button are defined in [mobile-web-support.md](mobile-web-support.md), not in the desktop HUD contract.
- The old bottom block layout (`HP` / `Weapon` / `Encounter` / `Wave` / `Boss`) is removed. Encounter id/type, zone margin, wave dispatched/alive and other debug-like run internals are not reintroduced in the new bottom HUD.
- Run timer uses `snapshot.simTimeMs`, not `snapshot.encounter.elapsedMs`, so it does not reset between encounters. The formatting helper stays pure: clamp at `0`, floor to whole seconds, render `MM:SS` with two-digit seconds.
- Timer digits use a monospace font or tabular numerals so width is stable.
- Boss status is a narrow top-center strip, not a bottom card. If `bossHud === null`, no boss HUD element is displayed.
- HP remains visible in compact top-left status. It is not part of the bottom weapon bar.

### Weapon Slots

- Weapon slots are derived from `snapshot.weaponHud.weapons` sorted by `index`.
- Each slot is a stable square with fixed dimensions. Hover/focus states are irrelevant because HUD does not receive pointer events.
- The number shown on a slot is `index + 1`. `Digit0` holster is a valid input command but is not represented as a weapon slot.
- `selectedIndex === null` means all weapon slots render unselected/holstered. The weapon bar remains visible if loadout weapons exist.
- A selected slot is highlighted by presentation only: border, glow, scale or equivalent, without changing layout dimensions.
- Projectile art comes from `PROJECTILE_VISUALS[weaponArchetypeId].image`. HUD reads image paths from the same `SpriteVisualSpec` registry as renderer; it does not create Three.js textures.
- Missing projectile visuals for loadout weapons are an implementation/test failure. HUD must not silently render text-only fallback for a known weapon.

### Cooldown Fill

`WeaponHudSnapshot` exposes cooldown as an interval, not only a ready timestamp:

```ts
type WeaponHudSnapshot = Readonly<{
  selectedIndex: number | null;
  weapons: ReadonlyArray<Readonly<{
    index: number;
    weaponArchetypeId: string;
    cooldownStartedAtSimMs: number;
    cooldownReadyAtSimMs: number;
    modifiers: ReadonlyArray<WeaponModifier>;
    timedEffects: ReadonlyArray<WeaponTimedEffectHudSnapshot>;
  }>>;
}>;
```

- `cooldownStartedAtSimMs` is the sim time when the current or most recent cooldown interval started.
- `cooldownReadyAtSimMs` is the sim time when that interval is ready. It keeps the existing meaning of `nextFireSimMs`.
- For a weapon that is ready immediately and has not fired in the current run, both fields are equal to its initialization sim time.
- HUD computes cooldown fill from these fields and `snapshot.simTimeMs`:
  - if `snapshot.simTimeMs >= cooldownReadyAtSimMs`, fill is `0`;
  - otherwise denominator is `max(1, cooldownReadyAtSimMs - cooldownStartedAtSimMs)`;
  - remaining ratio is `(cooldownReadyAtSimMs - snapshot.simTimeMs) / denominator`, clamped to `[0, 1]`.
- HUD must not recompute cooldown duration from `WeaponArchetype.cooldownMs`, because active overdrive can change the actual interval.

### Upgrade Badges

Permanent weapon modifiers are exposed as raw `WeaponModifier` values in `weaponHud.weapons[].modifiers`. They are copied from the owner-local `WeaponInstance`; already-spawned projectiles remain unaffected by HUD.

Initial badge visual mapping is explicit and presentation-only:

| Modifier/effect | Badge visual |
|---|---|
| `projectileSizeMultiplier` | `size-up` drop visual |
| `projectileSpeedMultiplier` | `speed-up` drop visual |
| `symmetricProjectileMultiplier` | `multi-shot` drop visual |
| `pierceBonus` | `pierce` drop visual |
| `fragmentExplosion` | `fragment` drop visual |
| `temporaryOverdrive` | `overdrive` drop visual |

- Badge images come from `DROP_VISUALS[dropArchetypeId].image`.
- The mapping lives in `src/main/ui/**` or a small adjacent helper. It must not inspect live `Drop` entities.
- Missing badge visuals for known modifier kinds are an implementation/test failure.
- The HUD may group identical modifier kinds into a stack or render slightly offset repeated badges. It must preserve the semantic count; current gameplay caps identical permanent modifier stacks at two, but the UI should not hard-code that as a layout limit.
- Temporary effects are not mixed into `modifiers`; they live in `timedEffects`.

### Timed Weapon Effects

On this horizon the only timed weapon effect shown by HUD is temporary overdrive:

```ts
type WeaponTimedEffectHudSnapshot =
  | Readonly<{
      kind: 'temporaryOverdrive';
      cooldownMultiplier: number;
      startedAtSimMs: number;
      expiresAtSimMs: number;
    }>;
```

- `timedEffects` contains only effects active at snapshot time (`expiresAtSimMs > snapshot.simTimeMs`). Expired effects are absent.
- Repeated overdrive pickups overwrite the current temporary overdrive on the selected weapon, preserving the existing gameplay rule from [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md).
- HUD computes the timed badge progress from `startedAtSimMs`, `expiresAtSimMs` and `snapshot.simTimeMs`, clamped to `[0, 1]`.
- `temporaryOverdrive` also affects future cooldown intervals while active, but the cooldown fill itself remains driven by `cooldownStartedAtSimMs`/`cooldownReadyAtSimMs`.

### Runtime State

The runtime `WeaponInstance` owned by `CombatSystem` must carry enough state to export the HUD snapshot without guessing:

```ts
type WeaponInstance = {
  archetypeId: string;
  cooldownStartedAtSimMs: number;
  nextFireSimMs: number;
  modifiers: WeaponModifier[];
  overdriveStartedAtSimMs: number | null;
  overdriveUntilSimMs: number | null;
  overdriveCooldownMultiplier: number | null;
};
```

- Firing sets `cooldownStartedAtSimMs = simTimeMs` and `nextFireSimMs = simTimeMs + effectiveCooldownMs(...)`.
- Creating a player weapon instance sets `cooldownStartedAtSimMs` and `nextFireSimMs` to the initialization sim time when it is immediately ready.
- Temporary overdrive pickup sets `overdriveStartedAtSimMs = simTimeMs`, `overdriveUntilSimMs = simTimeMs + durationMs`, and `overdriveCooldownMultiplier = cooldownMultiplier`.
- `weaponHudFor` should receive or otherwise know current `simTimeMs` so it can omit expired timed effects.

### Tests

Story 022 implementation must include tests at the contract boundaries:

- `CombatSystem.weaponHudFor` exposes cooldown interval, modifiers and active timed effects without leaking expired overdrive.
- `SnapshotExportSystem` copies the extended `WeaponHudSnapshot` immutably.
- HUD view-model/presentation helpers compute run timer, cooldown ratio, timed-effect ratio, selected slot state and badge grouping from snapshots.
- Renderer debug HUD is absent in default renderer creation while existing renderer tests can still inject no-op/debug test hooks if needed.
- A browser/dev-server visual check covers desktop and mobile-ish widths with multiple weapons, active cooldown, stacked modifiers and overdrive progress.

## Consequences

- `WeaponHudSnapshot` grows from a selected-weapon summary into a full weapon-bar presentation contract. This is intentional: weapon slot UI should not reconstruct owner-local weapon state from runtime events.
- `CombatSystem` keeps ownership of cooldowns, modifiers and overdrive state; HUD only reads exported copies.
- The old encounter/wave debug-like HUD fields are no longer player-facing, but the underlying snapshot fields stay available for systems and tests.
- The HUD becomes more asset-dependent: projectile and drop visual registries must stay complete for any weapon/modifier that can appear in player loadout.
- Keeping FPS outside HUD preserves the existing performance signal without coupling it to session phase or gameplay state.

## Related

- [main-ui-shell.md](main-ui-shell.md)
- [snapshot-shape.md](snapshot-shape.md)
- [input-commands.md](input-commands.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)
- [sprite-assets.md](sprite-assets.md)
- [web-stack.md](web-stack.md)
- [testing.md](testing.md)
- [../stories/022-combat-hud-redesign.md](../stories/022-combat-hud-redesign.md)
- [mobile-web-support.md](mobile-web-support.md)
