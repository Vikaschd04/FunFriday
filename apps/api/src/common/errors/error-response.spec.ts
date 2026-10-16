import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { apiErrorSchema } from '@funfriday/contracts';
import { describe, expect, it } from 'vitest';
import { ConflictDomainException, LastAdminException } from './domain.exception.js';
import { toErrorResponse } from './error-response.js';
import { ValidationException } from './validation.exception.js';

describe('toErrorResponse', () => {
  it.each([
    [new BadRequestException(), 400, 'BAD_REQUEST'],
    [new ForbiddenException(), 403, 'FORBIDDEN'],
    [new NotFoundException(), 404, 'NOT_FOUND'],
    [new ServiceUnavailableException(), 503, 'SERVICE_UNAVAILABLE'],
  ])('maps %s to %i %s', (exception, status, code) => {
    const result = toErrorResponse(exception, 'req-1');
    expect(result.status).toBe(status);
    expect(result.body.code).toBe(code);
    expect(apiErrorSchema.parse(result.body).requestId).toBe('req-1');
  });

  it('hides internal error details behind a generic 500', () => {
    const result = toErrorResponse(
      new Error('connect ECONNREFUSED 10.0.0.5:5432 password=hunter2'),
      'r',
    );
    expect(result.status).toBe(500);
    expect(result.body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(result.body)).not.toMatch(/ECONNREFUSED|hunter2|5432/);
  });

  it('never echoes exception messages that may contain user input', () => {
    const result = toErrorResponse(new NotFoundException('Cannot GET /<script>'), 'r');
    expect(result.body.message).not.toContain('<script>');
  });
});

describe('toErrorResponse for domain and validation errors', () => {
  it('maps DomainException codes and 409 statuses', () => {
    const last = toErrorResponse(new LastAdminException(), 'r');
    expect(last.status).toBe(409);
    expect(last.body.code).toBe('LAST_ADMIN');
    expect(toErrorResponse(new ConflictDomainException(), 'r').body.code).toBe('CONFLICT');
  });

  it('exposes only schema field errors for validation failures', () => {
    const result = toErrorResponse(
      new ValidationException({ fieldErrors: { name: ['Use at least 2 characters.'] } }),
      'r',
    );
    expect(result.status).toBe(400);
    expect(result.body.code).toBe('BAD_REQUEST');
    expect(result.body.details).toEqual({ fieldErrors: { name: ['Use at least 2 characters.'] } });
  });

  it('keeps the 4xx status of exposed middleware errors but never their message', () => {
    const tooLarge = Object.assign(new Error('request entity too large: 204800 > 102400'), {
      expose: true,
      status: 413,
      type: 'entity.too.large',
    });
    const result = toErrorResponse(tooLarge, 'r');
    expect(result.status).toBe(413);
    expect(result.body.code).toBe('BAD_REQUEST');
    expect(result.body.message).not.toContain('204800');
  });

  it('treats unexposed or 5xx-looking errors as internal', () => {
    expect(toErrorResponse(Object.assign(new Error('x'), { status: 413 }), 'r').status).toBe(500);
    expect(
      toErrorResponse(Object.assign(new Error('x'), { expose: true, status: 503 }), 'r').status,
    ).toBe(500);
  });
});
