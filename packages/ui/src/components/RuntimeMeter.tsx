'use client';

import { TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from './cn.js';

export interface MeterSegment {
  slug: string;
  label: string;
  minutes: number;
}

export interface RuntimeMeterProps {
  /** Total event length in minutes. */
  eventMinutes: number;
  /** Minutes planned across activities (from the reviewEventPlan contract, not computed here). */
  activityMinutes: number;
  /** Requested minimum buffer in minutes (0 if none). */
  bufferMinutes?: number;
  segments: readonly MeterSegment[];
  className?: string;
}

/** Text equivalent used as aria-label, visible text and live announcement. */
export function runtimeSummary(
  eventMinutes: number,
  activityMinutes: number,
  bufferMinutes = 0,
): string {
  const over = activityMinutes - eventMinutes;
  if (over > 0) {
    return `${activityMinutes} of ${eventMinutes} minutes planned, ${over} ${over === 1 ? 'minute' : 'minutes'} over`;
  }
  const remaining = eventMinutes - activityMinutes;
  const base = `${activityMinutes} of ${eventMinutes} minutes planned, ${remaining} ${remaining === 1 ? 'minute' : 'minutes'} of buffer`;
  return bufferMinutes > 0 && remaining < bufferMinutes
    ? `${base}, less than the ${bufferMinutes}-minute buffer`
    : base;
}

/**
 * Multi-segment time budget. Uses role="img" (not role="meter", which is single-value).
 * Over budget is shown with a hatch pattern, warning icon and text - never colour alone.
 */
export function RuntimeMeter({
  eventMinutes,
  activityMinutes,
  bufferMinutes = 0,
  segments,
  className,
}: RuntimeMeterProps) {
  const summary = runtimeSummary(eventMinutes, activityMinutes, bufferMinutes);
  const over = Math.max(0, activityMinutes - eventMinutes);
  const scale = Math.max(eventMinutes, activityMinutes, 1);
  const pct = (minutes: number) => `${(Math.max(0, minutes) / scale) * 100}%`;
  const remaining = Math.max(0, eventMinutes - activityMinutes);

  // Debounced (500ms) polite announcement of changes; silent on first render.
  const [announced, setAnnounced] = useState('');
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setAnnounced(summary);
    }, 500);
    return () => {
      clearTimeout(timer);
    };
  }, [summary]);

  // Segments are shown up to the event length; the rest of the planned time is the "over" hatch.
  let used = 0;
  const shown = segments.map((segment) => {
    const room = Math.max(0, eventMinutes - used);
    const minutes = Math.min(segment.minutes, room);
    used += segment.minutes;
    return { ...segment, shown: minutes };
  });

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        role="img"
        aria-label={summary}
        className="flex h-4 w-full overflow-hidden rounded-full bg-ff-border"
      >
        {shown.map((segment, index) => (
          <span
            key={segment.slug}
            className={cn(
              'ff-meter-seg h-full border-r-2 border-ff-surface last:border-r-0',
              index % 2 === 0 ? 'bg-ff-violet-700' : 'bg-ff-violet-600',
            )}
            style={{ width: pct(segment.shown) }}
          />
        ))}
        {remaining > 0 && (
          <span className="ff-meter-seg ff-hatch h-full" style={{ width: pct(remaining) }} />
        )}
        {over > 0 && (
          <span className="ff-meter-seg ff-hatch-danger h-full" style={{ width: pct(over) }} />
        )}
      </div>
      <p
        className={cn(
          'ff-tnum flex items-start gap-1.5 text-sm leading-[22px]',
          over > 0 ? 'font-semibold text-ff-coral-700' : 'text-ff-ink',
        )}
      >
        {over > 0 && <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
        <span>{summary}</span>
      </p>
      <ul className="hidden flex-wrap gap-x-4 gap-y-1 text-sm text-ff-muted md:flex">
        {segments.map((segment) => (
          <li key={segment.slug} className="ff-tnum">
            {segment.label}: {segment.minutes} min
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite" className="sr-only">
        {announced}
      </p>
    </div>
  );
}
