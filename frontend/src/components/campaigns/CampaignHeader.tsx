import { Icon } from '../outreach/Common';
import { pipelineFilterOptions } from './status';
import type { CampaignHeaderProps } from './types';

/** Title, search, status filter chips, and bulk Run/Delete actions. */
export function CampaignHeader({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  selectedCount,
  runnableCount,
  running,
  websiteReviewEnabled,
  onWebsiteReviewChange,
  onRun,
  onDelete,
  onDeleteDrafts,
}: CampaignHeaderProps) {
  return (
    <section className="campaignHeader">
      <div className="campaignHeaderText">
        <h1 className="campaignTitle">Outreach Pipeline</h1>
        <div className="campaignHeaderRowCompact">
          <p className="campaignSubtitle">
            {websiteReviewEnabled
              ? 'Draft emails using website review and company research.'
              : 'Draft emails using company research and email instructions only.'}{' '}
            Existing drafts are skipped. Generating a draft never sends email.
          </p>
          <div className="campaignHeaderActions">
            <label className="campaignWebsiteToggle">
              <input
                type="checkbox"
                role="switch"
                checked={websiteReviewEnabled}
                disabled={running}
                onChange={(event) =>
                  onWebsiteReviewChange(event.target.checked)
                }
              />
              Review website
            </label>
            <label className="campaignSearch">
              <span className="campaignSearchIcon">
                <Icon name="search" size={18} />
              </span>
              <input
                className="campaignSearchInput"
                placeholder="Search companies..."
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
              />
            </label>
            <div
              className="campaignStatusFilter"
              role="group"
              aria-label="Filter by draft status"
            >
              {pipelineFilterOptions.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`campaignFilterChip ${statusFilter === value ? 'campaignFilterChipActive' : ''}`}
                  aria-pressed={statusFilter === value}
                  onClick={() => onStatusFilterChange(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              className="campaignDeleteButton"
              type="button"
              onClick={onDeleteDrafts}
              disabled={selectedCount === 0 || running}
            >
              <Icon name="delete" size={16} />
              Delete drafts
            </button>
            <button
              className="campaignDeleteButton"
              type="button"
              onClick={onDelete}
              disabled={selectedCount === 0 || running}
            >
              <Icon name="delete" size={16} />
              Delete companies
            </button>
            <button
              className="generateButton"
              type="button"
              onClick={onRun}
              disabled={selectedCount === 0 || runnableCount === 0 || running}
            >
              <Icon name={running ? 'sync' : 'travel_explore'} size={16} />
              {running ? 'Starting...' : 'Run pipeline'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
