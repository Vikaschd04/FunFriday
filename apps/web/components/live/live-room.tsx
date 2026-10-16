'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button, Dialog } from '@funfriday/ui';
import { remainingMs, timerAnnouncement, timerBucket } from '@/lib/live/clock';
import { phaseAnnouncement, phaseTitle } from '@/lib/live/view-model';
import { DEFAULT_CONFIG, LobbyView, type ConfigDraft } from './lobby';
import { LogoMark } from '../brand-art';
import { useCurrentMembership } from '../session-provider';
import { ConnectionBanner } from './connection-banner';
import { GameView } from './game';
import { focusLiveHeading } from './focus';
import { HostBar } from './host-bar';
import { RevealView } from './reveal';
import { RosterDock } from './roster';
import { EndedScreen, JoinFailureScreen, JoiningSkeleton } from './screens';
import { SummaryView } from './summary';
import { useLiveRoom } from './use-live-room';
import { useNow } from './use-now';

/** Batches "Mia joined" / "Mia left" into at most one polite announcement every 3s. */
function PresenceAnnouncer({
  presence,
}: {
  presence: { seq: number; joined: string[]; left: string[] } | null;
}) {
  const [message, setMessage] = useState('');
  const buffer = useRef({ joined: [] as string[], left: [] as string[] });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seen = useRef(0);
  const flips = useRef(0);

  useEffect(() => {
    if (!presence || presence.seq === seen.current) return;
    seen.current = presence.seq;
    buffer.current.joined.push(...presence.joined);
    buffer.current.left.push(...presence.left);
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = undefined;
      const { joined, left } = buffer.current;
      buffer.current = { joined: [], left: [] };
      const part = (names: string[], verb: string) =>
        names.length === 0
          ? null
          : names.length === 1
            ? `${names[0]} ${verb}`
            : `${names.length} people ${verb}`;
      const text = [part(joined, 'joined'), part(left, 'left')].filter(Boolean).join('. ');
      // A zero-width toggle makes an identical consecutive message announce again.
      flips.current += 1;
      setMessage(flips.current % 2 === 0 ? text : `${text}\u200b`);
    }, 3000);
  }, [presence]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      data-testid="presence-live"
    >
      {message}
    </div>
  );
}

export function LiveRoom({ sessionId }: { sessionId: string }) {
  const live = useLiveRoom(sessionId);
  const router = useRouter();
  const membership = useCurrentMembership();
  const { state } = live;
  const room = state.room?.view ?? null;
  const game = room?.game ?? null;
  const round = game?.round ?? null;

  const [config, setConfig] = useState<ConfigDraft>(DEFAULT_CONFIG);
  const [setupAgain, setSetupAgain] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [endedSummary, setEndedSummary] = useState(false);

  const ticking = game?.phase === 'question' && !game.paused && round?.deadlineAt != null;
  const now = useNow(ticking);

  const phaseKey = !room
    ? 'joining'
    : room.status === 'ended'
      ? 'ended'
      : !game
        ? 'lobby'
        : `${game.phase}:${round?.id ?? ''}:${String(setupAgain)}`;

  // When a phase changes and focus was lost with the old screen, land on the new heading.
  useEffect(() => {
    if (phaseKey === 'joining') return;
    const id = setTimeout(() => {
      const active = document.activeElement;
      const main = document.getElementById('main');
      if (!active || active === document.body || (main && active === main)) focusLiveHeading();
    }, 80);
    return () => {
      clearTimeout(id);
    };
  }, [phaseKey]);

  const titlePhase = !room
    ? 'joining'
    : room.status === 'ended'
      ? 'ended'
      : !game || (game.phase === 'finished' && setupAgain)
        ? 'lobby'
        : game.phase;
  const titleRound = round ? { number: round.number, total: round.total } : null;
  useEffect(() => {
    document.title = phaseTitle(titlePhase, titleRound);
  }, [titlePhase, titleRound?.number, titleRound?.total]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!room) {
    if (state.join === 'failed' && state.failure) {
      return <JoinFailureScreen failure={state.failure} onRetry={live.retry} />;
    }
    if (state.link === 'lost') return <JoinFailureScreen failure="service" onRetry={live.retry} />;
    return <JoiningSkeleton />;
  }

  const summary = game?.summary ?? room.lastSummary?.summary ?? null;
  const canHost = room.me.isHost || membership?.role === 'admin';
  const offline = state.link !== 'online';

  if (room.status === 'ended') {
    return (
      <>
        <ConnectionBanner link={state.link} inGame={false} onRetry={live.retry} />
        {endedSummary && summary ? (
          <div className="flex flex-col gap-4">
            <SummaryView summary={summary} canHost={false} readOnly />
            <div>
              <Button
                variant="secondary"
                onClick={() => {
                  setEndedSummary(false);
                }}
              >
                Back
              </Button>
            </div>
          </div>
        ) : (
          <EndedScreen
            hasSummary={summary !== null}
            onSeeSummary={() => {
              setEndedSummary(true);
            }}
          />
        )}
      </>
    );
  }

  let announcement = '';
  if (game && round && game.phase === 'question') {
    const remaining =
      !game.paused && round.deadlineAt !== null
        ? remainingMs(round.deadlineAt, now, state.skew)
        : (round.remainingMs ?? 0);
    announcement = timerAnnouncement({
      roundNumber: round.number,
      roundTotal: round.total,
      totalMs: state.roundTiming?.totalMs ?? 0,
      resumedAtSec: state.roundTiming?.resumedAtSec ?? null,
      paused: game.paused,
      bucket: timerBucket(remaining),
    });
  }

  if (game?.phase === 'reveal') announcement = phaseAnnouncement('reveal');
  else if (game?.phase === 'finished' && !setupAgain) announcement = phaseAnnouncement('finished');
  const extendedText =
    state.extendedSeq > 0 ? `Time extended${state.extendedSeq % 2 === 0 ? '\u200b' : ''}` : '';

  const inLobby = !game || (game.phase === 'finished' && setupAgain);
  const inGame = !inLobby;

  let body: React.ReactNode;
  if (inLobby) {
    body = (
      <LobbyView
        room={room}
        live={live}
        canHost={canHost}
        offline={offline}
        config={config}
        setConfig={setConfig}
        onBackToSummary={
          game && summary
            ? () => {
                setSetupAgain(false);
              }
            : undefined
        }
      />
    );
  } else if (game.phase === 'question' && round) {
    body = (
      <GameView
        room={room}
        game={game}
        round={round}
        live={live}
        now={now}
        timing={state.roundTiming}
        offline={offline}
        showRoster
      />
    );
  } else if (game.phase === 'reveal' && round && game.reveal) {
    body = <RevealView room={room} game={game} canHost={canHost} showRoster />;
  } else if (summary) {
    body = <SummaryView summary={summary} canHost={canHost} readOnly={false} />;
  } else {
    body = <JoiningSkeleton />;
  }

  return (
    <div className="flex min-h-[calc(100dvh-2rem)] flex-col">
      <ConnectionBanner
        link={state.link}
        inGame={inGame && game?.phase === 'question'}
        onRetry={live.retry}
      />
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <LogoMark className="h-7 w-10 shrink-0" />
          <p className="truncate font-heading font-bold text-ff-ink">{room.title}</p>
        </div>
        <Button
          variant="ghost"
          className="shrink-0 whitespace-nowrap"
          onClick={() => {
            setLeaveOpen(true);
          }}
        >
          Leave
        </Button>
      </header>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="timer-live"
      >
        {announcement}
      </div>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {extendedText}
      </div>
      <PresenceAnnouncer presence={state.presence} />
      <div className="flex-1 pb-6">{body}</div>
      <div className="z-20 -mx-4 md:-mx-6 lg:-mx-8 [@media(min-height:501px)]:sticky [@media(min-height:501px)]:bottom-0">
        {inGame && (
          <RosterDock participants={room.participants} meId={room.me.memberId} showReady={false} />
        )}
        {canHost && (
          <HostBar
            room={room}
            live={live}
            offline={offline}
            lobbyLike={inLobby}
            onPlayAgain={() => {
              setSetupAgain(true);
            }}
          />
        )}
      </div>
      <Dialog
        open={leaveOpen}
        onClose={() => {
          setLeaveOpen(false);
        }}
        title="Leave the session?"
        description="You can rejoin with the code."
        actions={
          <>
            <Button
              variant="secondary"
              data-autofocus
              onClick={() => {
                setLeaveOpen(false);
              }}
            >
              Stay
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                router.push('/app');
              }}
            >
              Leave
            </Button>
          </>
        }
      />
    </div>
  );
}
