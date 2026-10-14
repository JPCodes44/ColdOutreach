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
  running,
  onRun,
  onDelete,
}: CampaignHeaderProps) {
  return (
    <section className="campaignHeader">
      <div className="campaignHeaderText">
        <h1 className="campaignTitle">Outreach Pipeline</h1>
        <div className="campaignHeaderRowCompact">
          <p className="campaignSubtitle">
            Select companies and run the website-review pipeline. Generating a
            draft never sends email.
          </p>
          <div className="campaignHeaderActions">
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
              onClick={onDelete}
              disabled={selectedCount === 0}
            >
              <Icon name="delete" size={16} />
              Delete
            </button>
            <button
              className="generateButton"
              type="button"
              onClick={onRun}
              disabled={selectedCount === 0 || running}
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
