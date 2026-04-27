# Escape Path

- Status: done
- Created: 2026-04-26
- Updated: 2026-04-26

## Product Intent

Session progress should not be a dry line `Wave 7 / 15`, but a visible route to the exit.

At any moment the player should understand:

- where they are in the run;
- how many waves are behind;
- how many are still ahead until the win;
- that the flag at the end is reachable if they hold on a little longer.

The core product idea: an unfilled path begs to be filled. Even a defeat should leave the feeling `I made it this far`, not just `I lost`.

## Player-facing

- Sees: during combat, in the top-right, a compact wave track appears: passed dots glow, the current wave is highlighted, future dots are dim, and a `🏁` flag stands at the end.
- Sees: between waves and on break screens the same track expands as the larger `Escape Map`: the wave that just ended lights up, the next dot calls forward gently, the flag stays the visible finish of the route.
- Sees: on the result screen the map shows where the run ended. On a defeat the current dot marks the stopping point; on a victory the whole path lights up to the flag.
- Can do: read progress at a glance without pausing and without studying numbers; after a defeat see how far they got; after a victory feel the path is complete.

## Experience

### During combat

The progress lives in the top-right so it does not compete with the boss HUD at the top centre.

Compact view:

`Wave 7/15   ● ● ● ● ● ● ◉ ○ ○ ○ ○ ○ ○ ○ ○ 🏁`

- `Wave 7/15` gives precise orientation.
- Passed waves glow.
- The current wave pulses or is highlighted with a ring.
- Future waves are visible but quiet.
- The flag at the end turns the wave list into a goal.

Bosses are not shown in this compact HUD. The track only answers the question "how many waves to the exit", and the boss HUD stays a separate combat signal.

### Between waves

In break periods the track grows larger and more emotional.

After a wave ends the player gets a short moment of acknowledgement:

- the last dot flashes;
- the path visually advances toward the flag;
- the next dot is faintly highlighted;
- a brief text may appear: `Wave 7 cleared` or `Waves to the exit: 8`.

It should feel like a small reward for surviving and an invitation to stay in the run.

### On a defeat

The Escape Map becomes the central anchor of the result.

Example:

`● ● ● ● ● ● ✕ ○ ○ ○ ○ ○ ○ ○ ○ 🏁`

Result text:

- `You reached wave 7 of 15`
- `Waves left to the exit: 8`
- if the player was close to the end: `The flag was nearly there`

A defeat should not say only `you didn't make it`. It should say: `look how much of the road you took`.

### On a victory

On a win the whole track is filled and the flag comes alive.

Example:

`● ● ● ● ● ● ● ● ● ● ● ● ● ● ● 🏁`

This is the visual point of closure: the player did not just see `100%`, they reached the exit.

## Visual Direction

- The compact HUD is light and readable: no card, no heavy panel, no competition with combat.
- The expanded map on break/result can be more expressive: bigger dots, more glow, soft fill animation.
- The style stays comic / hand-drawn: thick outlines, bright glowing dots, a touch of slime/sparks while filling.
- The flag at the end should be noticeable but not huge. It is a promise of the exit, not a separate UI banner.
- On small screens the track may compress: some future dots group together, but the current wave, the total count, and the flag stay readable.

## Product Notes

- The same progress lives in three forms:
  - a compact HUD for orientation;
  - an expanded break map for motivation to continue;
  - a result map for the desire to retry or the feeling of completion.
- Wave numbering is global across the whole session so it matches the wave titles and the result screen.
- Bosses are not marked on the track. This keeps the route clean and avoids a second competing boss indicator.
- The strongest retention effect comes not from a percent, but from an unfinished picture: the player sees empty dots before the flag and wants to fill them in.

## Technical

- The architectural foundation — [escape-progress-path.md](../design/escape-progress-path.md): `Escape Path` is a main-thread presentation layer, it does not extend `Snapshot`, runtime events, session content, or sim systems.
- The live/break variant is derived from `SessionDefinition + SnapshotPair.curr`; the result variant is derived from `SessionDefinition + SessionResultSummary`.
- `UiShell` owns the live component the same way it owns HUD/Title overlay: attach/update/freeze/detach by phase. Result UI renders a separate static map inside the result overlay.
- A single pure view-model derivation must serve the compact HUD, the expanded break map, and the result map, so global wave numbering does not drift between layers.

## Out of scope

- Separate boss markers on the track.
- Personal records, best runs, a saved history of attempts.
- Rewards, unlocks, achievements, or meta-progress.
- A new Retry button on the result screen.
- Changes to wave composition, balance, or session length for the sake of a prettier path.
- A full world map with separate biomes and set illustrations.

## Acceptance

- During an active wave the player sees the compact `Escape Path` in the top-right with the current global wave, the total number of waves, and the flag at the end.
- The compact HUD does not cover the boss HUD and does not interfere with reading combat.
- The track shows only waves: no boss markers and no encounter ids.
- After a wave / on break the player sees the expanded `Escape Map` where the wave just cleared visually lights up.
- On a defeat result the player sees the map with the stopping point and a text along the lines of `You reached wave N of M`.
- On a victory result the player sees the path fully filled to the flag.
- Numbering matches the global wave numbers from the title overlay and the result summary.
- Demo: start a campaign, see the compact path on the first wave; clear a wave and see the expanded break map; lose mid-session and see where the path stopped; win and see the path filled to the flag.

## Tasks

The architecture preparation is closed in this pass; the remaining tasks target a coder.

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Architectural preparation: new [escape-progress-path.md](../design/escape-progress-path.md), update [main-ui-shell.md](../design/main-ui-shell.md), the index [../design/README.md](../design/README.md), the `Technical`/`Tasks`/`Related` of the story. | No production code. |
| T2 | [x] | Pure progress view model: add a main-side helper for live/result path derivation from `SessionDefinition`, `Snapshot`, and `SessionResultSummary`. | Cover active wave, break after wave, boss/non-wave, win, loss during a wave, loss after every wave before the flag, zero-wave session. |
| T3 | [x] | Live component + UiShell wiring: create the `EscapeProgressPath` UI component with the lifecycle `attach/update/detach/dispose`, compact mode for running and expanded break mode for active break, wired into `UiShell`. | The component is passive: no `src/sim/**`, no runtime events, freeze in `paused`, hidden in result/menu/loading/error. |
| T4 | [x] | Result integration: extend `ResultViewModel` and `ResultOverlay` so victory/defeat results show a static `Escape Map` from the terminal summary. | Result UI does not read the snapshot after teardown; a final-boss loss shows the stop marker before the flag, not "reached the flag". |
| T5 | [x] | Presentation polish and verification: responsive layout, reduced-motion fallback, z-order sanity with the boss HUD/title/pause/result, unit tests and demo checks. | Verify on desktop/mobile-ish widths; full `typecheck`/tests on the affected UI modules. |

## Related

- [escape-progress-path.md](../design/escape-progress-path.md)
- [main-ui-shell.md](../design/main-ui-shell.md)
- [hud-presentation.md](../design/hud-presentation.md)
- [encounter-presentation.md](../design/encounter-presentation.md)
- [session-result-summary.md](../design/session-result-summary.md)
- [021-wave-titles-and-session-music.md](021-wave-titles-and-session-music.md)
- [022-combat-hud-redesign.md](022-combat-hud-redesign.md)
- [024-session-end-results.md](024-session-end-results.md)
