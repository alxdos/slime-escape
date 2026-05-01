import { describe, expect, it } from 'vitest';

import { buildSessionDefinition } from '../content/buildSession';
import { SANDBOX_PRESET } from '../content/sessions';
import { PISTOL } from '../content/weapons';
import type { RuntimeEvent } from '../events';
import type { SessionDefinition } from '../session';
import type { Snapshot } from '../snapshot';
import { SIM_STEP_MS } from '../timing';

import { createSimulationCore } from './SimulationCore';

describe('SimulationCore', () => {
  it('accepts public input for two controlled actors and emits per-actor fire events', () => {
    const snapshots: Snapshot[] = [];
    const events: RuntimeEvent[] = [];
    const core = createSimulationCore({
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      onEvent: (event) => events.push(event)
    });
    const session = makeMultiActorSession();

    core.start(session);
    core.submitInput('alpha', { kind: 'move', dx: 1, dy: 0 });
    core.submitInput('alpha', { kind: 'aim', x: 5, y: 0 });
    core.submitInput('alpha', { kind: 'fire', phase: 'start' });
    core.submitInput('bravo', { kind: 'move', dx: -1, dy: 0 });
    core.submitInput('bravo', { kind: 'aim', x: -5, y: 0 });
    core.submitInput('bravo', { kind: 'fire', phase: 'start' });
    core.pump(0);
    core.pump(SIM_STEP_MS);

    const fireEvents = events.filter(
      (event): event is Extract<RuntimeEvent, { kind: 'fire' }> => event.kind === 'fire'
    );
    expect(fireEvents).toHaveLength(2);
    expect(fireEvents.map((event) => event.weaponArchetypeId)).toEqual([PISTOL.id, PISTOL.id]);
    expect(fireEvents.map((event) => Math.sign(event.dirX))).toEqual([1, -1]);
    const playerSnapshot = snapshots[0]?.entities.find((entity) => entity.kind === 'player');
    expect(playerSnapshot?.x).toBeGreaterThan(session.players[0].position.x);
  });

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
    core.submitInput(session.players[0].id, { kind: 'move', dx: 1, dy: 0 });
    core.pump(0);
    core.pump(SIM_STEP_MS);

    expect(events.map((event) => event.kind)).toEqual(['sessionStart', 'encounterStart']);
    expect(snapshots).toHaveLength(1);
    const player = snapshots[0]?.entities.find((entity) => entity.kind === 'player');
    expect(player?.x).toBeGreaterThan(session.players[0].position.x);

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

function makeMultiActorSession(): SessionDefinition {
  return {
    id: 'multi-actor-core-test',
    seed: 1,
    arena: { width: 32, height: 18 },
    players: [
      {
        id: 'alpha',
        position: { x: -1, y: 0 },
        radius: 0.5,
        contactBox: { width: 1, height: 1 },
        maxSpeed: 6,
        maxHp: 2,
        loadout: { weapons: [PISTOL.id], selectedIndex: 0 }
      },
      {
        id: 'bravo',
        position: { x: 1, y: 0 },
        radius: 0.5,
        contactBox: { width: 1, height: 1 },
        maxSpeed: 6,
        maxHp: 2,
        loadout: { weapons: [PISTOL.id], selectedIndex: 0 }
      }
    ],
    companion: null,
    backgrounds: [],
    musicSampleId: null,
    modifiers: [],
    rules: {
      damage: { slimeFriendlyFire: true },
      aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 }
    },
    encounters: [
      {
        id: 'sandbox',
        type: 'sandbox',
        backgroundId: null,
        introDurationMs: 0,
        name: null,
        text: null,
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'never', next: 'sequential' },
        tuning: null
      }
    ],
    winCondition: { kind: 'none' },
    lossCondition: { kind: 'playerDeath' },
    uiMeta: null
  };
}
