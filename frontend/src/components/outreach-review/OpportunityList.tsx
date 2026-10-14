import type { OpportunityListProps } from './types';

/** Opportunities, separating what was observed from what is a hypothesis. */
export function OpportunityList({ opportunities }: OpportunityListProps) {
  return (
    <>
      <h3 className="reviewSubTitle">Lead-capture opportunities</h3>
      <ol className="reviewOpportunities">
        {opportunities.map((opportunity) => (
          <li key={opportunity.title} className="reviewOpportunity">
            <p className="reviewOpportunityTitle">{opportunity.title}</p>
            <p>
              <span className="reviewTag reviewTag-observed">Observed</span>{' '}
              {opportunity.observation}{' '}
              <span className="reviewMuted">
                ({opportunity.evidenceIds.join(', ')})
              </span>
            </p>
            {opportunity.hypothesis ? (
              <p>
                <span className="reviewTag reviewTag-hypothesis">
                  Hypothesis
                </span>{' '}
                {opportunity.hypothesis}
              </p>
            ) : null}
            {opportunity.suggestedImprovement ? (
              <p>
                <span className="reviewTag reviewTag-proposal">Proposal</span>{' '}
                {opportunity.suggestedImprovement}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </>
  );
}
