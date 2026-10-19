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

/** Editable subject/body fields with a save action. */
export function DraftEditor({
  fields,
  onChange,
  dirty,
  busy,
  error,
  onSave,
}: DraftEditorProps) {
  return (
    <section className="reviewCard reviewEditor" aria-label="Edit email">
      <h2 className="reviewCardTitle">
        Email draft{' '}
        {dirty ? <span className="reviewDirty">· unsaved changes</span> : null}
      </h2>
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
      {error !== null ? (
        <p className="reviewBanner reviewBanner-error" role="alert">
          {error}
        </p>
      ) : null}
      <DraftActions dirty={dirty} busy={busy} onSave={onSave} />
      <p className="reviewMuted">
        Save your edits, then use Send to schedule. Saving does not send email.
      </p>
    </section>
  );
}
