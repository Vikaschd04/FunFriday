import type { OrgRole } from '@funfriday/contracts';

/** Prisma enum values (upper case). The generated enum is an infrastructure detail. */
export type DbRole = 'ADMIN' | 'HOST' | 'PARTICIPANT';
export type DbStatus = 'INVITED' | 'ACTIVE';

export const toContractRole = (role: DbRole): OrgRole => role.toLowerCase() as OrgRole;
export const toDbRole = (role: OrgRole): DbRole => role.toUpperCase() as DbRole;
export const toContractStatus = (status: DbStatus): 'invited' | 'active' =>
  status === 'ACTIVE' ? 'active' : 'invited';

/** Last-admin rule (D024): an organisation must always keep an ACTIVE admin. */
export function leavesNoActiveAdmin(input: {
  targetRole: DbRole;
  targetStatus: DbStatus;
  newRole: DbRole | 'REMOVED';
  activeAdminCount: number;
}): boolean {
  const targetIsActiveAdmin = input.targetRole === 'ADMIN' && input.targetStatus === 'ACTIVE';
  const staysAdmin = input.newRole === 'ADMIN';
  return targetIsActiveAdmin && !staysAdmin && input.activeAdminCount <= 1;
}

/** Lower-case ASCII kebab slug, at most `max` characters; never empty. */
export function slugify(name: string, max = 40): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return slug.length > 0 ? slug : 'org';
}
