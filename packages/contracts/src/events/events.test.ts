import { describe, expect, it } from 'vitest';
import type { ActivitySummary } from '../activities/activity.js';
import { activityListResponseSchema } from '../activities/activity.js';
import { eventDraftSchema, type EventDraftInput } from './draft.js';
import { reviewEventPlan } from './plan.js';

const catalog: ActivitySummary[] = [
  {
    slug: 'this-or-that',
    name: 'This or That',
    summary: 'Polls',
    category: 'icebreaker',
    minPlayers: 2,
    maxPlayers: 200,
    estimatedMinutes: { min: 3, max: 8 },
    availability: 'planned',
  },
  {
    slug: 'sketch-and-guess',
    name: 'Sketch & Guess',
    summary: 'Draw',
    category: 'creative',
    minPlayers: 3,
    maxPlayers: 12,
    estimatedMinutes: { min: 8, max: 20 },
    availability: 'enabled',
  },
];

const valid: EventDraftInput = {
  title: '  Friday Fun Hour  ',
  startsAtLocal: '2026-10-16T16:00',
  timeZone: 'Asia/Kolkata',
  durationMinutes: 30,
  expectedParticipants: 20,
  activities: [{ slug: 'this-or-that', minutes: 8 }],
};

const messagesFor = (input: unknown, field: string) => {
  const result = eventDraftSchema.safeParse(input);
  return result.success
    ? []
    : result.error.issues.filter((issue) => issue.path[0] === field).map((issue) => issue.message);
};

describe('eventDraftSchema', () => {
  it('accepts a valid draft, trims the title and defaults the meeting link', () => {
    const draft = eventDraftSchema.parse(valid);
    expect(draft.title).toBe('Friday Fun Hour');
    expect(draft.meetingUrl).toBe('');
  });

  it('gives field-level, human-readable errors', () => {
    expect(messagesFor({ ...valid, title: 'Hi' }, 'title')[0]).toMatch(/at least 3/);
    expect(messagesFor({ ...valid, activities: [] }, 'activities')[0]).toMatch(/at least one/);
    expect(messagesFor({ ...valid, durationMinutes: 5 }, 'durationMinutes')[0]).toMatch(
      /at least 15/,
    );
    expect(messagesFor({ ...valid, timeZone: 'Nowhere/Land' }, 'timeZone')[0]).toMatch(
      /valid time zone/,
    );
  });

  it('only allows https meeting links', () => {
    expect(
      messagesFor({ ...valid, meetingUrl: 'http://meet.example.com/x' }, 'meetingUrl'),
    ).not.toEqual([]);
    expect(messagesFor({ ...valid, meetingUrl: 'javascript:alert(1)' }, 'meetingUrl')).not.toEqual(
      [],
    );
    expect(
      messagesFor({ ...valid, meetingUrl: 'https://meet.example.com/x' }, 'meetingUrl'),
    ).toEqual([]);
  });

  it('rejects duplicate activities', () => {
    const input = { ...valid, activities: [valid.activities[0], valid.activities[0]] };
    expect(messagesFor(input, 'activities')[0]).toMatch(/only appear once/);
  });

  it('rejects start times skipped by a DST change', () => {
    const input = { ...valid, startsAtLocal: '2026-03-08T02:30', timeZone: 'America/New_York' };
    expect(messagesFor(input, 'startsAtLocal')[0]).toMatch(/skipped when clocks change/);
  });
});

describe('reviewEventPlan', () => {
  it('computes the time budget and suggests transition buffer', () => {
    const review = reviewEventPlan(
      {
        durationMinutes: 30,
        expectedParticipants: 20,
        activities: [{ slug: 'this-or-that', minutes: 29 }],
      },
      catalog,
    );
    expect(review.activityMinutes).toBe(29);
    expect(review.bufferMinutes).toBe(1);
    expect(review.notices).toContainEqual({
      kind: 'tight_transitions',
      severity: 'info',
      suggestedBufferMinutes: 2,
    });
  });

  it('warns when the playlist runs over the event length', () => {
    const review = reviewEventPlan(
      {
        durationMinutes: 20,
        expectedParticipants: 6,
        activities: [
          { slug: 'this-or-that', minutes: 10 },
          { slug: 'sketch-and-guess', minutes: 15 },
        ],
      },
      catalog,
    );
    expect(review.notices).toContainEqual({
      kind: 'over_time',
      severity: 'warning',
      overByMinutes: 5,
    });
  });

  it('flags capacity mismatches, planned activities and unknown slugs', () => {
    const review = reviewEventPlan(
      {
        durationMinutes: 60,
        expectedParticipants: 20,
        activities: [
          { slug: 'sketch-and-guess', minutes: 10 },
          { slug: 'this-or-that', minutes: 5 },
          { slug: 'retired-game', minutes: 5 },
        ],
      },
      catalog,
    );
    expect(review.notices).toContainEqual({
      kind: 'group_too_large',
      severity: 'warning',
      slug: 'sketch-and-guess',
      maxPlayers: 12,
    });
    expect(review.notices).toContainEqual({
      kind: 'not_playable_yet',
      severity: 'info',
      slug: 'this-or-that',
    });
    expect(review.notices).toContainEqual({
      kind: 'unknown_activity',
      severity: 'warning',
      slug: 'retired-game',
    });
  });
});

describe('activityListResponseSchema', () => {
  it('accepts the catalog shape and rejects inverted limits', () => {
    expect(activityListResponseSchema.safeParse({ activities: catalog }).success).toBe(true);
    const broken = { ...catalog[0], minPlayers: 50, maxPlayers: 2 };
    expect(activityListResponseSchema.safeParse({ activities: [broken] }).success).toBe(false);
  });
});
