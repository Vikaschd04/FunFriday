'use client';

import { useEffect } from 'react';
import { DeniedState, EmptyState, ErrorState, Skeleton } from '@funfriday/ui';
import type { JoinFailure } from '@/lib/live/state';
import { AppLinkButton } from '../app-link-button';
import { useSession } from '../session-provider';

export function JoiningSkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 pt-4">
      <Skeleton variant="line" label="Joining the room..." />
      <Skeleton variant="block" />
      <Skeleton variant="line" count={3} />
    </div>
  );
}

export function NotAvailable() {
  return (
    <div className="mx-auto max-w-xl pt-8">
      <DeniedState
        headingLevel={1}
        title="This session isn't available"
        body="It may have ended, or the code may be wrong. Check with your host."
        action={
          <div className="flex flex-wrap gap-3">
            <AppLinkButton href="/app">Back to dashboard</AppLinkButton>
            <AppLinkButton href="/app" variant="secondary">
              Join with a code
            </AppLinkButton>
          </div>
        }
      />
    </div>
  );
}

function Unauthenticated() {
  const { expire } = useSession();
  useEffect(() => {
    expire();
  }, [expire]);
  return <Skeleton variant="line" label="Your sign-in expired. Taking you to sign in..." />;
}

export function JoinFailureScreen({
  failure,
  onRetry,
}: {
  failure: JoinFailure;
  onRetry: () => void;
}) {
  switch (failure) {
    case 'not_available':
      return <NotAvailable />;
    case 'unauthenticated':
      return <Unauthenticated />;
    case 'full':
      return (
        <div className="mx-auto max-w-xl pt-8">
          <DeniedState
            headingLevel={1}
            title="This room is full"
            body="Ask your host if there's space, then try again."
            action={<RetryButton onRetry={onRetry} />}
          />
        </div>
      );
    case 'rate_limited':
      return (
        <div className="mx-auto max-w-xl pt-8">
          <ErrorState
            headingLevel={1}
            announce="alert"
            title="Too many requests"
            body="Wait a moment and try again. We'll retry for you."
            onRetry={onRetry}
          />
        </div>
      );
    case 'service':
      return (
        <div className="mx-auto max-w-xl pt-8">
          <ErrorState
            headingLevel={1}
            announce="alert"
            title="We couldn't open the room"
            body="Check your connection and try again."
            onRetry={onRetry}
          />
        </div>
      );
  }
}

function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex min-h-11 items-center rounded-ff-button bg-ff-violet-700 px-5 font-semibold text-white hover:bg-ff-violet-800"
    >
      Try again
    </button>
  );
}

export function EndedScreen({
  hasSummary,
  onSeeSummary,
}: {
  hasSummary: boolean;
  onSeeSummary: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl pt-8">
      <p role="status" className="sr-only">
        The host ended the session
      </p>
      <EmptyState
        headingLevel={1}
        title="This session has ended"
        body="Thanks for playing. Hosts can start a new one anytime."
        primaryAction={<AppLinkButton href="/app">Back to dashboard</AppLinkButton>}
        secondaryAction={
          hasSummary ? (
            <button
              type="button"
              onClick={onSeeSummary}
              className="inline-flex min-h-11 items-center rounded-ff-button border border-ff-border-strong bg-ff-surface px-5 font-semibold text-ff-ink hover:bg-ff-violet-50"
            >
              See the summary
            </button>
          ) : undefined
        }
      />
    </div>
  );
}
