import { describe, expect, it } from 'vitest';

import {
  PUBLIC_ARENA_SERVER_URL_ENV,
  resolvePublicArenaClientConfig
} from './publicArenaConfig';

describe('resolvePublicArenaClientConfig', () => {
  it('keeps the public arena disconnected when no build-time URL exists', () => {
    const config = resolvePublicArenaClientConfig({});

    expect(config.serverUrl).toBeNull();
  });

  it('reads the build-time VITE arena URL', () => {
    const config = resolvePublicArenaClientConfig({
      VITE_PUBLIC_ARENA_SERVER_URL: ' https://arena.example.test '
    });

    expect(config.serverUrl).toBe('https://arena.example.test/');
  });

  it('rejects unsupported URL schemes', () => {
    expect(() =>
      resolvePublicArenaClientConfig({
        VITE_PUBLIC_ARENA_SERVER_URL: 'ftp://arena.example.test'
      })
    ).toThrow(`${PUBLIC_ARENA_SERVER_URL_ENV} must use http, https, ws, or wss.`);
  });
});
