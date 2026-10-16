import { describe, expect, it } from 'vitest';
import type { RoomView } from '@funfriday/contracts';
import { makeState, makeView, uuid } from './fixtures';
import {
  diffPresence,
  failureFromCode,
  initialLiveState,
  liveReducer,
  type LiveClientState,
} from './state';
import { createLiveStore } from './store';

const receive = (
  s: LiveClientState,
  rev: number,
  at = 1_000_100,
  now = 1_000_000,
  view?: RoomView,
) => liveReducer(s, { type: 'room_state', state: makeState(rev, now, view), receivedAt: at });

function questionView(deadlineAt: number | null, paused = false, id = 'r1'): RoomView {
  return makeView({
    status: 'live',
    game: {
      slug: 'this-or-that',
      phase: 'question',
      paused,
      round: {
        id,
        number: 1,
        total: 3,
        question: 'Q',
        optionA: 'A',
        optionB: 'B',
        deadlineAt,
        remainingMs: paused ? 12_000 : null,
      },
      myChoice: null,
      answeredCount: 0,
      eligibleCount: 2,
      allowAnswerChange: false,
      reveal: null,
      summary: null,
    },
  });
}

describe('liveReducer revisions', () => {
  it('keeps the highest revision when a broadcast overtakes its ack', () => {
    let s = receive(initialLiveState, 5);
    s = receive(s, 7); // broadcast first
    const after = receive(s, 6); // late ack carrying older state
    expect(after.room?.revision).toBe(7);
    expect(after).toBe(s);
  });

  it('ignores equal revisions and accepts newer ones', () => {
    const s = receive(initialLiveState, 3);
    expect(receive(s, 3)).toBe(s);
    expect(receive(s, 4).room?.revision).toBe(4);
  });

  it('marks joined and clears failures on the first state', () => {
    const failed = liveReducer(initialLiveState, { type: 'join_failed', failure: 'service' });
    expect(failed.join).toBe('failed');
    const ok = receive(failed, 1);
    expect(ok.join).toBe('joined');
    expect(ok.failure).toBeNull();
  });

  it('replaces local state with the next server state after a disconnect, even if lower', () => {
    let s = receive(initialLiveState, 9);
    s = liveReducer(s, { type: 'link', link: 'reconnecting' });
    expect(s.link).toBe('reconnecting');
    s = receive(s, 2);
    expect(s.room?.revision).toBe(2);
    expect(s.link).toBe('online');
    expect(receive(s, 1)).toBe(s);
  });

  it('keeps the ended screen when a re-join is rejected', () => {
    const ended = receive(initialLiveState, 4, 1, 1, makeView({ status: 'ended' }));
    expect(liveReducer(ended, { type: 'join_failed', failure: 'not_available' })).toBe(ended);
  });

  it('derives skew from serverNow minus receipt time', () => {
    const s = receive(initialLiveState, 1, 2_000, 5_000);
    expect(s.skew).toBe(3_000);
  });
});

describe('round timing', () => {
  it('records the round length and the seconds left on resume', () => {
    let s = receive(initialLiveState, 1, 1, 10_000, questionView(40_000));
    expect(s.roundTiming).toEqual({ roundId: 'r1', totalMs: 30_000, resumedAtSec: null });
    s = receive(s, 2, 1, 15_000, questionView(null, true));
    expect(s.roundTiming?.resumedAtSec).toBeNull();
    s = receive(s, 3, 1, 20_000, questionView(32_000));
    expect(s.roundTiming?.resumedAtSec).toBe(12);
    expect(s.roundTiming?.totalMs).toBe(30_000);
  });

  it('resets for a new round id', () => {
    let s = receive(initialLiveState, 1, 1, 10_000, questionView(40_000));
    s = receive(s, 2, 1, 50_000, questionView(80_000, false, 'r2'));
    expect(s.roundTiming).toEqual({ roundId: 'r2', totalMs: 30_000, resumedAtSec: null });
  });
});

describe('presence', () => {
  it('reports who joined and left, never the viewer', () => {
    const before = makeView();
    const after = makeView({
      participants: [
        { memberId: uuid(10), name: 'Me', connected: false, ready: false, isHost: false },
        { memberId: uuid(11), name: 'Host', connected: false, ready: false, isHost: true },
        { memberId: uuid(12), name: null, connected: true, ready: false, isHost: false },
      ],
    });
    expect(diffPresence(before, after)).toEqual({ joined: ['Teammate'], left: ['Host'] });
  });

  it('bumps the sequence only when someone connected or left', () => {
    let s = receive(initialLiveState, 1);
    s = receive(s, 2);
    expect(s.presence).toBeNull();
    s = receive(
      s,
      3,
      1,
      1,
      makeView({
        participants: [
          { memberId: uuid(10), name: 'Me', connected: true, ready: false, isHost: false },
          { memberId: uuid(11), name: 'Host', connected: false, ready: false, isHost: true },
        ],
      }),
    );
    expect(s.presence?.seq).toBe(1);
    expect(s.presence?.left).toEqual(['Host']);
  });
});

describe('failureFromCode', () => {
  it('maps without leaking existence', () => {
    expect(failureFromCode('ROOM_NOT_FOUND')).toBe('not_available');
    expect(failureFromCode('FORBIDDEN')).toBe('not_available');
    expect(failureFromCode('TENANT_MISMATCH')).toBe('not_available');
    expect(failureFromCode('ROOM_FULL')).toBe('full');
    expect(failureFromCode('RATE_LIMITED')).toBe('rate_limited');
    expect(failureFromCode('UNAUTHENTICATED')).toBe('unauthenticated');
    expect(failureFromCode('SERVICE_UNAVAILABLE')).toBe('service');
  });
});

describe('store.waitForRevision', () => {
  it('resolves when the broadcast catches up, or times out', async () => {
    const store = createLiveStore();
    store.dispatch({ type: 'room_state', state: makeState(1), receivedAt: 1 });
    expect(await store.waitForRevision(1, 50)).toBe(true);
    const waiting = store.waitForRevision(2, 500);
    store.dispatch({ type: 'room_state', state: makeState(2), receivedAt: 1 });
    expect(await waiting).toBe(true);
    expect(await store.waitForRevision(9, 20)).toBe(false);
  });
});

describe('extension detection', () => {
  it('counts an extended deadline but not pause/resume', () => {
    let s = receive(initialLiveState, 1, 1, 10_000, questionView(40_000));
    s = receive(s, 2, 1, 12_000, questionView(55_000));
    expect(s.extendedSeq).toBe(1);
    s = receive(s, 3, 1, 13_000, questionView(null, true));
    s = receive(s, 4, 1, 20_000, questionView(70_000));
    expect(s.extendedSeq).toBe(1);
  });
});
