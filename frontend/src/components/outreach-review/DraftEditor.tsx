import { ClaimReview } from './ClaimReview';
import { DraftActions } from './DraftActions';
import type { DraftEditorProps, EditableFields } from './types';

const AREAS: {
  key: Exclude<keyof EditableFields, 'subject'>;
  label: string;
  rows: number;
}[] = [
  {
    key: 'opening',
    label: 'Opening (observation, opportunity, solution)',
    rows: 10,
  },
  { key: 'closing', label: 'Closing question', rows: 3 },
  { key: 'signature', label: 'Signature', rows: 3 },
];

/** Editable subject/body fields with save, approve, and withdraw actions. */
export function DraftEditor({
  fields,
  onChange,
  approved,
  dirty,
  busy,
  error,
  review,
  onSave,
  onApprove,
  onUnapprove,
}: DraftEditorProps) {
  const ready =
    review.blockers.length === 0 &&
    review.claims.every((claim) => review.acknowledged.includes(claim));
  return (
    <section className="reviewCard reviewEditor" aria-label="Edit email">
      <h2 className="reviewCardTitle">
        Email draft{' '}
        {dirty ? <span className="reviewDirty">· unsaved changes</span> : null}
      </h2>
      {approved ? (
        <p className="reviewBanner reviewBanner-approved" role="status">
          Approved. Scheduling queues an immutable copy; later edits won&apos;t
          change queued emails.
        </p>
      ) : null}
      <label className="reviewField">
        <span>Subject</span>
        <input
          value={fields.subject}
          onChange={(event) =>
            onChange({ ...fields, subject: event.target.value })
          }
        />
      </label>
      {AREAS.map((area) => (
        <label key={area.key} className="reviewField">
          <span>{area.label}</span>
          <textarea
            rows={area.rows}
            value={fields[area.key]}
            onChange={(event) =>
              onChange({ ...fields, [area.key]: event.target.value })
            }
          />
        </label>
      ))}
      <ClaimReview {...review} />
      {error !== null ? (
        <p className="reviewBanner reviewBanner-error" role="alert">
          {error}
        </p>
      ) : null}
      <DraftActions
        approved={approved}
        dirty={dirty}
        busy={busy}
        ready={ready}
        onSave={onSave}
        onApprove={onApprove}
        onUnapprove={onUnapprove}
      />
      <p className="reviewMuted">
        Approving does not send. Use Schedule to send.
      </p>
    </section>
  );
}
