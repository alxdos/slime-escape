import { describe, expect, it, vi } from 'vitest';

import type { RuntimeEvent } from '../../../src/shared/events.js';
import type { Snapshot } from '../../../src/shared/snapshot.js';
import type { SimulationCore, SimulationCoreOptions } from '../../../src/shared/sim/SimulationCore.js';
import { SIM_STEP_MS } from '../../../src/shared/timing.js';
import { createOnlineSessionHost, type ArenaHostClock, type ArenaHostEvent, type ArenaHostSink } from './host.js';

describe('OnlineSessionHost room registry', () => {
  it('keeps Public Arena backward-compatible as an instant-running room', () => {
    const core = createCoreHarness();
    const clock = createClockHarness();
    const host = createOnlineSessionHost({
      playerCap: 4,
      tickHz: 60,
      snapshotHz: 30,
      sink: createSinkHarness().sink,
      clock: clock.clock,
      coreFactory: core.factory,
      roomIdFactory: (index) => `room-${index}`
    });

    const accepted = host.join('socket-a', { requestedSessionId: 'public-arena' });

    expect(accepted).toMatchObject({
      kind: 'accepted',
      actorId: 'socket-a',
      roomId: 'room-1',
      sessionConfigId: 'public-arena',
      roomState: 'running',
      maxPlayers: 200,
      lateJoinAllowed: true
    });
    expect(core.core.start).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'public-arena-room-1',
        dynamicRoster: true,
        players: []
      })
    );
    expect(core.core.addPlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'socket-a',
        position: { x: -13.5, y: -13.5 },
        companion: null
      }),
      { invulnerableUntilSimMs: 900 }
    );
    expect(core.core.setPlayerForm).toHaveBeenCalledWith(
      'socket-a',
      expect.objectContaining({ formArchetypeId: 'slime-one-eye' }),
      { refillHp: true }
    );
    expect(clock.intervals[0]?.intervalMs).toBe(SIM_STEP_MS);
  });

  it('publishes Public Arena actors as slime forms in the first authoritative snapshot', () => {
    const sink = createSinkHarness();
    const clock = createClockHarness();
    const host = createOnlineSessionHost({
      playerCap: 4,
      tickHz: 60,
      snapshotHz: 30,
      sink: sink.sink,
      clock: clock.clock,
      roomIdFactory: (index) => `room-${index}`
    });

    expect(host.join('socket-a', { requestedSessionId: 'public-arena' })).toMatchObject({
      kind: 'accepted',
      roomState: 'running'
    });

    clock.now = 0;
    clock.intervals[0]?.handler();
    clock.now = SIM_STEP_MS;
    clock.intervals[0]?.handler();

    const snapshot = sink.snapshots.at(-1)?.snapshot;
    const player = snapshot?.entities.find((entity) => entity.kind === 'player');
    expect(player).toMatchObject({
      kind: 'player',
      playerId: 'socket-a',
      formArchetypeId: 'slime-one-eye'
    });
  });

  it('holds co-op sessions in lobby until the host starts and then adds joined actors', () => {
    const core = createCoreHarness();
    const sink = createSinkHarness();
    const clock = createClockHarness();
    const host = createOnlineSessionHost({
      playerCap: 8,
      tickHz: 60,
      snapshotHz: 30,
      sink: sink.sink,
      clock: clock.clock,
      coreFactory: core.factory,
      roomIdFactory: (index) => `room-${index}`
    });

    const alpha = host.join('alpha', {
      requestedSessionId: 'coop-slime',
      selectedPetId: 'pet-01'
    });
    clock.now = 10;
    const bravo = host.join('bravo', {
      requestedSessionId: 'coop-slime',
      selectedPetId: null
    });

    expect(alpha).toMatchObject({ kind: 'accepted', roomState: 'open', roomId: 'room-1' });
    expect(bravo).toMatchObject({ kind: 'accepted', roomState: 'open', roomId: 'room-1' });
    expect(core.core.start).not.toHaveBeenCalled();
    expect(sink.events.some((entry) => entry.event.kind === 'host:lobby:state')).toBe(true);

    expect(host.submitInput('bravo', { kind: 'lobby:start' })).toBe(false);
    expect(host.submitInput('alpha', { kind: 'lobby:start' })).toBe(true);

    expect(core.core.start).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'coop-slime-room-1',
        dynamicRoster: true,
        players: []
      })
    );
    expect(core.core.addPlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'alpha',
        companion: expect.objectContaining({ petArchetypeId: 'pet-01' })
      }),
      undefined
    );
    expect(core.core.addPlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'bravo',
        companion: null
      }),
      undefined
    );
    expect(sink.events.map((entry) => entry.event.kind)).toContain('host:lobby:start');
    expect(host.rooms()).toEqual([
      {
        roomId: 'room-1',
        sessionConfigId: 'coop-slime',
        state: 'running',
        population: 2,
        hostActorId: 'alpha'
      }
    ]);
  });

  it('transfers and auto-elects lobby host deterministically', () => {
    const sink = createSinkHarness();
    const clock = createClockHarness();
    const host = createOnlineSessionHost({
      playerCap: 8,
      tickHz: 60,
      snapshotHz: 30,
      sink: sink.sink,
      clock: clock.clock,
      coreFactory: createCoreHarness().factory
    });

    host.join('alpha', { requestedSessionId: 'coop-slime' });
    clock.now = 10;
    host.join('bravo', { requestedSessionId: 'coop-slime' });
    clock.now = 20;
    host.join('charlie', { requestedSessionId: 'coop-slime' });

    expect(host.submitInput('alpha', { kind: 'lobby:transferHost', targetActorId: 'charlie' })).toBe(
      true
    );
    expect(host.rooms()[0]?.hostActorId).toBe('charlie');

    host.leave('charlie');

    expect(host.rooms()[0]?.hostActorId).toBe('alpha');
    expect(
      sink.events
        .filter((entry) => entry.event.kind === 'host:lobby:hostChanged')
        .map((entry) => entry.event)
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          previousHostActorId: 'alpha',
          newHostActorId: 'charlie'
        }),
        expect.objectContaining({
          previousHostActorId: 'charlie',
          newHostActorId: 'alpha'
        })
      ])
    );
  });

  it('creates another room when a co-op lobby reaches its authored maxPlayers', () => {
    const host = createOnlineSessionHost({
      playerCap: 8,
      tickHz: 60,
      snapshotHz: 30,
      sink: createSinkHarness().sink,
      clock: createClockHarness().clock,
      coreFactory: createCoreHarness().factory,
      roomIdFactory: (index) => `room-${index}`
    });

    for (const socketId of ['a', 'b', 'c', 'd', 'e']) {
      host.join(socketId, { requestedSessionId: 'coop-slime' });
    }

    expect(host.rooms()).toEqual([
      {
        roomId: 'room-1',
        sessionConfigId: 'coop-slime',
        state: 'open',
        population: 4,
        hostActorId: 'a'
      },
      {
        roomId: 'room-2',
        sessionConfigId: 'coop-slime',
        state: 'open',
        population: 1,
        hostActorId: 'e'
      }
    ]);
  });

  it('rejects unknown online session ids and the global process cap', () => {
    const host = createOnlineSessionHost({
      playerCap: 1,
      tickHz: 60,
      snapshotHz: 30,
      sink: createSinkHarness().sink,
      clock: createClockHarness().clock,
      coreFactory: createCoreHarness().factory
    });

    expect(host.join('missing', { requestedSessionId: 'not-real' })).toMatchObject({
      kind: 'rejected',
      reason: 'unknownSession'
    });
    expect(host.join('alpha', { requestedSessionId: 'coop-slime' })).toMatchObject({
      kind: 'accepted'
    });
    expect(host.join('bravo', { requestedSessionId: 'coop-slime' })).toMatchObject({
      kind: 'rejected',
      reason: 'serverFull'
    });
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

function createSinkHarness(): {
  sink: ArenaHostSink;
  events: Array<{ actorId: string; event: ArenaHostEvent }>;
  snapshots: Array<{ actorId: string; snapshot: Snapshot }>;
} {
  const events: Array<{ actorId: string; event: ArenaHostEvent }> = [];
  const snapshots: Array<{ actorId: string; snapshot: Snapshot }> = [];
  return {
    events,
    snapshots,
    sink: {
      emitSnapshot(actorId, snapshot): void {
        snapshots.push({ actorId, snapshot });
      },
      emitEvent(actorId, event): void {
        events.push({ actorId, event });
      },
      emitCloseReason: vi.fn()
    }
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
