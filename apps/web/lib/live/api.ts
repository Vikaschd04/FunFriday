import {
  joinByCodeResponseSchema,
  liveSessionListResponseSchema,
  liveSessionSummarySchema,
  type CreateLiveSessionRequest,
  type JoinByCodeResponse,
  type LiveSessionListResponse,
  type LiveSessionSummary,
} from '@funfriday/contracts';
import { requestJson, type ApiResult, type RequestOptions } from '../http';

export function createLiveSession(
  orgId: string,
  body: CreateLiveSessionRequest,
  options?: RequestOptions,
): Promise<ApiResult<LiveSessionSummary>> {
  return requestJson({
    ...options,
    method: 'POST',
    path: `/organizations/${encodeURIComponent(orgId)}/sessions`,
    body,
    schema: liveSessionSummarySchema,
  });
}

export function listLiveSessions(
  orgId: string,
  options?: RequestOptions,
): Promise<ApiResult<LiveSessionListResponse>> {
  return requestJson({
    ...options,
    path: `/organizations/${encodeURIComponent(orgId)}/sessions`,
    schema: liveSessionListResponseSchema,
  });
}

export function joinByCode(
  code: string,
  options?: RequestOptions,
): Promise<ApiResult<JoinByCodeResponse>> {
  return requestJson({
    ...options,
    method: 'POST',
    path: '/sessions/join-by-code',
    body: { code },
    schema: joinByCodeResponseSchema,
  });
}

/** Relative time for "Started 12 min ago". `now` is injected so tests are deterministic. */
export function relativeStart(createdAtIso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(createdAtIso)) / 60_000));
  if (minutes < 1) return 'Started just now';
  if (minutes < 60) return `Started ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `Started ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
}
