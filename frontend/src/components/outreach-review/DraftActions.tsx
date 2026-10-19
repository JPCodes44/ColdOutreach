import type { DraftActionsProps } from './types';

/** Save the draft without an approval step. */
export function DraftActions({ dirty, busy, onSave }: DraftActionsProps) {
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
    </div>
  );
}
