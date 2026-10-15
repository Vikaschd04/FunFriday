import { cn } from './cn.js';

export interface SkeletonProps {
  variant?: 'line' | 'block' | 'card';
  count?: number;
  /** Text read by assistive tech, e.g. "Loading activities". */
  label?: string;
  className?: string;
}

const shapes = {
  line: 'h-4 w-full rounded-ff-sm',
  block: 'h-24 w-full rounded-ff-card',
  card: 'h-56 w-full rounded-ff-card',
} as const;

/**
 * Placeholder with shimmer (flat tint under reduced motion). The container is
 * aria-busy with a role="status" label; the shapes are aria-hidden. Screens must
 * resolve to content or an error state, not skeleton forever.
 */
export function Skeleton({
  variant = 'line',
  count = 1,
  label = 'Loading',
  className,
}: SkeletonProps) {
  return (
    <div aria-busy="true" className={cn('flex flex-col gap-3', className)}>
      <p role="status" className="sr-only">
        {label}
      </p>
      {Array.from({ length: Math.max(1, count) }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={cn(
            'ff-skeleton',
            shapes[variant],
            variant === 'line' && index === count - 1 && count > 1 && 'w-2/3',
          )}
        />
      ))}
    </div>
  );
}
