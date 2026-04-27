# Session End Results

- Status: done
- Created: 2026-04-26
- Updated: 2026-04-26

## Product intent

The end of a run should not feel like a system modal — it should feel like the final frame of the game session.

In 3–5 seconds the player should understand:

- how the run ended;
- how far they got;
- how much chaos they caused;
- what they want to do next.

A win should feel like a celebration of escaping the slime world. A loss should not feel like a mistake but like a clear summary of an attempt: the player sees their progress, the kills they earned, and feels the urge to try again.

## Player-facing

- Sees: after a victory the result screen appears as a bright comic finale: a large `Victory!` headline, festive fireworks/confetti/slime bursts, the run summary card, and the stats. After a defeat the result screen appears as a comic catastrophe: a large `Run is over` headline, a muffled impact effect, slime splashes/drips/fill, the progress card, and the stats. In both cases the player sees the run completion percent, the run time, the total slimes killed, and a kill breakdown by slime type with small icons. If the run reached the boss, the screen highlights the boss state separately: defeated on a win, the remaining HP on a loss.
- Can do: go back to the menu; read the result without knowing internal systems; on a defeat see how close they were to a win; on a victory feel the run end as a reward, not just a state transition.

## Ideal Session Ending

### Victory

A win begins with a short visual burst: a few firework flashes around the centre, coloured particles, and slime `pop` bursts instead of plain confetti. The screen should not turn into a heavy animated scene; it is 1–2 seconds of joy on top of the existing comic UI.

The result card appears with a light `bounce-in`.

Headline:

- `Victory!`
- `You broke out of the slime world`

Main figures:

- `Progress: 100%`
- `Time: 04:18`
- `Slimes killed: 143`
- `Upgrades collected: 12`

Run trophies:

- regular slime ×80
- fast slime ×22
- shooter slime ×16
- big slime ×8
- boss ×1

If the boss was the final encounter, a separate plate says: `Boss defeated`.

Tone: the player did not just clear a level — they broke out.

### Defeat

A defeat should not be a dull black plate. It is a comic scene: the player got buried in slime again. Visually: a short impact flash, a slightly heavier colour, slime drops or stains around the card, and less motion than on victory.

Headline:

- `Run is over`
- `Almost broke out` or `The slimes closed the trap again`

The main focus on a defeat is progress:

- `Progress: 73%`
- `Wave: 4 / 5`
- `Time: 03:12`
- `Slimes killed: 96`

If the player reached the boss:

- `Boss: 28% HP left`

If a death cause is available:

- `Killed by: Jumper Slime`
- or `Cause: contact damage`

Below — the same trophy breakdown of kills by slime. This is important: even a loss should show that the attempt was rich and not pointless.

Tone: `you lost` is replaced by `here is how far you got`.

## Result Stats

The result screen should show only stats that help the player evaluate the run emotionally.

Mandatory data:

- outcome: victory / defeat
- progress percent
- run duration
- total kills
- kills by slime type
- completed waves / total waves, if applicable
- boss result, if applicable

Optional data:

- collected drops / upgrades
- death cause
- final boss HP percent on defeat
- most-killed slime type

Do not show:

- debug IDs
- internal encounter names
- technical timestamps
- too many numbers competing for attention

## Progress Rules

For the player the percent must be clear even though the session inside is made of different encounters.

- Victory always shows `100%`.
- Up to the boss progress roughly tracks completed waves/encounters.
- If the player died on the boss, progress should look high but not `100%`; for example, account for the boss's remaining HP.
- In training/sandbox modes without a real finale the completion percent can be omitted or replaced with a mode-specific summary.

Important: the percent must not feel like a lie. If the player died in the last boss phase, the screen should honestly say they were very close.

## Visual Direction

Overall style:

- the same comic-card system used for pause/settings/menu;
- thick black outlines;
- a cream/light card;
- coloured stat pills;
- small slime icons instead of a bare table;
- no dark generic web modal.

Victory palette:

- yellow, green, blue;
- bright `pop` flashes;
- the feeling of a salute and a release.

Defeat palette:

- pink, red, muddy green;
- slime stains/drops;
- the feeling of `caught`, but without horror and without punishing the player.

## Technical

- A new shared contract `SessionResultSummary` and an extension of the terminal runtime events `win`/`loss` with a `summary` field per [session-result-summary.md](../design/session-result-summary.md).
- A simulation-side `RunSummaryTracker`: a hook-driven aggregator of deaths, pickups, boss/progress state; `SessionFlowSystem` attaches the summary to `win`/`loss` before teardown.
- `UiShell` keeps the summary in the `result` phase and hands it to Result UI; Result UI builds a main-side view model from the summary, `SessionDefinition`, content registries, and visual registries, without imports from `src/sim/**`.
- The result overlay gets an outcome-specific stats layout and presentation-only victory/defeat effects; the gameplay renderer in the `result` phase stays destroyed per [main-ui-shell.md](../design/main-ui-shell.md). The victory fanfare goes through `Audio.handleEvent(win)` per [audio.md](../design/audio.md), not from Result UI.

## Out of scope

- Leaderboards.
- Best run / personal records.
- A restart button, if the current session flow does not support a fast restart safely.
- A detailed damage breakdown.
- A post-run upgrade screen.
- A persistent history of past runs.
- New in-game rewards or unlocks.
- Tuning waves for the sake of pretty stats.

## Acceptance

- After a win the player sees a celebratory result screen with a fireworks/confetti animation and the run summary stats.
- After a loss the player sees a separate visual variant of the result with progress, time, kills, and a less celebratory but still in-game effect.
- Both outcomes show an outcome title, progress percent or equivalent session progress, run duration, total kills, kills by slime type with readable labels/icons, and a button back to the menu.
- The win and loss screens look like part of Slime Escape, not a generic web modal.
- On mobile/small viewports the text does not collide and the stats stay readable.
- If statistics for a specific type are missing, the screen does not show empty/zero noisy rows.
- Demo scenario: start a run, trigger a win, see the victory result; start a run, die, see the defeat result; verify that effects, headlines, and stats differ.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Shared protocol: introduce `SessionResultSummary`, extend `RuntimeEvent.win/loss` with a `summary` field, update types, test helpers, and existing expectations of terminal events. | Basis: [session-result-summary.md](../design/session-result-summary.md), [snapshot-shape.md](../design/snapshot-shape.md). |
| T2 | [x] | Simulation summary: add `RunSummaryTracker`, lifecycle reset, death/drop-pickup hooks, kill counts, defeat cause, boss state, progress percent; wire it into `SessionFlowSystem` so `win/loss` is published with the authoritative summary before teardown. | The summary hook must run before terminal death hooks. Cover with unit/integration tests for win, loss, boss loss/win, and sandbox/no-progress. |
| T3 | [x] | Main result data flow: update `UiShell` and the Result UI API to `outcome + summary`; build a pure view model for labels/icons/stats from the summary + session/content/visual registries. | Result UI does not import `src/sim/**`; zero-count rows are omitted. |
| T4 | [x] | Result presentation: implement a production-style victory/defeat result screen with progress, duration, total kills, kills by slime type, boss block, optional defeat cause, a responsive layout, and a single back-to-menu action. | Visually continues the comic-card style of pause/settings/menu. |
| T5 | [x] | Outcome effects and verification: add deterministic presentation-only victory fireworks/confetti and defeat slime splash/drip effects with a `prefers-reduced-motion` fallback; cover with DOM/unit tests where practical and run player demo checks for win/loss. | Effects live in Result UI, not in the gameplay Renderer. |

## Related

- [session-result-summary.md](../design/session-result-summary.md)
- [main-ui-shell.md](../design/main-ui-shell.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [runtime-systems.md](../design/runtime-systems.md)
- [health-and-death.md](../design/health-and-death.md)
- [drops.md](../design/drops.md)
- [boss-encounter.md](../design/boss-encounter.md)
- [session-definition.md](../design/session-definition.md)
- [audio.md](../design/audio.md)
- [thread-model.md](../design/thread-model.md)
- [content-archetypes.md](../design/content-archetypes.md)
- [sprite-assets.md](../design/sprite-assets.md)
- [testing.md](../design/testing.md)
- [../docs/VISION.md](../docs/VISION.md)
