'use client';

import { useEffect } from 'react';
import { DeniedState, EmptyState, ErrorState, Skeleton } from '@funfriday/ui';
import type { ApiFailure } from '@/lib/identity-api';
import { AppLinkButton } from './app-link-button';
import { useSession } from './session-provider';

interface FailureStateProps {
  failure: ApiFailure;
  /** What was being loaded, for example "the member list". */
  what: string;
  onRetry: () => void;
  retrying?: boolean;
  deniedBody?: string;
}

/** One place that turns an API failure into the right screen state. */
export function FailureState({ failure, what, onRetry, retrying, deniedBody }: FailureStateProps) {
  const { expire } = useSession();
  const unauthenticated = failure.kind === 'unauthenticated';
  useEffect(() => {
    if (unauthenticated) expire();
  }, [unauthenticated, expire]);

  switch (failure.kind) {
    case 'unauthenticated':
      return <Skeleton variant="line" label="Your session ended. Taking you to sign in..." />;
    case 'forbidden':
      return (
        <DeniedState
          title="You don't have access to this"
          body={deniedBody ?? 'Ask an organisation Admin if you need access.'}
          action={
            <AppLinkButton href="/app" variant="secondary">
              Back to dashboard
            </AppLinkButton>
          }
        />
      );
    case 'not_found':
      return (
        <EmptyState
          title="We can't find that organisation"
          body="It may not exist, or you may not be a member of it."
          primaryAction={<AppLinkButton href="/app">Back to dashboard</AppLinkButton>}
        />
      );
    case 'rate_limited':
      return (
        <ErrorState
          title="Too many requests"
          body="Please wait a moment, then try again."
          onRetry={onRetry}
          retrying={retrying}
        />
      );
    case 'unreachable':
      return (
        <ErrorState
          title={`We can't load ${what}`}
          body="We can't reach FunFriday. Check your connection (you may be offline) and try again."
          onRetry={onRetry}
          retrying={retrying}
        />
      );
    default:
      return (
        <ErrorState
          title={`We can't load ${what}`}
          body="Something went wrong on our side. Try again in a moment."
          onRetry={onRetry}
          retrying={retrying}
        />
      );
  }
}

/** Short inline copy for a failed action (add, remove, rename...). */
export function actionFailureText(failure: ApiFailure, fallback: string): string {
  switch (failure.kind) {
    case 'forbidden':
      return "You don't have permission to do that.";
    case 'not_found':
      return 'That no longer exists. Refresh the page to see the latest.';
    case 'rate_limited':
      return 'Too many requests. Please wait a moment and try again.';
    case 'unreachable':
      return "We can't reach FunFriday. Check your connection and try again.";
    default:
      return fallback;
  }
}
