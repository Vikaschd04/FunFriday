import type { OrgRole } from '@funfriday/contracts';

export const ROLE_LABEL: Record<OrgRole, string> = {
  admin: 'Admin',
  host: 'Host',
  participant: 'Participant',
};

export const ROLE_OPTIONS = (['admin', 'host', 'participant'] as const).map((value) => ({
  value,
  label: ROLE_LABEL[value],
}));

/** UI affordances only. The API enforces every one of these rules (403/404). */
export function canManageMembers(role: OrgRole | null): boolean {
  return role === 'admin';
}
export function canManageTeams(role: OrgRole | null): boolean {
  return role === 'admin' || role === 'host';
}
export function canViewAudit(role: OrgRole | null): boolean {
  return role === 'admin';
}
