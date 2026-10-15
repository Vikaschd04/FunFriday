import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { activityCatalog, seedActivityCatalog } from '../prisma/activity-catalog.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { resolveTestEnv } from './test-env.js';

describe('activity catalog migration + seed (real Postgres)', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    const connectionString = resolveTestEnv().DATABASE_URL;
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('seeds the six MVP activities idempotently', async () => {
    await seedActivityCatalog(prisma);
    await seedActivityCatalog(prisma);
    const rows = await prisma.activityDefinition.findMany({ orderBy: { slug: 'asc' } });
    expect(rows).toHaveLength(6);
    expect(rows.map((row) => row.slug)).toEqual(activityCatalog.map((a) => a.slug).sort());
    expect(rows.every((row) => row.availability === 'PLANNED')).toBe(true);
  });

  it('enforces min <= max players at the database level', async () => {
    await expect(
      prisma.activityDefinition.create({
        data: {
          slug: 'broken-limits',
          name: 'Broken',
          summary: 'Invalid player limits',
          manifestVersion: '0.0.0',
          minPlayers: 10,
          maxPlayers: 2,
          estimatedMinutesMin: 1,
          estimatedMinutesMax: 2,
          category: 'QUIZ',
          displayOrder: 999,
        },
      }),
    ).rejects.toThrow(/activity_definitions_players_check/);
  });

  it('rejects slugs that are not lowercase kebab-case', async () => {
    await expect(
      prisma.activityDefinition.create({
        data: {
          slug: 'Bad Slug',
          name: 'Bad',
          summary: 'Invalid slug',
          manifestVersion: '0.0.0',
          minPlayers: 2,
          maxPlayers: 4,
          estimatedMinutesMin: 1,
          estimatedMinutesMax: 2,
          category: 'QUIZ',
          displayOrder: 999,
        },
      }),
    ).rejects.toThrow(/activity_definitions_slug_format_check/);
  });
});
