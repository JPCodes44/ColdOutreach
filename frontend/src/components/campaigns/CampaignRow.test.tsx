import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampaignRow } from './CampaignRow';
import { pipelineRow } from './testRows';

describe('CampaignRow', () => {
  it('opens the review from the row or the Review button, and toggles selection separately', async () => {
    const onOpenReview = vi.fn();
    const onToggleSelected = vi.fn();
    render(
      <CampaignRow
        company={{
          ...pipelineRow({
            draftState: 'ready',
            subject: 'A thought on your contact page',
          }),
          selected: false,
        }}
        onOpenReview={onOpenReview}
        onToggleSelected={onToggleSelected}
      />,
    );
    expect(screen.getByText('acme.test')).toBeInTheDocument();
    expect(
      screen.getByText('A thought on your contact page'),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select Acme Plumbing' }),
    );
    expect(onToggleSelected).toHaveBeenCalledWith('acme.test');
    expect(onOpenReview).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Review Acme Plumbing' }),
    );
    expect(onOpenReview).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByText('Acme Plumbing'));
    expect(onOpenReview).toHaveBeenCalledTimes(2);
  });

  it('marks running rows busy', () => {
    render(
      <CampaignRow
        company={{
          ...pipelineRow({ draftState: 'running', stage: 'retrieving' }),
          selected: false,
        }}
        onOpenReview={vi.fn()}
        onToggleSelected={vi.fn()}
      />,
    );
    expect(screen.getByRole('row')).toHaveAttribute('aria-busy', 'true');
  });

  it('shows the manufacturer segment under the industry', () => {
    render(
      <CampaignRow
        company={{
          ...pipelineRow({ segment: 'Mixed manufacturer' }),
          selected: false,
        }}
        onOpenReview={vi.fn()}
        onToggleSelected={vi.fn()}
      />,
    );
    expect(screen.getByText('Mixed manufacturer')).toHaveClass(
      'segmentBadge-mixed',
    );
  });
});
