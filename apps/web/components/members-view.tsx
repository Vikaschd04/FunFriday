'use client';

import { Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { addMemberRequestSchema, type Member, type OrgRole } from '@funfriday/contracts';
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Notice,
  Select,
  Skeleton,
  TextField,
  useAnnounce,
} from '@funfriday/ui';
import { formatAbsolute } from '@/lib/audit-text';
import {
  addMember,
  changeMemberRole,
  fetchMembers,
  removeMember,
  type ApiFailure,
} from '@/lib/identity-api';
import { ROLE_LABEL, ROLE_OPTIONS, canManageMembers } from '@/lib/roles';
import { actionFailureText, FailureState } from './failure-state';
import { PageHeader } from './page-header';
import { scopeOrgId, WithOrg } from './org-scope';
import { useMe, useSession } from './session-provider';
import { useApi } from './use-api';

function conflictText(failure: ApiFailure, subject: string): string {
  if (failure.kind === 'conflict' && failure.code === 'LAST_ADMIN') {
    return `${subject} is the last Admin. Make someone else an Admin first, then try again.`;
  }
  if (failure.kind === 'conflict') {
    return 'That conflicts with the current state of the organisation. Refresh the page and try again.';
  }
  return actionFailureText(failure, "We couldn't save that change. Try again in a moment.");
}

function AddMemberForm({ orgId, onAdded }: { orgId: string; onAdded: () => void }) {
  const announce = useAnnounce();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrgRole>('participant');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setFailure(null);
    setSuccess(null);
    const parsed = addMemberRequestSchema.safeParse({ email, role });
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message);
      input.current?.focus();
      return;
    }
    setEmailError(undefined);
    setBusy(true);
    const result = await addMember(orgId, parsed.data);
    setBusy(false);
    if (result.kind === 'ok') {
      // Identical wording whether or not that email already has an account.
      const text = `Invitation sent to ${parsed.data.email}. They'll join after accepting it.`;
      setSuccess(text);
      announce(text, { tone: 'success' });
      setEmail('');
      onAdded();
      input.current?.focus();
    } else if (result.kind === 'invalid') {
      setEmailError(result.fieldErrors.email?.[0] ?? 'Check the email address and try again.');
      input.current?.focus();
    } else if (result.kind === 'conflict') {
      setFailure('That email is already in this organisation.');
    } else {
      setFailure(actionFailureText(result, "We couldn't add that person. Try again in a moment."));
    }
  };

  return (
    <Card as="section" aria-labelledby="add-member-title">
      <h2 id="add-member-title" className="font-heading text-lg font-bold text-ff-ink">
        Add a member
      </h2>
      <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <TextField
            ref={input}
            label="Email"
            name="member-email"
            type="email"
            autoComplete="off"
            required
            value={email}
            error={emailError}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
          />
          <Select
            label="Role"
            name="member-role"
            value={role}
            options={ROLE_OPTIONS}
            onChange={(e) => {
              setRole(e.target.value as OrgRole);
            }}
          />
        </div>
        {failure && (
          <Notice tone="danger" announce>
            {failure}
          </Notice>
        )}
        {success && <Notice tone="success">{success}</Notice>}
        <div>
          <Button type="submit" loading={busy} loadingLabel="Adding...">
            Add member
          </Button>
        </div>
      </form>
    </Card>
  );
}

interface Pending {
  kind: 'demote' | 'remove';
  member: Member;
  role?: OrgRole;
}

export function MembersView({ orgParam }: { orgParam?: string }) {
  return (
    <WithOrg orgParam={orgParam}>
      {(scope) => (
        <MembersBody
          orgId={scopeOrgId(scope)}
          orgName={scope.kind === 'member' ? scope.org.name : null}
          role={scope.kind === 'member' ? scope.role : null}
        />
      )}
    </WithOrg>
  );
}

function MembersBody({
  orgId,
  orgName,
  role,
}: {
  orgId: string;
  orgName: string | null;
  role: OrgRole | null;
}) {
  const me = useMe();
  const { reload: reloadSession } = useSession();
  const announce = useAnnounce();
  const members = useApi((signal) => fetchMembers(orgId, { signal }), `members:${orgId}`);
  const admin = canManageMembers(role);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);

  const setRowError = (id: string, text: string | null) => {
    setRowErrors((prev) => {
      const next = { ...prev };
      if (text) next[id] = text;
      else delete next[id];
      return next;
    });
  };

  const nameOf = (m: Member) => m.name?.trim() || m.email || 'This member';

  const applyRole = async (member: Member, newRole: OrgRole) => {
    setBusyId(member.id);
    setRowError(member.id, null);
    const result = await changeMemberRole(orgId, member.id, newRole);
    setBusyId(null);
    if (result.kind === 'ok') {
      announce(`${nameOf(member)} is now ${ROLE_LABEL[newRole]}.`, { tone: 'success' });
      members.reload();
      await reloadSession();
    } else {
      setRowError(member.id, conflictText(result, nameOf(member)));
    }
  };

  const applyRemove = async (member: Member) => {
    setBusyId(member.id);
    setRowError(member.id, null);
    const result = await removeMember(orgId, member.id);
    setBusyId(null);
    if (result.kind === 'ok') {
      announce(`${nameOf(member)} was removed.`, { tone: 'success' });
      members.reload();
      await reloadSession();
      listHeading.current?.focus();
    } else {
      setRowError(member.id, conflictText(result, nameOf(member)));
    }
  };

  const confirm = () => {
    const current = pending;
    setPending(null);
    if (!current) return;
    if (current.kind === 'remove') void applyRemove(current.member);
    else if (current.role) void applyRole(current.member, current.role);
  };

  const result = members.result;
  const list = result?.kind === 'ok' ? result.data.members : [];

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Members"
        description={
          orgName
            ? `People in ${orgName}.${admin ? '' : ' Only Admins can add or change members.'}`
            : undefined
        }
      />

      {members.loading && <Skeleton variant="block" count={3} label="Loading members..." />}
      {result && result.kind !== 'ok' && (
        <FailureState
          failure={result}
          what="the member list"
          onRetry={members.reload}
          retrying={members.refreshing}
        />
      )}

      {admin && result?.kind === 'ok' && <AddMemberForm orgId={orgId} onAdded={members.reload} />}

      {result?.kind === 'ok' && (
        <section aria-labelledby="member-list-title">
          <h2
            ref={listHeading}
            tabIndex={-1}
            id="member-list-title"
            className="font-heading text-[22px] leading-[30px] font-bold text-ff-ink"
          >
            {list.length} {list.length === 1 ? 'member' : 'members'}
          </h2>
          {list.length === 0 ? (
            <EmptyState
              title="No members yet"
              body="Members you add will appear here."
              className="mt-4"
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {list.map((member) => {
                const label = nameOf(member);
                const isMe = member.email !== undefined && member.email === me.user.email;
                const error = rowErrors[member.id];
                const busy = busyId === member.id;
                return (
                  <li key={member.id}>
                    <Card className="gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-heading text-lg font-bold break-words text-ff-ink">
                            {member.name?.trim() ||
                              (member.email ? 'Invited member' : 'Invited member')}
                            {isMe && <span className="font-normal text-ff-muted"> (you)</span>}
                          </h3>
                          {member.email && (
                            <p className="break-all text-ff-muted">{member.email}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="brand">{ROLE_LABEL[member.role]}</Badge>
                          <Badge tone={member.status === 'active' ? 'success' : 'warning'}>
                            {member.status === 'active' ? 'Active' : 'Invited'}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-ff-muted">
                        {member.joinedAt
                          ? `Joined ${formatAbsolute(member.joinedAt)}`
                          : 'Has not joined yet'}
                      </p>
                      {admin && (
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="min-w-44">
                            <Select
                              label={`Role for ${label}`}
                              value={member.role}
                              options={ROLE_OPTIONS}
                              disabled={busy}
                              onChange={(event) => {
                                const next = event.target.value as OrgRole;
                                if (next === member.role) return;
                                if (member.role === 'admin') {
                                  trigger.current = event.target;
                                  setPending({ kind: 'demote', member, role: next });
                                } else {
                                  void applyRole(member, next);
                                }
                              }}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            className="text-ff-coral-700! hover:bg-ff-coral-50"
                            iconStart={<Trash2 />}
                            disabled={busy}
                            aria-label={`Remove ${label}`}
                            onClick={(event) => {
                              trigger.current = event.currentTarget;
                              setPending({ kind: 'remove', member });
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                      {error && (
                        <p role="alert" className="font-semibold text-ff-coral-700">
                          {error}
                        </p>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <Dialog
        open={pending !== null}
        onClose={() => {
          setPending(null);
        }}
        returnFocusRef={trigger}
        title={
          pending?.kind === 'remove'
            ? `Remove ${pending ? nameOf(pending.member) : ''}?`
            : `Change ${pending ? nameOf(pending.member) : ''} from Admin to ${pending?.role ? ROLE_LABEL[pending.role] : ''}?`
        }
        description={
          pending?.kind === 'remove'
            ? 'They lose access to this organisation and are taken out of its teams. You can add them again later.'
            : 'They will no longer be able to manage members, roles, teams or the audit log.'
        }
        actions={
          <>
            <Button
              variant="secondary"
              data-autofocus
              onClick={() => {
                setPending(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={confirm}>
              {pending?.kind === 'remove' ? 'Remove member' : 'Change role'}
            </Button>
          </>
        }
      />
    </div>
  );
}
