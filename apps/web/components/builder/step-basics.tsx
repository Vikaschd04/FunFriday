import { EVENT_LIMITS } from '@funfriday/contracts';
import { NumberField, Select, TextField } from '@funfriday/ui';
import type { FieldErrors, FormValues } from '@/lib/builder-model';

export interface StepProps {
  values: FormValues;
  /** Errors already filtered to what should be visible. */
  errors: FieldErrors;
  onChange: (patch: Partial<FormValues>) => void;
  onBlurField: (
    key:
      | 'title'
      | 'date'
      | 'time'
      | 'timeZone'
      | 'durationMinutes'
      | 'meetingUrl'
      | 'expectedParticipants',
  ) => void;
}

export function StepBasics({
  values,
  errors,
  onChange,
  onBlurField,
  zoneOptions,
  browserZone,
}: StepProps & { zoneOptions: Array<{ value: string; label: string }>; browserZone: string }) {
  const dateError = values.date === '' ? errors.startsAtLocal : undefined;
  const timeError = values.date !== '' ? errors.startsAtLocal : undefined;
  return (
    <div className="flex flex-col gap-5">
      <TextField
        id="field-title"
        label="Event title"
        required
        hint={
          <>
            Something your team will recognise, like Friday Reset.{' '}
            <span className="ff-tnum">
              {values.title.trim().length} / {EVENT_LIMITS.titleMax}
            </span>
          </>
        }
        value={values.title}
        error={errors.title}
        autoComplete="off"
        onChange={(event) => {
          onChange({ title: event.target.value });
        }}
        onBlur={() => {
          onBlurField('title');
        }}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="field-date"
          label="Date"
          type="date"
          required
          value={values.date}
          error={dateError}
          onChange={(event) => {
            onChange({ date: event.target.value });
          }}
          onBlur={() => {
            onBlurField('date');
          }}
        />
        <TextField
          id="field-time"
          label="Start time"
          type="time"
          required
          value={values.time}
          error={timeError}
          onChange={(event) => {
            onChange({ time: event.target.value });
          }}
          onBlur={() => {
            onBlurField('time');
          }}
        />
      </div>
      <Select
        id="field-timezone"
        label="Time zone"
        required
        hint={
          values.timeZone === browserZone
            ? "We picked this from your browser. Change it if you're planning for another place."
            : "Your browser's time zone is listed first."
        }
        value={values.timeZone}
        error={errors.timeZone}
        options={zoneOptions}
        onChange={(event) => {
          onChange({ timeZone: event.target.value });
        }}
        onBlur={() => {
          onBlurField('timeZone');
        }}
      />
      <NumberField
        id="field-duration"
        label="Duration (minutes)"
        required
        hint="Total length of the event, including breaks."
        value={values.durationMinutes}
        min={EVENT_LIMITS.durationMin}
        max={EVENT_LIMITS.durationMax}
        step={5}
        showStepper
        error={errors.durationMinutes}
        onValueChange={(durationMinutes) => {
          onChange({ durationMinutes });
        }}
        onBlur={() => {
          onBlurField('durationMinutes');
        }}
      />
      <TextField
        id="field-meeting-url"
        label="Meeting link (optional)"
        type="url"
        inputMode="url"
        autoComplete="off"
        hint="Optional. Paste your meeting link; we don't open or send it."
        value={values.meetingUrl}
        error={errors.meetingUrl}
        onChange={(event) => {
          onChange({ meetingUrl: event.target.value });
        }}
        onBlur={() => {
          onBlurField('meetingUrl');
        }}
      />
    </div>
  );
}
