import { CircleCheck, Clock, Hammer, Tag, Users } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { ActivitySummary } from '@funfriday/contracts';
import { Badge, Card } from '@funfriday/ui';
import { CATEGORY_SINGULAR } from '@/lib/library-filters';
import { AppLinkButton } from './app-link-button';
import { ActivityMotif, CATEGORY_PANEL } from './motifs';

export function ActivityCard({
  activity,
  capacityHint,
  index,
}: {
  activity: ActivitySummary;
  capacityHint: string | null;
  index: number;
}) {
  const ready = activity.availability === 'enabled';
  return (
    <li className="ff-enter flex" style={{ '--ff-i': Math.min(index, 8) } as CSSProperties}>
      <Card
        as="article"
        aria-labelledby={`activity-${activity.slug}`}
        className="w-full min-h-[280px] p-0! md:p-0!"
      >
        <div
          className={`h-[120px] overflow-hidden rounded-t-ff-card ${CATEGORY_PANEL[activity.category]}`}
        >
          <ActivityMotif slug={activity.slug} category={activity.category} />
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4 pt-0 md:p-6 md:pt-0">
          <div className="flex flex-wrap gap-2">
            {ready ? (
              <Badge tone="success" icon={<CircleCheck />}>
                Ready to play
              </Badge>
            ) : (
              <Badge tone="neutral" icon={<Hammer />}>
                In development
              </Badge>
            )}
          </div>
          <h3
            id={`activity-${activity.slug}`}
            className="font-heading text-[22px] leading-[30px] font-bold text-ff-ink"
          >
            {activity.name}
          </h3>
          <p className="text-ff-muted">{activity.summary}</p>
          <ul className="flex flex-col gap-1.5 text-sm text-ff-ink">
            <li className="flex items-center gap-2">
              <Users aria-hidden="true" className="size-4 shrink-0 text-ff-muted" />
              <span className="ff-tnum">
                {activity.minPlayers}-{activity.maxPlayers} players
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Clock aria-hidden="true" className="size-4 shrink-0 text-ff-muted" />
              <span className="ff-tnum">
                {activity.estimatedMinutes.min}-{activity.estimatedMinutes.max} min
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Tag aria-hidden="true" className="size-4 shrink-0 text-ff-muted" />
              {CATEGORY_SINGULAR[activity.category]}
            </li>
          </ul>
          {capacityHint && <p className="text-sm font-semibold text-ff-ink">{capacityHint}</p>}
          <div className="mt-auto pt-2">
            <AppLinkButton
              variant="secondary"
              href={`/app/events/new?activity=${encodeURIComponent(activity.slug)}`}
            >
              <span>Plan with this activity</span>
              <span className="sr-only">for {activity.name}</span>
            </AppLinkButton>
          </div>
        </div>
      </Card>
    </li>
  );
}
