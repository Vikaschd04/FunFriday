import { describe, expect, it } from 'vitest';
import { isSafeInternalHref } from './safe-href';

describe('isSafeInternalHref', () => {
  it('accepts same-site absolute paths', () => {
    for (const ok of ['/', '/app', '/app/events/new?draft=abc', '/app/library?q=a&cat=quiz']) {
      expect(isSafeInternalHref(ok), ok).toBe(true);
    }
  });

  it('rejects anything that could leave the site or run code', () => {
    for (const bad of [
      '//evil.example.com',
      '/\\evil.example.com',
      'https://evil.example.com',
      'javascript:alert(1)',
      'app/library',
      '',
      '/app\nHost: x',
    ]) {
      expect(isSafeInternalHref(bad), bad).toBe(false);
    }
  });
});
