import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OutreachReviewScreen } from './OutreachReviewScreen';
import { reviewFixture } from './testReview';
import type { ReviewData } from './types';

const mocks = vi.hoisted(() => ({
  review: undefined as ReviewData | null | undefined,
  queryArgs: [] as unknown[],
  requestRuns: vi.fn(),
}));

vi.mock('convex/react', () => ({
  useQuery: (_ref: unknown, args: unknown) => {
    mocks.queryArgs.push(args);
    return args === 'skip' ? undefined : mocks.review;
  },
  useMutation: () => mocks.requestRuns,
}));

beforeEach(() => {
  mocks.review = reviewFixture();
  mocks.queryArgs = [];
  mocks.requestRuns.mockReset();
});

describe('OutreachReviewScreen', () => {
  it('shows an empty state without a company and skips the query', () => {
    render(<OutreachReviewScreen />);
    expect(screen.getByText(/Pick a company/)).toBeInTheDocument();
    expect(mocks.queryArgs).toEqual(['skip']);
  });

  it('shows evidence, the dashboard concept, editor, and preview for a draft', () => {
    render(<OutreachReviewScreen companyId="acme.test" />);
    expect(
      screen.getByRole('region', { name: 'Website evidence' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Illustrative — example only')).toBeInTheDocument();
    expect(screen.getByLabelText('Subject')).toHaveValue(
      'A thought on the Acme contact page',
    );
    expect(screen.getByTitle('HTML email preview')).toBeInTheDocument();
  });

  it('explains research-only drafts and preserves the mode when regenerating', async () => {
    const fixture = reviewFixture();
    mocks.review = reviewFixture({
      draft: { ...fixture.draft!, websiteReviewEnabled: false },
      latestRun: { ...fixture.latestRun!, websiteReviewEnabled: false },
      evidence: { sources: [], facts: [], skipped: [], excerpts: [] },
    });
    mocks.requestRuns.mockResolvedValue({
      started: ['acme.test'],
      skipped: [],
    });
    render(<OutreachReviewScreen companyId="acme.test" />);
    expect(
      screen.getByText(/Website review was turned off/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Website evidence' }),
    ).toBeNull();
    expect(
      screen.queryByRole('region', { name: 'Proposed solution' }),
    ).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Regenerate/ }));
    expect(mocks.requestRuns).toHaveBeenCalledWith({
      companyIds: ['acme.test'],
      websiteReviewEnabled: false,
      regenerate: true,
    });
  });

  it('omits website progress steps when website review is off', () => {
    mocks.review = reviewFixture({
      draftState: 'running',
      draft: null,
      latestRun: {
        ...reviewFixture().latestRun!,
        status: 'running',
        stage: 'composing',
        websiteReviewEnabled: false,
      },
    });
    render(<OutreachReviewScreen companyId="acme.test" />);
    expect(screen.queryByText('Reviewing website')).toBeNull();
    expect(screen.queryByText('Finding opportunities')).toBeNull();
    expect(screen.getByText('Writing email')).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('shows progress while running and keeps the previous draft on failure', () => {
    mocks.review = reviewFixture({
      draftState: 'running',
      draft: null,
      latestRun: {
        ...reviewFixture().latestRun!,
        status: 'running',
        stage: 'analyzing',
      },
    });
    const { unmount } = render(<OutreachReviewScreen companyId="acme.test" />);
    expect(screen.getByText('Finding opportunities')).toHaveAttribute(
      'aria-current',
      'step',
    );
    unmount();

    mocks.review = reviewFixture({
      latestRun: {
        ...reviewFixture().latestRun!,
        status: 'failed',
        error: 'acme.test responded with HTTP 503.',
      },
    });
    render(<OutreachReviewScreen companyId="acme.test" />);
    expect(
      screen.getByText('acme.test responded with HTTP 503.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Subject')).toBeInTheDocument();
  });

  it('explains legacy drafts and regenerates on request', async () => {
    mocks.review = reviewFixture({
      draftState: 'legacy',
      draft: null,
      evidence: null,
      analysis: null,
      latestRun: null,
    });
    mocks.requestRuns.mockResolvedValue({
      started: [],
      skipped: [
        { companyId: 'acme.test', reason: 'A run is already in progress.' },
      ],
    });
    render(<OutreachReviewScreen companyId="acme.test" />);
    expect(
      screen.getByText(
        /legacy job-application draft exists. It cannot be sent/,
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Run pipeline/ }));
    expect(mocks.requestRuns).toHaveBeenCalledWith({
      companyIds: ['acme.test'],
      websiteReviewEnabled: false,
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'A run is already in progress.',
    );
  });
});
