import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getFunctionName, type FunctionReference } from 'convex/server';
import { CampaignsScreen } from './Campaigns';
import { pipelineRow } from './testRows';
import type { PipelineCompanyRow } from './types';
import { reviewFixture } from '../outreach-review/testReview';
import type { ReviewData } from '../outreach-review/types';

const mocks = vi.hoisted(() => ({
  rows: undefined as PipelineCompanyRow[] | undefined,
  requestRuns: vi.fn(),
  deleteCompanies: vi.fn(),
  deleteDrafts: vi.fn(),
  saveDraft: vi.fn(),
  reviews: {} as Record<string, ReviewData>,
}));

vi.mock('convex/react', () => ({
  useQuery: (ref: FunctionReference<'query'>, args: { companyId?: string }) =>
    getFunctionName(ref) === 'outreachRuns:getReview'
      ? mocks.reviews[args.companyId!]
      : mocks.rows,
  useMutation: (ref: FunctionReference<'mutation'>) =>
    getFunctionName(ref) === 'outreachRuns:requestRuns'
      ? mocks.requestRuns
      : getFunctionName(ref) === 'outreachRuns:saveDraftEdits'
        ? mocks.saveDraft
        : getFunctionName(ref) === 'outreachRuns:deleteDrafts'
          ? mocks.deleteDrafts
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
  mocks.deleteDrafts.mockReset();
  mocks.saveDraft.mockReset();
  mocks.saveDraft.mockResolvedValue(null);
  mocks.reviews = Object.fromEntries(
    ROWS.map((row) => {
      const fixture = reviewFixture();
      return [
        row.id,
        reviewFixture({
          company: {
            ...fixture.company,
            id: row.id,
            name: row.name,
            domain: row.domain,
          },
          draft: {
            ...fixture.draft!,
            content: {
              ...fixture.draft!.content,
              subject: `Hello ${row.name}`,
            },
          },
        }),
      ];
    }),
  );
});

describe('CampaignsScreen', () => {
  it('filters by draft status and opens a company review', async () => {
    render(<CampaignsScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Needs run' }));
    expect(screen.queryByText('Acme Plumbing')).toBeNull();
    await userEvent.click(
      screen.getByRole('button', { name: 'Review Bolt Electric' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Review Bolt Electric' });
    expect(within(dialog).getByLabelText('Subject')).toHaveValue(
      'Hello Bolt Electric',
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Close review' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Needs run' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('opens each company in a modal with editing, saving, preview, and regeneration', async () => {
    mocks.requestRuns.mockResolvedValue({
      started: ['acme.test'],
      skipped: [],
    });
    render(<CampaignsScreen />);
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select Acme Plumbing' }),
    );
    await userEvent.click(screen.getByText('Acme Plumbing'));
    const dialog = screen.getByRole('dialog', { name: 'Review Acme Plumbing' });
    expect(
      within(dialog).getByRole('button', { name: 'Close review' }),
    ).toHaveFocus();
    expect(
      within(dialog).getByRole('region', { name: 'Website evidence' }),
    ).toBeInTheDocument();
    await userEvent.tab({ shift: true });
    expect(within(dialog).getByTitle('HTML email preview')).toHaveFocus();
    await userEvent.tab();
    expect(
      within(dialog).getByRole('button', { name: 'Close review' }),
    ).toHaveFocus();
    expect(within(dialog).getByTitle('HTML email preview')).toBeInTheDocument();
    const subject = within(dialog).getByLabelText('Subject');
    await userEvent.clear(subject);
    await userEvent.type(subject, 'Updated Acme subject');
    await userEvent.click(
      within(dialog).getByRole('tab', { name: 'Plain text' }),
    );
    expect(
      within(dialog).getByText(/Hi Acme team/, { selector: 'pre' }),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Save edits' }),
    );
    expect(mocks.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'acme.test',
        subject: 'Updated Acme subject',
      }),
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Regenerate' }),
    );
    expect(mocks.requestRuns).toHaveBeenCalledWith({
      companyIds: ['acme.test'],
      regenerate: true,
      websiteReviewEnabled: false,
    });
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getByRole('checkbox', { name: 'Select Acme Plumbing' }),
    ).toBeChecked();
    const next = screen.getByRole('button', { name: 'Review Bolt Electric' });
    await userEvent.click(next);
    const nextDialog = screen.getByRole('dialog', {
      name: 'Review Bolt Electric',
    });
    expect(within(nextDialog).getByLabelText('Subject')).toHaveValue(
      'Hello Bolt Electric',
    );
    await userEvent.keyboard('{Escape}');
    expect(next).toHaveFocus();
  });

  it('keeps keyboard checkbox selection separate from opening review', async () => {
    render(<CampaignsScreen />);
    const checkbox = screen.getByRole('checkbox', {
      name: 'Select Acme Plumbing',
    });
    checkbox.focus();
    await userEvent.keyboard(' ');
    expect(checkbox).toBeChecked();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('starts only selected companies needing drafts without showing a run log', async () => {
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
      companyIds: ['bolt.test'],
      websiteReviewEnabled: false,
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it.each(['ready', 'approved', 'running'] as const)(
    'disables Run for a selection that is entirely %s while keeping delete available',
    async (draftState) => {
      mocks.rows = [pipelineRow({ draftState })];
      render(<CampaignsScreen />);
      await userEvent.click(
        screen.getByRole('checkbox', { name: 'Select all companies' }),
      );
      const run = screen.getByRole('button', { name: /Run pipeline/ });
      expect(run).toBeDisabled();
      await userEvent.click(run);
      expect(mocks.requestRuns).not.toHaveBeenCalled();
      expect(
        screen.getByRole('button', { name: 'Delete companies' }),
      ).toBeEnabled();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    },
  );

  it('disables Run as selected companies finish and enables it again when a draft is removed', async () => {
    mocks.rows = [pipelineRow({ draftState: 'none' })];
    const { rerender } = render(<CampaignsScreen />);
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select all companies' }),
    );
    expect(screen.getByRole('button', { name: /Run pipeline/ })).toBeEnabled();
    mocks.rows = [pipelineRow({ draftState: 'ready' })];
    rerender(<CampaignsScreen />);
    expect(screen.getByRole('button', { name: /Run pipeline/ })).toBeDisabled();
    mocks.rows = [pipelineRow({ draftState: 'none' })];
    rerender(<CampaignsScreen />);
    expect(screen.getByRole('button', { name: /Run pipeline/ })).toBeEnabled();
  });

  it.each(['failed', 'legacy'] as const)(
    'allows selected %s companies to run',
    async (draftState) => {
      mocks.rows = [pipelineRow({ draftState })];
      render(<CampaignsScreen />);
      await userEvent.click(
        screen.getByRole('checkbox', { name: 'Select all companies' }),
      );
      expect(
        screen.getByRole('button', { name: /Run pipeline/ }),
      ).toBeEnabled();
    },
  );

  it('defaults website review off and can enable it for selected companies', async () => {
    mocks.requestRuns.mockResolvedValue({
      started: ['bolt.test'],
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
      screen.getByRole('checkbox', { name: 'Select Bolt Electric' }),
    );
    await userEvent.click(screen.getByRole('button', { name: /Run pipeline/ }));
    expect(mocks.requestRuns).toHaveBeenCalledWith({
      companyIds: ['bolt.test'],
      websiteReviewEnabled: true,
    });
  });

  it('confirms draft-only deletion and keeps the company deletion action separate', async () => {
    mocks.deleteDrafts.mockResolvedValue({ deleted: 1 });
    render(<CampaignsScreen />);
    expect(
      screen.getByRole('button', { name: 'Delete drafts' }),
    ).toBeDisabled();
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select Acme Plumbing' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete drafts' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Confirm delete' });
    expect(
      within(dialog).getByText(
        /Companies, research, recipients, and sent email history are kept/,
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete drafts' }),
    );
    expect(mocks.deleteDrafts).toHaveBeenCalledWith({
      companyIds: ['acme.test'],
    });
    expect(mocks.deleteCompanies).not.toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Deleted 1 draft. Companies are kept.',
    );
    expect(screen.getByText('Acme Plumbing')).toBeInTheDocument();
  });

  it('can cancel draft deletion and shows backend refusal messages', async () => {
    mocks.deleteDrafts.mockRejectedValue(
      new Error('Draft generation is in progress.'),
    );
    render(<CampaignsScreen />);
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select Acme Plumbing' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete drafts' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mocks.deleteDrafts).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete drafts' }),
    );
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete drafts',
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Draft generation is in progress.',
    );
    expect(
      screen.getByRole('checkbox', { name: 'Select Acme Plumbing' }),
    ).toBeChecked();
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
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete companies' }),
    );
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

  it('starts all selected companies when the selection exceeds ten', async () => {
    mocks.rows = Array.from({ length: 11 }, (_, i) =>
      pipelineRow({ id: `c${i}.test`, name: `Company ${i}` }),
    );
    mocks.requestRuns.mockResolvedValue({
      started: mocks.rows.map((row) => row.id),
      skipped: [],
    });
    render(<CampaignsScreen />);
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select all companies' }),
    );
    await userEvent.click(screen.getByRole('button', { name: /Run pipeline/ }));
    expect(mocks.requestRuns).toHaveBeenCalledWith({
      companyIds: Array.from({ length: 11 }, (_, i) => `c${i}.test`),
      websiteReviewEnabled: false,
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Select all companies' }),
    ).not.toBeChecked();
  });
});
