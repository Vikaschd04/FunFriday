'use client';

import { Radio, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createLiveSessionRequestSchema, type LiveSessionSummary } from '@funfriday/contracts';
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton, TextField } from '@funfriday/ui';
import { createLiveSession, joinByCode, listLiveSessions, relativeStart } from '@/lib/live/api';
import type { ApiFailure } from '@/lib/http';
import { checkRoomCode, normalizeRoomCode } from '@/lib/live/view-model';
import { AppLinkButton } from './app-link-button';
import { EmptyMotif } from './motifs';
import { useApi } from './use-api';
import { useCurrentMembership, useSession } from './session-provider';

function joinFailureText(failure: ApiFailure): string {
  switch (failure.kind) {
    case 'not_found':
      return "We couldn't find an open session with that code. Check it and try again.";
    case 'rate_limited':
      return 'Too many tries. Wait a moment and try again.';
    case 'unauthenticated':
      return 'Your sign-in expired. Sign in again to join.';
    default:
      return "We couldn't join just now - try again.";
  }
}

function StartCard({
  orgId,
  titleRef,
}: {
  orgId: string;
  titleRef: React.RefObject<HTMLInputElement | null>;
}) {
  const router = useRouter();
  const { expire } = useSession();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const trimmed = title.trim();
    const parsed = createLiveSessionRequestSchema.safeParse({
      title: trimmed === '' ? undefined : trimmed,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Use at least 2 characters.');
      return;
    }
    setError(null);
    setBusy(true);
    const result = await createLiveSession(orgId, parsed.data);
    if (result.kind === 'ok') {
      router.push(`/app/live/${result.data.id}`);
      return;
    }
    setBusy(false);
    if (result.kind === 'unauthenticated') expire();
    else setError("We couldn't open a room just now - try again.");
  };

  return (
    <Card tone="brand" as="section" aria-labelledby="start-live-heading">
      <h3 id="start-live-heading" className="font-heading text-lg font-bold text-ff-ink">
        Start a live session
      </h3>
      <p className="text-ff-ink">Open a room, share the code, play together.</p>
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-3">
        <TextField
          ref={titleRef}
          label="Session title (optional)"
          hint="Shown to your team. Leave blank for 'Friday session'."
          value={title}
          maxLength={80}
          onChange={(e) => {
            setTitle(e.target.value);
          }}
          error={error ?? undefined}
        />
        <div>
          <Button type="submit" loading={busy} loadingLabel="Opening room...">
            Start a live session
          </Button>
        </div>
      </form>
    </Card>
  );
}

function JoinCard() {
  const router = useRouter();
  const { expire } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const check = checkRoomCode(code);
    if (!check.ok) {
      setError(
        check.ambiguousHint ? `${check.message} Codes never use 0, O, 1, I or L.` : check.message,
      );
      input.current?.focus();
      return;
    }
    setError(null);
    setBusy(true);
    const result = await joinByCode(check.code);
    if (result.kind === 'ok') {
      router.push(`/app/live/${result.data.sessionId}`);
      return;
    }
    setBusy(false);
    if (result.kind === 'unauthenticated') {
      expire();
      return;
    }
    setError(joinFailureText(result));
    input.current?.focus();
  };

  return (
    <Card as="section" aria-labelledby="join-live-heading">
      <h3 id="join-live-heading" className="font-heading text-lg font-bold text-ff-ink">
        Join with a code
      </h3>
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-3">
        <TextField
          ref={input}
          label="Room code"
          hint="6 characters, like K7P2QM. Capitals and spaces don't matter."
          value={code}
          maxLength={12}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          className="uppercase tracking-[0.12em]"
          onChange={(e) => {
            setCode(normalizeRoomCode(e.target.value));
          }}
          error={error ?? undefined}
        />
        <div>
          <Button type="submit" loading={busy} loadingLabel="Joining...">
            Join session
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SessionRow({ session, now }: { session: LiveSessionSummary; now: number }) {
  const inLobby = session.status === 'lobby';
  return (
    <li>
      <Card className="h-full">
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-heading text-lg font-bold text-ff-ink">{session.title}</h4>
          <Badge tone={inLobby ? 'success' : 'brand'} icon={inLobby ? <Users /> : <Radio />}>
            {inLobby ? 'In lobby' : 'In progress'}
          </Badge>
        </div>
        <p className="text-ff-ink">
          {session.host
            ? `Hosted by ${session.host.name?.trim() ? session.host.name : 'a teammate'}`
            : 'Host has left the organisation'}
        </p>
        <p className="ff-tnum text-sm text-ff-muted">Code {session.roomCode}</p>
        <p className="text-sm text-ff-muted" title={new Date(session.createdAt).toLocaleString()}>
          {relativeStart(session.createdAt, now)}
        </p>
        <div className="mt-auto">
          <AppLinkButton variant="secondary" href={`/app/live/${session.id}`}>
            Join<span className="sr-only"> {session.title}</span>
          </AppLinkButton>
        </div>
      </Card>
    </li>
  );
}

export function LiveEntry() {
  const membership = useCurrentMembership();
  const orgId = membership?.org.id ?? '';
  const canStart = membership?.role === 'admin' || membership?.role === 'host';
  const titleRef = useRef<HTMLInputElement>(null);
  const sessions = useApi((signal) => listLiveSessions(orgId, { signal }), orgId);
  const { reload } = sessions;
  const [now, setNow] = useState(() => Date.now());

  // Quiet refresh: every 20s and when the tab regains focus.
  useEffect(() => {
    if (!orgId) return;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      setNow(Date.now());
      reload();
    };
    const timer = setInterval(refresh, 20_000);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [orgId, reload]);

  if (!membership) return null;
  const result = sessions.result;

  return (
    <section aria-labelledby="live-heading" className="flex flex-col gap-4">
      <h2
        id="live-heading"
        className="font-heading text-[22px] leading-[30px] font-bold text-ff-ink"
      >
        Live sessions
      </h2>
      <div className={`grid gap-4 ${canStart ? 'lg:grid-cols-2' : 'max-w-xl'}`}>
        {canStart && <StartCard orgId={orgId} titleRef={titleRef} />}
        <JoinCard />
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="font-heading text-lg font-bold text-ff-ink">
          Happening now in {membership.org.name}
        </h3>
        {sessions.loading && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton variant="card" count={2} label="Loading live sessions..." />
          </div>
        )}
        {result && result.kind !== 'ok' && (
          <ErrorState
            headingLevel={4}
            title="We couldn't load live sessions"
            body="Check your connection and try again."
            onRetry={reload}
            retrying={sessions.refreshing}
          />
        )}
        {result?.kind === 'ok' && result.data.sessions.length === 0 && (
          <EmptyState
            headingLevel={4}
            illustration={<EmptyMotif />}
            title="No live sessions right now"
            body="When someone opens a room it appears here."
            primaryAction={
              canStart ? (
                <Button
                  onClick={() => {
                    titleRef.current?.focus();
                  }}
                >
                  Start a live session
                </Button>
              ) : undefined
            }
          />
        )}
        {result?.kind === 'ok' && result.data.sessions.length > 0 && (
          <ul className="grid gap-4 lg:grid-cols-2">
            {result.data.sessions.map((s) => (
              <SessionRow key={s.id} session={s} now={now} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
