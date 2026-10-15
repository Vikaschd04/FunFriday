import { z } from 'zod';

/**
 * Canonical machine-readable error codes shared by HTTP and Socket.IO responses.
 * See docs/API_AND_EVENTS.md "HTTP/Socket error vocabulary".
 */
export const errorCodes = [
  'BAD_REQUEST',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'TENANT_MISMATCH',
  'ROOM_NOT_FOUND',
  'INVITE_EXPIRED',
  'ROOM_FULL',
  'NOT_HOST',
  'ROUND_CLOSED',
  'DUPLICATE_ACTION',
  'INVALID_ACTION',
  'OUT_OF_SYNC',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;

export const errorCodeSchema = z.enum(errorCodes);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** Standard error envelope: `{ code, message, requestId, details? }`. */
export const apiErrorSchema = z.object({
  code: errorCodeSchema,
  message: z.string().min(1).max(500),
  requestId: z.string().min(1).max(64),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
