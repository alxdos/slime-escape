# Combat HUD without Debug

- Status: in-progress
- Created: 2026-04-26
- Updated: 2026-04-26

## Player-facing

- Sees: during a run the screen is no longer crowded with debug information. Only a small FPS indicator stays in the top-right.
- Sees: the run timer in `MM:SS` is shown in the top-left. The digits are tabular, so the timer does not jump as seconds tick.
- Sees: in the bottom-left, semi-transparent `WASD` keys styled like physical control buttons. They do not explain mechanics with long text — they just anchor the movement scheme.
- Sees: in the bottom-right, a mouse icon and a short caption `LMB: shoot`. No technical wording about pointer lock, capture, or mouse grab.
- Sees: along the bottom centre a row of square weapon slots. Each slot has the selection key number and a picture of that weapon's bullet/projectile.
- Sees: the currently selected slot is clearly highlighted: by a frame, glow, or scale, but without layout jumps.
- Sees: after firing, the selected weapon's slot shows cooldown via a semi-transparent fill. The fill drains as the weapon becomes ready again.
- Sees: if a weapon has upgrades, small square badges appear above the slot. A badge uses the visual of the corresponding drop/upgrade.
- Sees: if a temporary upgrade is active, its badge shows the remaining time as a background progress.
- Sees: if a weapon has multiple upgrades, the badges stack compactly above the slot. Identical stacks read as a stack or a small counter, but the HUD does not turn into a mess.
- Feels: the interface becomes game-like and calm. The bottom centre owns the combat decision "what am I shooting and when is it ready again", while control hints stay secondary.

### Product notes

- The HUD must feel like a player-facing interface, not a dev overlay.
- The bottom centre is the main decision space: which weapon is selected, what is on cooldown, which upgrades are active.
- The `WASD` and `LMB` hints must be quiet in opacity, helping a newcomer without competing with combat.
- HP should ideally be kept, but moved out of the old bottom HUD: for example, compactly under the timer in the top-left or as a small bar/hearts. Removing HP entirely is risky.
- Boss HP, when a boss is active, lives best as a thin strip at the top centre, rather than going back into the bottom HUD.

## Technical

The story rests on the new contract [hud-presentation.md](../design/hud-presentation.md): the HUD stays a passive `src/main/ui/**` component owned by `UiShell`, but its player-facing layout changes to top-left run status, top-centre boss strip, bottom-left `WASD`, bottom-centre weapon slots, and bottom-right `LMB: shoot`.

Technical slice:

- `WeaponHudSnapshot` extends per [snapshot-shape.md](../design/snapshot-shape.md): `cooldownStartedAtSimMs`/`cooldownReadyAtSimMs`, permanent `modifiers`, active `timedEffects`.
- `CombatSystem` keeps additional fields on the owner-local `WeaponInstance` from [universal-weapons-and-projectiles.md](../design/universal-weapons-and-projectiles.md), so snapshot export does not have to guess cooldown/overdrive progress.
- The renderer-level debug HUD with `encounter`/`wave`/`hp`/`zone`/`drops` is removed or becomes a no-op by default. `FpsOverlay` stays as a separate top-right overlay.
- `Hud.ts` stops rendering the old bottom blocks `HP`/`Weapon`/`Encounter`/`Wave`/`Boss`; the run timer comes from `snapshot.simTimeMs`, HP from `PlayerSnapshot`, the boss strip from `bossHud`.
- Weapon slots use `PROJECTILE_VISUALS[weaponArchetypeId].image`, and upgrade badges use an explicit modifier/effect → `DROP_VISUALS[dropArchetypeId].image` mapping.
- Input behaviour does not change: `WASD`, `Digit1..9`, `Digit0`, and `LMB` stay the contract of [input-commands.md](../design/input-commands.md); the HUD only shows hints and does not catch events.

## Out of scope

- New weapons, new upgrades, new cooldown balance.
- Changes in firing behaviour, weapon selection, or controls.
- A tutorial screen, in-game tutorial, long textual explanations.
- Changes to the menu, pause, or result overlay.
- Hiding FPS. FPS stays in the top-right.
- Technical hints about mouse capture, pointer lock, or capture.
- Reworking the wave-title overlay, session music, or encounter presentation.

## Acceptance

- In the running phase there is no debug panel in the top-left with `encounter`/`wave`/`hp`/`zone`/`drops`.
- FPS stays visible in the top-right.
- The run timer in the top-left shows `MM:SS`, uses tabular digits, and does not reset between waves.
- The old bottom HUD block with HP/Weapon/Encounter/Wave/Boss is no longer shown in its previous form.
- The semi-transparent `WASD` buttons are visible in the bottom-left.
- The mouse icon and the text `LMB: shoot` are visible in the bottom-right.
- The bottom centre shows every weapon slot from the current loadout.
- Each weapon slot shows the key number and the projectile image of that weapon.
- The selected weapon slot is visually distinct.
- After a shot the slot shows cooldown progress and returns to the ready state without textual noise.
- Permanent weapon modifiers show as badges above the matching weapon slot.
- A temporary overdrive shows as a badge with a remaining-time progress background.
- Multiple modifiers on one weapon do not break the layout on desktop or mobile.
- The HUD does not cover important combat areas and does not catch pointer/mouse events.
- Visual check: a run with several weapons and pickups shows cooldown, the selected slot, and upgrades readably.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Architect: write [hud-presentation.md](../design/hud-presentation.md), update [snapshot-shape.md](../design/snapshot-shape.md), [universal-weapons-and-projectiles.md](../design/universal-weapons-and-projectiles.md), [main-ui-shell.md](../design/main-ui-shell.md), the related links, [design/README.md](../design/README.md), and this story. | Closes the contract for the cooldown interval, modifiers, timed overdrive, HUD layout, and the debug-removal boundary. |
| T2 | [x] | Extend the shared/runtime weapon HUD shape: `src/shared/snapshot.ts`, `CombatSystem.WeaponInstance`, `weaponHudFor(playerId, simTimeMs)`, `SnapshotExportSystem`, and related tests. | Fields: `cooldownStartedAtSimMs`, `cooldownReadyAtSimMs`, `modifiers`, `timedEffects`; expired overdrive is not exported. |
| T3 | [x] | Remove the renderer-level debug HUD from `Renderer.ts` by default, keeping `FpsOverlay` in `src/main/index.ts`; update renderer tests that inject `createDebugHud`. | The page must not show a DOM panel for `encounter/wave/hp/zone/drops`. |
| T4 | [x] | Rebuild the HUD view model in `src/main/ui/Hud.ts`: run timer from `snapshot.simTimeMs`, compact HP, boss strip, weapon slot descriptors, cooldown ratio, timed-effect ratio, badge grouping. | Keep the passive `attach/update/detach` lifecycle; update `Hud.test.ts`. |
| T5 | [x] | Implement the new DOM/CSS HUD layout: top-left status, top-centre boss strip, bottom-left `WASD`, bottom-centre weapon bar, bottom-right mouse hint. | `pointer-events:none`, viewport-fixed positioning, stable square slots, monospace/tabular timer, responsive desktop/mobile constraints. |
| T6 | [x] | Wire visual assets and the badge mapping: projectile images from `PROJECTILE_VISUALS`, modifier/effect badges from `DROP_VISUALS`, selected-slot highlight, cooldown fill, and timed overdrive fill. | A missing visual for a known weapon/modifier is a test failure, not a silent text fallback. |
| T7 | [/] | Final verification: unit/integration tests for snapshot + HUD, `npm test`, and dev-server visual sanity on desktop/mobile with multiple weapons, active cooldown, stacked modifiers, and overdrive. | Verify there is no overlap, no old debug panel, FPS is in the top-right, and `LMB: shoot` is shown without pointer-lock text. |

## Related

- [../design/hud-presentation.md](../design/hud-presentation.md)
- [../design/main-ui-shell.md](../design/main-ui-shell.md)
- [../design/snapshot-shape.md](../design/snapshot-shape.md)
- [../design/input-commands.md](../design/input-commands.md)
- [../design/universal-weapons-and-projectiles.md](../design/universal-weapons-and-projectiles.md)
- [../design/combat-modifiers-and-field-effects.md](../design/combat-modifiers-and-field-effects.md)
- [../design/sprite-assets.md](../design/sprite-assets.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/testing.md](../design/testing.md)
- [007-hud-and-menu.md](007-hud-and-menu.md)
- [017-universal-weapons-and-projectiles.md](017-universal-weapons-and-projectiles.md)
- [018-combat-modifiers-and-field-effects.md](018-combat-modifiers-and-field-effects.md)
