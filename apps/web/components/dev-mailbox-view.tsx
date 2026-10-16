'use client';

import { Mail } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, Notice, Skeleton } from '@funfriday/ui';
import { formatAbsolute, formatRelative } from '@/lib/audit-text';
import { fetchDevMailbox } from '@/lib/identity-api';
import { LinkButton } from '@funfriday/ui';
import { useApi } from './use-api';
import { PageHeader } from './page-header';

function linkLabel(link: string): string {
  if (link.includes('/verify-email')) return 'Verify email';
  if (link.includes('/invitations/accept')) return 'Open invitation';
  return 'Open link';
}

export function DevMailboxView() {
  const mailbox = useApi((signal) => fetchDevMailbox({ signal }), 'mailbox');
  const result = mailbox.result;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pt-8">
      <PageHeader
        title="Dev mailbox"
        description="Local development only. These are the emails FunFriday would have sent."
      />
      {mailbox.loading && <Skeleton variant="block" count={2} label="Loading messages..." />}

      {result?.kind === 'not_found' && (
        <EmptyState
          title="The dev mailbox is turned off"
          body="This server isn't configured to keep a local mailbox, so there is nothing to show here."
        />
      )}

      {result && result.kind !== 'ok' && result.kind !== 'not_found' && (
        <ErrorState
          title="We can't load the mailbox"
          body="We can't reach the FunFriday API. Check that it is running and try again."
          onRetry={mailbox.reload}
          retrying={mailbox.refreshing}
        />
      )}

      {result?.kind === 'ok' && (
        <>
          <div>
            <Button
              variant="secondary"
              loading={mailbox.refreshing}
              loadingLabel="Refreshing..."
              onClick={mailbox.reload}
            >
              Refresh
            </Button>
          </div>
          {result.data.messages.length === 0 ? (
            <EmptyState
              illustration={<Mail className="size-16" />}
              title="No messages yet"
              body="Verification emails show up here a moment after sign-up."
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {result.data.messages.map((message) => (
                <li key={message.id}>
                  <Card as="article" aria-labelledby={`mail-${message.id}`}>
                    <h2
                      id={`mail-${message.id}`}
                      className="font-heading text-lg font-bold break-words text-ff-ink"
                    >
                      {message.subject}
                    </h2>
                    <p className="break-all text-ff-ink">
                      <span className="text-ff-muted">To: </span>
                      {message.to}
                    </p>
                    <p className="text-sm text-ff-muted">
                      <time dateTime={message.createdAt} title={formatAbsolute(message.createdAt)}>
                        {formatRelative(message.createdAt)}
                      </time>
                      {' - '}
                      {formatAbsolute(message.createdAt)}
                    </p>
                    {message.links.length > 0 ? (
                      <div className="flex flex-wrap gap-3 pt-1">
                        {message.links.map((link) => (
                          <LinkButton key={link} href={link} variant="secondary">
                            {linkLabel(link)}
                            <span className="sr-only"> for {message.to}</span>
                          </LinkButton>
                        ))}
                      </div>
                    ) : (
                      <Notice tone="info">This message has no links.</Notice>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
