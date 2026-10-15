import type { ActivitySummary } from '../activities/activity.js';
import type { EventDraft } from './draft.js';

/** Minutes to budget per activity for intros and transitions (docs/USER_JOURNEYS.md demo session). */
export const TRANSITION_MINUTES_PER_ACTIVITY = 2;

export type PlanNotice =
  | { kind: 'over_time'; severity: 'warning'; overByMinutes: number }
  | { kind: 'tight_transitions'; severity: 'info'; suggestedBufferMinutes: number }
  | { kind: 'group_too_small'; severity: 'warning'; slug: string; minPlayers: number }
  | { kind: 'group_too_large'; severity: 'warning'; slug: string; maxPlayers: number }
  | { kind: 'not_playable_yet'; severity: 'info'; slug: string }
  | { kind: 'unknown_activity'; severity: 'warning'; slug: string };

export interface PlanReview {
  activityMinutes: number;
  bufferMinutes: number;
  notices: PlanNotice[];
}

/**
 * Pure planning review shared by the browser (instant feedback) and, from P3,
 * the API (authoritative check). Never throws; unknown slugs become notices.
 */
export function reviewEventPlan(
  draft: Pick<EventDraft, 'durationMinutes' | 'expectedParticipants' | 'activities'>,
  catalog: readonly ActivitySummary[],
): PlanReview {
  const bySlug = new Map(catalog.map((activity) => [activity.slug, activity]));
  const activityMinutes = draft.activities.reduce((sum, item) => sum + item.minutes, 0);
  const bufferMinutes = draft.durationMinutes - activityMinutes;
  const notices: PlanNotice[] = [];

  if (bufferMinutes < 0) {
    notices.push({ kind: 'over_time', severity: 'warning', overByMinutes: -bufferMinutes });
  } else {
    const suggested = draft.activities.length * TRANSITION_MINUTES_PER_ACTIVITY;
    if (draft.activities.length > 0 && bufferMinutes < suggested) {
      notices.push({
        kind: 'tight_transitions',
        severity: 'info',
        suggestedBufferMinutes: suggested,
      });
    }
  }

  for (const item of draft.activities) {
    const activity = bySlug.get(item.slug);
    if (!activity) {
      notices.push({ kind: 'unknown_activity', severity: 'warning', slug: item.slug });
      continue;
    }
    if (draft.expectedParticipants < activity.minPlayers) {
      notices.push({
        kind: 'group_too_small',
        severity: 'warning',
        slug: item.slug,
        minPlayers: activity.minPlayers,
      });
    }
    if (draft.expectedParticipants > activity.maxPlayers) {
      notices.push({
        kind: 'group_too_large',
        severity: 'warning',
        slug: item.slug,
        maxPlayers: activity.maxPlayers,
      });
    }
    if (activity.availability !== 'enabled') {
      notices.push({ kind: 'not_playable_yet', severity: 'info', slug: item.slug });
    }
  }

  return { activityMinutes, bufferMinutes, notices };
}
