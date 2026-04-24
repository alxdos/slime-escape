# Combat Modifiers And Field Effects

- Status: accepted
- Created: 2026-04-24
- Updated: 2026-04-24

## Context

[universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md) establishes weapons, projectiles, explosions, fragments and weapon modifier drops. It intentionally stops before mechanics that need longer-lived world effects, actor status effects, target acquisition helpers or AI reactions.

The next layer of combat juice should be designed separately so the universal weapon system stays focused:

- mines need proximity-triggered detonation, not only timed explosion;
- puddles and fields need temporary area entities that apply effects over time;
- burn, slow, poison and similar status effects need actor-local state and duration;
- slime friendly-fire retaliation needs AI target memory, not only damage filtering;
- carrier slimes and pickup magnet alter drop behavior without changing death/drop basics;
- aim assist changes player input/weapon targeting and must remain non-authoritative enough to feel fair;
- future ricochet requires walls or arena boundaries and should not be smuggled into projectile motion before geometry exists.

## Decision

### Scope boundary

- This decision extends the combat ecosystem after universal weapons exist. It does not replace [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md).
- The story using this decision must treat these mechanics as opt-in content features. Existing sessions remain valid without any status effects, mines, puddles, magnets or retaliation.
- Each mechanic must be data-driven through content archetypes or session rules; no behavior may key off a specific hard-coded weapon, slime or preset id.

### World effect entities

- Temporary area effects are runtime entities:
  ```ts
  type FieldEffect = {
    id: EntityId;
    kind: 'fieldEffect';
    archetypeId: string;
    ownerId: EntityId | null;
    ownerKind: 'player' | 'enemy' | 'boss' | null;
    position: { x: number; y: number };
    radius: number;
    applyEveryMs: number;
    nextApplySimMs: number;
    expireAtSimMs: number;
    effects: ReadonlyArray<ActorEffectApplication>;
  };
  ```
- `fieldEffect` lives in `EntityStore` and is exported in snapshots only with presentation fields needed by renderer.
- `CombatSystem` can spawn a field effect as part of projectile explosion resolution, but the lifetime and periodic application belong to a dedicated `FieldEffectSystem`.
- `FieldEffectSystem` runs after `HealthDeathSystem` and before `StatusEffectSystem`/`DropSystem` per [runtime-systems.md](runtime-systems.md). It produces damage intents and actor-effect applications; it does not mutate HP directly.
- Field effects use the same damage rules as explosions from [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md), including owner exclusion and `slimeFriendlyFire`.

### Actor status effects

- Status effects are actor-local runtime state on damageable actors:
  ```ts
  type ActorStatusEffect =
    | { kind: 'burn'; damagePerTick: number; tickEveryMs: number; nextTickSimMs: number; expireAtSimMs: number; source: EffectSource }
    | { kind: 'slow'; speedMultiplier: number; expireAtSimMs: number; source: EffectSource }
    | { kind: 'poison'; damagePerTick: number; tickEveryMs: number; nextTickSimMs: number; expireAtSimMs: number; source: EffectSource };
  ```
- A dedicated `StatusEffectSystem` owns ticking, expiry and damage-intent production for status effects. It does not own projectile collision or drop pickup.
- `MovementSystem` reads the resolved movement scalar from status state; it does not decide when slow starts or ends.
- Stacking policy is per status kind and must be explicit in content validation:
  - `slow`: strongest active multiplier wins; durations are tracked separately.
  - `burn` and `poison`: multiple sources may coexist, but each source must tick deterministically by `nextTickSimMs`.
- Status-effect damage goes through `HealthDeathSystem` as damage intents with `source.kind: 'statusEffect'`.

### Mines and proximity triggers

- Mines are ordinary placed/grounded projectiles from [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md) with an additional trigger:
  ```ts
  type DetonationTrigger =
    | { kind: 'timer' }
    | { kind: 'proximity'; radius: number; armDelayMs: number }
    | { kind: 'timerOrProximity'; radius: number; armDelayMs: number };
  ```
- Trigger checks are owned by `CombatSystem` because it already owns grounded projectile detonation.
- Proximity checks use `SpatialIndex` and the active damage rules to decide which nearby actors count as valid triggers.
- Mines cannot trigger on their owner before `armDelayMs` expires. Owner self-triggering after arming remains excluded by the same default owner-damage rule unless future content explicitly adds self-damage.

### Drop extensions

- Carrier enemies are represented by content, not a new runtime entity kind:
  - `EnemyArchetype.dropTable` remains the baseline death-drop contract.
  - A carrier may use a guaranteed drop table entry or a new explicit `guaranteedDropArchetypeIds` extension, but the death hook remains owned by `DropSystem`.
  - Renderer may show a carrier marker using enemy archetype/content metadata, not by inspecting hidden runtime drop rolls.
- Drop magnet is a player-affecting modifier:
  ```ts
  type PickupModifier = {
    kind: 'dropMagnet';
    pickupRadiusMultiplier: number;
    attractSpeed: number;
  };
  ```
- `DropSystem` owns attraction movement and pickup-radius expansion. It remains the only system that removes drops through pickup/expire.
- Attraction is deterministic and uses no random jitter.

### Friendly-fire retaliation

- Retaliation is an AI reaction to a `hit`/damage fact, not a damage-rule change.
- Runtime enemies may gain short-lived aggro memory:
  ```ts
  type AggroMemory = {
    targetId: EntityId;
    reason: 'friendlyFire' | 'playerDamage' | 'scripted';
    expireAtSimMs: number;
  };
  ```
- If `slimeFriendlyFire` is enabled and an enemy damages another enemy, the damaged enemy may temporarily target the attacker according to its archetype/session reaction policy.
- `MovementSystem` may consume current aggro target as an input to chase behavior, but the decision to set/expire aggro belongs to an AI/behavior layer, not movement.
- Retaliation is optional per enemy archetype or session. Some slimes can ignore friendly fire.

### Aim assist

- Aim assist is a player-control affordance, not a hidden damage bonus.
- Main thread may show and apply a small corrected aim direction before sending fire/aim intent, or simulation may resolve a corrected direction at fire time from deterministic state. The implementation must choose one owner and document it in the story task before code changes.
- Aim assist must obey session/content tuning:
  ```ts
  type AimAssistRule = {
    enabled: boolean;
    maxAngleRadians: number;
    maxDistance: number;
    strength: number;
  };
  ```
- Aim assist cannot redirect shots behind the player or to targets outside the configured cone. It should prefer the nearest valid target in angle/distance order using deterministic tie-breakers.

### Ricochet and geometry

- Ricochet is deliberately not part of this decision's implementable scope while the arena has no walls and no bounded edge collision.
- When geometry exists, ricochet should be introduced by extending projectile collision against explicit world surfaces, not by fake random direction changes or invisible arena edges.

### Presentation

- Field effects and status effects must have readable but compact presentation:
  - puddles/fields show area, remaining danger and type;
  - slowed/burning/poisoned actors get lightweight visual hints;
  - mines show arming/armed state without revealing hidden information that content intends to hide;
  - carrier slimes show a visible marker before death;
  - magnet pickup gives clear attraction motion.
- Presentation hints do not decide gameplay.

## Consequences

- This story introduces two runtime systems: `FieldEffectSystem` and `StatusEffectSystem`.
- Damage intents remain the single route to HP loss, preserving `HealthDeathSystem` ownership.
- Drop behavior grows without changing the rule that `DropSystem` owns drop lifecycle.
- AI reactions become data-driven and can evolve without modifying projectile damage rules.
- The system becomes more expressive, but the implementation must avoid bundling too many mechanics into one task. Each mechanic should be gated by content and tests.

## Related

- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [runtime-systems.md](runtime-systems.md)
- [health-and-death.md](health-and-death.md)
- [drops.md](drops.md)
- [snapshot-shape.md](snapshot-shape.md)
- [input-commands.md](input-commands.md)
- [rng.md](rng.md)
- [testing.md](testing.md)
- [../stories/018-combat-modifiers-and-field-effects.md](../stories/018-combat-modifiers-and-field-effects.md)
