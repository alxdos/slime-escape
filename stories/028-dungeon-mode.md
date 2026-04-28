# Dungeon Mode

- Status: planned
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

To be prepared by the architect.

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

To be prepared by the architect.

## Related

To be prepared by the architect.
