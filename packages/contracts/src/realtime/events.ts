import { z } from 'zod';
import { errorCodeSchema } from '../errors.js';
import {
  THIS_OR_THAT,
  thisOrThatConfigSchema,
  thisOrThatSummarySchema,
  thisOrThatViewSchema,
} from '../games/this-or-that.js';
import { liveSessionStatusSchema } from './session.js';

/** Socket.IO namespace for live sessions (ADR 0003). */
export const LIVE_NAMESPACE = '/live';

/** Canonical event names (docs/API_AND_EVENTS.md). */
export const LiveEvent = {
  join: 'session:join',
  ready: 'participant:ready',
  hostCommand: 'host:command',
  gameAction: 'game:action',
  resync: 'room:resync',
  state: 'room:state',
} as const;

export const clientActionIdSchema = z.uuid();
const sessionId = z.uuid();

export const gameSlugSchema = z.enum([THIS_OR_THAT]);
export type GameSlug = z.infer<typeof gameSlugSchema>;

export const hostCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('start_game'),
    game: z.literal(THIS_OR_THAT),
    config: thisOrThatConfigSchema,
  }),
  z.object({ type: z.literal('close_round') }),
  /** Adds EXTEND_ROUND_SECONDS to the current question (also while paused). */
  z.object({ type: z.literal('extend_round') }),
  z.object({ type: z.literal('next_round') }),
  z.object({ type: z.literal('pause') }),
  z.object({ type: z.literal('resume') }),
  z.object({ type: z.literal('end_game') }),
  z.object({ type: z.literal('end_session') }),
]);
export type HostCommand = z.infer<typeof hostCommandSchema>;

// ---- client -> server payloads ----
export const joinPayloadSchema = z.object({ sessionId });
export const readyPayloadSchema = z.object({
  sessionId,
  ready: z.boolean(),
  clientActionId: clientActionIdSchema,
});
export const hostCommandPayloadSchema = z.object({
  sessionId,
  clientActionId: clientActionIdSchema,
  command: hostCommandSchema,
});
/** `action` is validated by the active game's own schema (e.g. thisOrThatActionSchema). */
export const gameActionPayloadSchema = z.object({
  sessionId,
  clientActionId: clientActionIdSchema,
  action: z.unknown(),
});
export const resyncPayloadSchema = z.object({ sessionId });

// ---- views ----
export const roomParticipantSchema = z.object({
  memberId: z.uuid(),
  name: z.string().nullable(),
  connected: z.boolean(),
  ready: z.boolean(),
  isHost: z.boolean(),
});
export type RoomParticipant = z.infer<typeof roomParticipantSchema>;

export const gameViewSchema = z.discriminatedUnion('slug', [thisOrThatViewSchema]);
export type GameView = z.infer<typeof gameViewSchema>;

export const roomViewSchema = z.object({
  sessionId,
  title: z.string(),
  roomCode: z.string(),
  status: liveSessionStatusSchema,
  me: z.object({ memberId: z.uuid(), isHost: z.boolean() }),
  participants: z.array(roomParticipantSchema),
  game: gameViewSchema.nullable(),
  /** Summary of the most recently finished game (aggregate only). */
  lastSummary: z.object({ slug: gameSlugSchema, summary: thisOrThatSummarySchema }).nullable(),
});
export type RoomView = z.infer<typeof roomViewSchema>;

/** `room:state` broadcast and the payload of join/resync acks. */
export const roomStateSchema = z.object({
  revision: z.number().int().nonnegative(),
  /** Server epoch ms when the view was produced - clients derive clock skew from it. */
  serverNow: z.number().int(),
  view: roomViewSchema,
});
export type RoomState = z.infer<typeof roomStateSchema>;

// ---- acks ----
export const actionAckSchema = z.object({
  status: z.enum(['accepted', 'duplicate', 'rejected']),
  revision: z.number().int().nonnegative(),
  code: errorCodeSchema.optional(),
});
export type ActionAck = z.infer<typeof actionAckSchema>;

export const joinAckSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('joined'), state: roomStateSchema }),
  z.object({ status: z.literal('rejected'), code: errorCodeSchema }),
]);
export type JoinAck = z.infer<typeof joinAckSchema>;
