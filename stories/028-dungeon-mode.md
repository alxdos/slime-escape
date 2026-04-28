# Dungeon Mode

- Status: in-progress
- Created: 2026-04-28
- Updated: 2026-04-28

## Player-facing

Dungeon is an endless wave mode for players who want a quick repeatable challenge and a simple personal target.

- Sees: the main menu opens the existing Dungeon screen when the player chooses `Dungeon`.
- Sees: the Dungeon screen has one selected mode. There are no difficulty choices in this mode.
- Sees: the white `Max wave` area shows only the local best wave number, for example `12`. If the player has no record yet, it shows `0`.
- Can do: press `Play` on the Dungeon screen to start the Dungeon run.
- Can do: fight endless waves until defeated.
- Sees: Dungeon wave numbers keep increasing through the run. They do not reset when the authored wave loop repeats.
- Sees: after defeat, the result screen focuses on Dungeon progress: waves cleared this run, local best, and a clear `New Best!` moment if the run improved the record.
- Sees: the local best updates only when the player clears more waves than before.

A cleared wave means the whole wave was defeated. If the player dies during wave 12 after clearing 11 waves, the run result is `11`.

## Technical

Use the existing Dungeon subscreen as the entry point and add the smallest runtime contract needed for endless play:

- `SessionDefinition.winCondition` gains `{ kind: 'dungeon' }`; when the authored encounter chain reaches the end, `SessionFlowSystem` loops back to the first authored encounter instead of emitting `win`.
- Dungeon ends through `lossCondition: { kind: 'playerDeath' }`.
- The simulation owns the run score: fully cleared Dungeon waves. It increments only after a `type === 'wave'` encounter ends.
- `EncounterSnapshot.waveOrdinal` carries the player-facing wave number so the title can continue as `Wave 12` even when the authored wave list loops.
- `SessionResultSummary.dungeon.wavesCleared` carries the terminal Dungeon score to main.
- Main thread owns local best persistence in `localStorage`, defaults it to `0`, updates it only when `wavesCleared` is greater than the saved value, and passes best/new-best state into Result UI.
- Escape Path is hidden for Dungeon because the mode has no finite flag path.

No new design decision file is needed. The contract is recorded by extending existing decisions in `design/`.

## Out of scope

- Cloud save, accounts, authentication, leaderboard, friends, rankings, and anti-cheat.
- Multiple Dungeon difficulties or mode choices.
- Pets, Lab, unlocks, cosmetics, achievements, and rewards outside the local best number.
- A new result screen art direction; reuse the existing result screen style with Dungeon-specific stats.
- New enemies, bosses, weapons, or drops created only for Dungeon.
- Complex procedural generation. The first version may reuse an authored wave loop.
- Balance perfection for infinite play. Fine-tuning and scaling can continue in follow-up stories.

## Acceptance

- From the main menu, choosing `Dungeon` opens the Dungeon screen.
- The Dungeon screen shows one selected mode and a `Play` action.
- The `Max wave` area shows only a number from local browser storage.
- With no saved record, the Dungeon screen shows `0`.
- Pressing Dungeon `Play` starts a Dungeon run.
- Dungeon does not end in victory after the authored encounter list is cleared; it continues into more waves.
- The run ends on player death.
- The result counts only fully cleared waves.
- Dying during a wave does not count that active wave.
- If the run clears more waves than the saved record, the saved record updates.
- If the run clears fewer or equal waves, the saved record stays unchanged.
- Returning to the Dungeon screen after a new best shows the updated number.
- Reloading the page keeps the local best in the same browser.
- Clearing browser site data may reset the number; this is acceptable.
- The result screen for Dungeon does not show campaign escape progress as the main progress message.
- There is no account, leaderboard, network save, or anti-cheat behavior.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Align existing architecture decisions for Dungeon mode. | Updated `session-definition`, `content-authoring`, `snapshot-shape`, `encounter-presentation`, `session-result-summary`, `main-ui-shell`, and `escape-progress-path`; no new design file. |
| T2 | [x] | Extend shared/content contracts: add `WinCondition.kind = 'dungeon'`, parse/render `winCondition | dungeon`, add the `dungeon` session preset in `content/sessions/`, regenerate content, and update build-session/content tests. | The preset is an authored loop with at least one wave and `lossCondition: playerDeath`; the Dungeon screen starts this preset directly. |
| T3 | [x] | Implement Dungeon runtime flow in sim: loop from the last authored encounter back to the first, keep `encounterStart`/`encounterEnd` ordering, avoid automatic `win`, increment `waveOrdinal` on every Dungeon wave start, and add focused `SessionFlowSystem` tests. | Existing finite `allEncountersComplete`, `bossDefeated`, `none`, and `/portal` behavior must stay unchanged. |
| T4 | [x] | Extend run summary: track fully cleared Dungeon waves, expose `summary.dungeon.wavesCleared`, keep finite progress percent `null` for Dungeon, and cover death-during-active-wave cases in `RunSummaryTracker` tests. | Dying in wave 12 after clearing 11 reports `11`. |
| T5 | [ ] | Wire Dungeon main UI: turn `dungeon-play` from teaser into start action, add localStorage best-wave store, render only the numeric best in the existing `Max wave` area, and update menu/UiShell tests. | No auth, leaderboard, network save, or anti-cheat. Invalid storage values fall back to `0`. |
| T6 | [ ] | Update presentation: TitleOverlay uses Dungeon `waveOrdinal`, ResultViewModel/ResultOverlay foreground waves cleared/local best/new-best state, and Escape Path stays hidden for Dungeon live/result states. | Reuse the existing result style; no new result art direction. |
| T7 | [ ] | Run focused verification and record manual checks. | `npm run content:check`, typecheck/tests touched by the implementation, and per pipeline ask the user to live-check Dungeon screen number, Play, death result, new best, reload persistence, and no incoherent overlap. |

## Related

- [session-definition.md](../design/session-definition.md)
- [content-authoring.md](../design/content-authoring.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [encounter-presentation.md](../design/encounter-presentation.md)
- [session-result-summary.md](../design/session-result-summary.md)
- [main-ui-shell.md](../design/main-ui-shell.md)
- [escape-progress-path.md](../design/escape-progress-path.md)
- [runtime-systems.md](../design/runtime-systems.md)
- [spawn-plan.md](../design/spawn-plan.md)
- [zone.md](../design/zone.md)
- [thread-model.md](../design/thread-model.md)
- [content-boundaries.md](../design/content-boundaries.md)
- [menu-and-startup-presentation.md](../design/menu-and-startup-presentation.md)
- [testing.md](../design/testing.md)
