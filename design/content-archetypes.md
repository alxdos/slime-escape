# Content Archetypes

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-29 (story 030 prep: `PetArchetype` stays presentation/economy identity only; companion combat HP, contact box, movement, weapon, boop, and rescue values live in `SessionDefinition.companion`. Earlier: 2026-04-28 story 029 prep: add `PetArchetype` and `PetEconomy` to the content library; pets are collection/presentation content in this story and have no combat fields. Earlier: 2026-04-25 story 019: `EnemyArchetype.carrierDrop` removed; per-spawn guaranteed drops, dropTable replacement, and retaliation replacement move to [spawn-overrides.md](spawn-overrides.md). `EnemyArchetype.dropTable` and `EnemyArchetype.retaliation` remain archetype defaults. Earlier: 2026-04-24 cleanup pass: legacy scalar `WeaponArchetype` and legacy `{ primaryWeaponArchetypeId }` `Loadout` removed; only the current 017 forms remain. `DropEffect` is no longer redefined here; the single source of truth is [drops.md](drops.md). `WeaponArchetype` carries no audio field by [audio.md](audio.md). 017 alignment: `WeaponArchetype` and `Loadout` follow [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). 018 alignment: optional field/status/drop-magnet/carrier extensions are owned by [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md). Earlier: story 016 impact feedback, story 013 sprite/contact boxes, story 012 MD-generated weapons/drops/bosses.)

## Context

[content-boundaries.md](content-boundaries.md) states that enemy, weapon, and boss archetypes live in the `content library` (`src/shared/content/**`, see [web-stack.md](web-stack.md)), but does not define their shape. Story 003 introduces the first real library content beyond arena and player: one enemy archetype and one weapon archetype. Without an explicit contract:

- story 003 would implicitly define archetype fields in `content/**`;
- stories 004 (waves), 005 (drops), and 006 (boss) would each add or rename fields locally;
- `SpawnSystem` ([spawn-plan.md](spawn-plan.md)) and `CombatSystem` ([projectiles-and-combat.md](projectiles-and-combat.md)) would start "knowing" archetypes by incidental fields instead of by contract.

Also, `SessionDefinition.loadout` ([session-definition.md](session-definition.md)) is currently allowed to be `null`. Once the player receives a weapon in 003, the minimal loadout shape needs to be defined here rather than introduced locally in `content/**`.

## Decision

### General archetype rules

- An archetype is a **read-only description** of a game element, not runtime state. Archetypes live in `src/shared/content/**` and are not mutated during a session ([content-boundaries.md](content-boundaries.md)).
- Every archetype has a stable string `id`. The `id` is unique inside its registry (`enemies`, `weapons`, `bosses`, ...) and is not reused after deletion.
- References from `SessionDefinition`, `EncounterDefinition`, `SpawnPlan`, and runtime state to archetypes use `id` only, never object references. `id -> archetype` resolution happens once at session start: the session builder and/or `SpawnSystem`/`CombatSystem` build local `Map<id, archetype>` values. This prevents stale object references if content changes between builds.
- Unknown `id` during resolution is a session-build/start error, not a runtime fallback.
- Archetypes may be extended only by **appending** fields. Renaming or changing field semantics is a new design decision and requires updating this file.
- All units are world units, wu/s, and simulation milliseconds, independent of renderer ([arena-and-coordinates.md](arena-and-coordinates.md), [simulation-timing.md](simulation-timing.md)).

### EnemyArchetype

- Shape for the 019 horizon:
  ```ts
  type EnemyBehavior = 'stationary' | 'chase';

  type DropTableEntry = Readonly<{
    archetypeId: string;             // DropArchetype.id from the drops registry in the content library
    chance: number;                  // [0, 1]
  }>;

  type RetaliationPolicy = Readonly<{
    enabled: boolean;
    durationMs: number;              // integer > 0 when enabled === true; otherwise 0
  }>;

  type EnemyArchetype = Readonly<{
    id: string;
    displayName: string;
    radius: number;                  // wu, legacy circle metric for non-migrated consumers; body-contact no longer reads it after body-contact-boxes.md
    contactBox: Readonly<{ width: number; height: number }>;  // wu, derived from sprite asset; owns body contact and projectile target overlap for `player` / `enemy` / `boss`
    maxHp: number;                   // integer > 0
    behavior: EnemyBehavior;
    maxSpeed: number;                // wu/s, >= 0; must be 0 for 'stationary'
    contactDamage: number;           // integer >= 0; 0 = this enemy can be touched without damage
    contactCooldownMs: number;       // integer > 0; interval between two contact hits from the same enemy
    knockbackBaseImpulse: number;    // wu/s, >= 0; base bounce speed with zero approach
    knockbackVelocityScale: number;  // dimensionless, >= 0; multiplier for approachSpeed contribution
    knockbackDurationMs: number;     // integer > 0; knockback decay duration
    color: number;                   // 0xRRGGBB, slime material color for impact effects; base sprite remains PNG-driven
    dropTable: ReadonlyArray<DropTableEntry>;  // **archetype default**; per-spawn replacement: spawn-overrides.md
    retaliation: RetaliationPolicy;             // **archetype default**; per-spawn replacement: spawn-overrides.md
  }>;
  ```
- `dropTable` and `retaliation` are **archetype defaults**, used only when a concrete spawn in `content/sessions/<presetId>.md` has no `SpawnOverride` ([spawn-overrides.md](spawn-overrides.md)). Runtime systems read per-spawn copies of these fields from the runtime `enemy` entity, not from the archetype. The archetype is only the source of the default copy at spawn time.
- `carrierDrop` / `CarrierDropMetadata` / `marker: 'reward'` fields are **absent** from `EnemyArchetype`. A guaranteed carrier-fissure drop is a per-spawn override (`SpawnOverride.guaranteedDrops` in [spawn-overrides.md](spawn-overrides.md)), not an archetype field. The presentation `carrierDropMarker` in snapshots ([snapshot-shape.md](snapshot-shape.md)) is derived by `SpawnSystem` from `guaranteedDrops.length > 0` at spawn time and does not depend on the archetype.
- `behavior: 'stationary'` means `MovementSystem` does not move enemies of this archetype. `maxSpeed` must be 0 for `'stationary'`; content/builders validate this, not runtime.
- `behavior: 'chase'` means `MovementSystem` moves the enemy toward the current player position at `maxSpeed`. The exact algorithm, such as direct-line movement or steering, is an implementation detail. The contract is "on average, reduces distance to the player each tick". Future behaviors (`'wander'`, `'orbit'`, ...) are added to the `EnemyBehavior` union rather than by local branches in `MovementSystem`.
- `contactBox` is the axis-aligned body footprint for body contact and projectile hit detection, by [body-contact-boxes.md](body-contact-boxes.md) and [projectiles-and-combat.md](projectiles-and-combat.md). At the 013 horizon it is not manually authored in MD and is derived from the sprite asset through the same scale pipeline as visual `worldSize`.
- `contactDamage` and `contactCooldownMs` are the single source of truth for contact damage; handling rules live in [enemy-contact.md](enemy-contact.md). If `contactDamage === 0`, cooldown is still explicit. Omitting the field is forbidden by the same "one way to say no data" rule.
- `knockbackBaseImpulse`, `knockbackVelocityScale`, and `knockbackDurationMs` are parameters for enemy-contact knockback away from the player; handling rules live in [enemy-contact.md](enemy-contact.md), `Knockback at contact`. Fields are always present: "no knockback" is expressed by explicit zeros `knockbackBaseImpulse === 0 && knockbackVelocityScale === 0`, not missing fields.
- `color` is slime material color for render-only impact effects ([impact-feedback.md](impact-feedback.md)): droplets/stains take their hue from the hit `enemy` / `boss`. Base sprite rendering still does not tint player/enemy/boss PNGs; visual identity remains the preloaded sprite from [sprite-assets.md](sprite-assets.md). Non-renderer consumers, such as debug overlay, minimap, or tooling, may also use the field.
- Numeric constraints required by content/builders:
  - `maxSpeed * SIM_STEP_SEC <= min((contactBox.width + player.contactBox.width) / 2, (contactBox.height + player.contactBox.height) / 2)` ([enemy-contact.md](enemy-contact.md): no tunneling through the player), warning through the shared log module ([logging.md](logging.md));
  - for `'stationary'`, `maxSpeed === 0`, `contactDamage === 0`, and `knockbackBaseImpulse === 0 && knockbackVelocityScale === 0` are required. A stationary target must not implicitly hit or bounce. Content/builders validate this.
- `dropTable` is required and always present, even when the enemy drops nothing: explicit `[]` differs from "forgot to set it" (see the "one way to say no data" rule). Additional constraints, such as each `chance in [0, 1]`, total `chance <= 1`, and all `archetypeId` values resolving in the `DropArchetype` registry, are defined in [drops.md](drops.md). Violations are warnings through the shared log module on the content/builder side and do not reach runtime fallback.
- `retaliation` is required and always present, even when the archetype never retaliates: "retaliation disabled by default" is expressed as `{ enabled: false, durationMs: 0 }`, not by omitting the field. The same validation rule (`enabled === true && durationMs <= 0` -> warning) lives in [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md) and applies to archetype defaults and per-spawn overrides from [spawn-overrides.md](spawn-overrides.md).

### WeaponArchetype

- Current shape:
  ```ts
  type WeaponArchetype = Readonly<{
    id: string;
    displayName: string;
    cooldownMs: number;
    firePattern: FirePattern;
    projectile: ProjectileArchetype;
  }>;
  ```
- Full definitions of `FirePattern`, `ProjectileArchetype`, `ExplosionSpec`, `FragmentSpec`, projectile motion, and related rules, including per-projectile `impactDamage`, `knockbackImpulse`, `hitRadius`, `pierceCount`, `groundOnImpact`, `explosion`, and `visual`, live in [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). They are not duplicated here.
- `cooldownMs` is the minimum interval between two consecutive shots. Actual use through owner-local `WeaponInstance` is defined in [projectiles-and-combat.md](projectiles-and-combat.md) and [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md).
- Infinite ammo from [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md) is not represented by an archetype field: the absence of `ammo` is the implementation. If finite ammo appears later, it will be added by a separate field and design decision.
- Builder validation checks nested `projectile` specs, including no-tunneling constraints for each motion profile from [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md).
- `WeaponArchetype` carries no audio field. Weapon-to-sound binding uses string `archetypeId` through `WEAPON_AUDIO_MAPPINGS` in `src/main/audio/**` ([audio.md](audio.md)); adding audio fields to `WeaponArchetype` is forbidden.
- Migration from the legacy single-primary scalar weapon (`projectileSpeed`/`projectileRadius`/`projectileTtlMs`/`damage`/`knockbackImpulse`/`color`) is a builder task: scalar fields are packed into `firePattern: { kind: 'single', count: 1, spreadRadians: 0 }` and `projectile: { motion: { kind: 'linear', speed }, ... }` by [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md). The old shape is not valid after 017.

### DropArchetype

- Minimal shape:
  ```ts
  type DropArchetype = Readonly<{
    id: string;
    displayName: string;
    radius: number;          // wu, > 0; derived from PNG ([drops.md](drops.md), [sprite-assets.md](sprite-assets.md))
    ttlMs: number;           // integer > 0; arena lifetime after spawn
    effect: DropEffect;
    color: number;           // 0xRRGGBB, renderer placeholder
  }>;
  ```
- `radius` is a runtime archetype field, but in the content pipeline it is **derived** from the drop PNG. Full rules live in [drops.md](drops.md); there is no MD column for `radius`.
- `DropEffect`, including its union, `heal`, weapon-related kinds, and pickup-modifier kind, has [drops.md](drops.md) as the single source of truth. The shape is not duplicated here.
- The full contract for how drops spawn, live, are picked up, and apply `DropEffect` lives in [drops.md](drops.md). This section only defines the archetype shape and its place in the `content library`.

### PetArchetype and PetEconomy

- Minimal shape for content area `pets` (story 029):
  ```ts
  type PetQuality = 'green' | 'purple';

  type PetArchetype = Readonly<{
    id: string;
    displayName: string;
    quality: PetQuality;
  }>;

  type PetEconomy = Readonly<{
    xpPerDestroyedSlime: number;     // integer >= 0
    standPrices: Readonly<Record<PetQuality, number>>; // integer >= 0
  }>;
  ```
- `PetArchetype` is collection and presentation content. It intentionally has no HP, contact box, combat stats, weapon, behavior, effect, aura, cooldown, or modifier fields in story 029.
- `quality` is the only grouping field used by the Lab stands and the Pets inventory zones in the first version. Green and purple pools are disjoint by pet id.
- `PetEconomy.xpPerDestroyedSlime` is the content-owned coefficient for result XP. Story 029 derives earned XP as `summary.kills.total * xpPerDestroyedSlime` for eligible campaign results.
- `PetEconomy.standPrices` is the content-owned source for the Lab prices. UI code must not hardcode green or purple XP prices.
- Owned pets and selected pet are `client progression` ([content-boundaries.md](content-boundaries.md)) and store only `PetArchetype.id`, never embedded archetype objects.
- In story 029 a selected pet is presentation-only. It must not be represented as a combat entity, must not take damage, and must not influence `SessionDefinition`, combat systems, win/loss, drops, or result stats.
- In story 030, a selected pet can become a runtime companion only through `SessionDefinition.companion` ([companion-combat.md](companion-combat.md)). `PetArchetype` still must not gain combat fields; pet identity may select sprite/personality presentation only.

### BossArchetype

- Minimal shape for 006:
  ```ts
  type BossArchetype = Readonly<{
    id: string;
    displayName: string;
    radius: number;                      // wu, legacy circle metric for non-migrated consumers
    contactBox: Readonly<{ width: number; height: number }>;  // wu, derived body footprint / projectile target shape
    maxHp: number;                       // integer > 0
    maxSpeed: number;                    // wu/s, >= 0; base movement speed if boss moves
    color: number;                       // 0xRRGGBB, slime material color for impact effects; base sprite remains PNG-driven
    contactDamage: number;
    contactCooldownMs: number;
    knockbackBaseImpulse: number;
    knockbackVelocityScale: number;
    knockbackDurationMs: number;
    phases: ReadonlyArray<Readonly<{
      id: string;
      allowedAttackIds: ReadonlyArray<string>;  // non-empty; each id exists in `attacks`
      /** Leave the phase and move to the next one when `hp/maxHp <= exitWhenHpFractionAtOrBelow`.
       *  For the **last** phase the value is unused, because there is no transition beyond `phases`.
       *  Thresholds are provided by content/builders (see [../docs/BOSS.md](../docs/BOSS.md)). */
      exitWhenHpFractionAtOrBelow: number;
    }>>;
    attacks: Readonly<Record<string, Readonly<{ pattern: string; cooldownMs: number; damage: number }>>>;
  }>;
  ```
- Contact with the player and knockback follow the same rules as `EnemyArchetype` ([enemy-contact.md](enemy-contact.md)); numbers are specified on the boss archetype.
- Boss `contactBox` follows the same rule as `EnemyArchetype`: derived from sprite asset, owning body contact and projectile target overlap.
- At least **two** entries in `phases` and at least **two** distinct keys in `attacks` are required for story 006 acceptance ([../stories/006-boss-encounter.md](../stories/006-boss-encounter.md)). Actual attack selection from `allowedAttackIds` and pattern execution belongs to `BossPhaseSystem` ([boss-encounter.md](boss-encounter.md)).
- `color` follows the same rule as `EnemyArchetype.color`: render-only slime impact effects read it as material color, the base sprite renderer for `boss` does not read it, and the field remains available to non-renderer scenarios.

### PlayerArchetype

- Minimal shape for content area `players` (story 013):
  ```ts
  type PlayerArchetype = Readonly<{
    id: string;
    displayName: string;
    radius: number;                                       // wu, derived: max(contactBox.width, contactBox.height) / 2
    contactBox: Readonly<{ width: number; height: number }>;  // wu, derived body footprint / projectile target shape
    maxSpeed: number;                                     // wu/s
    maxHp: number;                                        // integer > 0
  }>;
  ```
- Player `contactBox` follows the same rule as `EnemyArchetype` / `BossArchetype`: derived from sprite asset by [body-contact-boxes.md](body-contact-boxes.md), used for body contact and projectile hit detection, with no manual MD columns at the 013 horizon.
- Player `radius` is no longer authored in `content/players.md`: producer derives it from the same sprite `worldSize` as `max(width, height) / 2`. The field remains in the runtime contract only for non-migrated consumers such as pickup distance.
- `PlayerSpawn` in `SessionDefinition.player` is assembled from `PlayerArchetype`, but remains a separate session-level contract because it stores start position and session-local shape.

### PlayerSpawn.maxHp

- `SessionDefinition.player` ([session-definition.md](session-definition.md)) gains required field `maxHp: number` (integer > 0). This places the source of truth for starting player HP in session data rather than system code.
- `maxHp` is **always** present, even in presets where the player is not damageable, such as a non-combat sandbox. This avoids two ways to say "no data" and simplifies HUD: in a non-combat sandbox, `hp = maxHp` for the whole run.
- Exact values, for example `5` for a training preset, are `content library` data. Extensions such as `maxArmor` or regeneration are future decisions.

### Loadout in SessionDefinition

- Current shape:
  ```ts
  type Loadout = Readonly<{
    weapons: ReadonlyArray<string>; // WeaponArchetype.id values
    selectedIndex: number | null;
  }>;
  ```
- For a non-combat sandbox mode, `loadout` remains `null`; the session builder explicitly distinguishes "combat not planned" (`null`) from "has weapons" (`Loadout` object).
- `Loadout.weapons` is immutable session configuration. Runtime selection, cooldowns, and upgrades live in owner-local weapon state ([universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)); slot switching does not mutate the session definition.
- Migration from legacy `{ primaryWeaponArchetypeId: string }` is a builder task: the value is packed into `{ weapons: [primaryWeaponArchetypeId], selectedIndex: 0 }`. The old shape is not valid after 017.

### Registries in the content library

- The `src/shared/content/**` directory is extended with registries by content type. Exact filenames are implementation details, not contract:
  - `EnemyArchetype` registry, for example `enemies.ts`;
  - `WeaponArchetype` registry, for example `weapons.ts`;
  - `DropArchetype` registry, for example `drops.ts`;
  - `PetArchetype` registry and `PetEconomy`, for example `pets.ts`;
  - `BossArchetype` registry, for example `bosses.ts`;
  - `index.ts` re-exports registries together with existing arenas/presets.
- A registry has one allowed structure: `Record<string, Archetype>` keyed by `archetype.id`. This prevents drift between the object key and `id`.

## Consequences

- 003 puts the first registry content, one target and one pistol, into a shape ready for extension; 004-006 add data to the same registries; 006 adds `bosses` without breaking existing shapes.
- `SpawnSystem` and `CombatSystem` remain independent of specific content and operate through `id` resolution.
- `Loadout` becomes a stable `SessionDefinition` contract; weapon-selection UI in 007 can consume it without redefining shape.
- A possible archetype plugin/modding layer outside the MVP can sit on the same "registry + id" model without rewriting stories.
- Pet collection uses the same registry/id model without making permanent pet ownership a combat-stat source.

## Related

- [body-contact-boxes.md](body-contact-boxes.md)
- [content-boundaries.md](content-boundaries.md)
- [session-definition.md](session-definition.md)
- [spawn-plan.md](spawn-plan.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [enemy-contact.md](enemy-contact.md)
- [health-and-death.md](health-and-death.md)
- [drops.md](drops.md)
- [logging.md](logging.md)
- [web-stack.md](web-stack.md)
- [arena-and-coordinates.md](arena-and-coordinates.md)
- [simulation-timing.md](simulation-timing.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
- [boss-encounter.md](boss-encounter.md)
- [content-authoring.md](content-authoring.md)
- [sprite-assets.md](sprite-assets.md)
- [impact-feedback.md](impact-feedback.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)
- [spawn-overrides.md](spawn-overrides.md)
- [companion-combat.md](companion-combat.md)
- [../stories/029-xp-and-pet-companions.md](../stories/029-xp-and-pet-companions.md)
- [../stories/030-companion-combat-and-rescue.md](../stories/030-companion-combat-and-rescue.md)
