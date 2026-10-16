'use client';

import { ChevronUp, Circle, CircleCheck, Crown, Users, Wifi, WifiOff, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Badge, Button, Card } from '@funfriday/ui';
import type { RoomParticipant } from '@funfriday/contracts';
import { rosterCounts, sortRoster, teammateName } from '@/lib/live/view-model';

function Row({ p, meId, showReady }: { p: RoomParticipant; meId: string; showReady: boolean }) {
  const name = teammateName(p.name);
  return (
    <li className="ff-phase flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ff-violet-50 text-sm font-bold text-ff-ink"
      >
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-[7rem] flex-1 font-semibold text-ff-ink">
        {name}
        {p.memberId === meId ? <span className="font-normal"> (you)</span> : null}
      </span>
      {p.isHost && (
        <Badge tone="brand" icon={<Crown />}>
          Host
        </Badge>
      )}
      <span
        className={`inline-flex items-center gap-1 text-sm ${p.connected ? 'font-semibold text-ff-mint-700' : 'text-ff-muted'}`}
      >
        {p.connected ? (
          <Wifi aria-hidden="true" className="size-4" />
        ) : (
          <WifiOff aria-hidden="true" className="size-4" />
        )}
        {p.connected ? 'Connected' : 'Away'}
      </span>
      {showReady && (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm ${p.ready ? 'bg-ff-mint-50 font-semibold text-ff-mint-700' : 'text-ff-muted'}`}
        >
          {p.ready ? (
            <CircleCheck aria-hidden="true" className="size-4" />
          ) : (
            <Circle aria-hidden="true" className="size-4" />
          )}
          {p.ready ? 'Ready' : 'Not ready yet'}
        </span>
      )}
    </li>
  );
}

export function RosterList({
  participants,
  meId,
  showReady,
}: {
  participants: RoomParticipant[];
  meId: string;
  showReady: boolean;
}) {
  const rows = sortRoster(participants, meId);
  const long = rows.length > 12;
  return (
    <ul
      className={`divide-y divide-ff-border ${long ? 'max-h-[480px] overflow-y-auto' : ''}`}
      {...(long ? { tabIndex: 0, 'aria-label': 'People in the room' } : {})}
    >
      {rows.map((p) => (
        <Row key={p.memberId} p={p} meId={meId} showReady={showReady} />
      ))}
    </ul>
  );
}

export function RosterCard({
  participants,
  meId,
  showReady,
  className,
}: {
  participants: RoomParticipant[];
  meId: string;
  showReady: boolean;
  className?: string;
}) {
  const counts = rosterCounts(participants);
  return (
    <Card as="section" aria-labelledby="roster-heading" className={className}>
      <div>
        <h2
          id="roster-heading"
          className="font-heading text-[22px] leading-[30px] font-bold text-ff-ink"
        >
          In the room ({counts.total})
        </h2>
        <p className="ff-tnum text-sm text-ff-muted">
          {counts.connected} connected{showReady ? `, ${counts.ready} ready` : ''}
        </p>
      </div>
      {participants.length <= 1 && showReady ? (
        <div className="rounded-ff-button bg-ff-canvas p-4">
          <p className="font-semibold text-ff-ink">Just you so far</p>
          <p className="text-sm text-ff-muted">
            Share the code above. You need at least 2 people to start.
          </p>
        </div>
      ) : null}
      <RosterList participants={participants} meId={meId} showReady={showReady} />
    </Card>
  );
}

/** Phones: a 48px bar that opens the roster as a bottom sheet (no scrim, not a trap). */
export function RosterDock({
  participants,
  meId,
  showReady,
}: {
  participants: RoomParticipant[];
  meId: string;
  showReady: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const sheetHeading = useRef<HTMLHeadingElement>(null);
  const counts = rosterCounts(participants);
  const label = showReady
    ? `${counts.total} in the room (${counts.ready} ready)`
    : `${counts.total} in the room`;
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div className="relative md:hidden">
      {open && (
        <section
          id="roster-sheet"
          aria-labelledby="roster-sheet-heading"
          onKeyDown={(e) => {
            if (e.key === 'Escape') close();
          }}
          className="ff-sheet absolute inset-x-0 bottom-full max-h-[60vh] overflow-y-auto rounded-t-[20px] bg-ff-surface p-4 shadow-ff-lg"
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              id="roster-sheet-heading"
              ref={sheetHeading}
              tabIndex={-1}
              className="font-heading text-lg font-bold text-ff-ink"
            >
              In the room ({counts.total})
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 min-w-11"
              onClick={close}
              aria-label="Close people list"
            >
              <X aria-hidden="true" className="size-5" />
            </Button>
          </div>
          <RosterList participants={participants} meId={meId} showReady={showReady} />
        </section>
      )}
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls="roster-sheet"
        onClick={() => {
          if (open) {
            close();
            return;
          }
          setOpen(true);
          requestAnimationFrame(() => sheetHeading.current?.focus());
        }}
        className="flex min-h-12 w-full items-center justify-between gap-2 border-t border-ff-border bg-ff-surface px-4 font-semibold text-ff-ink"
      >
        <span className="flex items-center gap-2">
          <Users aria-hidden="true" className="size-5" />
          {label}
        </span>
        <ChevronUp aria-hidden="true" className={`size-5 ${open ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}
