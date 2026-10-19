import { Icon } from '../outreach/Common';
import type { DispatchSummaryProps } from './types';

/** Counts of selected companies, ready drafts, and emails to queue. */
export function DispatchSummaryPanel({ summary }: DispatchSummaryProps) {
  const rows = [
    ['Total Companies', summary.totalCompanies, false],
    ['Ready to Schedule', summary.readyDrafts, false],
    ['Emails to Schedule', summary.totalEmailsQueued, true],
  ] as const;
  return (
    <aside className="scheduleCard scheduleSummary">
      <div className="scheduleCardHeader">
        <Icon name="receipt_long" size={20} />
        <h2 className="scheduleCardTitle">Dispatch Summary</h2>
      </div>
      <div className="scheduleSummaryBody">
        {rows.map(([label, value, accent]) => (
          <div key={label} className="scheduleSummaryRow">
            <span className="scheduleSummaryLabel">{label}</span>
            <span
              className={
                accent ? 'scheduleSummaryValueAccent' : 'scheduleSummaryValue'
              }
            >
              {value}
            </span>
          </div>
        ))}
        <div className="scheduleHealthNote">
          <Icon name="info" size={18} />
          <p>
            Emails are sent through Gmail at the scheduled time. Each email is
            an immutable copy of the saved draft.
          </p>
        </div>
      </div>
    </aside>
  );
}
