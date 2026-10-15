'use client';

import { ExternalLink } from 'lucide-react';
import { type AnchorHTMLAttributes, type ReactNode, type Ref } from 'react';
import { type ButtonSize, type ButtonVariant, buttonStyles } from './Button.js';

export type LinkButtonRenderProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  ref?: Ref<HTMLAnchorElement>;
  children: ReactNode;
};

export interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Opens in a new tab with `noopener noreferrer`, an icon and hidden "(opens in a new tab)" text. */
  external?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  ref?: Ref<HTMLAnchorElement>;
  /**
   * Render the styled anchor props with another link component, e.g. next/link:
   * `render={(props) => <Link {...props} />}`. Without it a native `<a>` is rendered.
   */
  render?: (props: LinkButtonRenderProps) => ReactNode;
}

export function LinkButton({
  variant,
  size,
  fullWidth,
  external = false,
  iconStart,
  iconEnd,
  render,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  const content = (
    <>
      {iconStart && (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {iconStart}
        </span>
      )}
      <span>
        {children}
        {external && (
          <>
            {' '}
            <span className="sr-only">(opens in a new tab)</span>
          </>
        )}
      </span>
      {external ? (
        <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
      ) : (
        iconEnd && (
          <span aria-hidden="true" className="inline-flex shrink-0">
            {iconEnd}
          </span>
        )
      )}
    </>
  );
  const props: LinkButtonRenderProps = {
    ...rest,
    ...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
    className: buttonStyles({ variant, size, fullWidth, className }),
    children: content,
  };
  if (render) return <>{render(props)}</>;
  return <a {...props} />;
}
