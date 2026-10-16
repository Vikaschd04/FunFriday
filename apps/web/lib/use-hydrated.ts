import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/**
 * False during server rendering and hydration, true once React has attached on the client.
 * Use it to keep native behaviour (e.g. form submission) inert until JavaScript handlers exist.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
