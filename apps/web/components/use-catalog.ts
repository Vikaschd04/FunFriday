'use client';

import type { ActivitySummary } from '@funfriday/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchActivities, getApiBaseUrl } from '@/lib/api';

export type CatalogState =
  | { status: 'loading' }
  | { status: 'ready'; activities: ActivitySummary[] }
  | { status: 'error'; reason: 'unreachable' | 'invalid_response' };

/** Loads the real activity catalog from the API; `reload` retries after a failure. */
export function useCatalog(): { catalog: CatalogState; reload: () => void } {
  const [catalog, setCatalog] = useState<CatalogState>({ status: 'loading' });
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setCatalog({ status: 'loading' });
    const result = await fetchActivities(getApiBaseUrl(), { signal: controller.signal });
    if (controller.signal.aborted) return;
    setCatalog(
      result.kind === 'ok'
        ? { status: 'ready', activities: result.activities }
        : { status: 'error', reason: result.kind },
    );
  }, []);

  useEffect(() => {
    // Initial fetch on mount; unmount aborts the in-flight request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  const reload = useCallback(() => {
    void load();
  }, [load]);

  return { catalog, reload };
}
