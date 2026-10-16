'use client';

import { useState } from 'react';
import { personNameSchema } from '@funfriday/contracts';
import { Badge, Button, Card, Dialog, Notice, TextField, useAnnounce } from '@funfriday/ui';
import { revokeOtherSessions, updateDisplayName } from '@/lib/auth';
import { actionFailureText } from './failure-state';
import { PageHeader } from './page-header';
import { useMe, useSession } from './session-provider';

export function AccountView() {
  const me = useMe();
  const { reload } = useSession();
  const announce = useAnnounce();
  const [name, setName] = useState(me.user.name);
  const [nameError, setNameError] = useState<string | undefined>();
  const [nameResult, setNameResult] = useState<{ tone: 'success' | 'danger'; text: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokeResult, setRevokeResult] = useState<{
    tone: 'success' | 'danger';
    text: string;
  } | null>(null);

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setNameResult(null);
    const parsed = personNameSchema.safeParse(name);
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message);
      return;
    }
    setNameError(undefined);
    setSaving(true);
    const result = await updateDisplayName(parsed.data);
    setSaving(false);
    if (result.kind === 'ok') {
      await reload();
      setNameResult({ tone: 'success', text: 'Display name updated.' });
      announce('Display name updated.', { tone: 'success' });
    } else {
      setNameResult({
        tone: 'danger',
        text: actionFailureText(result, "We couldn't update your name. Try again in a moment."),
      });
    }
  };

  const revoke = async () => {
    setConfirmOpen(false);
    setRevoking(true);
    setRevokeResult(null);
    const result = await revokeOtherSessions();
    setRevoking(false);
    if (result.kind === 'ok') {
      const text = 'Signed out of all other devices. This device stays signed in.';
      setRevokeResult({ tone: 'success', text });
      announce(text, { tone: 'success' });
    } else {
      setRevokeResult({
        tone: 'danger',
        text: actionFailureText(result, "We couldn't sign out your other devices. Try again."),
      });
    }
  };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title="Account" description="Your sign-in details." />

      <Card as="section" aria-labelledby="acct-email">
        <h2 id="acct-email" className="font-heading text-lg font-bold text-ff-ink">
          Email
        </h2>
        <p className="break-all text-ff-ink">{me.user.email}</p>
        <div>
          {me.user.emailVerified ? (
            <Badge tone="success">Verified</Badge>
          ) : (
            <Badge tone="warning">Not verified</Badge>
          )}
        </div>
        {!me.user.emailVerified && (
          <p className="text-ff-muted">
            Use the link on your dashboard to resend the verification email.
          </p>
        )}
      </Card>

      <Card as="section" aria-labelledby="acct-name">
        <h2 id="acct-name" className="font-heading text-lg font-bold text-ff-ink">
          Display name
        </h2>
        <form noValidate onSubmit={(e) => void saveName(e)} className="flex flex-col gap-4">
          <TextField
            label="Your name"
            name="display-name"
            autoComplete="name"
            required
            value={name}
            error={nameError}
            onChange={(e) => {
              setName(e.target.value);
            }}
          />
          {nameResult && (
            <Notice tone={nameResult.tone} announce>
              {nameResult.text}
            </Notice>
          )}
          <div>
            <Button type="submit" loading={saving} loadingLabel="Saving...">
              Save name
            </Button>
          </div>
        </form>
      </Card>

      <Card as="section" aria-labelledby="acct-sessions">
        <h2 id="acct-sessions" className="font-heading text-lg font-bold text-ff-ink">
          Devices
        </h2>
        <p className="text-ff-muted">
          Signed in somewhere you don&apos;t use any more? Sign out of every other device. This one
          stays signed in.
        </p>
        {revokeResult && (
          <Notice tone={revokeResult.tone} announce>
            {revokeResult.text}
          </Notice>
        )}
        <div>
          <Button
            variant="secondary"
            loading={revoking}
            loadingLabel="Signing out..."
            onClick={() => {
              setConfirmOpen(true);
            }}
          >
            Sign out of other devices
          </Button>
        </div>
      </Card>

      <Dialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
        }}
        title="Sign out of other devices?"
        description="Anyone using your account on another device will need to sign in again."
        actions={
          <>
            <Button
              variant="secondary"
              data-autofocus
              onClick={() => {
                setConfirmOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void revoke()}>
              Sign out other devices
            </Button>
          </>
        }
      />
    </div>
  );
}
