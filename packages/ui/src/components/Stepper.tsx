'use client';

import { Check, CircleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from './cn.js';

export interface StepperStep {
  id: string;
  label: string;
  /** Step needs attention (shown with icon + text, not colour). */
  error?: boolean;
}

export interface StepperProps {
  steps: readonly StepperStep[];
  /** id of the current step. */
  current: string;
  /** ids of completed steps; these become buttons that navigate back. */
  completed?: readonly string[];
  onStepSelect?: (id: string) => void;
  'aria-label'?: string;
  className?: string;
}

export function Stepper({
  steps,
  current,
  completed = [],
  onStepSelect,
  'aria-label': ariaLabel = 'Event steps',
  className,
}: StepperProps) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === current),
  );
  const currentStep = steps[currentIndex];
  const summary = currentStep
    ? `Step ${currentIndex + 1} of ${steps.length}: ${currentStep.label}`
    : '';

  // Announce changes of step (not the first render).
  const [announced, setAnnounced] = useState('');
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setAnnounced(summary);
  }, [summary]);

  return (
    <nav aria-label={ariaLabel} className={className}>
      {/* Mobile: compact summary + segmented bar. Visual only; the list below is the semantic source on md+. */}
      <div className="md:hidden">
        <p className="ff-tnum font-semibold text-ff-ink">
          Step {currentIndex + 1} of {steps.length} - {currentStep?.label}
        </p>
        <div aria-hidden="true" className="mt-2 flex gap-1">
          {steps.map((step, index) => (
            <span
              key={step.id}
              className={cn(
                'h-1.5 flex-1 rounded-full',
                index <= currentIndex ? 'bg-ff-violet-700' : 'bg-ff-border',
              )}
            />
          ))}
        </div>
      </div>
      <ol className="hidden items-center gap-2 md:flex">
        {steps.map((step, index) => {
          const isCurrent = step.id === current;
          const isDone = completed.includes(step.id) && !isCurrent;
          const marker = (
            <span
              aria-hidden="true"
              className={cn(
                'ff-tnum inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold',
                isCurrent && 'border-ff-violet-700 bg-ff-violet-700 text-white',
                isDone && 'border-ff-violet-700 bg-ff-violet-50 text-ff-violet-700',
                !isCurrent && !isDone && 'border-ff-border-strong bg-ff-surface text-ff-ink',
              )}
            >
              {step.error ? (
                <CircleAlert className="size-4" />
              ) : isDone ? (
                <Check className="size-4" />
              ) : (
                index + 1
              )}
            </span>
          );
          const text = (
            <span className="flex flex-col text-left">
              <span className={cn('text-ff-ink', isCurrent ? 'font-semibold' : 'font-medium')}>
                {step.label}
              </span>
              {step.error && (
                <span className="text-sm font-medium text-ff-coral-700">needs attention</span>
              )}
              {isDone && !step.error && <span className="sr-only">(completed)</span>}
            </span>
          );
          return (
            <li
              key={step.id}
              aria-current={isCurrent ? 'step' : undefined}
              className="flex items-center gap-2"
            >
              {isDone && onStepSelect ? (
                <button
                  type="button"
                  onClick={() => {
                    onStepSelect(step.id);
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-ff-button px-1 hover:bg-ff-violet-50"
                >
                  {marker}
                  {text}
                </button>
              ) : (
                <span className="inline-flex min-h-11 items-center gap-2 px-1">
                  {marker}
                  {text}
                </span>
              )}
              {index < steps.length - 1 && (
                <span aria-hidden="true" className="mx-1 h-0.5 w-6 bg-ff-border-strong" />
              )}
            </li>
          );
        })}
      </ol>
      <p role="status" aria-live="polite" className="sr-only">
        {announced}
      </p>
    </nav>
  );
}
