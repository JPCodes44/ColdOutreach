import { useMemo, useState } from 'react';
import { findUnsupportedClaims } from '@emailstrat/common';
import { DraftEditor } from './DraftEditor';
import { EmailPreview } from './EmailPreview';
import { useDraftActions } from './useDraftActions';
import type { DraftWorkspaceProps, EditableFields } from './types';

/**
 * Editor + live preview for one draft. Mount with `key={draft.updatedAt}` so a
 * new run or saved edit resets local edit state.
 */
export function DraftWorkspace({
  companyId,
  draft,
  evidenceText,
}: DraftWorkspaceProps) {
  const saved: EditableFields = {
    subject: draft.content.subject,
    opening: draft.content.opening,
    closing: draft.content.closing,
    signature: draft.content.signature,
  };
  const [fields, setFields] = useState<EditableFields>(saved);
  const actions = useDraftActions(companyId);
  const dirty = (Object.keys(saved) as (keyof EditableFields)[]).some(
    (key) => saved[key] !== fields[key],
  );
  const content = useMemo(
    () => ({ ...draft.content, ...fields }),
    [draft.content, fields],
  );
  const warnings = useMemo(
    () =>
      findUnsupportedClaims(
        [fields.subject, fields.opening, fields.closing].join('\n'),
        evidenceText,
      ),
    [fields, evidenceText],
  );

  return (
    <div className="reviewWorkspace">
      <DraftEditor
        fields={fields}
        onChange={setFields}
        approved={draft.status === 'approved'}
        dirty={dirty}
        busy={actions.busy}
        error={actions.error}
        warnings={warnings}
        onSave={() => void actions.save(fields)}
        onApprove={() => void actions.approve()}
        onUnapprove={() => void actions.unapprove()}
      />
      <EmailPreview content={content} />
    </div>
  );
}
