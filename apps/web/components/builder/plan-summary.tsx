import type { PlanNotice } from '@funfriday/contracts';
import { RuntimeMeter } from '@funfriday/ui';
import { TRANSITION_MINUTES_PER_ACTIVITY } from '@funfriday/contracts';
import { formatWallTime } from '@/lib/time-format';
import { startsAtLocal, type FormValues } from '@/lib/builder-model';
import { PlanNotices } from './plan-notices';

export function PlanSummary({
  values,
  nameOf,
  activityMinutes,
  bufferMinutes,
  notices,
  showMeter,
  review = false,
}: {
  values: FormValues;
  nameOf: (slug: string) => string;
  activityMinutes: number;
  bufferMinutes: number;
  notices: readonly PlanNotice[];
  showMeter: boolean;
  /** On the Review step the main column already shows title/when/group: show only the budget. */
  review?: boolean;
}) {
  const when = formatWallTime(startsAtLocal(values));
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-heading text-lg font-bold text-ff-ink">
        {review ? 'Time budget' : 'Your plan'}
      </h2>
      {!review && (
        <dl className="flex flex-col gap-2 text-sm">
          <div>
            <dt className="text-ff-muted">Title</dt>
            <dd className="font-semibold text-ff-ink">{values.title.trim() || 'Not set yet'}</dd>
          </div>
          <div>
            <dt className="text-ff-muted">When</dt>
            <dd className="font-semibold text-ff-ink">
              {when ? `${when} (${values.timeZone})` : 'Not set yet'}
            </dd>
          </div>
          <div>
            <dt className="text-ff-muted">Group</dt>
            <dd className="font-semibold text-ff-ink">
              {values.expectedParticipants === null
                ? 'Not set yet'
                : `${values.expectedParticipants} people expected`}
            </dd>
          </div>
        </dl>
      )}
      {showMeter && values.durationMinutes !== null && (
        <RuntimeMeter
          eventMinutes={values.durationMinutes}
          activityMinutes={activityMinutes}
          bufferMinutes={values.activities.length * TRANSITION_MINUTES_PER_ACTIVITY}
          segments={values.activities.map((a) => ({
            slug: a.slug,
            label: nameOf(a.slug),
            minutes: a.minutes ?? 0,
          }))}
        />
      )}
      {review && values.activities.length > 0 && (
        <ul className="flex flex-col divide-y divide-ff-border text-sm">
          {values.activities.map((a) => (
            <li key={a.slug} className="flex items-center justify-between gap-3 py-2">
              <span className="font-semibold text-ff-ink">{nameOf(a.slug)}</span>
              <span className="ff-tnum text-ff-muted">{a.minutes ?? 0} min</span>
            </li>
          ))}
        </ul>
      )}
      <PlanNotices notices={notices} nameOf={nameOf} bufferMinutes={bufferMinutes} />
    </div>
  );
}
