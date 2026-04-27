# Enemy Contact Damage

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-23 (body contact for player <-> enemy/boss moved from circle-vs-circle to `contactBox`; see [body-contact-boxes.md](body-contact-boxes.md). Broadphase uses a derived bounds radius. The `Knockback at contact` section is preserved.)

## Context

[../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md) establishes that **the player can take damage from enemies, their projectiles, and selected hazardous areas**. Story 003 introduced the projectile side ([projectiles-and-combat.md](projectiles-and-combat.md), [health-and-death.md](health-and-death.md)), but deferred enemy contact damage. Story 004 (waves, chasers, dark zone) is the first point where enemies must be able to kill the player: the dark zone does not deal damage by [zone.md](zone.md), and enemy AI firing appears only in 006.

Without an explicit contract, 004 would implicitly place contact damage in an arbitrary system (`MovementSystem`, `CombatSystem`, or a separate touch system). Every later extension, such as boss touch in 006 or hazards in later stories, would reopen the same ownership question.

## Decision

### Contact damage ownership

- Enemy contact damage is implemented inside `CombatSystem` ([projectiles-and-combat.md](projectiles-and-combat.md), [runtime-systems.md](runtime-systems.md)). We do not introduce a separate system: `CombatSystem` already owns creation of all `DamageIntent`s and is the single handoff point to `HealthDeathSystem`. Splitting that responsibility into a separate `EnemyContactSystem` would add another damage-intent owner without a clear benefit.
- This decision applies only to **enemy-to-player contact**. Boss-to-player contact in 006 uses the same model and the same `source.kind`; exact numbers belong to the boss archetype, not this file.

### Per-enemy state

- Each damage-capable entity with `contactDamage > 0` has a runtime field `nextContactSimMs: number`. On spawn it is `0`, meaning the entity can hit on the first tick of contact. After each successfully created contact `DamageIntent`, the field is moved to `simTime + archetype.contactCooldownMs` for the current tick.
- `nextContactSimMs` is stored **on the entity itself** in `EntityStore` ([health-and-death.md](health-and-death.md): HP is also stored on the runtime entity). We do not introduce a separate cooldown registry, because that would make the contact lifecycle depend on two sources of truth.
- When the entity dies, its `nextContactSimMs` is removed with it; dead enemies cannot leave zombie cooldown records behind.

### Tick phase and order inside `CombatSystem`

- `CombatSystem` gains a **contact intents phase**, added to the five-phase projectile model from [projectiles-and-combat.md](projectiles-and-combat.md). The full tick order becomes:
  1. firing decisions: spawn new projectiles into `EntityStore`;
  2. projectile movement: integrate existing projectile positions;
  3. lifetime cleanup: mark expired and out-of-arena projectiles;
  4. **contact intents**: create `DamageIntent`s for enemies currently overlapping the player;
  5. hit detection: create projectile `DamageIntent`s;
  6. removal: remove marked projectiles from `EntityStore`.
- Contact intents and projectile intents are accumulated into **one** `DamageIntent` list for the tick and passed to `HealthDeathSystem` in a single call, as today. There is no separate contact-damage bus.
- The order "contact intents before hit detection" is intentional. If the player is hit by a projectile and is also touching an enemy on the same tick, both intents enter the same `applyDamage` call. Application order is already governed by [health-and-death.md](health-and-death.md): `hp = max(0, hp - amount)`, and repeated intents into an already dead target are ignored. Cases such as "hit an enemy and die to its contact on the same tick" do not require special handling.

### Contact intents contract

- In this phase, `CombatSystem`:
  1. Reads the current player from `EntityStore`. If the player is absent or does not have `HasHealth` ([health-and-death.md](health-and-death.md)), the phase is a no-op.
  2. Queries `SpatialIndex` ([runtime-systems.md](runtime-systems.md)) for neighbors around the player with radius `playerBoundsRadius + maxEnemyContactBoundsRadius`. Both values are derived from `contactBox` as a circumscribed circle around the rectangle, per [body-contact-boxes.md](body-contact-boxes.md). The exact caching or estimation strategy is an implementation detail.
  3. For each candidate `enemy`:
     - skip if `enemy.contactDamage <= 0`;
     - test axis-aligned box-vs-box overlap using the player's `contactBox` and the enemy/boss `contactBox`;
     - skip if there is no overlap;
     - skip if `simTime < enemy.nextContactSimMs`;
     - otherwise create a `DamageIntent` with `source.kind: 'enemyContact'`, `enemyId: enemy.id`, `amount: enemy.contactDamage`, and `hitPosition: player.position`. Then set `enemy.nextContactSimMs = simTime + enemy.contactCooldownMs`.
- `CombatSystem` does not publish runtime events for contact damage. The `hit` event in [snapshot-shape.md](snapshot-shape.md) is intentionally reserved for projectiles and carries mandatory `projectileId`. A separate contact event can be added later when HUD/audio work in 007/008 needs a distinct audiovisual response. Until then, contact damage is recoverable from the snapshot through the player's HP decrease and does not need a separate edge fact.

### Knockback at contact

- A contact hit also initiates **enemy knockback away from the player**. Whenever the contact phase successfully creates a contact `DamageIntent`, `CombatSystem` also writes a temporary impulse onto the enemy. The player is not pushed; that is a deliberate MVP choice so we do not need to route a pushed player through the same path.
- The knockback trigger and the `DamageIntent` trigger are **the same condition**. Knockback never happens separately from damage: if the contact does not create an intent because of cooldown, zero `contactDamage`, or a dead player, it also does not create knockback. This keeps the side effect at the same decision point.
- Impulse direction:
  - `normal = normalize(enemy.position - player.position)`, the vector from the player toward the enemy;
  - if the distance is zero (`enemy.position == player.position`), fall back to `normalize(enemy.velocity)`; if that is also zero, use `(1, 0)`. This degenerate case matters mainly for tests.
- Impulse speed:
  ```ts
  approachSpeed = max(0, dot(player.velocity - enemy.velocity, normal))
  impulseSpeed  = archetype.knockbackBaseImpulse
                + archetype.knockbackVelocityScale * approachSpeed
  ```
  `approachSpeed` is the component that answers "how strongly are the player and enemy moving toward each other along `normal`". It is positive when they converge and clipped to zero otherwise. The sign is chosen so head-on collisions produce stronger knockback and glancing contacts produce the minimum. Velocity sources are current because `MovementSystem` ticks before `CombatSystem` ([runtime-systems.md](runtime-systems.md), update order steps 5/6).
- Velocity is stored as runtime state on `Player` and `Enemy` entities in `EntityStore`, but it **does not enter snapshots and does not produce runtime events**. It is an implementation detail; HUD/render keep reconstructing visible movement from positions as before.
- The enemy receives:
  ```ts
  enemy.knockback = {
    vx, vy,                                 // = impulseSpeed * normal
    startSimMs:  simTime,
    endSimMs:    simTime + archetype.knockbackDurationMs,
  }
  ```
  If knockback is already active and contact triggers again after `contactCooldownMs`, the fields are **replaced**, not accumulated. This prevents impulse stacking while contact is held and matches the "one contact, one rule" model above.
- `MovementSystem` behavior for enemies under knockback:
  - while `simTime < enemy.knockback.endSimMs`, normal `behavior` such as `'chase'` **does not run**. Instead, the enemy moves by decaying knockback velocity:
    ```ts
    t = (simTime - enemy.knockback.startSimMs) / archetype.knockbackDurationMs
    decay = clamp(1 - t, 0, 1)            // linear decay; another monotonically non-increasing curve is allowed
    enemy.position += (enemy.knockback.vx * decay, enemy.knockback.vy * decay) * SIM_STEP_SEC
    ```
  - the exact decay curve (linear, smoothstep, quadratic) is an implementation detail. The contract is "monotonically non-increasing to zero by `endSimMs`, with no sign flip", and the enemy returns to its normal `behavior` immediately after `endSimMs`;
  - `MovementSystem` **does not clamp** enemy positions to arena bounds during knockback. This matches the existing rule that arena bounds apply only to controlled actors ([arena-and-coordinates.md](arena-and-coordinates.md), [runtime-systems.md](runtime-systems.md)). An enemy may briefly bounce beyond the arena and then return through chase logic.
- Knockback **does not cancel** contact cooldown. If the enemy bounces away while `contactCooldownMs` has not expired, a repeated overlap still cannot produce another intent. This preserves the rule that a single enemy cannot hit more often than once per `contactCooldownMs`.
- Knockback parameters are `EnemyArchetype` fields ([content-archetypes.md](content-archetypes.md)). This is intentional: different enemies bounce differently, such as a small slime flying farther and a tank moving less, and that tuning belongs in content rather than system code.

### Symmetry and extension

- The player does not deal contact damage to enemies. `contactDamage` exists only on `EnemyArchetype` ([content-archetypes.md](content-archetypes.md)); the player has no such field. If that mechanic appears later, it will be a new decision, not an inline extension of this one.
- The contract extends to the 006 boss without changes: `BossArchetype`, when introduced, receives the same `contactDamage` and `contactCooldownMs` fields, and `CombatSystem` does not branch on entity type. It checks `contactDamage > 0`.
- Enemy-to-enemy contact damage, or friendly fire, is not implemented. The phase only considers the pair "enemy <-> player". This matches the `ownerKind`-based friendly-fire rule in [projectiles-and-combat.md](projectiles-and-combat.md).
- Sweep collision, where a fast enemy passes through the player between ticks, is not introduced. This remains a **content contract**: `enemy.maxSpeed * SIM_STEP_SEC` must not be materially larger than the smallest relevant size of the body-contact pair. A conservative warning heuristic may exist, but it does not replace the overlap rule.

## Consequences

- 004 gets contact damage and knockback without adding a new system; the `core runtime` system list remains unchanged.
- The knockback contract stays concentrated in one place: the contact-intents phase in `CombatSystem`, plus `MovementSystem` reacting to temporary knockback velocity. There is no new impulse bus.
- Knockback parameters are content-owned, so game design can tune the feel of contact hits through data rather than system edits.
- `HealthDeathSystem` receives contact damage through the same mechanism as projectile damage; player death through the session-level hook works for both sources.
- The boss in 006 does not need a separate contact mechanic. It only needs fields on `BossArchetype` and the same phase code.
- The lack of sweep collision and the "do not tunnel through the player" requirement become checks for content/builders, not runtime behavior.
- If contact later gains a `hit`-like event for sound or visuals, that will extend [snapshot-shape.md](snapshot-shape.md), not revise this decision.

## Related

- [runtime-systems.md](runtime-systems.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [health-and-death.md](health-and-death.md)
- [content-archetypes.md](content-archetypes.md)
- [snapshot-shape.md](snapshot-shape.md)
- [logging.md](logging.md)
- [body-contact-boxes.md](body-contact-boxes.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
- [impact-feedback.md](impact-feedback.md)
