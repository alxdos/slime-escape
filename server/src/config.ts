import { SIM_HZ, SNAPSHOT_HZ } from '../../src/shared/timing.js';

export const DEFAULT_PUBLIC_ARENA_PORT = 8787;
export const DEFAULT_PUBLIC_ARENA_HOST = '0.0.0.0';
export const DEFAULT_PUBLIC_ARENA_PLAYER_CAP = 200;
export const DEFAULT_PUBLIC_ARENA_CORS_ORIGIN = '*';
export const DEFAULT_PUBLIC_ARENA_PING_INTERVAL_MS = 5000;
export const DEFAULT_PUBLIC_ARENA_PING_TIMEOUT_MS = 5000;

export type PublicArenaServerConfig = Readonly<{
  host: string;
  port: number;
  playerCap: number;
  corsOrigin: string;
  tickHz: number;
  snapshotHz: number;
  pingIntervalMs: number;
  pingTimeoutMs: number;
}>;

function parsePositiveInteger(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function parseText(raw: string | undefined, fallback: string): string {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  return raw;
}

export function loadPublicArenaServerConfig(env: NodeJS.ProcessEnv = process.env): PublicArenaServerConfig {
  return {
    host: parseText(env.PUBLIC_ARENA_HOST, DEFAULT_PUBLIC_ARENA_HOST),
    port: parsePositiveInteger(
      'PUBLIC_ARENA_PORT',
      env.PUBLIC_ARENA_PORT ?? env.PORT,
      DEFAULT_PUBLIC_ARENA_PORT
    ),
    playerCap: parsePositiveInteger(
      'PUBLIC_ARENA_PLAYER_CAP',
      env.PUBLIC_ARENA_PLAYER_CAP,
      DEFAULT_PUBLIC_ARENA_PLAYER_CAP
    ),
    corsOrigin: parseText(env.PUBLIC_ARENA_CORS_ORIGIN, DEFAULT_PUBLIC_ARENA_CORS_ORIGIN),
    tickHz: SIM_HZ,
    snapshotHz: SNAPSHOT_HZ,
    pingIntervalMs: parsePositiveInteger(
      'PUBLIC_ARENA_PING_INTERVAL_MS',
      env.PUBLIC_ARENA_PING_INTERVAL_MS,
      DEFAULT_PUBLIC_ARENA_PING_INTERVAL_MS
    ),
    pingTimeoutMs: parsePositiveInteger(
      'PUBLIC_ARENA_PING_TIMEOUT_MS',
      env.PUBLIC_ARENA_PING_TIMEOUT_MS,
      DEFAULT_PUBLIC_ARENA_PING_TIMEOUT_MS
    )
  };
}
