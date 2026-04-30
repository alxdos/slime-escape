import { describe, expect, it } from 'vitest';

import {
  PUBLIC_ARENA_EVENTS,
  PUBLIC_ARENA_FULL_MESSAGE,
  PUBLIC_ARENA_PROTOCOL_VERSION
} from './publicArenaProtocol';

describe('public arena protocol constants', () => {
  it('uses one current protocol version', () => {
    expect(PUBLIC_ARENA_PROTOCOL_VERSION).toBe(2);
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
});
