import { io, type Socket } from 'socket.io-client';
import {
  LIVE_NAMESPACE,
  LiveEvent,
  actionAckSchema,
  joinAckSchema,
  roomStateSchema,
  type ActionAck,
  type HostCommand,
  type ThisOrThatChoice,
} from '@funfriday/contracts';
import { getApiBaseUrl } from '../api';
import { failureFromCode } from './state';
import type { LiveStore } from './store';

export const ACK_TIMEOUT_MS = 5000;
/** How long a mutating action waits for the broadcast that carries its revision. */
export const CATCH_UP_MS = 2500;
export const LOST_AFTER_MS = 20_000;

export type ActionOutcome = { ok: true } | { ok: false; code: string };

export function liveOrigin(): string {
  return new URL(getApiBaseUrl()).origin;
}

export interface LiveConnection {
  setReady: (ready: boolean, clientActionId: string) => Promise<ActionOutcome>;
  hostCommand: (command: HostCommand, clientActionId: string) => Promise<ActionOutcome>;
  answer: (
    roundId: string,
    choice: ThisOrThatChoice,
    clientActionId: string,
  ) => Promise<ActionOutcome>;
  /** Asks the server for the full view again (join ack is the authoritative answer). */
  resync: () => void;
  /** Manual retry after the connection was declared lost or the join failed. */
  retry: () => void;
  close: () => void;
}

type AckResult =
  | { kind: 'ack'; ack: ActionAck }
  | { kind: 'failed'; code: 'timeout' | 'offline' | 'invalid_response' };

/**
 * One Socket.IO connection to the /live namespace for one session. Everything it receives is
 * parsed with the shared contract schemas; the store only ever sees validated server state.
 * Authority stays on the server: this class forwards intents and reports what came back.
 */
export function openLiveConnection(sessionId: string, store: LiveStore): LiveConnection {
  const socket: Socket = io(`${liveOrigin()}${LIVE_NAMESPACE}`, {
    withCredentials: true,
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  });

  let closed = false;
  let lostTimer: ReturnType<typeof setTimeout> | undefined;
  let joinRetry: ReturnType<typeof setTimeout> | undefined;
  let joinAttempts = 0;

  const clearTimers = () => {
    clearTimeout(lostTimer);
    clearTimeout(joinRetry);
    lostTimer = undefined;
    joinRetry = undefined;
  };

  const startLostTimer = () => {
    if (lostTimer) return;
    lostTimer = setTimeout(() => {
      lostTimer = undefined;
      if (!closed && !socket.connected) store.dispatch({ type: 'link', link: 'lost' });
    }, LOST_AFTER_MS);
  };

  const markReconnecting = () => {
    if (closed) return;
    store.dispatch({ type: 'link', link: 'reconnecting' });
    startLostTimer();
  };

  /** join and resync share one ack shape; the answer replaces whatever we hold. */
  const joinLike = (event: typeof LiveEvent.join | typeof LiveEvent.resync) => {
    if (closed || !socket.connected) return;
    socket.timeout(ACK_TIMEOUT_MS).emit(event, { sessionId }, (err: unknown, raw: unknown) => {
      if (closed) return;
      if (err) {
        // No ack in time: retry once, then surface a real error.
        joinAttempts += 1;
        if (joinAttempts >= 2) {
          store.dispatch({ type: 'join_failed', failure: 'service' });
          return;
        }
        // One automatic retry of the same join; the UI keeps showing "Joining..." meanwhile.
        joinLike(event);
        return;
      }
      const parsed = joinAckSchema.safeParse(raw);
      if (!parsed.success) {
        store.dispatch({ type: 'join_failed', failure: 'service' });
        return;
      }
      joinAttempts = 0;
      clearTimeout(lostTimer);
      lostTimer = undefined;
      if (parsed.data.status === 'joined') {
        store.dispatch({
          type: 'room_state',
          state: parsed.data.state,
          receivedAt: Date.now(),
        });
      } else {
        store.dispatch({ type: 'join_failed', failure: failureFromCode(parsed.data.code) });
      }
    });
  };

  socket.on('connect', () => {
    joinAttempts = 0;
    joinLike(LiveEvent.join);
  });

  socket.on(LiveEvent.state, (raw: unknown) => {
    const parsed = roomStateSchema.safeParse(raw);
    if (!parsed.success) {
      // A malformed push is never applied; ask the server for the real view instead.
      joinLike(LiveEvent.resync);
      return;
    }
    store.dispatch({ type: 'room_state', state: parsed.data, receivedAt: Date.now() });
  });

  socket.on('disconnect', (reason) => {
    if (closed || reason === 'io client disconnect') return;
    markReconnecting();
    // The server closed us (restart, kick): Socket.IO will not retry on its own.
    if (reason === 'io server disconnect') socket.connect();
  });

  socket.on('connect_error', (error: Error & { data?: { code?: string } }) => {
    if (closed) return;
    const code = error.data?.code;
    if (code === 'UNAUTHENTICATED' || code === 'FORBIDDEN') {
      store.dispatch({ type: 'join_failed', failure: failureFromCode(code) });
      return;
    }
    markReconnecting();
  });

  const onOffline = () => {
    markReconnecting();
  };
  const onOnline = () => {
    if (!socket.connected) socket.connect();
  };
  window.addEventListener('offline', onOffline);
  window.addEventListener('online', onOnline);

  const emitWithAck = (event: string, payload: Record<string, unknown>): Promise<AckResult> =>
    new Promise((resolve) => {
      if (!socket.connected) {
        resolve({ kind: 'failed', code: 'offline' });
        return;
      }
      socket.timeout(ACK_TIMEOUT_MS).emit(event, payload, (err: unknown, raw: unknown) => {
        if (err) {
          resolve({ kind: 'failed', code: 'timeout' });
          return;
        }
        const parsed = actionAckSchema.safeParse(raw);
        resolve(
          parsed.success
            ? { kind: 'ack', ack: parsed.data }
            : { kind: 'failed', code: 'invalid_response' },
        );
      });
    });

  /**
   * Accepted/duplicate only counts as done once our state has reached the ack's revision
   * (the broadcast may arrive before OR after the ack). If it never shows up, resync.
   */
  const settle = async (result: AckResult): Promise<ActionOutcome> => {
    if (result.kind === 'failed') return { ok: false, code: result.code };
    const { ack } = result;
    if (ack.status === 'rejected') {
      if (ack.code === 'OUT_OF_SYNC') joinLike(LiveEvent.resync);
      return { ok: false, code: ack.code ?? 'INTERNAL_ERROR' };
    }
    const caughtUp = await store.waitForRevision(ack.revision, CATCH_UP_MS);
    if (!caughtUp) joinLike(LiveEvent.resync);
    return { ok: true };
  };

  return {
    setReady: async (ready, clientActionId) =>
      settle(await emitWithAck(LiveEvent.ready, { sessionId, ready, clientActionId })),
    hostCommand: async (command, clientActionId) =>
      settle(await emitWithAck(LiveEvent.hostCommand, { sessionId, clientActionId, command })),
    answer: async (roundId, choice, clientActionId) =>
      settle(
        await emitWithAck(LiveEvent.gameAction, {
          sessionId,
          clientActionId,
          action: { type: 'answer', roundId, choice },
        }),
      ),
    resync: () => {
      joinLike(LiveEvent.resync);
    },
    retry: () => {
      store.dispatch({ type: 'rejoining' });
      store.dispatch({ type: 'link', link: 'reconnecting' });
      startLostTimer();
      joinAttempts = 0;
      if (socket.connected) joinLike(LiveEvent.join);
      else socket.connect();
    },
    close: () => {
      closed = true;
      clearTimers();
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}
