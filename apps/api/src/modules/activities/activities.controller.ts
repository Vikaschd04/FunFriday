import { Controller, Get, Header } from '@nestjs/common';
import type { ActivityListResponse } from '@funfriday/contracts';
import { ActivitiesService } from './activities.service.js';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  /** Public, non-tenant catalog. Org-specific content arrives with auth (P2/P3). */
  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  list(): Promise<ActivityListResponse> {
    return this.activities.list();
  }
}
