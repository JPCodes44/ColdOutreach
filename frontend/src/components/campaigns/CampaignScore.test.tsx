import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CampaignScore } from './CampaignScore';

describe('CampaignScore', () => {
  it('snaps the bar to 5% steps and shows the score', () => {
    const { container } = render(<CampaignScore score={83} />);
    expect(screen.getByText('83')).toHaveClass('campaignScoreGood');
    expect(container.querySelector('.campaignScoreFill-85')).not.toBeNull();
  });
});
