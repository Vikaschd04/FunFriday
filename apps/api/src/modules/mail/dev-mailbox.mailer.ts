import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service.js';
import { type MailMessage, MailerPort } from './mailer.port.js';

export const DEV_MAILBOX_PROVIDER = 'dev-mailbox';

/** Writes mail to the outbox table instead of sending it. Local development only. */
@Injectable()
export class DevMailboxMailer extends MailerPort {
  private readonly logger = new Logger('Mailer');

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async send(message: MailMessage): Promise<void> {
    await this.prisma.notificationOutbox.create({
      data: {
        recipient: message.to,
        subject: message.subject,
        body: message.text,
        provider: DEV_MAILBOX_PROVIDER,
        status: 'STORED',
      },
    });
    // Never log the recipient or the body: both can contain personal data or tokens.
    this.logger.log('dev mail queued');
  }
}

/** Used when no mail adapter is configured: drops the message and says so. */
@Injectable()
export class SuppressedMailer extends MailerPort {
  private readonly logger = new Logger('Mailer');

  send(): Promise<void> {
    this.logger.warn('mail suppressed: no mail provider is configured');
    return Promise.resolve();
  }
}
