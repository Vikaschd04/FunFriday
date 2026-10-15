import { activitySummarySchema } from '@funfriday/contracts';
import { describe, expect, it } from 'vitest';
import type { ActivityDefinition } from '../../generated/prisma/client.js';
import { toActivitySummary } from './activity.mapper.js';

const row: ActivityDefinition = {
  id: '6f1c2f9e-0000-4000-8000-000000000000',
  slug: 'check-in-demo',
  name: 'Check-in demo',
  summary: 'A fictional test row.',
  manifestVersion: '0.1.0',
  minPlayers: 2,
  maxPlayers: 30,
  estimatedMinutesMin: 2,
  estimatedMinutesMax: 5,
  category: 'CHECK_IN',
  displayOrder: 20,
  availability: 'PLANNED',
  createdAt: new Date('2026-10-15T00:00:00Z'),
  updatedAt: new Date('2026-10-15T00:00:00Z'),
};

describe('toActivitySummary', () => {
  it('maps to the public contract with lowercase enums', () => {
    const summary = toActivitySummary(row);
    expect(activitySummarySchema.parse(summary)).toEqual({
      slug: 'check-in-demo',
      name: 'Check-in demo',
      summary: 'A fictional test row.',
      category: 'check_in',
      minPlayers: 2,
      maxPlayers: 30,
      estimatedMinutes: { min: 2, max: 5 },
      availability: 'planned',
    });
  });

  it('never exposes internal fields', () => {
    const keys = Object.keys(toActivitySummary(row));
    for (const internal of ['id', 'manifestVersion', 'displayOrder', 'createdAt', 'updatedAt']) {
      expect(keys).not.toContain(internal);
    }
  });
});
