import { useMemo, useState } from 'react';
import { DraftEditor } from './DraftEditor';
import { EmailPreview } from './EmailPreview';
import { useDraftActions } from './useDraftActions';
import type { DraftWorkspaceProps, EditableFields } from './types';

/**
 * Editor + live preview for one draft. Mount with `key={draft.updatedAt}` so a
 * new run or saved edit resets local edit state.
 */
export function DraftWorkspace({ companyId, draft }: DraftWorkspaceProps) {
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
  return (
    <div className="reviewWorkspace">
      <DraftEditor
        fields={fields}
        onChange={setFields}
        dirty={dirty}
        busy={actions.busy}
        error={actions.error}
        onSave={() => void actions.save(fields)}
      />
      <EmailPreview content={content} />
    </div>
  );
}
