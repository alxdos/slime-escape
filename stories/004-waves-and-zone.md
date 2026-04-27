# Waves and Dark Zone

- Status: done
- Created: 2026-04-19
- Updated: 2026-04-19 (story closed; all Tasks completed, contracts honoured, tests pass)

## Player-facing

- Sees: a training mode of 1–2 waves with breaks; during a wave the visible arena shrinks linearly under the dark zone, during a break it expands back. After contact with an enemy the player pushes the enemy away — the stronger the velocity-vector collision, the farther the bounce.
- Can do: clear the waves and survive (win) or die (loss); see transitions between encounters.

## Technical

- `EncounterDefinition` of type `wave` and `break` in `SessionDefinition`; formalised `ZoneBehavior` and `TransitionRules` — per [../design/session-definition.md](../design/session-definition.md).
- `SpawnPlan` extends with the `'wave'` kind (counted spawn budget, pace, alive cap, perimeter positions via session RNG) — per [../design/spawn-plan.md](../design/spawn-plan.md).
- `SessionFlowSystem` grows to support encounter transitions, publishing `win`/`loss`, and a session-level player-death hook — per [../design/runtime-systems.md](../design/runtime-systems.md), [../design/session-definition.md](../design/session-definition.md), [../design/health-and-death.md](../design/health-and-death.md).
- `ZoneSystem` arrives as a new module with a scalar `margin` and `disabled`/`shrinkLinear`/`expandLinear` modes — per [../design/zone.md](../design/zone.md).
- `MovementSystem` supports `behavior: 'chase'`; `EnemyArchetype` gains `maxSpeed`/`contactDamage`/`contactCooldownMs` — per [../design/content-archetypes.md](../design/content-archetypes.md).
- Contact damage from enemies — a new phase in `CombatSystem`, `DamageIntent.source: 'enemyContact'`, per-enemy cooldown — per [../design/enemy-contact.md](../design/enemy-contact.md), [../design/health-and-death.md](../design/health-and-death.md).
- Knockback enemy ← away from the player on every successful contact damage (direction `enemy − player`, speed weighted by `approachSpeed` of the relative velocity, monotonically non-increasing decay over `knockbackDurationMs`); parameters live as `EnemyArchetype` fields — per [../design/enemy-contact.md](../design/enemy-contact.md), [../design/content-archetypes.md](../design/content-archetypes.md).
- The player becomes damageable: `PlayerSpawn.maxHp`, `Player.hp/maxHp` in `EntityStore`, `PlayerSnapshot.hp/maxHp` — per [../design/content-archetypes.md](../design/content-archetypes.md), [../design/snapshot-shape.md](../design/snapshot-shape.md).
- The snapshot extends with top-level `encounter`, `zone`, `waveProgress` and runtime events `win`/`loss` — per [../design/snapshot-shape.md](../design/snapshot-shape.md).
- Session RNG (`mulberry32` seeded by `seed`) appears as the only source of randomness in `sim`; used by `SpawnSystem` to pick perimeter positions — per [../design/rng.md](../design/rng.md).
- Content: a new `ModePreset = 'training'` (`wave1 → break → wave2`), enemy archetypes with `behavior: 'chase'` and contact damage — data only in the content library, not system changes; preset-id boundaries stay in [../design/session-definition.md](../design/session-definition.md).
- Win condition: `allEncountersComplete`. Loss condition: `playerDeath`.

## Out of scope

- Final boss fight — `006`.
- Drops — `005`.
- Full wave/timer HUD and result screen — `007`. For 004 it is enough to have a debug indicator with the current encounter, wave progress, and HP in the corner of the screen, and to have the snapshot carry the right fields with `win`/`loss` reaching main.
- Enemy AI firing and ballistic attacks — `006`.
- Visual smoothing of the zone (rounded corners, gradient feather, colour, blur) — a renderer detail and not part of the zone design contract (see [../design/zone.md](../design/zone.md)); the concrete implementation lives in the renderer.
- Sweep collision for fast enemies — postponed as a "content contract" in [../design/enemy-contact.md](../design/enemy-contact.md).

## Acceptance

- Starting the training `ModePreset` starts the first wave: the first encounter is active, `encounter.type === 'wave'`, `zone.mode` matches the wave `zoneBehavior`, `waveProgress` is available in the snapshot.
- Enemies spawn per `spawnPlan`: spawn interval (`spawnIntervalMs`) and alive cap (`maxAlive`) are honoured; positions sit on the arena perimeter and are deterministic given the `seed`.
- The dark zone shrinks linearly during a wave (`shrinkLinear`) and expands during a break (`expandLinear`); `margin` in the snapshot grows or shrinks linearly over `durationMs` and is clamped at `toMargin`.
- Encounter → encounter transitions follow `transitionRules`: a wave ends when `dispatched == total && enemiesAliveFromThisWave == 0`; a break ends on `timer`. The transition publishes `encounterEnd` of the old encounter and `encounterStart` of the new one.
- When the last encounter completes, exactly one `win` event is published; runtime state resets and the clock returns to idle.
- When the player dies, exactly one `loss` event is published; further ticks do not run; a repeat death/contact does not produce a second `loss`.
- Contact damage from an enemy reduces `player.hp` by exactly `enemy.contactDamage`; another hit from the same enemy is allowed at most once per `enemy.contactCooldownMs`.
- Every successful contact damage pushes the enemy away from the player: for `knockbackDurationMs` the enemy moves with monotonically non-increasing speed in the direction `normalize(enemy.position − player.position)`; the starting speed depends on `approachSpeed` (clamped at zero); during knockback the enemy's regular `behavior` is suppressed. The player is not pushed. A repeat contact after `contactCooldownMs` overwrites the knockback rather than stacking it.
- Starting a training session twice with the same `seed` produces an identical sequence of spawns (archetype order and positions).
- All combat systems, `ZoneSystem`, `SpawnSystem`, and encounter transitions only run while a session is active; `stopSession` resets their state and leaves no entity leaks.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Extend the public contracts in `src/shared/**`: `session.ts` (`ZoneBehavior` union, `TransitionRules` union with a `next` field, `WaveSpawnPlan`, mandatory `PlayerSpawn.maxHp`), `snapshot.ts` (`PlayerSnapshot.hp/maxHp`, top-level `encounter`/`zone`/`waveProgress`), `events.ts` (`win`/`loss`), `content/enemies.ts` (`EnemyBehavior` union with `'chase'`, `maxSpeed`, `contactDamage`, `contactCooldownMs`, `knockbackBaseImpulse`, `knockbackVelocityScale`, `knockbackDurationMs`). Shapes and `assertNever`-ready unions only; system implementation lives in separate tasks. | basis: `design/session-definition.md`, `design/snapshot-shape.md`, `design/spawn-plan.md`, `design/content-archetypes.md`, `design/zone.md`, `design/enemy-contact.md` |
| T2 | [x] | `src/shared/rng.ts`: `mulberry32` seeded from `seed`, public `Rng` API (`nextUint32`/`nextFloat`/`nextInt`/`nextRange`); ban `Math.random` in `src/sim/**` outside this file. `Rng` is created in `SessionFlowSystem.start` from `SessionDefinition.seed` and forwarded to `SpawnSystem` as an explicit dependency. Reproducibility test: same `seed` → same sequence. | basis: `design/rng.md`, `design/session-definition.md` |
| T3 | [x] | Content: new enemy archetypes in `src/shared/content/enemies.ts` — `slime-fast` (fast, low HP, medium contact damage, light knockback that flies far) and `slime-tank` (slow, more HP, higher contact damage, short and weak knockback); `behavior: 'chase'`, valid `maxSpeed`/`contactDamage`/`contactCooldownMs`/`knockbackBaseImpulse`/`knockbackVelocityScale`/`knockbackDurationMs`. `PlayerSpawn` (in `players.ts`) gets `maxHp`. The existing `training-target` is updated with zero knockback fields. Honour the "no touring through the player" constraints and `'stationary' ⇒ maxSpeed === 0 && contactDamage === 0 && knockbackBaseImpulse === 0 && knockbackVelocityScale === 0` on the content/builder side, with a warning via `log.warn`. | basis: `design/content-archetypes.md`, `design/enemy-contact.md`, `design/logging.md` |
| T4 | [x] | Content: a `'training'` `ModePreset` and its builder in `src/shared/content/buildSession.ts` with the structure `wave1 → break → wave2` (two `WaveSpawnPlan` + one `break` with `transitionRules: { kind: 'timer' }`), `zoneBehavior` for `wave` (`shrinkLinear`) and `break` (`expandLinear`), `loadout: { primaryWeaponArchetypeId: PISTOL.id }`, `winCondition: { kind: 'allEncountersComplete' }`, `lossCondition: { kind: 'playerDeath' }`. The existing `sandbox` and `sandbox-with-combat` presets must keep working. The concrete wave/zone numbers live inside the builder/content. | basis: `design/session-definition.md`, `design/spawn-plan.md`, `design/zone.md`, `design/content-archetypes.md` |
| T5 | [x] | `EntityStore`: `Player` gains `hp`/`maxHp` (from `SessionDefinition.player.maxHp`) and runtime `velocity: { vx, vy }`; `Enemy` gains `maxSpeed`, `contactDamage`, `contactCooldownMs`, `nextContactSimMs`, runtime `velocity: { vx, vy }`, and an optional `knockback: { vx, vy, startSimMs, endSimMs } | null`. `MovementSystem`: for `behavior: 'chase'` move the enemy towards the player at `maxSpeed`, write the actual `velocity` into `Enemy`; write `velocity` into `Player` (`input.moveDir * player.maxSpeed`); while `simTime < enemy.knockback.endSimMs` the enemy's regular `behavior` is suppressed and the position is moved by a monotonically non-increasing (e.g. linear) decaying knockback velocity without arena clamping; once knockback ends, regular `behavior` resumes. For `'stationary'` the behaviour is unchanged. Tolerant to `player === null`: `MovementSystem` is a no-op without a player. | basis: `design/runtime-systems.md`, `design/health-and-death.md`, `design/enemy-contact.md`, `design/arena-and-coordinates.md` |
| T6 | [x] | `SpawnSystem`: implement the `'wave'` kind per `design/spawn-plan.md`. Per-tick dispatch with the conditions `dispatched < total && aliveFromThisPlan < maxAlive && simTime − lastSpawnSimMs >= spawnIntervalMs`; pick a perimeter position via session RNG (one `nextFloat` per spawn, a normalised perimeter coordinate, contracted by `edgeMargin + archetype.radius`); an internal `Set<EntityId>` tracks "own" entities, with a death-hook subscription for `aliveFromThisPlan`; state resets on `encounterEnd`; `assertNever` for an unknown `kind`. | basis: `design/spawn-plan.md`, `design/rng.md`, `design/health-and-death.md` |
| T7 | [x] | `CombatSystem`: a new contact-intent phase between `lifetime cleanup` and `hit detection` per `design/enemy-contact.md`. SpatialIndex as an accelerator; circle-vs-circle overlap player↔enemy; per-enemy `nextContactSimMs`; build `DamageIntent` with `source.kind: 'enemyContact', enemyId`; one intent list per tick. At the same time as each intent, initiate knockback on the enemy: `normal = normalize(enemy.position − player.position)` (zero-distance fallback — `normalize(enemy.velocity)`, otherwise `(1,0)`); `approachSpeed = max(0, dot(player.velocity − enemy.velocity, normal))`; `impulseSpeed = knockbackBaseImpulse + knockbackVelocityScale * approachSpeed`; `enemy.knockback = { vx: impulseSpeed * normal.x, vy: impulseSpeed * normal.y, startSimMs: simTime, endSimMs: simTime + knockbackDurationMs }` (a repeat overwrites, does not stack). Tolerant to `player === null` (phase is a no-op). No new runtime events. | basis: `design/enemy-contact.md`, `design/projectiles-and-combat.md`, `design/runtime-systems.md` |
| T8 | [x] | `HealthDeathSystem`: apply `enemyContact` intents through the same path as `projectile`; the player gains `HasHealth` through `EntityStore`; the rule "a repeat intent against a target already dead this tick is ignored" applies to the player too. Tolerant to `EntityStore.player() === null` after removal. | basis: `design/health-and-death.md`, `design/runtime-systems.md` |
| T9 | [x] | `ZoneSystem` as a new module `src/sim/ZoneSystem.ts` per `design/zone.md`: state `mode/margin/elapsedMs/from/to/duration`, initialised from `encounter.zoneBehavior` on `encounterStart`, linear interpolation with clamping, reset on `encounterEnd`, exported into the snapshot via an explicit `zone()` getter. Wired into the update order before `SnapshotExportSystem`. No damage and no events. | basis: `design/zone.md`, `design/runtime-systems.md`, `design/simulation-timing.md` |
| T10 | [x] | `SessionFlowSystem`: encounter transitions per `transitionRules` (`never`/`allEnemiesCleared`/`timer`) with the rule `next: 'sequential' | byId`; a single check per tick after `HealthDeathSystem` and before `SnapshotExportSystem`; publish `encounterEnd`/`encounterStart` for the transition within one tick; finish the run on `winCondition: allEncountersComplete` (publish `win`) and on the session-level player-death hook firing (publish `loss`); reset runtime state and move the clock to idle on win/loss; further input/pause/resume after win/loss → `log.warn`. | basis: `design/session-definition.md`, `design/runtime-systems.md`, `design/health-and-death.md`, `design/snapshot-shape.md`, `design/logging.md` |
| T11 | [x] | `SnapshotExportSystem`: top-level `encounter` (id, type, index, elapsedMs), `zone` (mode, margin), `waveProgress` (dispatched/total/alive for a wave encounter; `null` for the rest), `PlayerSnapshot.hp/maxHp`. Sources: `SessionFlowSystem` (encounter), `ZoneSystem.zone()`, `SpawnSystem.waveProgress()`, `EntityStore.player()`. Pure aggregation, no gameplay logic. | basis: `design/snapshot-shape.md`, `design/zone.md`, `design/spawn-plan.md` |
| T12 | [x] | `Renderer` (main): render chase enemies (colour/radius from `EnemyArchetype`); render the dark zone as an overlay quad with a fragment shader (SDF rounded box, `cornerRadius = 0.25 * arena.height`, fixed gradient feather width); a debug text overlay with `encounter.id/type/index`, `waveProgress.dispatched/total/alive`, and `player.hp/maxHp`. Numeric zone visuals live in the renderer, not in `design/` and not in the content library. | basis: `design/zone.md`, `design/snapshot-shape.md`, `design/thread-model.md`, `design/arena-and-coordinates.md` |
| T13 | [x] | Tests for the contract per `design/testing.md`: `SpawnSystem` for `'wave'` honours `spawnIntervalMs` and `maxAlive`; a wave encounter ends on `dispatched == total && alive == 0`; linear interpolation of `margin` over `durationMs` and clamping; the transition `wave → break → wave → win` on a synthetic clock; exactly one `loss` on player death; a repeat intent on the dead player does not publish a second `loss`; the same `seed` → the same `(archetypeId, position)` spawn list; contact damage from an enemy initiates knockback in the direction `enemy − player` with `impulseSpeed` consistent with the formula; `approachSpeed = 0` on a "grazing" hit yields exactly `knockbackBaseImpulse`; during knockback the enemy's regular `behavior` is suppressed and the decay is monotonically non-increasing to zero; a repeat contact overwrites the knockback rather than stacking it. | basis: `design/testing.md`, `design/spawn-plan.md`, `design/zone.md`, `design/health-and-death.md`, `design/rng.md`, `design/enemy-contact.md` |
| T14 | [x] | Closing the story: closing checklist (see `stories/README.md`); verify that `Index` in `design/README.md` is still up to date; move the story `Status` to `done` and update the table in `stories/README.md`. | architect |

## Related

- [../design/session-definition.md](../design/session-definition.md)
- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../design/spawn-plan.md](../design/spawn-plan.md)
- [../design/zone.md](../design/zone.md)
- [../design/enemy-contact.md](../design/enemy-contact.md)
- [../design/rng.md](../design/rng.md)
- [../design/content-archetypes.md](../design/content-archetypes.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/projectiles-and-combat.md](../design/projectiles-and-combat.md)
- [../design/health-and-death.md](../design/health-and-death.md)
- [../design/snapshot-shape.md](../design/snapshot-shape.md)
- [../design/thread-model.md](../design/thread-model.md)
- [../design/arena-and-coordinates.md](../design/arena-and-coordinates.md)
- [../design/simulation-timing.md](../design/simulation-timing.md)
- [../design/input-commands.md](../design/input-commands.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/logging.md](../design/logging.md)
- [../design/testing.md](../design/testing.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [../docs/WAVES_AND_SCALING.md](../docs/WAVES_AND_SCALING.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
- [../docs/BOSS.md](../docs/BOSS.md)
