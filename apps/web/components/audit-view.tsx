'use client';

import { useEffect, useState } from 'react';
import type { AuditEntry, AuditListResponse } from '@funfriday/contracts';
import { Button, Card, EmptyState, Notice, Skeleton, useAnnounce } from '@funfriday/ui';
import { describeAudit, formatAbsolute, formatRelative, memberLookup } from '@/lib/audit-text';
import { fetchAudit, fetchMembers, type ApiResult } from '@/lib/identity-api';
import { actionFailureText, FailureState } from './failure-state';
import { PageHeader } from './page-header';
import { scopeOrgId, WithOrg } from './org-scope';
import { useApi } from './use-api';

export function AuditView({ orgParam }: { orgParam?: string }) {
  return (
    <WithOrg orgParam={orgParam}>
      {(scope) => (
        <AuditBody
          orgId={scopeOrgId(scope)}
          orgName={scope.kind === 'member' ? scope.org.name : null}
        />
      )}
    </WithOrg>
  );
}

interface More {
  after: ApiResult<AuditListResponse>;
  entries: AuditEntry[];
  cursor: string | null;
}

function AuditBody({ orgId, orgName }: { orgId: string; orgName: string | null }) {
  const announce = useAnnounce();
  const audit = useApi((signal) => fetchAudit(orgId, undefined, { signal }), `audit:${orgId}`);
  const members = useApi((signal) => fetchMembers(orgId, { signal }), `audit-members:${orgId}`);
  const [more, setMore] = useState<More | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusId) return;
    document.getElementById(`audit-${focusId}`)?.focus();
  }, [focusId]);

  const result = audit.result;
  const first = result?.kind === 'ok' ? result.data : null;
  // "Load more" pages belong to the first page they were loaded after; a reload discards them.
  const extra = more && more.after === result ? more : null;
  const entries = first ? [...first.entries, ...(extra?.entries ?? [])] : [];
  const cursor = first ? (extra ? extra.cursor : first.nextCursor) : null;
  const names = memberLookup(members.result?.kind === 'ok' ? members.result.data.members : []);

  const loadMore = async () => {
    if (!cursor || !result || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    const page = await fetchAudit(orgId, cursor);
    setLoadingMore(false);
    if (page.kind === 'ok') {
      setMore({
        after: result,
        entries: [...(extra?.entries ?? []), ...page.data.entries],
        cursor: page.data.nextCursor,
      });
      const firstNew = page.data.entries[0];
      if (firstNew) setFocusId(firstNew.id);
      announce(`Loaded ${page.data.entries.length} more entries.`);
    } else {
      setMoreError(actionFailureText(page, "We couldn't load more entries. Try again."));
    }
  };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Audit log"
        description={
          orgName
            ? `Who changed what in ${orgName}, newest first. Only Admins can see this.`
            : undefined
        }
      />
      {audit.loading && <Skeleton variant="block" count={4} label="Loading audit log..." />}
      {result && result.kind !== 'ok' && (
        <FailureState
          failure={result}
          what="the audit log"
          onRetry={audit.reload}
          retrying={audit.refreshing}
          deniedBody="The audit log is only available to organisation Admins."
        />
      )}
      {first && entries.length === 0 && (
        <EmptyState
          title="Nothing here yet"
          body="Changes to members, roles and teams show up here."
        />
      )}
      {entries.length > 0 && (
        <ol aria-label="Audit entries" className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Card className="gap-1">
                <p
                  id={`audit-${entry.id}`}
                  tabIndex={-1}
                  className="font-semibold break-words text-ff-ink outline-offset-4"
                >
                  {describeAudit(entry, names)}
                </p>
                <p className="text-sm text-ff-muted">
                  <time dateTime={entry.createdAt}>{formatRelative(entry.createdAt, now)}</time>
                  {' - '}
                  {formatAbsolute(entry.createdAt)}
                </p>
              </Card>
            </li>
          ))}
        </ol>
      )}
      {moreError && (
        <Notice tone="danger" announce>
          {moreError}
        </Notice>
      )}
      {cursor && (
        <div>
          <Button
            variant="secondary"
            loading={loadingMore}
            loadingLabel="Loading..."
            onClick={() => void loadMore()}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
