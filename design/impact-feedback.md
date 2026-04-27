# Slime Impact Feedback

- Status: accepted
- Created: 2026-04-24
- Updated: 2026-04-24

## Context

The project already has authoritative projectile hit/death in the `simulation worker`
([projectiles-and-combat.md](projectiles-and-combat.md), [health-and-death.md](health-and-death.md)),
main-thread runtime events `hit`/`death` ([snapshot-shape.md](snapshot-shape.md)),
PNG slime sprites with render-only breathing ([sprite-assets.md](sprite-assets.md)), and contact
knockback through slime/boss archetype fields ([enemy-contact.md](enemy-contact.md)).

The new polish layer should make hits feel wet and physical:

- on hit, the slime throws slime droplets in the bullet direction;
- stronger weapons produce wider/heavier splashes and stronger knockback;
- on death, the slime leaves a quick fading ghost and a large slime burst;
- droplets stay on the floor as small stains, briefly spread, then disappear later;
- slime color comes from the target slime color.

This crosses two layers. Visual slime and ghosts are presentation-only and must not become gameplay
state. Projectile knockback changes enemy/boss position, so it belongs to simulation.

## Decision

### Ownership split

- Simulation owns only authoritative consequences:
  - projectile hit detection;
  - damage intents and death;
  - projectile knockback for living `enemy` / `boss` entities;
  - runtime event payloads describing impact.
- Renderer owns transient impact presentation:
  - slime droplets and floor stains;
  - hit flash / hit squash impulse;
  - death ghost sprite;
  - death slime burst.
- Visual slime is not a `Drop`, does not live in `EntityStore`, does not enter snapshots,
  has no collision, cannot be picked up by the player, and cannot affect the session result.
- The story does not introduce a new simulation system. Projectile knockback is a `CombatSystem`
  side effect on existing target knockback state; render effects are main-thread renderer
  responsibility.

### Runtime event payloads

- `hit` remains an edge fact owned by `CombatSystem`, but carries enough data for the renderer to
  avoid reconstructing impact state from nearby snapshots:
  ```ts
  {
    kind: 'hit';
    simTime: number;
    projectileId: number;
    targetId: number;
    targetKind: 'enemy' | 'player' | 'boss';
    targetArchetypeId: string | null; // enemy/boss id; null for player
    weaponArchetypeId: string;
    damage: number;
    impactDirX: number; // normalized projectile movement direction
    impactDirY: number;
    x: number;
    y: number;
  }
  ```
- `death` remains an edge fact owned by `HealthDeathSystem`, but projectile-caused deaths also
  carry the weapon and final-hit direction:
  ```ts
  {
    kind: 'death';
    simTime: number;
    entityId: number;
    entityKind: 'enemy' | 'player' | 'boss';
    archetypeId: string | null;
    weaponArchetypeId: string | null;
    impactDirX: number | null;
    impactDirY: number | null;
    x: number;
    y: number;
  }
  ```
- `impactDirX/Y` is the normalized projectile velocity at the moment of impact. If death is caused
  by a non-projectile source, `death.impactDirX/Y` are `null`.
- `DamageIntent.source.kind === 'projectile'` carries the same normalized impact direction so
  `HealthDeathSystem` can publish a self-contained `death` event without querying `CombatSystem`
  or `EntityStore` after the fact.
- Snapshot is not extended for impact effects. Runtime events are the correct channel because hits
  and deaths are edge facts, not long-lived authoritative state.

### Main-thread event fan-out

- `Renderer` receives an explicit runtime event sink, for example:
  ```ts
  type Renderer = Readonly<{
    render(): void;
    handleEvent(event: RuntimeEvent): void;
    fitToWindow(): void;
    applyScalePolicy(preset: RenderScalePreset): void;
    dispose(): void;
  }>;
  ```
- `UiShell` remains the owner of `SimWorkerHost.onEvent`. It fans simulation events out to
  presentation consumers: audio, then renderer if it exists, then shell-level transitions
  (`win`/`loss`) and logging.
- `Renderer` filters events internally. In this story it reacts to `hit` and `death` for
  `targetKind` / `entityKind` in `{ 'enemy', 'boss' }`.
- Renderer clears all transient impact effects on `dispose()` and when the next session renderer is
  created. Effects do not survive returning to the menu.

### Weapon force and projectile knockback

- Projectile impact spec receives a required `knockbackImpulse: number` field in wu/s through [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md).
- `impactDamage` and `knockbackImpulse` are intentionally separate fields. A weapon can deal high
  damage with a small shove, or low damage with a strong shove.
- On projectile hit against an `enemy` or `boss`, `CombatSystem` applies target knockback before
  passing the damage intent to `HealthDeathSystem`:
  ```ts
  impulseSpeed = projectile.knockbackImpulse * target.knockbackVelocityScale;
  target.knockback = {
    vx: impulseSpeed * impactDirX,
    vy: impulseSpeed * impactDirY,
    startSimMs: simTime,
    endSimMs: simTime + target.knockbackDurationMs
  };
  ```
- Existing target fields `knockbackVelocityScale` and `knockbackDurationMs` are reused. A target with
  `knockbackVelocityScale === 0` does not move from projectile knockback.
- Projectile knockback overwrites active knockback on the target, matching contact knockback in
  [enemy-contact.md](enemy-contact.md). Impulses do not stack.
- `CombatSystem` still does not mutate HP. The new side effect is limited to target knockback state;
  HP and death remain owned by `HealthDeathSystem`.
- Player knockback from enemy/boss projectiles is not part of this decision.

### Slime droplets and floor stains

- Renderer creates droplets as generated geometry, not authored PNG assets. The minimum final form
  is an irregular 2D blob built from a small polygon/radial jitter around the center. A circle is
  allowed only as a bring-up fallback inside the task, not as accepted final behavior.
- Droplets from `hit` travel in a forward-biased cone around `impactDirX/Y`.
- Droplets from `death` create a larger burst: more particles, wider cone/radial component, and
  larger stains than a normal hit.
- Per-weapon variation is derived from `WeaponArchetype.projectile`. The primary force signal is
  `knockbackImpulse`; `impactDamage`, `hitRadius`, and projectile `size` can be secondary visual
  inputs. Exact counts, speeds, and spread curves are renderer-owned tuning constants.
- Droplet color comes from `EnemyArchetype.color` or `BossArchetype.color`. Base sprites remain
  PNG-driven; `color` is used here as slime material color for impact effects.
- Droplets have a render-only lifetime:
  - short flight/fall animation;
  - for roughly the first two seconds after landing, the floor stain grows slightly;
  - then the stain lives for a renderer-owned TTL, initially about one minute;
  - near the end of TTL, the stain fades through opacity and is removed.
- Renderer keeps a bounded effect budget. If too many droplets are alive, older or less visible
  ones may be culled. That is visual degradation, not loss of gameplay state.

### Hit flash and hit squash

- On `hit`, the target sprite may receive a short render-only response:
  - brief bright/white flash;
  - directional or uniform squash impulse layered over procedural breathing.
- Hit responses are transient and keyed by `targetId`. They decay without changing
  `SpriteVisualSpec`, `contactBox`, entity position, or any simulation fields.
- If the target died on the same tick, death effects take priority; the live hit response may be
  skipped or disappear with mesh removal.

### Death ghost

- On `death` for `enemy` / `boss`, renderer creates a transient ghost sprite from the same visual
  registry and preloaded texture as the live sprite.
- Ghost starts from event `x/y`, not from a live mesh lookup. This is required because the entity is
  removed before the next snapshot.
- Ghost moves quickly:
  - a small component along `impactDirX/Y`, if direction is available;
  - a larger upward component in world/screen `+Y`;
  - no gameplay collision and no arena clamp.
- Ghost is translucent, desaturated or neutrally tinted, and fades out quickly, initially over one
  to two seconds.
- Death ghost must work even if the current snapshot no longer contains the dead entity, as long as
  `archetypeId` resolves to a visual spec and preloaded texture.

### Randomness and determinism

- Projectile knockback is authoritative simulation and does not use randomness.
- Render-only effects may vary visually, but their randomness lives only on the main/render side and
  never returns to `sim`, snapshots, runtime events, or content generation.
- Prefer deterministic local hashing from event fields (`simTime`, ids, archetype ids, droplet
  index) over direct `Math.random()`: the same event should produce stable effect geometry for tests
  and debugging. This is presentation determinism, not session RNG.

### Tests and verification

- Event-shape tests cover the new `hit` and `death` fields.
- Combat tests cover projectile knockback direction, weapon impulse scaling, target susceptibility
  through `knockbackVelocityScale`, and the absence of HP mutation inside `CombatSystem`.
- Health/death tests cover propagation of projectile impact direction and weapon id into `death`.
- Renderer tests cover `handleEvent`, effect creation from `hit`/`death`, player-hit filtering,
  effect cleanup/TTL, and the invariant that visual droplets never appear in snapshots.
- Content checks cover required projectile `knockbackImpulse` values.
- Manual visual QA checks pistol-like, shotgun-like, laser-like, and sniper-like weapons if they
  exist in the current content set; otherwise it checks available weapons and records the remaining
  tuning follow-up.

## Consequences

- Impact presentation becomes juicy without polluting `EntityStore` or snapshots with visual
  debris.
- Runtime events become more self-contained for main-thread consumers. Payloads grow slightly, but
  renderer avoids fragile lookups against snapshots where the target may already be gone.
- `CombatSystem` gains one new authoritative side effect on projectile hit: target knockback. The
  HP boundary remains intact because damage still passes through `HealthDeathSystem`.
- `WeaponArchetype.projectile` now covers both impact damage and physical force. Existing weapon
  content needs explicit projectile `knockbackImpulse` values.
- `EnemyArchetype.color` and `BossArchetype.color` are no longer only future placeholders: render-only
  slime material effects read them, while base sprite rendering remains asset-driven.
- Render effect budgets and visual tuning become real maintenance surfaces. That is acceptable:
  they are isolated in `src/main/render/**` and do not affect deterministic simulation.

## Related

- [thread-model.md](thread-model.md)
- [runtime-systems.md](runtime-systems.md)
- [snapshot-shape.md](snapshot-shape.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [health-and-death.md](health-and-death.md)
- [enemy-contact.md](enemy-contact.md)
- [content-archetypes.md](content-archetypes.md)
- [sprite-assets.md](sprite-assets.md)
- [main-ui-shell.md](main-ui-shell.md)
- [rng.md](rng.md)
- [testing.md](testing.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
