import type { RoomState, RoomView } from '@funfriday/contracts';

/**
 * Client-side mirror of what the server last told us. The room view is ALWAYS the server's:
 * this reducer only decides which server message wins (highest revision), derives clock skew,
 * and keeps cosmetic timing hints. It never invents or edits game state.
 */

export type JoinFailure = 'not_available' | 'full' | 'rate_limited' | 'unauthenticated' | 'service';

export type LinkState = 'online' | 'reconnecting' | 'lost';

export interface RoundTiming {
  roundId: string;
  /** Duration of the round as first seen (deadline minus serverNow); drives the cosmetic bar. */
  totalMs: number;
  /** Whole seconds left when the host resumed this round; null if it was never paused. */
  resumedAtSec: number | null;
}

export interface PresenceChange {
  /** Increments on every connect/disconnect change so effects can react to each one. */
  seq: number;
  joined: string[];
  left: string[];
}

export interface LiveClientState {
  join: 'joining' | 'joined' | 'failed';
  failure: JoinFailure | null;
  link: LinkState;
  room: RoomState | null;
  /** Server clock minus local clock (ms) at the moment the latest accepted state arrived. */
  skew: number;
  /** After a disconnect the next server state replaces ours whatever its revision. */
  replaceNext: boolean;
  roundTiming: RoundTiming | null;
  presence: PresenceChange | null;
  /** Increments whenever the host adds time to the current round (derived from the views). */
  extendedSeq: number;
}

export type LiveAction =
  | { type: 'room_state'; state: RoomState; receivedAt: number }
  | { type: 'join_failed'; failure: JoinFailure }
  | { type: 'link'; link: LinkState }
  | { type: 'rejoining' };

export const initialLiveState: LiveClientState = {
  join: 'joining',
  failure: null,
  link: 'online',
  room: null,
  skew: 0,
  replaceNext: false,
  roundTiming: null,
  presence: null,
  extendedSeq: 0,
};

export function failureFromCode(code: string): JoinFailure {
  switch (code) {
    case 'ROOM_NOT_FOUND':
    case 'FORBIDDEN':
    case 'TENANT_MISMATCH':
    case 'NOT_FOUND':
      return 'not_available';
    case 'ROOM_FULL':
      return 'full';
    case 'RATE_LIMITED':
      return 'rate_limited';
    case 'UNAUTHENTICATED':
      return 'unauthenticated';
    default:
      return 'service';
  }
}

export function skewFrom(serverNow: number, receivedAt: number): number {
  return serverNow - receivedAt;
}

function nameOf(name: string | null): string {
  return name?.trim() ? name.trim() : 'Teammate';
}

/** Who appeared / disappeared between two views (never includes the viewer). */
export function diffPresence(
  previous: RoomView,
  next: RoomView,
): { joined: string[]; left: string[] } {
  const before = new Map(previous.participants.map((p) => [p.memberId, p]));
  const joined: string[] = [];
  const left: string[] = [];
  for (const p of next.participants) {
    if (p.memberId === next.me.memberId) continue;
    const was = before.get(p.memberId);
    if (p.connected && !was?.connected) joined.push(nameOf(p.name));
    if (!p.connected && was?.connected) left.push(nameOf(p.name));
  }
  return { joined, left };
}

function nextTiming(previous: LiveClientState, incoming: RoomState): RoundTiming | null {
  const game = incoming.view.game;
  const round = game?.round ?? null;
  if (!game || !round) return previous.roundTiming;
  const before = previous.roundTiming;
  if (before?.roundId !== round.id) {
    const total =
      round.deadlineAt !== null
        ? Math.max(0, round.deadlineAt - incoming.serverNow)
        : (round.remainingMs ?? 0);
    return { roundId: round.id, totalMs: total, resumedAtSec: null };
  }
  const wasPaused = previous.room?.view.game?.paused === true;
  if (wasPaused && !game.paused && round.deadlineAt !== null) {
    return {
      ...before,
      resumedAtSec: Math.max(0, Math.ceil((round.deadlineAt - incoming.serverNow) / 1000)),
    };
  }
  return before;
}

/** True when the new view carries more time for the SAME round than the previous one did. */
export function wasExtended(previous: RoomView | null, next: RoomView): boolean {
  const before = previous?.game;
  const after = next.game;
  const b = before?.round;
  const a = after?.round;
  if (!before || !after || !a || b?.id !== a.id) return false;
  if (after.phase !== 'question') return false;
  // An expired round reopened by the host.
  if (before.phase === 'reveal') return true;
  // Pause -> resume shifts the deadline by the paused time; that is not an extension.
  if (before.paused && !after.paused) return false;
  if (!before.paused && !after.paused && b.deadlineAt !== null && a.deadlineAt !== null) {
    return a.deadlineAt - b.deadlineAt >= 5000;
  }
  if (before.paused && after.paused) return (a.remainingMs ?? 0) - (b.remainingMs ?? 0) >= 5000;
  return false;
}

export function liveReducer(state: LiveClientState, action: LiveAction): LiveClientState {
  switch (action.type) {
    case 'room_state': {
      const incoming = action.state;
      // A broadcast can overtake the ack that "caused" it, and acks can arrive late: the
      // highest revision wins, always. Stale or equal messages change nothing.
      if (state.room && !state.replaceNext && incoming.revision <= state.room.revision) {
        return state;
      }
      let presence = state.presence;
      if (state.room && !state.replaceNext) {
        const diff = diffPresence(state.room.view, incoming.view);
        if (diff.joined.length > 0 || diff.left.length > 0) {
          presence = { seq: (state.presence?.seq ?? 0) + 1, ...diff };
        }
      }
      return {
        ...state,
        join: 'joined',
        failure: null,
        link: 'online',
        room: incoming,
        skew: skewFrom(incoming.serverNow, action.receivedAt),
        replaceNext: false,
        roundTiming: nextTiming(state, incoming),
        presence,
        extendedSeq:
          state.extendedSeq +
          (state.room && !state.replaceNext && wasExtended(state.room.view, incoming.view) ? 1 : 0),
      };
    }
    case 'join_failed':
      // An ended session is sticky: re-joining it is rejected, but the ended screen stays.
      if (state.room?.view.status === 'ended') return state;
      return { ...state, join: 'failed', failure: action.failure };
    case 'link': {
      if (state.link === action.link) return state;
      return {
        ...state,
        link: action.link,
        replaceNext: action.link === 'online' ? state.replaceNext : true,
      };
    }
    case 'rejoining':
      return { ...state, join: state.room ? state.join : 'joining', failure: null };
  }
}

/** Latest revision we hold (-1 before the first state). */
export function currentRevision(state: LiveClientState): number {
  return state.room?.revision ?? -1;
}
