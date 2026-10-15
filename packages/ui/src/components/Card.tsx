import { type HTMLAttributes, type ReactNode, createElement } from 'react';
import { cn } from './cn.js';

export type CardTone = 'default' | 'brand' | 'subtle';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'li';
  /** Adds the hover lift. Use only when the whole card is one link (see CardLinkOverlay docs). */
  interactive?: boolean;
  tone?: CardTone;
  header?: ReactNode;
  footer?: ReactNode;
}

const tones: Record<CardTone, string> = {
  default: 'bg-ff-surface shadow-ff-sm',
  brand: 'bg-ff-violet-50 shadow-ff-sm',
  subtle: 'bg-ff-canvas border border-ff-border',
};

/**
 * Surface container. For a fully clickable card, put exactly one link inside and
 * give it `after:absolute after:inset-0`; never nest buttons inside a link card.
 */
export function Card({
  as = 'div',
  interactive = false,
  tone = 'default',
  header,
  footer,
  className,
  children,
  ...rest
}: CardProps) {
  return createElement(
    as,
    {
      ...rest,
      className: cn(
        'relative flex flex-col gap-4 rounded-ff-card p-4 text-ff-ink md:p-6',
        tones[tone],
        interactive &&
          'ff-lift focus-within:outline focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-ff-violet-800',
        className,
      ),
    },
    header && <div className="flex flex-col gap-1">{header}</div>,
    <div className="flex flex-1 flex-col gap-3">{children}</div>,
    footer && <div className="mt-auto flex flex-wrap items-center gap-3">{footer}</div>,
  );
}
