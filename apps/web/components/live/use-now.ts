'use client';

import { useEffect, useState } from 'react';

/**
 * Local wall-clock reading that re-renders every `intervalMs` while `active`. It is purely
 * cosmetic: countdowns are recomputed from the server's absolute deadline on every render,
 * so a throttled background tab simply catches up on the next tick.
 */
export function useNow(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      clearInterval(timer);
    };
  }, [active, intervalMs]);
  return now;
}

/** True when the user asked for reduced motion (read once; the CSS also honours it live). */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
