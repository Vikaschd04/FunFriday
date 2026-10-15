import type { ActivityCategory, ActivitySummary } from '@funfriday/contracts';

export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  icebreaker: 'Icebreakers',
  check_in: 'Check-ins',
  quiz: 'Quizzes',
  guessing: 'Guessing games',
  creative: 'Creative',
};
/** Singular label for a single activity's category text. */
export const CATEGORY_SINGULAR: Record<ActivityCategory, string> = {
  icebreaker: 'Icebreaker',
  check_in: 'Check-in',
  quiz: 'Quiz',
  guessing: 'Guessing game',
  creative: 'Creative',
};
export const CATEGORY_ORDER: readonly ActivityCategory[] = [
  'icebreaker',
  'check_in',
  'quiz',
  'guessing',
  'creative',
];

export interface Range {
  min: number;
  max: number;
}

export const SIZE_OPTIONS = [
  { value: '', label: 'Any size', range: null },
  { value: '2-5', label: '2-5 people', range: { min: 2, max: 5 } },
  { value: '6-10', label: '6-10 people', range: { min: 6, max: 10 } },
  { value: '11-20', label: '11-20 people', range: { min: 11, max: 20 } },
  { value: '21-50', label: '21-50 people', range: { min: 21, max: 50 } },
  { value: '51+', label: '51+ people', range: { min: 51, max: Number.POSITIVE_INFINITY } },
] as const satisfies ReadonlyArray<{ value: string; label: string; range: Range | null }>;

export const DURATION_OPTIONS = [
  { value: '', label: 'Any length', range: null },
  { value: '0-5', label: 'Up to 5 min', range: { min: 0, max: 5 } },
  { value: '5-10', label: '5-10 min', range: { min: 5, max: 10 } },
  { value: '10-15', label: '10-15 min', range: { min: 10, max: 15 } },
  { value: '15+', label: '15+ min', range: { min: 15, max: Number.POSITIVE_INFINITY } },
] as const satisfies ReadonlyArray<{ value: string; label: string; range: Range | null }>;

export interface LibraryFilters {
  q: string;
  cat: ActivityCategory[];
  size: string;
  dur: string;
}

export const EMPTY_FILTERS: LibraryFilters = { q: '', cat: [], size: '', dur: '' };

const overlaps = (a: Range, b: Range): boolean => a.min <= b.max && b.min <= a.max;

export function sizeRange(value: string): Range | null {
  return SIZE_OPTIONS.find((option) => option.value === value)?.range ?? null;
}
export function durationRange(value: string): Range | null {
  return DURATION_OPTIONS.find((option) => option.value === value)?.range ?? null;
}

export function hasActiveFilters(filters: LibraryFilters): boolean {
  return (
    filters.q.trim() !== '' || filters.cat.length > 0 || filters.size !== '' || filters.dur !== ''
  );
}

/** Reads filters from URL query params; unknown or malformed values are dropped. */
export function parseFilters(params: { get(name: string): string | null }): LibraryFilters {
  const q = (params.get('q') ?? '').slice(0, 80);
  const cat = (params.get('cat') ?? '')
    .split(',')
    .filter((value): value is ActivityCategory =>
      (CATEGORY_ORDER as readonly string[]).includes(value),
    );
  const size = params.get('size') ?? '';
  const dur = params.get('dur') ?? '';
  return {
    q,
    cat: CATEGORY_ORDER.filter((c) => cat.includes(c)),
    size: SIZE_OPTIONS.some((o) => o.value === size) ? size : '',
    dur: DURATION_OPTIONS.some((o) => o.value === dur) ? dur : '',
  };
}

/** Query string (without `?`) for the active filters; empty when none. */
export function serializeFilters(filters: LibraryFilters): string {
  const params = new URLSearchParams();
  if (filters.q.trim() !== '') params.set('q', filters.q);
  if (filters.cat.length > 0) params.set('cat', filters.cat.join(','));
  if (filters.size !== '') params.set('size', filters.size);
  if (filters.dur !== '') params.set('dur', filters.dur);
  return params.toString();
}

function matchesText(activity: ActivitySummary, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (needle === '') return true;
  return `${activity.name} ${activity.summary} ${CATEGORY_LABELS[activity.category]}`
    .toLowerCase()
    .includes(needle);
}

type Dimension = 'q' | 'cat' | 'size' | 'dur';

function matches(activity: ActivitySummary, filters: LibraryFilters, skip?: Dimension): boolean {
  if (skip !== 'q' && !matchesText(activity, filters.q)) return false;
  if (skip !== 'cat' && filters.cat.length > 0 && !filters.cat.includes(activity.category)) {
    return false;
  }
  const size = sizeRange(filters.size);
  if (
    skip !== 'size' &&
    size &&
    !overlaps(size, { min: activity.minPlayers, max: activity.maxPlayers })
  ) {
    return false;
  }
  const dur = durationRange(filters.dur);
  if (skip !== 'dur' && dur && !overlaps(dur, activity.estimatedMinutes)) return false;
  return true;
}

export function filterActivities(
  activities: readonly ActivitySummary[],
  filters: LibraryFilters,
): ActivitySummary[] {
  return activities.filter((activity) => matches(activity, filters));
}

/** Activities hidden only because they do not fit the chosen group size. */
export function countHiddenBySize(
  activities: readonly ActivitySummary[],
  filters: LibraryFilters,
): number {
  if (!sizeRange(filters.size)) return 0;
  return activities.filter((a) => matches(a, filters, 'size') && !matches(a, filters)).length;
}

/** "Works best for 2-12 people" when the chosen size range extends beyond the activity's range. */
export function capacityHint(activity: ActivitySummary, filters: LibraryFilters): string | null {
  const size = sizeRange(filters.size);
  if (!size) return null;
  if (size.min < activity.minPlayers || size.max > activity.maxPlayers) {
    return `Works best for ${activity.minPlayers}-${activity.maxPlayers} people`;
  }
  return null;
}
