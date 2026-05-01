import { PUBLIC_ARENA_FULL_MESSAGE } from '../shared/arenaHostProtocol';

export const PUBLIC_ARENA_SERVER_URL_ENV = 'VITE_PUBLIC_ARENA_SERVER_URL';

export type PublicArenaClientConfig = Readonly<{
  serverUrl: string | null;
  fullArenaMessage: string;
}>;

type PublicArenaClientEnv = Readonly<{
  VITE_PUBLIC_ARENA_SERVER_URL?: string;
}>;

function normalizeServerUrl(rawUrl: string | undefined): string | null {
  const trimmed = rawUrl?.trim();
  if (trimmed === undefined || trimmed === '') {
    return null;
  }

  const parsed = new URL(trimmed);
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)) {
    throw new Error(`${PUBLIC_ARENA_SERVER_URL_ENV} must use http, https, ws, or wss.`);
  }

  return parsed.toString();
}

export function resolvePublicArenaClientConfig(env: PublicArenaClientEnv): PublicArenaClientConfig {
  return {
    serverUrl: normalizeServerUrl(env.VITE_PUBLIC_ARENA_SERVER_URL),
    fullArenaMessage: PUBLIC_ARENA_FULL_MESSAGE
  };
}

export const publicArenaClientConfig = resolvePublicArenaClientConfig(import.meta.env);
