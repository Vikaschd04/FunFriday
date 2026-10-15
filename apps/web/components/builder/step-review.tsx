import type { PlanNotice } from '@funfriday/contracts';
import { Notice } from '@funfriday/ui';
import { TRANSITION_MINUTES_PER_ACTIVITY } from '@funfriday/contracts';
import { CATEGORY_DOT } from '../motifs';
import { buildAgenda, clockOf, formatCalendarDate } from '@/lib/time-format';
import { startsAtLocal, type FormValues } from '@/lib/builder-model';
import type { ActivitySummary } from '@funfriday/contracts';
import { PlanNotices } from './plan-notices';

export function StepReview({
  values,
  viewerZone,
  nameOf,
  categoryOf,
  notices,
  bufferMinutes,
}: {
  values: FormValues;
  viewerZone: string;
  nameOf: (slug: string) => string;
  categoryOf: (slug: string) => ActivitySummary['category'] | null;
  notices: readonly PlanNotice[];
  bufferMinutes: number;
}) {
  const agenda = buildAgenda(
    {
      startsAtLocal: startsAtLocal(values),
      timeZone: values.timeZone,
      durationMinutes: values.durationMinutes ?? 0,
      activities: values.activities.map((a) => ({ slug: a.slug, minutes: a.minutes ?? 0 })),
    },
    viewerZone,
    TRANSITION_MINUTES_PER_ACTIVITY,
  );

  if (!agenda.ok) {
    return (
      <Notice tone="warning">
        the start time needs fixing before the agenda can be shown. Go back to Basics.
      </Notice>
    );
  }

  const numbers = agenda.rows.reduce<number[]>((acc, row) => {
    const previous = acc.length > 0 ? (acc[acc.length - 1] ?? 0) : 0;
    acc.push(row.kind === 'activity' ? previous + 1 : previous);
    return acc;
  }, []);
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="review-summary" className="rounded-ff-card bg-ff-violet-50 p-5">
        <h3
          id="review-summary"
          className="font-heading text-[22px] leading-[30px] font-bold text-ff-ink"
        >
          {values.title.trim()}
        </h3>
        <p className="ff-tnum mt-1 text-ff-ink">
          {formatCalendarDate(agenda.eventStart)}, {clockOf(agenda.eventStart)}-
          {clockOf(agenda.eventEnd)}
        </p>
        <p className="text-ff-ink">{values.timeZone}</p>
        <p className="text-ff-ink">{values.expectedParticipants} people expected</p>
        <dl className="mt-3 flex flex-col gap-1 text-sm">
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-ff-muted">Your time zone:</dt>
            <dd className="ff-tnum font-semibold text-ff-ink">
              {clockOf(agenda.eventStart)} {values.timeZone}
            </dd>
          </div>
          {agenda.viewerEventStart && (
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-ff-muted">In your browser&apos;s zone:</dt>
              <dd className="ff-tnum font-semibold text-ff-ink">
                {clockOf(agenda.viewerEventStart)} {viewerZone}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {(agenda.nearClockChange || agenda.ambiguous) && (
        <Notice tone="warning">
          clocks change in this time zone around that time. Check the start time is the one you
          mean.
        </Notice>
      )}

      <section aria-labelledby="agenda-heading">
        <h3 id="agenda-heading" className="font-heading text-xl leading-7 font-bold text-ff-ink">
          Agenda
        </h3>
        <ol className="relative mt-4 flex flex-col gap-3 border-l-2 border-dotted border-ff-border-strong pl-6">
          {agenda.rows.map((row, index) => {
            if (row.kind === 'transition') {
              return (
                <li key={`t-${index}`} className="ff-tnum text-sm text-ff-muted">
                  <span className="font-semibold">Transition</span> ({row.minutes} min) -{' '}
                  {clockOf(row.start)}-{clockOf(row.end)}
                </li>
              );
            }
            const category = row.slug ? categoryOf(row.slug) : null;
            return (
              <li
                key={`a-${index}`}
                className="relative rounded-ff-button bg-ff-surface p-3 shadow-ff-sm"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-3 -left-[41px] grid size-6 place-items-center rounded-full bg-ff-violet-700 text-xs font-bold text-white ring-2 ring-ff-canvas"
                >
                  {numbers[index]}
                </span>
                <p className="flex items-center gap-2 font-semibold text-ff-ink">
                  <span
                    aria-hidden="true"
                    className={`size-2.5 shrink-0 rounded-full ${category ? CATEGORY_DOT[category] : 'bg-ff-border'}`}
                  />
                  {row.slug ? nameOf(row.slug) : ''}
                </p>
                <p className="ff-tnum text-sm text-ff-muted">
                  {clockOf(row.start)}-{clockOf(row.end)} ({row.minutes} min)
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      <PlanNotices notices={notices} nameOf={nameOf} bufferMinutes={bufferMinutes} />
    </div>
  );
}
