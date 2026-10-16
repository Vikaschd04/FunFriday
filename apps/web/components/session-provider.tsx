'use client';

import { hardNavigate } from '@/lib/navigate';
import { usePathname } from 'next/navigation';
import {
  type ReactNode,
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { MeResponse, OrgRole, OrganizationRef } from '@funfriday/contracts';
import { ErrorState, Skeleton } from '@funfriday/ui';
import { fetchMe, type ApiFailure } from '@/lib/identity-api';

export const CURRENT_ORG_KEY = 'funfriday:current-org';

function readStoredOrg(): string | null {
  try {
    return window.localStorage.getItem(CURRENT_ORG_KEY);
  } catch {
    return null;
  }
}

function writeStoredOrg(id: string): void {
  try {
    window.localStorage.setItem(CURRENT_ORG_KEY, id);
  } catch {
    // Storage can be blocked (private mode); the switcher still works for this page view.
  }
}

type Load =
  | { status: 'loading' }
  | { status: 'ready'; me: MeResponse }
  | { status: 'failed'; failure: ApiFailure };

/**
 * What the current screen is scoped to. `foreign` is an organisation id from the URL that is not
 * in the caller's memberships: the screens still ask the API, which answers 404 - the UI never
 * assumes it knows better.
 */
export type OrgScope =
  | { kind: 'none' }
  | { kind: 'member'; org: OrganizationRef; role: OrgRole }
  | { kind: 'foreign'; orgId: string };

interface SessionValue {
  load: Load;
  /** Re-reads /me (claims invitations, refreshes memberships). Keeps the old data while loading. */
  reload: () => Promise<void>;
  currentOrgId: string | null;
  setCurrentOrgId: (id: string) => void;
  /** Called by any screen that receives a 401: leaves for sign-in and returns afterwards. */
  expire: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

/** The loaded /me response. Only call below <SessionGate>, which guarantees it. */
export function useMe(): MeResponse {
  const { load } = useSession();
  if (load.status !== 'ready') throw new Error('useMe called before the session was ready');
  return load.me;
}

export function useOrgScope(orgParam?: string): OrgScope {
  const me = useMe();
  const { currentOrgId } = useSession();
  if (orgParam) {
    const match = me.memberships.find((m) => m.organization.id === orgParam);
    return match
      ? { kind: 'member', org: match.organization, role: match.role }
      : { kind: 'foreign', orgId: orgParam };
  }
  const match =
    me.memberships.find((m) => m.organization.id === currentOrgId) ?? me.memberships[0] ?? null;
  return match ? { kind: 'member', org: match.organization, role: match.role } : { kind: 'none' };
}

/** Null-safe variant for chrome that renders before /me has loaded (nav, menus). */
export function useCurrentMembership(): { org: OrganizationRef; role: OrgRole } | null {
  const { load, currentOrgId } = useSession();
  if (load.status !== 'ready') return null;
  const list = load.me.memberships;
  const match = list.find((m) => m.organization.id === currentOrgId) ?? list[0];
  return match ? { org: match.organization, role: match.role } : null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [storedOrg, setStoredOrg] = useState<string | null>(null);

  const expire = useCallback(() => {
    const target = `${pathname}${window.location.search}`;
    hardNavigate(`/sign-in?next=${encodeURIComponent(target)}`);
  }, [pathname]);

  const reload = useCallback(async () => {
    const result = await fetchMe();
    if (result.kind === 'ok') {
      setLoad({ status: 'ready', me: result.data });
      // Validated against /me: a stale or foreign id in storage never selects an organisation.
      const stored = readStoredOrg();
      setStoredOrg(
        result.data.memberships.some((m) => m.organization.id === stored) ? stored : null,
      );
    } else if (result.kind === 'unauthenticated') {
      expire();
    } else {
      setLoad({ status: 'failed', failure: result });
    }
  }, [expire]);

  useEffect(() => {
    // One /me load when the app shell mounts; the provider outlives route changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const setCurrentOrgId = useCallback((id: string) => {
    writeStoredOrg(id);
    setStoredOrg(id);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ load, reload, currentOrgId: storedOrg, setCurrentOrgId, expire }),
    [load, reload, storedOrg, setCurrentOrgId, expire],
  );
  return <SessionContext value={value}>{children}</SessionContext>;
}

/** Shows loading / failure instead of the page until /me has answered. */
export function SessionGate({ children }: { children: ReactNode }) {
  const { load, reload } = useSession();
  const [retrying, setRetrying] = useState(false);
  if (load.status === 'loading') {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton variant="line" count={2} label="Loading your workspace..." />
        <Skeleton variant="block" count={2} />
      </div>
    );
  }
  if (load.status === 'failed') {
    const limited = load.failure.kind === 'rate_limited';
    return (
      <ErrorState
        headingLevel={1}
        title={limited ? 'Too many requests' : "We can't load your workspace"}
        body={
          limited
            ? 'Please wait a moment and try again.'
            : "Check your connection (you may be offline) and try again. Anything you've planned on this device is safe."
        }
        retrying={retrying}
        onRetry={() => {
          setRetrying(true);
          void reload().finally(() => {
            setRetrying(false);
          });
        }}
        className="max-w-2xl"
      />
    );
  }
  return <>{children}</>;
}
