import type { SeededRandom } from '../common/random.js';

/** A seat in the room as seen by a game. Games never see names or emails. */
export interface GameParticipant {
  id: string;
  connected: boolean;
}

export interface GameStepContext {
  /** Authoritative server time (epoch ms). */
  now: number;
  participants: readonly GameParticipant[];
}

export type GameRejection = 'ROUND_CLOSED' | 'INVALID_ACTION' | 'DUPLICATE_ACTION';
export type StepResult<S> = { ok: true; state: S } | { ok: false; code: GameRejection };
export type GameControl =
  'close_round' | 'extend_round' | 'next_round' | 'pause' | 'resume' | 'end_game';

/**
 * Pure, deterministic game rules (docs/GAMES.md "Shared game contract", ADR 0003).
 * No I/O, no clocks, no Math.random: time and randomness are injected. States must be
 * JSON-serialisable so the API can snapshot them to Redis and rehydrate after a restart.
 */
export interface GameDefinition<Config, State, View, Summary> {
  readonly slug: string;
  init(config: Config, ctx: GameStepContext & { random: SeededRandom }): State;
  /** Validates the raw client action with the game's own schema, then applies it. */
  act(state: State, actorId: string, rawAction: unknown, ctx: GameStepContext): StepResult<State>;
  control(state: State, control: GameControl, ctx: GameStepContext): StepResult<State>;
  /** Time- and presence-driven transitions. Returns the same object when nothing changed. */
  tick(state: State, ctx: GameStepContext): State;
  /** Next instant at which tick() could change the state, or null. */
  nextDeadline(state: State): number | null;
  /** Role-redacted view for one viewer. */
  view(state: State, viewerId: string, ctx: GameStepContext): View;
  isFinished(state: State): boolean;
  /** Aggregate, retainable result. */
  summarize(state: State): Summary;
}
