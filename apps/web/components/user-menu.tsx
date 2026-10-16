'use client';

import { hardNavigate } from '@/lib/navigate';
import { ChevronUp, LogOut, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { Select, useAnnounce } from '@funfriday/ui';
import { signOut } from '@/lib/auth';
import { canViewAudit } from '@/lib/roles';
import { useCurrentMembership, useSession } from './session-provider';

const itemClass =
  'flex min-h-11 w-full items-center gap-2 rounded-ff-button px-3 text-left font-semibold text-ff-ink hover:bg-ff-violet-50';

/** Account menu: a disclosure (not an ARIA menu) holding org switcher, account and sign out. */
export function UserMenu({ placement }: { placement: 'sidebar' | 'top' }) {
  const { load, setCurrentOrgId } = useSession();
  const membership = useCurrentMembership();
  const announce = useAnnounce();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (load.status !== 'ready') return null;
  const { me } = load;
  const initial = (me.user.name || me.user.email).trim().charAt(0).toUpperCase();
  const role = membership?.role ?? null;

  const doSignOut = async () => {
    setBusy(true);
    setError(false);
    const result = await signOut();
    if (result.kind === 'ok' || result.kind === 'unauthenticated') {
      hardNavigate('/sign-in?signedout=1');
      return;
    }
    setBusy(false);
    setError(true);
  };

  const panelPosition =
    placement === 'top' ? 'top-full right-0 mt-2' : 'bottom-full left-2 mb-2 lg:left-4';

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((v) => !v);
        }}
        className={
          placement === 'top'
            ? 'ff-press flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full bg-ff-violet-50 px-3 font-bold text-ff-violet-700'
            : 'flex min-h-14 w-full items-center justify-center gap-3 rounded-ff-button px-2 hover:bg-ff-violet-50 lg:min-h-12 lg:justify-start lg:px-3'
        }
      >
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-ff-violet-700 text-sm font-bold text-white"
        >
          {initial}
        </span>
        <span
          className={placement === 'top' ? 'sr-only' : 'hidden min-w-0 flex-1 text-left lg:block'}
        >
          <span className="block truncate font-semibold text-ff-ink">{me.user.name}</span>
          {membership && (
            <span className="block truncate text-xs text-ff-muted">{membership.org.name}</span>
          )}
        </span>
        <span className="sr-only">Account and workspace menu</span>
        {placement === 'sidebar' && (
          <ChevronUp aria-hidden="true" className="hidden size-4 shrink-0 text-ff-muted lg:block" />
        )}
      </button>

      {open && (
        <div
          id={panelId}
          className={`absolute z-40 flex w-72 max-w-[calc(100vw-1rem)] flex-col gap-2 rounded-ff-card border border-ff-border bg-ff-surface p-3 shadow-ff-lg ${panelPosition}`}
        >
          <div className="px-3 py-1">
            <p className="truncate font-semibold text-ff-ink">{me.user.name}</p>
            <p className="truncate text-sm text-ff-muted">{me.user.email}</p>
          </div>
          {me.memberships.length > 1 && membership && (
            <Select
              label="Organisation"
              value={membership.org.id}
              options={me.memberships.map((m) => ({
                value: m.organization.id,
                label: m.organization.name,
              }))}
              onChange={(event) => {
                setCurrentOrgId(event.target.value);
                announce(`Switched to ${event.target.selectedOptions[0]?.text ?? 'organisation'}`);
              }}
            />
          )}
          {placement === 'top' && membership && (
            <nav aria-label="Workspace">
              <ul>
                <li>
                  <Link
                    href="/app/settings/members"
                    className={itemClass}
                    onClick={() => setOpen(false)}
                  >
                    Members
                  </Link>
                </li>
                <li>
                  <Link
                    href="/app/settings/teams"
                    className={itemClass}
                    onClick={() => setOpen(false)}
                  >
                    Teams
                  </Link>
                </li>
                {canViewAudit(role) && (
                  <li>
                    <Link
                      href="/app/settings/audit"
                      className={itemClass}
                      onClick={() => setOpen(false)}
                    >
                      Audit log
                    </Link>
                  </li>
                )}
              </ul>
            </nav>
          )}
          <Link href="/app/account" className={itemClass} onClick={() => setOpen(false)}>
            <UserRound aria-hidden="true" className="size-5" />
            Account
          </Link>
          <button
            type="button"
            className={itemClass}
            aria-disabled={busy || undefined}
            onClick={() => {
              if (!busy) void doSignOut();
            }}
          >
            <LogOut aria-hidden="true" className="size-5" />
            {busy ? 'Signing out...' : 'Sign out'}
          </button>
          {error && (
            <p role="alert" className="px-3 text-sm text-ff-coral-700">
              We couldn&apos;t sign you out. Check your connection and try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
