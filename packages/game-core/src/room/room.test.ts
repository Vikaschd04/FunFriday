import { type HostCommand, roomViewSchema, thisOrThatConfigSchema } from '@funfriday/contracts';
import { describe, expect, it } from 'vitest';
import {
  type RoomContext,
  type RoomSnapshot,
  createRoom,
  nextRoomDeadline,
  reduceRoom,
  roomView,
} from './room.js';

const T0 = 1_760_000_000_000;
const ids = {
  host: '00000000-0000-4000-8000-000000000001',
  ana: '00000000-0000-4000-8000-000000000002',
  ben: '00000000-0000-4000-8000-000000000003',
};
const ctx = (now = T0): RoomContext => ({ now, seed: () => 99 });
let actionCounter = 0;
const actionId = () => `00000000-0000-4000-9000-${String(++actionCounter).padStart(12, '0')}`;

function room(): RoomSnapshot {
  return createRoom({
    sessionId: '11111111-1111-4111-8111-111111111111',
    organizationId: '22222222-2222-4222-8222-222222222222',
    title: 'Fictional Friday',
    roomCode: 'ABC234',
  });
}
function join(s: RoomSnapshot, memberId: string, isHost = false) {
  return reduceRoom(
    s,
    { type: 'join', memberId, name: memberId === ids.host ? 'Host' : 'Player', isHost },
    ctx(),
  ).snapshot;
}
function host(
  s: RoomSnapshot,
  command: HostCommand,
  now = T0,
  by = ids.host,
  clientActionId = actionId(),
) {
  return reduceRoom(s, { type: 'host', memberId: by, clientActionId, command }, ctx(now));
}
const startCmd: HostCommand = {
  type: 'start_game',
  game: 'this-or-that',
  config: thisOrThatConfigSchema.parse({ rounds: 3, allowAnswerChange: false }),
};

function liveRoom() {
  let s = join(join(join(room(), ids.host, true), ids.ana), ids.ben);
  s = host(s, startCmd).snapshot;
  return s;
}
const roundId = (s: RoomSnapshot) => s.game!.state.rounds[s.game!.state.roundIndex]!.id;
const vote = (
  s: RoomSnapshot,
  memberId: string,
  choice: 'A' | 'B' | 'pass',
  clientActionId = actionId(),
  now = T0 + 1_000,
) =>
  reduceRoom(
    s,
    {
      type: 'game',
      memberId,
      clientActionId,
      action: { type: 'answer', roundId: roundId(s), choice },
    },
    ctx(now),
  );

describe('room lifecycle', () => {
  it('joins members, bumps the revision, and treats a second tab as a no-op', () => {
    const s1 = join(room(), ids.ana);
    expect(s1.revision).toBe(1);
    expect(
      reduceRoom(s1, { type: 'join', memberId: ids.ana, name: 'Player', isHost: false }, ctx())
        .outcome,
    ).toBe('noop');
  });

  it('reconnecting keeps the seat and the answer', () => {
    let s = vote(liveRoom(), ids.ana, 'B').snapshot;
    s = reduceRoom(s, { type: 'disconnect', memberId: ids.ana }, ctx()).snapshot;
    s = join(s, ids.ana);
    expect(roomView(s, ids.ana, T0).game?.myChoice).toBe('B');
  });

  it('only hosts can send host commands', () => {
    const s = join(join(room(), ids.host, true), ids.ana);
    expect(host(s, startCmd, T0, ids.ana)).toMatchObject({ outcome: 'rejected', code: 'NOT_HOST' });
    expect(host(s, startCmd).outcome).toBe('accepted');
  });

  it('starting a game goes live, resets ready flags and announces it', () => {
    let s = join(join(room(), ids.host, true), ids.ana);
    s = reduceRoom(
      s,
      { type: 'ready', memberId: ids.ana, ready: true, clientActionId: actionId() },
      ctx(),
    ).snapshot;
    const result = host(s, startCmd);
    expect(result.snapshot.status).toBe('live');
    expect(result.snapshot.members[ids.ana]!.ready).toBe(false);
    expect(result.effects).toEqual([{ type: 'game_started', slug: 'this-or-that' }]);
    expect(host(result.snapshot, startCmd).code).toBe('INVALID_ACTION');
  });
});

describe('idempotency and ordering', () => {
  it('a repeated clientActionId is a duplicate and changes nothing', () => {
    const s = liveRoom();
    const id = actionId();
    const first = vote(s, ids.ana, 'A', id);
    const again = vote(first.snapshot, ids.ana, 'A', id);
    expect(again.outcome).toBe('duplicate');
    expect(again.snapshot.revision).toBe(first.snapshot.revision);
  });

  it('with the default config people can change their answer until time is up', () => {
    let s = join(join(room(), ids.host, true), ids.ana);
    s = host(s, {
      type: 'start_game',
      game: 'this-or-that',
      config: thisOrThatConfigSchema.parse({ rounds: 3 }),
    }).snapshot;
    s = vote(s, ids.ana, 'A').snapshot;
    expect(vote(s, ids.ana, 'B').outcome).toBe('accepted');
  });

  it('a different action for an already-answered round is rejected', () => {
    const s = vote(liveRoom(), ids.ana, 'A').snapshot;
    expect(vote(s, ids.ana, 'B')).toMatchObject({ outcome: 'rejected', code: 'DUPLICATE_ACTION' });
  });

  it('20 people answering once each are counted exactly once', () => {
    let s = join(room(), ids.host, true);
    const crowd = Array.from(
      { length: 20 },
      (_, i) => `00000000-0000-4000-a000-${String(i).padStart(12, '0')}`,
    );
    for (const id of crowd) s = join(s, id);
    s = host(s, startCmd).snapshot;
    for (const [i, id] of crowd.entries())
      s = vote(s, id, i % 3 === 0 ? 'pass' : i % 2 === 0 ? 'A' : 'B').snapshot;
    s = host(s, { type: 'close_round' }, T0 + 2_000).snapshot;
    const reveal = roomView(s, ids.host, T0).game?.reveal;
    expect(reveal).toEqual({ a: 6, b: 7, pass: 7 });
    expect(reveal!.a + reveal!.b + reveal!.pass).toBe(20);
  });
});

describe('time, finishing and ending', () => {
  it('schedules the next deadline and closes the round on tick', () => {
    const s = liveRoom();
    expect(nextRoomDeadline(s)).toBe(T0 + 30_000);
    expect(reduceRoom(s, { type: 'tick' }, ctx(T0 + 10)).outcome).toBe('noop');
    const closed = reduceRoom(s, { type: 'tick' }, ctx(T0 + 30_000));
    expect(closed.outcome).toBe('accepted');
    expect(nextRoomDeadline(closed.snapshot)).toBeNull();
  });

  it('disconnecting the last unanswered person reveals the round', () => {
    let s = vote(liveRoom(), ids.host, 'A').snapshot;
    s = vote(s, ids.ana, 'B').snapshot;
    s = reduceRoom(s, { type: 'disconnect', memberId: ids.ben }, ctx(T0 + 2_000)).snapshot;
    expect(roomView(s, ids.ana, T0).game?.phase).toBe('reveal');
  });

  it('ending the game emits one aggregate summary; ending the session closes the room', () => {
    let s = vote(liveRoom(), ids.ana, 'A').snapshot;
    s = host(s, { type: 'close_round' }).snapshot;
    const ended = host(s, { type: 'end_game' });
    expect(ended.effects).toHaveLength(1);
    expect(ended.effects[0]).toMatchObject({ type: 'game_finished', slug: 'this-or-that' });
    expect(JSON.stringify(ended.effects)).not.toContain(ids.ana);
    expect(ended.snapshot.lastSummary?.summary.rounds).toHaveLength(1);
    const closed = host(ended.snapshot, { type: 'end_session' });
    expect(closed.snapshot.status).toBe('ended');
    expect(closed.effects).toEqual([{ type: 'session_ended' }]);
    expect(
      reduceRoom(
        closed.snapshot,
        { type: 'join', memberId: ids.ana, name: 'x', isHost: false },
        ctx(),
      ).outcome,
    ).toBe('rejected');
  });

  it('ending the session mid-game finishes the game first', () => {
    const result = host(vote(liveRoom(), ids.ana, 'A').snapshot, { type: 'end_session' });
    expect(result.effects.map((e) => e.type)).toEqual(['game_finished', 'session_ended']);
  });
});

describe('views', () => {
  it('match the wire contract and mark hosts', () => {
    const s = vote(liveRoom(), ids.ana, 'A').snapshot;
    const view = roomViewSchema.parse(roomView(s, ids.ben, T0));
    expect(view.me).toEqual({ memberId: ids.ben, isHost: false });
    expect(view.participants.find((p) => p.memberId === ids.host)?.isHost).toBe(true);
    expect(view.game?.myChoice).toBeNull();
  });

  it('snapshots survive a JSON round trip and keep reducing identically', () => {
    const s = vote(liveRoom(), ids.ana, 'A').snapshot;
    const restored = JSON.parse(JSON.stringify(s)) as RoomSnapshot;
    const id = actionId();
    expect(vote(restored, ids.ben, 'B', id).snapshot).toEqual(vote(s, ids.ben, 'B', id).snapshot);
  });
});
