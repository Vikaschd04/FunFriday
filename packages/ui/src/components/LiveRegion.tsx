'use client';

import {
  type ReactNode,
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from './cn.js';

/** Visually hidden polite status region. Update `message` to announce it. */
export function LiveRegion({ message, className }: { message: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className={cn('sr-only', className)}>
      {message}
    </div>
  );
}

export type AnnounceTone = 'neutral' | 'success' | 'danger';

export type Announce = (message: string, options?: { tone?: AnnounceTone }) => void;

const AnnounceContext = createContext<Announce | null>(null);

/** Returns `announce(message)`; requires a LiveRegionProvider ancestor. */
export function useAnnounce(): Announce {
  const announce = use(AnnounceContext);
  if (!announce) throw new Error('useAnnounce must be used inside <LiveRegionProvider>');
  return announce;
}

const TOAST_MS = 5000;
const ZERO_WIDTH = String.fromCharCode(0x200b);

/**
 * Mount once at the app root. Owns ONE persistent polite `role="status"` region plus a
 * separate `role="alert"` region for errors, and an optional visual toast (aria-hidden,
 * never takes focus, auto-dismisses after 5s). Callers should also show the message inline.
 */
export function LiveRegionProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState('');
  const [alertText, setAlertText] = useState('');
  const [toast, setToast] = useState<{ text: string; tone: AnnounceTone } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const counter = useRef(0);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  const announce = useCallback<Announce>((message, options) => {
    const tone = options?.tone ?? 'neutral';
    // Repeating the same text must still be announced: append a zero-width toggle.
    counter.current += 1;
    const text = counter.current % 2 === 0 ? message : `${message}${ZERO_WIDTH}`;
    if (tone === 'danger') setAlertText(text);
    else setPolite(text);
    setToast({ text: message, tone });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setToast(null);
    }, TOAST_MS);
  }, []);

  const value = useMemo(() => announce, [announce]);

  return (
    <AnnounceContext value={value}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {polite}
      </div>
      <div role="alert" className="sr-only">
        {alertText}
      </div>
      {toast && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 bottom-20 z-60 flex justify-center px-4 md:bottom-6"
        >
          <p
            className={cn(
              'ff-toast rounded-full px-5 py-2.5 text-sm font-semibold shadow-ff-lg',
              toast.tone === 'danger' ? 'bg-ff-coral-700 text-white' : 'bg-ff-ink text-white',
            )}
          >
            {toast.text}
          </p>
        </div>
      )}
    </AnnounceContext>
  );
}
