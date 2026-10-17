import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getFunctionName, type FunctionReference } from 'convex/server';
import { CampaignsScreen } from './Campaigns';
import { pipelineRow } from './testRows';
import type { PipelineCompanyRow } from './types';

const mocks = vi.hoisted(() => ({
  rows: undefined as PipelineCompanyRow[] | undefined,
  requestRuns: vi.fn(),
  deleteCompanies: vi.fn(),
}));

vi.mock('convex/react', () => ({
  useQuery: () => mocks.rows,
  useMutation: (ref: FunctionReference<'mutation'>) =>
    getFunctionName(ref) === 'outreachRuns:requestRuns'
      ? mocks.requestRuns
      : mocks.deleteCompanies,
}));

const ROWS = [
  pipelineRow({ id: 'acme.test', name: 'Acme Plumbing', draftState: 'ready' }),
  pipelineRow({
    id: 'bolt.test',
    name: 'Bolt Electric',
    domain: 'bolt.test',
    draftState: 'none',
  }),
];

beforeEach(() => {
  mocks.rows = ROWS;
  mocks.requestRuns.mockReset();
  mocks.deleteCompanies.mockReset();
});

describe('CampaignsScreen', () => {
  it('filters by draft status and opens a company review', async () => {
    const onOpenReview = vi.fn();
    render(<CampaignsScreen onOpenReview={onOpenReview} />);
    await userEvent.click(screen.getByRole('button', { name: 'Needs run' }));
    expect(screen.queryByText('Acme Plumbing')).toBeNull();
    await userEvent.click(
      screen.getByRole('button', { name: 'Review Bolt Electric' }),
    );
    expect(onOpenReview).toHaveBeenCalledWith('bolt.test');
  });

  it('starts runs for the selection and reports skipped companies', async () => {
    mocks.requestRuns.mockResolvedValue({
      started: ['acme.test'],
      skipped: [
        { companyId: 'bolt.test', reason: 'A run is already in progress.' },
      ],
    });
    render(<CampaignsScreen />);
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select all companies' }),
    );
    await userEvent.click(screen.getByRole('button', { name: /Run pipeline/ }));
    expect(mocks.requestRuns).toHaveBeenCalledWith({
      companyIds: ['acme.test', 'bolt.test'],
      websiteReviewEnabled: false,
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Started 1 run. No email is sent. Bolt Electric: A run is already in progress.',
    );
  });

  it('defaults website review off and can enable it for selected companies', async () => {
    mocks.requestRuns.mockResolvedValue({
      started: ['acme.test'],
      skipped: [],
    });
    render(<CampaignsScreen />);
    const toggle = screen.getByRole('switch', { name: 'Review website' });
    expect(toggle).not.toBeChecked();
    expect(
      screen.getByText(/company research and email instructions only/i),
    ).toBeInTheDocument();
    await userEvent.click(toggle);
    expect(toggle).toBeChecked();
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select Acme Plumbing' }),
    );
    await userEvent.click(screen.getByRole('button', { name: /Run pipeline/ }));
    expect(mocks.requestRuns).toHaveBeenCalledWith({
      companyIds: ['acme.test'],
      websiteReviewEnabled: true,
    });
  });

  it('confirms deletes and surfaces backend refusals', async () => {
    mocks.deleteCompanies.mockRejectedValue(
      new Error(
        'Server Error\nUncaught Error: Acme Plumbing has sends queued, in flight, or awaiting review.\n  at x',
      ),
    );
    render(<CampaignsScreen />);
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select Acme Plumbing' }),
    );
    await userEvent.click(screen.getByRole('button', { name: /^Delete$/ }));
    const dialog = screen.getByRole('dialog', { name: 'Confirm delete' });
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' }),
    );
    expect(mocks.deleteCompanies).toHaveBeenCalledWith({
      externalIds: ['acme.test'],
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Acme Plumbing has sends queued, in flight, or awaiting review.',
    );
  });

  it('caps a single run request at ten companies', async () => {
    mocks.rows = Array.from({ length: 11 }, (_, i) =>
      pipelineRow({ id: `c${i}.test`, name: `Company ${i}` }),
    );
    render(<CampaignsScreen />);
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select all companies' }),
    );
    await userEvent.click(screen.getByRole('button', { name: /Run pipeline/ }));
    expect(mocks.requestRuns).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Run at most 10 companies at a time.',
    );
  });
});
