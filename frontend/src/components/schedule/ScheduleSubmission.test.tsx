import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScheduleSubmissionScreen } from './ScheduleSubmission';
import type { ScheduleSummary } from './types';

const mocks = vi.hoisted(() => ({
  summary: undefined as unknown,
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
}));

function refName(ref: unknown): string {
  return String(
    (ref as Record<symbol, unknown>)[Symbol.for('functionName')] ?? '',
  );
}

vi.mock('convex/react', () => ({
  useQuery: (_ref: unknown, args: unknown) =>
    args === 'skip' ? undefined : mocks.summary,
  useMutation: (ref: unknown) => {
    const name = refName(ref);
    mocks.mutations[name] ??= vi.fn();
    return mocks.mutations[name];
  },
}));

const readySummary: ScheduleSummary = {
  entities: [
    {
      id: 'acme.test',
      name: 'Acme',
      initial: 'A',
      segment: 'Dental',
      contacts: 2,
      status: 'Not Sent',
      draftState: 'approved',
      ready: true,
    },
  ],
  totalCompanies: 1,
  approvedDrafts: 1,
  totalEmailsQueued: 2,
};

describe('ScheduleSubmissionScreen', () => {
  beforeEach(() => {
    mocks.summary = readySummary;
    mocks.mutations = {};
  });

  it('renders the scheduling form with an honest delivery note', () => {
    render(<ScheduleSubmissionScreen companyIds={['acme.test']} />);
    expect(
      screen.getByRole('heading', { name: 'Schedule Submission' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: /Immediate Send/ }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByText(/immutable copy of the approved draft/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /as Drafts/ })).toBeNull();
  });

  it('schedules approved companies and reports the queued count', async () => {
    render(<ScheduleSubmissionScreen companyIds={['acme.test']} />);
    mocks.mutations['send:enqueueSend']!.mockResolvedValue({
      batchId: 'b',
      queued: 2,
    });
    await userEvent.click(
      screen.getByRole('button', { name: /Schedule Outreach/ }),
    );
    expect(mocks.mutations['send:enqueueSend']).toHaveBeenCalledWith(
      expect.objectContaining({
        companyIds: ['acme.test'],
        method: 'immediate',
      }),
    );
    expect(
      await screen.findByText('2 emails scheduled for Gmail sending.'),
    ).toBeInTheDocument();
  });

  it('shows backend rejections such as duplicate recipients', async () => {
    render(<ScheduleSubmissionScreen companyIds={['acme.test']} />);
    mocks.mutations['send:enqueueSend']!.mockRejectedValue(
      new Error(
        '[CONVEX M(send:enqueueSend)] Uncaught Error: Recipient already contacted: a@acme.test\n at handler',
      ),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Schedule Outreach/ }),
    );
    expect(
      await screen.findByText('Recipient already contacted: a@acme.test'),
    ).toBeInTheDocument();
  });

  it('blocks scheduling when a selected company is not approved', () => {
    mocks.summary = {
      ...readySummary,
      entities: [
        ...readySummary.entities,
        {
          id: 'b',
          name: 'Beta',
          initial: 'B',
          segment: 'x',
          contacts: 1,
          draftState: 'ready',
          ready: false,
        },
      ],
      totalCompanies: 2,
    };
    render(<ScheduleSubmissionScreen companyIds={['acme.test', 'b']} />);
    expect(
      screen.getByRole('button', { name: /Schedule Outreach/ }),
    ).toBeDisabled();
    expect(screen.getByText('Not approved')).toBeInTheDocument();
    expect(
      screen.getByText(/Some selected companies are not ready/),
    ).toBeInTheDocument();
  });

  it('cancels queued sends for selected companies', async () => {
    render(<ScheduleSubmissionScreen companyIds={['acme.test']} />);
    mocks.mutations['send:cancelScheduledSends']!.mockResolvedValue({
      canceled: 2,
    });
    await userEvent.click(
      screen.getByLabelText('Select Acme for unscheduling'),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Unschedule selected/ }),
    );
    expect(mocks.mutations['send:cancelScheduledSends']).toHaveBeenCalledWith({
      companyIds: ['acme.test'],
    });
    expect(
      await screen.findByText('2 scheduled emails canceled.'),
    ).toBeInTheDocument();
  });

  it('returns via the back link and cancel, and purges settled companies on unmount', async () => {
    const onBack = vi.fn();
    const { unmount } = render(
      <ScheduleSubmissionScreen companyIds={['acme.test']} onBack={onBack} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Back to Send' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onBack).toHaveBeenCalledTimes(2);
    unmount();
    expect(mocks.mutations['send:purgeSettledCompanies']).toHaveBeenCalledWith({
      companyIds: ['acme.test'],
    });
  });
});
