# Companion Combat

- Status: accepted
- Created: 2026-04-29
- Updated: 2026-04-29 (follow-up: a living damaged companion may seek nearby heal drops and pick up only that drop effect through `DropSystem`; player-only modifier drops stay player-only.)

## Context

Story 029 made the selected pet a renderer-only companion. Story 030 turns that pet into a combat participant when the current session opts in.

That changes the boundary: a selected pet can no longer stay as hidden main-thread presentation state once it affects targeting, HP, damage, rescue, or projectile ownership. The simulation must receive an explicit companion definition as part of `SessionDefinition`, while the pet collection still stays progression-only and must not become a permanent combat power source.

The companion also has a special death rule. Enemy and boss deaths remove entities; companion defeat should instead become a ghost state that remains near the player and can be rescued.

## Decision

### Session ownership

`SessionDefinition` owns whether a runtime companion exists:

```ts
type CompanionSessionConfig = Readonly<{
  petArchetypeId: string;
  maxHp: number;
  contactBox: ContactBox;
  movement: CompanionMovementConfig;
  threat: CompanionThreatConfig;
  weaponLoadout: Loadout | null;
  boop: CompanionBoopConfig;
  rescue: CompanionRescueConfig;
}>;
```

`SessionDefinition.companion` is `CompanionSessionConfig | null`.

- `null` means the session has no runtime companion.
- The session builder may create this config from the selected pet id only when the run supports companion combat.
- `petArchetypeId` is presentation identity only. Pet archetypes do not receive HP, damage, cooldown, speed, weapon, rescue, or boop stats.
- `maxHp`, `weaponLoadout`, contact shape, movement tuning, boop tuning, and rescue tuning are session values.
- If `weaponLoadout` is `null`, the companion has no weapon attack in that run.

### Session authoring

The selected pet id is never authored in session MD. It comes from client progression at run start.

Companion-enabled presets may add an optional `# Companion` field table in `content/sessions/<presetId>.md`. If the section is absent or `enabled` is `false`, the builder emits `companion: null`.

When `enabled` is `true`, the builder emits `companion: null` if no selected pet is available; otherwise it builds `CompanionSessionConfig` by combining the selected `petArchetypeId` with the table's session tuning.

Initial field names:

- `enabled`
- `maxHp`
- `contactBoxWidth`
- `contactBoxHeight`
- `movementMaxSpeed`
- `movementAcceleration`
- `movementOrbitRadius`
- `threatAcquireRadius`
- `threatReleaseRadius`
- `weaponLoadoutIds`
- `weaponSelectedIndex`
- `boopRadius`
- `boopImpulse`
- `boopDurationMs`
- `boopCooldownMs`
- `rescueRadius`
- `rescueDurationMs`
- `rescueReviveHpFraction`

`weaponLoadoutIds: none` plus `weaponSelectedIndex: none` means no companion weapon for this preset. Any non-`none` weapon list follows the normal `Loadout` validation rules.

### Runtime entity

When `SessionDefinition.companion` is present, the session starts with one `kind: 'companion'` entity.

The companion runtime state includes:

- `id`
- `kind: 'companion'`
- `petArchetypeId`
- position and velocity
- `contactBox`
- `hp` and `maxHp`
- `state: 'alive' | 'ghost'`
- `mode: 'rest' | 'guard' | 'alert' | 'engage' | 'rescue' | 'ghost'`
- current `targetId`, when a valid threat is acquired
- rescue progress
- boop cooldown state
- copied session movement, threat, boop, and rescue tuning

The companion is a runtime entity, not a renderer-only follower, in companion-enabled sessions.

### CompanionSystem

`CompanionSystem` is a new simulation system that runs after `MovementSystem` and before `CombatSystem`.

It owns:

- companion behavior mode selection
- deterministic threat acquisition
- deterministic heal-drop seeking when alive and damaged
- inertial companion movement
- companion aim intent for `CombatSystem`
- protective boop impulses
- ghost follow behavior
- rescue channel progress and completion

It does not own projectile creation, projectile hit tests, or HP mutation from damage intents.

### Movement and behavior

Companion movement is velocity-based and uses acceleration limits from the session config. The companion never teleports or instantly flips its movement vector to follow the player.

Modes:

- `rest`: used outside active combat pressure, especially between waves. The companion stays near the player and lets presentation handle soft idle motion.
- `guard`: used during active waves when no valid threat is close enough. The companion follows an orbit/guard position around the player with spring-like correction and tangential motion.
- `alert`: a short warning state when a new threat is acquired.
- `engage`: the companion tracks a selected threat and provides aim intent to `CombatSystem` when alive and armed.
- `ghost`: the downed companion stays near the player, cannot aim or fire, and may still boop.
- `rescue`: while the player remains inside the rescue radius, rescue progress advances. Leaving the radius cancels or resets progress according to the session rescue config.

Threat acquisition is deterministic: choose the nearest enemy or boss inside the acquisition radius, with entity id as the tie breaker. A release radius prevents target flicker.

When the companion is `alive` and `hp < maxHp`, it may temporarily prioritize the nearest `heal` drop inside its threat acquisition radius before hostile engagement. The search uses `DropEffect.kind === 'heal'`, distance from the companion, `threatAcquireRadius` as the search radius, and entity id as the tie breaker. While moving toward the heal drop, the companion clears its hostile `targetId`; this prevents weapon fire from hiding the fact that it is retreating to recover. No new snapshot mode is introduced for heal seeking: renderer can continue to show the existing rest/guard/engage presentation.

Look-around flips, idle personality timing, ghost shimmer, and rescue flip rate are presentation details. They may vary by `petArchetypeId`, but they must not affect simulation.

### Combat integration

`CombatSystem` supports `ownerKind: 'companion'` for shooter weapons and runtime fire events.

- Companion weapon instances are owner-local, just like player/enemy/boss weapon instances.
- Companion weapon instances are registered only when `SessionDefinition.companion.weaponLoadout` is not `null`.
- The companion can fire only while `state === 'alive'`.
- Entering `ghost` disables companion weapon firing without deleting the session-defined loadout.
- Rescue restores firing only if the session-defined loadout exists.

Damage rules gain one friendly alliance:

- `player` and `companion` are friendly to each other.
- Player-owned projectiles and explosions cannot damage the companion.
- Companion-owned projectiles and explosions cannot damage the player or companion.
- Enemy and boss attacks can damage the companion unless an explicit future rule says otherwise.
- Companion projectiles can damage enemies and bosses.
- Existing enemy friendly-fire rules remain governed by `rules.damage.slimeFriendlyFire`.

### Boop

Boop is not damage.

When the boop cooldown is ready and a hostile target is inside the boop radius, `CompanionSystem` applies an impulse/knockback state to the target and emits a presentation event. The impulse points away from the player when possible, with a companion-relative fallback for degenerate positions.

Boop works in both `alive` and `ghost` states. Target susceptibility still uses the existing knockback scale rules for enemies and bosses.

### HP, ghost state, and rescue

The companion is damageable, but HP reaching zero does not use the normal removable death path.

For `kind: 'companion'`, `HealthDeathSystem` clamps HP to zero, changes state to `ghost`, clears active weapon firing, and emits a companion downed event. It does not emit a normal `death` event, run enemy/boss death hooks, increment kill counters, spawn drops, or remove the companion entity.

`CompanionSystem` owns rescue:

- rescue can progress only while the companion is `ghost`
- the player must remain inside the configured rescue radius
- progress completes after the configured channel duration
- completion changes state back to `alive`
- HP becomes the configured revived HP value
- the companion may use its weapon again if the session loadout exists
- a companion rescued event is emitted for presentation/audio

### Snapshot and presentation

`SnapshotExportSystem` adds `CompanionSnapshot`:

```ts
type CompanionSnapshot = Readonly<{
  id: EntityId;
  kind: 'companion';
  petArchetypeId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  state: 'alive' | 'ghost';
  mode: 'rest' | 'guard' | 'alert' | 'engage' | 'rescue' | 'ghost';
  rescueProgress: number | null;
  targetId: EntityId | null;
}>;
```

Runtime events gain:

- `companionBoop`
- `companionDowned`
- `companionRescued`

Existing `hit` events may use `targetKind: 'companion'` for friendly slime hit feedback.

The renderer draws companion visuals from `petArchetypeId` and the existing pet visual registry. The in-world companion HP bar is presentation owned and reads from `CompanionSnapshot.hp/maxHp`.

### Heal drop pickup

`CompanionSystem` owns the decision to move toward a nearby heal drop. `DropSystem` remains the only system that applies `DropEffect`, removes the drop, reports pickup facts, and emits `dropPickup`.

A companion can pick up only `DropEffect.kind === 'heal'`, only while `state === 'alive'`, and only while `hp < maxHp`. Weapon modifier, temporary overdrive, and pickup modifier drops remain player-only. A ghost companion cannot heal from drops; it must be rescued through the rescue rule above.

## Consequences

- Companion combat is deterministic and worker-authoritative.
- Selected pet identity can influence visuals/personality without becoming a hidden stat source.
- Session authors can turn companion combat on/off and choose whether the pet is armed for a specific run.
- The regular death/removal model remains intact for enemies, bosses, and the player, with an explicit companion downed exception.
- Renderer-only pet following from story 029 is superseded for companion-enabled sessions.

## Related

- [content-boundaries.md](content-boundaries.md)
- [content-archetypes.md](content-archetypes.md)
- [content-authoring.md](content-authoring.md)
- [session-definition.md](session-definition.md)
- [runtime-systems.md](runtime-systems.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [health-and-death.md](health-and-death.md)
- [snapshot-shape.md](snapshot-shape.md)
- [enemy-contact.md](enemy-contact.md)
- [sprite-assets.md](sprite-assets.md)
- [body-contact-boxes.md](body-contact-boxes.md)
- [impact-feedback.md](impact-feedback.md)
- [main-ui-shell.md](main-ui-shell.md)
- [session-result-summary.md](session-result-summary.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)
- [non-player-firing.md](non-player-firing.md)
- [combat-modifiers-and-field-effects.md](combat-modifiers-and-field-effects.md)
- [../stories/030-companion-combat-and-rescue.md](../stories/030-companion-combat-and-rescue.md)
