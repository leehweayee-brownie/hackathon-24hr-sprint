import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';

/**
 * Vercel Function entry (api/index.js re-exports this). Vercel serves the exported http.Server: REST requests
 * and Socket.IO WebSocket upgrades both arrive here. Nest boots once per instance; requests and upgrades that
 * arrive while it is still starting are held and handed over once it is ready.
 */
let ready: Promise<Server> | null = null;

function nestServer(): Promise<Server> {
  if (!ready) {
    ready = (async () => {
      // Loaded here, not at the top: an invalid environment (checked when AppModule loads) then becomes a
      // clear 503 with the reason in the logs, instead of a crashed function.
      const { AppModule } = await import('./app.module');
      const { configureApp } = await import('./app.setup');
      // abortOnError: false so a boot failure rejects (and is answered with 503) instead of exiting the process.
      const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, abortOnError: false });
      configureApp(app);
      await app.init();
      new Logger('Serverless').log('Nest application ready');
      return app.getHttpServer() as Server;
    })();
    // A failed boot must not poison every later request on this instance.
    ready.catch(() => {
      ready = null;
    });
  }
  return ready;
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  nestServer()
    .then((inner) => inner.emit('request', req, res))
    .catch((err: unknown) => {
      new Logger('Serverless').error(`Boot failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
      if (!res.headersSent) {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'The API is starting or misconfigured. Try again shortly.', code: 'INTERNAL', errors: [] }));
      }
    });
});

server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
  nestServer()
    .then((inner) => inner.emit('upgrade', req, socket, head))
    .catch(() => socket.destroy());
});

// Start booting as soon as the instance loads, not on the first request.
void nestServer().catch(() => undefined);

export default server;
