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
      draftState: 'ready',
      ready: true,
    },
  ],
  totalCompanies: 1,
  readyDrafts: 1,
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
      screen.getByText(/immutable copy of the saved draft/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /as Drafts/ })).toBeNull();
  });

  it('schedules generated companies without approval and reports the queued count', async () => {
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

  it('schedules the eligible subset when another selected company is blocked', async () => {
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
          draftState: 'none',
          ready: false,
        },
      ],
      totalCompanies: 2,
    };
    render(<ScheduleSubmissionScreen companyIds={['acme.test', 'b']} />);
    mocks.mutations['send:enqueueSend']!.mockResolvedValue({
      batchId: 'b',
      queued: 2,
    });
    const schedule = screen.getByRole('button', { name: /Schedule Outreach/ });
    expect(schedule).toBeEnabled();
    expect(screen.getByText('Draft not ready')).toBeInTheDocument();
    expect(
      screen.getByText(/Only eligible companies will be scheduled/),
    ).toBeInTheDocument();
    await userEvent.click(schedule);
    expect(mocks.mutations['send:enqueueSend']).toHaveBeenCalledWith(
      expect.objectContaining({ companyIds: ['acme.test'] }),
    );
  });

  it('disables scheduling when every selected company already has an active send', () => {
    mocks.summary = {
      ...readySummary,
      readyDrafts: 0,
      totalEmailsQueued: 0,
      entities: [
        {
          ...readySummary.entities[0],
          status: 'Sending',
          ready: false,
          notReadyReason: 'Already queued',
        },
      ],
    };
    render(<ScheduleSubmissionScreen companyIds={['acme.test']} />);
    expect(
      screen.getByRole('button', { name: /Schedule Outreach/ }),
    ).toBeDisabled();
    expect(mocks.mutations['send:enqueueSend']).not.toHaveBeenCalled();
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
