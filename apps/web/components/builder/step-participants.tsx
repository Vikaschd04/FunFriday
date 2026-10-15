import { EVENT_LIMITS } from '@funfriday/contracts';
import { NumberField, Notice } from '@funfriday/ui';
import type { StepProps } from './step-basics';

export function StepParticipants({ values, errors, onChange, onBlurField }: StepProps) {
  return (
    <div className="flex flex-col gap-5">
      <NumberField
        id="field-participants"
        label="Expected group size"
        required
        hint="A rough headcount is fine."
        value={values.expectedParticipants}
        min={EVENT_LIMITS.groupMin}
        max={EVENT_LIMITS.groupMax}
        showStepper
        error={errors.expectedParticipants}
        onValueChange={(expectedParticipants) => {
          onChange({ expectedParticipants });
        }}
        onBlur={() => {
          onBlurField('expectedParticipants');
        }}
      />
      <Notice tone="info">
        Invitations arrive in a later phase. For now, tell us how many people you expect so we can
        check your activities fit.
      </Notice>
      <p className="text-ff-muted">We never ask for names or email addresses in this preview.</p>
    </div>
  );
}
