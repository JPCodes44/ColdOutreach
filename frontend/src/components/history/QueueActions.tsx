import { useState } from 'react';
import { errorMessage } from '../shared/errorMessage';
import { needsReview } from './status';
import type { QueueActionsProps, ResolveOutcome } from './types';

const outcomeLabels: Record<ResolveOutcome, string> = {
  sent: 'It was sent',
  'not-sent': 'It was not sent',
};

/** Cancel a queued send, or resolve an uncertain one after a confirm step. */
export function QueueActions({ row, onCancel, onResolve }: QueueActionsProps) {
  const [confirming, setConfirming] = useState<ResolveOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
      setConfirming(null);
    } catch (cause) {
      setError(errorMessage(cause, 'Action failed.'));
    }
  };

  let body = null;
  if (row.status === 'queued') {
    body = (
      <button
        className="historyAction"
        type="button"
        onClick={() => void run(() => onCancel(row.id))}
      >
        Cancel
      </button>
    );
  } else if (needsReview(row) && confirming !== null) {
    body = (
      <span className="historyConfirm">
        Confirm “{outcomeLabels[confirming]}”?
        <button
          className="historyAction historyActionPrimary"
          type="button"
          onClick={() => void run(() => onResolve(row.id, confirming))}
        >
          Confirm
        </button>
        <button
          className="historyAction"
          type="button"
          onClick={() => setConfirming(null)}
        >
          Back
        </button>
      </span>
    );
  } else if (needsReview(row)) {
    body = (
      <span className="historyResolve">
        <span className="historyHint">Check your Gmail Sent folder first.</span>
        <button
          className="historyAction"
          type="button"
          onClick={() => setConfirming('sent')}
        >
          It was sent
        </button>
        <button
          className="historyAction"
          type="button"
          onClick={() => setConfirming('not-sent')}
        >
          It was not sent
        </button>
      </span>
    );
  }
  return (
    <div className="historyActions">
      {body}
      {error !== null ? (
        <span className="historyError" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
