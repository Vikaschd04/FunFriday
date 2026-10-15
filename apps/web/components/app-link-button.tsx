'use client';

import Link from 'next/link';
import { LinkButton, type LinkButtonProps } from '@funfriday/ui';

/**
 * ui LinkButton rendered through next/link so internal navigation is client-side.
 * Lives in a client module because the render function cannot cross the server boundary.
 */
export function AppLinkButton(props: Omit<LinkButtonProps, 'render'>) {
  return <LinkButton {...props} render={(anchor) => <Link {...anchor} href={props.href} />} />;
}
