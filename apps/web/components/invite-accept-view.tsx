'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button, Card, EmptyState, ErrorState, LinkButton, Skeleton } from '@funfriday/ui';
import { ROLE_LABEL } from '@/lib/roles';
import { signOut } from '@/lib/auth';
import { acceptInvitation, fetchMe, previewInvitation, type ApiResult } from '@/lib/identity-api';
import {
  clearInviteToken,
  parseInviteToken,
  readStoredInviteToken,
  storeInviteToken,
} from '@/lib/invite-token';
import { hardNavigate } from '@/lib/navigate';
import { CURRENT_ORG_KEY } from './session-provider';
import { useApi } from './use-api';
import type { InvitationPreviewResponse } from '@funfriday/contracts';

const NEXT = encodeURIComponent('/invitations/accept');

type Token = { state: 'reading' } | { state: 'missing' } | { state: 'ready'; token: string };

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [title]);
  return (
    <div className="mx-auto max-w-md pt-8 md:pt-12">
      <Card className="gap-5 p-6 md:p-8">
        <h1
          ref={heading}
          tabIndex={-1}
          className="font-heading text-[30px] leading-9 font-extrabold tracking-tight text-ff-ink outline-none"
        >
          {title}
        </h1>
        {children}
      </Card>
    </div>
  );
}

function Invalid({ expired = false }: { expired?: boolean }) {
  return (
    <div className="mx-auto max-w-xl pt-8">
      <EmptyState
        headingLevel={1}
        title={expired ? 'This invitation has expired' : "This invitation isn't valid"}
        body={
          expired
            ? 'This invitation has expired. Ask an admin to invite you again.'
            : "This invitation link isn't valid or has already been used."
        }
        primaryAction={<LinkButton href="/app">Go to dashboard</LinkButton>}
      />
    </div>
  );
}

export function InviteAcceptView() {
  const router = useRouter();
  const [token, setToken] = useState<Token>({ state: 'reading' });

  useEffect(() => {
    // Take the token out of the URL at once; keep it in this tab's sessionStorage only.
    const fromUrl = new URLSearchParams(window.location.search).get('token');
    if (fromUrl !== null) {
      const valid = parseInviteToken(fromUrl);
      if (valid) storeInviteToken(valid);
      router.replace('/invitations/accept');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(valid ? { state: 'ready', token: valid } : { state: 'missing' });
      return;
    }
    const stored = readStoredInviteToken();
    setToken(stored ? { state: 'ready', token: stored } : { state: 'missing' });
  }, [router]);

  if (token.state === 'reading') {
    return <Skeleton variant="block" label="Checking your invitation..." className="pt-8" />;
  }
  if (token.state === 'missing') return <Invalid />;
  return <Accept token={token.token} />;
}

function Accept({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState<ApiResult<unknown> | null>(null);
  const preview = useApi<InvitationPreviewResponse | 'signed_out'>(async (signal) => {
    const me = await fetchMe({ signal });
    if (me.kind === 'unauthenticated') return { kind: 'ok', data: 'signed_out' };
    if (me.kind !== 'ok') return me;
    return previewInvitation(token, { signal });
  }, token);
  const [signingOut, setSigningOut] = useState(false);

  const result = preview.result;
  if (preview.loading || !result) {
    return <Skeleton variant="block" label="Checking your invitation..." className="pt-8" />;
  }
  if (result.kind === 'not_found' || result.kind === 'invalid') return <Invalid />;
  if (result.kind === 'gone') return <Invalid expired />;
  if (result.kind !== 'ok') {
    return (
      <div className="mx-auto max-w-xl pt-8">
        <ErrorState
          headingLevel={1}
          title="We can't check your invitation"
          body="We can't reach FunFriday right now. Check your connection and try again."
          onRetry={preview.reload}
          retrying={preview.refreshing}
        />
      </div>
    );
  }

  if (result.data === 'signed_out') {
    return (
      <Shell title="Join your organisation">
        <p className="text-ff-ink">
          Sign in or create an account using the email address this invitation was sent to.
        </p>
        <div className="flex flex-wrap gap-3">
          <LinkButton href={`/sign-in?next=${NEXT}`}>Sign in</LinkButton>
          <LinkButton href={`/sign-up?next=${NEXT}`} variant="secondary">
            Create account
          </LinkButton>
        </div>
      </Shell>
    );
  }

  const invite = result.data;
  if (invite.alreadyMember) {
    return (
      <Shell title="You're already a member">
        <p className="text-ff-ink">
          You are already a member of <strong>{invite.organization.name}</strong>.
        </p>
        <div>
          <LinkButton href="/app">Go to dashboard</LinkButton>
        </div>
      </Shell>
    );
  }
  if (!invite.emailMatches) {
    return (
      <Shell title="Wrong account">
        <p className="text-ff-ink">
          This invitation was sent to a different email address. Sign out and use the right account.
        </p>
        <div>
          <Button
            loading={signingOut}
            loadingLabel="Signing out..."
            onClick={() => {
              setSigningOut(true);
              void signOut().then(() => {
                hardNavigate(`/sign-in?next=${NEXT}`);
              });
            }}
          >
            Sign out
          </Button>
        </div>
      </Shell>
    );
  }

  const join = async () => {
    setBusy(true);
    const outcome = await acceptInvitation(token);
    if (outcome.kind === 'ok') {
      try {
        window.localStorage.setItem(CURRENT_ORG_KEY, outcome.data.organization.id);
      } catch {
        // The dashboard falls back to the first organisation.
      }
      clearInviteToken();
      hardNavigate('/app?joined=1');
      return;
    }
    setBusy(false);
    setAccepted(outcome);
  };

  const failed = accepted && accepted.kind !== 'ok' ? accepted : null;
  if (failed?.kind === 'gone') return <Invalid expired />;
  if (failed?.kind === 'not_found') return <Invalid />;
  if (failed?.kind === 'forbidden' && failed.code === 'INVITE_EMAIL_MISMATCH') {
    return (
      <Shell title="Wrong account">
        <p className="text-ff-ink">
          This invitation was sent to a different email address. Sign out and use the right account.
        </p>
      </Shell>
    );
  }
  if (failed?.kind === 'conflict') {
    return (
      <Shell title="You're already a member">
        <div>
          <LinkButton href="/app">Go to dashboard</LinkButton>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={`Join ${invite.organization.name}`}>
      <p className="text-ff-ink">
        You&apos;ve been invited to join <strong>{invite.organization.name}</strong> as{' '}
        <strong>{ROLE_LABEL[invite.role]}</strong>.
      </p>
      {failed && (
        <p role="alert" className="font-semibold text-ff-coral-700">
          We couldn&apos;t join you just now. Check your connection and try again.
        </p>
      )}
      <div>
        <Button loading={busy} loadingLabel="Joining..." onClick={() => void join()}>
          Join {invite.organization.name}
        </Button>
      </div>
    </Shell>
  );
}
