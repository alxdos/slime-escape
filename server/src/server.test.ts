import { describe, expect, it, vi } from 'vitest';

import { PUBLIC_ARENA_EVENTS } from '../../src/shared/publicArenaProtocol.js';

import {
  PUBLIC_ARENA_INPUT_RATE_LIMIT_MAX,
  PUBLIC_ARENA_INPUT_RATE_LIMIT_WINDOW_MS,
  PUBLIC_ARENA_SERVER_SHUTDOWN_REASON,
  acceptPublicArenaInputIntent,
  createPublicArenaInputRateLimitState,
  emitPublicArenaServerShutdownReason
} from './server.js';

describe('PublicArenaServer hardening', () => {
  it('drops per-socket input intents after the configured window limit', () => {
    const windowStartMs = 5_000;
    const state = createPublicArenaInputRateLimitState(windowStartMs);

    for (let i = 0; i < PUBLIC_ARENA_INPUT_RATE_LIMIT_MAX; i += 1) {
      expect(acceptPublicArenaInputIntent(state, windowStartMs + 200)).toBe(true);
    }

    expect(acceptPublicArenaInputIntent(state, windowStartMs + 999)).toBe(false);
    expect(
      acceptPublicArenaInputIntent(
        state,
        windowStartMs + PUBLIC_ARENA_INPUT_RATE_LIMIT_WINDOW_MS
      )
    ).toBe(true);
  });

  it('emits a serverShutdown close reason before intentional shutdown', () => {
    const io = {
      emit: vi.fn()
    };

    emitPublicArenaServerShutdownReason(io);

    expect(io.emit).toHaveBeenCalledWith(
      PUBLIC_ARENA_EVENTS.closeReason,
      PUBLIC_ARENA_SERVER_SHUTDOWN_REASON
    );
  });
});
