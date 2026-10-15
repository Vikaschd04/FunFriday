import { EVENT_LIMITS, eventDraftSchema, type ActivitySummary } from '@funfriday/contracts';
import type { DraftInput, StoredDraft } from './drafts';

export const STEP_IDS = ['basics', 'participants', 'activities', 'review'] as const;
export type StepId = (typeof STEP_IDS)[number];
export const STEP_LABELS: Record<StepId, string> = {
  basics: 'Basics',
  participants: 'Participants',
  activities: 'Activities',
  review: 'Review',
};

export interface PlaylistItem {
  slug: string;
  /** null while the planner clears the field to type a new number. */
  minutes: number | null;
}

/** Editable form state. Strings/nulls mirror what people type; contracts decide validity. */
export interface FormValues {
  title: string;
  date: string;
  time: string;
  timeZone: string;
  durationMinutes: number | null;
  meetingUrl: string;
  expectedParticipants: number | null;
  activities: PlaylistItem[];
}

export const DEFAULT_DURATION = 45;
export const DEFAULT_PARTICIPANTS = 20;

export function emptyForm(timeZone: string): FormValues {
  return {
    title: '',
    date: '',
    time: '',
    timeZone,
    durationMinutes: DEFAULT_DURATION,
    meetingUrl: '',
    expectedParticipants: DEFAULT_PARTICIPANTS,
    activities: [],
  };
}

export function formFromDraft(draft: StoredDraft, fallbackZone: string): FormValues {
  const [date = '', time = ''] = (draft.startsAtLocal ?? '').split('T');
  return {
    title: draft.title ?? '',
    date,
    time,
    timeZone: draft.timeZone ?? fallbackZone,
    durationMinutes: draft.durationMinutes ?? DEFAULT_DURATION,
    meetingUrl: draft.meetingUrl ?? '',
    expectedParticipants: draft.expectedParticipants ?? DEFAULT_PARTICIPANTS,
    activities: (draft.activities ?? []).map((a) => ({ slug: a.slug, minutes: a.minutes })),
  };
}

export function startsAtLocal(values: FormValues): string {
  return values.date !== '' && values.time !== '' ? `${values.date}T${values.time}` : '';
}

/** What is persisted: only fields that carry a value, so partial drafts stay partial. */
export function draftFromForm(values: FormValues): DraftInput {
  const input: DraftInput = {
    title: values.title,
    timeZone: values.timeZone,
    meetingUrl: values.meetingUrl,
  };
  const starts = startsAtLocal(values);
  if (starts !== '') input.startsAtLocal = starts;
  if (values.durationMinutes !== null) input.durationMinutes = values.durationMinutes;
  if (values.expectedParticipants !== null)
    input.expectedParticipants = values.expectedParticipants;
  input.activities = values.activities.flatMap((a) =>
    a.minutes === null ? [] : [{ slug: a.slug, minutes: a.minutes }],
  );
  return input;
}

/** Stable string used to detect unsaved changes. */
export function snapshot(values: FormValues): string {
  return JSON.stringify(values);
}

/** Rounded midpoint of the suggested range, clamped to the per-activity limits. */
export function defaultMinutes(activity: ActivitySummary): number {
  const mid = Math.round((activity.estimatedMinutes.min + activity.estimatedMinutes.max) / 2);
  return Math.min(EVENT_LIMITS.activityMinutesMax, Math.max(EVENT_LIMITS.activityMinutesMin, mid));
}

export type FieldKey =
  | 'title'
  | 'startsAtLocal'
  | 'timeZone'
  | 'durationMinutes'
  | 'meetingUrl'
  | 'expectedParticipants'
  | 'activities'
  | `minutes:${string}`;

export type FieldErrors = Partial<Record<FieldKey, string>>;

const STEP_FIELDS: Record<'basics' | 'participants' | 'activities', readonly string[]> = {
  basics: ['title', 'startsAtLocal', 'timeZone', 'durationMinutes', 'meetingUrl'],
  participants: ['expectedParticipants'],
  activities: ['activities'],
};

const PLACEHOLDER = {
  title: 'Placeholder title',
  startsAtLocal: '2030-01-01T10:00',
  timeZone: 'UTC',
  durationMinutes: 60,
  expectedParticipants: 10,
  meetingUrl: '',
  activities: [{ slug: 'placeholder', minutes: 10 }],
};

/**
 * Validates one step with the shared contract. Fields from other steps are replaced by valid
 * placeholders so cross-field refinements (like a skipped wall-clock time) still run.
 * Messages come from the contract verbatim; only "empty number" cases have local copy.
 */
export function validateStep(
  step: 'basics' | 'participants' | 'activities',
  values: FormValues,
): FieldErrors {
  const errors: FieldErrors = {};
  const candidate: Record<string, unknown> = { ...PLACEHOLDER };
  const own = STEP_FIELDS[step];
  const assign = (key: string, value: unknown) => {
    if (own.includes(key)) candidate[key] = value;
  };

  assign('title', values.title);
  assign('startsAtLocal', startsAtLocal(values));
  assign('timeZone', values.timeZone);
  assign('meetingUrl', values.meetingUrl.trim());
  if (own.includes('durationMinutes')) {
    if (values.durationMinutes === null)
      errors.durationMinutes = 'Enter the event length in minutes.';
    else candidate.durationMinutes = values.durationMinutes;
  }
  if (own.includes('expectedParticipants')) {
    if (values.expectedParticipants === null)
      errors.expectedParticipants = 'Enter a rough headcount.';
    else candidate.expectedParticipants = values.expectedParticipants;
  }
  if (step === 'activities') {
    candidate.activities = values.activities.map((a) => ({
      slug: a.slug,
      minutes: a.minutes ?? 10,
    }));
    for (const a of values.activities) {
      if (a.minutes === null) errors[`minutes:${a.slug}`] = 'Enter the minutes for this activity.';
    }
  }

  const parsed = eventDraftSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const [head, index, leaf] = issue.path;
      if (typeof head !== 'string' || !own.includes(head)) continue;
      if (head === 'activities' && typeof index === 'number' && leaf === 'minutes') {
        const slug = values.activities[index]?.slug;
        if (slug && errors[`minutes:${slug}`] === undefined)
          errors[`minutes:${slug}`] = issue.message;
        continue;
      }
      const key = head as FieldKey;
      if (errors[key] === undefined) errors[key] = issue.message;
    }
  }
  return errors;
}

export function isBasicsValid(values: FormValues): boolean {
  return Object.keys(validateStep('basics', values)).length === 0;
}

/** Total validation: true only when the whole plan satisfies the shared contract. */
export function isPlanComplete(values: FormValues): boolean {
  return (
    isBasicsValid(values) &&
    Object.keys(validateStep('participants', values)).length === 0 &&
    Object.keys(validateStep('activities', values)).length === 0
  );
}

/** Field the startsAtLocal error should attach to (date first, then time). */
export function startsAtErrorField(values: FormValues): 'date' | 'time' {
  return values.date === '' ? 'date' : 'time';
}

/** DOM ids for form controls, shared by fields and the error summary. */
export const FIELD_IDS = {
  title: 'field-title',
  startsAtLocal: 'field-time',
  timeZone: 'field-timezone',
  durationMinutes: 'field-duration',
  meetingUrl: 'field-meeting-url',
  expectedParticipants: 'field-participants',
  activities: 'field-activities',
} as const;

export function fieldIdFor(key: FieldKey, values: FormValues): string {
  if (key === 'startsAtLocal') return values.date === '' ? 'field-date' : 'field-time';
  if (key.startsWith('minutes:')) return `field-minutes-${key.slice('minutes:'.length)}`;
  return FIELD_IDS[key as keyof typeof FIELD_IDS];
}

/** Zones for the select: browser zone first, UTC guaranteed, rest alphabetical. */
export function timeZoneOptions(
  browserZone: string,
  supported: readonly string[] | null,
): string[] {
  const fallback = [
    'UTC',
    'America/Los_Angeles',
    'America/New_York',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Berlin',
    'Africa/Johannesburg',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Australia/Sydney',
  ];
  const base = supported && supported.length > 0 ? [...supported] : fallback;
  const set = new Set(base);
  set.add('UTC');
  const rest = [...set].filter((zone) => zone !== browserZone).sort((a, b) => a.localeCompare(b));
  return [browserZone, ...rest];
}

/** "New York (America/New_York) - GMT-4" using the zone's offset on `at`; value stays the IANA id. */
export function timeZoneLabel(zone: string, at: Date): string {
  if (zone === 'UTC') return 'UTC - GMT';
  const city = (zone.split('/').pop() ?? zone).replace(/_/g, ' ');
  let offset: string;
  try {
    offset =
      new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
        .formatToParts(at)
        .find((part) => part.type === 'timeZoneName')?.value ?? '';
  } catch {
    offset = '';
  }
  return offset === '' ? `${city} (${zone})` : `${city} (${zone}) - ${offset}`;
}

/** Noon UTC on the planned date when valid, otherwise `fallback` (today). */
export function labelDate(date: string, fallback: Date): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fallback;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}
