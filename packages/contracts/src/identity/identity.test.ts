import { describe, expect, it } from 'vitest';
import {
  addMemberRequestSchema,
  invitationTokenRequestSchema,
  auditEntrySchema,
  createOrganizationRequestSchema,
  meResponseSchema,
  memberSchema,
  passwordSchema,
} from './identity.js';

const uuid = '0b6c8c64-3f43-4a5e-9e57-7d1f1d8f0a11';

describe('identity contracts', () => {
  it('normalises member emails and restricts roles', () => {
    expect(addMemberRequestSchema.parse({ email: '  Ana@Example.COM ', role: 'host' })).toEqual({
      email: 'ana@example.com',
      role: 'host',
    });
    expect(
      addMemberRequestSchema.safeParse({ email: 'ana@example.com', role: 'owner' }).success,
    ).toBe(false);
    expect(addMemberRequestSchema.safeParse({ email: 'not-an-email', role: 'host' }).success).toBe(
      false,
    );
  });

  it('enforces the password policy length bounds', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('correct horse battery').success).toBe(true);
    expect(passwordSchema.safeParse('x'.repeat(129)).success).toBe(false);
  });

  it('trims and bounds organisation names', () => {
    expect(createOrganizationRequestSchema.parse({ name: '  Fictional Co  ' }).name).toBe(
      'Fictional Co',
    );
    expect(createOrganizationRequestSchema.safeParse({ name: 'x' }).success).toBe(false);
  });

  it('allows email to be absent for role-redacted member views', () => {
    const base = {
      id: uuid,
      name: 'Sam',
      role: 'participant',
      status: 'active',
      joinedAt: '2026-10-15T10:00:00.000Z',
    };
    expect(memberSchema.parse(base)).not.toHaveProperty('email');
    expect(memberSchema.parse({ ...base, email: 'sam@example.com' }).email).toBe('sam@example.com');
  });

  it('rejects unknown audit actions and free-text-sized metadata', () => {
    const entry = {
      id: uuid,
      action: 'membership.role_changed',
      actor: { userId: uuid, name: 'Ana' },
      targetType: 'membership',
      targetId: uuid,
      metadata: { from: 'participant', to: 'host' },
      createdAt: '2026-10-15T10:00:00.000Z',
    };
    expect(auditEntrySchema.safeParse(entry).success).toBe(true);
    expect(auditEntrySchema.safeParse({ ...entry, action: 'password.viewed' }).success).toBe(false);
    expect(
      auditEntrySchema.safeParse({ ...entry, metadata: { note: 'x'.repeat(121) } }).success,
    ).toBe(false);
  });

  it('accepts the /me shape', () => {
    expect(
      meResponseSchema.safeParse({
        user: { id: uuid, name: 'Ana', email: 'ana@example.com', emailVerified: true },
        memberships: [
          { organization: { id: uuid, slug: 'fictional-co', name: 'Fictional Co' }, role: 'admin' },
        ],
        needsEmailVerification: false,
      }).success,
    ).toBe(true);
  });

  it('accepts only well-formed invitation tokens', () => {
    expect(invitationTokenRequestSchema.safeParse({ token: 'A'.repeat(43) }).success).toBe(true);
    expect(invitationTokenRequestSchema.safeParse({ token: 'A'.repeat(42) }).success).toBe(false);
    expect(invitationTokenRequestSchema.safeParse({ token: `${'A'.repeat(42)}=` }).success).toBe(
      false,
    );
    expect(invitationTokenRequestSchema.safeParse({ token: '../../etc/passwd' }).success).toBe(
      false,
    );
  });
});
