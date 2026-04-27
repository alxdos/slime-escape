# Per-Spawn Modifiers in Waves

- Status: done
- Created: 2026-04-25
- Updated: 2026-04-26 (done: T2–T16 closed; final pass `content:check`, scripts `tsc`, `typecheck`, full `npm test`, visual sanity through a dev server run by the user)

## Player-facing

- Sees: nothing new on screen. The existing campaign keeps the same waves, the same bosses, and the same context-specific drop/retaliation behaviours. A small balance shift from removing old stat forks is acceptable: the game is still in the balancing stage. This is an infrastructure story; the visible difference shows up in the next stories that build on it.
- Game designer experience: one direct, readable way to describe the specifics of **a single spawn in a single wave** right inside the encounter table row in [content/sessions/](content/sessions/), without creating a new enemy archetype for it. Today every such specific behaviour requires forking a slime (`campaign-set-1-carrier-slime`, `demo-retaliator-slime`, and so on); after this story [content/enemies.md](content/enemies.md) only contains "real" species of slimes.

## Technical

This story pins the architectural line between two levels of truth and moves existing data to the right level.

### The principled split

- **An archetype in [content/enemies.md](content/enemies.md) = the creature's identity.** Stable for `slime-X` everywhere: body (`radius`, `contactBox`), health (`maxHp`), movement (`behavior`, `maxSpeed`), the physical contact model (`contactDamage`, `contactCooldownMs`, `knockback*`), colour/sprite/sound set, the default probabilistic drop table `dropTable`, the default `retaliation` policy.
- **A spawn override in [content/sessions/<preset>.md](content/sessions/) = the context of the appearance.** True for **this specific spawn in this specific wave**: a guaranteed drop, a replaced probabilistic drop table, a one-off retaliation. Granularity — per `seq` (one row of the spawn table = one possible override).
- `behavior` is **not** overridable: it is "who the slime is", not "what it carries". If you want "the same slime but stationary", that is a new archetype, not a spawn modifier.

### Spawn-override fields (a closed list at this horizon)

- `guaranteedDrops` — a list of `dropArchetypeId`s this spawn is guaranteed to drop on death. Semantics — **add** on top of the archetype's `dropTable`. Replaces today's `EnemyArchetype.carrierDrop.guaranteedDropArchetypeIds`.
- `dropTable` — the full probability table for this spawn. Semantics — **replace** the archetype's table. If omitted — the archetype's table is used.
- `retaliation` — `{ enabled, durationMs }` for this spawn. Semantics — **replace** the archetype policy. If omitted — the archetype default is used (which is `{ enabled: false }` by default).
- `loadout` (giving a weapon to a slime per spawn) is **intentionally out of 019**: it is introduced in 020 together with a runtime firing path. Before 020 a slime cannot fire anyway — the field would be a no-op in 019.

### Fields that leave `EnemyArchetype`

- `carrierDrop` (including `guaranteedDropArchetypeIds`) is removed entirely. After migration there is no such field in [src/shared/content/enemies.ts](src/shared/content/enemies.ts).
- `dropTable` **stays** as the archetype default; the actual table for a specific spawn is "the spawn-override if present, otherwise the archetype's".
- `retaliation` **stays** as the archetype default `{ enabled: false, durationMs: 0 }` (true for 99% of slimes today).

### Application and validation

- Spawn-override is applied **once** when the entity is spawned in `SpawnSystem`. After that the runtime entity is no different from a "regular" spawn; there are no per-tick overrides.
- Content build (`scripts/content-build/sessions/**`): hard error on an unknown `dropArchetypeId`/an unknown override field/an override on a non-existent `seq`; warn on `chance > 1` and `retaliation.enabled && durationMs <= 0` (as today in `validateEnemyRegistry`).
- Session builder ([src/shared/content/buildSession.ts](src/shared/content/buildSession.ts)): cross-area checks move here. The former `assertCarrierDropsResolve` moves out of `validateEnemyRegistry` into the sessions-area validator so the source of truth matches the place of the check.
- Runtime: no new checks — by tick time everything is already resolved.

### Migration (part of the story, not a follow-up)

- Removed from [content/enemies.md](content/enemies.md) and from [src/shared/content/enemies.generated.ts](src/shared/content/enemies.generated.ts): `campaign-set-1-carrier-slime`, `campaign-set-2-carrier-slime`, `campaign-set-3-carrier-slime`, `campaign-set-4-carrier-slime`, `campaign-set-5-carrier-slime`, `demo-carrier-slime`, `demo-retaliator-slime` — seven forks total.
- Each of their `seq` spawns in [content/sessions/](content/sessions/) is rewritten to a regular archetype of the same visual family + the matching spawn-override (`guaranteedDrops` for the carriers, `retaliation` for the retaliator). Old stat differences of the fork archetypes are not carried over: 019 keeps the clean model where override does not change body/HP/movement/contact/knockback/colour.
- After migration `EnemyArchetype` loses the `carrierDrop` field; today's tests that rely on it are rewritten as spawn-override tests.

### Where this lives in `design/`

- A new file `design/spawn-overrides.md` — the single source of truth for the contract (shape, fields, semantics, moment of application, validation, migration rule).
- Targeted updates in adjacent files to remove "two different sources without data": removing `carrierDrop` from `EnemyArchetype` in [content-archetypes.md](design/content-archetypes.md); the per-spawn entry shape in [spawn-plan.md](design/spawn-plan.md) and [session-definition.md](design/session-definition.md); redirecting wording about "guaranteed drop" in [drops.md](design/drops.md) and [combat-modifiers-and-field-effects.md](design/combat-modifiers-and-field-effects.md); an entry in `Index` in [design/README.md](design/README.md).
- The architecture PR (the `design/` edits) ships **separately** from the code PR for this story, per the rule "do not mix `design/` edits and code in one PR".

## Out of scope

- `loadout` as a spawn-override field and any slime firing in runtime — that is 020.
- Stat multipliers (`hpMultiplier`, `speedMultiplier`, `damageMultiplier`, …) as spawn-overrides — a separate design decision, not included here.
- A per-encounter override (one entry for "every slime of kind X in this wave") in addition to per-`seq`. Considered redundant; if ever needed — a separate decision.
- A `modifiers: [{ kind, ... }]` array as the recording form. A closed flat set of named fields is intentional.
- Overriding `behavior` (per-spawn `chase ↔ stationary`). Intentionally forbidden.
- Coexistence of the old `EnemyArchetype.carrierDrop` and the new spawn-override in parallel. Migration is hard; the forks are removed in this same story.
- Templates/inheritance between `content/sessions/<preset>.md` files. Each preset stands on its own.
- UI/HUD changes. The player gets nothing new on screen.
- Any changes in `BossPhaseSystem`, `DropSystem` lifecycle, `HealthDeathSystem` lifecycle: HP is still removed only by `HealthDeathSystem`, drops still spawn and get picked up only by `DropSystem`.

## Acceptance

- [content/enemies.md](content/enemies.md) no longer contains the archetypes `campaign-set-1..5-carrier-slime`, `demo-carrier-slime`, `demo-retaliator-slime`. No file in [content/sessions/](content/sessions/) references those ids.
- Today's campaign ([content/sessions/campaign.md](content/sessions/campaign.md)) stays deterministic on the same `seed` after migration; the carrier-spawn context behaviours are preserved via `guaranteedDrops` + `dropTable: empty`. Byte-for-byte identity with the pre-019 stat forks is not required.
- Demo scenarios (sandbox/training/demo, if any in `content/sessions/`) keep their carrier/retaliator context behaviours via spawn-override; byte-for-byte identity with pre-019 stat forks is not required.
- The `EnemyArchetype.carrierDrop` field is removed from the type in [src/shared/content/enemies.ts](src/shared/content/enemies.ts); the validator `assertCarrierDropsResolve` moves to the sessions-area validator.
- In [content/sessions/<preset>.md](content/sessions/) a `seq` row can specify any of the three fields `guaranteedDrops` / `dropTable` / `retaliation`; content-build parses them correctly, and the runtime applies them exactly as described in `design/spawn-overrides.md`.
- `content:check` fails (atomically, as today) on: a reference to an unknown `dropArchetypeId` in any of these fields; an unknown override field name; an override on a non-existent `seq`. Each case is covered by a content-build unit test.
- Warnings (no failure) appear correctly on `chance > 1` in a spawn-override `dropTable` and on `retaliation.enabled && durationMs <= 0` in a spawn-override.
- No runtime system (`SpawnSystem`, `CombatSystem`, `DropSystem`, `RetaliationSystem`) gains new public fields; spawn-overrides become regular runtime parameters of an entity at spawn time.
- Main menu, HUD, renderer, audio — unchanged. A before/after comparison shows no visual difference for existing sessions.

## Tasks

Full breakdown: the architecture PR (T1) is prepared in this same review; the code PR (T2–T16) is a separate PR after the architecture one merges, per the rule "do not mix `design/` edits and code in one PR". Inside T2–T16 the order reflects dependencies: types → remove `EnemyArchetype.carrierDrop` → parser/renderer for `sessions` → builder validation → runtime → content migration → tests → verification.

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Architect: `design/spawn-overrides.md` (the `SpawnOverride` shape, fields `guaranteedDrops`/`dropTable`/`retaliation`, replace/add semantics, moment of application, validation, migration rule) + targeted updates in `content-archetypes.md` (removing `carrierDrop`), `spawn-plan.md` (optional `override` in `StaticSpawn`/`WaveSpawn`), `session-definition.md`, `drops.md` (DropSystem reads per-entity `dropTable`/`guaranteedDrops`), `combat-modifiers-and-field-effects.md` (carrier/retaliation now per-spawn), `content-authoring.md` (a third override table in an encounter, controlled extension of list-in-cell), `design/README.md` Index. Full decomposition of this story. | The architecture PR is a separate PR, no code. Design accepted, the code branch starts from T2. |
| T2 | [x] | Extend `src/shared/session.ts`: add the type `SpawnOverride = Readonly<{ guaranteedDrops?, dropTable?, retaliation? }>`; add an optional `override?: SpawnOverride` to `StaticSpawn` and `WaveSpawn`. No change in the values of existing fields. | Pure types; runtime behaviour does not change yet. |
| T3 | [x] | Remove the `carrierDrop` field (including `CarrierDropMetadata`/`marker: 'reward'`) from `EnemyArchetype` in `src/shared/content/enemies.ts`. Remove `assertCarrierDropsResolve` from `validateEnemyRegistry`. Keep `dropTable` and `retaliation` as defaults. | After this step the build is broken until T4–T7; tasks run as one series. |
| T4 | [x] | `scripts/content-build/enemies/parse.ts` + `renderContent.ts`: stop parsing the `## Carrier Drops` partition from `content/enemies.md`; stop emitting the `carrierDrop` field in `enemies.generated.ts`. | Removing the partition from the MD source itself is part of T13 (after migrating `content/sessions/`). |
| T5 | [x] | `scripts/content-build/sessions/parse.ts`: parse a third optional GFM table in an encounter section `seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs`. Hard error on: an unknown override field name, an override on a non-existent `seq`, a duplicate `seq`, an unknown `dropArchetypeId` (via `requireDropRef`), a partially set pair `retaliationEnabled`/`retaliationDurationMs`. Warn on `chance ∉ [0, 1]`/`sum > 1` in `dropTable` and on `enabled && durationMs <= 0`. Extend `ParsedSpawn`/`ParsedStaticSpawn` with an `override` field. | Forbid the third table for `spawnKind ∈ {empty, boss}`. |
| T6 | [x] | `scripts/content-build/sessions/renderContent.ts`: emit `override` in the literals of `WaveSpawn`/`StaticSpawn` in the generated `sessions.generated.ts` (skip the field if override is empty; preserve the current shape without override). | Imports of `DropArchetype.id` for `override.guaranteedDrops`/`override.dropTable` go through the same import bucket as `drops`. |
| T7 | [x] | `src/shared/content/buildSession.ts`: in `resolveSpawnPlanTemplate` walk every `seq` and verify that all `override.guaranteedDrops`/`override.dropTable[*].archetypeId` resolve in `DROP_ARCHETYPES`. This is the runtime second pass that replaces the former `assertCarrierDropsResolve`. | The check is mandatory for every `'static'` and `'wave'` plan. |
| T8 | [x] | `src/sim/EntityStore.ts`: add runtime fields `guaranteedDrops: ReadonlyArray<string>` and `dropTable: ReadonlyArray<DropTableEntry>` on the `enemy` entity. Source `carrierDropMarker` from a derived `guaranteedDrops.length > 0 ? 'reward' : null`. `EnemySpawnSpec` accepts the matching fields. | The snapshot shape does not change. |
| T9 | [x] | `src/sim/SpawnSystem.ts`: `makeEnemySpawnSpec` takes a second arg `override?: SpawnOverride` and resolves `guaranteedDrops`/`dropTable`/`retaliation` via override-or-archetype-default. Apply in `executeStatic` and `spawnNextWaveEnemy`. | No runtime reads of `archetype.carrierDrop` after this step. |
| T10 | [x] | `src/sim/DropSystem.ts`: the hook reads `enemy.dropTable` and `enemy.guaranteedDrops` from the runtime entity via `EntityStore`, not from `EnemyArchetype`. The `enemyRegistry` parameter is either removed or kept only for logging an unknown archetypeId. Order: guaranteed drops → weighted pick (see `design/drops.md`, hook steps 3 → 4 → 5). | After T8/T9 this is a refactor with no behaviour change. |
| T11 | [x] | Migrate `content/sessions/*.md`: rewrite every `seq` that references one of the seven forks to a regular archetype of the same visual family + the matching spawn-override. Concretely (based on the current state of `enemies.md`/`sessions/`): `campaign-set-1-carrier-slime` → `slime-spark` + `guaranteedDrops: size-up`, `dropTable: empty`; `campaign-set-2-..` → `slime-stack` + `guaranteedDrops: multi-shot`, `dropTable: empty`; `campaign-set-3-..` → `slime-echo` + `guaranteedDrops: magnet`, `dropTable: empty`; `campaign-set-4-..` → `slime-prince` + `guaranteedDrops: fragment`, `dropTable: empty`; `campaign-set-5-..` → `slime-obelisk` + `guaranteedDrops: overdrive`, `dropTable: empty`; `demo-carrier-slime` → `slime-star` + `guaranteedDrops: magnet, heal-orb`, `dropTable: empty`; `demo-retaliator-slime` → `slime-saw` + `dropTable: heal-orb:0.20`, `retaliation: enabled=true, durationMs=2500`. The old stat differences of fork archetypes are not carried over. | Determinism of the new model is pinned by the T15 test. |
| T12 | [x] | Remove from `content/enemies.md` the H2 sections of the seven forks and their rows in every balance partition (`## Bodies`, `## Speed`, `## Hit points`, `## Contact`, `## Drops`, `## Carrier Drops`, `## Retaliation`) and in `# Sound sets / ## Members`. Remove the `## Carrier Drops` partition entirely. Run `npm run content:build` and verify that `enemies.generated.ts` matches (the forks disappear; the `carrierDrop` field disappears from every remaining one). | Done after T11 so the campaign no longer references archetypes that already do not exist. |
| T13 | [x] | `scripts/content-build/sessions/sessions.test.ts`: add unit tests for every T5 hard-error rule (override on a non-existent `seq`, duplicate `seq`, unknown field name, unknown `dropArchetypeId`, `empty` vs `none`, partially set `retaliation`) and for every warn (chance > 1, sum > 1, retaliation duration ≤ 0). | Coverage on the content-build side, as Acceptance requires. |
| T14 | [x] | Rewrite tests that rely on `EnemyArchetype.carrierDrop`: `src/sim/DropSystem.test.ts` (carrier guaranteed drops), `src/sim/SpawnSystem.test.ts`, `src/sim/RetaliationSystem.test.ts`, `src/shared/content/enemies.test.ts`. Test fixtures now feed override through the spawn plan or the runtime spec, not through the archetype. | Behaviour for the same scenarios must stay identical. |
| T15 | [x] | Deterministic regression test: run a `campaign` session for a fixed `seed` and pin the stable post-migration sequence of runtime events (`enemySpawn`/`death`/`dropSpawn`/`dropPickup`/`dropExpire` + positions/archetypes). Implemented as a vitest snapshot or an explicit equality against a pinned baseline of the new model. | Covers the Acceptance "deterministic after migration" without requiring pre-019 byte-for-byte. |
| T16 | [x] | Run `npm run content:check && tsc -p tsconfig.scripts.json && npm run typecheck && npm test`. Run a visual sanity check via `npm run dev` for `campaign`/`combat-modifiers-demo` and confirm HUD/renderer/audio show no visual difference. | Final verification. |

## Related

- [spawn-overrides.md](../design/spawn-overrides.md)
- [content-archetypes.md](../design/content-archetypes.md)
- [spawn-plan.md](../design/spawn-plan.md)
- [session-definition.md](../design/session-definition.md)
- [drops.md](../design/drops.md)
- [combat-modifiers-and-field-effects.md](../design/combat-modifiers-and-field-effects.md)
- [content-authoring.md](../design/content-authoring.md)
- [content-boundaries.md](../design/content-boundaries.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [boss-encounter.md](../design/boss-encounter.md)
- [universal-weapons-and-projectiles.md](../design/universal-weapons-and-projectiles.md)
- [020-shooting-slimes.md](020-shooting-slimes.md)
