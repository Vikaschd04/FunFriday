import type { AuditEntry, Member, OrgRole } from '@funfriday/contracts';
import { ROLE_LABEL } from './roles';

const isRole = (value: unknown): value is OrgRole =>
  value === 'admin' || value === 'host' || value === 'participant';

const roleText = (value: unknown): string => (isRole(value) ? ROLE_LABEL[value] : 'a new role');

/** Display name for a member id, from the member list the Admin already loaded. */
export function memberLookup(members: readonly Member[]): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const member of members) {
    const label = member.name?.trim() || member.email;
    if (label) map.set(member.id, label);
  }
  return map;
}

const possessive = (name: string): string => (name.endsWith('s') ? `${name}'` : `${name}'s`);

/**
 * Human-readable sentence for an audit entry. Ids are only used to look names up; they are never
 * shown. A member who has since been removed reads as "a member".
 */
export function describeAudit(
  entry: AuditEntry,
  names: ReadonlyMap<string, string> = new Map(),
): string {
  const actor = entry.actor.name?.trim() || 'Someone';
  const target = names.get(entry.targetId) ?? 'a member';
  const meta = entry.metadata;
  const teamName = (key: 'name' | 'teamName'): string =>
    typeof meta[key] === 'string' && meta[key] ? `the team "${String(meta[key])}"` : 'a team';

  switch (entry.action) {
    case 'organization.created':
      return `${actor} created the organisation`;
    case 'membership.added':
      return `${actor} added ${target} as ${roleText(meta.role)}`;
    case 'invitation.sent':
      return `${actor} invited someone as ${roleText(meta.role)}`;
    case 'membership.claimed':
      return `${actor} joined as ${roleText(meta.role)}`;
    case 'membership.role_changed':
      return `${actor} changed ${possessive(target)} role from ${roleText(meta.from)} to ${roleText(meta.to)}`;
    case 'membership.removed':
      return `${actor} removed ${target} (${roleText(meta.role)})`;
    case 'team.created':
      return `${actor} created ${teamName('name')}`;
    case 'team.deleted':
      return `${actor} deleted ${teamName('name')}`;
    case 'team.member_added':
      return `${actor} added a member to ${teamName('teamName')}`;
    case 'team.member_removed':
      return `${actor} removed a member from ${teamName('teamName')}`;
  }
}

export function formatAbsolute(iso: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['day', 86_400],
  ['hour', 3600],
  ['minute', 60],
];

export function formatRelative(iso: string, now: number = Date.now(), locale?: string): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}
