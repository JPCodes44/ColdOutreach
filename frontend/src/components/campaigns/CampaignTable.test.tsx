import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampaignTable } from './CampaignTable';
import { pipelineRow } from './testRows';

describe('CampaignTable', () => {
  it('renders pipeline columns without résumé or template columns', () => {
    render(
      <CampaignTable
        companies={[{ ...pipelineRow(), selected: true }]}
        loading={false}
        onOpenReview={vi.fn()}
        onToggleSelected={vi.fn()}
        onToggleAll={vi.fn()}
      />,
    );
    for (const name of [
      'Company',
      'Website',
      'Draft status',
      'Subject',
      'Review',
      'Score',
    ]) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument();
    }
    expect(
      screen.queryByRole('columnheader', { name: /Resume|Template/ }),
    ).toBeNull();
    expect(
      screen.getByRole('checkbox', { name: 'Select all companies' }),
    ).toBeChecked();
  });

  it('shows loading and empty states and toggles all', async () => {
    const onToggleAll = vi.fn();
    const { rerender } = render(
      <CampaignTable
        companies={[]}
        loading
        onOpenReview={vi.fn()}
        onToggleSelected={vi.fn()}
        onToggleAll={onToggleAll}
      />,
    );
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    rerender(
      <CampaignTable
        companies={[]}
        loading={false}
        onOpenReview={vi.fn()}
        onToggleSelected={vi.fn()}
        onToggleAll={onToggleAll}
      />,
    );
    expect(screen.getByText(/No companies yet/)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select all companies' }),
    );
    expect(onToggleAll).toHaveBeenCalledTimes(1);
  });
});
