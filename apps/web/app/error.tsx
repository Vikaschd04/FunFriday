'use client';

import { useEffect } from 'react';
import { ErrorState } from '@funfriday/ui';
import { AppLinkButton } from '@/components/app-link-button';

export default function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Surface for developers; nothing is shown to the user beyond the friendly copy.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <main id="main" tabIndex={-1}>
        <title>Something went wrong - FunFriday</title>
        <ErrorState
          headingLevel={1}
          announce="alert"
          title="Something went wrong"
          body="That didn't work on our side. Your saved drafts are safe on this device."
          onRetry={reset}
          retryLabel="Try again"
        />
        <div className="mt-4">
          <AppLinkButton href="/app" variant="secondary">
            Go to dashboard
          </AppLinkButton>
        </div>
      </main>
    </div>
  );
}
