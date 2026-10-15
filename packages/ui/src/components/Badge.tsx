import { CircleAlert, CircleCheck, Hammer, Info, TriangleAlert } from 'lucide-react';
import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn.js';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-ff-surface text-ff-ink border border-ff-border-strong',
  brand: 'bg-ff-violet-50 text-ff-violet-700',
  success: 'bg-ff-mint-50 text-ff-mint-700',
  warning: 'bg-ff-sun-50 text-ff-ink',
  danger: 'bg-ff-coral-50 text-ff-coral-700',
  info: 'bg-ff-violet-50 text-ff-violet-700',
};

const defaultIcons: Partial<Record<BadgeTone, ReactNode>> = {
  success: <CircleCheck aria-hidden="true" className="size-4 shrink-0" />,
  warning: <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />,
  danger: <CircleAlert aria-hidden="true" className="size-4 shrink-0" />,
  info: <Info aria-hidden="true" className="size-4 shrink-0" />,
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Overrides the tone icon. Status tones (success/warning/danger/info) always render an icon. */
  icon?: ReactNode;
}

/** Small pill: icon + text, never colour alone. Plain text, not interactive. */
export function Badge({ tone = 'neutral', icon, className, children, ...rest }: BadgeProps) {
  const shownIcon = icon ? (
    <span aria-hidden="true" className="inline-flex shrink-0 [&>svg]:size-4">
      {icon}
    </span>
  ) : (
    defaultIcons[tone]
  );
  return (
    <span
      {...rest}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs leading-4 font-semibold',
        toneClasses[tone],
        className,
      )}
    >
      {shownIcon}
      <span>{children}</span>
    </span>
  );
}

export const StatusPill = Badge;

/** The "In development" status used for catalog items that are not playable yet. */
export function InDevelopmentBadge({ children = 'In development' }: { children?: ReactNode }) {
  return (
    <Badge tone="neutral" icon={<Hammer />}>
      {children}
    </Badge>
  );
}
