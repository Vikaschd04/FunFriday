import { Check } from 'lucide-react';
import { EVENT_LIMITS, type ActivitySummary, type PlanNotice } from '@funfriday/contracts';
import {
  Badge,
  Button,
  ErrorState,
  InDevelopmentBadge,
  Notice,
  NumberField,
  ReorderList,
  RuntimeMeter,
  Skeleton,
} from '@funfriday/ui';
import { TRANSITION_MINUTES_PER_ACTIVITY } from '@funfriday/contracts';
import { CATEGORY_SINGULAR } from '@/lib/library-filters';
import type { FieldErrors, FormValues } from '@/lib/builder-model';
import type { CatalogState } from '../use-catalog';
import { PlanNotices } from './plan-notices';

interface Props {
  values: FormValues;
  catalog: CatalogState;
  errors: FieldErrors;
  notices: readonly PlanNotice[];
  activityMinutes: number;
  bufferMinutes: number;
  nameOf: (slug: string) => string;
  onToggle: (activity: ActivitySummary) => void;
  onMove: (slug: string, toIndex: number) => void;
  onRemove: (slug: string) => void;
  onMinutes: (slug: string, minutes: number | null) => void;
  onBlurMinutes: (slug: string) => void;
  onRetry: () => void;
  playlistHeadingRef: React.Ref<HTMLHeadingElement>;
  playlistRef: React.Ref<HTMLDivElement>;
}

export function StepActivities({
  values,
  catalog,
  errors,
  notices,
  activityMinutes,
  bufferMinutes,
  nameOf,
  onToggle,
  onMove,
  onRemove,
  onMinutes,
  onBlurMinutes,
  onRetry,
  playlistHeadingRef,
  playlistRef,
}: Props) {
  const atLimit = values.activities.length >= EVENT_LIMITS.activitiesMax;
  const rowNotices = (slug: string) =>
    notices.filter(
      (n) =>
        'slug' in n &&
        n.slug === slug &&
        (n.kind === 'group_too_small' || n.kind === 'group_too_large'),
    );
  const availabilityOf = (slug: string) =>
    catalog.status === 'ready'
      ? catalog.activities.find((a) => a.slug === slug)?.availability
      : undefined;
  const planLevel = notices.filter(
    (n) =>
      n.kind === 'over_time' ||
      n.kind === 'tight_transitions' ||
      n.kind === 'unknown_activity' ||
      n.kind === 'not_playable_yet',
  );

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="playlist-heading" className="flex flex-col gap-4">
        <h3
          id="playlist-heading"
          ref={playlistHeadingRef}
          tabIndex={-1}
          className="font-heading text-xl leading-7 font-bold text-ff-ink"
        >
          Your playlist ({values.activities.length})
        </h3>
        {values.activities.length === 0 && (
          <p className="text-ff-muted">
            Nothing here yet. Add up to {EVENT_LIMITS.activitiesMax} activities from the list below.
          </p>
        )}
        <div ref={playlistRef}>
          {values.activities.length > 0 && (
            <ReorderList
              aria-label="Playlist"
              items={values.activities.map((a) => ({
                id: a.slug,
                label: nameOf(a.slug),
                minutes: a.minutes,
              }))}
              onMove={onMove}
              onRemove={onRemove}
              renderItem={(item, index) => (
                <div className="flex flex-col gap-2">
                  <p className="font-semibold text-ff-ink">
                    <span className="ff-tnum text-ff-muted">{index + 1}. </span>
                    {item.label}
                  </p>
                  {availabilityOf(item.id) !== undefined &&
                    availabilityOf(item.id) !== 'enabled' && (
                      <div>
                        <InDevelopmentBadge />
                      </div>
                    )}
                  <div className="max-w-52">
                    <NumberField
                      id={`field-minutes-${item.id}`}
                      label={`Minutes for ${item.label}`}
                      value={item.minutes}
                      min={EVENT_LIMITS.activityMinutesMin}
                      max={EVENT_LIMITS.activityMinutesMax}
                      error={errors[`minutes:${item.id}`]}
                      onValueChange={(minutes) => {
                        onMinutes(item.id, minutes);
                      }}
                      onBlur={() => {
                        onBlurMinutes(item.id);
                      }}
                    />
                  </div>
                  {rowNotices(item.id).map((n) => (
                    <PlanNotices
                      key={n.kind}
                      notices={[n]}
                      nameOf={nameOf}
                      bufferMinutes={bufferMinutes}
                    />
                  ))}
                </div>
              )}
            />
          )}
        </div>
        {values.durationMinutes !== null && (
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
        <PlanNotices notices={planLevel} nameOf={nameOf} bufferMinutes={bufferMinutes} />
        {errors.activities && <p className="font-medium text-ff-coral-700">{errors.activities}</p>}
      </section>

      <section
        id="field-activities"
        tabIndex={-1}
        aria-labelledby="picker-heading"
        className="flex flex-col gap-4 outline-offset-4"
      >
        <h3 id="picker-heading" className="font-heading text-xl leading-7 font-bold text-ff-ink">
          Pick activities
        </h3>
        {atLimit && (
          <Notice tone="info">
            You&apos;ve added {EVENT_LIMITS.activitiesMax} activities, the most one plan holds.
          </Notice>
        )}
        {catalog.status === 'loading' && (
          <Skeleton variant="block" count={3} label="Loading activities..." />
        )}
        {catalog.status === 'error' && (
          <ErrorState
            headingLevel={4}
            title="We couldn't load the activities"
            body="The activity list didn't come through. Steps 1 and 2 still work. Try again."
            onRetry={onRetry}
            retryLabel="Try again"
          />
        )}
        {catalog.status === 'ready' && (
          <ul className="flex flex-col gap-3">
            {catalog.activities.map((activity) => {
              const added = values.activities.some((a) => a.slug === activity.slug);
              return (
                <PickerRow
                  key={activity.slug}
                  activity={activity}
                  added={added}
                  blocked={atLimit && !added}
                  onToggle={() => {
                    onToggle(activity);
                  }}
                />
              );
            })}
          </ul>
        )}
        {catalog.status === 'ready' && catalog.activities.length === 0 && (
          <p className="text-ff-muted">No activities yet. Check back soon.</p>
        )}
      </section>
    </div>
  );
}

function PickerRow({
  activity,
  added,
  blocked,
  onToggle,
}: {
  activity: ActivitySummary;
  added: boolean;
  blocked: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-ff-card bg-ff-surface p-4 shadow-ff-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold text-ff-ink">{activity.name}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ff-muted">
          <span>{CATEGORY_SINGULAR[activity.category]}</span>
          <span className="ff-tnum">
            {activity.minPlayers}-{activity.maxPlayers} players
          </span>
          <span className="ff-tnum">
            Suggested {activity.estimatedMinutes.min}-{activity.estimatedMinutes.max} min
          </span>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {activity.availability === 'enabled' ? (
            <Badge tone="success">Ready to play</Badge>
          ) : (
            <Badge tone="neutral">In development</Badge>
          )}
          {added && (
            <Badge tone="brand" icon={<Check />}>
              Added
            </Badge>
          )}
        </div>
      </div>
      <Button
        variant={added ? 'secondary' : 'primary'}
        disabled={blocked}
        onClick={onToggle}
        aria-label={`${added ? 'Remove' : 'Add'} ${activity.name}`}
      >
        {added ? 'Remove' : 'Add'}
      </Button>
    </li>
  );
}
