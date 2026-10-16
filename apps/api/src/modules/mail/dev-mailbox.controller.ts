import { Controller, Get, Header, NotFoundException, Req } from '@nestjs/common';
import type { Request } from 'express';
import { type DevMailboxResponse, devMailboxResponseSchema } from '@funfriday/contracts';
import { PrismaService } from '../../infra/database/prisma.service.js';
import { extractLinks } from './extract-links.js';

const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/** Registered only when DEV_MAILBOX_ENABLED (never in production - see parseConfig). */
@Controller('dev/mailbox')
export class DevMailboxController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@Req() req: Request): Promise<DevMailboxResponse> {
    // DNS-rebinding defence: a hostile page that re-points its own hostname at 127.0.0.1
    // still sends its own Host header, so only genuine loopback hosts may read the mailbox.
    if (!LOOPBACK_HOST.test(req.headers.host ?? '')) {
      throw new NotFoundException();
    }
    const rows = await this.prisma.notificationOutbox.findMany({
      where: { provider: 'dev-mailbox' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
    return devMailboxResponseSchema.parse({
      messages: rows.map((row) => ({
        id: row.id,
        to: row.recipient,
        subject: row.subject,
        text: row.body,
        links: extractLinks(row.body),
        createdAt: row.createdAt.toISOString(),
      })),
    });
  }
}
