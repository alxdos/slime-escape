# Landing Telegraph

- Status: accepted
- Created: 2026-04-25
- Updated: 2026-04-26 (correction: runtime `Projectile` **already** carries `arcEnd: Vec2 | null` in 017 ([src/sim/EntityStore.ts](../src/sim/EntityStore.ts)); no runtime edits are needed for this file. Only `SnapshotExportSystem` copies the field into `ProjectileSnapshot`, forcing `null` for `state !== 'flying'`. The previous wording "CombatSystem copies arcEnd into runtime Projectile at creation" described what was already implemented in 017 when spawning an arc projectile; for 020 this is not new work.)

## Context

[universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md) defines three projectile motion types: `linear`, `arc`, and `placed`. Arc projectiles fly deterministically from `originX/originY` to a fixed landing point over `flightMs`. Three render-only affordances for arc/placed are already defined:

- `pulseWhenGrounded` — pulse for an already grounded projectile;
- `explosionRadiusIndicator` — faint radius for grounded explosive;
- player-side **pre-shot** aim preview (approximate landing point, computed on main thread from weapon archetype + current aim + current modifiers).

This was enough while the only source of arc projectiles was the player: pre-shot preview gives the player information **before** firing, and flight time itself (`flightMs ∈ 550..700` for `rock-thrower`/`grenade-launcher`) is short.

Story 020 allows a non-player (slime) to throw arc projectiles through [non-player-firing.md](non-player-firing.md). Player pre-shot preview does not help here: the player did not fire, so there is nothing for them to predict. Without an in-flight affordance, the player sees only the flying projectile (rendered from `projectileVisuals[weaponArchetypeId]` per [sprite-assets.md](sprite-assets.md)) and does not understand **where** it will land. At `SIM_HZ = 60` and `flightMs ≈ 600`, that is about 36 ticks; the trajectory is hard to read by eye, especially when 2-3 arc projectiles from different slimes fly at once.

This decision introduces a new render-only affordance: **landing telegraph**. While a non-player arc projectile is in flight, a visible marker is drawn on the ground at its landing position.

## Decision

### Scope

- This file defines **only** in-flight landing telegraph for arc projectiles from non-player shooters.
- Player-owned arc projectiles **do not** get landing telegraph: pre-shot preview from [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md) already gives the player the needed information, and duplication would make the screen noisier with no benefit.
- Linear projectiles **do not** get landing telegraph: they are readable from their trajectory and move at `≈ 12..28 wu/s`, which at a typical 5-10 wu distance gives a reaction window around 200-800 ms. That is enough. Extending telegraph to linear projectiles (leading markers for fast bullets) is out of scope and a separate decision if ever needed.
- Placed projectiles (`bomb-placer`) **do not** get landing telegraph: they do not fly and appear immediately under the owner. Their readability is already covered by `pulseWhenGrounded` + `explosionRadiusIndicator` from [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md).
- Grounded state of an arc projectile (`state: 'grounded'`) **does not use** telegraph: after landing, the projectile already uses `pulseWhenGrounded` and `explosionRadiusIndicator` if the archetype enables them. Telegraph and grounded pulse are two different UX affordances with non-overlapping time windows.

### Snapshot extension

- Add one new field to `ProjectileSnapshot` ([snapshot-shape.md](snapshot-shape.md)):
  ```ts
  arcEnd: { x: number; y: number } | null;
  ```
- Semantics:
  - for an arc projectile in `state: 'flying'`, fixed world landing position computed by `CombatSystem` at projectile creation from `position + aim * range`. It does not change between snapshots while the projectile lives;
  - for an arc projectile in `state: 'grounded'`, `null`. After landing, landing telegraph is not shown, and the field has no presentation meaning;
  - for linear/placed motion, **always** `null` regardless of `state`. Renderer does not use heuristics to "guess landing point from originX/originY".
- The field is required (not optional on `Readonly<{...}>`); `null` is the only way to say "landing telegraph does not apply". This removes "two ways to say no data" (`undefined` vs `null`).
- The extension is allowed by the general [snapshot-shape.md](snapshot-shape.md) rule "new fields in an existing `kind` may only be added". No fields are removed, and other `ProjectileSnapshot` consumers are not broken.
- Computation source is `CombatSystem` at projectile creation, using the same formula that defines the arc trajectory (see [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md), "Projectile motion and state", `arc` rules). In implementation 017 this is already set in `store.spawnProjectile({ motionKind: 'arc', arcEnd, … })`: runtime `Projectile` already has `arcEnd` and it is correct for arc projectiles, `null` for linear/placed. Story 020 needs no runtime edits for this part.
- On every snapshot, `SnapshotExportSystem` copies the value from runtime `Projectile`, **forcing `null` when `state !== 'flying'`**. This is the only place where the semantic "after grounding, arcEnd no longer has presentation meaning" is materialized in snapshot data. Concretely, one line in projectile export in `SnapshotExportSystem.ts`:
  ```ts
  arcEnd: projectile.state === 'flying' ? projectile.arcEnd : null,
  ```
  This keeps renderer filtering clean and avoids any "arcEnd vs state heuristic" on the renderer side. Runtime `Projectile.arcEnd` still lives until projectile removal; in runtime explosion / fragments / cleanup phases, the field remains available if future systems need it (today none read it).

### Render contract

- Renderer decides whether landing telegraph is needed through a pure condition on `ProjectileSnapshot`:
  ```ts
  shouldShowLandingTelegraph =
    state === 'flying'
    && arcEnd !== null
    && ownerKind !== 'player';
  ```
- Renderer does not look up `WEAPON_ARCHETYPES` / `projectileVisuals` to decide **whether** to show it. Lookup is needed only for marker **shape** (see below).
- Marker is drawn on the ground at `arcEnd`. It is not a projectile trail and not a trajectory line; it is a static mark at the landing point.
- Marker size and shape:
  - if the corresponding `WeaponArchetype.projectile.explosion !== null`, marker diameter is approximately `2 * explosion.radius`. This gives the player an honest preview of the danger area, symmetric with the existing `explosionRadiusIndicator` after landing;
  - if `explosion === null` (for example, `rock-thrower`), fixed diameter is `0.4` wu. The marker remains visible, but does not promise a radius that does not exist.
- Color/style/animation are render-only constants in `src/main/render/landingTelegraph.ts` (actual file name is an implementation detail). Baseline polish proposal:
  - warm red (`#ff4444`) with pulse animation from render time;
  - thin outline + translucent fill so the marker does not cover sprites beneath it and remains readable on any arena background;
  - concrete numbers may change as visual polish without editing this file.
- Z-order: **below** player/enemy/boss/projectile sprites, **above** background tiles and `explosionRadiusIndicator` for grounded projectiles if they overlap. Concrete `renderOrder` is an implementation detail.
- Renderer marker lifecycle:
  1. On each frame, renderer walks `snapshot.entities`, filters `kind: 'projectile'`, and applies the condition above.
  2. If a marker for this projectile `id` does not yet exist, create it (new mesh / new sprite in render scene).
  3. If it already exists, update its position (`arcEnd` is fixed, but window resize recalculates coordinates like any other world object).
  4. If the condition for this projectile `id` stops being true (snapshot no longer contains projectile, or `arcEnd === null`, or `state === 'grounded'`), remove the marker or start a render-only fade-out; see below.
- Renderer **may** add a short fade-out (≤ 100 ms) when removing the marker as visual polish. This is not part of the contract; the contract is "marker must be gone by the time the projectile has landed or disappeared." Simple immediate cleanup is a valid minimum.

### Presentation vs gameplay

- Landing telegraph is **render-only**. It does not change hit radii, does not deal damage, does not appear as an entity in `EntityStore`, and does not enter snapshots as a separate `kind`. Its state lives only inside the renderer, and gameplay never checks its presence or absence.
- Snapshot does not carry "does this projectile need telegraph"; renderer derives that from `state + arcEnd + ownerKind`. No flags such as `showTelegraph: boolean` are introduced in snapshot.
- Marker mesh removal in renderer happens synchronously when the projectile disappears from the snapshot. At `SNAPSHOT_HZ = 30`, this gives a worst-case delay up to `33 ms` between actual landing and marker disappearance. For UX this is below the perception threshold and is not a separate contract.

### Intentionally out of scope

- Exact color, opacity, and pulse animation numbers are renderer polish and can change without editing this file as long as "does telegraph show" does not change.
- Landing telegraph for player-owned arc is out of scope (see "Scope"). If pre-shot preview and in-flight marker are ever unified, that is a new decision, not an extension here.
- Telegraph for linear projectiles ("tracer bullet", "leading marker for fast bullet") is out of scope.
- Trajectory line / arc silhouette between origin and arcEnd is out of scope. For hard-campaign 020 UX, marking the **landing point** is enough; a trajectory line would add visual noise.
- Per-archetype telegraph disabling ("this weapon archetype does not telegraph") is out of scope. All non-player arc projectiles telegraph by one rule.

## Consequences

- `ProjectileSnapshot` gets one new field, `arcEnd: {x,y} | null`. Traffic cost is two numbers per projectile, negligible for the typical simultaneous projectile count in the campaign (dozens).
- The only real 020 edit in this part is adding one line in `SnapshotExportSystem.ts` when constructing the `ProjectileSnapshot` literal. Runtime `Projectile.arcEnd` is already set correctly in 017 at arc projectile spawn time. `CombatSystem`, `EntityStore`, and spawn path are not touched here.
- Renderer gets one new object-pool category (landing telegraph meshes), managed by projectile snapshot lifecycle. This mirrors existing pools (droplets from [impact-feedback.md](impact-feedback.md), grounded pulse).
- UX invariant: the player never receives explosion damage from a non-player arc projectile without a visible telegraph marker for the whole flight. This is specifically checked by story 020 tests ("slime throws arc projectile -> marker visible for full flight -> disappears on impact").
- Player pre-shot preview from [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md) and in-flight landing telegraph remain **two different affordances with non-overlapping time windows** (before shot vs after shot) and non-overlapping owners (player vs non-player). They are two clean UX layers with no conflict.
- If we later decide to show in-flight telegraph for player-owned arc as well, that is an extension of this file, without editing [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md) and without changing `ProjectileSnapshot.arcEnd` shape (the field already exists for all arc projectiles; the `ownerKind !== 'player'` filter is simply removed).

## Related

- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [snapshot-shape.md](snapshot-shape.md)
- [non-player-firing.md](non-player-firing.md)
- [sprite-assets.md](sprite-assets.md)
- [impact-feedback.md](impact-feedback.md)
- [main-ui-shell.md](main-ui-shell.md)
- [../stories/020-shooting-slimes.md](../stories/020-shooting-slimes.md)
