'use client';

import { ChevronDown, CircleAlert, Minus, Plus, Search, X } from 'lucide-react';
import {
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { cn, describedBy } from './cn.js';

export interface FieldChromeProps {
  /** Visible label (required: placeholders are never labels). */
  label: ReactNode;
  hint?: ReactNode;
  /** Error message; sets aria-invalid and is linked through aria-describedby. */
  error?: ReactNode;
  required?: boolean;
}

const controlBase =
  'block w-full min-h-12 rounded-ff-field bg-ff-surface px-3 text-base text-ff-ink font-sans ' +
  'border border-ff-border-strong hover:border-ff-ink placeholder:text-ff-muted ' +
  'aria-disabled:opacity-60 aria-invalid:border-2 aria-invalid:border-ff-coral-700';

interface FieldShellProps extends FieldChromeProps {
  controlId: string;
  hintId: string;
  errorId: string;
  children: ReactNode;
  /** Extra text below the control (e.g. character counter). */
  footer?: ReactNode;
}

/** Label, hint, control slot and error. Shared by every form field. */
function FieldShell({
  label,
  hint,
  error,
  required,
  controlId,
  hintId,
  errorId,
  children,
  footer,
}: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={controlId} className="text-sm leading-[22px] font-semibold text-ff-ink">
        {label}
        {required && <span className="font-normal text-ff-muted"> (required)</span>}
      </label>
      {hint && (
        <p id={hintId} className="text-sm leading-[22px] text-ff-muted">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p
          id={errorId}
          className="flex items-start gap-1.5 text-sm leading-[22px] font-medium text-ff-coral-700"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {footer}
    </div>
  );
}

function useFieldIds(idProp: string | undefined) {
  const generated = useId();
  const id = idProp ?? generated;
  return { id, hintId: `${id}-hint`, errorId: `${id}-error`, extraId: `${id}-extra` };
}

export interface TextFieldProps
  extends FieldChromeProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'required'> {
  ref?: Ref<HTMLInputElement>;
}

export function TextField({
  label,
  hint,
  error,
  required,
  id,
  className,
  type = 'text',
  ref,
  ...rest
}: TextFieldProps) {
  const ids = useFieldIds(id);
  return (
    <FieldShell
      {...{ label, hint, error, required }}
      controlId={ids.id}
      hintId={ids.hintId}
      errorId={ids.errorId}
    >
      <input
        {...rest}
        ref={ref}
        id={ids.id}
        type={type}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(
          rest['aria-describedby'],
          hint ? ids.hintId : null,
          error ? ids.errorId : null,
        )}
        className={cn(controlBase, className)}
      />
    </FieldShell>
  );
}

export interface NumberFieldProps
  extends
    FieldChromeProps,
    Omit<
      InputHTMLAttributes<HTMLInputElement>,
      'required' | 'value' | 'defaultValue' | 'onChange' | 'type' | 'min' | 'max' | 'step'
    > {
  /** Authoritative numeric value, or null when empty/unparseable. */
  value: number | null;
  onValueChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Shows 44px -/+ buttons. */
  showStepper?: boolean;
  ref?: Ref<HTMLInputElement>;
}

function clamp(n: number, min?: number, max?: number): number {
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
}

/**
 * Text input with inputmode=numeric (not type=number: no scroll-wheel changes).
 * ArrowUp / ArrowDown step by `step` (default 1) and respect min/max.
 */
export function NumberField({
  label,
  hint,
  error,
  required,
  id,
  className,
  value,
  onValueChange,
  min,
  max,
  step = 1,
  showStepper = false,
  ref,
  ...rest
}: NumberFieldProps) {
  const ids = useFieldIds(id);
  const [draft, setDraft] = useState(value === null ? '' : String(value));

  useEffect(() => {
    setDraft((current) => {
      const parsed = current.trim() === '' ? null : Number(current);
      return parsed === value || (parsed !== null && Number.isNaN(parsed) && value === null)
        ? current
        : value === null
          ? ''
          : String(value);
    });
  }, [value]);

  const commit = (next: number | null) => {
    setDraft(next === null ? '' : String(next));
    onValueChange(next);
  };
  const stepBy = (delta: number) => {
    const base = value ?? (min !== undefined && delta > 0 ? min - delta : 0);
    commit(clamp(base + delta, min, max));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      stepBy(step);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      stepBy(-step);
    }
    rest.onKeyDown?.(event);
  };
  const atMin = min !== undefined && value !== null && value <= min;
  const atMax = max !== undefined && value !== null && value >= max;
  const stepButton =
    'inline-flex min-h-12 min-w-11 items-center justify-center rounded-ff-field border border-ff-border-strong bg-ff-surface text-ff-ink hover:bg-ff-violet-50 aria-disabled:opacity-60';

  return (
    <FieldShell
      {...{ label, hint, error, required }}
      controlId={ids.id}
      hintId={ids.hintId}
      errorId={ids.errorId}
    >
      <div className="flex items-stretch gap-2">
        {showStepper && (
          <button
            type="button"
            className={stepButton}
            aria-label={`Decrease ${typeof label === 'string' ? label : 'value'}`}
            aria-disabled={atMin ? true : undefined}
            onClick={() => {
              if (!atMin) stepBy(-step);
            }}
          >
            <Minus aria-hidden="true" className="size-4" />
          </button>
        )}
        <input
          {...rest}
          ref={ref}
          id={ids.id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required={required}
          value={draft}
          onKeyDown={onKeyDown}
          onChange={(event) => {
            const text = event.target.value;
            setDraft(text);
            const trimmed = text.trim();
            const parsed = trimmed === '' ? null : Number(trimmed);
            onValueChange(parsed === null || Number.isNaN(parsed) ? null : parsed);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(
            rest['aria-describedby'],
            hint ? ids.hintId : null,
            error ? ids.errorId : null,
          )}
          className={cn(controlBase, showStepper && 'text-center ff-tnum', className)}
        />
        {showStepper && (
          <button
            type="button"
            className={stepButton}
            aria-label={`Increase ${typeof label === 'string' ? label : 'value'}`}
            aria-disabled={atMax ? true : undefined}
            onClick={() => {
              if (!atMax) stepBy(step);
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
    </FieldShell>
  );
}

export interface TextareaProps
  extends FieldChromeProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'required'> {
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({
  label,
  hint,
  error,
  required,
  id,
  className,
  maxLength,
  value,
  defaultValue,
  onChange,
  ref,
  ...rest
}: TextareaProps) {
  const ids = useFieldIds(id);
  const [uncontrolledLength, setUncontrolledLength] = useState(String(defaultValue ?? '').length);
  const length = value !== undefined ? String(value).length : uncontrolledLength;
  return (
    <FieldShell
      {...{ label, hint, error, required }}
      controlId={ids.id}
      hintId={ids.hintId}
      errorId={ids.errorId}
      footer={
        maxLength !== undefined ? (
          <p id={ids.extraId} className="ff-tnum text-sm leading-[22px] text-ff-muted">
            {length} / {maxLength} characters
          </p>
        ) : null
      }
    >
      <textarea
        {...rest}
        ref={ref}
        id={ids.id}
        required={required}
        maxLength={maxLength}
        value={value}
        defaultValue={defaultValue}
        onChange={(event) => {
          setUncontrolledLength(event.target.value.length);
          onChange?.(event);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(
          rest['aria-describedby'],
          hint ? ids.hintId : null,
          error ? ids.errorId : null,
          maxLength !== undefined ? ids.extraId : null,
        )}
        className={cn(controlBase, 'min-h-28 py-2.5 leading-6', className)}
      />
    </FieldShell>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends FieldChromeProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'required' | 'children'> {
  options: readonly SelectOption[];
  /** Optional leading empty option, e.g. "Choose a time zone". */
  placeholder?: string;
  ref?: Ref<HTMLSelectElement>;
}

/** Native <select> (accessible and mobile friendly); no custom listbox in P1. */
export function Select({
  label,
  hint,
  error,
  required,
  id,
  className,
  options,
  placeholder,
  ref,
  ...rest
}: SelectProps) {
  const ids = useFieldIds(id);
  return (
    <FieldShell
      {...{ label, hint, error, required }}
      controlId={ids.id}
      hintId={ids.hintId}
      errorId={ids.errorId}
    >
      <div className="relative">
        <select
          {...rest}
          ref={ref}
          id={ids.id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(
            rest['aria-describedby'],
            hint ? ids.hintId : null,
            error ? ids.errorId : null,
          )}
          className={cn(controlBase, 'appearance-none pr-10', className)}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-ff-ink"
        />
      </div>
    </FieldShell>
  );
}

export interface SearchFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'defaultValue'
> {
  /** Visually hidden label, e.g. "Search activities". */
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Result summary announced politely (debounced 250ms), e.g. "6 activities" or "No activities match". */
  resultsMessage?: string;
  clearLabel?: string;
  ref?: Ref<HTMLInputElement>;
}

export function SearchField({
  label,
  value,
  onValueChange,
  resultsMessage,
  clearLabel = 'Clear search',
  id,
  className,
  onKeyDown,
  ref,
  ...rest
}: SearchFieldProps) {
  const ids = useFieldIds(id);
  const [announced, setAnnounced] = useState('');
  // The first summary is the initial page load: show it, but do not announce it.
  const firstMessage = useRef(true);
  useEffect(() => {
    if (resultsMessage === undefined) return;
    if (firstMessage.current) {
      firstMessage.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setAnnounced(resultsMessage);
    }, 250);
    return () => {
      clearTimeout(timer);
    };
  }, [resultsMessage]);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={ids.id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ff-muted"
        />
        <input
          {...rest}
          ref={ref}
          id={ids.id}
          type="search"
          autoComplete="off"
          value={value}
          onChange={(event) => {
            onValueChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && value !== '') {
              event.preventDefault();
              onValueChange('');
            }
            onKeyDown?.(event);
          }}
          className={cn(
            controlBase,
            'pl-10 pr-12 [&::-webkit-search-cancel-button]:hidden',
            className,
          )}
        />
        {value !== '' && (
          <button
            type="button"
            aria-label={clearLabel}
            onClick={() => {
              onValueChange('');
              (document.getElementById(ids.id) as HTMLInputElement | null)?.focus();
            }}
            className="absolute top-1/2 right-0.5 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-ff-field text-ff-ink hover:bg-ff-violet-50"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        )}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {announced}
      </p>
    </div>
  );
}
