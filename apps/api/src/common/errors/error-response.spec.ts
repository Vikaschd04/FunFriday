import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { apiErrorSchema } from '@funfriday/contracts';
import { describe, expect, it } from 'vitest';
import { toErrorResponse } from './error-response.js';

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
