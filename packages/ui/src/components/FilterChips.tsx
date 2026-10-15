'use client';

import { Check } from 'lucide-react';
import { cn } from './cn.js';

export interface FilterChip {
  id: string;
  label: string;
  pressed: boolean;
  count?: number;
}

export interface FilterChipsProps {
  /** Accessible name of the group, e.g. "Filter by category". */
  label: string;
  chips: readonly FilterChip[];
  onToggle: (id: string) => void;
  className?: string;
}

export function FilterChips({ label, chips, onToggle, className }: FilterChipsProps) {
  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          aria-pressed={chip.pressed}
          onClick={() => {
            onToggle(chip.id);
          }}
          className={cn(
            'ff-chip ff-filled inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm leading-[22px] font-semibold text-ff-ink',
            chip.pressed
              ? 'border-2 border-ff-violet-700 bg-ff-violet-50 px-[15px]'
              : 'border border-ff-border-strong bg-ff-surface hover:bg-ff-violet-50',
          )}
        >
          {chip.pressed && <Check aria-hidden="true" className="size-4 text-ff-violet-700" />}
          <span>{chip.label}</span>
          {chip.count !== undefined && (
            <span className="ff-tnum text-ff-muted">({chip.count})</span>
          )}
        </button>
      ))}
    </div>
  );
}
