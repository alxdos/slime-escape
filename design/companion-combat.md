# Companion Combat

- Status: accepted
- Created: 2026-04-29
- Updated: 2026-05-01 (story 037 prep: move companion ownership from `SessionDefinition.companion` (single per session) into `PlayerConfig.companion` (one per actor) — each controlled actor in `players[]` may carry its own `CompanionSessionConfig` or `null`. `CompanionSystem` learns multi-companion iteration: per-actor companions run their orbit/threat/engage/ghost/heal-seek logic independently, each pinned to its owning `playerId` rather than to "the nearest player". The shared rescue-progress handler in `CompanionSystem` now drives both companion rescue and player rescue (when `SessionDefinition.playerCoopRevive` is non-null, [session-definition.md](session-definition.md)) — same proximity+duration mechanic, different tuning sources, different completion paths (`companionRescued` vs `playerRevived` from [snapshot-shape.md](snapshot-shape.md)). Owner ghost-state behavior recorded explicitly: when an owner flips to `state: 'ghost'`, the companion's owner reference does not change — orbit/ghost positions follow the ghost owner exactly as they followed the alive owner; the companion does not retarget to a different player and does not enter its own ghost state because of owner ghost transition. Damage rules extended: `playerVsPlayerDamage` from `SessionRules` ([session-definition.md](session-definition.md), [projectiles-and-combat.md](projectiles-and-combat.md)) gates damage between team-A and team-B, where a "team" is one player and that player's companion. With `playerVsPlayerDamage: false`, all `(player, companion)` pairs in the session form one effective friendly group; with `true`, each pair is its own team. Earlier: 2026-04-29 follow-up: a living damaged companion may seek nearby heal drops and pick up only that drop effect through `DropSystem`; player-only modifier drops stay player-only.)

## Context

Story 029 made the selected pet a renderer-only companion. Story 030 turns that pet into a combat participant when the current session opts in.

That changes the boundary: a selected pet can no longer stay as hidden main-thread presentation state once it affects targeting, HP, damage, rescue, or projectile ownership. The simulation must receive an explicit companion definition as part of `SessionDefinition`, while the pet collection still stays progression-only and must not become a permanent combat power source.

The companion also has a special death rule. Enemy and boss deaths remove entities; companion defeat should instead become a ghost state that remains near the player and can be rescued.

## Decision

### Per-actor ownership

A runtime companion belongs to a specific controlled actor and is owned through that actor's `PlayerConfig.companion` field ([session-definition.md](session-definition.md)):

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

`PlayerConfig.companion` is `CompanionSessionConfig | null`. The previous top-level `SessionDefinition.companion` field is removed.

- `null` means this actor has no runtime companion in this session.
- The session builder may create this config from the selected pet id only when the run supports companion combat.
- `petArchetypeId` is presentation identity only. Pet archetypes do not receive HP, damage, cooldown, speed, weapon, rescue, or boop stats.
- `maxHp`, `weaponLoadout`, contact shape, movement tuning, boop tuning, and rescue tuning are session values.
- If `weaponLoadout` is `null`, the companion has no weapon attack in that run.
- For sessions where `players.length === 1` (every existing local preset), the single actor's `companion` field carries exactly the configuration the previous top-level `SessionDefinition.companion` carried; behaviour is unchanged. Multi-actor sessions (story 037 online co-op) may have different `companion` values per actor — typically the same tuning fanned out to every actor whose client provided a `selectedPetId`, with `null` for actors who did not.

### Session authoring

The selected pet id is never authored in session MD. It comes from client progression at run start (local play) or from each connected client's join handshake (online play, see [online-session-hosting.md](online-session-hosting.md)).

Companion-enabled presets may add an optional `# Companion` field table in `content/sessions/<presetId>.md`. The table is **session-level template tuning** — one set of values shared by every actor in the session that has a companion. If the section is absent or `enabled` is `false`, the builder emits `companion: null` for every actor in `players[]`.

When `enabled` is `true`:
- For local single-player presets, the builder emits `players[0].companion = null` if no selected pet is available; otherwise it builds `CompanionSessionConfig` by combining the selected `petArchetypeId` with the table's tuning.
- For online co-op sessions (story 037), the builder fans the same template tuning out per actor: each actor whose join handshake included a `selectedPetId` gets `companion = { ...templateTuning, petArchetypeId: <that pet> }`; actors without a selected pet get `companion: null`. There is exactly one place to author "the companion tuning shared by everyone" — the session-level `# Companion` table — and per-actor pet identity is sourced live from clients, not authored.

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

For every actor in `SessionDefinition.players[]` whose `companion` is non-null, the session starts one `kind: 'companion'` entity owned by that actor. Sessions may therefore start zero, one, or many companion entities (one per actor with a non-null companion config). For local single-player this is unchanged from the previous shape — exactly one companion entity exists for the single actor.

The companion runtime state includes:

- `id`
- `kind: 'companion'`
- `ownerPlayerId: string` — the `PlayerConfig.id` this companion belongs to. Stable for the lifetime of the companion entity; the companion does not migrate between owners.
- `petArchetypeId`
- position and velocity
- `contactBox`
- `hp` and `maxHp`
- `state: 'alive' | 'ghost'`
- `mode: 'rest' | 'guard' | 'alert' | 'engage' | 'rescue' | 'ghost'`
- current `targetId`, when a valid threat is acquired
- rescue progress
- boop cooldown state
- copied per-actor movement, threat, boop, and rescue tuning

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
- rescue channel progress and completion (for both companion-rescue and player-rescue)

In multi-companion sessions ([session-definition.md](session-definition.md)), the system iterates the per-actor companions in deterministic order (by `ownerPlayerId` ascending lexicographic) and runs each companion's logic independently. Cross-companion interaction is limited to spatial-index queries (companion A may threat-acquire an enemy that companion B is also engaging — both are valid; per-companion target choice is independent and follows the existing entity-id tie-break).

It does not own projectile creation, projectile hit tests, or HP mutation from damage intents.

### Movement and behavior

Companion movement is velocity-based and uses acceleration limits from the session config. The companion never teleports or instantly flips its movement vector to follow the player.

Modes (every "the player" reference resolves to the companion's `ownerPlayerId`, **not** to "the nearest player from `players[]`"):

- `rest`: used outside active combat pressure, especially between waves. The companion stays near its owner and lets presentation handle soft idle motion.
- `guard`: used during active waves when no valid threat is close enough. The companion follows an orbit/guard position around its owner with spring-like correction and tangential motion.
- `alert`: a short warning state when a new threat is acquired.
- `engage`: the companion tracks a selected threat and provides aim intent to `CombatSystem` when alive and armed.
- `ghost`: the downed companion stays near its owner, cannot aim or fire, and may still boop.
- `rescue`: while a living player remains inside the rescue radius, rescue progress advances. The rescuer does not have to be the companion's owner — any living player may rescue a downed companion regardless of ownership. Leaving the radius cancels or resets progress according to the session rescue config.

When a companion's owner enters `state: 'ghost'` ([snapshot-shape.md](snapshot-shape.md), `lossCondition: 'allPlayersDead'`), the companion's owner reference is unchanged; orbit and ghost-follow positions track the ghost owner exactly as they tracked the alive owner. The companion does not retarget to a different live player and does not enter its own ghost mode merely because of the owner's transition. The companion may still boop, threat-acquire, and engage hostile entities to defend the ghosted owner — gameplay-wise, the companion "guards" its downed owner until either the owner is revived (companion resumes normal flow) or all actors fall (run ends in `loss`).

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

Damage rules gain a team-based friendly model that scales from single-player through PvP to co-op:

- A **team** is one player plus that player's companion. In multi-actor sessions there is one team per actor in `players[]` (each pair `(playerEntity, companionEntity)` keyed by `ownerPlayerId`); actors without a companion still form a one-member team.
- Same-team friendly fire is always off: a player cannot damage their own companion through projectiles or explosions; a companion cannot damage its own owner.
- Different-team interactions are governed by `SessionRules.damage.playerVsPlayerDamage` ([session-definition.md](session-definition.md)):
  - `playerVsPlayerDamage: false` (online co-op default, story 037): every team is friendly to every other team. Player A's projectiles cannot damage player B or companion B; companion A's projectiles cannot damage player B or companion B. Effectively all `(player, companion)` pairs in the session are one combined friendly group.
  - `playerVsPlayerDamage: true` (PvP arena, story 036; also valid for any future PvP session content): each team is hostile to every other team. Player A's projectiles can damage player B and companion B; companion A's projectiles can damage player B and companion B. Same-team friendly fire is still off regardless of this flag.
- Enemy and boss attacks can damage any team's player or companion. Existing enemy friendly-fire rules remain governed by `rules.damage.slimeFriendlyFire`.
- Player and companion projectiles can damage enemies and bosses.
- The shared damage-rule helper ([projectiles-and-combat.md](projectiles-and-combat.md)) is the single read site for both `slimeFriendlyFire` and `playerVsPlayerDamage`. Systems must not branch on these flags directly.

### Boop

Boop is not damage.

When the boop cooldown is ready and a hostile target is inside the boop radius, `CompanionSystem` applies an impulse/knockback state to the target and emits a presentation event. The impulse points away from the player when possible, with a companion-relative fallback for degenerate positions.

Boop works in both `alive` and `ghost` states. Target susceptibility still uses the existing knockback scale rules for enemies and bosses.

### HP, ghost state, and rescue

The companion is damageable, but HP reaching zero does not use the normal removable death path.

For `kind: 'companion'`, `HealthDeathSystem` clamps HP to zero, changes state to `ghost`, clears active weapon firing, and emits a companion downed event. It does not emit a normal `death` event, run enemy/boss death hooks, increment kill counters, spawn drops, or remove the companion entity.

#### Shared rescue handler

`CompanionSystem` hosts a single rescue-progress handler that drives both companion-rescue (this file) and player-rescue (under `SessionDefinition.playerCoopRevive`, [session-definition.md](session-definition.md)). The handler reads the relevant rescue tuning per ghost target:

- For ghost companions, tuning comes from each companion's owner-pinned `PlayerConfig.companion.rescue` (`rescueRadius`, `rescueDurationMs`, `rescueReviveHpFraction`).
- For ghost players, tuning comes from `SessionDefinition.playerCoopRevive` (same field names, session-wide values).

Both share one mechanic:

- rescue can progress only while the target is `ghost` (companion) or `state === 'ghost'` (player);
- a living player must remain inside the configured rescue radius around the ghost target;
- per-rescuer progress accumulates over continuous proximity time; multiple rescuers contribute independent progress against the same target, and the first rescuer to reach the duration triggers completion;
- leaving the radius or the rescuer falling cancels that rescuer's progress;
- on completion: ghost target transitions to `alive` (companion → existing rules; player → `state: 'alive'` per [snapshot-shape.md](snapshot-shape.md)) with HP set per the corresponding `reviveHpFraction`;
- the appropriate event fires (`companionRescued` for companion targets, `playerRevived` for player targets, both per [snapshot-shape.md](snapshot-shape.md)).

Companion-specific completion details (the companion may use its weapon again if the session loadout exists) are unchanged. Player-specific completion: the player's `RuntimeInputState` slot resumes the full input set ([input-commands.md](input-commands.md)) — no other state is touched.

#### Companion-rescuer constraints

A companion **does not** rescue (companions are not rescuers). Rescuers are always alive players. The reverse is fine: any living player may rescue any ghost target — companion or player — regardless of ownership; in particular a player can rescue another player's companion.

When a session has `playerCoopRevive: null`, the handler simply skips ghost-player targets and runs unchanged for ghost companions. When a session has no companions, the handler runs unchanged for ghost players. When both are absent, the handler is a no-op.

### Snapshot and presentation

`SnapshotExportSystem` adds `CompanionSnapshot`:

```ts
type CompanionSnapshot = Readonly<{
  id: EntityId;
  kind: 'companion';
  ownerPlayerId: string;
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

`ownerPlayerId` (story 037) is the `PlayerConfig.id` of this companion's owner. Local single-player consumers can ignore the field; multi-companion online consumers (renderer, HUD) use it to draw owner-relative affordances and to find the companion belonging to the local player. The field is required even in single-player sessions to keep the snapshot shape consistent across modes.

Runtime events gain:

- `companionBoop`
- `companionDowned`
- `companionRescued`
- `playerDowned` (story 037, [snapshot-shape.md](snapshot-shape.md)) — published by `HealthDeathSystem` for the player ghost transition; consumers in this file are presentation-only.
- `playerRevived` (story 037, [snapshot-shape.md](snapshot-shape.md)) — published by the shared rescue handler in `CompanionSystem` for both companion-rescue (`companionRescued`) and player-rescue paths.

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
- [input-commands.md](input-commands.md)
- [online-session-hosting.md](online-session-hosting.md)
- [online-lobby.md](online-lobby.md)
- [../stories/030-companion-combat-and-rescue.md](../stories/030-companion-combat-and-rescue.md)
- [../stories/037-coop-vs-slimes.md](../stories/037-coop-vs-slimes.md)
