import { z } from 'zod';

export const SERVICE_NAME = 'funfriday-api';

export const dependencyCheckSchema = z.object({
  status: z.enum(['up', 'down']),
  latencyMs: z.number().int().nonnegative(),
});
export type DependencyCheck = z.infer<typeof dependencyCheckSchema>;

/** `GET /api/v1/health/live` - process is running; never touches dependencies. */
export const livenessResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal(SERVICE_NAME),
  time: z.iso.datetime(),
});
export type LivenessResponse = z.infer<typeof livenessResponseSchema>;

/**
 * `GET /api/v1/health/ready` - 200 when every dependency is up, 503 otherwise.
 * The body never contains connection strings, hostnames or error internals.
 */
export const readinessResponseSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  service: z.literal(SERVICE_NAME),
  version: z.string().min(1).max(64),
  time: z.iso.datetime(),
  checks: z.object({
    database: dependencyCheckSchema,
    redis: dependencyCheckSchema,
  }),
});
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
