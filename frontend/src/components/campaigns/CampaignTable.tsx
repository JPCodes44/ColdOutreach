import { CampaignRow } from './CampaignRow';
import type { CampaignTableProps } from './types';

const columns = [
  ['Company', 'campaignColName'],
  ['Website', 'campaignColDomain'],
  ['Industry', 'campaignColIndustry'],
  ['Draft status', 'campaignColStatus'],
  ['Subject', 'campaignColSubject'],
  ['Review', 'campaignColReview'],
  ['Score', 'campaignColScore'],
] as const;

/** Selectable table of pipeline companies. */
export function CampaignTable({
  companies,
  loading,
  onOpenReview,
  onToggleSelected,
  onToggleAll,
}: CampaignTableProps) {
  const allSelected =
    companies.length > 0 && companies.every((company) => company.selected);
  return (
    <section className="campaignTableCard">
      <div className="campaignTableScroller">
        <div
          role="table"
          aria-label="Pipeline companies"
          className="campaignTable"
        >
          <div role="rowgroup">
            <div role="row" className="campaignHeaderRow">
              <div
                role="columnheader"
                className="campaignHeadCell campaignColSelect"
              >
                <input
                  className="campaignCheckbox"
                  type="checkbox"
                  checked={allSelected}
                  aria-label="Select all companies"
                  onChange={onToggleAll}
                />
              </div>
              {columns.map(([label, className]) => (
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
            {companies.length === 0 ? (
              <div role="row" className="campaignEmptyRow">
                <div role="cell" className="campaignEmptyCell">
                  {loading
                    ? 'Loading…'
                    : 'No companies yet. Import some from Companies.'}
                </div>
              </div>
            ) : (
              companies.map((company) => (
                <CampaignRow
                  key={company.id}
                  company={company}
                  onOpenReview={onOpenReview}
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
