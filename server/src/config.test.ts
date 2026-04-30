import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PUBLIC_ARENA_CORS_ORIGIN,
  DEFAULT_PUBLIC_ARENA_HOST,
  DEFAULT_PUBLIC_ARENA_PLAYER_CAP,
  DEFAULT_PUBLIC_ARENA_PORT,
  loadPublicArenaServerConfig
} from './config.js';

describe('loadPublicArenaServerConfig', () => {
  it('uses the public arena defaults', () => {
    const config = loadPublicArenaServerConfig({});

    expect(config).toMatchObject({
      host: DEFAULT_PUBLIC_ARENA_HOST,
      port: DEFAULT_PUBLIC_ARENA_PORT,
      playerCap: DEFAULT_PUBLIC_ARENA_PLAYER_CAP,
      corsOrigin: DEFAULT_PUBLIC_ARENA_CORS_ORIGIN,
      tickHz: 60,
      snapshotHz: 30
    });
  });

  it('reads runtime config from the process environment shape', () => {
    const config = loadPublicArenaServerConfig({
      PUBLIC_ARENA_HOST: '127.0.0.1',
      PUBLIC_ARENA_PORT: '9001',
      PUBLIC_ARENA_PLAYER_CAP: '12',
      PUBLIC_ARENA_CORS_ORIGIN: 'https://example.test'
    });

    expect(config).toMatchObject({
      host: '127.0.0.1',
      port: 9001,
      playerCap: 12,
      corsOrigin: 'https://example.test'
    });
  });

  it('falls back to PORT for platform compatibility', () => {
    const config = loadPublicArenaServerConfig({ PORT: '9010' });

    expect(config.port).toBe(9010);
  });

  it('rejects invalid numeric config', () => {
    expect(() =>
      loadPublicArenaServerConfig({
        PUBLIC_ARENA_PLAYER_CAP: '0'
      })
    ).toThrow('PUBLIC_ARENA_PLAYER_CAP must be a positive integer');
  });
});
