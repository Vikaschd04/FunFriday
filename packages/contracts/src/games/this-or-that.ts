import { z } from 'zod';

/** This or That (docs/games/this-or-that.md). Wire shapes shared by game-core, API and web. */
export const THIS_OR_THAT = 'this-or-that' as const;

/**
 * Timing fairness (WCAG 2.2.1, P4 accessibility review): rounds are at least 20 s, answers can
 * be changed until time is up by default, and hosts can add time with `extend_round`.
 */
export const EXTEND_ROUND_SECONDS = 15;
export const thisOrThatConfigSchema = z.object({
  rounds: z.number().int().min(3).max(10).default(6),
  roundSeconds: z.number().int().min(20).max(60).default(30),
  allowAnswerChange: z.boolean().default(true),
  packId: z.literal('starter').default('starter'),
});
export type ThisOrThatConfig = z.infer<typeof thisOrThatConfigSchema>;
export type ThisOrThatConfigInput = z.input<typeof thisOrThatConfigSchema>;

export const thisOrThatChoiceSchema = z.enum(['A', 'B', 'pass']);
export type ThisOrThatChoice = z.infer<typeof thisOrThatChoiceSchema>;

export const thisOrThatActionSchema = z.object({
  type: z.literal('answer'),
  roundId: z.string().min(1).max(64),
  choice: thisOrThatChoiceSchema,
});
export type ThisOrThatAction = z.infer<typeof thisOrThatActionSchema>;

const counts = z.object({
  a: z.number().int().nonnegative(),
  b: z.number().int().nonnegative(),
  pass: z.number().int().nonnegative(),
});

export const thisOrThatRoundSummarySchema = counts.extend({
  number: z.number().int().positive(),
  question: z.string(),
  optionA: z.string(),
  optionB: z.string(),
});

const highlight = z.object({
  roundNumber: z.number().int().positive(),
  question: z.string(),
  option: z.string(),
  count: z.number().int().nonnegative(),
  answered: z.number().int().nonnegative(),
});

/** Aggregate only - never who chose what. This is all that is retained. */
export const thisOrThatSummarySchema = z.object({
  rounds: z.array(thisOrThatRoundSummarySchema),
  mostUnited: highlight.nullable(),
  closestSplit: z
    .object({
      roundNumber: z.number().int().positive(),
      question: z.string(),
      a: z.number().int(),
      b: z.number().int(),
    })
    .nullable(),
});
export type ThisOrThatSummary = z.infer<typeof thisOrThatSummarySchema>;

export const thisOrThatViewSchema = z.object({
  slug: z.literal(THIS_OR_THAT),
  phase: z.enum(['question', 'reveal', 'finished']),
  paused: z.boolean(),
  round: z
    .object({
      id: z.string(),
      number: z.number().int().positive(),
      total: z.number().int().positive(),
      question: z.string(),
      optionA: z.string(),
      optionB: z.string(),
      /** Absolute server epoch ms; null while paused or after the round closed. */
      deadlineAt: z.number().int().nullable(),
      /** Remaining time while paused. */
      remainingMs: z.number().int().nonnegative().nullable(),
    })
    .nullable(),
  myChoice: thisOrThatChoiceSchema.nullable(),
  answeredCount: z.number().int().nonnegative(),
  eligibleCount: z.number().int().nonnegative(),
  allowAnswerChange: z.boolean(),
  /** Present in reveal/finished for the current round. */
  reveal: counts.nullable(),
  summary: thisOrThatSummarySchema.nullable(),
});
export type ThisOrThatView = z.infer<typeof thisOrThatViewSchema>;
