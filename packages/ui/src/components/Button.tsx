'use client';

import { Loader2 } from 'lucide-react';
import { type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { cn } from './cn.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'ff-press ff-filled inline-flex items-center justify-center gap-2 rounded-ff-button font-sans text-base font-semibold ' +
  'select-none whitespace-normal text-center aria-disabled:cursor-not-allowed aria-disabled:opacity-60';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-ff-violet-700 text-white hover:bg-ff-violet-800 active:shadow-[inset_0_2px_4px_rgb(0_0_0/0.25)] aria-disabled:hover:bg-ff-violet-700',
  secondary:
    'border border-ff-border-strong bg-ff-surface text-ff-ink hover:bg-ff-violet-50 aria-disabled:hover:bg-ff-surface',
  ghost:
    'bg-transparent text-ff-violet-700 hover:bg-ff-violet-50 aria-disabled:hover:bg-transparent',
  danger: 'bg-ff-coral-700 text-white hover:bg-ff-coral-800 aria-disabled:hover:bg-ff-coral-700',
};

// sm (36px) is a desktop-only size: it falls back to 44px below the md breakpoint.
const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-11 md:min-h-9 px-4 py-1.5',
  md: 'min-h-11 px-5 py-2',
  lg: 'min-h-13 px-6 py-3',
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

/** Class names shared by Button and LinkButton. */
export function buttonStyles({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className);
}

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and `loadingLabel`; the button stays focusable and inert. */
  loading?: boolean;
  /** Replaces the label while loading, e.g. "Saving...". */
  loadingLabel?: string;
  /**
   * Inert but focusable. Uses `aria-disabled`, never the `disabled` attribute,
   * so keyboard focus is never lost when the state toggles.
   */
  disabled?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant,
  size,
  loading = false,
  loadingLabel,
  disabled = false,
  iconStart,
  iconEnd,
  fullWidth,
  className,
  children,
  type = 'button',
  onClick,
  ...rest
}: ButtonProps) {
  const inert = disabled || loading;
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (inert) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  const shownLabel = loading && loadingLabel ? loadingLabel : children;

  return (
    <button
      {...rest}
      type={type}
      aria-disabled={inert ? true : undefined}
      aria-busy={loading ? true : undefined}
      onClick={handleClick}
      className={buttonStyles({ variant, size, fullWidth, className })}
    >
      {loading ? (
        <Loader2 aria-hidden="true" className="ff-spin size-5 shrink-0" />
      ) : (
        iconStart && (
          <span aria-hidden="true" className="inline-flex shrink-0">
            {iconStart}
          </span>
        )
      )}
      {/* Both labels share one grid cell so the button width never jumps while loading. */}
      <span className="inline-grid">
        <span
          className={cn('col-start-1 row-start-1', loading && loadingLabel && 'invisible')}
          aria-hidden={loading && loadingLabel ? true : undefined}
        >
          {children}
        </span>
        {loading && loadingLabel ? (
          <span className="col-start-1 row-start-1">{shownLabel}</span>
        ) : null}
      </span>
      {!loading && iconEnd && (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {iconEnd}
        </span>
      )}
    </button>
  );
}
