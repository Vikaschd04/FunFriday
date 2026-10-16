import {
  EXTEND_ROUND_SECONDS,
  THIS_OR_THAT,
  thisOrThatActionSchema,
  type ThisOrThatChoice,
  type ThisOrThatConfig,
  type ThisOrThatSummary,
  type ThisOrThatView,
} from '@funfriday/contracts';
import { isDeadlinePassed } from '../../common/clock.js';
import type {
  GameControl,
  GameDefinition,
  GameParticipant,
  GameStepContext,
  StepResult,
} from '../../engine/types.js';
import { thisOrThatStarterPack } from './content/starter-pack.js';
import type { ThisOrThatPack } from './content/types.js';

const packs: Record<ThisOrThatConfig['packId'], ThisOrThatPack> = {
  starter: thisOrThatStarterPack,
};

export interface ThisOrThatRound {
  id: string;
  promptId: string;
  question: string;
  optionA: string;
  optionB: string;
  /** participantId -> choice. Never leaves the server; views expose counts only. */
  answers: Readonly<Record<string, ThisOrThatChoice>>;
  deadlineAt: number | null;
  remainingMs: number | null;
  revealed: boolean;
}

export interface ThisOrThatState {
  slug: typeof THIS_OR_THAT;
  config: ThisOrThatConfig;
  phase: 'question' | 'reveal' | 'finished';
  paused: boolean;
  roundIndex: number;
  rounds: readonly ThisOrThatRound[];
}

const reject = (code: 'ROUND_CLOSED' | 'INVALID_ACTION' | 'DUPLICATE_ACTION') =>
  ({ ok: false, code }) as const;

function current(state: ThisOrThatState): ThisOrThatRound {
  const round = state.rounds[state.roundIndex];
  if (!round) throw new Error('round index out of range');
  return round;
}

function updateRound(
  state: ThisOrThatState,
  patch: Partial<ThisOrThatRound>,
  rest: Partial<ThisOrThatState> = {},
): ThisOrThatState {
  const rounds = state.rounds.map((round, index) =>
    index === state.roundIndex ? { ...round, ...patch } : round,
  );
  return { ...state, ...rest, rounds };
}

function reveal(state: ThisOrThatState): ThisOrThatState {
  return updateRound(
    state,
    { deadlineAt: null, remainingMs: null, revealed: true },
    {
      phase: 'reveal',
      paused: false,
    },
  );
}

function connectedIds(participants: readonly GameParticipant[]): string[] {
  return participants.filter((p) => p.connected).map((p) => p.id);
}

function everyoneConnectedAnswered(
  round: ThisOrThatRound,
  participants: readonly GameParticipant[],
): boolean {
  const connected = connectedIds(participants);
  return connected.length > 0 && connected.every((id) => round.answers[id] !== undefined);
}

function countAnswers(round: ThisOrThatRound): { a: number; b: number; pass: number } {
  const counts = { a: 0, b: 0, pass: 0 };
  for (const choice of Object.values(round.answers)) {
    if (choice === 'A') counts.a += 1;
    else if (choice === 'B') counts.b += 1;
    else counts.pass += 1;
  }
  return counts;
}

function openRound(state: ThisOrThatState, index: number, now: number): ThisOrThatState {
  const next = { ...state, roundIndex: index, phase: 'question' as const, paused: false };
  return updateRound(next, {
    deadlineAt: now + state.config.roundSeconds * 1000,
    remainingMs: null,
  });
}

export const thisOrThatGame: GameDefinition<
  ThisOrThatConfig,
  ThisOrThatState,
  ThisOrThatView,
  ThisOrThatSummary
> = {
  slug: THIS_OR_THAT,

  init(config, { now, random }) {
    const nonce = random
      .int(0, 36 ** 4 - 1)
      .toString(36)
      .padStart(4, '0');
    const prompts = random.shuffle(packs[config.packId].prompts).slice(0, config.rounds);
    const rounds: ThisOrThatRound[] = prompts.map((prompt, index) => ({
      id: `r${index + 1}-${nonce}`,
      promptId: prompt.id,
      question: prompt.question,
      optionA: prompt.optionA,
      optionB: prompt.optionB,
      answers: {},
      deadlineAt: null,
      remainingMs: null,
      revealed: false,
    }));
    const state: ThisOrThatState = {
      slug: THIS_OR_THAT,
      config,
      phase: 'question',
      paused: false,
      roundIndex: 0,
      rounds,
    };
    return openRound(state, 0, now);
  },

  act(state, actorId, rawAction, ctx): StepResult<ThisOrThatState> {
    const parsed = thisOrThatActionSchema.safeParse(rawAction);
    if (!parsed.success) return reject('INVALID_ACTION');
    if (state.phase !== 'question') return reject('ROUND_CLOSED');
    const round = current(state);
    if (parsed.data.roundId !== round.id) return reject('ROUND_CLOSED');
    if (state.paused) return reject('INVALID_ACTION');
    if (round.deadlineAt === null || isDeadlinePassed({ now: () => ctx.now }, round.deadlineAt)) {
      return reject('ROUND_CLOSED');
    }
    if (round.answers[actorId] !== undefined && !state.config.allowAnswerChange) {
      return reject('DUPLICATE_ACTION');
    }
    const answered = updateRound(state, {
      answers: { ...round.answers, [actorId]: parsed.data.choice },
    });
    const updated = current(answered);
    return {
      ok: true,
      state: everyoneConnectedAnswered(updated, ctx.participants) ? reveal(answered) : answered,
    };
  },

  control(state, control: GameControl, ctx): StepResult<ThisOrThatState> {
    if (state.phase === 'finished') return reject('INVALID_ACTION');
    const round = current(state);
    switch (control) {
      case 'close_round':
        return state.phase === 'question'
          ? { ok: true, state: reveal(state) }
          : reject('INVALID_ACTION');
      case 'extend_round': {
        if (state.phase !== 'question') return reject('INVALID_ACTION');
        const extra = EXTEND_ROUND_SECONDS * 1000;
        if (state.paused && round.remainingMs !== null) {
          return {
            ok: true,
            state: updateRound(state, { remainingMs: round.remainingMs + extra }),
          };
        }
        if (round.deadlineAt === null) return reject('INVALID_ACTION');
        // Extending a round whose time has already run out reopens it from now.
        return {
          ok: true,
          state: updateRound(state, { deadlineAt: Math.max(round.deadlineAt, ctx.now) + extra }),
        };
      }
      case 'next_round': {
        // In the question phase this skips the round; skipped rounds never reach the summary.
        const nextIndex = state.roundIndex + 1;
        if (nextIndex >= state.rounds.length) {
          return {
            ok: true,
            state: {
              ...updateRound(state, { deadlineAt: null, remainingMs: null }),
              phase: 'finished',
              paused: false,
            },
          };
        }
        return {
          ok: true,
          state: openRound(
            updateRound(state, { deadlineAt: null, remainingMs: null }),
            nextIndex,
            ctx.now,
          ),
        };
      }
      case 'pause':
        if (state.phase !== 'question' || state.paused || round.deadlineAt === null) {
          return reject('INVALID_ACTION');
        }
        return {
          ok: true,
          state: updateRound(
            state,
            { deadlineAt: null, remainingMs: Math.max(0, round.deadlineAt - ctx.now) },
            { paused: true },
          ),
        };
      case 'resume':
        if (!state.paused || round.remainingMs === null) return reject('INVALID_ACTION');
        return {
          ok: true,
          state: updateRound(
            state,
            { deadlineAt: ctx.now + round.remainingMs, remainingMs: null },
            { paused: false },
          ),
        };
      case 'end_game':
        return {
          ok: true,
          state: {
            ...updateRound(state, { deadlineAt: null, remainingMs: null }),
            phase: 'finished',
            paused: false,
          },
        };
    }
  },

  tick(state, ctx) {
    if (state.phase !== 'question' || state.paused) return state;
    const round = current(state);
    const timeUp =
      round.deadlineAt !== null && isDeadlinePassed({ now: () => ctx.now }, round.deadlineAt);
    return timeUp || everyoneConnectedAnswered(round, ctx.participants) ? reveal(state) : state;
  },

  nextDeadline(state) {
    if (state.phase !== 'question' || state.paused) return null;
    return current(state).deadlineAt;
  },

  view(state, viewerId, ctx): ThisOrThatView {
    const finished = state.phase === 'finished';
    const round = finished ? null : current(state);
    const eligible = new Set(connectedIds(ctx.participants));
    if (round) for (const id of Object.keys(round.answers)) eligible.add(id);
    return {
      slug: THIS_OR_THAT,
      phase: state.phase,
      paused: state.paused,
      round: round
        ? {
            id: round.id,
            number: state.roundIndex + 1,
            total: state.rounds.length,
            question: round.question,
            optionA: round.optionA,
            optionB: round.optionB,
            deadlineAt: state.phase === 'question' ? round.deadlineAt : null,
            remainingMs: state.phase === 'question' ? round.remainingMs : null,
          }
        : null,
      myChoice: round?.answers[viewerId] ?? null,
      answeredCount: round ? Object.keys(round.answers).length : 0,
      eligibleCount: round ? eligible.size : 0,
      allowAnswerChange: state.config.allowAnswerChange,
      reveal: round && state.phase === 'reveal' ? countAnswers(round) : null,
      summary: finished ? thisOrThatGame.summarize(state) : null,
    };
  },

  isFinished(state) {
    return state.phase === 'finished';
  },

  summarize(state): ThisOrThatSummary {
    const played = state.rounds
      .map((round, index) => ({ round, number: index + 1 }))
      .filter(({ round }) => round.revealed);
    const rounds = played.map(({ round, number }) => ({
      number,
      question: round.question,
      optionA: round.optionA,
      optionB: round.optionB,
      ...countAnswers(round),
    }));

    let mostUnited: ThisOrThatSummary['mostUnited'] = null;
    let closestSplit: ThisOrThatSummary['closestSplit'] = null;
    for (const r of rounds) {
      const answered = r.a + r.b;
      if (answered < 2) continue;
      const top =
        r.a >= r.b ? { option: r.optionA, count: r.a } : { option: r.optionB, count: r.b };
      if (!mostUnited || top.count / answered > mostUnited.count / mostUnited.answered) {
        mostUnited = {
          roundNumber: r.number,
          question: r.question,
          option: top.option,
          count: top.count,
          answered,
        };
      }
      if (
        r.a > 0 &&
        r.b > 0 &&
        (!closestSplit || Math.abs(r.a - r.b) < Math.abs(closestSplit.a - closestSplit.b))
      ) {
        closestSplit = { roundNumber: r.number, question: r.question, a: r.a, b: r.b };
      }
    }
    return { rounds, mostUnited, closestSplit };
  },
};

export type { GameStepContext };
