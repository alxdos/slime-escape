# Online Client-Side Prediction

- Status: planned
- Created: 2026-04-30
- Updated: 2026-04-30

## Product intent

Today every online action on the local player travels server-and-back before it shows on screen — a `RTT/2 + SNAPSHOT_INTERVAL_MS` delay even on a perfect connection (33 ms minimum at `30 Hz` snapshots). For a fast-paced PvP arena that is felt as input lag. With the shared simulation core in place (story 034), the same `MovementSystem` that the server uses for authoritative movement can run on the client for its own player only, applying input immediately and reconciling against authoritative snapshots when they arrive. This story delivers that, in the standard "Source-style" netcode shape: client predicts its own player, interpolates others, server stays authoritative for everything that matters (hits, HP, deaths, levels, boss transforms, projectile motion). Other players are not extrapolated — that direction is explicitly out of scope and stays so unless a future story revisits it with measured justification.

## Player-facing

- Sees: in online play, the local player's slime reacts to movement and aim input immediately, without the snapshot round-trip delay.
- Sees: other players continue to move smoothly, just as before.
- Sees: at the moment authoritative state corrects a mispredicted local position (rare, e.g. wall clip, knockback, spawn snap), the correction blends smoothly over a short window rather than snapping.
- Sees: no change to local single-player play; this only affects online modes.

## Technical

Source-style client-side prediction for the local player only. The shared `MovementSystem` from `src/shared/sim/**` is imported on the client and run against the local input stream to produce a predicted self-position used for rendering and aim. Each outgoing input intent carries a monotonically increasing `inputSequence`. The Node arena host tracks the last input sequence applied per actor and includes it in snapshots delivered to that actor. On receiving a snapshot, the client trims inputs at or before `lastInputSequence` from its local buffer, takes the authoritative position from the snapshot, and replays remaining buffered inputs through the shared `MovementSystem` to produce the corrected predicted state. If the corrected state agrees with the previous predicted state within an epsilon, no visible change; if it diverges, the client smoothly blends from the previously rendered position toward the corrected predicted position over a small fixed window (e.g. ~100 ms). Other players, projectiles, and any non-self entity continue to be rendered through snapshot interpolation per [simulation-timing.md](../design/simulation-timing.md), with no extrapolation. Server authority is unchanged: hits, HP, deaths, level changes, boss transforms, weapon cooldown, and projectile lifetime are decided server-side.

## Out of scope

- Extrapolation of other players — explicitly not done; conflicts with the "extrapolation is forbidden" rule from [simulation-timing.md](../design/simulation-timing.md), and is a known artifact source on direction changes.
- Rollback/GGPO-style netcode where every client predicts every actor — separate paradigm, not adopted here.
- Server-side lag compensation (rewind-for-hits) — separate technique, not required for slow projectile combat in this game.
- Snapshot delta encoding, compression, or any other transport optimization.
- Any change to combat hit determination, projectile motion authority, HP, death, level rules, or boss transforms — server stays the source of truth.
- Local single-player play — unchanged.

## Acceptance

- In online PvP, the local player's rendered position responds to movement input within a single render frame, independent of network RTT.
- Other players' rendered motion is unchanged from current behavior (snapshot interpolation only, no extrapolation).
- Server-side gameplay authority is preserved end-to-end: a deterministic test or scenario shows that a client cannot retain an advantage by mispredicting its position when the server disagrees.
- A divergence between predicted and authoritative position resolves smoothly over a small recorded window (no snap, no permanent offset).
- Under simulated network conditions (e.g. browser dev-tools throttling at 100/200 ms RTT), the local player's input feels as responsive as offline play; other players show the same interpolation lag as before.
- All existing local single-player and online tests pass without regression.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [ ] | Architectural PR: record the prediction contract in a new `design/online-client-prediction.md` decision (what is predicted, what is not, reconciliation rule, divergence-blend window, input sequence contract, integration with snapshot interpolation). Extend [input-commands.md](../design/input-commands.md) with the `inputSequence` field, and the online host protocol decision (`online-session-hosting.md` from story 036) with `lastInputSequence` per self-actor in snapshots. | Architectural PR, no code. Depends on stories 034 and 036 being merged. |
| T2 | [ ] | Extend the online input intent shape with `inputSequence: number`, monotonically increasing per session. Update server intake to read it. | Code PR, depends on T1. |
| T3 | [ ] | Server (Node arena host) tracks the last applied input sequence per actor and includes `lastInputSequence` in the snapshot delivered to that actor. | Code PR, depends on T2. |
| T4 | [ ] | Client maintains a buffer of sent inputs keyed by sequence; runs the shared `MovementSystem` against the local input to produce a predicted self-position; on snapshot arrival, drops acknowledged inputs and replays the remainder against the received authoritative state. | Code PR, depends on T2. |
| T5 | [ ] | Renderer uses the predicted self-position for the local player and interpolated state for everyone else. Divergence between previous-rendered and corrected predicted position blends over the recorded window. | Code PR, depends on T4. |
| T6 | [ ] | Tests: local-buffer trim on `lastInputSequence` ack, replay correctness on divergence, smooth blend bound, no-extrapolation-of-others invariant. | Depends on T5. |
| T7 | [ ] | Run automated checks (typecheck, tests, build) and request live online verification, including a test under throttled network (e.g. `100 ms`/`200 ms` simulated RTT) to confirm input feel and absence of snap on correction. | |

## Related

- [simulation-runtime.md](../design/simulation-runtime.md)
- [simulation-timing.md](../design/simulation-timing.md)
- [input-commands.md](../design/input-commands.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [034-extract-sim-core.md](034-extract-sim-core.md)
- [036-node-arena-host.md](036-node-arena-host.md)
