import { describe, expect, it } from 'vitest';
import { invitationTokenSchema } from '@funfriday/contracts';
import {
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiry,
} from './invitation-token.js';

describe('invitation tokens', () => {
  it('generates unique 43-char base64url tokens accepted by the contract', () => {
    const a = generateInvitationToken();
    expect(invitationTokenSchema.safeParse(a).success).toBe(true);
    expect(a).not.toBe(generateInvitationToken());
  });
  it('stores only a 64-char hex digest that does not contain the token', () => {
    const token = generateInvitationToken();
    const hash = hashInvitationToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashInvitationToken(token)).toBe(hash);
  });
  it('expires 14 days out', () => {
    const now = new Date('2026-10-16T00:00:00Z');
    expect(invitationExpiry(now).toISOString()).toBe('2026-10-30T00:00:00.000Z');
  });
});
