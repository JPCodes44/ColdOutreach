import { CampaignScore } from './CampaignScore';
import { DraftStatusCell } from './DraftStatusCell';
import type { CampaignRowProps } from './types';

/** One company in the pipeline table; clicking the row opens its review. */
export function CampaignRow({
  company,
  onOpenReview,
  onToggleSelected,
}: CampaignRowProps) {
  const running = company.draftState === 'running';
  return (
    <div
      className={`campaignRow ${running ? 'campaignRowGenerating' : ''}`}
      role="row"
      aria-busy={running}
      tabIndex={0}
      onClick={() => onOpenReview(company.id)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenReview(company.id);
        }
      }}
    >
      <div role="cell" className="campaignCell campaignColSelect">
        <input
          className="campaignCheckbox"
          type="checkbox"
          checked={company.selected}
          aria-label={`Select ${company.name}`}
          onClick={(event) => event.stopPropagation()}
          onChange={() => onToggleSelected(company.id)}
        />
      </div>
      <div role="cell" className="campaignCell campaignColName campaignName">
        <span className="campaignCellText">{company.name}</span>
      </div>
      <div role="cell" className="campaignCell campaignColDomain campaignMuted">
        <span className="campaignCellText">{company.domain || '--'}</span>
      </div>
      <div
        role="cell"
        className="campaignCell campaignColIndustry campaignMuted"
      >
        <span className="segmentStack">
          <span className="campaignCellText">{company.industry}</span>
          {company.description ? (
            <span
              className="campaignCellText campaignResearchDescription"
              title={company.description}
            >
              {company.description}
            </span>
          ) : null}
        </span>
      </div>
      <div role="cell" className="campaignCell campaignColStatus">
        <DraftStatusCell company={company} />
      </div>
      <div
        role="cell"
        className="campaignCell campaignColSubject campaignMuted"
      >
        {company.subject.length > 0 ? (
          <span className="campaignCellText">{company.subject}</span>
        ) : (
          <span className="campaignDash">--</span>
        )}
      </div>
      <div role="cell" className="campaignCell campaignColReview">
        <button
          type="button"
          className="campaignLink"
          aria-label={`Review ${company.name}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenReview(company.id);
          }}
        >
          Review
        </button>
      </div>
      <div role="cell" className="campaignCell campaignColScore">
        <CampaignScore score={company.confidence} />
      </div>
    </div>
  );
}
