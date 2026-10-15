'use client';

import { CircleAlert, Info, Lock, TriangleAlert, CircleCheck } from 'lucide-react';
import { type ElementType, type ReactNode } from 'react';
import { Button } from './Button.js';
import { cn } from './cn.js';

type HeadingLevel = 1 | 2 | 3 | 4;

function Heading({
  level,
  className,
  children,
}: {
  level: HeadingLevel;
  className?: string;
  children: ReactNode;
}) {
  const Tag = `h${level}` as ElementType;
  return (
    <Tag className={cn('font-heading text-xl leading-7 font-bold text-ff-ink', className)}>
      {children}
    </Tag>
  );
}

export interface EmptyStateProps {
  /** Decorative illustration/motif; hidden from assistive tech. */
  illustration?: ReactNode;
  title: ReactNode;
  headingLevel?: HeadingLevel;
  body?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}

export function EmptyState({
  illustration,
  title,
  headingLevel = 2,
  body,
  primaryAction,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <section
      className={cn(
        'flex flex-col items-center gap-4 rounded-ff-card bg-ff-surface p-8 text-center shadow-ff-sm',
        className,
      )}
    >
      {illustration && (
        <div
          aria-hidden="true"
          className="flex size-40 items-center justify-center rounded-full bg-ff-violet-50 text-ff-violet-700"
        >
          {illustration}
        </div>
      )}
      <Heading level={headingLevel}>{title}</Heading>
      {body && <p className="max-w-[68ch] text-ff-muted">{body}</p>}
      {(primaryAction ?? secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </section>
  );
}

export interface ErrorStateProps {
  title: ReactNode;
  body?: ReactNode;
  headingLevel?: HeadingLevel;
  /** Retry handler. The Retry button keeps focus while retrying. */
  onRetry?: () => void;
  retrying?: boolean;
  retryLabel?: string;
  /** Technical detail (e.g. a request id); shown in small text. */
  detail?: ReactNode;
  /** 'alert' when the error appears after a user action; 'status' (default) on initial load. */
  announce?: 'alert' | 'status';
  className?: string;
}

export function ErrorState({
  title,
  body,
  headingLevel = 2,
  onRetry,
  retrying = false,
  retryLabel = 'Try again',
  detail,
  announce = 'status',
  className,
}: ErrorStateProps) {
  return (
    <div
      role={announce}
      className={cn(
        'flex flex-col items-start gap-3 rounded-ff-card border border-ff-coral-700 bg-ff-coral-50 p-6 text-ff-ink',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-1 size-6 shrink-0 text-ff-coral-700" />
        <div className="flex flex-col gap-1">
          <Heading level={headingLevel}>{title}</Heading>
          {body && <p>{body}</p>}
          {detail && <p className="text-sm text-ff-muted">{detail}</p>}
        </div>
      </div>
      {onRetry && (
        <Button loading={retrying} loadingLabel="Retrying..." onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

export interface DeniedStateProps {
  title: ReactNode;
  body?: ReactNode;
  headingLevel?: HeadingLevel;
  action?: ReactNode;
  className?: string;
}

/** Access denied. Neutral (not red); copy must not reveal whether the resource exists. */
export function DeniedState({
  title,
  body,
  headingLevel = 2,
  action,
  className,
}: DeniedStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-start gap-3 rounded-ff-card border border-ff-border-strong bg-ff-surface p-6 text-ff-ink',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Lock aria-hidden="true" className="mt-1 size-6 shrink-0 text-ff-ink" />
        <div className="flex flex-col gap-1">
          <Heading level={headingLevel}>{title}</Heading>
          {body && <p className="text-ff-muted">{body}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export type NoticeTone = 'info' | 'warning' | 'success' | 'danger';

const noticeStyles: Record<NoticeTone, { box: string; icon: ReactNode }> = {
  info: {
    box: 'bg-ff-violet-50 border-ff-violet-700',
    icon: <Info aria-hidden="true" className="size-5 text-ff-violet-700" />,
  },
  warning: {
    box: 'bg-ff-sun-50 border-ff-ink',
    icon: <TriangleAlert aria-hidden="true" className="size-5 text-ff-ink" />,
  },
  success: {
    box: 'bg-ff-mint-50 border-ff-mint-700',
    icon: <CircleCheck aria-hidden="true" className="size-5 text-ff-mint-700" />,
  },
  danger: {
    box: 'bg-ff-coral-50 border-ff-coral-700',
    icon: <CircleAlert aria-hidden="true" className="size-5 text-ff-coral-700" />,
  },
};

export interface NoticeProps {
  tone?: NoticeTone;
  title?: ReactNode;
  /**
   * Set when the notice appears dynamically and must be announced
   * (role="status", or "alert" for danger). Static notices carry no role.
   */
  announce?: boolean;
  className?: string;
  children?: ReactNode;
}

export function Notice({
  tone = 'info',
  title,
  announce = false,
  className,
  children,
}: NoticeProps) {
  const role = announce ? (tone === 'danger' ? 'alert' : 'status') : undefined;
  const { box, icon } = noticeStyles[tone];
  return (
    <div
      role={role}
      className={cn(
        'flex items-start gap-3 rounded-ff-button border p-4 text-ff-ink',
        box,
        className,
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex flex-col gap-0.5">
        {title && (
          <p className="font-semibold">
            {tone === 'warning' && <span>Heads up: </span>}
            {title}
          </p>
        )}
        {children &&
          (tone === 'warning' && !title ? (
            <p>
              <span className="font-semibold">Heads up: </span>
              {children}
            </p>
          ) : (
            <div className="text-ff-ink">{children}</div>
          ))}
      </div>
    </div>
  );
}
