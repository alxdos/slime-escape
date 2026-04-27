# Encounter Presentation

- Status: accepted
- Created: 2026-04-26
- Updated: 2026-04-27 (story 026 prep: `portal` encounters follow the no-title/no-text constraints used by non-combat terminal presentation encounters; portal visuals are main-thread world presentation in [vibe-jam-portals.md](vibe-jam-portals.md).)

## Context

[session-definition.md](session-definition.md) defines the shape of `EncounterDefinition` (`id`/`type`/`backgroundId`/`spawnPlan`/`zoneBehavior`/`objectives`/`rewardRules`/`transitionRules`/`tuning`). That contract is enough for simulation to execute an encounter, but says nothing about how the `main thread` presents the encounter to the player: a large "Wave N + name" title before a wave, transition text during breaks between sets, and delaying spawn/zone while the title is visible. Without this, the campaign is just a stream of encounters with no visual separation.

Story 021 introduces all of the following at once:

- two-line wave overlay with the global wave number in the session and a crafted title;
- one-line break overlay with transition text;
- intro delay for `SpawnSystem` and `ZoneSystem`, guaranteeing "title ended, wave started";
- global wave numbering where `campaign-set-2-wave-1` appears on the overlay as "Wave 4" and matches the result screen.

Without an explicit contract:

- `name`/`introDurationMs`/`text` would be added locally either to `EncounterDefinition` or `tuning`, and the authoring shape in `content-authoring.md` would diverge from runtime;
- "a wave must not end during intro" would spread across `SpawnSystem` (does not spawn), `ZoneSystem` (does not move margin), and `SessionFlowSystem` (checks `transitionRules`) in different ways;
- overlay wave numbering might become tied to `backgroundId` (a presentation field) or to the encounter id text, and any future campaign where a set shares a background with another would silently break counting;
- main-ui-shell might treat the overlay as "another HUD" and mix it with HUD wave progress, even though the overlay remains a separate presentation layer.

This file closes all four points with one decision.

## Decision

### EncounterDefinition fields

`EncounterDefinition` gets three presentation fields. All three are **required** (flat shape, no `?`); `null`/`0` is the explicit way to say "this encounter type does not set the field". This is the same "no two ways to say no data" rule already used in [session-definition.md](session-definition.md).

```ts
type EncounterDefinition = Readonly<{
  // ...existing fields from session-definition.md
  introDurationMs: number;   // integer >= 0
  name: string | null;       // null or non-empty string
  text: string | null;       // null or non-empty string
}>;
```

Type-paired constraints (violations are hard errors in content-build and the session builder):

| type | introDurationMs | name | text |
|---|---|---|---|
| `wave` | `>= 0`; `0` means no intro is shown | `null` or non-empty string | `null` |
| `break` | exactly `0` | `null` | `null` or non-empty string |
| `boss` | exactly `0` | `null` | `null` |
| `survivalTimer` | exactly `0` | `null` | `null` |
| `sandbox` | exactly `0` | `null` | `null` |
| `portal` | exactly `0` | `null` | `null` |

- `name` and `text` must be non-empty strings when not `null`: empty strings are forbidden, otherwise the overlay would draw an empty second line. Validated by content-build and the builder.
- "intro is not shown when `introDurationMs: 0`" is an overlay contract, not simulation: with zero, the UI show condition is immediately false, and `SpawnSystem`/`ZoneSystem` do not wait (see "Intro delay" below).
- Fields are present in every `EncounterDefinition`, including sandbox/bring-up. The `SessionDefinition` builder must not omit them by default.

### Intro delay for simulation

During intro, simulation must keep the promise "nothing new happens before intro ends". Single invariant:

- Intro is **active** in an encounter when `encounter.elapsedMs < encounter.introDurationMs`. For `introDurationMs: 0`, intro is inactive on the first tick.
- `encounter.elapsedMs` continues ticking by normal [simulation-timing.md](simulation-timing.md) rules. Snapshot shape is not extended; existing `encounter.elapsedMs` plus `encounter.introDurationMs` from `SessionDefinition` is enough.
- During intro, `SpawnSystem` does not materialize entities and does not advance internal plan state ([spawn-plan.md](spawn-plan.md), "Intro delay"). After intro ends, the plan starts from zero for wave/static timers.
- During intro, `ZoneSystem` does not advance internal `elapsedMs` and keeps `margin` equal to `startMargin` ([zone.md](zone.md), "Intro delay"). After intro ends, linear interpolation starts from the same zero point.
- `SessionFlowSystem` does not end an encounter while intro is active, **for any** `transitionRules.kind`. This closes a race where `'allEnemiesCleared'` fires immediately for `spawnPlan.kind === 'empty'` or for a wave whose first spawn has not happened yet. Formally, completion rules are checked only when `encounter.elapsedMs >= encounter.introDurationMs`. For `'timer'`, the timer itself counts from `encounterStart`; nevertheless completion before intro ends is still suppressed. In practice, content authors must not set `introDurationMs` greater than `transitionRules.durationMs` for `'timer'` encounters; content-build treats this as a hard error.

Other runtime systems (`MovementSystem`, `CombatSystem`, `InputCommand` handling) keep working normally during intro: the player can move, aim, and shoot. This is expected.

### Global Wave Numbering

The wave number in the overlay is counted **globally across all `type === 'wave'` encounters** in the current `SessionDefinition`:

- For the active wave encounter with index `i` in `session.encounters`:
  - `waveTotal` = number of all encounters with `type === 'wave'` in the session;
  - `waveIndex` = number of wave encounters in `session.encounters[0..i]` (1-based).
- The overlay displays `waveIndex`; `waveTotal` is computed by the same rule and is available if the overlay later wants to show "Wave waveIndex / waveTotal" (not used in the initial implementation; see "Render contract" below).

The algorithm is stable, deterministic from `session.encounters`, and independent of `backgroundId` and the textual shape of `encounter.id`. For current campaigns after the first boss, numbering keeps increasing: `campaign-set-2-wave-1` appears as "Wave 4", not "Wave 1".

HUD wave numbering (`main-ui-shell.md`, "HUD data derivation") and the result screen use the same global numbering meaning. The overlay does not introduce a separate local formula, so the player sees the same wave order across all UI layers.

### Render contract (main UI)

Wave/break title overlay is a separate UI layer in `src/main/ui/**`, independent from `Hud`. It follows the shared `UiShell` rules ([main-ui-shell.md](main-ui-shell.md)).

- **Phase visibility**: visible in `running` and `paused` (in `paused`, frozen at current state); hidden in `menu`, `loading`, `result`, `error('preload')`. `paused` behavior mirrors HUD: the overlay remains, and its conditions are not recomputed from new snapshots.
- **Wave overlay show condition**: active encounter `type === 'wave'`, `introDurationMs > 0`, and `encounter.elapsedMs < introDurationMs`. In all other cases, the wave overlay is hidden.
- **Wave overlay content**:
  - first line: `Wave {waveIndex}` (see "Global Wave Numbering");
  - second line: `encounter.name` if `name !== null`; otherwise no second line is drawn.
- **Break overlay show condition**: active encounter `type === 'break'` and `text !== null`. Visible for the full encounter duration, with no separate intro window.
- **Break overlay content**: one line, `encounter.text`.
- `portal` encounters do not show the title overlay. Their world-space portal visual is owned by [vibe-jam-portals.md](vibe-jam-portals.md), not by the title overlay.
- **Z-order** (adds to the table in `main-ui-shell.md`): Startup error > Startup overlay > Result UI > Pause overlay > Menu overlay > Settings overlay > **Title overlay** > HUD > canvas. Title overlay sits below any modal overlay and above HUD so modal dialogs do not compete with the title.
- Styles (font, stroke, shadow, fade) are implementation details and belong to the product layer (`## Player-facing` / `## Visual style` in the story); this decision does not fix them.
- Overlay does not subscribe to runtime events and does not touch `SimWorkerHost`: data sources are `SessionDefinition` (immutable during the session) and `snapshot.encounter` (`id`/`type`/`elapsedMs`), passed through `UiShell` by the same path as `Hud.update` ([main-ui-shell.md](main-ui-shell.md)).

### Runtime events

Intro and overlay introduce no new `runtime events`. `encounterStart`/`encounterEnd` are already published by `SessionFlowSystem` ([runtime-systems.md](runtime-systems.md), [snapshot-shape.md](snapshot-shape.md)) and are enough: overlay relies only on snapshots, and audio/HUD do not need a separate "intro ended" signal.

### Authoring

The MD source shape for `name`/`introDurationMs`/`text` is defined in [content-authoring.md](content-authoring.md), in "Multiple tables in one H2 section" and partition `# Session`; see the separate 021 update there. The content-build parser for the `sessions` area must validate the type-paired constraints from "EncounterDefinition fields" at render time (hard error with `file:line`).

## Consequences

- `EncounterDefinition` gets three stable presentation fields, and the authoring surface expands predictably in `content/sessions/*.md`.
- Intro delay is expressed by one invariant, `encounter.elapsedMs < encounter.introDurationMs`, applied locally in `SpawnSystem`, `ZoneSystem`, and `SessionFlowSystem`; snapshots and runtime events are not extended.
- Global overlay numbering does not depend on `backgroundId` or encounter id text, so it will not break in future campaigns where sets are named without a `set-N-` prefix.
- HUD, overlay, and Result UI speak about the same global wave order, so result progress does not contradict the title of the last seen wave.
- An empty wave (`spawnPlan: { kind: 'empty' }`) with `introDurationMs > 0` now behaves correctly: SessionFlowSystem keeps the encounter until intro ends, then `allEnemiesCleared` fires immediately. Content-build does not have to forbid this combination because runtime handles it.
- Future overlay extensions (fade-in/out parameters, per-set scenes) are additions to this file or new `design/` files, not changes to the contents of `EncounterDefinition`.

## Related

- [session-definition.md](session-definition.md)
- [spawn-plan.md](spawn-plan.md)
- [zone.md](zone.md)
- [main-ui-shell.md](main-ui-shell.md)
- [audio.md](audio.md)
- [content-authoring.md](content-authoring.md)
- [snapshot-shape.md](snapshot-shape.md)
- [runtime-systems.md](runtime-systems.md)
- [simulation-timing.md](simulation-timing.md)
- [../stories/021-wave-titles-and-session-music.md](../stories/021-wave-titles-and-session-music.md)
- [vibe-jam-portals.md](vibe-jam-portals.md)
