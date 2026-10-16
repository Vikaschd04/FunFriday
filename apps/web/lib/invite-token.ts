import { invitationTokenSchema } from '@funfriday/contracts';

const KEY = 'funfriday:invite-token';

/** Valid token or null. The token lives in sessionStorage for this tab only, never in a URL. */
export function parseInviteToken(value: string | null): string | null {
  const parsed = invitationTokenSchema.safeParse(value ?? '');
  return parsed.success ? parsed.data : null;
}

export function storeInviteToken(token: string): void {
  try {
    window.sessionStorage.setItem(KEY, token);
  } catch {
    // Blocked storage: the flow still works for this page view while the token is in memory.
  }
}

export function readStoredInviteToken(): string | null {
  try {
    return parseInviteToken(window.sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function clearInviteToken(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
