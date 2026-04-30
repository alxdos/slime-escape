import { log } from '../../src/shared/log.js';

import { loadPublicArenaServerConfig } from './config.js';
import { createPublicArenaServer } from './server.js';

const config = loadPublicArenaServerConfig();
const arenaServer = createPublicArenaServer(config);

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  log.info('public arena server shutting down', { signal });
  await arenaServer.close();
}

async function main(): Promise<void> {
  await arenaServer.start();
  log.info('public arena server started', {
    host: config.host,
    port: config.port,
    playerCap: config.playerCap
  });
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

void main().catch((error: unknown) => {
  log.error('public arena server failed to start', { error });
  process.exitCode = 1;
});
