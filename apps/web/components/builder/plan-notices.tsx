import type { PlanNotice } from '@funfriday/contracts';
import { Notice } from '@funfriday/ui';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Copy for each notice kind (docs/design/P1_SCREENS.md 3.5a). The warning prefix comes from Notice. */
export function noticeText(
  notice: PlanNotice,
  nameOf: (slug: string) => string,
  bufferMinutes: number,
): string {
  switch (notice.kind) {
    case 'over_time':
      return `your activities run ${plural(notice.overByMinutes, 'minute')} over the event length. Shorten an activity or extend the event.`;
    case 'tight_transitions':
      return `Good to know: leave about ${plural(notice.suggestedBufferMinutes, 'minute')} for introductions and switching between activities. You have ${plural(Math.max(0, bufferMinutes), 'minute')}.`;
    case 'group_too_small':
      return `${nameOf(notice.slug)} works best with at least ${notice.minPlayers} people.`;
    case 'group_too_large':
      return `${nameOf(notice.slug)} is built for up to ${notice.maxPlayers} people. Consider splitting into teams later.`;
    case 'not_playable_yet':
      return developmentText([nameOf(notice.slug)]);
    case 'unknown_activity':
      return 'an activity in this draft is no longer in the catalog. Remove it to continue.';
  }
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`;
}

/** One combined notice for every activity that is not playable yet. */
export function developmentText(names: readonly string[]): string {
  const many = names.length > 1;
  return `${joinNames(names)} ${many ? 'are' : 'is'} still in development, so ${many ? 'they' : 'it'} can't run yet. You can keep ${many ? 'them' : 'it'} in your plan.`;
}

export function PlanNotices({
  notices,
  nameOf,
  bufferMinutes,
}: {
  notices: readonly PlanNotice[];
  nameOf: (slug: string) => string;
  bufferMinutes: number;
}) {
  if (notices.length === 0) return null;
  const inDevelopment = notices.flatMap((n) =>
    n.kind === 'not_playable_yet' ? [nameOf(n.slug)] : [],
  );
  const rest = notices.filter((n) => n.kind !== 'not_playable_yet');
  return (
    <ul className="flex flex-col gap-3" aria-label="Plan notices">
      {inDevelopment.length > 0 && (
        <li>
          <Notice tone="info">{developmentText(inDevelopment)}</Notice>
        </li>
      )}
      {rest.map((notice, index) => (
        <li key={`${notice.kind}-${'slug' in notice ? notice.slug : index}`}>
          <Notice tone={notice.severity}>{noticeText(notice, nameOf, bufferMinutes)}</Notice>
        </li>
      ))}
    </ul>
  );
}
