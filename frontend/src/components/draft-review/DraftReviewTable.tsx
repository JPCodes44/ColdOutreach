import { DraftReviewRow } from './DraftReviewRow';
import type { DraftReviewTableProps } from './types';

const headings: [string, string][] = [
  ['Company', 'draftColName'],
  ['Email1', 'draftColEmail'],
  ['Email2', 'draftColEmail'],
  ['Email3', 'draftColEmail'],
  ['Draft', 'draftColDraft'],
  ['Status', 'draftColStatus'],
];

/** Companies with recipients, styled like the Pipeline table. */
export function DraftReviewTable({
  loading,
  rows,
  selectedIds,
  allSelected,
  activeId,
  onSelect,
  onToggleSelected,
  onToggleAll,
}: DraftReviewTableProps) {
  if (loading) return <p className="draftTableLoading">Loading…</p>;
  return (
    <section className="campaignTableCard">
      <div className="campaignTableScroller">
        <div
          role="table"
          aria-label="Companies with contacts"
          className="campaignTable"
        >
          <div role="rowgroup">
            <div role="row" className="campaignHeaderRow">
              <div
                role="columnheader"
                className="campaignHeadCell draftColSelect"
              >
                <input
                  className="campaignCheckbox"
                  type="checkbox"
                  checked={allSelected}
                  aria-label="Select all approved companies"
                  onChange={onToggleAll}
                />
              </div>
              {headings.map(([label, className]) => (
                <div
                  key={label}
                  role="columnheader"
                  className={`campaignHeadCell ${className}`}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
          <div role="rowgroup">
            {rows.length === 0 ? (
              <div role="row" className="campaignEmptyRow">
                <div role="cell" className="campaignEmptyCell">
                  No companies with recipients yet.
                </div>
              </div>
            ) : (
              rows.map((row) => (
                <DraftReviewRow
                  key={row.companyId}
                  row={row}
                  selected={selectedIds.has(row.companyId)}
                  active={row.companyId === activeId}
                  onSelect={onSelect}
                  onToggleSelected={onToggleSelected}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
