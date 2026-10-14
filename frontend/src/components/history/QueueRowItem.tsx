import { QueueActions } from './QueueActions';
import { StatusChip } from './StatusChip';
import { formatTime } from './status';
import type { QueueRowItemProps } from './types';

/** One queue attempt with its recipient, timing, status, and actions. */
export function QueueRowItem({ row, onCancel, onResolve }: QueueRowItemProps) {
  const redirected =
    row.actualTo !== null &&
    row.actualTo.toLowerCase() !== row.to.toLowerCase();
  const showError =
    row.error !== null &&
    (row.status === 'failed' ||
      row.status === 'legacy-blocked' ||
      row.status === 'uncertain');
  return (
    <li className="historyRow">
      <div className="historyRowMain">
        <span className="historyCompany">
          {row.company}
          {row.isTest ? <span className="historyBadge">Test</span> : null}
        </span>
        <span className="historySubject">{row.subject}</span>
        <span className="historyMeta">
          To {row.to}
          {redirected ? ` · redirected to ${row.actualTo}` : ''} · scheduled{' '}
          {formatTime(row.scheduledAt)}
          {row.sentAt !== null ? ` · sent ${formatTime(row.sentAt)}` : ''}
        </span>
        {showError ? (
          <span className="historyErrorText">{row.error}</span>
        ) : null}
      </div>
      <StatusChip status={row.status} stale={row.stale} />
      <QueueActions row={row} onCancel={onCancel} onResolve={onResolve} />
    </li>
  );
}
