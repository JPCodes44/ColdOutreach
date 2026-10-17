import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampaignHeader } from './CampaignHeader';
import type { CampaignHeaderProps } from './types';

function renderHeader(overrides: Partial<CampaignHeaderProps> = {}) {
  const props: CampaignHeaderProps = {
    query: '',
    onQueryChange: vi.fn(),
    statusFilter: 'all',
    onStatusFilterChange: vi.fn(),
    selectedCount: 1,
    running: false,
    websiteReviewEnabled: true,
    onWebsiteReviewChange: vi.fn(),
    onRun: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<CampaignHeader {...props} />);
  return props;
}

describe('CampaignHeader', () => {
  it('states that generating never sends and offers no résumé actions', () => {
    renderHeader();
    expect(
      screen.getByRole('heading', { name: 'Outreach Pipeline' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/never sends email/)).toBeInTheDocument();
    expect(screen.queryByText(/resume|subject/i)).toBeNull();
  });

  it('wires search, filters, run, and delete', async () => {
    const props = renderHeader();
    await userEvent.type(
      screen.getByPlaceholderText('Search companies...'),
      'a',
    );
    expect(props.onQueryChange).toHaveBeenCalledWith('a');
    await userEvent.click(
      screen.getByRole('button', { name: 'Ready for review' }),
    );
    expect(props.onStatusFilterChange).toHaveBeenCalledWith('ready');
    await userEvent.click(screen.getByRole('button', { name: /Run pipeline/ }));
    expect(props.onRun).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: /Delete/ }));
    expect(props.onDelete).toHaveBeenCalledTimes(1);
  });

  it('disables actions with no selection or while starting', () => {
    renderHeader({ selectedCount: 0 });
    expect(screen.getByRole('button', { name: /Run pipeline/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Delete/ })).toBeDisabled();
  });
});
