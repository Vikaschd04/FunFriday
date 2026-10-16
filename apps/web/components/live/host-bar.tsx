'use client';

import {
  ArrowRight,
  Flag,
  Lock,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  TimerReset,
} from 'lucide-react';
import { useState } from 'react';
import type { HostCommand, RoomView } from '@funfriday/contracts';
import { Button, Dialog } from '@funfriday/ui';
import { answeredText, hostErrorText } from '@/lib/live/view-model';
import { focusLater, focusLiveHeading } from './focus';
import { ShortcutsSwitch } from './use-shortcuts';
import type { LiveRoomApi } from './use-live-room';

type Key = 'extend' | 'close' | 'pause' | 'resume' | 'next' | 'skip' | 'end_game' | 'end_session';

const COMMAND: Record<Key, HostCommand> = {
  extend: { type: 'extend_round' },
  close: { type: 'close_round' },
  pause: { type: 'pause' },
  resume: { type: 'resume' },
  next: { type: 'next_round' },
  skip: { type: 'next_round' },
  end_game: { type: 'end_game' },
  end_session: { type: 'end_session' },
};

const PENDING_LABEL: Record<Key, string> = {
  extend: 'Adding...',
  close: 'Closing...',
  pause: 'Pausing...',
  resume: 'Resuming...',
  next: 'Moving on...',
  skip: 'Skipping...',
  end_game: 'Ending...',
  end_session: 'Ending...',
};

export function HostBar({
  room,
  live,
  offline,
  lobbyLike,
  onPlayAgain,
}: {
  room: RoomView;
  live: LiveRoomApi;
  offline: boolean;
  /** Lobby, or the host is re-configuring after a finished game. */
  lobbyLike: boolean;
  onPlayAgain: () => void;
}) {
  const game = room.game;
  const [pending, setPending] = useState<Key | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'end_game' | 'end_session' | null>(null);
  const [more, setMore] = useState(false);

  const phase = lobbyLike || !game ? 'lobby' : game.paused ? 'paused' : game.phase;
  const last = game?.round ? game.round.number >= game.round.total : false;

  const run = async (key: Key) => {
    if (pending || offline) return;
    setPending(key);
    setError(null);
    const outcome = await live.hostCommand(COMMAND[key]);
    setPending(null);
    if (!outcome.ok) {
      setError(hostErrorText(outcome.code));
      return;
    }
    setConfirm(null);
    if (key === 'close' || key === 'next' || key === 'skip') focusLater(focusLiveHeading);
    if (key === 'pause' || key === 'resume') {
      focusLater(() => document.getElementById('host-primary')?.focus());
    }
  };
  const busy = (key: Key) => pending === key;
  const idle = (key: Key) => pending !== null && pending !== key;
  const btn = (
    key: Key,
    label: string,
    icon: React.ReactNode,
    opts: {
      variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
      id?: string;
      className?: string;
    } = {},
  ) => (
    <Button
      id={opts.id}
      variant={opts.variant ?? 'secondary'}
      className={opts.className}
      iconStart={icon}
      loading={busy(key)}
      loadingLabel={PENDING_LABEL[key]}
      disabled={offline || idle(key)}
      onClick={() => {
        if (key === 'end_game' || key === 'end_session') setConfirm(key);
        else void run(key);
      }}
    >
      {label}
    </Button>
  );
  const dangerGhost = 'text-ff-coral-700! hover:bg-ff-coral-50';

  return (
    <section
      aria-label="Host controls"
      className="ff-safe-bottom border-t border-ff-border bg-ff-surface px-4 py-3 shadow-[0_-6px_16px_-8px_rgb(32_41_73/0.18)]"
    >
      <div className="mx-auto flex max-w-[960px] flex-col gap-2">
        {error && (
          <p role="alert" className="text-sm font-medium text-ff-coral-700">
            {error}
          </p>
        )}
        {offline && <p className="text-sm font-semibold text-ff-ink">Waiting to reconnect</p>}
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          {phase === 'question' && game && (
            <>
              <div className="flex flex-col md:flex-row md:items-center md:gap-3">
                {btn('close', 'Close round', <Lock />, { variant: 'primary', id: 'host-primary' })}
                <span className="ff-tnum text-sm text-ff-muted">
                  {answeredText(game.answeredCount, game.eligibleCount)}
                </span>
              </div>
              {btn('extend', '+15 s', <TimerReset />)}
              {btn('pause', 'Pause', <Pause />)}
              {btn('skip', 'Skip question', <SkipForward />)}
            </>
          )}
          {phase === 'paused' && (
            <>
              {btn('resume', 'Resume', <Play />, { variant: 'primary', id: 'host-primary' })}
              {btn('extend', '+15 s', <TimerReset />)}
              {btn('close', 'Close round', <Lock />)}
            </>
          )}
          {phase === 'reveal' &&
            (last
              ? btn('next', 'Finish game', <Flag />, { variant: 'primary', id: 'host-primary' })
              : btn('next', 'Next round', <ArrowRight />, {
                  variant: 'primary',
                  id: 'host-primary',
                }))}
          {phase === 'finished' && (
            <Button
              id="host-primary"
              iconStart={<RotateCcw />}
              disabled={offline}
              onClick={onPlayAgain}
            >
              Play again
            </Button>
          )}
          <div className="flex flex-wrap gap-2 md:ml-auto">
            {(phase === 'question' || phase === 'paused' || phase === 'reveal') &&
              btn('end_game', 'End game', null, { variant: 'ghost', className: dangerGhost })}
            <Button
              variant="ghost"
              className="md:hidden"
              iconStart={<MoreHorizontal />}
              onClick={() => {
                setMore(true);
              }}
            >
              More
            </Button>
            <span className="hidden md:inline-flex">
              {btn('end_session', 'End session', null, {
                variant: 'ghost',
                className: dangerGhost,
              })}
            </span>
          </div>
        </div>
      </div>

      <Dialog
        open={more}
        onClose={() => {
          setMore(false);
        }}
        title="More controls"
        actions={
          <>
            <Button
              variant="secondary"
              data-autofocus
              onClick={() => {
                setMore(false);
              }}
            >
              Close
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setMore(false);
                setConfirm('end_session');
              }}
            >
              End session
            </Button>
          </>
        }
      >
        <ShortcutsSwitch idSuffix="-more" />
      </Dialog>
      <Dialog
        open={confirm === 'end_game'}
        onClose={() => {
          if (!pending) setConfirm(null);
        }}
        title="End this game now?"
        description="Everyone will see the summary so far. Rounds not played won't be counted."
        actions={
          <>
            <Button
              variant="secondary"
              data-autofocus
              onClick={() => {
                setConfirm(null);
              }}
            >
              Keep playing
            </Button>
            <Button
              variant="danger"
              loading={busy('end_game')}
              loadingLabel="Ending..."
              onClick={() => void run('end_game')}
            >
              End game
            </Button>
          </>
        }
      />
      <Dialog
        open={confirm === 'end_session'}
        onClose={() => {
          if (!pending) setConfirm(null);
        }}
        title="End the session for everyone?"
        description="The room closes and people go back to the dashboard. You can't reopen it."
        actions={
          <>
            <Button
              variant="secondary"
              data-autofocus
              onClick={() => {
                setConfirm(null);
              }}
            >
              Keep session open
            </Button>
            <Button
              variant="danger"
              loading={busy('end_session')}
              loadingLabel="Ending..."
              onClick={() => void run('end_session')}
            >
              End session
            </Button>
          </>
        }
      />
    </section>
  );
}
