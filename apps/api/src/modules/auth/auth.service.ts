import { Inject, Injectable, Logger } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { toNodeHandler } from 'better-auth/node';
import { APP_CONFIG, type AppConfig } from '../../config/app-config.js';
import { PrismaService } from '../../infra/database/prisma.service.js';
import { MailerPort } from '../mail/mailer.port.js';
import { buildAuthOptions } from './auth-options.js';

/** Owns the Better Auth instance. Only this module and the session adapter know about the library. */
@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');
  readonly auth;
  /** Node/Express request handler for `/api/v1/auth/*` (mounted before JSON body parsing). */
  readonly nodeHandler;

  constructor(@Inject(APP_CONFIG) config: AppConfig, prisma: PrismaService, mailer: MailerPort) {
    this.auth = betterAuth(
      buildAuthOptions(config, {
        database: prismaAdapter(prisma, { provider: 'postgresql' }),
        sendVerificationMail: async ({ to, link }) => {
          try {
            await mailer.send({
              to,
              subject: 'Verify your FunFriday email',
              text: `Welcome to FunFriday. Verify your email to join your organisations:\n\n${link}\n\nIf you did not sign up, ignore this message.`,
            });
          } catch {
            this.logger.error('verification mail could not be queued');
          }
        },
        log: (level, message) => {
          if (level === 'error') this.logger.error(message);
          else this.logger.warn(message);
        },
      }),
    );
    this.nodeHandler = toNodeHandler(this.auth);
  }
}
