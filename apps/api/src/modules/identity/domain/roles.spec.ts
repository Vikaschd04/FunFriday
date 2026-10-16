import { describe, expect, it } from 'vitest';
import { leavesNoActiveAdmin, slugify, toContractRole, toDbRole } from './roles.js';

describe('role mapping', () => {
  it('round-trips between contract and database values', () => {
    expect(toContractRole('HOST')).toBe('host');
    expect(toDbRole('participant')).toBe('PARTICIPANT');
  });
});

describe('leavesNoActiveAdmin', () => {
  const base = { targetRole: 'ADMIN', targetStatus: 'ACTIVE', activeAdminCount: 1 } as const;
  it('blocks demoting or removing the only active admin', () => {
    expect(leavesNoActiveAdmin({ ...base, newRole: 'HOST' })).toBe(true);
    expect(leavesNoActiveAdmin({ ...base, newRole: 'REMOVED' })).toBe(true);
  });
  it('allows changes when another active admin remains or the target is not an active admin', () => {
    expect(leavesNoActiveAdmin({ ...base, activeAdminCount: 2, newRole: 'HOST' })).toBe(false);
    expect(leavesNoActiveAdmin({ ...base, newRole: 'ADMIN' })).toBe(false);
    expect(leavesNoActiveAdmin({ ...base, targetStatus: 'INVITED', newRole: 'HOST' })).toBe(false);
    expect(leavesNoActiveAdmin({ ...base, targetRole: 'HOST', newRole: 'REMOVED' })).toBe(false);
  });
});

describe('slugify', () => {
  it('produces kebab-case ascii slugs', () => {
    expect(slugify('Acme  Corp!')).toBe('acme-corp');
    expect(slugify('Café Déjà Vu')).toBe('cafe-deja-vu');
  });
  it('never returns an empty or over-long slug', () => {
    expect(slugify('!!!')).toBe('org');
    expect(slugify('a'.repeat(100)).length).toBeLessThanOrEqual(40);
  });
});
