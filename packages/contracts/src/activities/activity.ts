import { z } from 'zod';

export const activitySlugSchema = z
  .string()
  .max(64)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case');

export const activityCategories = [
  'icebreaker',
  'check_in',
  'quiz',
  'guessing',
  'creative',
] as const;
export const activityCategorySchema = z.enum(activityCategories);
export type ActivityCategory = z.infer<typeof activityCategorySchema>;

/** `planned` = designed but not playable yet; `enabled` = playable; `disabled` = hidden by ops. */
export const activityAvailabilitySchema = z.enum(['planned', 'enabled', 'disabled']);
export type ActivityAvailability = z.infer<typeof activityAvailabilitySchema>;

export const activitySummarySchema = z
  .object({
    slug: activitySlugSchema,
    name: z.string().min(1).max(80),
    summary: z.string().min(1).max(280),
    category: activityCategorySchema,
    minPlayers: z.number().int().positive(),
    maxPlayers: z.number().int().positive(),
    estimatedMinutes: z.object({
      min: z.number().int().positive(),
      max: z.number().int().positive(),
    }),
    availability: activityAvailabilitySchema,
  })
  .refine((a) => a.minPlayers <= a.maxPlayers, { message: 'minPlayers > maxPlayers' })
  .refine((a) => a.estimatedMinutes.min <= a.estimatedMinutes.max, {
    message: 'estimatedMinutes.min > max',
  });
export type ActivitySummary = z.infer<typeof activitySummarySchema>;

/** `GET /api/v1/activities` - global catalog, ordered for display. No internal ids. */
export const activityListResponseSchema = z.object({
  activities: z.array(activitySummarySchema),
});
export type ActivityListResponse = z.infer<typeof activityListResponseSchema>;
