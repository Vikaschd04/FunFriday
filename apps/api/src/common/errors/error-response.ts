import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiError, ErrorCode } from '@funfriday/contracts';

const SAFE_MESSAGES: Record<ErrorCode, string> = {
  BAD_REQUEST: 'The request was invalid.',
  UNAUTHENTICATED: 'Authentication is required.',
  FORBIDDEN: 'You do not have access to this resource.',
  NOT_FOUND: 'The requested resource was not found.',
  TENANT_MISMATCH: 'You do not have access to this resource.',
  ROOM_NOT_FOUND: 'The room was not found.',
  INVITE_EXPIRED: 'This invitation has expired.',
  ROOM_FULL: 'This room is full.',
  NOT_HOST: 'Only the host can do that.',
  ROUND_CLOSED: 'This round is closed.',
  DUPLICATE_ACTION: 'This action was already received.',
  INVALID_ACTION: 'That action is not allowed right now.',
  OUT_OF_SYNC: 'Your view is out of date. Refresh and try again.',
  RATE_LIMITED: 'Too many requests. Please slow down.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable.',
  INTERNAL_ERROR: 'An unexpected error occurred.',
};

const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

export function codeForStatus(status: number): ErrorCode {
  return CODE_BY_STATUS[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
}

/**
 * Maps any thrown value to the standard envelope. Messages come from a fixed
 * allowlist so stack traces, SQL, hostnames or echoed user input never leak.
 */
export function toErrorResponse(
  exception: unknown,
  requestId: string,
): { status: number; body: ApiError } {
  const status =
    exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
  const code = codeForStatus(status);
  return { status, body: { code, message: SAFE_MESSAGES[code], requestId } };
}
