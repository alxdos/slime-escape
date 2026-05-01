import { describe, expect, it } from 'vitest';

import {
  type ArenaHostEvent,
  PUBLIC_ARENA_EVENTS,
  PUBLIC_ARENA_FULL_MESSAGE,
  ARENA_HOST_PROTOCOL_VERSION
} from './publicArenaProtocol';
import type { Snapshot } from './snapshot';

describe('public arena protocol constants', () => {
  it('uses one current protocol version', () => {
    expect(ARENA_HOST_PROTOCOL_VERSION).toBe(6);
  });

  it('keeps every socket event name unique and namespaced', () => {
    const eventNames = Object.values(PUBLIC_ARENA_EVENTS);

    expect(new Set(eventNames).size).toBe(eventNames.length);
    expect(eventNames.every((name) => name.startsWith('publicArena:'))).toBe(true);
  });

  it('has a clear full-arena player message', () => {
    expect(PUBLIC_ARENA_FULL_MESSAGE.toLowerCase()).toContain('arena');
    expect(PUBLIC_ARENA_FULL_MESSAGE.toLowerCase()).toContain('full');
  });

  it('uses shared snapshots and host events on the server-to-client payload path', () => {
    const snapshot = {
      simTimeMs: 1000,
      entities: [],
      encounter: null,
      zone: { mode: 'disabled', margin: 0 },
      waveProgress: null,
      bossHud: null
    } satisfies Snapshot;
    const hostEvent = {
      kind: 'host:levelUp',
      simTime: 1000,
      actorId: 'socket-a',
      level: 2,
      formArchetypeId: 'slime-hornling'
    } satisfies ArenaHostEvent;

    expect('selfId' in snapshot).toBe(false);
    expect('arena' in snapshot).toBe(false);
    expect(hostEvent.kind).toBe('host:levelUp');
  });
});
