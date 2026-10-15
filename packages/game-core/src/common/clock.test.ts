import { describe, expect, it } from 'vitest';
import { createManualClock, isDeadlinePassed } from './clock.js';

describe('manual clock and deadlines', () => {
  it('advances only when told to', () => {
    const clock = createManualClock(1_000);
    expect(clock.now()).toBe(1_000);
    clock.advance(250);
    expect(clock.now()).toBe(1_250);
  });

  it('treats the exact deadline instant as passed (late submissions rejected)', () => {
    const clock = createManualClock(10_000);
    expect(isDeadlinePassed(clock, 10_001)).toBe(false);
    clock.advance(1);
    expect(isDeadlinePassed(clock, 10_001)).toBe(true);
  });

  it('refuses to move backwards via advance()', () => {
    expect(() => createManualClock(0).advance(-1)).toThrow(RangeError);
  });
});
