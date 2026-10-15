import { Injectable } from '@nestjs/common';
import { type ActivityListResponse, activityListResponseSchema } from '@funfriday/contracts';
import { PrismaService } from '../../infra/database/prisma.service.js';
import { toActivitySummary } from './activity.mapper.js';

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Global catalog for discovery; disabled activities are hidden. */
  async list(): Promise<ActivityListResponse> {
    const rows = await this.prisma.activityDefinition.findMany({
      where: { availability: { not: 'DISABLED' } },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    return activityListResponseSchema.parse({ activities: rows.map(toActivitySummary) });
  }
}
