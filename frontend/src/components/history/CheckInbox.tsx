import { useState } from 'react';
import { errorMessage } from '../shared/errorMessage';
import { describeCheck } from './inboxCheck';
import type { CheckInboxProps } from './types';

/** Manually trigger the Gmail inbox scan for bounces and replies. */
export function CheckInbox({ onCheck }: CheckInboxProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const check = async () => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(describeCheck(await onCheck()));
      setFailed(false);
    } catch (cause) {
      setMessage(errorMessage(cause, 'Could not check the inbox.'));
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="historyInboxCheck">
      <button
        type="button"
        className="historyAction"
        onClick={() => void check()}
        disabled={busy}
      >
        {busy ? 'Checking…' : 'Check inbox now'}
      </button>
      {message !== null ? (
        <span
          className={failed ? 'historyError' : 'historyInboxResult'}
          role={failed ? 'alert' : 'status'}
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}
