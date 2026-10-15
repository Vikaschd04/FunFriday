import type { ActivitySummary } from '@funfriday/contracts';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  capacityHint,
  countHiddenBySize,
  filterActivities,
  hasActiveFilters,
  parseFilters,
  serializeFilters,
} from './library-filters';

const make = (
  slug: string,
  name: string,
  category: ActivitySummary['category'],
  minPlayers: number,
  maxPlayers: number,
  min: number,
  max: number,
): ActivitySummary => ({
  slug,
  name,
  summary: `${name} summary`,
  category,
  minPlayers,
  maxPlayers,
  estimatedMinutes: { min, max },
  availability: 'planned',
});

const catalog = [
  make('this-or-that', 'This or That', 'icebreaker', 2, 200, 3, 8),
  make('trivia-rush', 'Trivia Rush', 'quiz', 2, 200, 8, 15),
  make('who-am-i', 'Who Am I?', 'guessing', 4, 30, 7, 12),
  make('sketch', 'Sketch & Guess', 'creative', 3, 12, 8, 20),
];

describe('filterActivities', () => {
  it('returns everything with empty filters', () => {
    expect(filterActivities(catalog, EMPTY_FILTERS)).toHaveLength(4);
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it('searches name, summary and category label case-insensitively', () => {
    expect(filterActivities(catalog, { ...EMPTY_FILTERS, q: 'TRIVIA' }).map((a) => a.slug)).toEqual(
      ['trivia-rush'],
    );
    expect(filterActivities(catalog, { ...EMPTY_FILTERS, q: 'zzz' })).toEqual([]);
  });

  it('category is multi-select OR', () => {
    const result = filterActivities(catalog, { ...EMPTY_FILTERS, cat: ['quiz', 'creative'] });
    expect(result.map((a) => a.slug)).toEqual(['trivia-rush', 'sketch']);
  });

  it('group size matches by range overlap', () => {
    const filters = { ...EMPTY_FILTERS, size: '21-50' };
    expect(filterActivities(catalog, filters).map((a) => a.slug)).toEqual([
      'this-or-that',
      'trivia-rush',
      'who-am-i',
    ]);
    expect(countHiddenBySize(catalog, filters)).toBe(1);
    expect(filterActivities(catalog, { ...EMPTY_FILTERS, size: '51+' }).map((a) => a.slug)).toEqual(
      ['this-or-that', 'trivia-rush'],
    );
  });

  it('duration matches by overlap, inclusive at the edges', () => {
    expect(filterActivities(catalog, { ...EMPTY_FILTERS, dur: '0-5' }).map((a) => a.slug)).toEqual([
      'this-or-that',
    ]);
    expect(filterActivities(catalog, { ...EMPTY_FILTERS, dur: '15+' }).map((a) => a.slug)).toEqual([
      'trivia-rush',
      'sketch',
    ]);
  });

  it('combines dimensions with AND', () => {
    const result = filterActivities(catalog, { q: '', cat: ['quiz'], size: '51+', dur: '5-10' });
    expect(result.map((a) => a.slug)).toEqual(['trivia-rush']);
  });

  it('only counts hidden-by-size for activities that pass the other filters', () => {
    expect(countHiddenBySize(catalog, { ...EMPTY_FILTERS, size: '21-50', cat: ['quiz'] })).toBe(0);
    expect(countHiddenBySize(catalog, EMPTY_FILTERS)).toBe(0);
  });
});

describe('capacityHint', () => {
  it('shows a hint when the chosen size exceeds the activity range', () => {
    const who = catalog[2] as ActivitySummary;
    expect(capacityHint(who, { ...EMPTY_FILTERS, size: '21-50' })).toBe(
      'Works best for 4-30 people',
    );
    expect(
      capacityHint(catalog[0] as ActivitySummary, { ...EMPTY_FILTERS, size: '21-50' }),
    ).toBeNull();
    expect(capacityHint(who, EMPTY_FILTERS)).toBeNull();
  });
});

describe('url round trip', () => {
  it('serializes and parses filters', () => {
    const filters = {
      q: 'trivia',
      cat: ['quiz' as const, 'creative' as const],
      size: '6-10',
      dur: '15+',
    };
    const query = serializeFilters(filters);
    expect(parseFilters(new URLSearchParams(query))).toEqual({
      ...filters,
      cat: ['quiz', 'creative'],
    });
    expect(serializeFilters(EMPTY_FILTERS)).toBe('');
  });

  it('drops unknown values', () => {
    const parsed = parseFilters(new URLSearchParams('cat=quiz,evil&size=999&dur=x&q=hi'));
    expect(parsed).toEqual({ q: 'hi', cat: ['quiz'], size: '', dur: '' });
  });
});
