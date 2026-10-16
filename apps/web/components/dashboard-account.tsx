'use client';

import { useRef, useState } from 'react';
import { createOrganizationRequestSchema } from '@funfriday/contracts';
import { Button, Card, LinkButton, Notice, TextField, useAnnounce } from '@funfriday/ui';
import { sendVerificationEmail } from '@/lib/auth';
import { createOrganization, fetchDevMailbox } from '@/lib/identity-api';
import { useMe, useSession } from './session-provider';
import { useApi } from './use-api';

/** Shown while the signed-in email is not verified. Server truth: `needsEmailVerification`. */
export function VerifyEmailNotice() {
  const me = useMe();
  const announce = useAnnounce();
  const mailbox = useApi((signal) => fetchDevMailbox({ signal }), 'mailbox-probe');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  if (!me.needsEmailVerification) return null;

  const resend = async () => {
    setBusy(true);
    setMessage(null);
    const result = await sendVerificationEmail(me.user.email);
    setBusy(false);
    if (result.kind === 'ok') {
      const text = `Verification email sent to ${me.user.email}.`;
      setMessage({ tone: 'success', text });
      announce(text, { tone: 'success' });
    } else {
      setMessage({
        tone: 'danger',
        text:
          result.kind === 'rate_limited'
            ? 'Too many requests. Wait a moment, then try again.'
            : "We couldn't send the email. Try again in a moment.",
      });
    }
  };

  return (
    <Notice tone="warning" title="Verify your email address">
      <p>
        We sent a verification link to <strong className="break-all">{me.user.email}</strong>. Open
        it to verify this address.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          loading={busy}
          loadingLabel="Sending..."
          onClick={() => void resend()}
        >
          Resend email
        </Button>
        {mailbox.result?.kind === 'ok' && (
          <LinkButton href="/dev/mailbox" variant="ghost">
            Open the dev mailbox
          </LinkButton>
        )}
      </div>
      {message && (
        <p role={message.tone === 'danger' ? 'alert' : 'status'} className="mt-2 text-sm">
          {message.text}
        </p>
      )}
    </Notice>
  );
}

/** First-run: a signed-in user with no organisation creates one and becomes its Admin. */
export function OnboardingCard() {
  const { reload, setCurrentOrgId } = useSession();
  const announce = useAnnounce();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setFormError(null);
    const parsed = createOrganizationRequestSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      input.current?.focus();
      return;
    }
    setError(undefined);
    setBusy(true);
    const result = await createOrganization(parsed.data);
    if (result.kind === 'ok') {
      setCurrentOrgId(result.data.id);
      await reload();
      announce(`Organisation ${result.data.name} created. You are its Admin.`, { tone: 'success' });
      return;
    }
    setBusy(false);
    if (result.kind === 'invalid') {
      setError(result.fieldErrors.name?.[0] ?? result.message ?? 'Check the name and try again.');
      input.current?.focus();
    } else if (result.kind === 'rate_limited') {
      setFormError('Too many requests. Wait a moment, then try again.');
    } else if (result.kind === 'unreachable') {
      setFormError("We can't reach FunFriday. Check your connection and try again.");
    } else {
      setFormError("We couldn't create the organisation. Try again in a moment.");
    }
  };

  return (
    <Card tone="brand" as="section" aria-labelledby="onboarding-title" className="max-w-2xl">
      <h2
        id="onboarding-title"
        className="font-heading text-[22px] leading-[30px] font-bold text-ff-ink"
      >
        Create your organisation
      </h2>
      <p className="text-ff-ink">
        An organisation is your team&apos;s workspace. You&apos;ll be its Admin and can add
        colleagues once it exists. If someone already added you to one, ask them to invite you with
        this email address.
      </p>
      {formError && (
        <Notice tone="danger" announce>
          {formError}
        </Notice>
      )}
      <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <TextField
          ref={input}
          label="Organisation name"
          name="organisation"
          autoComplete="organization"
          required
          value={name}
          error={error}
          hint="For example, your company or team name."
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
        <div>
          <Button type="submit" loading={busy} loadingLabel="Creating...">
            Create organisation
          </Button>
        </div>
      </form>
    </Card>
  );
}
