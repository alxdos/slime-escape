# Universal Weapons and Projectiles

- Status: accepted
- Created: 2026-04-24
- Updated: 2026-04-30 (story 032 prep: added Related link for the public multiplayer arena. Earlier: 2026-04-29 story 030 prep: universal weapon ownership extends to `companion`; companion loadout is session-owned and has no pet-archetype stats or modifier drops. Earlier: 2026-04-26 story 022: owner-local `WeaponInstance` also carries cooldown interval start and temporary overdrive start so `WeaponHudSnapshot` can render cooldown fill and timed upgrade progress without guessing; see [hud-presentation.md](hud-presentation.md). Earlier: 2026-04-24 sprite extension: `ProjectileVisualSpec` form fixed to render-only behavior fields only; sprite identity (PNG path / `worldSize` / `anchor`) lives in the `projectileVisuals` registry per [sprite-assets.md](sprite-assets.md), keyed by `weaponArchetypeId`. cleanup pass: `audio?` field removed from `WeaponArchetype` to keep [audio.md](audio.md) invariant «no audio fields on archetypes»; no-op weapon-modifier rule reduced to a single deterministic case; `temporaryOverdrive.target` documented as single-value on this horizon; aim assist owner and pickup magnet binding moved to [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md) without ambiguity. Fireball follow-up: `multiDirection` directions are aim-relative offsets, not world axes.)

## Context

[projectiles-and-combat.md](projectiles-and-combat.md) and [content-archetypes.md](content-archetypes.md) currently describe the MVP combat slice: one primary weapon in `SessionDefinition.loadout`, one linear projectile shape, one impact, and owner-kind filtering where enemies and bosses mostly target the player.

The next weapon slice needs a more general contract:

- any combat actor (`player`, `enemy`, `boss`, `companion`) can own one or more weapon instances;
- the same weapon archetype can be granted to different owners without duplicating content;
- the default damage rule is permissive: a projectile can damage any damageable entity except when the active session rules filter it out;
- weapons can emit bullets, thrown objects, grenades, bombs and four-direction fireballs;
- projectiles can move linearly, travel in an arc, or be placed directly on the ground;
- projectiles can have impact damage, optional grounded state, optional timed explosion, optional radial damage, fragments, knockback and presentation hints;
- drops can apply weapon modifiers such as projectile size, projectile speed, symmetric projectile count, pierce and temporary overdrive.

Without a new contract, each new weapon would either add special branches to `CombatSystem` or silently reinterpret the old `WeaponArchetype` fields.

## Decision

### Weapon archetype and projectile archetype

- `WeaponArchetype` remains read-only content referenced by stable `id`, but its combat shape becomes composition-based:
  ```ts
  type WeaponArchetype = Readonly<{
    id: string;
    displayName: string;
    cooldownMs: number;
    firePattern: FirePattern;
    projectile: ProjectileArchetype;
  }>;
  ```
- `WeaponArchetype` carries no audio fields by design. Audio is bound to weapons by `archetypeId` through `WEAPON_AUDIO_MAPPINGS` in `src/main/audio/**` per [audio.md](audio.md); content-archetype shape stays presentation-free.
- `ProjectileArchetype` is embedded in the weapon archetype on this horizon. A separate projectile registry is intentionally not introduced yet; sharing one projectile spec between many weapons can be added later as an `id` reference if duplication becomes real.
- Minimal projectile shape:
  ```ts
  type ProjectileArchetype = Readonly<{
    motion: ProjectileMotion;
    size: { width: number; height: number };  // derive from PNG, see below
    hitRadius: number;
    impactDamage: number;
    knockbackImpulse: number;
    pierceCount: number;
    ttlMs: number;
    groundOnImpact: boolean;
    groundedLifetimeMs: number | null;
    explosion: ExplosionSpec | null;
    visual: ProjectileVisualSpec;
  }>;
  ```
- `size` is a runtime field of the archetype but a **derive** value in the content pipeline: content-build copies it from `worldSize` of the corresponding `projectileVisuals[weaponArchetypeId]` entry per [sprite-assets.md](sprite-assets.md). It is **not authored** in `content/weapons.md` — the projectile's PNG is the single source of truth. The field exists in the type so runtime code (renderer, size modifiers, HUD, debug overlays) can read it directly without a registry lookup; both `weapons.generated.ts` and `projectileVisuals.generated.ts` carry the same number derived from the same PNG.
- `hitRadius` is the gameplay overlap radius in world units and is **authored in MD** as a normal content field. It is **independent** of `size` and may legitimately differ from it — for example, a laser sprite is a long thin beam, but `hitRadius` is a small value at its centre. `hitRadius` is the only authoritative number for projectile collisions; `size` does not enter hit detection.
- `impactDamage` can be `0`. This is valid for bombs or low-impact grenades. `explosion` can be `null`. A thrown rock is a projectile with high `impactDamage`, `groundOnImpact: true`, and `explosion: null`.
- `pierceCount` is the number of additional targets the projectile may hit before it is removed or grounded. `0` preserves the old "one projectile = one hit" behavior.

### Fire pattern

- `FirePattern` is a discriminated union:
  ```ts
  type FirePattern =
    | { kind: 'single'; spreadRadians: number; count: number }
    | { kind: 'multiDirection'; directions: ReadonlyArray<number> }
    | { kind: 'place' };
  ```
- `single` fires toward the owner's aim direction. `count > 1` emits a symmetric spread around the aim axis. `spreadRadians` is the full spread arc.
- `multiDirection` emits one projectile per authored angle offset in radians relative to the owner's aim axis. It requires a valid aim direction just like `single`; if the aim direction has zero length, no shot is fired. Four-direction fireballs are represented as `{ kind: 'multiDirection', directions: [0, PI / 2, PI, 3 * PI / 2] }`, so the first projectile follows the aim direction and the remaining three preserve the cross around it.
- `place` creates a projectile directly in a grounded state at the owner position or configured spawn offset. Bombs use `place`.
- Random spread is not part of this story. If randomness is later needed, it must use session RNG and be fixed in this file.

### Projectile motion and state

- Runtime projectiles remain `kind: 'projectile'` entities in `EntityStore`.
- Runtime projectile state copies all mutable combat parameters at spawn:
  ```ts
  type Projectile = {
    id: EntityId;
    kind: 'projectile';
    weaponArchetypeId: string;
    ownerId: EntityId;
    ownerKind: 'player' | 'enemy' | 'boss' | 'companion';
    state: 'flying' | 'grounded';
    position: { x: number; y: number };
    velocity: { vx: number; vy: number };
    hitRadius: number;
    size: { width: number; height: number };
    impactDamage: number;
    knockbackImpulse: number;
    pierceRemaining: number;
    hitEntityIds: ReadonlySet<EntityId>;
    groundAtSimMs: number | null;
    expireAtSimMs: number;
    explosion: ExplosionRuntimeSpec | null;
    visual: ProjectileVisualRuntimeSpec;
  };
  ```
- `ownerId` is kept in addition to `ownerKind` so a projectile never damages its own shooter by default during the same lifetime. This is the only default exclusion.
- `ProjectileMotion` is a discriminated union:
  ```ts
  type ProjectileMotion =
    | { kind: 'linear'; speed: number }
    | { kind: 'arc'; speed: number; range: number; flightMs: number }
    | { kind: 'placed' };
  ```
- `linear` preserves the old bullet behavior: position integrates by velocity until hit, ttl or arena cleanup.
- `arc` travels toward an intended landing point over `flightMs`; its gameplay position is the shadow/ground position used for hit tests. The visual renderer may show height/rotation, but simulation collision remains 2D.
- `placed` starts in `grounded` state immediately and does not move.
- Gravity is not simulated as a general physics force. Arc travel is deterministic interpolation between spawn and landing point.
- Projectiles with `groundOnImpact: true` enter `grounded` state on impact instead of being removed. They still apply impact damage once at the impact point before grounding.
- Grounded projectiles can expire harmlessly or explode when their `explosion.detonateAtSimMs` is reached.

### Explosion and fragments

- Explosion spec:
  ```ts
  type ExplosionSpec = Readonly<{
    delayMs: number;
    radius: number;
    damage: number;
    knockbackImpulse: number;
    fragments: FragmentSpec | null;
  }>;
  ```
- Explosion damage is radial and targets all damageable entities allowed by the active damage rules. Distance falloff is not part of this story: every target inside radius receives `damage`.
- `radius: 0` is valid but equivalent to "no area of effect" for gameplay. Content should prefer `explosion: null` when there is no explosion.
- `fragments` can spawn secondary projectiles at explosion time:
  ```ts
  type FragmentSpec = Readonly<{
    weaponArchetypeId: string;
    count: number;
    spreadRadians: number;
  }>;
  ```
- Fragments are ordinary projectiles spawned through the same `CombatSystem` creation path. They inherit the exploding projectile's `ownerId` and `ownerKind`.

### Damage rules and friendly fire

- Default projectile and explosion rule: damage any entity with health except the projectile owner.
- Session rules can narrow this behavior. `SessionDefinition.rules` gains:
  ```ts
  type DamageRules = Readonly<{
    slimeFriendlyFire: boolean;
  }>;
  ```
- `slimeFriendlyFire: true` means `enemy` projectiles and explosions may damage other `enemy` entities. `false` means `enemy`-to-`enemy` damage is filtered out.
- This field only controls slime-to-slime damage. Player/boss/enemy interactions otherwise follow the default permissive rule on this horizon.
- Story 030 adds the player/companion friendly alliance in [projectiles-and-combat.md](projectiles-and-combat.md): player-owned projectiles cannot damage the companion, and companion-owned projectiles cannot damage the player or companion.
- The rules object is copied into runtime state at session start and treated as immutable for the run.

### Weapon loadout and switching

- `SessionDefinition.loadout` evolves from one primary weapon to an ordered weapon list:
  ```ts
  type Loadout = Readonly<{
    weapons: ReadonlyArray<string>;
    selectedIndex: number | null;
  }>;
  ```
- `weapons` contains `WeaponArchetype.id` values. The same ids can be used in player, enemy, boss, or companion loadouts.
- `selectedIndex: null` means weapons are holstered. A non-null value must point inside `weapons`.
- The player switches weapon by input slots `1..9`; slot input selects the corresponding loadout index. A dedicated holster command sets `selectedIndex = null`.
- Enemies, bosses, and companions can receive loadouts from content/session assembly too, but their selection policy belongs to their behavior systems. Companion loadout availability is defined by `SessionDefinition.companion.weaponLoadout` ([companion-combat.md](companion-combat.md)); pet archetypes do not define weapons.
- Runtime `WeaponInstance` is owner-local state:
  ```ts
  type WeaponInstance = {
    archetypeId: string;
    cooldownStartedAtSimMs: number;
    nextFireSimMs: number;
    modifiers: ReadonlyArray<WeaponModifier>;
    overdriveStartedAtSimMs: number | null;
    overdriveUntilSimMs: number | null;
    overdriveCooldownMultiplier: number | null;
  };
  ```
- Cooldown and modifiers live on instances, not archetypes. Giving two actors the same weapon archetype never shares cooldown or upgrades.
- `cooldownStartedAtSimMs` and `nextFireSimMs` define the current or most recent cooldown interval for HUD presentation. Firing updates both atomically. A ready weapon initialized at session start has both values equal to the initialization sim time.
- `overdriveStartedAtSimMs`, `overdriveUntilSimMs` and `overdriveCooldownMultiplier` describe the current temporary overdrive effect. Repeated overdrive pickups overwrite these three fields.

### Weapon modifiers from drops

- `WeaponModifier` is the set of weapon-affecting modifier kinds owned by this story:
  ```ts
  type WeaponModifier =
    | { kind: 'projectileSizeMultiplier'; multiplier: number }
    | { kind: 'projectileSpeedMultiplier'; multiplier: number }
    | { kind: 'symmetricProjectileMultiplier'; multiplier: number }
    | { kind: 'pierceBonus'; amount: number }
    | { kind: 'fragmentExplosion'; fragmentWeaponArchetypeId: string; count: number; spreadRadians: number };
  ```
- The `DropEffect` union itself is owned by [drops.md](drops.md) (single source of truth). 017 contributes two new `DropEffect` kinds — `addWeaponModifier` and `temporaryOverdrive` — both wrapping the `WeaponModifier` and overdrive parameters above; both are added to the union in [drops.md](drops.md), not redefined here.
- Weapon modifiers apply at fire time when a projectile is spawned. Already spawned projectiles are not retroactively changed.
- `projectileSizeMultiplier` modifies `ProjectileArchetype.size` and `hitRadius`.
- `projectileSpeedMultiplier` modifies `linear.speed`. For `arc`, it keeps the authored landing point/range and divides effective `flightMs` by the multiplier, so upgraded thrown projectiles arrive sooner without changing the aimed landing position. `placed` projectiles ignore speed modifiers.
- `symmetricProjectileMultiplier` adds symmetric projectiles around the firing axis for aimed `single` fire patterns. The legacy field name remains `multiplier`, but balance interprets each authored `2` as one extra direction, so the effective count is `max(1, baseCount + sum(round(multiplier) - 1))`; this keeps wide weapons such as shotgun from jumping from 5 to 10 projectiles on one pickup. If the base `spreadRadians > 0`, the authored spread is reused across the larger count. If `spreadRadians === 0` and the effective count is greater than one, runtime uses a fixed `WEAPON_MODIFIER_MIN_SPREAD_RADIANS = 0.25` spread so a single straight shot upgraded by multiplier `2` becomes two visibly separated, symmetrically offset projectiles. `multiDirection` and `place` patterns ignore this modifier on this horizon because `multiDirection` owns explicit authored aim-relative offsets and `place` has no firing spread.
- `pierceBonus` increases copied `pierceRemaining`.
- `fragmentExplosion` replaces the copied `ExplosionSpec.fragments` for future shots whose projectile already has `explosion !== null`. If a selected weapon has no explosion spec, this modifier is a deterministic no-op for shots from that weapon on this horizon; adding "fragment on bullet hit/expiry" would require a separate lifecycle rule.
- `temporaryOverdrive` reduces cooldown for `durationMs` on the selected weapon only. `target` is kept as a discriminator for future expansion (e.g. `'allWeapons'`, `'slot'`); on this horizon `'selectedWeapon'` is the only allowed value, and `DropSystem` rejects other values during content validation.
- Repeated `temporaryOverdrive` pickups on the same selected weapon overwrite the multiplier and set `overdriveUntilSimMs = pickupSimTime + durationMs`. They do not stack multiplicatively.
- If no weapon is currently selected at pickup time, the weapon-modifier drop is consumed by `dropPickup` but produces no effect (silent no-op). No new `DropArchetype` flag is introduced for this case and builder validation does not reject sessions where the player can holster all weapons. If a future story needs «pending modifier that binds to the next selected weapon», it is added by a new design and explicit owner-local state, not implicit here.

### Presentation hooks

- `ProjectileVisualSpec` carries **render-only behavior** of the projectile and is part of the content archetype:
  ```ts
  type ProjectileVisualSpec = Readonly<{
    spinRadiansPerSec: number;        // 0 means no spin
    rotateWhileFlying: boolean;       // if true, sprite rotates toward movement direction
    pulseWhenGrounded: boolean;       // if true, grounded mesh pulses render-only
    explosionRadiusIndicator: boolean;// if true, renderer shows a faint radius for grounded explosives
  }>;
  ```
- Sprite identity (PNG asset, `worldSize`, `anchor`) **is not part** of `ProjectileVisualSpec`. Sprite comes from the `projectileVisuals` registry keyed by `weaponArchetypeId`, per [sprite-assets.md](sprite-assets.md). This prevents a second source of truth for the asset path.
- Spin, pulse, and radius indicator are render-only. They do not affect hit tests, damage, or authoritative simulation state.
- Grounded grenades and bombs that will explode should expose enough snapshot data ([snapshot-shape.md](snapshot-shape.md): `state`, `pulsePhase`, `explosionRadius`, `detonateAtSimMs`) for the renderer to show pulse and a faint radius indicator.
- Arc weapons should expose a main-thread preview affordance: approximate landing point or short trajectory. Preview is not authoritative gameplay state; it is calculated from weapon archetype, current aim and current modifiers on the main thread or via a read-only helper shared with simulation.

### CombatSystem ownership

- `CombatSystem` remains the owner of firing, projectile movement, hit detection, explosion resolution, fragment spawning and damage-intent creation.
- `MovementSystem` still does not move projectiles.
- `HealthDeathSystem` remains the only owner of HP decrement and death.
- `DropSystem` remains the owner of pickup, but weapon-related drop effects mutate `WeaponInstance` state through a narrow runtime API owned by combat/loadout state. `DropSystem` does not spawn projectiles.

## Consequences

- The old `primaryWeaponArchetypeId` model is superseded by ordered loadouts and weapon instances. Existing content can be migrated by wrapping the old primary id into `weapons: [id], selectedIndex: 0`.
- The old ownerKind damage table is superseded by permissive damage plus explicit session rules. This makes slime-on-slime and boss/shared weapons natural instead of special cases.
- `CombatSystem` becomes larger, but its responsibility stays coherent: all projectile lifecycle and damage-intent production.
- Snapshot and runtime-event contracts must grow for grounded projectiles, explosion indicators, selected weapon and possibly slot UI.
- More content validation is required: loadout indices, weapon ids, projectile motion numbers, modifier multipliers, explosion references and friendly-fire rules.
- Arc projectiles use deterministic interpolation rather than full physics, keeping simulation simple and reproducible.

## Related

- [projectiles-and-combat.md](projectiles-and-combat.md)
- [content-archetypes.md](content-archetypes.md)
- [session-definition.md](session-definition.md)
- [input-commands.md](input-commands.md)
- [runtime-systems.md](runtime-systems.md)
- [snapshot-shape.md](snapshot-shape.md)
- [drops.md](drops.md)
- [impact-feedback.md](impact-feedback.md)
- [rng.md](rng.md)
- [testing.md](testing.md)
- [hud-presentation.md](hud-presentation.md)
- [companion-combat.md](companion-combat.md)
- [../stories/017-universal-weapons-and-projectiles.md](../stories/017-universal-weapons-and-projectiles.md)
- [../stories/030-companion-combat-and-rescue.md](../stories/030-companion-combat-and-rescue.md)
- [online-arena-hosting.md](online-arena-hosting.md)
