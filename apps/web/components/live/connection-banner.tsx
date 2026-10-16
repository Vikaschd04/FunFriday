'use client';

import { CircleCheck, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@funfriday/ui';
import type { LinkState } from '@/lib/live/state';
import { AppLinkButton } from '../app-link-button';

type Shown = 'hidden' | 'reconnecting' | 'restored';

/**
 * Sticky connection banner for every live screen. It appears only after 1s of disconnect (no
 * flicker), says "Back in the room" for 2.5s once the server view has been replaced, and turns
 * into a real error with a retry after 20s.
 */
export function ConnectionBanner({
  link,
  inGame,
  onRetry,
}: {
  link: LinkState;
  inGame: boolean;
  onRetry: () => void;
}) {
  const [shown, setShown] = useState<Shown>('hidden');
  const shownRef = useRef<Shown>('hidden');

  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (link !== 'online') {
      if (shownRef.current === 'hidden' || shownRef.current === 'restored') {
        timers.push(
          setTimeout(() => {
            setShown('reconnecting');
          }, 1000),
        );
      }
    } else if (shownRef.current === 'reconnecting') {
      timers.push(
        setTimeout(() => {
          setShown('restored');
        }, 0),
        setTimeout(() => {
          setShown('hidden');
        }, 2500),
      );
    }
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [link]);

  let content: React.ReactNode = null;
  if (link === 'lost') {
    content = (
      <div className="flex flex-col items-start gap-3 border-b border-ff-coral-700 bg-ff-coral-50 px-4 py-3 text-ff-ink sm:flex-row sm:items-center">
        <p className="font-semibold">We can&apos;t reach the room.</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onRetry}>
            Try again
          </Button>
          <AppLinkButton size="sm" variant="secondary" href="/app">
            Back to dashboard
          </AppLinkButton>
        </div>
      </div>
    );
  } else if (shown === 'reconnecting' && link !== 'online') {
    content = (
      <div className="flex items-center gap-3 border-b border-ff-ink bg-ff-sun-50 px-4 py-3 font-semibold text-ff-ink">
        <RefreshCw aria-hidden="true" className="ff-spin size-5 shrink-0" />
        <p>
          {inGame ? 'Reconnecting... your answer is safe.' : "Reconnecting... we'll catch you up."}
        </p>
      </div>
    );
  } else if (shown === 'restored' && link === 'online') {
    content = (
      <div className="flex items-center gap-3 border-b border-ff-mint-700 bg-ff-mint-50 px-4 py-3 font-semibold text-ff-ink">
        <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-ff-mint-700" />
        <p>Back in the room</p>
      </div>
    );
  }
  // The status container is always in the DOM (empty until needed) so assistive tech announces
  // its content change. It sits in the page flow at the top and is sticky, with the page's
  // scroll-padding-top keeping focused controls from sliding underneath it.
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="connection-status"
      className="sticky top-0 z-30 -mx-4 md:-mx-6 lg:-mx-8"
    >
      {content && <div className="ff-banner">{content}</div>}
    </div>
  );
}
