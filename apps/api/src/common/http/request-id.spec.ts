import { describe, expect, it } from 'vitest';
import { resolveRequestId } from './request-id.js';

describe('resolveRequestId', () => {
  it('keeps short, inert ids', () => {
    expect(resolveRequestId('abc-123_x.y')).toBe('abc-123_x.y');
  });

  it.each([undefined, '', 'a'.repeat(65), 'has space', '<script>', ['array']])(
    'replaces unsafe value %j with a uuid',
    (value) => {
      expect(resolveRequestId(value)).toMatch(/^[0-9a-f-]{36}$/);
    },
  );
});
