import { useMemo, useState } from 'react';
import { checkDraftForApproval } from '@emailstrat/common';
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
  const check = useMemo(
    () => checkDraftForApproval(content, evidenceText),
    [content, evidenceText],
  );
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const acknowledge = (claim: string, checked: boolean) =>
    setAcknowledged((current) =>
      checked ? [...current, claim] : current.filter((item) => item !== claim),
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
        review={{ ...check, acknowledged, onAcknowledge: acknowledge }}
        onSave={() => void actions.save(fields)}
        onApprove={() =>
          void actions.approve(
            check.claims.filter((claim) => acknowledged.includes(claim)),
          )
        }
        onUnapprove={() => void actions.unapprove()}
      />
      <EmailPreview content={content} />
    </div>
  );
}
