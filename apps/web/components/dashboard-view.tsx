'use client';

import { Calendar, Clock, Trash2, Users } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Notice,
  Skeleton,
  useAnnounce,
} from '@funfriday/ui';
import { zonedWallTimeToUtc } from '@funfriday/contracts';
import { deleteDraft, listDrafts, type DraftListItem, type StoredDraft } from '@/lib/drafts';
import { formatWallTime } from '@/lib/time-format';
import { AppLinkButton } from './app-link-button';
import { EmptyMotif } from './motifs';
import { OnboardingCard, VerifyEmailNotice } from './dashboard-account';
import { LiveEntry } from './live-entry';
import { useCurrentMembership, useMe } from './session-provider';

type Load =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; items: DraftListItem[]; now: number };

function plannedMinutes(draft: StoredDraft): number {
  return (draft.activities ?? []).reduce((sum, a) => sum + a.minutes, 0);
}

function draftTitle(draft: StoredDraft): string {
  return draft.title?.trim() ? draft.title.trim() : 'Untitled plan';
}

function whenText(draft: StoredDraft): string {
  const when = formatWallTime(draft.startsAtLocal ?? '');
  if (when === '') return 'No date chosen yet';
  return `${when} (${draft.timeZone ?? 'time zone not set'})`;
}

function runtimeText(draft: StoredDraft): string {
  const planned = plannedMinutes(draft);
  return draft.durationMinutes !== undefined
    ? `${planned} min of ${draft.durationMinutes}`
    : `${planned} min planned`;
}

/** Nearest future start; if none, the most recently edited. */
function pickUpNext(drafts: StoredDraft[], now: number): StoredDraft | null {
  const future = drafts
    .map((draft) => {
      const converted =
        draft.startsAtLocal && draft.timeZone
          ? zonedWallTimeToUtc(draft.startsAtLocal, draft.timeZone)
          : null;
      return { draft, at: converted?.ok ? converted.utcMs : null };
    })
    .filter(
      (entry): entry is { draft: StoredDraft; at: number } => entry.at !== null && entry.at > now,
    )
    .sort((a, b) => a.at - b.at);
  if (future[0]) return future[0].draft;
  const latest = [...drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return latest[0] ?? null;
}

export function DashboardView({
  verified = false,
  joined = false,
}: {
  verified?: boolean;
  joined?: boolean;
}) {
  const me = useMe();
  const membership = useCurrentMembership();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState(false);
  const announce = useAnnounce();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const titleRefs = useRef(new Map<string, HTMLHeadingElement>());
  const pendingFocus = useRef<string | null>(null);
  // Safari does not focus buttons on click, so remember the trigger explicitly for focus return.
  const deleteTrigger = useRef<HTMLElement | null>(null);

  const read = useCallback(() => {
    const result = listDrafts();
    setLoad(
      result.ok ? { state: 'ready', items: result.items, now: Date.now() } : { state: 'error' },
    );
  }, []);

  useEffect(() => {
    // Reads browser storage once after mount; there is no server data on this screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    read();
  }, [read]);

  // After a delete, move focus to the next card's title, else the section heading.
  useEffect(() => {
    if (pendingFocus.current === null || load.state !== 'ready') return;
    const id = pendingFocus.current;
    pendingFocus.current = null;
    (titleRefs.current.get(id) ?? listHeadingRef.current ?? headingRef.current)?.focus();
  }, [load]);

  const items = load.state === 'ready' ? load.items : [];
  const drafts = items.flatMap((item) => (item.kind === 'draft' ? [item.draft] : []));
  const upNext = pickUpNext(drafts, load.state === 'ready' ? load.now : 0);

  const confirmDelete = () => {
    if (!confirm || load.state !== 'ready') return;
    const index = load.items.findIndex(
      (item) => (item.kind === 'draft' ? item.draft.id : item.id) === confirm.id,
    );
    const result = deleteDraft(confirm.id);
    setConfirm(null);
    if (!result.ok) {
      setDeleteError(true);
      return;
    }
    setDeleteError(false);
    const remaining = load.items.filter((_, i) => i !== index);
    const next = remaining[index] ?? remaining[index - 1];
    // '' means no card is left: focus falls back to the section heading, then the page heading.
    pendingFocus.current = next ? (next.kind === 'draft' ? next.draft.id : next.id) : '';
    announce('Draft deleted');
    read();
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-heading text-[30px] leading-9 font-extrabold tracking-tight text-ff-ink md:text-[40px] md:leading-[46px]"
        >
          Your Fridays
        </h1>
        <p className="mt-1 text-ff-muted">
          {membership ? (
            <>
              Signed in to <strong>{membership.org.name}</strong>.{' '}
            </>
          ) : null}
          Plans you save appear here. They live on this device only.
        </p>
      </header>

      {joined && membership && (
        <Notice tone="success" announce title={`You joined ${membership.org.name}`}>
          You can now see its members and teams.
        </Notice>
      )}

      {verified && !me.needsEmailVerification && (
        <Notice tone="success" announce title="Email verified">
          Thanks. Your email address is now verified.
        </Notice>
      )}

      <VerifyEmailNotice />

      {me.memberships.length === 0 && <OnboardingCard />}

      <LiveEntry />

      <Notice tone="info" title="Drafts stay on this device">
        Your plans are not shared with your organisation yet. Sharing arrives in a later release.
      </Notice>

      {deleteError && (
        <ErrorState
          announce="alert"
          headingLevel={2}
          title="We couldn't delete that draft"
          body="Your browser may be blocking storage. Nothing was changed."
        />
      )}

      {load.state === 'loading' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton variant="card" count={2} label="Loading your drafts..." />
        </div>
      )}

      {load.state === 'error' && (
        <ErrorState
          title="We couldn't read your drafts"
          body="Your browser may be blocking storage, for example in private mode. You can still plan an event, but saving may not work."
          onRetry={read}
          retryLabel="Try again"
          className="max-w-2xl"
        />
      )}

      {load.state === 'error' && (
        <div>
          <AppLinkButton href="/app/events/new">Plan a FunFriday</AppLinkButton>
        </div>
      )}

      {load.state === 'ready' && items.length === 0 && (
        <EmptyState
          illustration={<EmptyMotif />}
          title="No plans yet. Let's make Friday worth looking forward to."
          body="Plan a short session in a few minutes. You'll choose a time, who it's for and which activities to include."
          primaryAction={<AppLinkButton href="/app/events/new">Plan a FunFriday</AppLinkButton>}
          secondaryAction={
            <AppLinkButton href="/app/library" variant="secondary">
              Explore activities
            </AppLinkButton>
          }
        />
      )}

      {load.state === 'ready' && upNext && (
        <Card
          tone="brand"
          as="section"
          aria-labelledby="up-next-title"
          className="md:flex-row md:items-center md:justify-between"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-xs leading-4 font-semibold tracking-wide text-ff-violet-700 uppercase">
              Up next
            </p>
            <h2
              id="up-next-title"
              className="font-heading text-[22px] leading-[30px] font-bold text-ff-ink"
            >
              {draftTitle(upNext)}
            </h2>
            <p className="text-ff-ink">{whenText(upNext)}</p>
            <p className="ff-tnum text-ff-ink">
              {(upNext.activities ?? []).length}{' '}
              {(upNext.activities ?? []).length === 1 ? 'activity' : 'activities'} -{' '}
              {runtimeText(upNext)}
            </p>
          </div>
          <div>
            <AppLinkButton href={`/app/events/new?draft=${encodeURIComponent(upNext.id)}`}>
              <span>Continue editing</span>
              <span className="sr-only"> {draftTitle(upNext)}</span>
            </AppLinkButton>
          </div>
        </Card>
      )}

      {load.state === 'ready' && items.length > 0 && (
        <section aria-labelledby="drafts-heading">
          <h2
            ref={listHeadingRef}
            tabIndex={-1}
            id="drafts-heading"
            className="font-heading text-[22px] leading-[30px] font-bold text-ff-ink"
          >
            Drafts on this device ({items.length})
          </h2>
          <p className="mt-1 text-sm text-ff-muted">
            Drafts are saved in this browser only and are not shared with your organisation.
            Clearing your browser data will remove them.
          </p>
          <ul className="mt-4 grid gap-4 lg:grid-cols-2">
            {items.map((item) => {
              if (item.kind === 'corrupt') {
                return (
                  <li key={item.id}>
                    <Card className="h-full">
                      <h3
                        ref={(el) => {
                          if (el) titleRefs.current.set(item.id, el);
                          else titleRefs.current.delete(item.id);
                        }}
                        tabIndex={-1}
                        className="font-heading text-lg font-bold text-ff-ink"
                      >
                        This draft can&apos;t be opened
                      </h3>
                      <p className="text-ff-muted">
                        It may have been damaged. You can remove it from this device.
                      </p>
                      <div>
                        <Button
                          variant="ghost"
                          className="text-ff-coral-700! hover:bg-ff-coral-50"
                          iconStart={<Trash2 />}
                          onClick={(event) => {
                            deleteTrigger.current = event.currentTarget;
                            setConfirm({ id: item.id, name: 'This damaged draft' });
                          }}
                        >
                          Delete<span className="sr-only"> damaged draft</span>
                        </Button>
                      </div>
                    </Card>
                  </li>
                );
              }
              const draft = item.draft;
              const name = draftTitle(draft);
              return (
                <li key={draft.id}>
                  <Card className="h-full">
                    <div className="flex items-start justify-between gap-3">
                      <h3
                        ref={(el) => {
                          if (el) titleRefs.current.set(draft.id, el);
                          else titleRefs.current.delete(draft.id);
                        }}
                        tabIndex={-1}
                        className="font-heading text-lg font-bold text-ff-ink"
                      >
                        {name}
                      </h3>
                      <Badge tone="neutral">Draft - this device</Badge>
                    </div>
                    <ul className="flex flex-col gap-1.5 text-ff-ink">
                      <li className="flex items-center gap-2">
                        <Calendar aria-hidden="true" className="size-4 shrink-0 text-ff-muted" />
                        {whenText(draft)}
                      </li>
                      <li className="flex items-center gap-2">
                        <Users aria-hidden="true" className="size-4 shrink-0 text-ff-muted" />
                        {draft.expectedParticipants !== undefined
                          ? `${draft.expectedParticipants} expected`
                          : 'Group size not set'}
                      </li>
                      <li className="ff-tnum flex items-center gap-2">
                        <Clock aria-hidden="true" className="size-4 shrink-0 text-ff-muted" />
                        {runtimeText(draft)}
                      </li>
                    </ul>
                    <div className="mt-auto flex flex-wrap gap-3 pt-2">
                      <AppLinkButton
                        variant="secondary"
                        href={`/app/events/new?draft=${encodeURIComponent(draft.id)}`}
                      >
                        <span>Continue editing</span>
                        <span className="sr-only"> {name}</span>
                      </AppLinkButton>
                      <Button
                        variant="ghost"
                        className="text-ff-coral-700! hover:bg-ff-coral-50"
                        iconStart={<Trash2 />}
                        aria-label={`Delete draft ${name}`}
                        onClick={(event) => {
                          deleteTrigger.current = event.currentTarget;
                          setConfirm({ id: draft.id, name });
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Dialog
        open={confirm !== null}
        onClose={() => {
          setConfirm(null);
        }}
        returnFocusRef={deleteTrigger}
        title="Delete this draft?"
        description={`${confirm?.name ?? 'This draft'} will be removed from this device. This can't be undone.`}
        actions={
          <>
            <Button
              variant="secondary"
              data-autofocus
              onClick={() => {
                setConfirm(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Delete draft
            </Button>
          </>
        }
      />
    </div>
  );
}
