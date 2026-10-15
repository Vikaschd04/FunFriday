import type { NestExpressApplication } from '@nestjs/platform-express';
import { activityListResponseSchema } from '@funfriday/contracts';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { activityCatalog, seedActivityCatalog } from '../prisma/activity-catalog.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { startApp } from './app-harness.js';
import { resolveTestEnv } from './test-env.js';

const HIDDEN_SLUG = 'zz-disabled-fixture';

describe('GET /api/v1/activities (real Postgres)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: resolveTestEnv().DATABASE_URL }),
    });
    await seedActivityCatalog(prisma);
    await prisma.activityDefinition.upsert({
      where: { slug: HIDDEN_SLUG },
      create: {
        slug: HIDDEN_SLUG,
        name: 'Disabled fixture',
        summary: 'Synthetic row that must never be listed.',
        manifestVersion: '0.0.0',
        minPlayers: 2,
        maxPlayers: 4,
        estimatedMinutesMin: 1,
        estimatedMinutesMax: 2,
        category: 'QUIZ',
        displayOrder: 1,
        availability: 'DISABLED',
      },
      update: { availability: 'DISABLED' },
    });
    app = await startApp({ webOrigins: ['http://localhost:3000'] });
  });

  afterAll(async () => {
    await app.close();
    await prisma.activityDefinition.deleteMany({ where: { slug: HIDDEN_SLUG } });
    await prisma.$disconnect();
  });

  it('returns the contract-valid catalog in display order', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/activities').expect(200);
    const body = activityListResponseSchema.parse(res.body);
    expect(body.activities.map((a) => a.slug)).toEqual(activityCatalog.map((a) => a.slug));
    expect(body.activities[0]).toMatchObject({ category: 'icebreaker', availability: 'planned' });
  });

  it('hides disabled activities', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/activities').expect(200);
    const slugs = (res.body as { activities: Array<{ slug: string }> }).activities.map(
      (a) => a.slug,
    );
    expect(slugs).not.toContain(HIDDEN_SLUG);
  });

  it('exposes no internal identifiers or timestamps', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/activities');
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/"id"|createdAt|updatedAt|manifestVersion|displayOrder/);
  });

  it('is cacheable for a minute and readable cross-origin by the web app', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/activities')
      .set('Origin', 'http://localhost:3000');
    expect(res.headers['cache-control']).toBe('public, max-age=60');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});
