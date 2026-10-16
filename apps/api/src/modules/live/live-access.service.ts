import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service.js';
import { LiveAccessPort } from './live-access.port.js';
import { RoomManager } from './room-manager.js';

@Injectable()
export class LiveAccessService extends LiveAccessPort {
  private readonly logger = new Logger(LiveAccessService.name);

  constructor(
    private readonly rooms: RoomManager,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async memberRemoved(organizationId: string, membershipId: string): Promise<void> {
    const actors = this.rooms.actorsForOrg(organizationId).filter((a) => a.hasMember(membershipId));
    await Promise.all(actors.map((actor) => actor.revoke(membershipId)));
    if (actors.length > 0) this.logger.log(`revoked member=${membershipId} rooms=${actors.length}`);
  }

  async memberRoleChanged(organizationId: string, membershipId: string): Promise<void> {
    const actors = this.rooms.actorsForOrg(organizationId).filter((a) => a.hasMember(membershipId));
    if (actors.length === 0) return;
    const [membership, sessions] = await Promise.all([
      this.prisma.membership.findUnique({
        where: { id: membershipId },
        select: { role: true, status: true },
      }),
      this.prisma.liveSession.findMany({
        where: { id: { in: actors.map((a) => a.sessionId) } },
        select: { id: true, hostMembershipId: true },
      }),
    ]);
    if (!membership || membership.status !== 'ACTIVE') return;
    const hostOf = new Map(sessions.map((s) => [s.id, s.hostMembershipId]));
    await Promise.all(
      actors.map((actor) =>
        actor.setHost(
          membershipId,
          hostOf.get(actor.sessionId) === membershipId || membership.role === 'ADMIN',
        ),
      ),
    );
  }
}
