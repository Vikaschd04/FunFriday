import { describe, expect, it } from 'vitest';
import { extractLinks } from './extract-links.js';

describe('extractLinks', () => {
  it('finds absolute links, strips trailing punctuation and de-duplicates', () => {
    const text =
      'Open http://localhost:4000/api/v1/auth/verify-email?token=abc&callbackURL=x. Or (https://example.test/a) again https://example.test/a';
    expect(extractLinks(text)).toEqual([
      'http://localhost:4000/api/v1/auth/verify-email?token=abc&callbackURL=x',
      'https://example.test/a',
    ]);
  });

  it('returns nothing for text without links', () => {
    expect(extractLinks('no links, javascript:alert(1)')).toEqual([]);
  });
});
