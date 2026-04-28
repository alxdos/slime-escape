# XP And Pet Companions

- Status: in-progress
- Created: 2026-04-28
- Updated: 2026-04-28

## Product intent

Finished campaign runs should start a light collection loop without turning Slime Escape into a permanent-upgrade game.

XP is a simple reward for fighting through a run. The player spends it in the Lab to discover good slime companions, collects them on the Pets screen, and may bring one visible companion into the next campaign run.

In this first version pets do not attack, heal, block, buff, or change balance. They are a visible chosen companion and a collection goal.

## Player-facing

- Sees: after a campaign run ends with victory or defeat, the result screen shows `XP earned` and the new total XP.
- Sees: training results do not show XP rewards and do not add XP.
- Can do: open the Lab from the main menu.
- Sees: the Lab has a green stand and a purple stand. Each stand shows its XP price above it. The green stand is cheaper; the purple stand is more expensive.
- Can do: click a stand when they have enough XP. The price disappears, XP is spent, and a flipping pet of that quality appears on the stand.
- Sees: the revealed pet is already owned as soon as it appears.
- Can do: click the revealed pet on the stand. It disappears with a zoom-in effect, and the stand shows its price again.
- Sees: when all pets of a quality are owned, that stand shows `Complete` instead of a price.
- Can do: open the Pets screen from the main menu.
- Sees: owned pets in an inventory split into green and purple zones, plus a white selected-companion area.
- Can do: click an owned pet to move it into the white selected area.
- Can do: click the selected pet in the white area to remove it and go into the next run with no companion.
- Sees: if a pet is selected, it appears in the next campaign run to the right of the player at a distance of two player radii.
- Sees: the pet normally stays in place. If the player moves more than four player radii away, the pet runs after the player and closes the distance.
- Sees: the pet breathes like enemies, softly scaling up and down.

## Product rules

- XP is awarded only for completed campaign runs that end in `win` or `loss`.
- Manual exit to menu does not award XP.
- Training does not award XP.
- XP earned for a run is `destroyed slimes * XP coefficient`.
- The first version uses one coefficient for all campaign modes unless product tuning later says otherwise.
- A player cannot own two copies of the same pet.
- A stand purchase always rolls from pets of that quality that are not yet owned.
- A purchase cannot spend XP and return a duplicate.
- The player may have at most one selected companion.
- The player may choose no companion.
- Green quality has 5 pets.
- Purple quality has 5 pets.
- Initial asset mapping:
  - green pets: `public/assets/pets/pet-01.png` through `public/assets/pets/pet-05.png`;
  - purple pets: `public/assets/pets/pet-11.png` through `public/assets/pets/pet-15.png`.

## Technical

Architecture extends existing decisions instead of adding a new one.

XP, owned pets, and selected pet are local browser `client progression` owned by `UiShell`/main-thread persistence, not client settings and not simulation state. Pet archetypes and economy tuning are authored content. Pet sprites use the existing sprite visual pipeline with a pet visual registry. Result XP is derived on main from `SessionResultSummary.kills.total * PetEconomy.xpPerDestroyedSlime` only for eligible campaign win/loss results. Lab and Pets are nested menu sub-screens. The selected companion is renderer-only presentation passed from `UiShell` to `Renderer`; it is not part of `SessionDefinition`, snapshots, runtime events, combat, or result stats.

## Out of scope

- Pet combat abilities.
- Pet upgrades or levels.
- More than one selected companion.
- Selling, recycling, fusing, trading, or rerolling pets.
- Duplicate ownership.
- XP rewards from training.
- XP rewards for manual exit to menu.
- Cloud save, account sync, cross-browser sync, leaderboard, or anti-cheat.
- Balance tuning beyond the single XP coefficient, green price, and purple price.
- New campaign difficulty rules for XP.

## Acceptance

- A completed campaign win shows XP earned and the new total XP on the result screen.
- A completed campaign loss shows XP earned and the new total XP on the result screen.
- XP earned equals destroyed slimes multiplied by the configured coefficient.
- Training does not add XP and does not show a misleading `XP earned: 0` reward block.
- Returning to the menu keeps the new XP total in the same browser.
- Reloading the page keeps XP, owned pets, and the selected pet in the same browser.
- The Lab green and purple stands show different XP prices.
- Clicking an affordable stand spends XP and reveals a random unowned pet of that quality.
- The revealed pet is added to the inventory immediately.
- Clicking the revealed pet on the stand dismisses it with a zoom-in effect and returns the stand to its price state.
- Clicking a stand without enough XP does not spend XP and does not reveal a pet.
- When all pets of a quality are owned, the matching stand shows `Complete` and cannot sell another pet.
- The Pets screen shows owned green and purple pets in separate inventory zones.
- Clicking an owned pet selects it into the white companion area.
- Clicking the selected pet in the white area removes the selection.
- Starting a campaign with no selected pet shows no companion in the arena.
- Starting a campaign with a selected pet spawns it two player radii to the right of the player.
- The companion stays still while close enough to the player.
- The companion runs after the player when distance exceeds four player radii.
- The companion breathes with the same style of soft scale animation used by enemies.
- The companion does not damage enemies, heal the player, block projectiles, change stats, or otherwise affect combat outcome.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Align existing architecture decisions and decompose the story. | Updated existing `design/` files for content/progression/menu/result/RNG/sprite boundaries; no new design decision file. |
| T2 | [x] | Add pet content authoring: create `content/pets.md`, define 5 green and 5 purple pets plus `PetEconomy`, generate `pets.generated.ts` and `petVisuals.generated.ts`, and add generator/validator coverage. | Use the committed pet PNGs under `public/assets/pets/`; no duplicated image constants in UI. |
| T3 | [x] | Implement `ClientProgressionStore` in main: versioned localStorage snapshot, normalization, XP award, purchase, select, clear, in-memory fallback, subscriptions, and deterministic tests with injected `randomInt`. | Store only XP and pet ids; corrupt data must not block startup. |
| T4 | [x] | Wire result XP: decide campaign eligibility from last started source, award XP on completed campaign `win`/`loss`, pass `xpEarned` and new `totalXp` to Result UI, and hide XP reward block for training/manual exit/non-campaign flows. | XP comes from `summary.kills.total`; sim/result summary shape stays unchanged. |
| T5 | [x] | Implement Lab sub-screen: green/purple stand states, price/affordability, random unowned purchase, immediate ownership, flip reveal, click-to-dismiss zoom, `Complete` state, and focused UI/store tests. | Purchase must never spend XP on a duplicate or completed quality. |
| T6 | [x] | Implement Pets sub-screen: green/purple owned inventory zones, white selected-companion area, select owned pet, clear selected pet, persistence, and focused UI/store tests. | Selecting/clearing writes through progression before the next run starts. |
| T7 | [ ] | Implement selected companion renderer presentation: preload pet textures, pass selected pet id from `UiShell`, spawn two player radii to the right, follow only beyond four radii, breathe like enemies, and stay out of sim/snapshots/combat. | Missing selected pet content/visual/texture is a hard error. |
| T8 | [ ] | Run focused verification and record manual checks. | `npm run content:check`, typecheck/tests touched by the implementation, plus live checks for Result XP, persistence reload, Lab purchase/Complete, Pets select/clear, and companion movement/breathing. |

## Related

- [../docs/VISION.md](../docs/VISION.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [../docs/SCOPE.md](../docs/SCOPE.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/content-archetypes.md](../design/content-archetypes.md)
- [../design/content-authoring.md](../design/content-authoring.md)
- [../design/sprite-assets.md](../design/sprite-assets.md)
- [../design/main-ui-shell.md](../design/main-ui-shell.md)
- [../design/menu-and-startup-presentation.md](../design/menu-and-startup-presentation.md)
- [../design/session-result-summary.md](../design/session-result-summary.md)
- [../design/rng.md](../design/rng.md)
- [../design/thread-model.md](../design/thread-model.md)
- [../design/testing.md](../design/testing.md)
- [024-session-end-results.md](024-session-end-results.md)
- [023-main-menu-and-startup-ux.md](023-main-menu-and-startup-ux.md)
