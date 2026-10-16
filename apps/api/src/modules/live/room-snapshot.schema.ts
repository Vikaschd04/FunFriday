import {
  THIS_OR_THAT,
  thisOrThatChoiceSchema,
  thisOrThatConfigSchema,
  thisOrThatSummarySchema,
} from '@funfriday/contracts';
import type { RoomSnapshot } from '@funfriday/game-core';
import { z } from 'zod';

const epochMs = z.number().int().nonnegative();

const roundSchema = z.object({
  id: z.string().max(64),
  promptId: z.string().max(128),
  question: z.string().max(500),
  optionA: z.string().max(200),
  optionB: z.string().max(200),
  answers: z.record(z.string().max(64), thisOrThatChoiceSchema),
  deadlineAt: epochMs.nullable(),
  remainingMs: epochMs.nullable(),
  revealed: z.boolean(),
});

const gameSchema = z.object({
  slug: z.literal(THIS_OR_THAT),
  startedAt: epochMs,
  state: z.object({
    slug: z.literal(THIS_OR_THAT),
    config: thisOrThatConfigSchema,
    phase: z.enum(['question', 'reveal', 'finished']),
    paused: z.boolean(),
    roundIndex: z.number().int().nonnegative(),
    rounds: z.array(roundSchema).min(1).max(10),
  }),
});

/**
 * Shape of a Redis room snapshot. Redis is a trust boundary: a snapshot is validated like
 * any other input before the actor adopts it (strict objects - unknown keys are refused).
 */
export const roomSnapshotSchema = z.strictObject({
  version: z.literal(1),
  sessionId: z.uuid(),
  organizationId: z.uuid(),
  title: z.string().max(200),
  roomCode: z.string().length(6),
  status: z.enum(['lobby', 'live', 'ended']),
  revision: z.number().int().nonnegative(),
  members: z.record(
    z.uuid(),
    z.strictObject({
      name: z.string().max(200).nullable(),
      connected: z.boolean(),
      ready: z.boolean(),
      isHost: z.boolean(),
      joinedAt: epochMs,
    }),
  ),
  game: gameSchema.strict().nullable(),
  lastSummary: z
    .strictObject({ slug: z.literal(THIS_OR_THAT), summary: thisOrThatSummarySchema })
    .nullable(),
  recentActions: z.record(z.string().max(64), z.array(z.string().max(64)).max(100)),
}) satisfies z.ZodType<RoomSnapshot, unknown>;
