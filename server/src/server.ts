import { createServer, type Server as HttpServer, type ServerResponse } from 'node:http';

import { Server as SocketIOServer } from 'socket.io';

import type { PublicArenaServerConfig } from './config.js';

export type PublicArenaServer = Readonly<{
  httpServer: HttpServer;
  io: SocketIOServer;
  start(): Promise<void>;
  close(): Promise<void>;
}>;

function writeJson(res: ServerResponse, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(200, {
    'content-type': 'application/json',
    'cache-control': 'no-store'
  });
  res.end(payload);
}

export function createPublicArenaServer(config: PublicArenaServerConfig): PublicArenaServer {
  const httpServer = createServer((req, res) => {
    if (req.url === '/healthz') {
      writeJson(res, {
        ok: true,
        playerCap: config.playerCap,
        tickHz: config.tickHz,
        snapshotHz: config.snapshotHz
      });
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.corsOrigin
    }
  });

  io.on('connection', () => {
    // Protocol events are introduced by T3; T2 only proves the deployable socket host.
  });

  return {
    httpServer,
    io,
    start() {
      return new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(config.port, config.host, () => {
          httpServer.off('error', reject);
          resolve();
        });
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        io.close((ioError) => {
          if (ioError !== undefined) {
            reject(ioError);
            return;
          }

          if (!httpServer.listening) {
            resolve();
            return;
          }

          httpServer.close((httpError) => {
            if (httpError !== undefined) {
              reject(httpError);
              return;
            }
            resolve();
          });
        });
      });
    }
  };
}
