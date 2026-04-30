import { describe, expect, it } from 'vitest';

import { buildSessionDefinition } from '../content/buildSession';
import { SANDBOX_PRESET } from '../content/sessions';
import type { RuntimeEvent } from '../events';
import type { Snapshot } from '../snapshot';
import { SIM_STEP_MS } from '../timing';

import { createSimulationCore } from './SimulationCore';

describe('SimulationCore', () => {
  it('runs lifecycle, input, snapshots, and stop through the public facade', () => {
    const snapshots: Snapshot[] = [];
    const events: RuntimeEvent[] = [];
    const core = createSimulationCore({
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      onEvent: (event) => events.push(event)
    });
    const session = buildSessionDefinition(SANDBOX_PRESET, { seed: 1 });

    core.pump(0);
    core.pump(SIM_STEP_MS * 10);
    expect(events).toHaveLength(0);
    expect(snapshots).toHaveLength(0);

    core.start(session);
    core.submitInput({ kind: 'move', dx: 1, dy: 0 });
    core.pump(0);
    core.pump(SIM_STEP_MS);

    expect(events.map((event) => event.kind)).toEqual(['sessionStart', 'encounterStart']);
    expect(snapshots).toHaveLength(1);
    const player = snapshots[0]?.entities.find((entity) => entity.kind === 'player');
    expect(player?.x).toBeGreaterThan(session.player.position.x);

    core.stop();
    expect(events.map((event) => event.kind)).toEqual([
      'sessionStart',
      'encounterStart',
      'encounterEnd',
      'sessionStop'
    ]);
    const snapshotsAfterStop = snapshots.length;

    core.pump(SIM_STEP_MS * 2);

    expect(snapshots).toHaveLength(snapshotsAfterStop);
  });
});
