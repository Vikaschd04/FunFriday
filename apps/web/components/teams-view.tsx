'use client';

import { Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  createTeamRequestSchema,
  type MemberListResponse,
  type OrgRole,
  type Team,
} from '@funfriday/contracts';
import {
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
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  fetchMembers,
  fetchTeams,
  removeTeamMember,
  type ApiResult,
} from '@/lib/identity-api';
import { canManageTeams } from '@/lib/roles';
import { actionFailureText, FailureState } from './failure-state';
import { PageHeader } from './page-header';
import { scopeOrgId, WithOrg } from './org-scope';
import { useApi } from './use-api';

export function TeamsView({ orgParam }: { orgParam?: string }) {
  return (
    <WithOrg orgParam={orgParam}>
      {(scope) => (
        <TeamsBody
          orgId={scopeOrgId(scope)}
          orgName={scope.kind === 'member' ? scope.org.name : null}
          role={scope.kind === 'member' ? scope.role : null}
        />
      )}
    </WithOrg>
  );
}

function CreateTeamForm({ orgId, onCreated }: { orgId: string; onCreated: () => void }) {
  const announce = useAnnounce();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setFailure(null);
    const parsed = createTeamRequestSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      input.current?.focus();
      return;
    }
    setError(undefined);
    setBusy(true);
    const result = await createTeam(orgId, parsed.data);
    setBusy(false);
    if (result.kind === 'ok') {
      announce(`Team ${result.data.name} created.`, { tone: 'success' });
      setName('');
      onCreated();
      input.current?.focus();
    } else if (result.kind === 'conflict') {
      setError('A team with that name already exists. Choose a different name.');
      input.current?.focus();
    } else if (result.kind === 'invalid') {
      setError(result.fieldErrors.name?.[0] ?? 'Check the team name and try again.');
      input.current?.focus();
    } else {
      setFailure(actionFailureText(result, "We couldn't create the team. Try again in a moment."));
    }
  };

  return (
    <Card as="section" aria-labelledby="create-team-title">
      <h2 id="create-team-title" className="font-heading text-lg font-bold text-ff-ink">
        Create a team
      </h2>
      <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <TextField
          ref={input}
          label="Team name"
          name="team-name"
          autoComplete="off"
          required
          value={name}
          error={error}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
        {failure && (
          <Notice tone="danger" announce>
            {failure}
          </Notice>
        )}
        <div>
          <Button type="submit" loading={busy} loadingLabel="Creating...">
            Create team
          </Button>
        </div>
      </form>
    </Card>
  );
}

function TeamCard({
  orgId,
  team,
  manage,
  candidates,
  onChanged,
  onDelete,
}: {
  orgId: string;
  team: Team;
  manage: boolean;
  candidates: { value: string; label: string }[];
  onChanged: () => void;
  onDelete: (team: Team, trigger: HTMLElement) => void;
}) {
  const announce = useAnnounce();
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const memberIds = new Set(team.members.map((m) => m.memberId));
  const options = candidates.filter((c) => !memberIds.has(c.value));

  const add = async () => {
    if (!choice || busy) return;
    setBusy(true);
    setError(null);
    const result = await addTeamMember(orgId, team.id, choice);
    setBusy(false);
    if (result.kind === 'ok') {
      announce(`Added to ${team.name}.`, { tone: 'success' });
      setChoice('');
      onChanged();
    } else {
      setError(
        result.kind === 'conflict'
          ? 'Only active members can join a team.'
          : actionFailureText(result, "We couldn't add that member. Try again in a moment."),
      );
    }
  };

  const remove = async (memberId: string, label: string) => {
    setBusy(true);
    setError(null);
    const result = await removeTeamMember(orgId, team.id, memberId);
    setBusy(false);
    if (result.kind === 'ok') {
      announce(`${label} removed from ${team.name}.`, { tone: 'success' });
      onChanged();
    } else {
      setError(actionFailureText(result, "We couldn't remove that member. Try again in a moment."));
    }
  };

  return (
    <Card className="h-full gap-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading text-lg font-bold break-words text-ff-ink">{team.name}</h3>
        {manage && (
          <Button
            variant="ghost"
            className="text-ff-coral-700! hover:bg-ff-coral-50"
            iconStart={<Trash2 />}
            aria-label={`Delete team ${team.name}`}
            onClick={(event) => {
              onDelete(team, event.currentTarget);
            }}
          >
            Delete
          </Button>
        )}
      </div>
      {team.members.length === 0 ? (
        <p className="text-ff-muted">No members in this team yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {team.members.map((m) => {
            const label = m.name?.trim() || 'Member';
            return (
              <li key={m.memberId} className="flex items-center justify-between gap-2">
                <span className="break-words text-ff-ink">{label}</span>
                {manage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    iconStart={<X />}
                    aria-label={`Remove ${label} from ${team.name}`}
                    onClick={() => void remove(m.memberId, label)}
                  >
                    Remove
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {manage && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-44 flex-1">
            <Select
              label={`Add a member to ${team.name}`}
              value={choice}
              placeholder={options.length ? 'Choose a member' : 'Everyone active is in this team'}
              options={options}
              disabled={options.length === 0 || busy}
              onChange={(e) => {
                setChoice(e.target.value);
              }}
            />
          </div>
          <Button variant="secondary" loading={busy} disabled={!choice} onClick={() => void add()}>
            Add<span className="sr-only"> to {team.name}</span>
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="font-semibold text-ff-coral-700">
          {error}
        </p>
      )}
    </Card>
  );
}

function TeamsBody({
  orgId,
  orgName,
  role,
}: {
  orgId: string;
  orgName: string | null;
  role: OrgRole | null;
}) {
  const announce = useAnnounce();
  const manage = canManageTeams(role);
  const teams = useApi((signal) => fetchTeams(orgId, { signal }), `teams:${orgId}`);
  const members = useApi(
    (signal): Promise<ApiResult<MemberListResponse>> =>
      manage
        ? fetchMembers(orgId, { signal })
        : Promise.resolve({ kind: 'ok', data: { members: [] } }),
    `team-members:${orgId}:${String(manage)}`,
  );
  const [toDelete, setToDelete] = useState<Team | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const candidates =
    members.result?.kind === 'ok'
      ? members.result.data.members
          .filter((m) => m.status === 'active')
          .map((m) => ({ value: m.id, label: m.name?.trim() || m.email || 'Member' }))
      : [];

  const confirmDelete = async () => {
    const team = toDelete;
    setToDelete(null);
    if (!team) return;
    const result = await deleteTeam(orgId, team.id);
    if (result.kind === 'ok') {
      setDeleteError(null);
      announce(`Team ${team.name} deleted.`, { tone: 'success' });
      teams.reload();
      heading.current?.focus();
    } else {
      setDeleteError(actionFailureText(result, "We couldn't delete that team. Try again."));
    }
  };

  const result = teams.result;
  const list = result?.kind === 'ok' ? result.data.teams : [];

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Teams"
        description={
          orgName
            ? `Groups of people in ${orgName}.${manage ? '' : ' Only Admins and Hosts can change teams.'}`
            : undefined
        }
      />
      {teams.loading && <Skeleton variant="block" count={3} label="Loading teams..." />}
      {result && result.kind !== 'ok' && (
        <FailureState
          failure={result}
          what="teams"
          onRetry={teams.reload}
          retrying={teams.refreshing}
        />
      )}
      {manage && result?.kind === 'ok' && <CreateTeamForm orgId={orgId} onCreated={teams.reload} />}
      {members.result && members.result.kind !== 'ok' && manage && (
        <FailureState failure={members.result} what="members" onRetry={members.reload} />
      )}
      {deleteError && (
        <Notice tone="danger" announce>
          {deleteError}
        </Notice>
      )}
      {result?.kind === 'ok' && (
        <section aria-labelledby="team-list-title">
          <h2
            ref={heading}
            tabIndex={-1}
            id="team-list-title"
            className="font-heading text-[22px] leading-[30px] font-bold text-ff-ink"
          >
            {list.length} {list.length === 1 ? 'team' : 'teams'}
          </h2>
          {list.length === 0 ? (
            <EmptyState
              className="mt-4"
              title="No teams yet"
              body={
                manage
                  ? 'Create a team above to group people for events.'
                  : 'Admins and Hosts can create teams.'
              }
            />
          ) : (
            <ul className="mt-4 grid gap-4 lg:grid-cols-2">
              {list.map((team) => (
                <li key={team.id}>
                  <TeamCard
                    orgId={orgId}
                    team={team}
                    manage={manage}
                    candidates={candidates}
                    onChanged={teams.reload}
                    onDelete={(t, el) => {
                      trigger.current = el;
                      setToDelete(t);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <Dialog
        open={toDelete !== null}
        onClose={() => {
          setToDelete(null);
        }}
        returnFocusRef={trigger}
        title={`Delete ${toDelete?.name ?? 'this team'}?`}
        description="The team is removed. The people in it stay in the organisation."
        actions={
          <>
            <Button
              variant="secondary"
              data-autofocus
              onClick={() => {
                setToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()}>
              Delete team
            </Button>
          </>
        }
      />
    </div>
  );
}
