import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiError, ErrorCode } from '@funfriday/contracts';
import { DomainException } from './domain.exception.js';
import { ValidationException } from './validation.exception.js';

const SAFE_MESSAGES: Record<ErrorCode, string> = {
  BAD_REQUEST: 'The request was invalid.',
  UNAUTHENTICATED: 'Authentication is required.',
  FORBIDDEN: 'You do not have access to this resource.',
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'That conflicts with the current state of the resource.',
  LAST_ADMIN: 'An organisation must keep at least one active admin.',
  TENANT_MISMATCH: 'You do not have access to this resource.',
  ROOM_NOT_FOUND: 'The room was not found.',
  INVITE_EXPIRED: 'This invitation has expired.',
  INVITE_EMAIL_MISMATCH: 'This invitation is for a different email address.',
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
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

export function codeForStatus(status: number): ErrorCode {
  return CODE_BY_STATUS[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
}

/**
 * Client errors raised by Express middleware (body-parser: malformed JSON 400,
 * oversized body 413) are `http-errors` objects, not Nest exceptions. They mark
 * themselves safe with `expose: true`; trust only their 4xx status, never their message.
 */
function exposedClientStatus(exception: unknown): number | undefined {
  if (typeof exception !== 'object' || exception === null) return undefined;
  const { expose, status } = exception as { expose?: unknown; status?: unknown };
  return expose === true && typeof status === 'number' && status >= 400 && status < 500
    ? status
    : undefined;
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
    exception instanceof HttpException
      ? exception.getStatus()
      : (exposedClientStatus(exception) ?? HttpStatus.INTERNAL_SERVER_ERROR);
  const code = exception instanceof DomainException ? exception.code : codeForStatus(status);
  const body: ApiError = { code, message: SAFE_MESSAGES[code], requestId };
  if (exception instanceof ValidationException) {
    body.details = exception.details;
  }
  return { status, body };
}
