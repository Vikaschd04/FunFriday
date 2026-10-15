import type { ActivitySummary } from '@funfriday/contracts';
import { describe, expect, it } from 'vitest';
import {
  defaultMinutes,
  draftFromForm,
  emptyForm,
  fieldIdFor,
  formFromDraft,
  isBasicsValid,
  isPlanComplete,
  labelDate,
  timeZoneLabel,
  timeZoneOptions,
  validateStep,
  type FormValues,
} from './builder-model';

const valid = (): FormValues => ({
  ...emptyForm('Europe/London'),
  title: 'Friday Reset',
  date: '2026-10-23',
  time: '15:00',
  activities: [{ slug: 'trivia-rush', minutes: 12 }],
});

describe('validateStep', () => {
  it('reports contract messages for an empty Basics step', () => {
    const errors = validateStep('basics', emptyForm('Europe/London'));
    expect(errors.title).toBe('Give your event a name of at least 3 characters.');
    expect(errors.startsAtLocal).toBe('Choose a date and start time.');
    expect(errors.durationMinutes).toBeUndefined();
  });

  it('rejects a time skipped by the spring-forward DST gap', () => {
    const errors = validateStep('basics', {
      ...valid(),
      timeZone: 'America/New_York',
      date: '2026-03-08',
      time: '02:30',
    });
    expect(errors.startsAtLocal).toBe(
      'That time is skipped when clocks change in this time zone. Pick another time.',
    );
  });

  it('validates meeting link and duration bounds', () => {
    const errors = validateStep('basics', {
      ...valid(),
      meetingUrl: 'http://x.test',
      durationMinutes: 10,
    });
    expect(errors.meetingUrl).toBe('Meeting links must start with https://');
    expect(errors.durationMinutes).toBe('Events run at least 15 minutes.');
    expect(
      validateStep('basics', { ...valid(), meetingUrl: 'https://meet.example.com/x' }),
    ).toEqual({});
  });

  it('handles empty numbers with local copy', () => {
    expect(
      validateStep('basics', { ...valid(), durationMinutes: null }).durationMinutes,
    ).toBeDefined();
    expect(
      validateStep('participants', { ...valid(), expectedParticipants: null }).expectedParticipants,
    ).toBeDefined();
  });

  it('validates participants against the contract range', () => {
    expect(
      validateStep('participants', { ...valid(), expectedParticipants: 1 }).expectedParticipants,
    ).toBe('Plan for at least 2 people.');
    expect(
      validateStep('participants', { ...valid(), expectedParticipants: 500 }).expectedParticipants,
    ).toBe('Groups above 200 are not supported yet.');
    expect(validateStep('participants', valid())).toEqual({});
  });

  it('does not leak other steps errors into this one', () => {
    expect(validateStep('participants', emptyForm('UTC'))).toEqual({});
  });

  it('validates activities: at least one, per-row minutes, maximum 8', () => {
    expect(validateStep('activities', { ...valid(), activities: [] }).activities).toBe(
      'Pick at least one activity.',
    );
    const row = validateStep('activities', { ...valid(), activities: [{ slug: 'a', minutes: 1 }] });
    expect(row['minutes:a']).toBe('Give each activity at least 2 minutes.');
    expect(
      validateStep('activities', { ...valid(), activities: [{ slug: 'a', minutes: null }] })[
        'minutes:a'
      ],
    ).toBeDefined();
    const nine = Array.from({ length: 9 }, (_, i) => ({ slug: `a${i}`, minutes: 5 }));
    expect(validateStep('activities', { ...valid(), activities: nine }).activities).toBe(
      'Pick up to 8 activities.',
    );
  });
});

describe('plan helpers', () => {
  it('isBasicsValid and isPlanComplete', () => {
    expect(isBasicsValid(valid())).toBe(true);
    expect(isBasicsValid(emptyForm('UTC'))).toBe(false);
    expect(isPlanComplete(valid())).toBe(true);
    expect(isPlanComplete({ ...valid(), activities: [] })).toBe(false);
  });

  it('draft round trip keeps partial drafts partial', () => {
    const partial = draftFromForm({ ...emptyForm('UTC'), title: 'Hi' });
    expect(partial.startsAtLocal).toBeUndefined();
    const stored = { ...draftFromForm(valid()), id: 'x', updatedAt: '2026-10-01T00:00:00.000Z' };
    expect(formFromDraft(stored, 'UTC')).toEqual(valid());
  });

  it('maps errors to field ids', () => {
    expect(fieldIdFor('startsAtLocal', emptyForm('UTC'))).toBe('field-date');
    expect(fieldIdFor('startsAtLocal', valid())).toBe('field-time');
    expect(fieldIdFor('minutes:trivia-rush', valid())).toBe('field-minutes-trivia-rush');
  });

  it('defaultMinutes is the rounded midpoint within limits', () => {
    const make = (min: number, max: number) =>
      ({ estimatedMinutes: { min, max } }) as unknown as ActivitySummary;
    expect(defaultMinutes(make(8, 15))).toBe(12);
    expect(defaultMinutes(make(2, 5))).toBe(4);
    expect(defaultMinutes(make(90, 120))).toBe(60);
  });

  it('timeZoneOptions pins the browser zone first and always includes UTC', () => {
    const options = timeZoneOptions('Asia/Kolkata', [
      'Europe/London',
      'Asia/Kolkata',
      'Africa/Cairo',
    ]);
    expect(options[0]).toBe('Asia/Kolkata');
    expect(options).toContain('UTC');
    expect(new Set(options).size).toBe(options.length);
    expect(timeZoneOptions('Europe/Paris', null)[0]).toBe('Europe/Paris');
  });

  it('labels time zones with city, IANA id and offset on the planned date', () => {
    const winter = labelDate('2026-01-15', new Date('2026-06-01T00:00:00Z'));
    const summer = labelDate('2026-07-15', new Date('2026-06-01T00:00:00Z'));
    expect(timeZoneLabel('America/New_York', winter)).toBe('New York (America/New_York) - GMT-5');
    expect(timeZoneLabel('America/New_York', summer)).toBe('New York (America/New_York) - GMT-4');
    expect(timeZoneLabel('Asia/Kolkata', summer)).toBe('Kolkata (Asia/Kolkata) - GMT+5:30');
    expect(timeZoneLabel('UTC', summer)).toBe('UTC - GMT');
  });

  it('falls back to today when the date is invalid', () => {
    const today = new Date('2026-06-01T00:00:00Z');
    expect(labelDate('', today)).toBe(today);
    expect(labelDate('2026-13-45', today)).toBe(today);
  });
});
