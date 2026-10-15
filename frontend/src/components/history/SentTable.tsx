import { CheckInbox } from './CheckInbox';
import { DeliveryChip } from './DeliveryChip';
import { formatTime } from './status';
import type { SentTableProps } from './types';

/** Durable record of messages Gmail accepted (or a human confirmed). */
export function SentTable({ rows, onOpen, onCheckInbox }: SentTableProps) {
  return (
    <section className="historyCard" aria-labelledby="history-sent-title">
      <div className="historyCardHeader">
        <h2 id="history-sent-title" className="historyCardTitle">
          Sent emails
        </h2>
        <CheckInbox onCheck={onCheckInbox} />
      </div>
      <p className="historyNote">
        Sent means Gmail accepted the message; it does not prove inbox delivery
        or that it was opened. Bounces and replies are detected from your Gmail
        inbox every 30 minutes for emails sent in the last 14 days.
      </p>
      {rows === undefined ? (
        <p className="historyEmpty">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="historyEmpty">No emails sent yet.</p>
      ) : (
        <ul className="historyList">
          {rows.map((row) => (
            <li key={row.id} className="historyRow">
              <button
                className="historySentButton"
                type="button"
                onClick={() => onOpen(row.id)}
              >
                <span className="historyCompany">
                  {row.companyName}
                  {row.isTest ? (
                    <span className="historyBadge">Test</span>
                  ) : null}
                  {row.acceptance === 'manually-confirmed' ? (
                    <span className="historyBadge">Confirmed manually</span>
                  ) : null}
                </span>
                <span className="historySubject">{row.subject}</span>
                <span className="historyMeta">
                  To {row.intendedTo}
                  {row.redirected
                    ? ` · redirected to ${row.actualTo}`
                    : ''} · {formatTime(row.sentAt)}
                </span>
              </button>
              <DeliveryChip row={row} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
