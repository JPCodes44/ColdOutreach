import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OpportunityList } from './OpportunityList';
import { reviewFixture } from './testReview';

describe('OpportunityList', () => {
  it('labels observed evidence separately from hypotheses and proposals', () => {
    render(
      <OpportunityList
        opportunities={reviewFixture().analysis!.opportunities}
      />,
    );
    expect(screen.getByText('Observed').parentElement).toHaveTextContent(
      'No web form was found. (E2)',
    );
    expect(screen.getByText('Hypothesis').parentElement).toHaveTextContent(
      'Evening visitors may have',
    );
    expect(screen.getByText('Hypothesis')).toHaveClass('reviewTag-hypothesis');
    expect(screen.getByText('Proposal').parentElement).toHaveTextContent(
      'Add a short form',
    );
  });
});
