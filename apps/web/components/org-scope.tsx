'use client';

import type { ReactNode } from 'react';
import { EmptyState } from '@funfriday/ui';
import { AppLinkButton } from './app-link-button';
import { useOrgScope, type OrgScope } from './session-provider';

/** Resolves which organisation a settings screen is about; no organisation -> a way to make one. */
export function WithOrg({
  orgParam,
  children,
}: {
  orgParam?: string;
  children: (scope: Exclude<OrgScope, { kind: 'none' }>) => ReactNode;
}) {
  const scope = useOrgScope(orgParam);
  if (scope.kind === 'none') {
    return (
      <EmptyState
        title="You're not in an organisation yet"
        body="Create one from your dashboard, or ask an Admin to add you with this email address."
        primaryAction={<AppLinkButton href="/app">Go to dashboard</AppLinkButton>}
      />
    );
  }
  return <>{children(scope)}</>;
}

export function scopeOrgId(scope: Exclude<OrgScope, { kind: 'none' }>): string {
  return scope.kind === 'member' ? scope.org.id : scope.orgId;
}
