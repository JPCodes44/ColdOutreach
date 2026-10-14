import { NOT_APPROVED_HINT, emailCell, isSendable } from './data';
import type { DraftReviewRowProps } from './types';

/** One company row; only approved drafts can be checked for sending. */
export function DraftReviewRow({
  row,
  selected,
  active,
  onSelect,
  onToggleSelected,
}: DraftReviewRowProps) {
  const sendable = isSendable(row);
  return (
    <div
      className={active ? 'campaignRow campaignRowActive' : 'campaignRow'}
      role="row"
      tabIndex={0}
      onClick={() => onSelect(row.companyId)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(row.companyId);
        }
      }}
    >
      <div role="cell" className="campaignCell draftColSelect">
        <input
          className="campaignCheckbox"
          type="checkbox"
          checked={selected}
          disabled={!sendable}
          title={sendable ? undefined : NOT_APPROVED_HINT}
          aria-label={`Select ${row.company}`}
          onClick={(event) => event.stopPropagation()}
          onChange={() => onToggleSelected(row.companyId)}
        />
      </div>
      <div role="cell" className="campaignCell draftColName">
        <span className="campaignCellText">{row.company}</span>
      </div>
      {[row.email1, row.email2, row.email3].map((email, index) => (
        <div key={index} role="cell" className="campaignCell draftColEmail">
          <span className="campaignCellText">{emailCell(email)}</span>
        </div>
      ))}
      <div role="cell" className="campaignCell draftColDraft">
        <span
          className={sendable ? 'draftState draftStateApproved' : 'draftState'}
        >
          {row.draftLabel}
        </span>
        {sendable ? null : (
          <span className="draftStateHint">{NOT_APPROVED_HINT}</span>
        )}
      </div>
      <div role="cell" className="campaignCell draftColStatus">
        <span className="campaignCellText">{row.status}</span>
      </div>
    </div>
  );
}
