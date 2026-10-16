'use client';

import { Check, CircleCheck, Circle, Copy, Link2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { THIS_OR_THAT, thisOrThatConfigSchema, type RoomView } from '@funfriday/contracts';
import { Button, Card, Notice, NumberField } from '@funfriday/ui';
import type { LiveRoomApi } from './use-live-room';
import { RosterCard } from './roster';
import {
  estimateMinutes,
  hostErrorText,
  rosterCounts,
  spellCode,
  teammateName,
} from '@/lib/live/view-model';

export interface ConfigDraft {
  rounds: number | null;
  seconds: number | null;
  allowChange: boolean;
}
export const DEFAULT_CONFIG: ConfigDraft = { rounds: 6, seconds: 30, allowChange: true };

type CopyState = 'idle' | 'code' | 'link' | 'failed';

function CodeCard({ room }: { room: RoomView }) {
  const [copied, setCopied] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flash = (state: CopyState) => {
    setCopied(state);
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => {
        setCopied('idle');
      },
      state === 'failed' ? 6000 : 2000,
    );
  };
  const copy = async (text: string, state: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      flash(state);
    } catch {
      flash('failed');
    }
  };
  return (
    <Card tone="brand" as="section" aria-labelledby="code-caption">
      <p
        id="code-caption"
        className="text-sm font-semibold tracking-wide text-ff-violet-700 uppercase"
      >
        Room code
      </p>
      <p className="ff-code text-ff-ink" data-testid="room-code">
        <span role="img" aria-label={spellCode(room.roomCode)}>
          {room.roomCode}
        </span>
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="secondary"
          iconStart={copied === 'code' ? <Check /> : <Copy />}
          onClick={() => void copy(room.roomCode, 'code')}
        >
          {copied === 'code' ? 'Code copied' : 'Copy code'}
        </Button>
        <Button
          variant="secondary"
          iconStart={copied === 'link' ? <Check /> : <Link2 />}
          onClick={() => void copy(`${window.location.origin}/app/live/${room.sessionId}`, 'link')}
        >
          {copied === 'link' ? 'Link copied' : 'Copy link'}
        </Button>
      </div>
      <p
        role="status"
        className={copied === 'failed' ? 'text-sm font-medium text-ff-coral-700' : 'sr-only'}
      >
        {copied === 'code' && 'Room code copied'}
        {copied === 'link' && 'Link copied'}
        {copied === 'failed' && "Copy didn't work. Select the code and copy it yourself."}
      </p>
      <p className="text-sm text-ff-muted">
        Share this with your team. Only people in your organisation can join.
      </p>
    </Card>
  );
}

function ReadyToggle({
  room,
  live,
  offline,
}: {
  room: RoomView;
  live: LiveRoomApi;
  offline: boolean;
}) {
  const me = room.participants.find((p) => p.memberId === room.me.memberId);
  const ready = me?.ready ?? false;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = async () => {
    if (pending || offline) return;
    setPending(true);
    setError(null);
    const outcome = await live.setReady(!ready);
    setPending(false);
    if (!outcome.ok) setError(hostErrorText(outcome.code));
  };
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-pressed={ready}
        aria-busy={pending || undefined}
        aria-disabled={pending || offline || undefined}
        onClick={() => void toggle()}
        className={`ff-press flex min-h-12 w-full items-center justify-center gap-2 rounded-ff-button border-2 px-5 text-base font-semibold ${
          ready
            ? 'border-ff-mint-700 bg-ff-mint-50 text-ff-mint-700'
            : 'border-ff-border-strong bg-ff-surface text-ff-ink hover:bg-ff-violet-50'
        } aria-disabled:cursor-not-allowed aria-disabled:opacity-80`}
      >
        {ready ? (
          <CircleCheck aria-hidden="true" className="size-5" />
        ) : (
          <Circle aria-hidden="true" className="size-5" />
        )}
        {pending ? 'Saving...' : ready ? "You're ready - tap to undo" : "I'm ready"}
      </button>
      <p className="text-sm text-ff-muted">Ready just tells the host you&apos;re set.</p>
      {error && (
        <p role="alert" className="text-sm font-medium text-ff-coral-700">
          {error}
        </p>
      )}
    </div>
  );
}

function HostPanel({
  room,
  live,
  offline,
  config,
  setConfig,
  onBackToSummary,
}: {
  room: RoomView;
  live: LiveRoomApi;
  offline: boolean;
  config: ConfigDraft;
  setConfig: (next: ConfigDraft) => void;
  onBackToSummary?: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const { connected } = rosterCounts(room.participants);
  const alone = connected < 2;
  const roundsOk = config.rounds !== null && config.rounds >= 3 && config.rounds <= 10;
  const secondsOk = config.seconds !== null && config.seconds >= 20 && config.seconds <= 60;

  const start = async () => {
    setShowErrors(true);
    if (pending || alone || offline || !roundsOk || !secondsOk) return;
    const parsed = thisOrThatConfigSchema.safeParse({
      rounds: config.rounds,
      roundSeconds: config.seconds,
      allowAnswerChange: config.allowChange,
      packId: 'starter',
    });
    if (!parsed.success) return;
    setPending(true);
    setError(null);
    const outcome = await live.hostCommand({
      type: 'start_game',
      game: THIS_OR_THAT,
      config: parsed.data,
    });
    setPending(false);
    if (!outcome.ok) setError(hostErrorText(outcome.code));
  };

  return (
    <Card as="section" aria-labelledby="setup-heading">
      <h2
        id="setup-heading"
        className="font-heading text-[22px] leading-[30px] font-bold text-ff-ink"
      >
        Set up the game
      </h2>
      <div role="radiogroup" aria-label="Game">
        <button
          type="button"
          role="radio"
          aria-checked="true"
          className="flex w-full items-start gap-4 rounded-ff-card border-2 border-ff-violet-700 bg-ff-violet-50 p-4 text-left"
        >
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-ff-button bg-ff-violet-700 font-heading text-xl font-extrabold text-white"
          >
            A|B
          </span>
          <span className="flex flex-1 flex-col gap-1">
            <span className="font-heading text-lg font-bold text-ff-ink">This or That</span>
            <span className="text-sm text-ff-ink">
              Pick a side, see how the room splits. 5-10 min. No scores.
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-ff-violet-700">
              <Check aria-hidden="true" className="size-4" /> Selected
            </span>
          </span>
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Rounds"
          hint="Each round is one question."
          min={3}
          max={10}
          showStepper
          value={config.rounds}
          onValueChange={(rounds) => {
            setConfig({ ...config, rounds });
          }}
          error={showErrors && !roundsOk ? 'Choose 3 to 10 rounds.' : undefined}
        />
        <NumberField
          label="Seconds per round"
          min={20}
          max={60}
          step={5}
          showStepper
          value={config.seconds}
          onValueChange={(seconds) => {
            setConfig({ ...config, seconds });
          }}
          error={showErrors && !secondsOk ? 'Choose 20 to 60 seconds.' : undefined}
        />
      </div>
      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-6 shrink-0 accent-[var(--ff-violet-700)]"
          checked={config.allowChange}
          onChange={(e) => {
            setConfig({ ...config, allowChange: e.target.checked });
          }}
        />
        <span>
          <span className="font-semibold text-ff-ink">
            Let people change their answer until time is up
          </span>
          <span className="block text-sm text-ff-muted">Off means the first answer is final.</span>
        </span>
      </label>
      <p className="text-sm text-ff-muted">Question pack: Starter</p>
      {roundsOk && secondsOk && (
        <p className="text-sm text-ff-muted">
          About {estimateMinutes(config.rounds ?? 0, config.seconds ?? 0)} minutes
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          fullWidth
          loading={pending}
          loadingLabel="Starting..."
          disabled={alone || offline}
          aria-describedby={alone ? 'start-reason' : undefined}
          onClick={() => void start()}
        >
          Start This or That
        </Button>
        {alone && (
          <p id="start-reason" className="text-sm font-medium text-ff-ink">
            Waiting for at least 1 more person.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-ff-coral-700">
            {error}
          </p>
        )}
        {onBackToSummary && (
          <Button variant="ghost" onClick={onBackToSummary}>
            Back to summary
          </Button>
        )}
      </div>
    </Card>
  );
}

function WaitingForHost() {
  return (
    <Card as="section" aria-labelledby="waiting-heading">
      <h2
        id="waiting-heading"
        className="font-heading text-[22px] leading-[30px] font-bold text-ff-ink"
      >
        Waiting for the host to start
      </h2>
      <p aria-hidden="true" className="flex gap-1.5">
        <span className="ff-dot size-2.5 rounded-full bg-ff-violet-700" />
        <span className="ff-dot size-2.5 rounded-full bg-ff-violet-700" />
        <span className="ff-dot size-2.5 rounded-full bg-ff-violet-700" />
      </p>
      <p className="text-sm text-ff-muted">
        Tap &quot;I&apos;m ready&quot; so the host knows you&apos;re set.
      </p>
    </Card>
  );
}

export function LobbyView({
  room,
  live,
  canHost,
  offline,
  config,
  setConfig,
  onBackToSummary,
}: {
  room: RoomView;
  live: LiveRoomApi;
  canHost: boolean;
  offline: boolean;
  config: ConfigDraft;
  setConfig: (next: ConfigDraft) => void;
  onBackToSummary?: () => void;
}) {
  const host = room.participants.find((p) => p.isHost);
  const hostAway = host ? !host.connected && !room.me.isHost : false;
  return (
    <div className="ff-phase flex flex-col gap-4">
      <header>
        <h1
          data-live-heading
          tabIndex={-1}
          className="font-heading text-[30px] leading-9 font-extrabold tracking-tight text-ff-ink md:text-[40px] md:leading-[46px]"
        >
          {room.title}
        </h1>
        <p className="text-ff-muted">{host ? `Hosted by ${teammateName(host.name)}` : 'Lobby'}</p>
      </header>
      {hostAway && (
        <Notice tone="warning" announce>
          The host has stepped away. The room stays open and they can rejoin. An organisation Admin
          can also take over.
        </Notice>
      )}
      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
        <div className="flex flex-col gap-4 lg:col-span-7">
          <CodeCard room={room} />
          <ReadyToggle room={room} live={live} offline={offline} />
          {canHost ? (
            <HostPanel
              room={room}
              live={live}
              offline={offline}
              config={config}
              setConfig={setConfig}
              onBackToSummary={onBackToSummary}
            />
          ) : (
            <WaitingForHost />
          )}
        </div>
        <div className="lg:sticky lg:top-6 lg:col-span-5">
          <RosterCard participants={room.participants} meId={room.me.memberId} showReady />
        </div>
      </div>
    </div>
  );
}
