import { describe, expect, it, vi } from 'vitest';

import type { RuntimeEvent } from '../../../src/shared/events.js';
import type { Snapshot } from '../../../src/shared/snapshot.js';
import type { SimulationCore, SimulationCoreOptions } from '../../../src/shared/sim/SimulationCore.js';
import { SIM_STEP_MS } from '../../../src/shared/timing.js';
import {
  ARENA_HOST_INPUT_RATE_LIMIT_MAX,
  acceptArenaHostInputIntent,
  arenaHostEventRecipients,
  cornerSpawns,
  createArenaHost,
  createArenaHostInputRateLimitState,
  type ArenaHostClock,
  type ArenaHostEvent,
  type ArenaHostSink
} from './host.js';

describe('ArenaHost policy shell', () => {
  it('starts the shared core once and owns the pump interval', () => {
    const core = createCoreHarness();
    const clock = createClockHarness();
    const host = createArenaHost({
      playerCap: 4,
      tickHz: 60,
      snapshotHz: 30,
      sink: createSinkHarness().sink,
      clock: clock.clock,
      coreFactory: core.factory
    });

    host.start();
    host.start();

    expect(core.core.start).toHaveBeenCalledTimes(1);
    expect(core.core.start.mock.calls[0]?.[0]).toMatchObject({
      id: 'public-arena-host-session',
      dynamicRoster: true,
      players: []
    });
    expect(clock.intervals).toHaveLength(1);
    clock.now = 250;
    clock.intervals[0]?.handler();
    expect(core.core.pump).toHaveBeenCalledWith(250);

    host.stop();

    expect(clock.cleared).toEqual([clock.intervals[0]?.handle]);
    expect(core.core.stop).toHaveBeenCalledTimes(1);
  });

  it('accepts joins up to the cap and spawns actors from session-derived corners', () => {
    const core = createCoreHarness();
    const sink = createSinkHarness();
    const host = createArenaHost({
      playerCap: 1,
      tickHz: 60,
      snapshotHz: 30,
      sink: sink.sink,
      clock: createClockHarness().clock,
      coreFactory: core.factory
    });
    host.start();

    const accepted = host.join('socket-a');
    const rejected = host.join('socket-b');

    expect(accepted).toMatchObject({
      kind: 'accepted',
      actorId: 'socket-a',
      population: 1,
      playerCap: 1
    });
    expect(rejected).toMatchObject({
      kind: 'rejected',
      reason: 'arenaFull',
      population: 1,
      playerCap: 1
    });
    expect(core.core.addPlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'socket-a',
        position: { x: -13.5, y: -13.5 }
      }),
      { invulnerableUntilSimMs: 900 }
    );
    expect(core.core.setPlayerForm).toHaveBeenCalledWith(
      'socket-a',
      expect.objectContaining({ formArchetypeId: 'slime-one-eye' }),
      { refillHp: true }
    );
    expect(cornerSpawns(host.session().arena, 0.5)[0]).toEqual({ x: -13.5, y: -13.5 });
  });

  it('rate-limits accepted socket input before forwarding to the core', () => {
    const state = createArenaHostInputRateLimitState(1000);
    for (let i = 0; i < ARENA_HOST_INPUT_RATE_LIMIT_MAX; i += 1) {
      expect(acceptArenaHostInputIntent(state, 1200)).toBe(true);
    }
    expect(acceptArenaHostInputIntent(state, 1500)).toBe(false);
    expect(acceptArenaHostInputIntent(state, 2000)).toBe(true);

    const core = createCoreHarness();
    const host = createArenaHost({
      playerCap: 2,
      tickHz: 60,
      snapshotHz: 30,
      sink: createSinkHarness().sink,
      clock: createClockHarness(1000).clock,
      coreFactory: core.factory
    });
    host.start();
    host.join('socket-a');

    expect(host.submitInput('socket-a', { kind: 'fire', phase: 'start' }, 1200)).toBe(true);
    expect(core.core.submitInput).toHaveBeenCalledWith('socket-a', {
      kind: 'fire',
      phase: 'start'
    });
    expect(host.submitInput('missing', { kind: 'fire', phase: 'start' }, 1200)).toBe(false);
  });

  it('fans shared core snapshots out to every joined actor', () => {
    const core = createCoreHarness();
    const sink = createSinkHarness();
    const host = createArenaHost({
      playerCap: 4,
      tickHz: 60,
      snapshotHz: 30,
      sink: sink.sink,
      clock: createClockHarness().clock,
      coreFactory: core.factory
    });
    host.start();
    host.join('socket-a');
    host.join('socket-b');
    const snapshot = makeSnapshot();

    core.snapshot(snapshot);

    expect(sink.sink.emitSnapshot).toHaveBeenCalledTimes(2);
    expect(sink.sink.emitSnapshot).toHaveBeenCalledWith('socket-a', snapshot);
    expect(sink.sink.emitSnapshot).toHaveBeenCalledWith('socket-b', snapshot);
  });

  it('computes recipients from shared runtime events and host events', () => {
    const actors = new Map([
      ['a', { actorId: 'a', entityId: 1, level: 1 }],
      ['b', { actorId: 'b', entityId: 2, level: 1 }],
      ['c', { actorId: 'c', entityId: 3, level: 1 }]
    ]);

    expect(
      arenaHostEventRecipients(
        {
          kind: 'hit',
          simTime: 1,
          projectileId: 5,
          ownerId: 1,
          ownerKind: 'player',
          targetId: 2,
          targetKind: 'player',
          targetArchetypeId: null,
          weaponArchetypeId: 'pistol',
          damage: 1,
          impactDirX: 1,
          impactDirY: 0,
          x: 0,
          y: 0
        },
        actors
      )
    ).toEqual(['a', 'b']);
    expect(
      arenaHostEventRecipients(
        {
          kind: 'explosion',
          simTime: 1,
          projectileId: 5,
          ownerId: 1,
          ownerKind: 'player',
          weaponArchetypeId: 'bomb-placer',
          damage: 3,
          radius: 2,
          x: 0,
          y: 0
        },
        actors
      )
    ).toEqual(['a']);
    expect(arenaHostEventRecipients(deathEvent(2, 1), actors)).toEqual(['a', 'b', 'c']);
    expect(
      arenaHostEventRecipients(
        {
          kind: 'host:levelUp',
          simTime: 1,
          actorId: 'a',
          level: 2,
          formArchetypeId: 'slime-hornling'
        },
        actors
      )
    ).toEqual(['a']);
  });

  it('applies death policy ops through the core and emits ordered host events', () => {
    const core = createCoreHarness();
    const sink = createSinkHarness();
    const host = createArenaHost({
      playerCap: 4,
      tickHz: 60,
      snapshotHz: 30,
      sink: sink.sink,
      clock: createClockHarness().clock,
      coreFactory: core.factory
    });
    host.start();
    host.join('victim');
    host.join('killer');
    core.emit(playerSpawn('victim', 10));
    core.emit(playerSpawn('killer', 20));
    core.core.addPlayer.mockClear();
    core.core.setPlayerForm.mockClear();
    sink.events.length = 0;

    core.emit(deathEvent(10, 20));

    expect(core.core.addPlayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'victim' }),
      { invulnerableUntilSimMs: 1900 }
    );
    expect(core.core.setPlayerForm).toHaveBeenCalledWith(
      'victim',
      expect.objectContaining({ formArchetypeId: 'slime-one-eye' }),
      { refillHp: true }
    );
    expect(core.core.setPlayerForm).toHaveBeenCalledWith(
      'killer',
      expect.objectContaining({ formArchetypeId: 'slime-hornling' }),
      { refillHp: true }
    );
    expect(sink.events.map((entry) => entry.event.kind)).toEqual([
      'death',
      'death',
      'host:levelUp'
    ]);
    expect(host.actors().find((actor) => actor.actorId === 'killer')?.level).toBe(2);
    expect(host.actors().find((actor) => actor.actorId === 'victim')?.level).toBe(1);
  });
});

function createCoreHarness(): Readonly<{
  core: SimulationCore & {
    start: ReturnType<typeof vi.fn<SimulationCore['start']>>;
    stop: ReturnType<typeof vi.fn<SimulationCore['stop']>>;
    submitInput: ReturnType<typeof vi.fn<SimulationCore['submitInput']>>;
    addPlayer: ReturnType<typeof vi.fn<SimulationCore['addPlayer']>>;
    removePlayer: ReturnType<typeof vi.fn<SimulationCore['removePlayer']>>;
    setPlayerForm: ReturnType<typeof vi.fn<SimulationCore['setPlayerForm']>>;
    pump: ReturnType<typeof vi.fn<SimulationCore['pump']>>;
  };
  factory(options: SimulationCoreOptions): SimulationCore;
  emit(event: RuntimeEvent): void;
  snapshot(snapshot?: Snapshot): void;
}> {
  let options: SimulationCoreOptions | null = null;
  const core = {
    start: vi.fn<SimulationCore['start']>(),
    stop: vi.fn<SimulationCore['stop']>(),
    pause: vi.fn<SimulationCore['pause']>(),
    resume: vi.fn<SimulationCore['resume']>(),
    submitInput: vi.fn<SimulationCore['submitInput']>(),
    addPlayer: vi.fn<SimulationCore['addPlayer']>(),
    removePlayer: vi.fn<SimulationCore['removePlayer']>(),
    setPlayerForm: vi.fn<SimulationCore['setPlayerForm']>(),
    pump: vi.fn<SimulationCore['pump']>()
  };
  return {
    core,
    factory(nextOptions) {
      options = nextOptions;
      return core;
    },
    emit(event) {
      options?.onEvent(event);
    },
    snapshot(snapshot = makeSnapshot()) {
      options?.onSnapshot(snapshot);
    }
  };
}

function createClockHarness(now = 0): {
  now: number;
  intervals: Array<{ handle: object; handler: () => void; intervalMs: number }>;
  cleared: unknown[];
  clock: ArenaHostClock;
} {
  const harness = {
    now,
    intervals: [] as Array<{ handle: object; handler: () => void; intervalMs: number }>,
    cleared: [] as unknown[],
    clock: {
      nowMs: () => harness.now,
      setInterval(handler: () => void, intervalMs: number): unknown {
        const entry = { handle: {}, handler, intervalMs };
        harness.intervals.push(entry);
        return entry.handle;
      },
      clearInterval(handle: unknown): void {
        harness.cleared.push(handle);
      }
    }
  };
  return harness;
}

function createSinkHarness(): { sink: ArenaHostSink; events: Array<{ actorId: string; event: ArenaHostEvent }> } {
  const events: Array<{ actorId: string; event: ArenaHostEvent }> = [];
  return {
    events,
    sink: {
      emitSnapshot: vi.fn(),
      emitEvent(actorId, event): void {
        events.push({ actorId, event });
      },
      emitCloseReason: vi.fn()
    }
  };
}

function playerSpawn(playerId: string, entityId: number): RuntimeEvent {
  return {
    kind: 'playerSpawn',
    simTime: 100,
    entityId,
    playerId,
    x: 0,
    y: 0,
    formArchetypeId: null
  };
}

function deathEvent(entityId: number, killerId: number | null): Extract<RuntimeEvent, { kind: 'death' }> {
  return {
    kind: 'death',
    simTime: 1000,
    entityId,
    entityKind: 'player',
    archetypeId: null,
    weaponArchetypeId: 'rock-thrower',
    impactDirX: 1,
    impactDirY: 0,
    killerId,
    x: 0,
    y: 0
  };
}

function makeSnapshot(): Snapshot {
  return {
    simTimeMs: 100,
    entities: [],
    encounter: null,
    zone: { mode: 'disabled', margin: 0 },
    waveProgress: null,
    bossHud: null
  };
}
