'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiResult } from '@/lib/identity-api';

interface Settled<T> {
  base: string;
  version: number;
  result: ApiResult<T>;
}

export interface ApiResource<T> {
  /** null until the first answer for the current `key`. */
  result: ApiResult<T> | null;
  loading: boolean;
  /** True while a reload is in flight; the previous answer stays on screen. */
  refreshing: boolean;
  reload: () => void;
}

/**
 * Loads server data once per `key` (for example the organisation id) and on `reload()`.
 * Results are server truth; screens derive everything from them rather than copying into state.
 */
export function useApi<T>(
  fetcher: (signal: AbortSignal) => Promise<ApiResult<T>>,
  key: string,
): ApiResource<T> {
  const [version, setVersion] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const latest = useRef(fetcher);
  useEffect(() => {
    latest.current = fetcher;
  });

  useEffect(() => {
    const controller = new AbortController();
    void latest.current(controller.signal).then((result) => {
      if (!controller.signal.aborted) setSettled({ base: key, version, result });
    });
    return () => {
      controller.abort();
    };
  }, [key, version]);

  const reload = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);
  const current = settled?.base === key ? settled : null;
  return {
    result: current?.result ?? null,
    loading: current === null,
    refreshing: current !== null && current.version !== version,
    reload,
  };
}
