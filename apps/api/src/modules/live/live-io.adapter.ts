import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';
import type { AppConfig } from '../../config/app-config.js';

/** Hard cap on one client message (ADR 0003 decision 1). */
export const MAX_SOCKET_MESSAGE_BYTES = 16_000;

/** Applies config-driven CORS (credentials + WEB_ORIGIN allowlist) and the message size cap. */
export class LiveIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly config: AppConfig,
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    return super.createIOServer(port, {
      ...(options as ServerOptions),
      cors: { origin: this.config.webOrigins, credentials: true },
      maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES,
    });
  }
}
