import { z } from 'zod';
import { activitySlugSchema } from '../activities/activity.js';
import { isValidTimeZone, zonedWallTimeToUtc } from '../time/zoned.js';

export const EVENT_LIMITS = {
  titleMin: 3,
  titleMax: 80,
  durationMin: 15,
  durationMax: 240,
  groupMin: 2,
  groupMax: 200,
  activitiesMax: 8,
  activityMinutesMin: 2,
  activityMinutesMax: 60,
} as const;

export const eventDraftActivitySchema = z.object({
  slug: activitySlugSchema,
  minutes: z
    .number()
    .int()
    .min(
      EVENT_LIMITS.activityMinutesMin,
      `Give each activity at least ${EVENT_LIMITS.activityMinutesMin} minutes.`,
    )
    .max(
      EVENT_LIMITS.activityMinutesMax,
      `Keep each activity to ${EVENT_LIMITS.activityMinutesMax} minutes or less.`,
    ),
});
export type EventDraftActivity = z.infer<typeof eventDraftActivitySchema>;

const httpsUrl = z
  .url({ message: 'Enter a full meeting link, starting with https://' })
  .refine((value) => value.startsWith('https://'), 'Meeting links must start with https://');

/**
 * An event being planned. In P1 it lives only in the planner's browser; P3 adds
 * persistence and reuses this schema at the API boundary.
 */
export const eventDraftSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(
        EVENT_LIMITS.titleMin,
        `Give your event a name of at least ${EVENT_LIMITS.titleMin} characters.`,
      )
      .max(EVENT_LIMITS.titleMax, `Keep the name under ${EVENT_LIMITS.titleMax} characters.`),
    startsAtLocal: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Choose a date and start time.'),
    timeZone: z.string().refine(isValidTimeZone, 'Choose a valid time zone.'),
    durationMinutes: z
      .number()
      .int()
      .min(EVENT_LIMITS.durationMin, `Events run at least ${EVENT_LIMITS.durationMin} minutes.`)
      .max(EVENT_LIMITS.durationMax, `Events run at most ${EVENT_LIMITS.durationMax} minutes.`),
    expectedParticipants: z
      .number()
      .int()
      .min(EVENT_LIMITS.groupMin, `Plan for at least ${EVENT_LIMITS.groupMin} people.`)
      .max(EVENT_LIMITS.groupMax, `Groups above ${EVENT_LIMITS.groupMax} are not supported yet.`),
    meetingUrl: z.union([z.literal(''), httpsUrl]).default(''),
    activities: z
      .array(eventDraftActivitySchema)
      .min(1, 'Pick at least one activity.')
      .max(EVENT_LIMITS.activitiesMax, `Pick up to ${EVENT_LIMITS.activitiesMax} activities.`)
      .refine(
        (items) => new Set(items.map((item) => item.slug)).size === items.length,
        'Each activity can only appear once.',
      ),
  })
  .superRefine((draft, ctx) => {
    const converted = zonedWallTimeToUtc(draft.startsAtLocal, draft.timeZone);
    if (!converted.ok && converted.reason === 'nonexistent_local_time') {
      ctx.addIssue({
        code: 'custom',
        path: ['startsAtLocal'],
        message: 'That time is skipped when clocks change in this time zone. Pick another time.',
      });
    } else if (!converted.ok && converted.reason === 'invalid_date') {
      ctx.addIssue({
        code: 'custom',
        path: ['startsAtLocal'],
        message: 'Choose a real calendar date.',
      });
    }
  });
export type EventDraft = z.infer<typeof eventDraftSchema>;
export type EventDraftInput = z.input<typeof eventDraftSchema>;
