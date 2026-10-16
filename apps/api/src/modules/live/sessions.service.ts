import { randomInt } from 'node:crypto';
import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  type JoinByCodeResponse,
  type LiveSessionListResponse,
  type LiveSessionSummary,
  ROOM_CODE_ALPHABET,
} from '@funfriday/contracts';
import { DomainException } from '../../common/errors/domain.exception.js';
import { PrismaService } from '../../infra/database/prisma.service.js';

/** Source of room codes. Injectable so a test can force collisions. */
@Injectable()
export class RoomCodes {
  next(): string {
    let code = '';
    for (let i = 0; i < 6; i += 1) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    return code;
  }
}

const CODE_ATTEMPTS = 8;
const JOIN_BY_CODE_PER_MINUTE = 10;

const summarySelect = {
  id: true,
  organizationId: true,
  title: true,
  roomCode: true,
  status: true,
  createdAt: true,
  hostMembershipId: true,
  host: { select: { user: { select: { name: true } } } },
} as const;

type SessionRow = {
  id: string;
  organizationId: string;
  title: string;
  roomCode: string;
  status: 'LOBBY' | 'LIVE' | 'ENDED';
  createdAt: Date;
  hostMembershipId: string | null;
  host: { user: { name: string } | null } | null;
};

export function toSummary(row: SessionRow): LiveSessionSummary {
  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    roomCode: row.roomCode,
    status: row.status.toLowerCase() as LiveSessionSummary['status'],
    // The contract's host.memberId is non-nullable; a host-less session (host removed) reports the nil UUID.
    host: row.hostMembershipId
      ? { memberId: row.hostMembershipId, name: row.host?.user?.name ?? null }
      : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
  );
}

export interface JoinableSession {
  session: {
    id: string;
    organizationId: string;
    title: string;
    roomCode: string;
    hostMembershipId: string | null;
  };
  membership: { id: string; role: 'ADMIN' | 'HOST' | 'PARTICIPANT'; name: string | null };
}

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  private readonly codeAttempts = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: RoomCodes,
  ) {}

  async create(
    organizationId: string,
    hostMembershipId: string,
    hostName: string,
    title: string | undefined,
  ): Promise<LiveSessionSummary> {
    const finalTitle = title ?? `${hostName}'s session`.slice(0, 60);
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
      try {
        const row = await this.prisma.liveSession.create({
          data: {
            organizationId,
            hostMembershipId,
            title: finalTitle.length >= 2 ? finalTitle : 'Live session',
            roomCode: this.codes.next(),
          },
          select: summarySelect,
        });
        this.logger.log(`session created id=${row.id} org=${organizationId}`);
        return toSummary(row);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    // Astronomically unlikely (31^6 codes); surface as a retryable conflict.
    throw new DomainException('CONFLICT', HttpStatus.CONFLICT);
  }

  async listOpen(organizationId: string): Promise<LiveSessionListResponse> {
    const rows = await this.prisma.liveSession.findMany({
      where: { organizationId, status: { not: 'ENDED' } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: summarySelect,
    });
    return { sessions: rows.map(toSummary) };
  }

  /** Sliding window per USER (the per-IP throttler cannot see the user): 10 attempts / minute. */
  private assertWithinUserLimit(userId: string): void {
    const now = Date.now();
    const recent = (this.codeAttempts.get(userId) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= JOIN_BY_CODE_PER_MINUTE) {
      this.codeAttempts.set(userId, recent);
      throw new HttpException('RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    }
    recent.push(now);
    this.codeAttempts.set(userId, recent);
    if (this.codeAttempts.size > 10_000) {
      for (const [id, times] of this.codeAttempts) {
        if (times.every((t) => now - t >= 60_000)) this.codeAttempts.delete(id);
      }
    }
  }

  /** 404 for unknown code AND for a code in an organisation the caller is not an ACTIVE member of. */
  async joinByCode(userId: string, code: string): Promise<JoinByCodeResponse> {
    this.assertWithinUserLimit(userId);
    const session = await this.prisma.liveSession.findFirst({
      where: { roomCode: code, status: { not: 'ENDED' } },
      select: { id: true, organizationId: true },
    });
    if (!session) throw new NotFoundException();
    const membership = await this.prisma.membership.findFirst({
      where: { organizationId: session.organizationId, userId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!membership) throw new NotFoundException();
    return { sessionId: session.id, organizationId: session.organizationId };
  }

  /**
   * Fresh authorisation for a privileged action on an already-joined socket: the member must
   * still be ACTIVE (and the same user), and still be the session host or an org Admin.
   */
  async hostStatus(
    sessionId: string,
    membershipId: string,
    userId: string,
  ): Promise<'host' | 'not_host' | 'gone'> {
    const [session, membership] = await Promise.all([
      this.prisma.liveSession.findUnique({
        where: { id: sessionId },
        select: { organizationId: true, hostMembershipId: true },
      }),
      this.prisma.membership.findUnique({
        where: { id: membershipId },
        select: { organizationId: true, userId: true, status: true, role: true },
      }),
    ]);
    if (
      !session ||
      !membership ||
      membership.status !== 'ACTIVE' ||
      membership.userId !== userId ||
      membership.organizationId !== session.organizationId
    ) {
      return 'gone';
    }
    return session.hostMembershipId === membershipId || membership.role === 'ADMIN'
      ? 'host'
      : 'not_host';
  }

  /** Socket join check: session open AND caller is an ACTIVE member of its organisation, else null. */
  async findJoinable(sessionId: string, userId: string): Promise<JoinableSession | null> {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        organizationId: true,
        title: true,
        roomCode: true,
        hostMembershipId: true,
        status: true,
      },
    });
    if (!session || session.status === 'ENDED') return null;
    const membership = await this.prisma.membership.findFirst({
      where: { organizationId: session.organizationId, userId, status: 'ACTIVE' },
      select: { id: true, role: true, user: { select: { name: true } } },
    });
    if (!membership) return null;
    await this.prisma.sessionParticipant.upsert({
      where: { sessionId_membershipId: { sessionId: session.id, membershipId: membership.id } },
      create: {
        organizationId: session.organizationId,
        sessionId: session.id,
        membershipId: membership.id,
      },
      update: {},
    });
    return {
      session,
      membership: { id: membership.id, role: membership.role, name: membership.user?.name ?? null },
    };
  }
}
