import type { AuditEntry } from '@funfriday/contracts';
import { describe, expect, it } from 'vitest';
import { describeAudit, formatRelative, memberLookup } from './audit-text';

const ID = '3f2b8a52-0c1e-4b6e-9a53-1d7c6f1f2a10';
const entry = (over: Partial<AuditEntry>): AuditEntry => ({
  id: ID,
  action: 'organization.created',
  actor: { userId: ID, name: 'Ana' },
  targetType: 'organization',
  targetId: ID,
  metadata: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('describeAudit', () => {
  const names = memberLookup([
    {
      id: ID,
      name: 'Sam',
      email: 'sam@example.test',
      role: 'host',
      status: 'active',
      joinedAt: null,
    },
  ]);

  it('reads role changes as a sentence', () => {
    expect(
      describeAudit(
        entry({
          action: 'membership.role_changed',
          targetType: 'membership',
          metadata: { from: 'participant', to: 'host' },
        }),
        names,
      ),
    ).toBe("Ana changed Sam's role from Participant to Host");
  });

  it('never prints ids; unknown targets read as "a member"', () => {
    const text = describeAudit(
      entry({
        action: 'membership.removed',
        targetType: 'membership',
        metadata: { role: 'participant' },
      }),
    );
    expect(text).toBe('Ana removed a member (Participant)');
    expect(text).not.toContain(ID);
  });

  it('names teams and tolerates a missing actor', () => {
    expect(
      describeAudit(
        entry({
          action: 'team.created',
          targetType: 'team',
          metadata: { name: 'Design' },
          actor: { userId: null, name: null },
        }),
      ),
    ).toBe('Someone created the team "Design"');
    expect(
      describeAudit(entry({ action: 'team.member_added', targetType: 'team', metadata: {} })),
    ).toBe('Ana added a member to a team');
  });

  it('falls back to the email when a member has no name yet', () => {
    const lookup = memberLookup([
      {
        id: ID,
        name: null,
        email: 'pat@example.test',
        role: 'participant',
        status: 'invited',
        joinedAt: null,
      },
    ]);
    expect(
      describeAudit(
        entry({
          action: 'membership.added',
          targetType: 'membership',
          metadata: { role: 'participant' },
        }),
        lookup,
      ),
    ).toBe('Ana added pat@example.test as Participant');
  });
});

describe('formatRelative', () => {
  const now = Date.parse('2026-06-01T12:00:00Z');
  it('is relative and human', () => {
    expect(formatRelative('2026-06-01T11:59:50Z', now, 'en')).toBe('just now');
    expect(formatRelative('2026-06-01T11:00:00Z', now, 'en')).toBe('1 hour ago');
    expect(formatRelative('2026-05-30T12:00:00Z', now, 'en')).toBe('2 days ago');
  });
});
