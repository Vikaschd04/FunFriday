import type { ActivityCategory, ActivitySummary } from '@funfriday/contracts';
import type { ActivityDefinition } from '../../generated/prisma/client.js';

const CATEGORY: Record<ActivityDefinition['category'], ActivityCategory> = {
  ICEBREAKER: 'icebreaker',
  CHECK_IN: 'check_in',
  QUIZ: 'quiz',
  GUESSING: 'guessing',
  CREATIVE: 'creative',
};

const AVAILABILITY: Record<ActivityDefinition['availability'], ActivitySummary['availability']> = {
  PLANNED: 'planned',
  ENABLED: 'enabled',
  DISABLED: 'disabled',
};

/** Public shape only: no database ids, timestamps or manifest internals. */
export function toActivitySummary(row: ActivityDefinition): ActivitySummary {
  return {
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    category: CATEGORY[row.category],
    minPlayers: row.minPlayers,
    maxPlayers: row.maxPlayers,
    estimatedMinutes: { min: row.estimatedMinutesMin, max: row.estimatedMinutesMax },
    availability: AVAILABILITY[row.availability],
  };
}
