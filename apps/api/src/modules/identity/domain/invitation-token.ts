import { createHash, randomBytes } from 'node:crypto';
import { INVITATION_TTL_DAYS } from '@funfriday/contracts';

/** 32 random bytes as base64url (43 chars). The raw value exists only in the invitation email. */
export const generateInvitationToken = (): string => randomBytes(32).toString('base64url');

/** What the database stores: a SHA-256 hex digest (64 chars). */
export const hashInvitationToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const invitationExpiry = (now = new Date()): Date =>
  new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
