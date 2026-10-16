'use client';

import {
  CalendarPlus,
  History,
  Library,
  LayoutDashboard,
  UsersRound,
  UserRoundCog,
  type LucideIcon,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useRef } from 'react';
import { buttonStyles } from '@funfriday/ui';
import { canViewAudit } from '@/lib/roles';
import { LogoMark } from './brand-art';
import { SessionGate, SessionProvider, useCurrentMembership } from './session-provider';
import { GuardedLink, UnsavedGuardProvider } from './unsaved-guard';
import { UserMenu } from './user-menu';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
}

const NAV: NavItem[] = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard, match: (p) => p === '/app' },
  {
    href: '/app/library',
    label: 'Activities',
    icon: Library,
    match: (p) => p.startsWith('/app/library'),
  },
  {
    href: '/app/events/new',
    label: 'Plan event',
    icon: CalendarPlus,
    match: (p) => p.startsWith('/app/events'),
  },
];

const WORKSPACE_NAV: (NavItem & { adminOnly?: boolean })[] = [
  {
    href: '/app/settings/members',
    label: 'Members',
    icon: UsersRound,
    match: (p) => p.startsWith('/app/settings/members'),
  },
  {
    href: '/app/settings/teams',
    label: 'Teams',
    icon: UserRoundCog,
    match: (p) => p.startsWith('/app/settings/teams'),
  },
  {
    href: '/app/settings/audit',
    label: 'Audit log',
    icon: History,
    match: (p) => p.startsWith('/app/settings/audit'),
    adminOnly: true,
  },
];

/** Mobile tab label is shorter: "Plan" (the Plan tab is the quick-create). */
const SHORT: Record<string, string> = { 'Plan event': 'Plan' };

function navLinkClass(active: boolean): string {
  return [
    'relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs leading-4 md:min-h-16 md:rounded-ff-button',
    'lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-base lg:leading-6',
    active
      ? 'bg-ff-violet-50 font-bold text-ff-violet-700'
      : 'font-semibold text-ff-ink hover:bg-ff-violet-50',
    // Shape cue (not colour alone): 3px top bar on tabs, left bar on rail/sidebar.
    active
      ? 'before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-ff-violet-700 md:before:inset-x-auto md:before:top-2 md:before:left-0 md:before:h-[calc(100%-1rem)] md:before:w-[3px] md:before:rounded-full'
      : '',
  ].join(' ');
}

function PrimaryNav({ pathname }: { pathname: string }) {
  const membership = useCurrentMembership();
  const workspace = membership
    ? WORKSPACE_NAV.filter((item) => !item.adminOnly || canViewAudit(membership.role))
    : [];
  return (
    <div className="md:flex-1 md:overflow-y-auto">
      <nav aria-label="Primary">
        <ul className="grid grid-cols-3 md:flex md:flex-col md:gap-1 md:px-2 md:py-2 lg:px-4">
          {NAV.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <li key={href}>
                <GuardedLink
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={navLinkClass(active)}
                >
                  <Icon aria-hidden="true" className="size-6 shrink-0" />
                  <span>
                    <span className="md:hidden">{SHORT[label] ?? label}</span>
                    <span className="hidden md:inline">{label}</span>
                  </span>
                </GuardedLink>
              </li>
            );
          })}
        </ul>
      </nav>
      {workspace.length > 0 && (
        <nav aria-label="Workspace" className="hidden md:block">
          <p className="mt-3 hidden px-7 text-xs font-semibold tracking-wide text-ff-muted uppercase lg:block">
            Workspace
          </p>
          <hr className="mx-4 mt-2 border-ff-border lg:hidden" />
          <ul className="flex flex-col gap-1 px-2 py-2 lg:px-4">
            {workspace.map(({ href, label, icon: Icon, match }) => {
              const active = match(pathname);
              return (
                <li key={href}>
                  <GuardedLink
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={navLinkClass(active)}
                  >
                    <Icon aria-hidden="true" className="size-6 shrink-0" />
                    <span>{label}</span>
                  </GuardedLink>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ShellFrame>{children}</ShellFrame>
    </SessionProvider>
  );
}

function ShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const firstPath = useRef(true);

  // After a route change (not the first load) move focus to the new page's h1, waiting for it
  // to render if the page shows a loading state first.
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    const main = document.getElementById('main');
    if (!main) return;
    const focusHeading = (): boolean => {
      const heading = main.querySelector<HTMLElement>('h1');
      if (!heading) return false;
      heading.setAttribute('tabindex', '-1');
      heading.focus();
      return true;
    };
    if (focusHeading()) return;
    const observer = new MutationObserver(() => {
      if (focusHeading()) observer.disconnect();
    });
    observer.observe(main, { childList: true, subtree: true });
    const timer = setTimeout(() => {
      observer.disconnect();
    }, 3000);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [pathname]);
  return (
    <UnsavedGuardProvider>
      <div className="min-h-dvh">
        <div
          data-app-nav
          className="ff-safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-ff-border bg-ff-surface md:inset-y-0 md:right-auto md:flex md:w-24 md:flex-col md:border-t-0 md:border-r lg:w-66"
        >
          <div className="hidden px-2 pt-4 md:block lg:px-5">
            <GuardedLink
              href="/"
              aria-label="FunFriday home"
              className="flex min-h-11 items-center justify-center gap-3 rounded-ff-button lg:justify-start"
            >
              <LogoMark className="h-7 w-10 shrink-0" />
              <span className="hidden font-heading text-xl font-extrabold tracking-tight text-ff-ink lg:inline">
                FunFriday
              </span>
            </GuardedLink>
          </div>

          {/* Quick-create: full button in the sidebar, 56px icon button on the rail, the Plan tab on mobile. */}
          <div className="hidden px-4 pt-4 lg:block">
            <GuardedLink href="/app/events/new" className={buttonStyles({ fullWidth: true })}>
              Plan a FunFriday
            </GuardedLink>
          </div>
          <div className="hidden justify-center px-2 pt-4 md:flex lg:hidden">
            <GuardedLink
              href="/app/events/new"
              aria-label="Plan a FunFriday"
              className="ff-press ff-filled flex min-h-14 w-full flex-col items-center justify-center rounded-ff-button bg-ff-violet-700 text-xs font-semibold text-white hover:bg-ff-violet-800"
            >
              <CalendarPlus aria-hidden="true" className="size-6" />
              <span aria-hidden="true">Plan</span>
            </GuardedLink>
          </div>

          <div className="md:mt-4 md:flex md:min-h-0 md:flex-1 md:flex-col">
            <PrimaryNav pathname={pathname} />
          </div>

          <div className="hidden border-t border-ff-border p-2 md:block lg:p-4">
            <UserMenu placement="sidebar" />
          </div>
        </div>

        <main
          id="main"
          tabIndex={-1}
          className="px-4 pt-6 pb-[88px] md:pl-[calc(6rem+1.5rem)] md:pr-6 md:pb-12 lg:pl-[calc(16.5rem+2rem)] lg:pr-8"
        >
          <div className="mb-4 flex items-center justify-between md:hidden">
            <GuardedLink
              href="/app"
              aria-label="FunFriday home"
              className="flex min-h-11 items-center gap-2 rounded-ff-button"
            >
              <LogoMark className="h-7 w-10 shrink-0" />
              <span className="font-heading text-lg font-extrabold tracking-tight text-ff-ink">
                FunFriday
              </span>
            </GuardedLink>
            <UserMenu placement="top" />
          </div>
          <div key={pathname} className="ff-route mx-auto w-full max-w-6xl">
            <SessionGate>{children}</SessionGate>
          </div>
        </main>
      </div>
    </UnsavedGuardProvider>
  );
}
