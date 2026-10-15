'use client';

import { Check, CircleAlert, CircleDot, HardDrive } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { reviewEventPlan, type ActivitySummary, type PlanNotice } from '@funfriday/contracts';
import { Badge, Button, ErrorState, Notice, Skeleton, Stepper, useAnnounce } from '@funfriday/ui';
import {
  STEP_IDS,
  STEP_LABELS,
  defaultMinutes,
  draftFromForm,
  emptyForm,
  fieldIdFor,
  formFromDraft,
  isBasicsValid,
  labelDate,
  snapshot,
  timeZoneLabel,
  timeZoneOptions,
  validateStep,
  type FieldErrors,
  type FieldKey,
  type FormValues,
  type StepId,
} from '@/lib/builder-model';
import { getDraft, saveDraft } from '@/lib/drafts';
import { AppLinkButton } from '../app-link-button';
import { GuardedLink, useRegisterUnsavedGuard } from '../unsaved-guard';
import { useCatalog } from '../use-catalog';
import { PlanSummary } from './plan-summary';
import { StepActivities } from './step-activities';
import { StepBasics } from './step-basics';
import { StepParticipants } from './step-participants';
import { StepReview } from './step-review';

type Phase = 'loading' | 'ready' | 'missing' | 'corrupt';
type EditableStep = 'basics' | 'participants' | 'activities';
type SaveState = 'idle' | 'invalid' | 'storage-error' | 'limit';
type FocusTarget = 'summary' | 'heading';
type BlurKey =
  | 'title'
  | 'date'
  | 'time'
  | 'timeZone'
  | 'durationMinutes'
  | 'meetingUrl'
  | 'expectedParticipants';

const STEP_TITLES: Record<StepId, string> = {
  basics: 'Set the basics',
  participants: 'Who is it for?',
  activities: 'Choose activities',
  review: 'Review your plan',
};

const EDITABLE: EditableStep[] = ['basics', 'participants', 'activities'];

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function supportedZones(): string[] | null {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    return typeof intl.supportedValuesOf === 'function' ? intl.supportedValuesOf('timeZone') : null;
  } catch {
    return null;
  }
}

const timeLabel = (date: Date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

export function EventBuilder() {
  const params = useSearchParams();
  const draftParam = params.get('draft');
  const activityParam = params.get('activity');
  const announce = useAnnounce();
  const { catalog, reload } = useCatalog();

  const [phase, setPhase] = useState<Phase>('loading');
  const [values, setValues] = useState<FormValues>(() => emptyForm('UTC'));
  const [baseline, setBaseline] = useState('');
  const [browserZone, setBrowserZone] = useState('UTC');
  const [zones, setZones] = useState<string[]>(['UTC']);
  const [draftId, setDraftId] = useState<string | undefined>(undefined);
  const [step, setStep] = useState<StepId>('basics');
  const [completed, setCompleted] = useState<StepId[]>([]);
  const [attempted, setAttempted] = useState<Partial<Record<StepId, boolean>>>({});
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  // One focus request at a time, consumed by a single effect after the render that needs it.
  const [focusRequest, setFocusRequest] = useState<{ id: number; target: FocusTarget } | null>(
    null,
  );

  const valuesRef = useRef(values);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const playlistHeadingRef = useRef<HTMLHeadingElement>(null);
  const playlistRef = useRef<HTMLDivElement>(null);
  const removeFocus = useRef<number | null>(null);
  const activityApplied = useRef(false);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  // Hydrate once from the browser (zone, draft). Done in an effect so server HTML never disagrees.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time browser hydration */
    const zone = browserTimeZone();
    setBrowserZone(zone);
    setZones(timeZoneOptions(zone, supportedZones()));
    if (draftParam) {
      const found = getDraft(draftParam);
      if (!found.ok || found.item === null) {
        setPhase('missing');
        return;
      }
      if (found.item.kind === 'corrupt') {
        setPhase('corrupt');
        return;
      }
      const restored = formFromDraft(found.item.draft, zone);
      setValues(restored);
      setBaseline(snapshot(restored));
      setDraftId(found.item.draft.id);
      setSavedAt(new Date(found.item.draft.updatedAt));
      const done: StepId[] = [];
      for (const id of EDITABLE) {
        if (Object.keys(validateStep(id, restored)).length > 0) break;
        done.push(id);
      }
      setCompleted(done);
    } else {
      const fresh = emptyForm(zone);
      setValues(fresh);
      setBaseline(snapshot(fresh));
    }
    setPhase('ready');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [draftParam]);

  // "Plan with this activity" from the library: pre-add once, without counting it as an edit.
  useEffect(() => {
    if (activityApplied.current || phase !== 'ready' || draftParam || !activityParam) return;
    if (catalog.status !== 'ready') return;
    activityApplied.current = true;
    const match = catalog.activities.find((a) => a.slug === activityParam);
    if (!match) return;
    const next: FormValues = {
      ...valuesRef.current,
      activities: [{ slug: match.slug, minutes: defaultMinutes(match) }],
    };
    setValues(next);
    setBaseline(snapshot(next));
  }, [phase, catalog, activityParam, draftParam]);

  const dirty = phase === 'ready' && snapshot(values) !== baseline;

  // Page title shows an asterisk while there are unsaved changes.
  useEffect(() => {
    const base = document.title.replace(/^\* /, '');
    document.title = dirty ? `* ${base}` : base;
  }, [dirty]);

  const zoneOptions = useMemo(() => {
    const at = labelDate(values.date, new Date());
    return zones.map((zone) => ({ value: zone, label: timeZoneLabel(zone, at) }));
  }, [zones, values.date]);
  const catalogList = useMemo<ActivitySummary[]>(
    () => (catalog.status === 'ready' ? catalog.activities : []),
    [catalog],
  );
  const nameOf = useCallback(
    (slug: string) => catalogList.find((a) => a.slug === slug)?.name ?? slug,
    [catalogList],
  );
  const categoryOf = (slug: string) => catalogList.find((a) => a.slug === slug)?.category ?? null;

  const review = useMemo(() => {
    const result = reviewEventPlan(
      {
        durationMinutes: values.durationMinutes ?? 0,
        expectedParticipants: values.expectedParticipants ?? 0,
        activities: values.activities.map((a) => ({ slug: a.slug, minutes: a.minutes ?? 0 })),
      },
      catalogList,
    );
    const notices: PlanNotice[] = result.notices.filter((notice) => {
      if (catalog.status !== 'ready')
        return notice.kind === 'over_time' || notice.kind === 'tight_transitions';
      if (values.expectedParticipants === null) {
        return notice.kind !== 'group_too_small' && notice.kind !== 'group_too_large';
      }
      return true;
    });
    return { ...result, notices };
  }, [values, catalog.status, catalogList]);

  // Errors for every editable step, with the catalog-dependent "unknown activity" rule applied.
  const errorsByStep = useMemo(() => {
    const activities = validateStep('activities', values);
    if (
      catalog.status === 'ready' &&
      activities.activities === undefined &&
      values.activities.some((a) => !catalogList.some((c) => c.slug === a.slug))
    ) {
      activities.activities =
        'An activity in this draft is no longer in the catalog. Remove it to continue.';
    }
    return {
      basics: validateStep('basics', values),
      participants: validateStep('participants', values),
      activities,
    } satisfies Record<EditableStep, FieldErrors>;
  }, [values, catalog.status, catalogList]);

  const touch = (key: string) => {
    setTouched((current) => (current.has(key) ? current : new Set(current).add(key)));
  };
  const onBlurField = (key: BlurKey) => {
    if (key === 'date') {
      if (values.time !== '') touch('startsAtLocal');
      return;
    }
    touch(key === 'time' ? 'startsAtLocal' : key);
  };

  const isEditable = (id: StepId): id is EditableStep => id !== 'review';
  const currentErrors: FieldErrors = isEditable(step) ? errorsByStep[step] : {};
  const visibleErrors: FieldErrors = {};
  for (const [key, message] of Object.entries(currentErrors) as Array<[FieldKey, string]>) {
    const shown =
      attempted[step] === true ||
      touched.has(key) ||
      (key.startsWith('minutes:') && touched.has('minutes'));
    if (shown) visibleErrors[key] = message;
  }
  const summaryItems = (Object.entries(currentErrors) as Array<[FieldKey, string]>).filter(
    () => attempted[step] === true,
  );

  const requestFocus = useCallback((target: FocusTarget) => {
    setFocusRequest((current) => ({ id: (current?.id ?? 0) + 1, target }));
  }, []);
  useEffect(() => {
    if (!focusRequest) return;
    const element =
      focusRequest.target === 'summary'
        ? (summaryRef.current ?? stepHeadingRef.current)
        : stepHeadingRef.current;
    element?.focus();
  }, [focusRequest]);

  const goTo = useCallback(
    (target: StepId, focus: FocusTarget = 'heading') => {
      setStep(target);
      requestFocus(focus);
    },
    [requestFocus],
  );

  const patch = (change: Partial<FormValues>) => {
    setValues((current) => ({ ...current, ...change }));
    setSaveState((state) => (state === 'invalid' ? 'idle' : state));
  };

  // ---- Activities ----------------------------------------------------------------------
  const toggleActivity = (activity: ActivitySummary) => {
    setValues((current) => {
      const has = current.activities.some((a) => a.slug === activity.slug);
      return {
        ...current,
        activities: has
          ? current.activities.filter((a) => a.slug !== activity.slug)
          : [...current.activities, { slug: activity.slug, minutes: defaultMinutes(activity) }],
      };
    });
  };
  const moveActivity = (slug: string, toIndex: number) => {
    setValues((current) => {
      const from = current.activities.findIndex((a) => a.slug === slug);
      if (from === -1) return current;
      const next = [...current.activities];
      const [item] = next.splice(from, 1);
      if (item) next.splice(toIndex, 0, item);
      return { ...current, activities: next };
    });
  };
  const removeActivity = (slug: string) => {
    const index = values.activities.findIndex((a) => a.slug === slug);
    removeFocus.current = index;
    setValues((current) => ({
      ...current,
      activities: current.activities.filter((a) => a.slug !== slug),
    }));
    announce(`${nameOf(slug)} removed from the playlist.`);
  };
  const setMinutes = (slug: string, minutes: number | null) => {
    setValues((current) => ({
      ...current,
      activities: current.activities.map((a) => (a.slug === slug ? { ...a, minutes } : a)),
    }));
  };

  // After removing from the playlist: focus the next row's first control, else the previous
  // row's, else the playlist heading.
  useEffect(() => {
    const index = removeFocus.current;
    if (index === null) return;
    removeFocus.current = null;
    const rows = playlistRef.current?.querySelectorAll<HTMLElement>('ol > li');
    const row = rows?.[index] ?? rows?.[index - 1];
    const control = row?.querySelector<HTMLElement>('input, button:not([aria-disabled="true"])');
    (control ?? playlistHeadingRef.current)?.focus();
  }, [values.activities]);

  // ---- Navigation ----------------------------------------------------------------------
  const goNext = () => {
    if (step === 'review') return;
    const errors = errorsByStep[step];
    setAttempted((current) => ({ ...current, [step]: true }));
    if (Object.keys(errors).length > 0) {
      requestFocus('summary');
      return;
    }
    setCompleted((current) => (current.includes(step) ? current : [...current, step]));
    const index = STEP_IDS.indexOf(step);
    const target = STEP_IDS[index + 1];
    if (!target) return;
    if (target === 'review') {
      // Defensive: earlier steps may have been edited into an invalid state.
      const broken = EDITABLE.find((id) => Object.keys(errorsByStep[id]).length > 0);
      if (broken) {
        setAttempted((current) => ({ ...current, [broken]: true }));
        goTo(broken, 'summary');
        return;
      }
    }
    goTo(target);
  };
  const goBack = () => {
    const index = STEP_IDS.indexOf(step);
    const target = STEP_IDS[index - 1];
    if (target) goTo(target);
  };

  // ---- Saving --------------------------------------------------------------------------
  const save = useCallback((): boolean => {
    const current = valuesRef.current;
    if (!isBasicsValid(current)) {
      setSaveState('invalid');
      setAttempted((a) => ({ ...a, basics: true }));
      goTo('basics', 'summary');
      return false;
    }
    const result = saveDraft(draftFromForm(current), { id: draftId });
    if (!result.ok) {
      setSaveState(result.reason === 'limit' ? 'limit' : 'storage-error');
      return false;
    }
    setDraftId(result.draft.id);
    setBaseline(snapshot(current));
    setSavedAt(new Date(result.draft.updatedAt));
    setSaveState('idle');
    window.history.replaceState(
      null,
      '',
      `/app/events/new?draft=${encodeURIComponent(result.draft.id)}`,
    );
    announce('Draft saved');
    return true;
  }, [announce, draftId, goTo]);

  useRegisterUnsavedGuard({ dirty, save, restoreFocus: () => requestFocus('summary') });

  // ---- Render --------------------------------------------------------------------------
  if (phase === 'loading') {
    return <Skeleton variant="block" count={3} label="Loading your plan" />;
  }
  if (phase === 'missing' || phase === 'corrupt') {
    return (
      <div className="max-w-2xl">
        <h1 className="sr-only">Plan a FunFriday</h1>
        <ErrorState
          headingLevel={2}
          title={phase === 'missing' ? "We couldn't find that draft" : "This draft can't be opened"}
          body={
            phase === 'missing'
              ? 'It may have been deleted, or it was saved in a different browser. Drafts live on the device where you saved them.'
              : 'It may have been damaged. You can remove it from your dashboard.'
          }
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <AppLinkButton href="/app/events/new">Start a new plan</AppLinkButton>
          <AppLinkButton href="/app" variant="secondary">
            Go to dashboard
          </AppLinkButton>
        </div>
      </div>
    );
  }

  const stepperSteps = STEP_IDS.map((id) => ({
    id,
    label: STEP_LABELS[id],
    error: isEditable(id) && attempted[id] === true && Object.keys(errorsByStep[id]).length > 0,
  }));
  const statusNode = (() => {
    if (saveState === 'invalid') {
      return <Badge tone="danger">Can&apos;t save yet. Fix the highlighted fields.</Badge>;
    }
    if (dirty) {
      return (
        <Badge tone="warning" icon={<CircleDot />}>
          Unsaved changes
        </Badge>
      );
    }
    if (savedAt) {
      return (
        <Badge tone="success" icon={<Check />}>
          Draft saved on this device at {timeLabel(savedAt)}
        </Badge>
      );
    }
    return <Badge tone="neutral">Not saved yet</Badge>;
  })();

  const summary = (
    <PlanSummary
      values={values}
      nameOf={nameOf}
      activityMinutes={review.activityMinutes}
      bufferMinutes={review.bufferMinutes}
      notices={[]}
      showMeter={step !== 'activities'}
      review={step === 'review'}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-ff-muted">
            <li>
              <GuardedLink
                href="/app"
                className="inline-flex min-h-11 items-center text-ff-violet-700 underline underline-offset-4"
              >
                Dashboard
              </GuardedLink>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-ff-ink">
              Plan event
            </li>
          </ol>
        </nav>
        <h1 className="font-heading text-[30px] leading-9 font-extrabold tracking-tight text-ff-ink md:text-[40px] md:leading-[46px]">
          Plan a FunFriday
        </h1>
        <Notice tone="info">
          This is a draft planner. Nothing is sent, shared or scheduled. Saving keeps your draft in
          this browser only.
        </Notice>
      </header>

      <Stepper
        steps={stepperSteps}
        current={step}
        completed={completed}
        onStepSelect={(id) => {
          if ((STEP_IDS as readonly string[]).includes(id)) goTo(id as StepId);
        }}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,640px)_360px]">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (step === 'review') save();
            else goNext();
          }}
          className="flex min-w-0 flex-col gap-6"
        >
          {summaryItems.length > 0 && (
            <section
              ref={summaryRef}
              tabIndex={-1}
              aria-labelledby="error-summary-heading"
              className="rounded-ff-button border-2 border-ff-coral-700 bg-ff-coral-50 p-4"
            >
              <h2
                id="error-summary-heading"
                className="flex items-center gap-2 font-heading text-lg font-bold text-ff-ink"
              >
                <CircleAlert aria-hidden="true" className="size-5 text-ff-coral-700" />
                Please fix {summaryItems.length} {summaryItems.length === 1 ? 'thing' : 'things'}
              </h2>
              <ul className="mt-2 flex flex-col">
                {summaryItems.map(([key, message]) => {
                  const id = fieldIdFor(key, values);
                  return (
                    <li key={key}>
                      <a
                        href={`#${id}`}
                        onClick={(event) => {
                          event.preventDefault();
                          document.getElementById(id)?.focus();
                        }}
                        className="inline-flex min-h-11 items-center text-ff-coral-700 underline underline-offset-4"
                      >
                        {message}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <div key={step} className="ff-route flex flex-col gap-5">
            <h2
              ref={stepHeadingRef}
              tabIndex={-1}
              className="font-heading text-2xl leading-8 font-bold tracking-tight text-ff-ink md:text-[30px] md:leading-[38px]"
            >
              {STEP_TITLES[step]}
            </h2>
            {step === 'basics' && (
              <StepBasics
                values={values}
                errors={visibleErrors}
                onChange={patch}
                onBlurField={onBlurField}
                zoneOptions={zoneOptions}
                browserZone={browserZone}
              />
            )}
            {step === 'participants' && (
              <StepParticipants
                values={values}
                errors={visibleErrors}
                onChange={patch}
                onBlurField={onBlurField}
              />
            )}
            {step === 'activities' && (
              <StepActivities
                values={values}
                catalog={catalog}
                errors={visibleErrors}
                notices={review.notices}
                activityMinutes={review.activityMinutes}
                bufferMinutes={review.bufferMinutes}
                nameOf={nameOf}
                onToggle={toggleActivity}
                onMove={moveActivity}
                onRemove={removeActivity}
                onMinutes={setMinutes}
                onBlurMinutes={() => {
                  touch('minutes');
                }}
                onRetry={reload}
                playlistHeadingRef={playlistHeadingRef}
                playlistRef={playlistRef}
              />
            )}
            {step === 'review' && (
              <StepReview
                values={values}
                viewerZone={browserZone}
                nameOf={nameOf}
                categoryOf={categoryOf}
                notices={review.notices}
                bufferMinutes={review.bufferMinutes}
              />
            )}
          </div>

          <details className="rounded-ff-card bg-ff-surface p-4 shadow-ff-sm lg:hidden">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-ff-ink">
              Plan summary
            </summary>
            <div className="mt-3">{summary}</div>
          </details>

          {(saveState === 'storage-error' || saveState === 'limit') && (
            <ErrorState
              announce="alert"
              headingLevel={3}
              title="We couldn't save this draft"
              body={
                saveState === 'limit'
                  ? "You've reached the limit of 50 drafts on this device. Delete one from your dashboard to save another. Your changes are still on this page."
                  : 'Your browser may be blocking storage. Your changes are still on this page.'
              }
              onRetry={() => {
                save();
              }}
              retryLabel="Try saving again"
            />
          )}

          <div
            data-testid="builder-actions"
            className="ff-safe-bottom sticky bottom-16 z-10 -mx-4 flex flex-col gap-2 border-t border-ff-border bg-ff-surface px-4 py-3 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0"
          >
            <div className="flex flex-wrap items-center gap-3">
              {step !== 'basics' && (
                <Button variant="secondary" onClick={goBack}>
                  Back
                </Button>
              )}
              {step !== 'review' && <Button type="submit">Next</Button>}
              <Button
                type={step === 'review' ? 'submit' : 'button'}
                variant={step === 'review' ? 'primary' : 'secondary'}
                iconStart={<HardDrive />}
                onClick={step === 'review' ? undefined : () => void save()}
              >
                Save draft on this device
              </Button>
              <div role="status" aria-live="polite">
                {statusNode}
              </div>
            </div>
            {step === 'review' && (
              <p className="text-sm text-ff-muted">
                Next steps like invitations arrive in a later phase.
              </p>
            )}
          </div>
        </form>

        <aside aria-label="Plan summary" className="hidden lg:block">
          <div className="sticky top-4 rounded-ff-card bg-ff-surface p-5 shadow-ff-sm">
            {summary}
          </div>
        </aside>
      </div>
    </div>
  );
}
