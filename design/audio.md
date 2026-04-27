# Audio

- Status: accepted
- Created: 2026-04-20
- Updated: 2026-04-26 (story 024: menu phase fixed music is `music/digital-dawn` from existing `public/sfx/music/digital-dawn.mp3`; terminal `win` runtime event plays `events.victoryFanfare = ui/fanfare` from existing `public/sfx/ui/fanfare.mp3`; `loss` does not play it and `AudioUiEventId` is unchanged. Story 023: menu phase receives fixed menu music through the same selector; `AudioUiEventId` is extended with `buttonHover` and `modeSwitch`; `buttonHover` maps to existing `ui/open-1`, `modeSwitch` reserves existing `ui/switch-2`, and the shared `buttonClick` pool uses the remaining `ui/switch-1/3/4`. Both new UI events are invoked through `UiShell`. Story 021: music selector no longer stores `regularPool` inside `Audio`; regular music selection moves to session-level `SessionDefinition.musicSampleId` ([session-definition.md](session-definition.md)); boss override by `encounter.type === 'boss'` remains unchanged, as does pause ducking. `SampleRegistry` invariant: every entry with `category: 'music'` must have `loop: true`, otherwise `Audio` initialization errors; music validator now explicitly checks category+loop. For `musicSampleId: null`, regular music is silent for the entire run, which is a legitimate configuration. Earlier: 2026-04-23 story 014: authoring surface for `WEAPON_AUDIO_MAPPINGS[*].fire` moves to an inline audio-link node under the weapon H2 in `content/weapons.md`; for `ENEMY_AUDIO_MAPPINGS[*].hit/death/voice`, it moves to a new `# Sound sets` partition in `content/enemies.md` with `## Members` (`setId | slimes`) and narrow group tables `## Hit`/`## Death`/`## Voice`, whose `sampleId` cells also allow inline audio-link form (see "Inline media nodes as derive sources" and "Shared resource set partition" in [content-authoring.md](content-authoring.md)); runtime shapes `EnemyAudioMapping`, `BOSS_AUDIO_MAPPINGS`, `WEAPON_AUDIO_MAPPINGS`, `SampleRegistry`, `createAudioMappings`, and validators are unchanged. The generator expands sound-set N-to-1 into the same `Record<enemyArchetypeId, EnemyAudioMapping>` byte-for-byte. Story 013 extends `ENEMY_AUDIO_MAPPINGS` to all 30 slime archetypes and `BOSS_AUDIO_MAPPINGS` to all 5 boss archetypes through the same three pools `slimes/hit-*` / `slimes/death-*` / `slimes/voice-*` and existing boss sample ids; mapping shapes and `SampleRegistry` do not change. Story 012 covers weapon/boss audio mappings with MD generation and fills enemy sound from `SampleRegistry` pools; types and validation do not change.)

## Context

[thread-model.md](thread-model.md) states that audio lives on the `main thread`, HUD and audio rely on snapshots while runtime events trigger reactions, and master gain is the future settings integration point. [snapshot-shape.md](snapshot-shape.md) defines per-kind entity fields in snapshots, including required `archetypeId` on `enemy`/`projectile`/`drop`/`boss`, and runtime events: `fire`, `hit`, `death`, `dropSpawn`/`dropPickup`/`dropExpire`, `bossPhaseChange`, `pause`/`resume`, `encounterStart`/`encounterEnd`, `win`/`loss`. [main-ui-shell.md](main-ui-shell.md) already states that 008 attaches to UI phases and runtime events, that HUD does not subscribe to runtime events directly, and that direct component access to `SimWorkerHost.onEvent` is forbidden; fan-out goes through `UiShell`. [content-boundaries.md](content-boundaries.md) splits data into four levels and places volume in `client settings`. [content-archetypes.md](content-archetypes.md) defines `color` as a content placeholder for visuals, but does not add audio fields to archetypes. [rng.md](rng.md) limits session RNG to simulation; main may use `Math.random` for presentation that does not enter snapshots/events. [web-stack.md](web-stack.md) forbids new root directories for presentation; new main-side code lives under `src/main/**`.

Story 008 introduces at the same time:

- Web Audio mixer and unlock on user gesture;
- mappings from `weaponArchetypeId` / `enemyArchetypeId` / `bossArchetypeId` / events to samples;
- ambient slime voices with no corresponding sim runtime event;
- background music with switch to boss track and UI phases (`menu`/`running`/`paused`/`result`);
- individual loudness adjustments for source files, such as shotgun louder and slime ambient quieter;
- groundwork for 009 settings, which must control master/per-bus volume on top of those adjustments without overwriting them.

Without an explicit contract, 008 would lock magic gain multipliers into system code, mix file loudness correction with gameplay volume in one place, leak archetype mappings into `src/shared/content/**`, and force 009 to reopen the same contract. This decision defines the MVP audio model.

## Decision

### Placement

- The whole audio stack lives under `src/main/audio/**`. The project does not gain new root directories (see [web-stack.md](web-stack.md)).
- No `src/main/audio/**` module may import from `src/sim/**`. Contact with simulation happens only through the established `SimWorkerHost` API (`onEvent`/`snapshotPair`/`isPaused`); `UiShell` fans out to `Audio`, as it does for `Hud` ([main-ui-shell.md](main-ui-shell.md)).
- Mappings from archetype/event to `sampleId` live in `src/main/audio/**`, **not** in `src/shared/content/**`. They are presentation data, not gameplay content: only main reads them, they do not enter `SessionDefinition`, and they do not affect run outcome. `EnemyArchetype`/`WeaponArchetype`/`BossArchetype` in [content-archetypes.md](content-archetypes.md) are **not** extended with audio fields; binding uses the string `archetypeId` already present in snapshots/events.

### AudioContext and unlock

- The app has **one** `AudioContext`, created on `UiShell` startup beside `Hud`/`SimWorkerHost` and kept for the full app lifetime. `stopSession` does not recreate the context, just as it does not `worker.terminate()` ([thread-model.md](thread-model.md)).
- Before the first user gesture, browsers keep `AudioContext` in `suspended`. `Audio.unlock()` is idempotent and:
  - is called by `UiShell` from a capturing one-shot listener on `pointerdown`/`keydown`;
  - moves `AudioContext` to `running` through `resume()`;
  - before the first successful unlock, all playback attempts are no-ops with a warning through the shared log module ([logging.md](logging.md)).
- `Audio.unlock()` is independent of session state: it applies in `menu` and every other phase. This allows UI sounds to play on the first click/button once unlocked.

### Mixer graph

- Source connection graph:
  ```text
  source -> perSourceTrim -> categoryBus -> master -> destination
  ```
- Categories (`bus`) for 008-009: `sfx`, `music`, `ui`. Adding another bus, such as `voice` for slime ambient or `ambience` for non-local sounds, is an explicit extension of **this** file. Systems must not introduce buses locally.
- In 008 baseline, `master` and all buses start at `1.0`. Story 009 controls them through `client settings` ([content-boundaries.md](content-boundaries.md)) and does not introduce a separate volume contract; it writes into the existing graph points.
- The graph is entirely described in `src/main/audio/**`; concrete `GainNode`/`AudioBufferSourceNode` wiring is an implementation detail.

### Two-layer volume: sample registry

Audio "magic numbers" represent two **different** axes:

1. Source-file loudness correction, changed when the file is rewritten or replaced.
2. Gameplay role loudness, changed when the sound's place in the game changes: shotgun louder than pistol, slime ambient intentionally subdued.

The sample registry separates those axes and combines them by a fixed formula.

- Each sample entry contains at least:
  ```ts
  type SampleCategory = 'sfx' | 'music' | 'ui';

  type SampleEntry = Readonly<{
    id: string;                     // stable, unique in registry
    url: string;                    // path relative to public/
    category: SampleCategory;
    normalizedGain: number;         // (0, 2], source-file loudness correction
    defaultGain: number;            // [0, 2], gameplay loudness
    loop?: boolean;                 // true for music/ambience
  }>;
  ```
- For `category: 'music'`, `loop` must be `true`. This is a module invariant: session music is contracted as "one track for the whole session" ([session-definition.md](session-definition.md), `musicSampleId`), and `Audio` must not rely on "restart it myself in `onended`". Violation is an `Audio` initialization error (see "Budgets and invariants").
- Effective gain for playback:
  ```text
  effectiveGain =
    sample.normalizedGain
    * sample.defaultGain
    * (perCallGainMul ?? 1)
    * busGain[sample.category]
    * masterGain
  ```
  `perCallGainMul` is an optional situational multiplier, such as future distance falloff; `busGain`/`masterGain` are graph nodes.
- The formula describes final effective gain at `destination`. In the Web Audio graph, these multipliers are distributed so each appears exactly once:
  - `perSourceTrim.gain.value = sample.normalizedGain * sample.defaultGain * (perCallGainMul ?? 1)`;
  - `busGain[category].gain.value` belongs to the bus node and changes only through extensions of this file; at the 008 horizon it is static `1.0`;
  - `masterGain.gain.value` belongs to the master node and is the single point for 009 (see "Settings integration").
- Inlining `busGain`/`masterGain` into `perSourceTrim` is forbidden: it breaks live volume changes for already playing sources and duplicates multipliers for new ones. Changing `gain.value` on bus/master nodes applies normally, by Web Audio semantics, to all connected sources including already playing ones.
- Field content rules:
  - `normalizedGain` is chosen by ear/measurement in the registry, **not** in consumer systems. Change it only when replacing the file.
  - `defaultGain` expresses design intent for how loud this role should sound in neutral conditions. Change it when the sound's game role changes, such as reducing slime ambient to `0.2`.
  - Explicit baseline points in 008:
    - `weapons/shotgun.mp3`: `normalizedGain ~= 0.35`, because the source file is much louder than other weapons;
    - `music/*.mp3` under `public/sfx/music/**`: `normalizedGain ~= 1.6`, because source files are quiet, including old menu ticking and session music;
    - `music/digital-dawn.mp3`: `normalizedGain ~= 0.55`, used as menu music and louder than the previous menu ticking source;
    - `slimes/slime-*` as ambient: `defaultGain ~= 0.3`, a subdued background that does not cover shots and hits.
- Forbidden:
  - hard-coded numeric gain multipliers in consumer system code. If a sound is wrong, fix the registry, not the system.
  - registry in `src/shared/content/**`. Audio data is not part of the `content library`: it **does not** affect simulation and is not serialized as a session contract.

### Archetype/event to sampleId mapping

The audio layer owns explicit maps keyed by string `archetypeId` values already available in snapshots/events:

- `weapons: Record<weaponArchetypeId, { fire: SampleSpec }>`: in 008, one real consumer (`pistol`); entries for `shotgun`/`smg`/`sniper`/`laser` may exist before those `WeaponArchetype`s exist in `content/**`.
- `enemies: Record<enemyArchetypeId, { hit?: SampleSpec; death?: SampleSpec; voice?: SampleSpec }>` for slime archetypes; stationary training targets may have empty entries.
- `bosses: Record<bossArchetypeId, { fire?: SampleSpec; hit?: SampleSpec; death?: SampleSpec; phaseChange?: SampleSpec }>`; 008 baseline for `slime-king`: `fire = boss-fireball`, `phaseChange = boss-ahaha`.
- `events: { dropPickup?: SampleSpec; dropSpawn?: SampleSpec; dropExpire?: SampleSpec; victoryFanfare?: SampleSpec; uiOverlayShow?: SampleSpec; uiButtonClick?: SampleSpec; uiButtonHover?: SampleSpec; uiModeSwitch?: SampleSpec }` for events without a natural archetype. 008 fills at least `dropPickup`, `uiOverlayShow`, and `uiButtonClick`; story 023 adds `uiButtonHover` and `uiModeSwitch` by reusing existing UI samples; story 024 adds `victoryFanfare = ui/fanfare`.
- `SampleSpec` may be a single `sampleId` or a `sampleId[]`; arrays play one random member (presentation RNG, see below). This supports short variation pools, such as `slime-1..4` for hit/voice.
- Missing mapping is **not** an error. It explicitly means "skip sound": `Audio` logs one warning per unique `archetypeId`/`event` through the shared log module ([logging.md](logging.md)) and does not warn again in the same session. This is intentional: new archetypes should not break a run only because their audio mapping is not ready.
- Mappings are validated at initialization: every `sampleId` must resolve to a `SampleEntry`. Unknown `sampleId` is a module error, not a runtime fallback, analogous to "unknown archetype id is a build/session-start error" from [content-archetypes.md](content-archetypes.md).

### Trigger sources

`Audio` subscribes to three channels:

1. **Runtime events** (fan-out from `UiShell`):
   - `fire` -> one-shot by `weapons[event.weaponArchetypeId].fire`. For `event.ownerKind === 'boss'`, mapping uses `bosses[bossArchetypeId].fire`; concrete `bossArchetypeId` comes from active `SessionDefinition` (MVP boss encounter has one boss).
   - `hit` -> `enemies[archetypeId].hit` or `bosses[archetypeId].hit`; target `archetypeId` is found through the current snapshot by `event.targetId`.
   - `death` -> `enemies[archetypeId].death` / `bosses[archetypeId].death`. For `entityKind === 'player'`, 008 has no mapping and skips it.
   - `dropPickup` -> `events.dropPickup`.
   - `bossPhaseChange` -> `bosses[bossArchetypeId].phaseChange`.
   - `win` -> `events.victoryFanfare`; `loss` intentionally silent except for result overlay show below.
   - Other kinds (`dropSpawn`/`dropExpire`/`encounterStart`/`encounterEnd`/`pause`/`resume`/`loss`/`sessionStart`/`sessionStop`) are not voiced in 008. Wiring them is an extension of this file.
2. **Snapshot pair** (called from `UiShell.onFrame`):
   - Music selector decides the current track from `phase` and `snapshot.encounter.type` (see below).
   - Ambient slime voices walk `snapshot.entities[kind === 'enemy']` and use per-archetype voice timers (see below).
3. **UI phase** (explicit call from `UiShell` on phase change):
   - `menu -> running`: no-op; UI sound already played on button click.
   - `running -> paused`: play `events.uiOverlayShow`.
   - `paused -> running`: no-op.
   - `running -> result(*)`: play `events.uiOverlayShow`.
   - `* -> menu` explicit exit: no-op.

`Audio` sends nothing to `SimWorkerHost`, never mutates it, and does not subscribe to `onEvent` directly. All integration goes through `UiShell`.

### Ambient slime voices without runtime event

Simulation has no "slime moved" event, and adding one just for audio in [snapshot-shape.md](snapshot-shape.md) would violate "runtime events are edge facts". Slime ambient is implemented in `Audio` without expanding the sim contract:

- On each `update(snapshotPair, ...)`, `Audio` examines `snapshot.entities[kind === 'enemy']`.
- Each living enemy has a per-entity timer `nextVoiceAtMs`. When it expires, a random `sampleId` from `enemies[archetypeId].voice` is chosen, if present, played as a one-shot, and the timer becomes `now + randomBetween(intervalMinMs, intervalMaxMs)`. `intervalMinMs`/`intervalMaxMs` live in `enemies[archetypeId].voice` beside sample ids.
- Enemies removed between snapshots lose their timer. New enemies get first `nextVoiceAtMs = now + randomBetween(...)`, with no immediate wave burst.
- `defaultGain` for voice samples is intentionally low (see above).
- Randomness source is `Math.random()` in main, **not** session RNG: ambient must not affect authoritative state and may differ between two runs with the same `seed` ([rng.md](rng.md)). This is an explicit excluded case.

### Music selector

- Regular track source is **session-level** `SessionDefinition.musicSampleId` ([session-definition.md](session-definition.md)). There is no `regularPool` owned by `Audio`: story 021 removed hard-coded code pools, and music choice belongs to game design in `content/sessions/*.md`.
- `bossTrack: sampleId` remains fixed as `boss/boss-music.mp3`. Per-boss custom music and per-wave music are out of scope.
- Selection rules, defining what **should** play now:
  - `phase === menu` -> fixed menu track `music/digital-dawn`.
  - `phase in { loading, result, error('preload') }` -> music silent, regardless of `musicSampleId`.
  - `phase in { running, paused }` and no active `snapshot.encounter`, or `encounter.type !== 'boss'` -> play `attachedSession.musicSampleId`. If `musicSampleId === null`, regular music is silent; this is a legitimate sandbox/dev configuration.
  - `phase in { running, paused }` and `encounter.type === 'boss'` -> play `bossTrack`. Leaving boss encounter returns regular music to `attachedSession.musicSampleId`.
  - In `paused`, music is **ducked**: `musicBus` is temporarily multiplied by `0.5`. Music is **not** stopped and track does not change. This simplifies Web Audio, avoiding correct pause/resume of `AudioBufferSourceNode`, and gives a softer pause UX.
- `musicSampleId` is immutable for the active session, like all `SessionDefinition`. New session -> new `attach(session)` -> selector reevaluates.
- The selected regular track does not rotate: one session means one regular track. In-run rotation was an artifact of old `regularPool` and is removed with it. Future per-encounter music extends this file and [session-definition.md](session-definition.md), not by reintroducing an `Audio` pool.
- The exact transition method when switching `running <-> boss`, such as hard cut or crossfade, is an implementation detail. The contract defines only what plays and when.

### UI sounds

- `events.uiOverlayShow`, for example `ui/open-1.mp3`, plays when `PauseOverlay` and `ResultOverlay` appear. One-shot on phase transition.
- `events.uiButtonClick`, for example random from `ui/switch-1`, `ui/switch-3`, `ui/switch-4`, plays on any `MenuOverlay`, `PauseOverlay`, or `ResultOverlay` button click except difficulty/mode switching. Binding is through explicit `Audio.playUi('buttonClick')` calls from those components; components do not touch `AudioContext` directly and do not know `sampleId`.
- `events.uiButtonHover`, for example `ui/open-1.mp3`, plays on hover/focus-like feedback for menu buttons. Binding is through explicit `Audio.playUi('buttonHover')` from `UiShell`; `MenuOverlay` only reports button hover events and does not know `sampleId`.
- `events.uiModeSwitch` (`ui/switch-2.mp3`) plays only when the selected mode/difficulty actually changes in `MenuOverlay`; selecting the already active mode does not play it.
- UI sounds are category `ui` and pass through `uiBus`, allowing 009 to control them separately from sfx/music later.

### Pause semantics

- Simulation publishes no events in `paused` (see [runtime-systems.md](runtime-systems.md), [thread-model.md](thread-model.md)), so new SFX/boss/drop sounds do not occur by themselves.
- Already playing one-shot sources finish. `Audio` should not forcibly mute them; that would create audio cuts on short pauses.
- Music is ducked (see above).
- Ambient slime voices are **paused**: `Audio` skips its snapshot-driven phase while `phase === 'paused'` and does not advance per-entity voice timers. On `paused -> running`, timers continue from previous values. It is acceptable to shift wall-clock base by pause duration; exact mechanics are implementation detail.

### Lifecycle and API

- `UiShell` creates exactly one `Audio` instance in `createUiShell`, next to `Hud` and `SimWorkerHost`.
- Minimal API:
  ```ts
  type Audio = Readonly<{
    unlock(): void;
    handleEvent(event: RuntimeEvent): void;
    update(snapshotPair: SnapshotPair, phase: UiShellPhase, encounter: EncounterSnapshot | null): void;
    attach(session: SessionDefinition): void;
    detach(): void;
    playUi(eventId: 'overlayShow' | 'buttonClick' | 'buttonHover' | 'modeSwitch'): void;
    setMasterGain(value: number): void;
    dispose(): void;
  }>;
  ```
- `attach(session)` provides immutable session data, such as active encounter `bossArchetypeId`, without subscribing to snapshots in `menu`.
- `UiShell` must:
  - call `audio.unlock()` on the first user gesture, once;
  - fan out `SimWorkerHost.onEvent` to `audio.handleEvent` the same way it does today in `handleSimEvent`;
  - call `audio.update(snapshotPair, phase, encounter)` exactly once per frame in `onFrame`, after `hud.update`;
  - call `audio.attach(session)` on session start and `audio.detach()` on session end/return to menu, like `hud`;
  - call `audio.playUi('overlayShow')` when pause/result overlays appear, forward `audio.playUi('buttonClick')` in overlay click handlers, `audio.playUi('buttonHover')` for menu hover feedback, and `audio.playUi('modeSwitch')` when mode actually changes.
- `Audio` never uses `SimWorkerHost.onEvent` directly and never creates its own `pointerdown`/`keydown` listener. This preserves the "one orchestration owner" invariant from [main-ui-shell.md](main-ui-shell.md).

### Budgets and invariants

- Simultaneously active one-shot sources <= **32**. Above that, drop oldest by stopping the oldest source. This is enough for expected MVP enemy/projectile counts and prevents unbounded graph-node growth during spawn bursts.
- Sample registry and mappings are validated once on `Audio` initialization:
  - duplicate `sampleId` in registry: module error;
  - `sampleId` in mapping without registry entry: module error;
  - `normalizedGain in (0, 2]`, `defaultGain in [0, 2]`; otherwise warning through the shared log module and value **clamped** into allowed range;
  - any entry with `category: 'music'` and `loop !== true`: module error, supporting the "one track for whole session" contract (see "Two-layer volume");
  - URL is not validated online; missing file is reported as warning on first playback attempt.
- `attach(session)` additionally validates `session.musicSampleId`:
  - `null`: ok, regular music silent for the whole run;
  - string not present in `SampleRegistry`: module error, not warning. Unknown id should be caught by content-build and builder before session start (see [content-authoring.md](content-authoring.md), `# Session`);
  - string whose `SampleRegistry[*].category !== 'music'`: module error. Session music must be category `music` so it goes through `musicBus` and receives pause ducking.
- `Audio` must not have hidden global state: all timers and decisions live in the instance created by `UiShell`. One instance for app lifetime; repeated initialization is not in MVP.

### Tests

- `Audio` is tested without a real `AudioContext`: introduce a narrow `AudioApi` for creating `GainNode`/`AudioBufferSource`, `decodeAudioData`, and `currentTime`, replaced with fake implementation in tests. This follows the established `src/main/ui/**` pattern (see `UiShell.test.ts`).
- Required tests:
  - effective gain calculation for a typical sample, multiplying all layers;
  - registry validation: duplicate `id`, unknown `sampleId` in mapping, clamp `normalizedGain`/`defaultGain`;
  - runtime event routing to correct `sampleId`, including "no mapping -> skip + one warning" fallback;
  - music selector switching on `phase` and `encounter.type`, including ducking in `paused`;
  - ambient slime voice does not advance timers in `paused` and reinitializes for new entities.
- No tests should introduce regressions to [snapshot-shape.md](snapshot-shape.md) or [main-ui-shell.md](main-ui-shell.md): `Audio` sits below those contracts.

### Settings integration (009)

- 009 controls volume **only** through master gain. At the 009 horizon this is the only gameplay volume axis; per-bus volume (`sfx`/`music`/`ui` separately) is explicitly out of scope ([../stories/009-settings.md](../stories/009-settings.md)).
- `Audio.setMasterGain(value)`:
  - accepts a number; clamps to `[0, 1]` before applying, and logs out-of-range values as warning through the shared log module ([logging.md](logging.md));
  - assigns `runtime.masterGain.gain.value`, the only legitimate external point for changing master gain;
  - is idempotent: repeated calls with the current value assign again but have no observable effect (Web Audio `gain.value = same` is a no-op);
  - works in every state: before `unlock()`, in `menu`, during `running`/`paused`/`result`, before and after `attach`/`detach`. It does not depend on active session or `AudioContext` state.
- `setMasterGain` **never** writes persistent storage and never subscribes to `ClientSettingsStore`. Flow is the opposite: `UiShell` subscribes `Audio` to `masterVolume` changes in [client-settings.md](client-settings.md) and calls `audio.setMasterGain(settings.masterVolume)` on every change and once at initialization.
- Direct access to `runtime.masterGain` or `runtime.busGains[*]` from outside the module is forbidden. Any future axis, such as per-bus volume or gameplay-effect ducking, must be added as an explicit `Audio` API rather than by leaking `GainNode`s.

### Extension

- Adding a new sample means adding a registry entry and, if needed, a mapping entry. No update to this file is required.
- Adding a new mapping channel, such as `enemies[archetypeId].spawn` for spawn sound, requires extending this file with a section and playback rules. Local system code must not add it silently.
- Adding a new bus, such as `voice` or `ambience`, requires updating "Mixer graph" here and synchronizing 009 settings.
- If a future reactive sample needs a runtime event that does not exist yet, such as a pickup effect or musical stinger on `bossPhaseChange`, the new event is defined first in [snapshot-shape.md](snapshot-shape.md), and only then mapped here.

## Consequences

- 008 and 009 share one mix graph and one source of truth for gain; magic gain numbers are concentrated in one registry.
- File loudness correction and gameplay loudness become independent axes: replacing a file does not blur game balance, and changing balance does not require touching file corrections.
- `EnemyArchetype`/`WeaponArchetype`/`BossArchetype` in `src/shared/content/**` remain free of presentation fields; new enemies/bosses can be added without changing content library contracts.
- Simulation does not receive extra events for audio: slime ambient is entirely main-side and snapshot-driven.
- `UiShell` remains the single orchestrator; unlock/event/phase routing is centralized.
- 009 settings has ready infrastructure: master/per-bus gain are already graph nodes, so only the `client settings` layer needs to control and persist them.
- Cost: archetype-to-sample mapping must be maintained when adding archetypes. The decision deliberately makes missing mapping a warning rather than an error so gameplay stories are not blocked.

## Related

- [thread-model.md](thread-model.md)
- [main-ui-shell.md](main-ui-shell.md)
- [snapshot-shape.md](snapshot-shape.md)
- [runtime-systems.md](runtime-systems.md)
- [content-boundaries.md](content-boundaries.md)
- [content-archetypes.md](content-archetypes.md)
- [session-definition.md](session-definition.md)
- [client-settings.md](client-settings.md)
- [web-stack.md](web-stack.md)
- [rng.md](rng.md)
- [logging.md](logging.md)
- [testing.md](testing.md)
- [../docs/VISION.md](../docs/VISION.md)
- [../stories/008-audio-baseline.md](../stories/008-audio-baseline.md)
- [../stories/009-settings.md](../stories/009-settings.md)
- [content-authoring.md](content-authoring.md)
