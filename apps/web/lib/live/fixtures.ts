import type { RoomState, RoomView } from '@funfriday/contracts';

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;

export function makeView(overrides: Partial<RoomView> = {}): RoomView {
  return {
    sessionId: uuid(1),
    title: 'Friday session',
    roomCode: 'K7P2QM',
    status: 'lobby',
    me: { memberId: uuid(10), isHost: false },
    participants: [
      { memberId: uuid(10), name: 'Me', connected: true, ready: false, isHost: false },
      { memberId: uuid(11), name: 'Host', connected: true, ready: false, isHost: true },
    ],
    game: null,
    lastSummary: null,
    ...overrides,
  };
}

export function makeState(
  revision: number,
  serverNow = 1_000_000,
  view: RoomView = makeView(),
): RoomState {
  return { revision, serverNow, view };
}

export { uuid };
