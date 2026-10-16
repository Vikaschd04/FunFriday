import { z } from 'zod';

/** 6 characters from an unambiguous alphabet (no 0/O, 1/I/L). Discovery only - never authorisation. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.string().regex(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/, 'Enter the 6-character code.'));

export const liveSessionStatusSchema = z.enum(['lobby', 'live', 'ended']);
export type LiveSessionStatus = z.infer<typeof liveSessionStatusSchema>;

export const liveSessionSummarySchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  title: z.string(),
  roomCode: z.string(),
  status: liveSessionStatusSchema,
  /** Null when the host has left the organisation; org Admins still control the session. */
  host: z.object({ memberId: z.uuid(), name: z.string().nullable() }).nullable(),
  createdAt: z.iso.datetime(),
});
export type LiveSessionSummary = z.infer<typeof liveSessionSummarySchema>;

/** `POST /api/v1/organizations/:orgId/sessions` (Admin, Host). */
export const createLiveSessionRequestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Use at least 2 characters.')
    .max(60, 'Keep the title under 60 characters.')
    .optional(),
});
export type CreateLiveSessionRequest = z.infer<typeof createLiveSessionRequestSchema>;

/** `GET /api/v1/organizations/:orgId/sessions` - sessions not yet ended. */
export const liveSessionListResponseSchema = z.object({
  sessions: z.array(liveSessionSummarySchema),
});
export type LiveSessionListResponse = z.infer<typeof liveSessionListResponseSchema>;

/** `POST /api/v1/sessions/join-by-code` (session). 404 unless the caller is an active member of that org. */
export const joinByCodeRequestSchema = z.object({ code: roomCodeSchema });
export const joinByCodeResponseSchema = z.object({ sessionId: z.uuid(), organizationId: z.uuid() });
export type JoinByCodeResponse = z.infer<typeof joinByCodeResponseSchema>;
