'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { HostCommand, ThisOrThatChoice } from '@funfriday/contracts';
import { openLiveConnection, type ActionOutcome, type LiveConnection } from '@/lib/live/connection';
import { IntentIds, isRetryable } from '@/lib/live/intents';
import { initialLiveState, type LiveClientState } from '@/lib/live/state';
import { createLiveStore } from '@/lib/live/store';

export interface LiveRoomApi {
  state: LiveClientState;
  setReady: (ready: boolean) => Promise<ActionOutcome>;
  hostCommand: (command: HostCommand) => Promise<ActionOutcome>;
  answer: (roundId: string, choice: ThisOrThatChoice) => Promise<ActionOutcome>;
  retry: () => void;
}

/**
 * Owns the socket for one session. React state is the store's server mirror; every mutating
 * call is ack-driven (no optimistic host/ready state) and reuses its clientActionId when the
 * same intent is retried after a transient failure.
 */
export function useLiveRoom(sessionId: string): LiveRoomApi {
  const [store] = useState(createLiveStore);
  const state = useSyncExternalStore(store.subscribe, store.getState, () => initialLiveState);
  const connection = useRef<LiveConnection | null>(null);
  const intents = useRef(new IntentIds());

  useEffect(() => {
    const conn = openLiveConnection(sessionId, store);
    connection.current = conn;
    return () => {
      conn.close();
      connection.current = null;
    };
  }, [sessionId, store]);

  // Rate limited on join: the spec says retry after 3s.
  const rateLimited = state.join === 'failed' && state.failure === 'rate_limited';
  useEffect(() => {
    if (!rateLimited) return;
    const timer = setTimeout(() => {
      connection.current?.retry();
    }, 3000);
    return () => {
      clearTimeout(timer);
    };
  }, [rateLimited]);

  const run = useCallback(
    async (
      signature: string,
      call: (conn: LiveConnection, id: string) => Promise<ActionOutcome>,
    ): Promise<ActionOutcome> => {
      const conn = connection.current;
      if (!conn) return { ok: false, code: 'offline' };
      const outcome = await call(conn, intents.current.idFor(signature));
      if (outcome.ok || !isRetryable(outcome.code)) intents.current.settle(signature);
      return outcome;
    },
    [],
  );

  const setReady = useCallback(
    (ready: boolean) => run(`ready:${String(ready)}`, (c, id) => c.setReady(ready, id)),
    [run],
  );
  const hostCommand = useCallback(
    (command: HostCommand) =>
      run(`cmd:${JSON.stringify(command)}`, (c, id) => c.hostCommand(command, id)),
    [run],
  );
  const answer = useCallback(
    (roundId: string, choice: ThisOrThatChoice) =>
      run(`answer:${roundId}:${choice}`, (c, id) => c.answer(roundId, choice, id)),
    [run],
  );
  const retry = useCallback(() => {
    connection.current?.retry();
  }, []);

  return { state, setReady, hostCommand, answer, retry };
}
