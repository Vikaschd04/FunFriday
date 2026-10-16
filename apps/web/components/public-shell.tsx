import Link from 'next/link';
import type { ReactNode } from 'react';
import { LogoMark } from './brand-art';
import { AppLinkButton } from './app-link-button';

export function PublicHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 py-4 sm:px-4 md:px-6 lg:px-8">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-2 rounded-ff-button md:gap-3"
        aria-label="FunFriday home"
      >
        <LogoMark className="h-7 w-10 shrink-0 md:h-8 md:w-12" />
        <span className="font-heading text-lg font-extrabold tracking-tight whitespace-nowrap text-ff-ink md:text-xl">
          FunFriday
        </span>
      </Link>
      <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
        <Link
          href="/app/library"
          className="hidden min-h-11 items-center rounded-ff-button px-3 font-semibold text-ff-violet-700 hover:bg-ff-violet-50 sm:inline-flex"
        >
          Activities
        </Link>
        <Link
          href="/sign-in"
          className="inline-flex min-h-11 items-center rounded-ff-button px-2 text-sm font-semibold whitespace-nowrap text-ff-violet-700 hover:bg-ff-violet-50 sm:px-3 sm:text-base"
        >
          Sign in
        </Link>
        <AppLinkButton
          href="/app/events/new"
          size="md"
          className="px-3! text-sm! whitespace-nowrap sm:px-5! sm:text-base!"
        >
          <span aria-hidden="true" className="sm:hidden">
            Plan
          </span>
          <span className="sr-only sm:not-sr-only">Plan a FunFriday</span>
        </AppLinkButton>
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-ff-border bg-ff-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 md:grid-cols-3 md:px-6 lg:px-8">
        <div>
          <p className="font-heading text-lg font-extrabold text-ff-ink">FunFriday</p>
          <p className="mt-2 max-w-xs text-sm text-ff-muted">
            Short, inclusive team activities. Good teams work together. Great teams connect.
          </p>
        </div>
        <nav aria-label="Product">
          <p className="font-semibold text-ff-ink">Product</p>
          <ul className="mt-2 flex flex-col">
            <li>
              <Link
                href="/app/library"
                className="inline-flex min-h-11 items-center text-ff-violet-700 underline underline-offset-4"
              >
                Activities
              </Link>
            </li>
            <li>
              <Link
                href="/app/events/new"
                className="inline-flex min-h-11 items-center text-ff-violet-700 underline underline-offset-4"
              >
                Plan a FunFriday
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Help">
          <p className="font-semibold text-ff-ink">Help</p>
          <ul className="mt-2 flex flex-col">
            <li>
              <Link
                href="/status"
                className="inline-flex min-h-11 items-center text-ff-violet-700 underline underline-offset-4"
              >
                System status
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <p className="border-t border-ff-border px-4 py-4 text-center text-sm text-ff-muted">
        Preview build. All sample content is fictional.
      </p>
    </footer>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6 lg:px-8">
        {children}
      </main>
      <PublicFooter />
    </>
  );
}
