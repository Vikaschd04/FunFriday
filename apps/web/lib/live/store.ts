import { initialLiveState, liveReducer, type LiveAction, type LiveClientState } from './state';

type Listener = () => void;

/**
 * Tiny external store around the reducer so socket callbacks (outside React) can dispatch and
 * components can subscribe with useSyncExternalStore. Also lets an action wait until the
 * server's broadcast has caught up with the revision an ack promised.
 */
export interface LiveStore {
  getState: () => LiveClientState;
  dispatch: (action: LiveAction) => void;
  subscribe: (listener: Listener) => () => void;
  /** Resolves true once state.revision >= revision, false after `timeoutMs`. */
  waitForRevision: (revision: number, timeoutMs: number) => Promise<boolean>;
}

export function createLiveStore(): LiveStore {
  let state = initialLiveState;
  const listeners = new Set<Listener>();

  const getState = () => state;
  const dispatch = (action: LiveAction) => {
    const next = liveReducer(state, action);
    if (next === state) return;
    state = next;
    for (const listener of [...listeners]) listener();
  };
  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const waitForRevision = (revision: number, timeoutMs: number) =>
    new Promise<boolean>((resolve) => {
      if ((state.room?.revision ?? -1) >= revision) {
        resolve(true);
        return;
      }
      const timer = setTimeout(() => {
        off();
        resolve(false);
      }, timeoutMs);
      const off = subscribe(() => {
        if ((state.room?.revision ?? -1) >= revision) {
          clearTimeout(timer);
          off();
          resolve(true);
        }
      });
    });

  return { getState, dispatch, subscribe, waitForRevision };
}
