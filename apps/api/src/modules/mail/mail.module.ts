import { type DynamicModule, Module } from '@nestjs/common';
import type { AppConfig } from '../../config/app-config.js';
import { DevMailboxController } from './dev-mailbox.controller.js';
import { DevMailboxMailer, SuppressedMailer } from './dev-mailbox.mailer.js';
import { MailerPort } from './mailer.port.js';

@Module({})
export class MailModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: MailModule,
      global: true,
      controllers: config.devMailboxEnabled ? [DevMailboxController] : [],
      providers: [
        {
          provide: MailerPort,
          useClass: config.devMailboxEnabled ? DevMailboxMailer : SuppressedMailer,
        },
      ],
      exports: [MailerPort],
    };
  }
}
