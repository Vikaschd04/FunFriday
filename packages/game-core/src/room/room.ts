import {
  type ErrorCode,
  type HostCommand,
  type LiveSessionStatus,
  type RoomView,
  THIS_OR_THAT,
  type ThisOrThatSummary,
} from '@funfriday/contracts';
import { createSeededRandom } from '../common/random.js';
import type { GameControl, GameParticipant, GameStepContext } from '../engine/types.js';
import { type ThisOrThatState, thisOrThatGame } from '../games/this-or-that/rules.js';

/** Remembered clientActionIds per member for duplicate detection (ADR 0003 decision 6). */
export const RECENT_ACTIONS_PER_MEMBER = 50;

export interface RoomMember {
  name: string | null;
  connected: boolean;
  ready: boolean;
  /** Session host or organisation Admin - may send host commands. */
  isHost: boolean;
  joinedAt: number;
}

export interface ActiveGame {
  slug: typeof THIS_OR_THAT;
  state: ThisOrThatState;
  startedAt: number;
}

/** Authoritative, JSON-serialisable room state. The API snapshots it to Redis after every change. */
export interface RoomSnapshot {
  version: 1;
  sessionId: string;
  organizationId: string;
  title: string;
  roomCode: string;
  status: LiveSessionStatus;
  revision: number;
  members: Record<string, RoomMember>;
  game: ActiveGame | null;
  lastSummary: { slug: typeof THIS_OR_THAT; summary: ThisOrThatSummary } | null;
  recentActions: Record<string, string[]>;
}

export type RoomCommand =
  | { type: 'join'; memberId: string; name: string | null; isHost: boolean }
  | { type: 'disconnect'; memberId: string }
  | { type: 'ready'; memberId: string; ready: boolean; clientActionId: string }
  | { type: 'host'; memberId: string; clientActionId: string; command: HostCommand }
  | { type: 'game'; memberId: string; clientActionId: string; action: unknown }
  | { type: 'tick' };

export type RoomEffect =
  | { type: 'game_started'; slug: typeof THIS_OR_THAT }
  | {
      type: 'game_finished';
      slug: typeof THIS_OR_THAT;
      startedAt: number;
      summary: ThisOrThatSummary;
    }
  | { type: 'session_ended' };

export interface RoomResult {
  snapshot: RoomSnapshot;
  /** `noop`: valid but nothing changed (e.g. a second tab joining, a tick before the deadline). */
  outcome: 'accepted' | 'duplicate' | 'rejected' | 'noop';
  code?: ErrorCode;
  effects: RoomEffect[];
}

export interface RoomContext {
  now: number;
  /** Fresh random seed for a new game (crypto-random in the API, fixed in tests). */
  seed: () => number;
}

export function createRoom(init: {
  sessionId: string;
  organizationId: string;
  title: string;
  roomCode: string;
}): RoomSnapshot {
  return {
    version: 1,
    ...init,
    status: 'lobby',
    revision: 0,
    members: {},
    game: null,
    lastSummary: null,
    recentActions: {},
  };
}

function participantsOf(snapshot: RoomSnapshot): GameParticipant[] {
  return Object.entries(snapshot.members).map(([id, member]) => ({
    id,
    connected: member.connected,
  }));
}

function stepContext(snapshot: RoomSnapshot, now: number): GameStepContext {
  return { now, participants: participantsOf(snapshot) };
}

const unchanged = (
  snapshot: RoomSnapshot,
  outcome: RoomResult['outcome'],
  code?: ErrorCode,
): RoomResult =>
  code ? { snapshot, outcome, code, effects: [] } : { snapshot, outcome, effects: [] };

function isDuplicate(snapshot: RoomSnapshot, memberId: string, clientActionId: string): boolean {
  return snapshot.recentActions[memberId]?.includes(clientActionId) ?? false;
}

function remember(snapshot: RoomSnapshot, memberId: string, clientActionId: string): RoomSnapshot {
  const recent = [...(snapshot.recentActions[memberId] ?? []), clientActionId].slice(
    -RECENT_ACTIONS_PER_MEMBER,
  );
  return { ...snapshot, recentActions: { ...snapshot.recentActions, [memberId]: recent } };
}

function commit(
  previous: RoomSnapshot,
  next: RoomSnapshot,
  effects: RoomEffect[] = [],
): RoomResult {
  return { snapshot: { ...next, revision: previous.revision + 1 }, outcome: 'accepted', effects };
}

/** Applies a game state change and emits `game_finished` (with the aggregate summary) once. */
function withGameState(
  snapshot: RoomSnapshot,
  game: ActiveGame,
  nextState: ThisOrThatState,
): {
  snapshot: RoomSnapshot;
  effects: RoomEffect[];
} {
  const wasFinished = thisOrThatGame.isFinished(game.state);
  const nowFinished = thisOrThatGame.isFinished(nextState);
  const updated: RoomSnapshot = { ...snapshot, game: { ...game, state: nextState } };
  if (!wasFinished && nowFinished) {
    const summary = thisOrThatGame.summarize(nextState);
    return {
      snapshot: { ...updated, lastSummary: { slug: game.slug, summary } },
      effects: [{ type: 'game_finished', slug: game.slug, startedAt: game.startedAt, summary }],
    };
  }
  return { snapshot: updated, effects: [] };
}

function activeGame(snapshot: RoomSnapshot): ActiveGame | null {
  return snapshot.game && !thisOrThatGame.isFinished(snapshot.game.state) ? snapshot.game : null;
}

function applyHostCommand(
  snapshot: RoomSnapshot,
  command: HostCommand,
  ctx: RoomContext,
): RoomResult {
  if (command.type === 'end_session') {
    const game = activeGame(snapshot);
    let next: RoomSnapshot = { ...snapshot, status: 'ended' };
    let effects: RoomEffect[] = [];
    if (game) {
      const ended = thisOrThatGame.control(game.state, 'end_game', stepContext(snapshot, ctx.now));
      if (ended.ok) ({ snapshot: next, effects } = withGameState(next, game, ended.state));
    }
    return commit(snapshot, next, [...effects, { type: 'session_ended' }]);
  }

  if (command.type === 'start_game') {
    if (activeGame(snapshot)) return unchanged(snapshot, 'rejected', 'INVALID_ACTION');
    const ctxStep = stepContext(snapshot, ctx.now);
    const state = thisOrThatGame.init(command.config, {
      ...ctxStep,
      random: createSeededRandom(ctx.seed()),
    });
    const next: RoomSnapshot = {
      ...snapshot,
      status: 'live',
      game: { slug: THIS_OR_THAT, state, startedAt: ctx.now },
      members: Object.fromEntries(
        Object.entries(snapshot.members).map(([id, member]) => [id, { ...member, ready: false }]),
      ),
    };
    return commit(snapshot, next, [{ type: 'game_started', slug: THIS_OR_THAT }]);
  }

  const game = activeGame(snapshot);
  if (!game) return unchanged(snapshot, 'rejected', 'INVALID_ACTION');
  const control: GameControl = command.type;
  const result = thisOrThatGame.control(game.state, control, stepContext(snapshot, ctx.now));
  if (!result.ok) return unchanged(snapshot, 'rejected', result.code);
  const { snapshot: next, effects } = withGameState(snapshot, game, result.state);
  return commit(snapshot, next, effects);
}

/**
 * The room state machine. Pure: the API runs it inside a per-room serialized actor,
 * persists the returned snapshot, then broadcasts views (ADR 0003).
 */
export function reduceRoom(
  snapshot: RoomSnapshot,
  command: RoomCommand,
  ctx: RoomContext,
): RoomResult {
  if (snapshot.status === 'ended' && command.type !== 'disconnect' && command.type !== 'tick') {
    return unchanged(snapshot, 'rejected', 'INVALID_ACTION');
  }

  switch (command.type) {
    case 'join': {
      const existing = snapshot.members[command.memberId];
      if (
        existing?.connected &&
        existing.isHost === command.isHost &&
        existing.name === command.name
      ) {
        return unchanged(snapshot, 'noop');
      }
      const member: RoomMember = existing
        ? { ...existing, connected: true, isHost: command.isHost, name: command.name }
        : {
            name: command.name,
            connected: true,
            ready: false,
            isHost: command.isHost,
            joinedAt: ctx.now,
          };
      return commit(snapshot, {
        ...snapshot,
        members: { ...snapshot.members, [command.memberId]: member },
      });
    }

    case 'disconnect': {
      const existing = snapshot.members[command.memberId];
      if (!existing?.connected) return unchanged(snapshot, 'noop');
      let next: RoomSnapshot = {
        ...snapshot,
        members: { ...snapshot.members, [command.memberId]: { ...existing, connected: false } },
      };
      // Everyone still here may already have answered: let the game re-evaluate.
      let effects: RoomEffect[] = [];
      const game = activeGame(next);
      if (game) {
        const ticked = thisOrThatGame.tick(game.state, stepContext(next, ctx.now));
        if (ticked !== game.state)
          ({ snapshot: next, effects } = withGameState(next, game, ticked));
      }
      return commit(snapshot, next, effects);
    }

    case 'ready': {
      const member = snapshot.members[command.memberId];
      if (!member) return unchanged(snapshot, 'rejected', 'FORBIDDEN');
      if (isDuplicate(snapshot, command.memberId, command.clientActionId))
        return unchanged(snapshot, 'duplicate');
      if (member.ready === command.ready) {
        return unchanged(remember(snapshot, command.memberId, command.clientActionId), 'noop');
      }
      const next = remember(
        {
          ...snapshot,
          members: { ...snapshot.members, [command.memberId]: { ...member, ready: command.ready } },
        },
        command.memberId,
        command.clientActionId,
      );
      return commit(snapshot, next);
    }

    case 'host': {
      const member = snapshot.members[command.memberId];
      if (!member) return unchanged(snapshot, 'rejected', 'FORBIDDEN');
      if (!member.isHost) return unchanged(snapshot, 'rejected', 'NOT_HOST');
      if (isDuplicate(snapshot, command.memberId, command.clientActionId))
        return unchanged(snapshot, 'duplicate');
      const result = applyHostCommand(snapshot, command.command, ctx);
      return result.outcome === 'accepted'
        ? {
            ...result,
            snapshot: remember(result.snapshot, command.memberId, command.clientActionId),
          }
        : result;
    }

    case 'game': {
      const member = snapshot.members[command.memberId];
      if (!member) return unchanged(snapshot, 'rejected', 'FORBIDDEN');
      if (isDuplicate(snapshot, command.memberId, command.clientActionId))
        return unchanged(snapshot, 'duplicate');
      const game = activeGame(snapshot);
      if (!game) return unchanged(snapshot, 'rejected', 'INVALID_ACTION');
      const result = thisOrThatGame.act(
        game.state,
        command.memberId,
        command.action,
        stepContext(snapshot, ctx.now),
      );
      if (!result.ok) return unchanged(snapshot, 'rejected', result.code);
      const { snapshot: next, effects } = withGameState(snapshot, game, result.state);
      return commit(snapshot, remember(next, command.memberId, command.clientActionId), effects);
    }

    case 'tick': {
      const game = activeGame(snapshot);
      if (!game) return unchanged(snapshot, 'noop');
      const ticked = thisOrThatGame.tick(game.state, stepContext(snapshot, ctx.now));
      if (ticked === game.state) return unchanged(snapshot, 'noop');
      const { snapshot: next, effects } = withGameState(snapshot, game, ticked);
      return commit(snapshot, next, effects);
    }
  }
}

/** Next instant the API should send a `tick`, or null. */
export function nextRoomDeadline(snapshot: RoomSnapshot): number | null {
  const game = activeGame(snapshot);
  return game ? thisOrThatGame.nextDeadline(game.state) : null;
}

/** Role-redacted view for one member (matches `roomViewSchema`). */
export function roomView(snapshot: RoomSnapshot, viewerId: string, now: number): RoomView {
  const participants = Object.entries(snapshot.members)
    .sort(([, a], [, b]) => a.joinedAt - b.joinedAt)
    .map(([memberId, member]) => ({
      memberId,
      name: member.name,
      connected: member.connected,
      ready: member.ready,
      isHost: member.isHost,
    }));
  return {
    sessionId: snapshot.sessionId,
    title: snapshot.title,
    roomCode: snapshot.roomCode,
    status: snapshot.status,
    me: { memberId: viewerId, isHost: snapshot.members[viewerId]?.isHost ?? false },
    participants,
    game: snapshot.game
      ? thisOrThatGame.view(snapshot.game.state, viewerId, stepContext(snapshot, now))
      : null,
    lastSummary: snapshot.lastSummary,
  };
}
