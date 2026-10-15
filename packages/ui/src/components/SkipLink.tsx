'use client';

import { type AnchorHTMLAttributes } from 'react';
import { cn } from './cn.js';

export interface SkipLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** id of the main landmark (needs no tabindex; one is added on activation). */
  targetId?: string;
}

/** First tabbable element on the page. Visually hidden until focused. */
export function SkipLink({
  targetId = 'main',
  className,
  children = 'Skip to main content',
  onClick,
  ...rest
}: SkipLinkProps) {
  return (
    <a
      {...rest}
      href={`#${targetId}`}
      onClick={(event) => {
        onClick?.(event);
        const target = document.getElementById(targetId);
        if (target) {
          if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
          target.focus();
        }
      }}
      className={cn(
        'absolute top-[-80px] left-4 z-100 inline-flex min-h-11 items-center rounded-ff-button bg-ff-violet-700 px-5 font-semibold text-white focus:top-4',
        className,
      )}
    >
      {children}
    </a>
  );
}
