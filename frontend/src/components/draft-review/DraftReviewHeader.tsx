import { Icon } from '../outreach/Common';
import { statusOptions } from './data';
import type { DraftReviewHeaderProps } from './types';

/** Search + send-status filter for the Send screen. */
export function DraftReviewHeader({
  query,
  onQueryChange,
  status,
  onStatusChange,
}: DraftReviewHeaderProps) {
  return (
    <div className="draftControls">
      <div className="draftControlsFields">
        <label className="draftSearch">
          <span className="draftSearchIcon">
            <Icon name="search" size={20} />
          </span>
          <input
            className="draftSearchInput"
            placeholder="Search company or email"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <div className="draftSelectWrap">
          <select
            className="draftSelect"
            aria-label="Filter by status"
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="draftSelectIcon">
            <Icon name="expand_more" size={20} />
          </span>
        </div>
      </div>
    </div>
  );
}
