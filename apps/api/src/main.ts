import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { API_PREFIX } from '@funfriday/contracts';
import { createApp } from './app.factory.js';
import { ConfigError, parseConfig } from './config/app-config.js';
import { loadRootEnvFile } from './config/load-env-file.js';

async function bootstrap(): Promise<void> {
  loadRootEnvFile();
  const config = parseConfig(process.env);
  const app = await createApp(config);
  await app.listen(config.port, config.host);
  Logger.log(
    `FunFriday API ${config.version} listening on http://${config.host}:${config.port}/${API_PREFIX}`,
    'Bootstrap',
  );
}

bootstrap().catch((error: unknown) => {
  console.error(error instanceof ConfigError ? error.message : error);
  process.exit(1);
});
