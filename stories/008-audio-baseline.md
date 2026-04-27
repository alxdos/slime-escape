# Audio Baseline

- Status: done
- Created: 2026-04-19
- Updated: 2026-04-20

## Player-facing

- Sees: nothing new visually (optionally a small "audio active" indicator on the first interaction).
- Can do: hear shots, hits, and enemy deaths; background music during combat; ambient slime "voices"; UI clicks in the menu/pause/result; during the boss fight the music switches to the boss theme.

## Technical

- The audio stack lives in `src/main/audio/**` and does not import `src/sim/**`. Contact with simulation goes through `SimWorkerHost.onEvent`/`snapshotPair` with fan-out from `UiShell`.
- The reference decision is [../design/audio.md](../design/audio.md): a single `AudioContext` with gesture-based unlock, a mixer of `master + sfx/music/ui buses`, two-layer volume in the sample registry (`normalizedGain` for file correction, `defaultGain` for the gameplay role), "archetype → sampleId" and "event → sampleId" mappings next to the registry (not in `src/shared/content/**`), a music selector that switches to the boss track based on `encounter.type`, ambient slime voices driven by the snapshot using a presentation RNG.
- Triggers in 008: `fire`, `hit`, `death`, `dropPickup`, `bossPhaseChange`, plus UI overlay-show and menu button click. Player `hit`/`death` and win/loss sounds are intentionally skipped (no files yet).
- Music regularPool in 008: `100-waves`, `101-clock-ticking`, `001-calm`, `005-forest`, `007-nature`, `009-windy-forest`. Boss track: `boss/boss-music`. Music ducks to × 0.5 on pause.
- Explicit registry tweaks: `weapons/shotgun.mp3` → `normalizedGain ≈ 0.35`; slime voice samples → `defaultGain ≈ 0.3`.

## Out of scope

- Music layers and dynamic arrangement (one music track at a time + an optional ambient loop in the future).
- 3D / spatial audio, distance falloff (`perCallGainMul` is left as an extension point but is not used in 008).
- A volume settings UI and persisted preferences — that is [009-settings.md](009-settings.md); 008 only provides the graph nodes (`master`/`sfx`/`music`/`ui`) without UI or persistence.
- Sounds for `dropSpawn`/`dropExpire`, `encounterStart`/`encounterEnd`, `win`/`loss`, slime spawn — extensions of [../design/audio.md](../design/audio.md), not part of 008.
- Extending [../design/snapshot-shape.md](../design/snapshot-shape.md) for audio (new runtime events for slime movement and so on) is forbidden: ambient is covered by a snapshot-driven layer on the main side.

## Acceptance

- On the first click/gesture the `AudioContext` moves to `running` without errors; before the unlock, playback attempts are no-ops with a single warning.
- A player shot (any `WeaponArchetype` with a mapping — at minimum `pistol` in 008) plays the matching fire sample.
- A hit and a death of a slime enemy play the matching hit/death samples; `training-target` has no mapping — silent and stable.
- Picking up a drop plays a universal pickup sample.
- A boss phase change plays `boss-ahaha`; the boss encounter plays `boss/boss-music`; in other running/paused phases the music is a random track from the regularPool.
- In the menu and on the result screen the music is silent. In pause music is ducked, the slime ambient does not advance timers, and one-shots already playing finish naturally.
- Showing a pause/result overlay plays the UI sound `open-*`; clicking any menu/pause/result button plays `switch-*` (random from a set).
- Across repeated session starts and ends (`startSession`/`stopSession`/`win`/`loss`) the audio graph does not accumulate nodes or timers; `Audio` stays a single instance for the lifetime of the app.
- `Audio` tests pass without a real `AudioContext` through an injectable `AudioApi` mock and cover effective gain calculation, registry validation, event routing, music selector switching, and ambient behaviour in `paused`.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Lock down the [../design/audio.md](../design/audio.md) decision; update `Index` in [../design/README.md](../design/README.md) | architecture task |
| T2 | [x] | `src/main/audio/**`: `AudioContext` owner, mixer graph (`master` + `sfx`/`music`/`ui` buses), idempotent `unlock()` | base scaffold |
| T3 | [x] | Sample registry with two-layer gain (`normalizedGain`/`defaultGain`), validation on init (duplicate `id`, range clamping), lazy mp3 decode via an injectable `AudioApi` | registry and validation |
| T4 | [x] | Mappings for `weapons` / `enemies` / `bosses` / `events`, support `SampleSpec` as `id` or `id[]` (random pick), warn "no mapping → skip" once per unique key | a separate module inside `src/main/audio/**` |
| T5 | [x] | `Audio.handleEvent`: route `fire`/`hit`/`death`/`dropPickup`/`bossPhaseChange` to sampleId through the mappings; for `hit`/`death` resolve the target's `archetypeId` from the current snapshot | one-shot SFX |
| T6 | [x] | Music selector: regularPool ([6 tracks](../design/audio.md#music-selector)), boss track, switching by `phase` and `encounter.type`, ducking on `paused` | snapshot/phase-driven |
| T7 | [x] | Ambient slime voices: per-entity timers from `snapshot.entities[kind === 'enemy']`, presentation RNG (`Math.random`), pause timers in `paused` | snapshot-driven |
| T8 | [x] | Wire into `UiShell`: create `Audio` next to `Hud`, fan out `onEvent` into `audio.handleEvent`, call `audio.update` in `onFrame` after `hud.update`, `attach`/`detach` on session start/end, `audio.unlock()` on the first user gesture, `audio.playUi('overlayShow')` when pause/result is shown, `audio.playUi('buttonClick')` in overlay buttons | orchestration |
| T9 | [x] | `Audio` tests without a real `AudioContext` through an `AudioApi` mock: effective gain, registry validation, event routing and `targetKind` branches, music selector switching by phase/encounter, no ambient ticks in `paused`, drop-oldest when > 32 simultaneous one-shots | testing |

## Related

- [../design/audio.md](../design/audio.md)
- [../design/thread-model.md](../design/thread-model.md)
- [../design/main-ui-shell.md](../design/main-ui-shell.md)
- [../design/snapshot-shape.md](../design/snapshot-shape.md)
- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/content-archetypes.md](../design/content-archetypes.md)
- [../design/session-definition.md](../design/session-definition.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/rng.md](../design/rng.md)
- [../design/logging.md](../design/logging.md)
- [../design/testing.md](../design/testing.md)
- [../docs/VISION.md](../docs/VISION.md)
