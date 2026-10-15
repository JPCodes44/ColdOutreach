import type { DraftActionsProps } from './types';

function approveHint(dirty: boolean, ready: boolean): string | undefined {
  if (dirty) return 'Save edits before approving';
  if (!ready) return 'Resolve the flagged items before approving';
  return undefined;
}

/** Save, approve, and withdraw buttons for the draft editor. */
export function DraftActions({
  approved,
  dirty,
  busy,
  ready,
  onSave,
  onApprove,
  onUnapprove,
}: DraftActionsProps) {
  return (
    <div className="reviewEditorActions">
      <button
        type="button"
        className="reviewSecondaryButton"
        onClick={onSave}
        disabled={!dirty || busy}
      >
        Save edits
      </button>
      {approved ? (
        <button
          type="button"
          className="reviewSecondaryButton"
          onClick={onUnapprove}
          disabled={busy}
        >
          Withdraw approval
        </button>
      ) : (
        <button
          type="button"
          className="reviewPrimaryButton"
          onClick={onApprove}
          disabled={dirty || busy || !ready}
          title={approveHint(dirty, ready)}
        >
          Approve for sending
        </button>
      )}
    </div>
  );
}
