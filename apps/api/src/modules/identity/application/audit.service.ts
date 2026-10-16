import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  type AuditAction,
  type AuditListResponse,
  auditListResponseSchema,
} from '@funfriday/contracts';
import { z } from 'zod';
import { ValidationException } from '../../../common/errors/validation.exception.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infra/database/prisma.service.js';

export const AUDIT_PAGE_SIZE = 50;

export interface AuditRecord {
  organizationId: string;
  actorUserId: string | null;
  action: AuditAction;
  targetType: 'organization' | 'membership' | 'team';
  targetId: string;
  /** Role names, team names and counts only - never emails, tokens or free text. */
  metadata?: Record<string, string | number | boolean | null>;
}

const cursorSchema = z.object({ t: z.iso.datetime(), i: z.uuid() });

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ t: createdAt.toISOString(), i: id })).toString('base64url');
}

export function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  try {
    const parsed = cursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));
    return { createdAt: new Date(parsed.t), id: parsed.i };
  } catch {
    throw new ValidationException({ fieldErrors: { cursor: ['Invalid cursor.'] } });
  }
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Writes inside the caller's transaction so the audit row commits with the change it describes. */
  async record(tx: Prisma.TransactionClient, entry: AuditRecord): Promise<void> {
    await tx.auditLog.create({
      data: {
        id: randomUUID(),
        organizationId: entry.organizationId,
        actorUserId: entry.actorUserId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        metadata: entry.metadata ?? {},
      },
    });
  }

  async list(organizationId: string, cursor: string | undefined): Promise<AuditListResponse> {
    const after = cursor ? decodeCursor(cursor) : null;
    const rows = await this.prisma.auditLog.findMany({
      where: {
        organizationId,
        ...(after
          ? {
              OR: [
                { createdAt: { lt: after.createdAt } },
                { createdAt: after.createdAt, id: { lt: after.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: AUDIT_PAGE_SIZE + 1,
      include: { actor: { select: { name: true } } },
    });
    const page = rows.slice(0, AUDIT_PAGE_SIZE);
    const last = page.at(-1);
    return auditListResponseSchema.parse({
      entries: page.map((row) => ({
        id: row.id,
        action: row.action,
        actor: { userId: row.actorUserId, name: row.actor?.name ?? null },
        targetType: row.targetType,
        targetId: row.targetId,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor:
        rows.length > AUDIT_PAGE_SIZE && last ? encodeCursor(last.createdAt, last.id) : null,
    });
  }
}
